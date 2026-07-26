<?php
// api/crear_admin.php
require_once 'db.php';

header('Content-Type: application/json');

$email = 'reformaweb25@gmail.com';
$password = $_GET['password'] ?? 'reforma2025'; // Contraseña por defecto si no se especifica

$id = bin2hex(random_bytes(16));
$password_hash = password_hash($password, PASSWORD_DEFAULT);

try {
    // Verificar si ya existe
    $check = $pdo->prepare("SELECT id FROM Usuarios WHERE email = ?");
    $check->execute([$email]);
    if ($check->fetch()) {
        echo json_encode(['error' => "El usuario $email ya existe en la base de datos."]);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO Usuarios (id, email, password_hash, rol, nombre, apellido) VALUES (?, ?, ?, 'admin', 'Administrador', 'Reforma')");
    $stmt->execute([$id, $email, $password_hash]);
    echo json_encode([
        'success' => 'Usuario administrador creado correctamente',
        'usuario' => [
            'id' => $id,
            'email' => $email,
            'rol' => 'admin',
            'password_usada' => $password
        ]
    ]);
} catch (Exception $e) {
    echo json_encode(['error' => 'Error al crear administrador: ' . $e->getMessage()]);
}
