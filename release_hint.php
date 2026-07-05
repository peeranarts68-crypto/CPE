<?php
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$seniorName = trim($data['senior_name'] ?? '');
$hintNumber = (int)($data['hint_number'] ?? 0);
$juniorId = trim($data['junior_id'] ?? '');

if ($seniorName === '' || $hintNumber <= 1 || $juniorId === '') {
    echo json_encode(['success' => false, 'message' => 'ข้อมูลไม่ครบถ้วน (senior_name, hint_number, junior_id)']);
    exit;
}

try {
    // Check if Hint 1 is indeed drawn by this junior first (security check)
    $checkFilter = ['senior_name' => $seniorName, 'hint_number' => 1, 'drawn_by' => $juniorId];
    $checkQuery = new MongoDB\Driver\Query($checkFilter);
    $checkCursor = $manager->executeQuery($collection, $checkQuery);
    $checkResult = iterator_to_array($checkCursor);

    if (count($checkResult) === 0) {
        echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลความสัมพันธ์สายรหัสที่ถูกต้อง']);
        exit;
    }

    // Update the targeted hint number to be drawn by this junior
    $bulk = new MongoDB\Driver\BulkWrite;
    $bulk->update(
        ['senior_name' => $seniorName, 'hint_number' => $hintNumber],
        ['$set' => ['is_drawn' => true, 'drawn_by' => $juniorId]]
    );

    $result = $manager->executeBulkWrite($collection, $bulk);
    
    if ($result->getModifiedCount() > 0 || $result->getMatchedCount() > 0) {
        echo json_encode(['success' => true, 'message' => 'ปล่อยคำใบ้สำเร็จ!']);
    } else {
        echo json_encode(['success' => false, 'message' => 'ไม่พบข้อมูลคำใบ้หรือไม่มีการเปลี่ยนแปลง']);
    }

} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
