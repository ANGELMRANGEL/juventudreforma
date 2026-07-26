<?php
// api/progreso.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$usuario_id = $_GET['usuario_id'] ?? null;
$leccion_id = $_GET['leccion_id'] ?? null;
$completado = $_GET['completado'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    // Si se pide la vista de progreso general (solo admin)
    if ($action === 'vista_progreso') {
        if (!isAdmin()) {
            http_response_code(403);
            echo json_encode(['error' => 'No autorizado']);
            exit;
        }

        $stmt = $pdo->query("SELECT * FROM vista_progreso_alumnos");
        $vista = $stmt->fetchAll();
        echo json_encode($vista);
        exit;
    }

    // Si no es admin, solo puede ver su propio progreso
    if (!isAdmin()) {
        $usuario_id = $_SESSION['user_id'] ?? null;
        if (!$usuario_id) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado']);
            exit;
        }
    }

    $sql = "SELECT * FROM Progreso WHERE 1=1";
    $params = [];

    if ($usuario_id) {
        $sql .= " AND usuario_id = ?";
        $params[] = $usuario_id;
    }
    if ($leccion_id) {
        $sql .= " AND leccion_id = ?";
        $params[] = $leccion_id;
    }
    if ($completado !== null) {
        $sql .= " AND completado = ?";
        $params[] = ($completado === 'true' || $completado == 1) ? 1 : 0;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $progreso = $stmt->fetchAll();
    echo json_encode($progreso);
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input) && isset($input[0])) {
        $input = $input[0];
    }

    $target_usuario_id = $input['usuario_id'] ?? ($_SESSION['user_id'] ?? null);
    $target_leccion_id = $input['leccion_id'] ?? null;
    $is_completado = isset($input['completado']) ? (bool)$input['completado'] : true;

    if (!$target_usuario_id || !$target_leccion_id) {
        http_response_code(400);
        echo json_encode(['error' => 'usuario_id y leccion_id son obligatorios']);
        exit;
    }

    // Seguridad
    if ($target_usuario_id !== ($_SESSION['user_id'] ?? null) && !isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    // Upsert (insert or update)
    $stmt = $pdo->prepare("SELECT id FROM Progreso WHERE usuario_id = ? AND leccion_id = ?");
    $stmt->execute([$target_usuario_id, $target_leccion_id]);
    $existing = $stmt->fetch();

    if ($existing) {
        $stmt = $pdo->prepare("UPDATE Progreso SET completado = ? WHERE usuario_id = ? AND leccion_id = ?");
        try {
            $stmt->execute([$is_completado ? 1 : 0, $target_usuario_id, $target_leccion_id]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al actualizar progreso: ' . $e->getMessage()]);
        }
    } else {
        $stmt = $pdo->prepare("INSERT INTO Progreso (usuario_id, leccion_id, completado) VALUES (?, ?, ?)");
        try {
            $stmt->execute([$target_usuario_id, $target_leccion_id, $is_completado ? 1 : 0]);
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Error al insertar progreso: ' . $e->getMessage()]);
        }
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
