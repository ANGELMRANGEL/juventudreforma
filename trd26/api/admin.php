<?php
// trd26/api/admin.php
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json');

// Verificar que el usuario tenga rol de administrador
if (!isset($_SESSION['rol']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'No autorizado. Se requiere nivel de administrador.']);
    exit;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    if ($action === 'get_inscripciones') {
        try {
            // Obtener todas las inscripciones del evento TRD
            $stmt = $pdo_trasciende->query("
                SELECT 
                    ei.id AS inscripcion_id,
                    ei.fecha_inscripcion,
                    ei.codigo_promocional,
                    ei.monto_abonado,
                    ei.plan_pago,
                    p.persona_id,
                    p.usuario_id,
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
            $inscripciones = $stmt->fetchAll();

            // Obtener todos los pagos correspondientes para detallarlos
            $stmtPagos = $pdo_trasciende->query("
                SELECT 
                    ep.*,
                    p.persona_id
                FROM evento_pagos ep
                JOIN personas p ON ep.usuario_id = p.persona_id
                ORDER BY ep.fecha_pago DESC
            ");
            $pagos = $stmtPagos->fetchAll();

            // Agrupar pagos por persona
            $pagosPorPersona = [];
            foreach ($pagos as $pago) {
                $pagosPorPersona[$pago['persona_id']][] = $pago;
            }

            // Anexar pagos a cada inscripción
            foreach ($inscripciones as &$insc) {
                $pid = $insc['persona_id'];
                $insc['pagos'] = $pagosPorPersona[$pid] ?? [];
            }

            echo json_encode($inscripciones);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al obtener inscripciones: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'get_cupones') {
        try {
            $stmt = $pdo_trasciende->query("
                SELECT 
                    ecp.*,
                    (SELECT COUNT(*) FROM evento_inscripciones WHERE codigo_promocional = ecp.codigo) AS usado
                FROM evento_codigo_promocional ecp
                ORDER BY ecp.fecha_creacion DESC
            ");
            $cupones = $stmt->fetchAll();
            echo json_encode($cupones);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al obtener cupones: ' . $e->getMessage()]);
        }
        exit;
    }
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'verificar_pago') {
        $pago_id = $input['pago_id'] ?? null;
        $estado = $input['estado'] ?? null; // 'Verificado', 'Rechazado' o 'Pendiente'

        if (!$pago_id || !in_array($estado, ['Verificado', 'Rechazado', 'Pendiente'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos insuficientes o inválidos para verificación']);
            exit;
        }

        try {
            $stmt = $pdo_trasciende->prepare("
                UPDATE evento_pagos 
                SET estado = ?, fecha_verificacion = NOW() 
                WHERE pago_id = ?
            ");
            $stmt->execute([$estado, $pago_id]);
            echo json_encode(['success' => true, 'message' => 'Estado del pago actualizado correctamente.']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar pago: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'editar_pago') {
        $pago_id = $input['pago_id'] ?? null;
        $tipo_pago = $input['tipo_pago'] ?? null;
        $monto = $input['monto'] ?? null;
        $metodo_pago = $input['metodo_pago'] ?? null;
        $referencia = $input['referencia'] ?? null;

        if (!$pago_id || !$tipo_pago || !$monto || !$metodo_pago) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos insuficientes para editar el pago']);
            exit;
        }

        try {
            $stmt = $pdo_trasciende->prepare("
                UPDATE evento_pagos 
                SET tipo_pago = ?, monto = ?, metodo_pago = ?, referencia = ?
                WHERE pago_id = ?
            ");
            $stmt->execute([$tipo_pago, $monto, $metodo_pago, $referencia, $pago_id]);
            echo json_encode(['success' => true, 'message' => 'Pago editado correctamente.']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al editar pago: ' . $e->getMessage()]);
        }
        exit;
    }
    if ($action === 'upload_pase') {
        $email = $input['email'] ?? null;
        $image = $input['image'] ?? null;

        if (!$email || !$image) {
            http_response_code(400);
            echo json_encode(['error' => 'Datos insuficientes para subir el pase']);
            exit;
        }

        if (preg_match('/^data:image\/(\w+);base64,/', $image, $type)) {
            $image = substr($image, strpos($image, ',') + 1);
            $type = strtolower($type[1]);
            if ($type !== 'png') {
                http_response_code(400);
                echo json_encode(['error' => 'Solo se permiten imágenes PNG']);
                exit;
            }
            $image = base64_decode($image);
            if ($image === false) {
                http_response_code(400);
                echo json_encode(['error' => 'Error al decodificar base64']);
                exit;
            }
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Formato de imagen inválido']);
            exit;
        }

        try {
            $dir = __DIR__ . '/../pases';
            if (!file_exists($dir)) {
                mkdir($dir, 0777, true);
            }
            $filename = 'pase_' . md5(strtolower($email)) . '.png';
            $filepath = $dir . '/' . $filename;
            file_put_contents($filepath, $image);

            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
            $host = $_SERVER['HTTP_HOST'];
            $base_dir = str_replace('/api', '', dirname($_SERVER['PHP_SELF']));
            $url = $protocol . '://' . $host . $base_dir . '/pases/' . $filename;

            echo json_encode(['success' => true, 'url' => $url]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al guardar el pase: ' . $e->getMessage()]);
        }
        exit;
    }


    if ($action === 'eliminar_inscripcion') {
        $inscripcion_id = (int)($input['inscripcion_id'] ?? 0);
        if ($inscripcion_id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ID de inscripción no válido']);
            exit;
        }

        try {
            $stmt = $pdo_trasciende->prepare("DELETE FROM evento_inscripciones WHERE id = ?");
            $stmt->execute([$inscripcion_id]);
            echo json_encode(['success' => true, 'message' => 'Inscripción eliminada exitosamente']);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al eliminar inscripción: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'editar_inscripcion') {
        $inscripcion_id = $input['inscripcion_id'] ?? null;
        $persona_id = $input['persona_id'] ?? null;
        $usuario_id = $input['usuario_id'] ?? null;
        $nombre = trim($input['nombre'] ?? '');
        $apellido = trim($input['apellido'] ?? '');
        $cedula = trim($input['cedula'] ?? '');
        $email = trim($input['email'] ?? '');
        $whatsapp = trim($input['whatsapp'] ?? '');
        $congregacion = trim($input['congregacion'] ?? '');
        $red_pastoral = trim($input['red_pastoral'] ?? '');
        $funcion_congregacion = trim($input['funcion_congregacion'] ?? '');
        $plan_pago = trim($input['plan_pago'] ?? '');
        $monto_abonado = (float)($input['monto_abonado'] ?? 0);

        if (!$inscripcion_id || !$persona_id || !$usuario_id || empty($nombre) || empty($apellido) || empty($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'Campos requeridos vacíos']);
            exit;
        }

        try {
            $pdo_trasciende->beginTransaction();
            $pdo->beginTransaction();

            $stmtUser = $pdo->prepare("
                UPDATE Usuarios 
                SET nombre = ?, apellido = ?, cedula = ?, email = ?, whatsapp = ? 
                WHERE id = ?
            ");
            $stmtUser->execute([$nombre, $apellido, $cedula, $email, $whatsapp, $usuario_id]);

            $stmtPersona = $pdo_trasciende->prepare("
                UPDATE personas 
                SET red_pastoral = ?, congregacion = ?, funcion_congregacion = ? 
                WHERE persona_id = ?
            ");
            $stmtPersona->execute([$red_pastoral, $congregacion, $funcion_congregacion, $persona_id]);

            $stmtInsc = $pdo_trasciende->prepare("
                UPDATE evento_inscripciones 
                SET plan_pago = ?, monto_abonado = ? 
                WHERE id = ?
            ");
            $stmtInsc->execute([$plan_pago, $monto_abonado, $inscripcion_id]);

            $pdo->commit();
            $pdo_trasciende->commit();

            echo json_encode(['success' => true, 'message' => 'Inscripción actualizada exitosamente']);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            if ($pdo_trasciende->inTransaction()) $pdo_trasciende->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Error al guardar edición: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'generar_cupon' || $action === 'generar_cupon_lote') {
        $codigo = strtoupper(trim($input['codigo'] ?? ''));
        $monto_descuento = (float)($input['monto_descuento'] ?? 0);
        $fecha_expiracion = $input['fecha_expiracion'] ?? '';

        if (empty($codigo) || $monto_descuento <= 0 || empty($fecha_expiracion)) {
            http_response_code(400);
            echo json_encode(['error' => 'Todos los campos son obligatorios para el cupón']);
            exit;
        }

        try {
            // Verificar duplicado (sin importar si está usado o activo)
            $stmtCheck = $pdo_trasciende->prepare("SELECT id FROM evento_codigo_promocional WHERE codigo = ?");
            $stmtCheck->execute([$codigo]);
            if ($stmtCheck->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => "El código {$codigo} ya existe."]);
                exit;
            }

            $stmt = $pdo_trasciende->prepare("
                INSERT INTO evento_codigo_promocional (codigo, monto_descuento, fecha_expiracion, fecha_creacion)
                VALUES (?, ?, ?, NOW())
            ");
            $stmt->execute([$codigo, $monto_descuento, $fecha_expiracion]);
            echo json_encode(['success' => true, 'message' => "Cupón {$codigo} generado exitosamente."]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Acción no válida']);
