<?php
// api/banners.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$activo = $_GET['activo'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM Banners WHERE id = ?");
        $stmt->execute([$id]);
        $banner = $stmt->fetch();
        if ($banner) {
            echo json_encode($banner);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Banner no encontrado']);
        }
        exit;
    }

    $sql = "SELECT * FROM Banners WHERE 1=1";
    $params = [];

    if ($activo !== null) {
        $sql .= " AND activo = ?";
        $params[] = ($activo === 'true' || $activo == 1) ? 1 : 0;
    }

    $sql .= " ORDER BY created_at DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $banners = $stmt->fetchAll();
    echo json_encode($banners);
    exit;
}

if ($method === 'POST') {
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input) && isset($input[0])) {
        $input = $input[0];
    }

    $titulo = $input['titulo'] ?? '';
    if (empty($titulo)) {
        http_response_code(400);
        echo json_encode(['error' => 'El título es obligatorio']);
        exit;
    }

    $subtitulo = $input['subtitulo'] ?? null;
    $imagen_url = $input['imagen_url'] ?? null;
    $link_url = $input['link_url'] ?? null;
    $link_texto = $input['link_texto'] ?? 'Ver más';
    $color_fondo = $input['color_fondo'] ?? '#E63946';
    $color_texto = $input['color_texto'] ?? '#FFFFFF';
    $is_activo = isset($input['activo']) ? (bool)$input['activo'] : false;

    $stmt = $pdo->prepare("INSERT INTO Banners (titulo, subtitulo, imagen_url, link_url, link_texto, color_fondo, color_texto, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$titulo, $subtitulo, $imagen_url, $link_url, $link_texto, $color_fondo, $color_texto, $is_activo]);
        $newId = $pdo->lastInsertId();
        echo json_encode(['id' => $newId, 'titulo' => $titulo]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear banner: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'PUT') {
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'ID requerido para actualizar']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    
    // Si se activa este banner y se requiere desactivar los demás (como hace toggleBannerActivo)
    $is_activo = isset($input['activo']) ? (bool)$input['activo'] : null;
    if ($is_activo === true) {
        // Desactivar todos los demás banners
        $pdo->prepare("UPDATE Banners SET activo = 0 WHERE id != ?")->execute([$id]);
    }

    $fields = ['titulo', 'subtitulo', 'imagen_url', 'link_url', 'link_texto', 'color_fondo', 'color_texto', 'activo'];
    
    $setClause = [];
    $params = [];
    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $setClause[] = "`$field` = ?";
            if ($field === 'activo') {
                $params[] = (bool)$input[$field] ? 1 : 0;
            } else {
                $params[] = $input[$field];
            }
        }
    }

    if (empty($setClause)) {
        echo json_encode(['success' => true]);
        exit;
    }

    $sql = "UPDATE Banners SET " . implode(', ', $setClause) . " WHERE id = ?";
    $params[] = $id;

    $stmt = $pdo->prepare($sql);
    try {
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar banner: ' . $e->getMessage()]);
    }
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
        echo json_encode(['error' => 'ID requerido para eliminar']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM Banners WHERE id = ?");
    try {
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar banner: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
