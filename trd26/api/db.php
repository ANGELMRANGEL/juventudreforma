<?php
// trd26/api/db.php

$host = 'localhost';
$user = 'ejizhwis_plataforma';
$pass = 'wiDfup-tikryg-3tadwa';
$charset = 'utf8mb4';

// Conexión a la plataforma (Academy)
$db_plataforma = 'ejizhwis_plataforma';
$dsn_plataforma = "mysql:host=$host;dbname=$db_plataforma;charset=$charset";

// Conexión a trasciende (Eventos)
$db_trasciende = 'ejizhwis_trasciende';
$dsn_trasciende = "mysql:host=$host;dbname=$db_trasciende;charset=$charset";

$options = [
     PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
     PDO::ATTR_EMULATE_PREPARES => false,
];

try {
     $pdo = new PDO($dsn_plataforma, $user, $pass, $options);
     $pdo_trasciende = new PDO($dsn_trasciende, $user, $pass, $options);
} catch (\PDOException $e) {
     header('Content-Type: application/json', true, 500);
     echo json_encode(['error' => 'Connection failed: ' . $e->getMessage()]);
     exit;
}
