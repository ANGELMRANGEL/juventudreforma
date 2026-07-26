<?php
// trd26/api/debug_db.php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

try {
    $stmtInsc = $pdo_trasciende->query("
        SELECT 
            ei.id AS inscripcion_id,
            ei.plan_pago,
            ei.monto_abonado,
            ei.codigo_promocional,
            p.persona_id,
            p.usuario_id,
            u.nombre,
            u.apellido
        FROM evento_inscripciones ei
        JOIN personas p ON ei.persona_id = p.persona_id
        JOIN ejizhwis_plataforma.Usuarios u ON p.usuario_id = u.id
    ");
    $inscripciones = $stmtInsc->fetchAll(PDO::FETCH_ASSOC);

    $stmtPagos = $pdo_trasciende->query("
        SELECT 
            pago_id,
            usuario_id, -- Nota: en la DB se llama usuario_id pero se relaciona con persona_id
            monto,
            estado,
            referencia,
            metodo_pago,
            tipo_pago
        FROM evento_pagos
    ");
    $pagos = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'inscripciones' => $inscripciones,
        'pagos' => $pagos
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
