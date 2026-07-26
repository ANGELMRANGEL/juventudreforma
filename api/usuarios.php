<?php
// api/usuarios.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && isset($_GET['method'])) {
    $method = strtoupper($_GET['method']);
}
$id = $_GET['id'] ?? null;
$email = $_GET['email'] ?? null;

// Helper to check if admin
function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    // Si se pasa un id específico
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM Usuarios WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        if ($user) {
            unset($user['password_hash']);
            echo json_encode($user);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
        }
        exit;
    }
    
    // Si se busca por email
    if ($email) {
        $stmt = $pdo->prepare("SELECT id, email, nombre, apellido, rol FROM Usuarios WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user) {
            echo json_encode($user);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Usuario no encontrado']);
        }
        exit;
    }

    // Listar todos (solo admin)
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    $stmt = $pdo->query("SELECT id, email, nombre, apellido, rol, created_at FROM Usuarios ORDER BY nombre ASC");
    $users = $stmt->fetchAll();
    echo json_encode($users);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Si es upsert (POST con id o PUT con id)
    $targetId = $id ?? ($input['id'] ?? ($_SESSION['user_id'] ?? null));
    
    if (!$targetId) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de usuario requerido']);
        exit;
    }

    // Seguridad: Un usuario normal solo puede modificarse a sí mismo. Admin puede a cualquiera.
    if ($targetId !== ($_SESSION['user_id'] ?? null) && !isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    // Campos permitidos a actualizar/insertar
    $fields = [
        'email', 'nombre', 'apellido', 'rol', 'cedula', 
        'fecha_nacimiento', 'telefono', 'whatsapp', 'pais', 
        'ciudad', 'nivel_estudios', 'ocupacion', 'motivacion'
    ];

    // Primero verificamos si el usuario ya existe
    $stmt = $pdo->prepare("SELECT id, rol FROM Usuarios WHERE id = ?");
    $stmt->execute([$targetId]);
    $existing = $stmt->fetch();

    // Solo admin puede cambiar el rol
    if (isset($input['rol']) && !isAdmin()) {
        unset($input['rol']);
    }

    $setClause = [];
    $params = [];
    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $setClause[] = "`$field` = ?";
            $params[] = $input[$field];
        }
    }

    if ($existing) {
        if (empty($setClause)) {
            echo json_encode(['success' => true, 'message' => 'Sin cambios']);
            exit;
        }
        // Update
        $sql = "UPDATE Usuarios SET " . implode(', ', $setClause) . " WHERE id = ?";
        $params[] = $targetId;
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    } else {
        // Insert (Upsert)
        $insertFields = ['id'];
        $insertPlaceholders = ['?'];
        $insertParams = [$targetId];
        
        foreach ($fields as $field) {
            if (array_key_exists($field, $input)) {
                $insertFields[] = "`$field`";
                $insertPlaceholders[] = "?";
                $insertParams[] = $input[$field];
            }
        }
        
        $sql = "INSERT INTO Usuarios (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertPlaceholders) . ")";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($insertParams);
    }

    // Devolver perfil actualizado
    $stmt = $pdo->prepare("SELECT * FROM Usuarios WHERE id = ?");
    $stmt->execute([$targetId]);
    $updated = $stmt->fetch();
    unset($updated['password_hash']);
    echo json_encode($updated);
    exit;
}

if ($method === 'DELETE') {
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID de usuario requerido']);
        exit;
    }
    
    // Eliminar relaciones de llave foránea primero
    $stmt = $pdo->prepare("DELETE FROM Inscripciones WHERE usuario_id = ?");
    $stmt->execute([$id]);
    $stmt = $pdo->prepare("DELETE FROM Progreso WHERE usuario_id = ?");
    $stmt->execute([$id]);
    
    // Eliminar el usuario
    $stmt = $pdo->prepare("DELETE FROM Usuarios WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode(['success' => true, 'message' => 'Usuario eliminado']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
