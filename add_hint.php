<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$hintText = $data['hint_text'] ?? '';
$hintText = trim($hintText);

if ($hintText === '') {
    echo json_encode(['success' => false, 'message' => 'Empty hint text']);
    exit;
}

$bulk = new MongoDB\Driver\BulkWrite;
$doc = [
    'hint_text' => $hintText,
    'is_drawn' => false,
    'created_at' => new MongoDB\BSON\UTCDateTime()
];
$bulk->insert($doc);

try {
    $result = $manager->executeBulkWrite($collection, $bulk);
    echo json_encode(['success' => true, 'insertedCount' => $result->getInsertedCount()]);
} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
