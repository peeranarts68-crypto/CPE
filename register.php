<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';
$firstName = trim($data['first_name'] ?? '');
$nickname = trim($data['nickname'] ?? '');

if ($username === '' || $password === '' || $firstName === '' || $nickname === '') {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกข้อมูลให้ครบทุกช่อง']);
    exit;
}

// Enforce 10-digit student ID pattern
if (!preg_match('/^[0-9]{10}$/', $username)) {
    echo json_encode(['success' => false, 'message' => 'Username ต้องเป็นรหัสนักศึกษา 10 หลักเท่านั้น']);
    exit;
}

try {
    $userCollection = $dbName . '.users';

    // Check if username already exists
    $filter = ['username' => $username];
    $query = new MongoDB\Driver\Query($filter);
    $cursor = $manager->executeQuery($userCollection, $query);
    $existing = iterator_to_array($cursor);

    if (count($existing) > 0) {
        echo json_encode(['success' => false, 'message' => 'รหัสนักศึกษานี้เคยลงทะเบียนแล้ว']);
        exit;
    }

    // Insert user into collection
    $bulk = new MongoDB\Driver\BulkWrite;
    $bulk->insert([
        'username' => $username,
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'first_name' => $firstName,
        'nickname' => $nickname,
        'role' => 'cpe69', // Default junior rank
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ]);

    $result = $manager->executeBulkWrite($userCollection, $bulk);
    echo json_encode(['success' => true, 'message' => 'ลงทะเบียนสำเร็จ!']);

} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
