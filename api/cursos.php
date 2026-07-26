<?php
// api/cursos.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM Cursos WHERE id = ?");
        $stmt->execute([$id]);
        $curso = $stmt->fetch();
        if ($curso) {
            if ($curso['materiales']) {
                $curso['materiales'] = json_decode($curso['materiales'], true);
            } else {
                $curso['materiales'] = [];
            }
            echo json_encode($curso);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Curso no encontrado']);
        }
        exit;
    }

    $stmt = $pdo->query("SELECT * FROM Cursos ORDER BY created_at DESC");
    $cursos = $stmt->fetchAll();
    foreach ($cursos as &$c) {
        if ($c['materiales']) {
            $c['materiales'] = json_decode($c['materiales'], true);
        } else {
            $c['materiales'] = [];
        }
    }
    echo json_encode($cursos);
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
        // En caso de que envíen un array [{...}]
        $input = $input[0];
    }

    $titulo = $input['titulo'] ?? ($input['nombre'] ?? ''); // Soporte para 'nombre' de app.js
    if (empty($titulo)) {
        http_response_code(400);
        echo json_encode(['error' => 'El título es obligatorio']);
        exit;
    }

    $instructor_nombre = $input['instructor_nombre'] ?? $input['instructor'] ?? null;
    $instructor = $instructor_nombre;
    $miniatura_url = $input['miniatura_url'] ?? null;
    $descripcion = $input['descripcion'] ?? null;
    $nivel = $input['nivel'] ?? 'Todos los niveles';
    $duracion_total = $input['duracion_total'] ?? null;
    $categoria = $input['categoria'] ?? null;
    $es_estreno = isset($input['es_estreno']) ? (bool)$input['es_estreno'] : false;
    $materiales = isset($input['materiales']) ? json_encode($input['materiales']) : null;
    $precio = isset($input['precio']) ? (float)$input['precio'] : 0.00;
    $tipo_acceso = $input['tipo_acceso'] ?? 'pago';

    $stmt = $pdo->prepare("INSERT INTO Cursos (titulo, instructor_nombre, instructor, miniatura_url, descripcion, nivel, duracion_total, categoria, es_estreno, materiales, precio, tipo_acceso) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$titulo, $instructor_nombre, $instructor, $miniatura_url, $descripcion, $nivel, $duracion_total, $categoria, $es_estreno, $materiales, $precio, $tipo_acceso]);
        $newId = $pdo->lastInsertId();
        
        // Insertar en la tabla Feed de forma automatizada
        $stmtFeed = $pdo->prepare("INSERT INTO Feed (tipo, titulo, descripcion, referencia_id) VALUES ('curso', ?, ?, ?)");
        $stmtFeed->execute(["Nuevo Curso: $titulo", $descripcion, $newId]);

        echo json_encode(['id' => $newId, 'titulo' => $titulo]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al crear curso: ' . $e->getMessage()]);
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
    
    // Campos permitidos
    $fields = ['titulo', 'instructor_nombre', 'instructor', 'miniatura_url', 'descripcion', 'nivel', 'duracion_total', 'categoria', 'es_estreno', 'materiales', 'precio', 'tipo_acceso'];
    
    $setClause = [];
    $params = [];
    foreach ($fields as $field) {
        if (array_key_exists($field, $input)) {
            $setClause[] = "`$field` = ?";
            if ($field === 'materiales') {
                $params[] = json_encode($input[$field]);
            } else if ($field === 'es_estreno') {
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

    $sql = "UPDATE Cursos SET " . implode(', ', $setClause) . " WHERE id = ?";
    $params[] = $id;

    $stmt = $pdo->prepare($sql);
    try {
        $stmt->execute($params);

        // Sincronizar actualización de título y descripción en la tabla Feed
        if (isset($input['titulo']) || isset($input['descripcion'])) {
            $stmtGet = $pdo->prepare("SELECT titulo, descripcion FROM Cursos WHERE id = ?");
            $stmtGet->execute([$id]);
            $cData = $stmtGet->fetch();
            if ($cData) {
                $stmtFeed = $pdo->prepare("UPDATE Feed SET titulo = ?, descripcion = ? WHERE tipo = 'curso' AND referencia_id = ?");
                $stmtFeed->execute(["Nuevo Curso: " . $cData['titulo'], $cData['descripcion'], $id]);
            }
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al actualizar curso: ' . $e->getMessage()]);
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

    $stmt = $pdo->prepare("DELETE FROM Cursos WHERE id = ?");
    try {
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar curso: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
