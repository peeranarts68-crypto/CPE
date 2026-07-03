<?php
/**
 * MongoDB connection wrapper (replaces previous MySQL based db.php)
 *
 * Reads connection URI from environment variable MONGODB_URI.
 * Uses the native MongoDB extension (no Composer required).
 */
$mongoUri = getenv('MONGODB_URI');
if (!$mongoUri) {
    die('❌ MONGODB_URI environment variable not set');
}

try {
    // Manager is the low‑level driver entry point
    $manager = new MongoDB\Driver\Manager($mongoUri);
    // Extract database name from URI (after the last slash before ?)
    $parsed = parse_url($mongoUri);
    $path   = $parsed['path'] ?? '';
    $dbName = ltrim($path, '/');
    if (!$dbName) {
        die('❌ Database name not found in MONGODB_URI');
    }
    // Collection name used throughout the project
    $collection = $dbName . '.hints';
} catch (MongoDB\Driver\Exception $e) {
    die('❌ MongoDB connection error: ' . $e->getMessage());
}
?>
