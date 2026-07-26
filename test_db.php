<?php
// Configuración de base de datos local
require_once 'api/db.php';

header('Content-Type: application/json; charset=utf-8');

try {
    // Obtener todas las tablas de la base de datos
    $stmt = $pdo->query("SHOW TABLES");
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $database_map = [];

    foreach ($tables as $table) {
        // Obtener la estructura de cada tabla
        $stmtDesc = $pdo->query("DESCRIBE `$table`");
        $columns = $stmtDesc->fetchAll(PDO::FETCH_ASSOC);

        $database_map[$table] = [
            'columns' => $columns
        ];
    }

    echo json_encode([
        'status' => 'success',
        'database_map' => $database_map
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}


