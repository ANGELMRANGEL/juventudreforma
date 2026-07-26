<?php
// api/lecciones.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$curso_id = $_GET['curso_id'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare("SELECT l.*, c.titulo AS curso_titulo FROM Lecciones l LEFT JOIN Cursos c ON l.curso_id = c.id WHERE l.id = ?");
        $stmt->execute([$id]);
        $l = $stmt->fetch();
        if ($l) {
            $l['Cursos'] = ['titulo' => $l['curso_titulo']];
            echo json_encode($l);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Lección no encontrada']);
        }
        exit;
    }

    if ($curso_id) {
        $stmt = $pdo->prepare("SELECT l.*, c.titulo AS curso_titulo FROM Lecciones l LEFT JOIN Cursos c ON l.curso_id = c.id WHERE l.curso_id = ? ORDER BY l.orden ASC, l.id ASC");
        $stmt->execute([$curso_id]);
    } else {
        $stmt = $pdo->query("SELECT l.*, c.titulo AS curso_titulo FROM Lecciones l LEFT JOIN Cursos c ON l.curso_id = c.id ORDER BY l.id ASC");
    }

    $lecciones = $stmt->fetchAll();
    foreach ($lecciones as &$l) {
        $l['Cursos'] = ['titulo' => $l['curso_titulo']];
    }
    echo json_encode($lecciones);
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
    $curso_id = $input['curso_id'] ?? null;
    $video_url = $input['video_url'] ?? null;
    $youtube_id = $input['youtube_id'] ?? null;
    $seccion = $input['seccion'] ?? null;
    $duracion_min = isset($input['duracion_min']) ? (int)$input['duracion_min'] : null;
    $orden = isset($input['orden']) ? (int)$input['orden'] : null;
    $pdf_url = $input['pdf_url'] ?? null;
    $descripcion = $input['descripcion'] ?? $input['contenido'] ?? null;
    $audio_url = $input['audio_url'] ?? null;
    $miniatura_url = $input['miniatura_url'] ?? null;

    if (empty($titulo) || empty($curso_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Título y curso_id son obligatorios']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO Lecciones (curso_id, titulo, video_url, youtube_id, seccion, duracion_min, orden, pdf_url, descripcion, audio_url, miniatura_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$curso_id, $titulo, $video_url, $youtube_id, $seccion, $duracion_min, $orden, $pdf_url, $descripcion, $audio_url, $miniatura_url]);
        $newId = $pdo->lastInsertId();

        // Si el curso es gratis, insertar en la tabla Feed de forma automatizada
        $stmtC = $pdo->prepare("SELECT tipo_acceso, titulo FROM Cursos WHERE id = ?");
        $stmtC->execute([$curso_id]);
        $cursoInfo = $stmtC->fetch();
        if ($cursoInfo && $cursoInfo['tipo_acceso'] === 'gratis') {
            $stmtFeed = $pdo->prepare("INSERT INTO Feed (tipo, titulo, descripcion, referencia_id) VALUES ('material_gratis', ?, ?, ?)");
            $feedItemTitle = "Nuevo Material Gratis: " . $titulo . " (" . $cursoInfo['titulo'] . ")";
            $stmtFeed->execute([$feedItemTitle, $descripcion, $newId]);
        }

        echo json_encode(['id' => $newId, 'titulo' => $titulo]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear lección: ' . $e->getMessage()]);
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
    $fields = ['curso_id', 'titulo', 'video_url', 'youtube_id', 'seccion', 'duracion_min', 'orden', 'pdf_url', 'descripcion', 'audio_url', 'miniatura_url'];

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

    $sql = "UPDATE Lecciones SET " . implode(', ', $setClause) . " WHERE id = ?";
    $params[] = $id;

    $stmt = $pdo->prepare($sql);
    try {
        $stmt->execute($params);

        // Sincronizar actualización de título y descripción en la tabla Feed
        if (isset($input['titulo']) || isset($input['descripcion'])) {
            $stmtGet = $pdo->prepare("SELECT l.titulo, l.descripcion, c.titulo AS curso_titulo FROM Lecciones l LEFT JOIN Cursos c ON l.curso_id = c.id WHERE l.id = ?");
            $stmtGet->execute([$id]);
            $lData = $stmtGet->fetch();
            if ($lData) {
                $stmtFeed = $pdo->prepare("UPDATE Feed SET titulo = ?, descripcion = ? WHERE tipo = 'material_gratis' AND referencia_id = ?");
                $feedItemTitle = "Nuevo Material Gratis: " . $lData['titulo'] . " (" . $lData['curso_titulo'] . ")";
                $stmtFeed->execute([$feedItemTitle, $lData['descripcion'], $id]);
            }
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar lección: ' . $e->getMessage()]);
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

    $stmt = $pdo->prepare("DELETE FROM Lecciones WHERE id = ?");
    try {
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar lección: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
