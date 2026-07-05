<?php
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';

if ($username === '' || $password === '') {
    echo json_encode(['success' => false, 'message' => 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน']);
    exit;
}

try {
    $userCollection = $dbName . '.users';

    // Find user by username
    $filter = ['username' => $username];
    $query = new MongoDB\Driver\Query($filter);
    $cursor = $manager->executeQuery($userCollection, $query);
    $users = iterator_to_array($cursor);

    if (count($users) === 0) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลผู้ใช้งานในระบบ']);
        exit;
    }

    $user = $users[0];
    if (password_verify($password, $user->password)) {
        echo json_encode([
            'success' => true,
            'user' => [
                'username' => $user->username,
                'first_name' => $user->first_name,
                'nickname' => $user->nickname,
                'role' => $user->role ?? 'cpe69'
            ]
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => false, 'message' => 'รหัสผ่านไม่ถูกต้อง']);
    }

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
