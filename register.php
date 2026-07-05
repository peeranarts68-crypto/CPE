<?php
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

// Load request JSON
$data = json_decode(file_get_contents('php://input'), true);
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';
$firstName = trim($data['first_name'] ?? '');
$nickname = trim($data['nickname'] ?? '');

if ($username === '' || $password === '' || $firstName === '' || $nickname === '') {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลให้ครบทุกช่อง']);
    exit;
}

// Enforce 10‑digit student ID pattern
if (!preg_match('/^[0-9]{10}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username ต้องเป็นรหัสนักศึกษา 10 หลักเท่านั้น']);
    exit;
}

// Verify DB manager is ready
if (!isset($manager) || !($manager instanceof MongoDB\Driver\Manager)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้']);
    exit;
}

try {
    $userCollection = $dbName . '.users';

    // Check for existing username
    $filter = ['username' => $username];
    $query = new MongoDB\Driver\Query($filter);
    $cursor = $manager->executeQuery($userCollection, $query);
    $existing = iterator_to_array($cursor);

    if (count($existing) > 0) {
        echo json_encode(['success' => false, 'message' => 'รหัสนักศึกษานี้เคยลงทะเบียนแล้ว']);
        exit;
    }

    // Insert new user
    $bulk = new MongoDB\Driver\BulkWrite;
    $bulk->insert([
        'username' => $username,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'first_name' => $firstName,
        'nickname' => $nickname,
        'role' => 'cpe69',
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ]);

    $manager->executeBulkWrite($userCollection, $bulk);
    echo json_encode(['success' => true, 'message' => 'ลงทะเบียนสำเร็จ!']);
} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    $msg = $e->getMessage();
    if (strpos($msg, 'Authentication') !== false || strpos($msg, 'bad auth') !== false) {
        $msg = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ กรุณาติดต่อผู้ดูแลระบบ';
    }
    echo json_encode(['success' => false, 'message' => $msg]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'เกิดข้อผิดพลาดที่ไม่คาดคิด']);
}
?>
