<?php
// ver_pase.php - Visualizador y metadatos del Pase de Acceso QR

$email = $_GET['email'] ?? '';
if (empty($email)) {
    die("Acceso denegado: Email no suministrado.");
}

$filename = 'pase_' . md5(strtolower($email)) . '.png';
$filepath = __DIR__ . '/pases/' . $filename;

if (!file_exists($filepath)) {
    die("El pase aún no ha sido generado. Por favor solicita al administrador que te envíe tu pase de acceso.");
}

$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$base_dir = dirname($_SERVER['PHP_SELF']);
$pase_url = $protocol . '://' . $host . rtrim($base_dir, '/') . '/pases/' . $filename;
?>
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pase de Acceso | TRD 2026</title>

  <!-- Metadatos Open Graph para previsualización enriquecida en WhatsApp -->
  <meta property="og:title" content="Pase de Acceso | TRD 2026">
  <meta property="og:description" content="Presenta este pase de acceso en la entrada del evento.">
  <meta property="og:image" content="<?php echo $pase_url; ?>">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="900">
  <meta property="og:image:height" content="1200">
  <meta property="og:type" content="website">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link
    href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap"
    rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

  <style>
    :root {
      --bg-dark: #0b0f19;
      --border-color: rgba(255, 255, 255, 0.08);
    }

    body {
      margin: 0;
      padding: 0;
      background-color: var(--bg-dark);
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      box-sizing: border-box;
    }

    .ticket-container {
      width: 90%;
      max-width: 320px;
      text-align: center;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-color);
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.3);
      margin: 20px 0;
    }

    .ticket-img {
      width: 100%;
      height: auto;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      margin-bottom: 20px;
      display: block;
    }

    .btn-download {
      background: #ffffff;
      color: #2d3e85;
      border: none;
      padding: 12px 24px;
      border-radius: 30px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s ease;
      width: 100%;
      box-sizing: border-box;
      letter-spacing: 0.5px;
    }

    .btn-download:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255, 255, 255, 0.1);
    }
  </style>
</head>

<body>
  <div class="ticket-container">
    <img src="<?php echo $pase_url; ?>" alt="Pase de Acceso" class="ticket-img">
    <a href="<?php echo $pase_url; ?>" download="pase_acceso_trd2026.png" class="btn-download">
      <i class="fa-solid fa-download"></i> DESCARGAR MI PASE
    </a>
  </div>
</body>

</html>
