<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

try {
    // We will use the 'users' collection in the same database
    $userCollection = $dbName . '.users';

    // Check if users already exist
    $filter = [];
    $query = new MongoDB\Driver\Query($filter);
    $cursor = $manager->executeQuery($userCollection, $query);
    $existingUsers = iterator_to_array($cursor);

    $bulk = new MongoDB\Driver\BulkWrite;
    $seeded = [];

    // Check and insert senior 6812345678
    $hasSenior = false;
    foreach ($existingUsers as $u) {
        if (($u->username ?? '') === '6812345678') {
            $hasSenior = true;
            break;
        }
    }
    if (!$hasSenior) {
        $bulk->insert([
            'username' => '6812345678',
            'password' => password_hash('password68', PASSWORD_DEFAULT),
            'first_name' => 'สมชาย',
            'nickname' => 'ชาย',
            'role' => 'cpe68',
            'created_at' => new MongoDB\BSON\UTCDateTime()
        ]);
        $seeded[] = '6812345678 (Senior)';
    }

    // Check and insert admin
    $hasAdmin = false;
    foreach ($existingUsers as $u) {
        if (($u->username ?? '') === 'cpeadmin') {
            $hasAdmin = true;
            break;
        }
    }
    if (!$hasAdmin) {
        $bulk->insert([
            'username' => 'cpeadmin',
            'password' => password_hash('admin', PASSWORD_DEFAULT),
            'first_name' => 'ผู้ดูแลระบบ',
            'nickname' => 'แอดมิน',
            'role' => 'cpe68',
            'created_at' => new MongoDB\BSON\UTCDateTime()
        ]);
        $seeded[] = 'cpeadmin (Admin)';
    }

    if (count($seeded) > 0) {
        $manager->executeBulkWrite($userCollection, $bulk);
        echo json_encode(['success' => true, 'message' => 'Seeded test users successfully', 'users' => $seeded], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode(['success' => true, 'message' => 'Test users already exist in database']);
    }

} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
