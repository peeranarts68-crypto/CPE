<?php
ini_set('display_errors', 0);
error_reporting(0);
/**
 * MongoDB connection wrapper (replaces previous MySQL based db.php)
 *
 * Reads connection URI from environment variable MONGODB_URI.
 * If the variable is not set, attempts to load a .env file in the project root.
 * Uses the native MongoDB extension (no Composer required).
 */
// ------------------------------------------------------------
// Load .env file if MONGODB_URI is missing (simple dotenv loader)
// ------------------------------------------------------------
if (!getenv('MONGODB_URI')) {
    $envPath = __DIR__ . '/.env';
    if (file_exists($envPath)) {
        $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') continue; // Skip comments/blank
            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $key = $parts[0];
                $value = $parts[1];
                // Preserve existing env vars, but allow .env to set missing ones
                if (!getenv($key)) {
                    putenv("$key=$value");
                }
            }
        }
    }
}

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
        // Fallback to 'cpe6869' if database name is not specified in the URI
        $dbName = 'cpe6869';
    }
    // Collection name used throughout the project
    $collection = $dbName . '.hints';
} catch (MongoDB\Driver\Exception $e) {
    die('❌ MongoDB connection error: ' . $e->getMessage());
}
?>
