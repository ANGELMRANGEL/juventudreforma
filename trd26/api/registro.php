<?php
// trd26/api/registro.php
session_start();
require_once __DIR__ . '/db.php';

// Asegurar columna de comprobante_imagen en evento_pagos
try {
    $pdo_trasciende->exec("ALTER TABLE `evento_pagos` ADD COLUMN `comprobante_imagen` VARCHAR(255) DEFAULT NULL AFTER `referencia`");
} catch (Exception $e) {
    // Ya existe o error manejado silenciosamente
}

function handleComprobanteUpload() {
    $comprobante_imagen = null;
    if (isset($_FILES['comprobante_imagen']) && $_FILES['comprobante_imagen']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = '../../uploads/pagos/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $fileExtension = strtolower(pathinfo($_FILES['comprobante_imagen']['name'], PATHINFO_EXTENSION));
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];

        if (in_array($fileExtension, $allowedExtensions)) {
            $newFileName = md5(time() . $_FILES['comprobante_imagen']['name']) . '.' . $fileExtension;
            if (move_uploaded_file($_FILES['comprobante_imagen']['tmp_name'], $uploadDir . $newFileName)) {
                $comprobante_imagen = $newFileName;
            }
        }
    }
    return $comprobante_imagen;
}

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'check_status') {
    $email = trim($_GET['email'] ?? '');
    
    if (empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email es requerido']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT id FROM Usuarios WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            echo json_encode(['registrado' => false]);
            exit;
        }

        $stmtFullUser = $pdo->prepare("SELECT id, nombre, apellido, cedula, whatsapp, ciudad, fecha_nacimiento, edad, sexo FROM Usuarios WHERE id = ?");
        $stmtFullUser->execute([$user['id']]);
        $userData = $stmtFullUser->fetch(PDO::FETCH_ASSOC);
        
        $stmtPersona = $pdo_trasciende->prepare("SELECT persona_id FROM personas WHERE usuario_id = ?");
        $stmtPersona->execute([$user['id']]);
        $persona = $stmtPersona->fetch(PDO::FETCH_ASSOC);
        
        if (!$persona) {
            echo json_encode(['registrado' => false, 'user' => $userData]);
            exit;
        }
        
        // Buscar la inscripción en cualquier evento de trd (Maracay: 1, San Carlos: 2, El Tigre: 3)
        $stmtInsc = $pdo_trasciende->prepare("SELECT evento_id, plan_pago FROM evento_inscripciones WHERE persona_id = ? ORDER BY fecha_inscripcion DESC LIMIT 1");
        $stmtInsc->execute([$persona['persona_id']]);
        $insc = $stmtInsc->fetch(PDO::FETCH_ASSOC);
        
        if (!$insc) {
            echo json_encode(['registrado' => false, 'user' => $userData]);
            exit;
        }
        
        $evento_id = (int)$insc['evento_id'];
        
        $stmtPagos = $pdo_trasciende->prepare("SELECT tipo_pago, estado, monto FROM evento_pagos WHERE usuario_id = ? AND evento_id = ?");
        $stmtPagos->execute([$persona['persona_id'], $evento_id]);
        $pagos = $stmtPagos->fetchAll(PDO::FETCH_ASSOC);
        
        $tasa_bcv = getBCVRate();

        echo json_encode([
            'registrado' => true,
            'evento_id' => $evento_id,
            'plan_pago' => $insc['plan_pago'],
            'pagos' => $pagos,
            'nombre' => $userData['nombre'],
            'apellido' => $userData['apellido'],
            'tasa_bcv' => $tasa_bcv
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'GET' && $action === 'get_congregaciones') {
    $q = trim($_GET['q'] ?? '');
    if (strlen($q) < 3) {
        echo json_encode([]);
        exit;
    }
    
    try {
        $stmt = $pdo_trasciende->prepare("SELECT DISTINCT congregacion FROM personas WHERE congregacion IS NOT NULL AND congregacion LIKE ? LIMIT 10");
        $stmt->execute(['%' . $q . '%']);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $congregaciones = [];
        foreach ($results as $row) {
            $val = trim($row['congregacion'] ?? '');
            if ($val !== '') {
                $congregaciones[] = $val;
            }
        }
        
        echo json_encode($congregaciones);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'report_pago') {
    if (!empty($_POST)) {
        $input = $_POST;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
    }

    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Datos inválidos']);
        exit;
    }
    
    $email = trim($input['email'] ?? '');
    $evento_id = (int)($input['evento_id'] ?? 0);
    $tipo_pago = trim($input['tipo_pago'] ?? '');
    $moneda = trim($input['moneda'] ?? '');
    $metodo_pago = trim($input['metodo_pago'] ?? '');
    $banco_origen = trim($input['banco_origen'] ?? '');
    $referencia = trim($input['referencia'] ?? '');
    $monto = (float)($input['monto'] ?? 0.00);
    
    $comprobante_imagen = handleComprobanteUpload();
    
    if (empty($email) || empty($evento_id) || empty($tipo_pago) || empty($moneda) || empty($metodo_pago) || empty($banco_origen) || empty($referencia) || empty($monto) || empty($comprobante_imagen)) {
        http_response_code(400);
        echo json_encode(['error' => 'Todos los campos son obligatorios, incluyendo el capture del pago.']);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT id FROM Usuarios WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();
    if (!$user) {
        http_response_code(400);
        echo json_encode(['error' => 'Usuario no encontrado']);
        exit;
    }
    
    $stmtPersona = $pdo_trasciende->prepare("SELECT persona_id FROM personas WHERE usuario_id = ?");
    $stmtPersona->execute([$user['id']]);
    $persona = $stmtPersona->fetch();
    if (!$persona) {
        http_response_code(400);
        echo json_encode(['error' => 'Registro de participante no encontrado']);
        exit;
    }
    
    $persona_id = $persona['persona_id'];
    
    if ($tipo_pago === 'Inicial') {
        $stmtCheckInicial = $pdo_trasciende->prepare("
            SELECT COUNT(*) 
            FROM evento_pagos 
            WHERE usuario_id = ? AND evento_id = ? AND tipo_pago = 'Inicial' AND estado IN ('Verificado', 'Pendiente')
        ");
        $stmtCheckInicial->execute([$persona_id, $evento_id]);
        if ($stmtCheckInicial->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Ya existe un pago inicial registrado para este participante en este evento.']);
            exit;
        }
    }
    
    // Si se envía plan_pago, actualizarlo en la inscripción
    if (!empty($input['plan_pago'])) {
        $stmtUpdateInscPlan = $pdo_trasciende->prepare("UPDATE evento_inscripciones SET plan_pago = ? WHERE persona_id = ? AND evento_id = ?");
        $stmtUpdateInscPlan->execute([$input['plan_pago'], $persona_id, $evento_id]);
    }
    
    $monto_usd = ($moneda === 'USD') ? $monto : 0.00;
    $stmtInsertPago = $pdo_trasciende->prepare("
        INSERT INTO evento_pagos 
        (monto, monto_usd, moneda, metodo_pago, banco_origen, referencia, fecha_pago, estado, usuario_id, evento_id, tipo_pago, comprobante_imagen) 
        VALUES (?, ?, ?, ?, ?, ?, NOW(), 'Pendiente', ?, ?, ?, ?)
    ");
    $stmtInsertPago->execute([$monto, $monto_usd, $moneda, $metodo_pago, $banco_origen, $referencia, $persona_id, $evento_id, $tipo_pago, $comprobante_imagen]);
    
    echo json_encode([
        'success' => true,
        'message' => 'Pago reportado exitosamente. Está pendiente de verificación.'
    ]);
    exit;
}

if ($method === 'POST' && $action === 'login_manual') {
    if (!empty($_POST)) {
        $input = $_POST;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
    }
    
    $email = trim($input['email'] ?? '');
    $password = trim($input['password'] ?? '');
    
    if (empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Email y contraseña son obligatorios']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM Usuarios WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user || !password_verify($password, $user['password_hash'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Credenciales incorrectas']);
            exit;
        }
        
        // Verificar si está registrado en el evento
        $stmtInsc = $pdo_trasciende->prepare("SELECT * FROM evento_inscripciones WHERE email = ?");
        $stmtInsc->execute([$email]);
        $insc = $stmtInsc->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'registrado' => !empty($insc),
            'email' => $user['email'],
            'nombre' => $user['nombre'],
            'apellido' => $user['apellido']
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' && $action === 'register_manual') {
    if (!empty($_POST)) {
        $input = $_POST;
    } else {
        $input = json_decode(file_get_contents('php://input'), true);
    }
    
    $nombre = trim($input['nombre'] ?? '');
    $apellido = trim($input['apellido'] ?? '');
    $email = trim($input['email'] ?? '');
    $password = trim($input['password'] ?? '');
    
    if (empty($nombre) || empty($email) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Todos los campos son obligatorios']);
        exit;
    }
    
    try {
        // Verificar si ya existe
        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM Usuarios WHERE email = ?");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(['error' => 'El correo ya está registrado']);
            exit;
        }
        
        $usuario_id = bin2hex(random_bytes(16));
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        
        $stmtInsert = $pdo->prepare("INSERT INTO Usuarios (id, email, password_hash, rol, nombre, apellido) VALUES (?, ?, ?, 'user', ?, ?)");
        $stmtInsert->execute([$usuario_id, $email, $password_hash, $nombre, $apellido]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Usuario registrado exitosamente',
            'email' => $email,
            'nombre' => $nombre,
            'apellido' => $apellido
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

if (!empty($_POST)) {
    $input = $_POST;
} else {
    $input = json_decode(file_get_contents('php://input'), true);
}

if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Datos inválidos']);
    exit;
}

$pagar_luego = !empty($input['pagar_luego']);

// Validar campos requeridos
$requiredFields = [
    'nombre', 'apellido', 'email', 'cedula', 'whatsapp', 
    'red_pastoral', 'congregacion', 'ciudad', 'funcion_congregacion',
    'evento_id', 'plan_pago'
];
if (!$pagar_luego) {
    $requiredFields = array_merge($requiredFields, ['moneda', 'metodo_pago', 'banco_origen', 'referencia', 'monto']);
}

foreach ($requiredFields as $field) {
    if (!isset($input[$field]) || $input[$field] === '') {
        http_response_code(400);
        echo json_encode(['error' => "El campo '$field' es obligatorio"]);
        exit;
    }
}

$comprobante_imagen = '';
if (!$pagar_luego) {
    $comprobante_imagen = handleComprobanteUpload();
    if (empty($comprobante_imagen)) {
        http_response_code(400);
        echo json_encode(['error' => 'Debe adjuntar el capture de la transferencia.']);
        exit;
    }
}

$plan_pago = $input['plan_pago']; // 'Completo' o 'Financiado'
if (!in_array($plan_pago, ['Completo', 'Financiado'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Plan de pago inválido']);
    exit;
}

// Si es financiado, debe aceptar términos y condiciones
if ($plan_pago === 'Financiado' && empty($input['acepta_terminos'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Debe aceptar los términos y condiciones del financiamiento para continuar.']);
    exit;
}

try {
    $pdo->beginTransaction();
    $pdo_trasciende->beginTransaction();

    // 1. Validar código promocional (si aplica)
    $codigo_promocional = trim($input['codigo_promocional'] ?? '');
    $descuento = 0.00;

    if (!empty($codigo_promocional)) {
        // Buscar el cupón
        $stmtCup = $pdo_trasciende->prepare("SELECT * FROM evento_codigo_promocional WHERE codigo = ?");
        $stmtCup->execute([$codigo_promocional]);
        $cupon = $stmtCup->fetch();

        if (!$cupon) {
            throw new Exception("El código promocional no es válido.");
        }

        // Verificar expiración
        $fecha_expiracion = strtotime($cupon['fecha_expiracion']);
        if ($fecha_expiracion < time()) {
            throw new Exception("El código promocional ha expirado.");
        }

        // Verificar si ya fue utilizado (único uso)
        $stmtUso = $pdo_trasciende->prepare("SELECT COUNT(*) FROM evento_inscripciones WHERE codigo_promocional = ?");
        $stmtUso->execute([$codigo_promocional]);
        if ($stmtUso->fetchColumn() > 0) {
            throw new Exception("El código promocional ya ha sido utilizado.");
        }

        $descuento = (float)$cupon['monto_descuento'];
    }

    // 2. Validar montos correspondientes
    if ($pagar_luego) {
        $monto = 0.00;
    } else {
        $monto = (float)$input['monto'];
        $base_esperada = ($plan_pago === 'Financiado') ? 6.00 : 30.00;
        $esperado = max(0.00, $base_esperada - $descuento);

        // Permitir un margen de diferencia por decimales
        if (abs($monto - $esperado) > 0.01) {
            throw new Exception("El monto enviado ($monto) no coincide con el monto esperado ($esperado) para el plan seleccionado.");
        }
    }

    // 3. Gestionar el Usuario en Usuarios
    $email = trim($input['email']);
    $nombre = trim($input['nombre']);
    $apellido = trim($input['apellido']);
    $cedula = trim($input['cedula']);
    $whatsapp = trim($input['whatsapp']);
    $ciudad = trim($input['ciudad']);
    $avatar_url = trim($input['avatar_url'] ?? '');

    $stmt = $pdo->prepare("SELECT id, avatar_url FROM Usuarios WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user) {
        $usuario_id = $user['id'];
        $current_avatar = $user['avatar_url'] ?? '';
        $new_avatar = !empty($avatar_url) ? $avatar_url : $current_avatar;
        $stmtUpdate = $pdo->prepare("
            UPDATE Usuarios 
            SET nombre = ?, apellido = ?, cedula = ?, whatsapp = ?, ciudad = ?, avatar_url = ?, rol = COALESCE(NULLIF(rol, ''), 'alumno') 
            WHERE id = ?
        ");
        $stmtUpdate->execute([$nombre, $apellido, $cedula, $whatsapp, $ciudad, $new_avatar, $usuario_id]);
    } else {
        $usuario_id = bin2hex(random_bytes(16));
        $passwordDummy = password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
        
        $stmtInsert = $pdo->prepare("
            INSERT INTO Usuarios 
            (id, email, password_hash, rol, nombre, apellido, cedula, whatsapp, ciudad, avatar_url) 
            VALUES (?, ?, ?, 'alumno', ?, ?, ?, ?, ?, ?)
        ");
        $stmtInsert->execute([$usuario_id, $email, $passwordDummy, $nombre, $apellido, $cedula, $whatsapp, $ciudad, $avatar_url]);
    }

    // 4. Gestionar la Persona
    $red_pastoral = trim($input['red_pastoral']);
    $congregacion = trim($input['congregacion']);
    $funcion_congregacion = trim($input['funcion_congregacion']);

    $stmtPersona = $pdo_trasciende->prepare("SELECT persona_id FROM personas WHERE usuario_id = ?");
    $stmtPersona->execute([$usuario_id]);
    $persona = $stmtPersona->fetch();

    if ($persona) {
        $persona_id = $persona['persona_id'];
        $stmtUpdatePersona = $pdo_trasciende->prepare("
            UPDATE personas 
            SET red_pastoral = ?, congregacion = ?, ciudad = ?, funcion_congregacion = ? 
            WHERE persona_id = ?
        ");
        $stmtUpdatePersona->execute([$red_pastoral, $congregacion, $ciudad, $funcion_congregacion, $persona_id]);
    } else {
        $stmtInsertPersona = $pdo_trasciende->prepare("
            INSERT INTO personas 
            (usuario_id, red_pastoral, congregacion, ciudad, funcion_congregacion) 
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmtInsertPersona->execute([$usuario_id, $red_pastoral, $congregacion, $ciudad, $funcion_congregacion]);
        $persona_id = $pdo_trasciende->lastInsertId();
    }

    // 5. Crear inscripción en evento_inscripciones
    $evento_id = (int)$input['evento_id'];

    // Verificar si ya está inscrito
    $stmtCheckInsc = $pdo_trasciende->prepare("SELECT id FROM evento_inscripciones WHERE persona_id = ? AND evento_id = ?");
    $stmtCheckInsc->execute([$persona_id, $evento_id]);
    if ($stmtCheckInsc->fetch()) {
        throw new Exception("Esta persona ya se encuentra inscrita en este evento.");
    }

    $stmtInsertInsc = $pdo_trasciende->prepare("
        INSERT INTO evento_inscripciones 
        (persona_id, evento_id, fecha_inscripcion, codigo_promocional, monto_abonado, plan_pago, inscripcion_qr_url) 
        VALUES (?, ?, NOW(), ?, ?, ?, '')
    ");
    $stmtInsertInsc->execute([$persona_id, $evento_id, $codigo_promocional, $monto, $plan_pago]);

    // 6. Crear pago en evento_pagos
    if (!$pagar_luego) {
        $moneda = $input['moneda'];
        $metodo_pago = trim($input['metodo_pago']);
        $banco_origen = trim($input['banco_origen']);
        $referencia = trim($input['referencia']);
        $tipo_pago = ($plan_pago === 'Financiado') ? 'Inicial' : 'Completo';
        
        $monto_usd = ($moneda === 'USD') ? $monto : 0.00;
        
        $stmtInsertPago = $pdo_trasciende->prepare("
            INSERT INTO evento_pagos 
            (monto, monto_usd, moneda, metodo_pago, banco_origen, referencia, fecha_pago, estado, usuario_id, evento_id, tipo_pago, comprobante_imagen) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), 'Pendiente', ?, ?, ?, ?)
        ");
        $stmtInsertPago->execute([$monto, $monto_usd, $moneda, $metodo_pago, $banco_origen, $referencia, $persona_id, $evento_id, $tipo_pago, $comprobante_imagen]);
    }

    $pdo->commit();
    $pdo_trasciende->commit();

    echo json_encode([
        'success' => true,
        'message' => $pagar_luego ? 'Inscripción registrada exitosamente. Recuerda reportar tu pago pronto.' : 'Inscripción y pago registrados exitosamente. Su registro está pendiente de verificación.',
        'persona_id' => $persona_id
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($pdo_trasciende->inTransaction()) {
        $pdo_trasciende->rollBack();
    }
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function getBCVRate()
{
    $apis = [
        'https://ve.dolarapi.com/v1/dolares/oficial',
        'https://bcv.today/api/v1/rate.json'
    ];

    foreach ($apis as $url) {
        try {
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 3);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && !empty($response)) {
                $data = json_decode($response, true);
                if (strpos($url, 'dolarapi.com') !== false && isset($data['promedio'])) {
                    return (float)$data['promedio'];
                }
                if (strpos($url, 'bcv.today') !== false && isset($data['USD']['sale'])) {
                    return (float)$data['USD']['sale'];
                }
            }
        } catch (Exception $e) {
            // Continuar con la siguiente API si falla
        }
    }
    return 0.0;
}
