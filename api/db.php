<?php
// api/db.php

$host = 'localhost';
$db = 'ejizhwis_plataforma';
$user = 'ejizhwis_plataforma';
$pass = 'wiDfup-tikryg-3tadwa';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
     PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
     PDO::ATTR_EMULATE_PREPARES => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     header('Content-Type: application/json', true, 500);
     echo json_encode(['error' => 'Connection failed: ' . $e->getMessage()]);
     exit;
}
