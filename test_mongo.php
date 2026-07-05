<?php
require __DIR__ . '/db.php';
if (isset($manager) && $manager instanceof MongoDB\Driver\Manager) {
    echo "✅ MongoDB connection successful.\n";
    echo "Database: {$dbName}\nCollection: {$collection}\n";
} else {
    echo "❌ MongoDB manager not initialized.\n";
}
?>
