<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

if ($conn->query("UPDATE hints SET is_drawn = 0")) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Database error']);
}
?>
