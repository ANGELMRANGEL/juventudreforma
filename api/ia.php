<?php
// api/ia.php
require_once 'session.php';

header('Content-Type: application/json');

// Verificar que sea admin
if (!isset($_SESSION['rol']) || $_SESSION['rol'] !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$titulo = $input['titulo'] ?? '';

if (empty($titulo)) {
    http_response_code(400);
    echo json_encode(['error' => 'El título es requerido']);
    exit;
}

$apiKey = 'sk-eb0a563361614a03b4e7f2281e549a98';
$url = 'https://api.deepseek.com/v1/chat/completions';

$payload = [
    'model' => 'deepseek-chat',
    'messages' => [
        [
            'role' => 'system',
            'content' => 'Eres un asistente educativo profesional para una plataforma de alumnos y cursos en línea. Tu tarea es generar una breve y atractiva descripción o notas de estudio de 2 líneas para una clase basándote en su título. Sé conciso y profesional, en español neutro, sin emojis.'
        ],
        [
            'role' => 'user',
            'content' => 'Título de la clase: "' . $titulo . '"'
        ]
    ],
    'temperature' => 0.6
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $apiKey
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if ($response === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Error al comunicarse con la IA: ' . curl_error($ch)]);
    curl_close($ch);
    exit;
}

curl_close($ch);

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo $response;
    exit;
}

echo $response;
