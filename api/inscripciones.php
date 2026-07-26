<?php
// api/inscripciones.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$id = $_GET['id'] ?? null;
$usuario_id = $_GET['usuario_id'] ?? null;
$curso_id = $_GET['curso_id'] ?? null;

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    // Si no es admin, solo puede ver sus propias inscripciones
    if (!isAdmin()) {
        $usuario_id = $_SESSION['user_id'] ?? null;
        if (!$usuario_id) {
            http_response_code(401);
            echo json_encode(['error' => 'No autorizado']);
            exit;
        }
    }

    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM Inscripciones WHERE id = ?");
        $stmt->execute([$id]);
        $ins = $stmt->fetch();
        if ($ins) {
            echo json_encode($ins);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Inscripción no encontrada']);
        }
        exit;
    }

    $sql = "SELECT * FROM Inscripciones WHERE 1=1";
    $params = [];

    if ($usuario_id) {
        $sql .= " AND usuario_id = ?";
        $params[] = $usuario_id;
    }
    if ($curso_id) {
        $sql .= " AND curso_id = ?";
        $params[] = $curso_id;
    }

    $sql .= " ORDER BY fecha_de_compra DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $inscripciones = $stmt->fetchAll();
    echo json_encode($inscripciones);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input) && isset($input[0])) {
        $input = $input[0];
    }

    $target_usuario_id = $input['usuario_id'] ?? ($_SESSION['user_id'] ?? null);
    $target_curso_id = $input['curso_id'] ?? null;
    $fecha_expiracion = $input['fecha_expiracion'] ?? null;

    if (!$target_usuario_id || !$target_curso_id) {
        http_response_code(400);
        echo json_encode(['error' => 'usuario_id y curso_id son obligatorios']);
        exit;
    }

    // Seguridad: Alumno solo puede inscribirse a sí mismo. Admin puede inscribir a cualquiera.
    if ($target_usuario_id !== ($_SESSION['user_id'] ?? null) && !isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    // Verificar si ya está inscrito
    $stmt = $pdo->prepare("SELECT id FROM Inscripciones WHERE usuario_id = ? AND curso_id = ?");
    $stmt->execute([$target_usuario_id, $target_curso_id]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => true, 'message' => 'Ya inscrito']);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO Inscripciones (usuario_id, curso_id, fecha_expiracion) VALUES (?, ?, ?)");
    try {
        $stmt->execute([$target_usuario_id, $target_curso_id, $fecha_expiracion]);
        $newId = $pdo->lastInsertId();

        // Inscripción Automática de Cursos Bonus asociados
        $stmtBonus = $pdo->prepare("SELECT curso_bonus_id FROM Relacion_Curso_Bonus WHERE curso_pago_id = ?");
        $stmtBonus->execute([$target_curso_id]);
        $bonusCourses = $stmtBonus->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($bonusCourses as $bonusId) {
            $stmtCheck = $pdo->prepare("SELECT id FROM Inscripciones WHERE usuario_id = ? AND curso_id = ?");
            $stmtCheck->execute([$target_usuario_id, $bonusId]);
            if (!$stmtCheck->fetch()) {
                $stmtInsBonus = $pdo->prepare("INSERT INTO Inscripciones (usuario_id, curso_id, fecha_expiracion) VALUES (?, ?, ?)");
                $stmtInsBonus->execute([$target_usuario_id, $bonusId, $fecha_expiracion]);
            }
        }

        echo json_encode(['id' => $newId, 'usuario_id' => $target_usuario_id, 'curso_id' => $target_curso_id]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al inscribir: ' . $e->getMessage()]);
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

    $stmt = $pdo->prepare("DELETE FROM Inscripciones WHERE id = ?");
    try {
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al eliminar inscripción: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
