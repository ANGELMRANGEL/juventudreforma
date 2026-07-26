<?php
// db_update.php
require_once 'api/db.php';
header('Content-Type: text/plain');

try {
    // 1. Verificar columnas en Usuarios
    $stmt = $pdo->query("DESCRIBE Usuarios");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $required_columns = [
        'avatar_url' => "ALTER TABLE Usuarios ADD COLUMN avatar_url VARCHAR(512) NULL AFTER apellido",
        'cedula' => "ALTER TABLE Usuarios ADD COLUMN cedula VARCHAR(50) NULL AFTER rol",
        'fecha_nacimiento' => "ALTER TABLE Usuarios ADD COLUMN fecha_nacimiento DATE NULL AFTER cedula",
        'telefono' => "ALTER TABLE Usuarios ADD COLUMN telefono VARCHAR(50) NULL AFTER fecha_nacimiento",
        'whatsapp' => "ALTER TABLE Usuarios ADD COLUMN whatsapp VARCHAR(50) NULL AFTER telefono",
        'pais' => "ALTER TABLE Usuarios ADD COLUMN pais VARCHAR(100) NULL AFTER whatsapp",
        'ciudad' => "ALTER TABLE Usuarios ADD COLUMN ciudad VARCHAR(100) NULL AFTER pais",
        'nivel_estudios' => "ALTER TABLE Usuarios ADD COLUMN nivel_estudios VARCHAR(100) NULL AFTER ciudad",
        'ocupacion' => "ALTER TABLE Usuarios ADD COLUMN ocupacion VARCHAR(255) NULL AFTER nivel_estudios",
        'motivacion' => "ALTER TABLE Usuarios ADD COLUMN motivacion TEXT NULL AFTER ocupacion"
    ];
    
    foreach ($required_columns as $col => $sql) {
        if (!in_array($col, $columns)) {
            $pdo->exec($sql);
            echo "Columna '$col' añadida a Usuarios con éxito.\n";
        } else {
            echo "Columna '$col' ya existe en Usuarios.\n";
        }
    }

    // 2. Verificar columna tipo_acceso en Cursos
    $stmtCursos = $pdo->query("DESCRIBE Cursos");
    $cursosColumns = $stmtCursos->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array('tipo_acceso', $cursosColumns)) {
        $pdo->exec("ALTER TABLE Cursos ADD COLUMN tipo_acceso ENUM('gratis', 'pago', 'bonus') NOT NULL DEFAULT 'pago' AFTER materiales");
        echo "Columna 'tipo_acceso' añadida a Cursos con éxito.\n";
    } else {
        echo "Columna 'tipo_acceso' ya existe en Cursos.\n";
    }

    if (!in_array('precio', $cursosColumns)) {
        $pdo->exec("ALTER TABLE Cursos ADD COLUMN precio DECIMAL(10,2) DEFAULT 0.00 AFTER materiales");
        echo "Columna 'precio' añadida a Cursos con éxito.\n";
    } else {
        echo "Columna 'precio' ya existe en Cursos.\n";
    }

    // 2.5 Verificar columna audio_url en Lecciones
    $stmtLecciones = $pdo->query("DESCRIBE Lecciones");
    $leccionesColumns = $stmtLecciones->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('audio_url', $leccionesColumns)) {
        $pdo->exec("ALTER TABLE Lecciones ADD COLUMN audio_url VARCHAR(512) NULL AFTER video_url");
        echo "Columna 'audio_url' añadida a Lecciones con éxito.\n";
    } else {
        echo "Columna 'audio_url' ya existe en Lecciones.\n";
    }
    
    if (!in_array('miniatura_url', $leccionesColumns)) {
        $pdo->exec("ALTER TABLE Lecciones ADD COLUMN miniatura_url VARCHAR(512) NULL AFTER audio_url");
        echo "Columna 'miniatura_url' añadida a Lecciones con éxito.\n";
    } else {
        echo "Columna 'miniatura_url' ya existe en Lecciones.\n";
    }

    // 3. Crear tabla Relacion_Curso_Bonus si no existe
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Relacion_Curso_Bonus` (
        `curso_pago_id` INT NOT NULL,
        `curso_bonus_id` INT NOT NULL,
        PRIMARY KEY (`curso_pago_id`, `curso_bonus_id`),
        FOREIGN KEY (`curso_pago_id`) REFERENCES `Cursos`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`curso_bonus_id`) REFERENCES `Cursos`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "Tabla 'Relacion_Curso_Bonus' verificada/creada con éxito.\n";

    // 4. Crear tabla Feed si no existe
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Feed` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `tipo` ENUM('curso', 'material_gratis', 'cancion', 'social_embed', 'texto') NOT NULL,
        `titulo` VARCHAR(255) NOT NULL,
        `descripcion` TEXT NULL,
        `embed_code` TEXT NULL,
        `referencia_id` INT NULL,
        `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "Tabla 'Feed' verificada/creada con éxito.\n";

    // 5. Crear tabla Configuraciones si no existe
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Configuraciones` (
        `clave` VARCHAR(100) PRIMARY KEY,
        `valor` TEXT NOT NULL,
        `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    echo "Tabla 'Configuraciones' verificada/creada con éxito.\n";

    // Inicializar configuraciones por defecto si no existen
    $stmtConf = $pdo->prepare("SELECT COUNT(*) FROM Configuraciones WHERE clave = ?");
    
    $stmtConf->execute(['cancion_semana']);
    if ($stmtConf->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO Configuraciones (clave, valor) VALUES ('cancion_semana', '{\"titulo\":\"\",\"artista\":\"\",\"url_audio\":\"\"}')");
        echo "Configuración 'cancion_semana' inicializada con éxito.\n";
    }

    $stmtConf->execute(['top_redes']);
    if ($stmtConf->fetchColumn() == 0) {
        $pdo->exec("INSERT INTO Configuraciones (clave, valor) VALUES ('top_redes', '[]')");
        echo "Configuración 'top_redes' inicializada con éxito.\n";
    }

    echo "Actualización de base de datos completada.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

