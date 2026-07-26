<?php
// api/configuraciones.php
require_once 'session.php';
require_once 'db.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

function isAdmin() {
    return isset($_SESSION['rol']) && $_SESSION['rol'] === 'admin';
}

if ($method === 'GET') {
    try {
        $stmt = $pdo->query("SELECT clave, valor FROM Configuraciones");
        $configs = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        // Decodificar los valores JSON para facilitar su lectura en JS
        foreach ($configs as $clave => &$valor) {
            $decoded = json_decode($valor, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $valor = $decoded;
            }
        }

        // Auto-update configurations transparently if old mock data or empty values are found
        $updated = false;
        if (!isset($configs['cancion_semana']) || !is_array($configs['cancion_semana']) || empty($configs['cancion_semana']['titulo']) || $configs['cancion_semana']['titulo'] !== 'Echoes') {
            $newSong = [
                'titulo' => 'Echoes',
                'artista' => 'Marcos Brunet',
                'url_audio' => 'uploads/audios/Echoes.mp3'
            ];
            $stmtUpdate = $pdo->prepare("INSERT INTO Configuraciones (clave, valor) VALUES ('cancion_semana', ?) ON DUPLICATE KEY UPDATE valor = ?");
            $jsonSong = json_encode($newSong);
            $stmtUpdate->execute([$jsonSong, $jsonSong]);
            $configs['cancion_semana'] = $newSong;
            $updated = true;
        }
        
        if (!isset($configs['top_redes']) || !is_array($configs['top_redes']) || empty($configs['top_redes']) || (isset($configs['top_redes'][0]) && $configs['top_redes'][0]['username'] !== '@marcosbrunet')) {
            $newRedes = [
                [
                    'username' => '@marcosbrunet',
                    'nombre' => 'Marcos Brunet',
                    'avatar_url' => 'uploads/img/brunet.png',
                    'descripcion' => 'Adoración, parenting espiritual y discipulado. Creador de la semana.',
                    'url' => 'https://www.instagram.com/marcosbrunet',
                    'plataforma' => 'instagram'
                ]
            ];
            $stmtUpdate = $pdo->prepare("INSERT INTO Configuraciones (clave, valor) VALUES ('top_redes', ?) ON DUPLICATE KEY UPDATE valor = ?");
            $jsonRedes = json_encode($newRedes);
            $stmtUpdate->execute([$jsonRedes, $jsonRedes]);
            $configs['top_redes'] = $newRedes;
            $updated = true;
        }
        
        echo json_encode($configs);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al obtener configuraciones: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'POST' || $method === 'PUT') {
    if (!isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'No autorizado']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $clave = $input['clave'] ?? '';
    $valor = $input['valor'] ?? null; // Espera un string JSON o estructura que codificaremos

    if (empty($clave)) {
        http_response_code(400);
        echo json_encode(['error' => 'La clave es obligatoria']);
        exit;
    }

    // Si valor es array/objeto, codificarlo a JSON string
    $valor_string = is_array($valor) ? json_encode($valor) : $valor;

    try {
        // Obtener la canción de la semana anterior antes de pisarla
        $prevVal = null;
        if ($clave === 'cancion_semana') {
            $stmtPrev = $pdo->prepare("SELECT valor FROM Configuraciones WHERE clave = 'cancion_semana'");
            $stmtPrev->execute();
            $prevVal = $stmtPrev->fetchColumn();
        }

        // Guardar la nueva configuración
        $stmt = $pdo->prepare("INSERT INTO Configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?");
        $stmt->execute([$clave, $valor_string, $valor_string]);

        // Desplazar la vieja canción al historial (Feed) si el título es diferente
        if ($clave === 'cancion_semana' && $prevVal) {
            $prevSong = json_decode($prevVal, true);
            $newSong = is_array($valor) ? $valor : json_decode($valor, true);
            if (is_array($prevSong) && !empty($prevSong['titulo'])) {
                $newTitle = $newSong['titulo'] ?? '';
                if ($newTitle !== $prevSong['titulo']) {
                    $stmtFeed = $pdo->prepare("INSERT INTO Feed (tipo, titulo, descripcion, embed_code) VALUES ('cancion', ?, ?, ?)");
                    $stmtFeed->execute([$prevSong['titulo'], $prevSong['artista'] ?? '', $prevSong['url_audio'] ?? '']);
                }
            }
        }

        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al guardar configuración: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Método no permitido']);
