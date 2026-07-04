<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

try {
    $bulk = new MongoDB\Driver\BulkWrite;
    $bulk->update(
        [],
        ['$set' => ['is_drawn' => false, 'drawn_by' => '']],
        ['multi' => true]
    );
    $result = $manager->executeBulkWrite($collection, $bulk);
    echo json_encode(['success' => true, 'modifiedCount' => $result->getModifiedCount()]);
} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
