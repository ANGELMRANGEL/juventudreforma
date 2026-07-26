<?php
// api/auth.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if ($action === 'signup') {
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';
        
        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email y contraseña son obligatorios']);
            exit;
        }

        // Check if user exists
        $stmt = $pdo->prepare("SELECT id FROM Usuarios WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'El email ya está registrado']);
            exit;
        }

        $id = bin2hex(random_bytes(16)); // Generar un ID único tipo UUID
        $password_hash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO Usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, 'alumno')");
        try {
            $stmt->execute([$id, $email, $password_hash]);
            $_SESSION['user_id'] = $id;
            $_SESSION['email'] = $email;
            $_SESSION['rol'] = 'alumno';
            
            echo json_encode([
                'user' => ['id' => $id, 'email' => $email, 'rol' => 'alumno']
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al registrar usuario: ' . $e->getMessage()]);
        }
        exit;
    }

    if ($action === 'login') {
        $email = trim($input['email'] ?? '');
        $password = $input['password'] ?? '';

        if (empty($email) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Email y contraseña son obligatorios']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, email, password_hash, rol FROM Usuarios WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['rol'] = $user['rol'];

            echo json_encode([
                'user' => ['id' => $user['id'], 'email' => $user['email'], 'rol' => $user['rol']]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Credenciales inválidas']);
        }
        exit;
    }

    if ($action === 'update_password') {
        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado']);
            exit;
        }
        $password = $input['password'] ?? '';
        if (empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Contraseña vacía']);
            exit;
        }
        $password_hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("UPDATE Usuarios SET password_hash = ? WHERE id = ?");
        $stmt->execute([$password_hash, $_SESSION['user_id']]);
        echo json_encode(['success' => true]);
        exit;
    }

    if ($action === 'google') {
        $token = $input['token'] ?? '';
        if (empty($token)) {
            http_response_code(400);
            echo json_encode(['error' => 'Token de Google requerido']);
            exit;
        }

        // Verify token with Google API
        $verifyUrl = "https://oauth2.googleapis.com/tokeninfo?id_token=" . urlencode($token);
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $verifyUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            http_response_code(400);
            echo json_encode(['error' => 'Token de Google inválido o vencido']);
            exit;
        }

        $googleUser = json_decode($response, true);
        $email = $googleUser['email'] ?? '';
        if (empty($email)) {
            http_response_code(400);
            echo json_encode(['error' => 'No se pudo obtener el email del token de Google']);
            exit;
        }

        try {
            // Check if user exists
            $stmt = $pdo->prepare("SELECT id, email, rol, nombre, apellido, avatar_url, cedula, whatsapp, ciudad, fecha_nacimiento, edad, sexo FROM Usuarios WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch();

            $nombre = $googleUser['given_name'] ?? '';
            $apellido = $googleUser['family_name'] ?? '';
            $avatar_url = $googleUser['picture'] ?? '';

            if (!$user) {
                // Register automatically
                $id = $googleUser['sub'] ?? bin2hex(random_bytes(16));

                $stmt = $pdo->prepare("INSERT INTO Usuarios (id, email, rol, nombre, apellido, avatar_url) VALUES (?, ?, 'alumno', ?, ?, ?)");
                $stmt->execute([$id, $email, $nombre, $apellido, $avatar_url]);

                $user = [
                    'id' => $id,
                    'email' => $email,
                    'rol' => 'alumno',
                    'nombre' => $nombre,
                    'apellido' => $apellido,
                    'avatar_url' => $avatar_url,
                    'cedula' => '',
                    'whatsapp' => '',
                    'ciudad' => '',
                    'fecha_nacimiento' => null,
                    'edad' => null,
                    'sexo' => ''
                ];
            } else {
                // Update info if empty on our side
                $stmt = $pdo->prepare("UPDATE Usuarios SET nombre = COALESCE(NULLIF(nombre, ''), ?), apellido = COALESCE(NULLIF(apellido, ''), ?), avatar_url = COALESCE(NULLIF(avatar_url, ''), ?) WHERE id = ?");
                $stmt->execute([$nombre, $apellido, $avatar_url, $user['id']]);
                $user['nombre'] = $user['nombre'] ?: $nombre;
                $user['apellido'] = $user['apellido'] ?: $apellido;
                $user['avatar_url'] = $user['avatar_url'] ?: $avatar_url;
            }

            $_SESSION['user_id'] = $user['id'];
            $_SESSION['email'] = $user['email'];
            $_SESSION['rol'] = $user['rol'];

            echo json_encode([
                'user' => [
                    'id' => $user['id'],
                    'email' => $user['email'],
                    'rol' => $user['rol'],
                    'nombre' => $user['nombre'] ?? '',
                    'apellido' => $user['apellido'] ?? '',
                    'avatar_url' => $user['avatar_url'] ?? '',
                    'cedula' => $user['cedula'] ?? '',
                    'whatsapp' => $user['whatsapp'] ?? '',
                    'ciudad' => $user['ciudad'] ?? '',
                    'fecha_nacimiento' => $user['fecha_nacimiento'] ?? null,
                    'edad' => $user['edad'] ?? null,
                    'sexo' => $user['sexo'] ?? ''
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Database error during Google login: ' . $e->getMessage()]);
        }
        exit;
    }
}

if ($method === 'GET') {
    if ($action === 'session') {
        if (isset($_SESSION['user_id'])) {
            echo json_encode([
                'session' => [
                    'user' => [
                        'id' => $_SESSION['user_id'],
                        'email' => $_SESSION['email'],
                        'rol' => $_SESSION['rol']
                    ]
                ]
            ]);
        } else {
            echo json_encode(['session' => null]);
        }
        exit;
    }

    if ($action === 'logout') {
        session_destroy();
        echo json_encode(['success' => true]);
        exit;
    }
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
