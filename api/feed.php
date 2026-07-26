<?php
// api/feed.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT * FROM Feed ORDER BY created_at DESC");
        $feedItems = $stmt->fetchAll();
        echo json_encode($feedItems);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener el feed: ' . $e->getMessage()]);
    }
    exit;
}

// Para métodos de modificación, validar rol admin
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $tipo = $input['tipo'] ?? '';
    $titulo = $input['titulo'] ?? '';
    $descripcion = $input['descripcion'] ?? null;
    $embed_code = $input['embed_code'] ?? null;
    $referencia_id = isset($input['referencia_id']) ? (int)$input['referencia_id'] : null;

    if (empty($tipo) || empty($titulo)) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo y Título son obligatorios']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO Feed (tipo, titulo, descripcion, embed_code, referencia_id) VALUES (?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$tipo, $titulo, $descripcion, $embed_code, $referencia_id]);
        $newId = $pdo->lastInsertId();
        echo json_encode(['success' => true, 'id' => $newId]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al insertar en el feed: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'PUT') {
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido para actualizar']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    
    $fields = ['tipo', 'titulo', 'descripcion', 'embed_code', 'referencia_id'];
    $setClause = [];
    $params = [];
    
    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $setClause[] = "`$field` = ?";
            $params[] = $input[$field];
        }
    }

    if (empty($setClause)) {
        echo json_encode(['success' => true]);
        exit;
    }

    $sql = "UPDATE Feed SET " . implode(', ', $setClause) . " WHERE id = ?";
    $params[] = $id;

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar el feed: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'DELETE') {
    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido para eliminar']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM Feed WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar del feed: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
