<?php
// api/session.php
if (session_status() === PHP_SESSION_NONE) {
    $lifetime = 34560000; // 400 days (maximum browser limit)
    ini_set('session.cookie_lifetime', $lifetime);
    ini_set('session.gc_maxlifetime', $lifetime);

    $secure = isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['SERVER_PORT'] == 443);

    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
    session_start();
}

// Permitir sobreescribir el método HTTP (para servidores que bloquean PUT/DELETE)
$method_override = null;
if (isset($_GET['method'])) {
    $method_override = strtoupper($_GET['method']);
} else {
    $headers = function_exists('getallheaders') ? getallheaders() : [];
    if (isset($headers['X-HTTP-Method-Override'])) {
        $method_override = strtoupper($headers['X-HTTP-Method-Override']);
    } elseif (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
        $method_override = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
    }
}

if ($method_override && in_array($method_override, ['PUT', 'DELETE', 'PATCH'])) {
    $_SERVER['REQUEST_METHOD'] = $method_override;
}
