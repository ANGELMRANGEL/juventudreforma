<?php
// trd26/api/sincronizar.php
require_once 'db.php';

header('Content-Type: application/json');

try {
    // 1. Obtener todas las personas de trasciende
    $stmtPersonas = $pdo_trasciende->query("SELECT usuario_id, ciudad FROM personas");
    $personas = $stmtPersonas->fetchAll();

    $syncCount = 0;
    $rolCount = 0;

    foreach ($personas as $persona) {
        $usuario_id = $persona['usuario_id'];
        $ciudad = trim($persona['ciudad']);

        // Buscar el usuario correspondiente
        $stmtUser = $pdo->prepare("SELECT rol, ciudad FROM Usuarios WHERE id = ?");
        $stmtUser->execute([$usuario_id]);
        $user = $stmtUser->fetch();

        if ($user) {
            $updateFields = [];
            $params = [];

            // Sincronizar rol a 'alumno' si está vacío
            if (empty($user['rol'])) {
                $updateFields[] = "rol = 'alumno'";
                $rolCount++;
            }

            // Sincronizar ciudad si está vacía en Usuarios pero existe en personas
            if (empty($user['ciudad']) && !empty($ciudad)) {
                $updateFields[] = "ciudad = ?";
                $params[] = $ciudad;
            }

            if (!empty($updateFields)) {
                $params[] = $usuario_id;
                $sql = "UPDATE Usuarios SET " . implode(', ', $updateFields) . " WHERE id = ?";
                $stmtUpdate = $pdo->prepare($sql);
                $stmtUpdate->execute($params);
                $syncCount++;
            }
        }
    }

    echo json_encode([
        'success' => true,
        'message' => 'Sincronización completada.',
        'usuarios_actualizados' => $syncCount,
        'roles_asignados_alumno' => $rolCount
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
