<?php
require __DIR__ . '/vendor/autoload.php';

function loadEnv($path)
{
    if (!file_exists($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || strpos($line, '#') === 0) {
            continue;
        }
        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }
        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));
        $value = trim($value, "\"'");

        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
}

loadEnv(__DIR__ . '/.env');

$mongoUri = getenv('MONGODB_URI');

if (!$mongoUri) {
    die("ไม่พบ MONGODB_URI กรุณาตั้งค่าใน .env หรือ Environment Variable");
}

try {
    $client = new MongoDB\Client($mongoUri);
    $db = $client->cpe_database;
} catch (Exception $e) {
    die("เชื่อมต่อ database ไม่สำเร็จ: " . $e->getMessage());
}
?>