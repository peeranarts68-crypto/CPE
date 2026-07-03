<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

// Fetch hints that have not been drawn yet
$filter = ['is_drawn' => false];
$options = ['projection' => ['_id' => 1, 'hint_text' => 1, 'is_drawn' => 1]];
$query = new MongoDB\Driver\Query($filter, $options);

try {
    $cursor = $manager->executeQuery($collection, $query);
    $hints = [];
    foreach ($cursor as $doc) {
        $docArray = (array)$doc;
        // Convert MongoDB\BSON\ObjectId to string for JSON
        if (isset($docArray['_id']) && $docArray['_id'] instanceof MongoDB\BSON\ObjectId) {
            $docArray['_id'] = (string)$docArray['_id'];
        }
        $hints[] = $docArray;
    }
    echo json_encode($hints, JSON_UNESCAPED_UNICODE);
} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
