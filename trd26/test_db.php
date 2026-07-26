<?php
// trd26/test_db.php
require_once __DIR__ . '/api/db.php';

header('Content-Type: text/plain');

$output = "";

try {
    $output .= "=== CONEXION PLATORMA ===\n";
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        $output .= "- $table\n";
    }
} catch (Exception $e) {
    $output .= "Error Plataforma: " . $e->getMessage() . "\n";
}

try {
    $output .= "\n=== CONEXION TRASCIENDE ===\n";
    $tables = $pdo_trasciende->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        $output .= "- $table\n";
    }
} catch (Exception $e) {
    $output .= "Error Trasciende: " . $e->getMessage() . "\n";
}

try {
    $output .= "\n=== QUERY 1 (admin.php) ===\n";
    $stmt = $pdo_trasciende->query("
        SELECT 
            ei.id AS inscripcion_id,
            ei.fecha_inscripcion,
            ei.codigo_promocional,
            ei.monto_abonado,
            ei.plan_pago,
            p.red_pastoral,
            p.congregacion,
            p.funcion_congregacion,
            u.nombre,
            u.apellido,
            u.email,
            u.cedula,
            u.whatsapp,
            u.ciudad,
            u.edad,
            u.sexo,
            ev.nombre AS nombre_evento
        FROM evento_inscripciones ei
        JOIN personas p ON ei.persona_id = p.persona_id
        JOIN ejizhwis_plataforma.Usuarios u ON p.usuario_id = u.id
        JOIN evento ev ON ei.evento_id = ev.eventoID
        ORDER BY ei.fecha_inscripcion DESC
    ");
    $output .= "Query 1 OK. Filas: " . count($stmt->fetchAll()) . "\n";
} catch (Exception $e) {
    $output .= "Error Query 1: " . $e->getMessage() . "\n";
}

try {
    $output .= "\n=== QUERY 2 (admin.php) ===\n";
    $stmtPagos = $pdo_trasciende->query("
        SELECT 
            ep.*,
            p.persona_id
        FROM evento_pagos ep
        JOIN personas p ON ep.usuario_id = p.persona_id
        ORDER BY ep.fecha_pago DESC
    ");
    $output .= "Query 2 OK. Filas: " . count($stmtPagos->fetchAll()) . "\n";
} catch (Exception $e) {
    $output .= "Error Query 2: " . $e->getMessage() . "\n";
}

file_put_contents('test_db_output.txt', $output);
echo "Diagnóstico guardado en test_db_output.txt\n\n";
echo $output;


