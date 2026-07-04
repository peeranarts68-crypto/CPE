<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$data = json_decode(file_get_contents('php://input'), true);
$seniorName = trim($data['senior_name'] ?? '');
$hints = $data['hints'] ?? [];
$singleHint = trim($data['hint_text'] ?? '');

if ($seniorName === '') {
    echo json_encode(['success' => false, 'message' => 'Missing senior_name']);
    exit;
}

$bulk = new MongoDB\Driver\BulkWrite;
$insertedCount = 0;

if (!empty($hints) && is_array($hints)) {
    $i = 1;
    foreach ($hints as $hintText) {
        $hintText = trim($hintText);
        if ($hintText !== '') {
            $bulk->insert([
                'senior_name' => $seniorName,
                'hint_text' => $hintText,
                'is_drawn' => false,
                'drawn_by' => '',
                'hint_number' => $i,
                'created_at' => new MongoDB\BSON\UTCDateTime()
            ]);
            $insertedCount++;
            $i++;
        }
    }
} elseif ($singleHint !== '') {
    $bulk->insert([
        'senior_name' => $seniorName,
        'hint_text' => $singleHint,
        'is_drawn' => false,
        'drawn_by' => '',
        'hint_number' => 1,
        'created_at' => new MongoDB\BSON\UTCDateTime()
    ]);
    $insertedCount++;
} else {
    echo json_encode(['success' => false, 'message' => 'Empty hint text']);
    exit;
}

if ($insertedCount > 0) {
    try {
        $result = $manager->executeBulkWrite($collection, $bulk);
        echo json_encode(['success' => true, 'insertedCount' => $result->getInsertedCount()]);
    } catch (MongoDB\Driver\Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'No valid hints provided']);
}
?>
