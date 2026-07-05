<?php
ini_set('display_errors', 0);
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$juniorId = $_GET['junior_id'] ?? '';
$juniorId = trim($juniorId);

if ($juniorId === '') {
    echo json_encode(['success' => false, 'message' => 'Missing junior_id']);
    exit;
}

try {
    // 1. Find if this junior has drawn any hint (hint_number = 1)
    $filter1 = ['drawn_by' => $juniorId, 'hint_number' => 1];
    $query1 = new MongoDB\Driver\Query($filter1);
    $cursor1 = $manager->executeQuery($collection, $query1);
    $drawnHints = iterator_to_array($cursor1);

    if (count($drawnHints) === 0) {
        // Junior hasn't drawn anything yet
        echo json_encode([
            'success' => true,
            'has_drawn' => false,
            'hints' => []
        ]);
        exit;
    }

    $firstHint = $drawnHints[0];
    $seniorName = $firstHint->senior_name;

    // 2. Fetch all 3 hints for this senior
    $filter2 = ['senior_name' => $seniorName];
    $options2 = ['sort' => ['hint_number' => 1]]; // Sort by hint number
    $query2 = new MongoDB\Driver\Query($filter2, $options2);
    $cursor2 = $manager->executeQuery($collection, $query2);
    $allHints = iterator_to_array($cursor2);

    $formattedHints = [];
    foreach ($allHints as $h) {
        $isDrawn = (bool)($h->is_drawn ?? false);
        $hintNum = (int)($h->hint_number ?? 1);
        
        // Security check: Only return the hint text if it is drawn/released,
        // otherwise hide the text to prevent inspect element cheating!
        $text = $isDrawn ? $h->hint_text : '🔒 ยังไม่ถูกเปิดเผยโดยพี่รหัส';
        
        $formattedHints[] = [
            'hint_number' => $hintNum,
            'is_released' => $isDrawn,
            'hint_text' => $text
        ];
    }

    echo json_encode([
        'success' => true,
        'has_drawn' => true,
        'senior_name' => $seniorName,
        'hints' => $formattedHints
    ], JSON_UNESCAPED_UNICODE);

} catch (MongoDB\Driver\Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
