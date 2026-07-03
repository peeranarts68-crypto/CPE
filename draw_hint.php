<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$id = $data['id'] ?? '';
$id = trim($id);

if ($id === '') {
    echo json_encode(['success' => false, 'message' => 'Missing id']);
    exit;
}

try {
    $objectId = new MongoDB\BSON\ObjectId($id);
    $bulk = new MongoDB\Driver\BulkWrite;
    $bulk->update(['_id' => $objectId], ['$set' => ['is_drawn' => true]]);
    $result = $manager->executeBulkWrite($collection, $bulk);
    echo json_encode(['success' => true, 'matchedCount' => $result->getMatchedCount()]);
} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
