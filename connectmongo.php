<?php
require __DIR__ . '/vendor/autoload.php';

$mongoUri = getenv('MONGODB_URI');

try {
    $client = new MongoDB\Client($mongoUri);
    $db = $client->cpe_database;
} catch (Exception $e) {
    die("เชื่อมต่อ database ไม่สำเร็จ: " . $e->getMessage());
}
