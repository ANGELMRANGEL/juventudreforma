<?php
// seed_mockup.php
session_start();
require_once 'api/db.php';

$action = $_GET['action'] ?? null;

// Mostrar interfaz de selección si no hay acción definida
if (!$action) {
    header('Content-Type: text/html; charset=utf-8');
    ?>
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <title>Control Seeder Mockup</title>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #faf8f5; color: #1a1a1a; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #fff; padding: 32px; border-radius: 16px; border: 1px solid #e6e4e0; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.03); max-width: 400px; width: 100%; }
            h1 { font-size: 20px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.02em; }
            p { font-size: 14px; color: #666; margin-bottom: 24px; line-height: 1.4; }
            .btn { display: block; width: 100%; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 13px; margin-bottom: 12px; box-sizing: border-box; transition: opacity 0.2s; }
            .btn-create { background: #000; color: #fff; border: 1px solid #000; }
            .btn-delete { background: transparent; color: #e02424; border: 1px solid #fecaca; }
            .btn:hover { opacity: 0.85; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>Seeder de Datos Mockup</h1>
            <p>Selecciona la acción que deseas realizar en la base de datos de tu plataforma:</p>
            <a href="?action=create" class="btn btn-create">CREAR DATOS MOCKUP</a>
            <a href="?action=delete" class="btn btn-delete">ELIMINAR DATOS MOCKUP</a>
        </div>
    </body>
    </html>
    <?php
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

// Títulos de los registros mockup para identificar y borrar/verificar
$mockCursosTitulos = [
    'Liderazgo Exponencial',
    'Identidad y Propósito',
    'Principios de Gobierno',
    'Oratoria Persuasiva'
];

$mockFeedTitulos = [
    'Lanzamiento: Liderazgo Exponencial',
    'Guía PDF de Gobierno',
    'Instagram: Juventud de Reforma',
    'Instagram: Actividad Reciente',
    'Canción de la semana: Horizon'
];

try {
    // 1. Limpieza inicial obligatoria de basura residual antigua con '[MOCK]'
    $stmtTrash = $pdo->query("SELECT id FROM Cursos WHERE titulo LIKE '[MOCK]%'");
    $trashIds = $stmtTrash->fetchAll(PDO::FETCH_COLUMN);
    if (!empty($trashIds)) {
        $placeholdersTrash = implode(',', array_fill(0, count($trashIds), '?'));
        $pdo->prepare("DELETE FROM Lecciones WHERE curso_id IN ($placeholdersTrash)")->execute($trashIds);
        $pdo->prepare("DELETE FROM Inscripciones WHERE curso_id IN ($placeholdersTrash)")->execute($trashIds);
        $pdo->prepare("DELETE FROM Cursos WHERE id IN ($placeholdersTrash)")->execute($trashIds);
    }
    $pdo->exec("DELETE FROM Feed WHERE titulo LIKE '[MOCK]%'");

    // Resolver placeholders para cursos mock actuales
    $placeholdersCursos = implode(',', array_fill(0, count($mockCursosTitulos), '?'));

    if ($action === 'delete') {
        echo "Procediendo a eliminar los datos mockup...\n\n";

        // Obtener IDs de los cursos mock a eliminar
        $stmtIds = $pdo->prepare("SELECT id FROM Cursos WHERE titulo IN ($placeholdersCursos)");
        $stmtIds->execute($mockCursosTitulos);
        $mockCourseIds = $stmtIds->fetchAll(PDO::FETCH_COLUMN);

        $deletedLecciones = 0;
        $deletedInscripciones = 0;
        $deletedCursos = 0;
        $deletedFeed = 0;

        if (!empty($mockCourseIds)) {
            $placeholdersIds = implode(',', array_fill(0, count($mockCourseIds), '?'));
            
            // Eliminar lecciones asociadas
            $stmtLec = $pdo->prepare("DELETE FROM Lecciones WHERE curso_id IN ($placeholdersIds)");
            $stmtLec->execute($mockCourseIds);
            $deletedLecciones = $stmtLec->rowCount();
            
            // Eliminar inscripciones asociadas
            $stmtIns = $pdo->prepare("DELETE FROM Inscripciones WHERE curso_id IN ($placeholdersIds)");
            $stmtIns->execute($mockCourseIds);
            $deletedInscripciones = $stmtIns->rowCount();
            
            // Eliminar cursos
            $stmtCur = $pdo->prepare("DELETE FROM Cursos WHERE id IN ($placeholdersIds)");
            $stmtCur->execute($mockCourseIds);
            $deletedCursos = $stmtCur->rowCount();
        }
        
        // Eliminar del feed por títulos exactos
        $placeholdersFeed = implode(',', array_fill(0, count($mockFeedTitulos), '?'));
        $stmtDelFeed = $pdo->prepare("DELETE FROM Feed WHERE titulo IN ($placeholdersFeed)");
        $stmtDelFeed->execute($mockFeedTitulos);
        $deletedFeed = $stmtDelFeed->rowCount();
        
        // Restablecer configuraciones a sus valores vacíos por defecto
        $pdo->exec("UPDATE Configuraciones SET valor = '{\"titulo\":\"\",\"artista\":\"\",\"url_audio\":\"\"}' WHERE clave = 'cancion_semana'");
        $pdo->exec("UPDATE Configuraciones SET valor = '[]' WHERE clave = 'top_redes'");

        echo "RESUMEN DE ELIMINACIÓN:\n";
        echo "- Cursos eliminados: $deletedCursos\n";
        echo "- Lecciones eliminadas: $deletedLecciones\n";
        echo "- Inscripciones eliminadas: $deletedInscripciones\n";
        echo "- Novedades de Feed eliminadas: $deletedFeed\n";
        echo "\n¡Datos mockup eliminados con éxito!\n";
        echo "\n<a href='seed_mockup.php'>Volver al inicio</a>";
    } 
    
    else if ($action === 'create') {
        echo "Limpiando datos mockup previos para evitar duplicados...\n";
        
        // Ejecutar borrado antes de insertar
        $stmtIds = $pdo->prepare("SELECT id FROM Cursos WHERE titulo IN ($placeholdersCursos)");
        $stmtIds->execute($mockCursosTitulos);
        $mockCourseIds = $stmtIds->fetchAll(PDO::FETCH_COLUMN);
        if (!empty($mockCourseIds)) {
            $placeholdersIds = implode(',', array_fill(0, count($mockCourseIds), '?'));
            $pdo->prepare("DELETE FROM Lecciones WHERE curso_id IN ($placeholdersIds)")->execute($mockCourseIds);
            $pdo->prepare("DELETE FROM Inscripciones WHERE curso_id IN ($placeholdersIds)")->execute($mockCourseIds);
            $pdo->prepare("DELETE FROM Cursos WHERE id IN ($placeholdersIds)")->execute($mockCourseIds);
        }
        $placeholdersFeed = implode(',', array_fill(0, count($mockFeedTitulos), '?'));
        $stmtDelFeed = $pdo->prepare("DELETE FROM Feed WHERE titulo IN ($placeholdersFeed)");
        $stmtDelFeed->execute($mockFeedTitulos);

        echo "Insertando nuevos datos mockup...\n\n";

        // 1. Insertar cursos
        $cursos = [
            'mock_1' => [
                'titulo' => 'Liderazgo Exponencial',
                'descripcion' => 'Aprende a liderar equipos con impacto global y principios de gobierno sólido.',
                'instructor' => 'Marta Gómez',
                'duracion_total' => '8 horas',
                'miniatura_url' => 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&q=80',
                'categoria' => 'liderazgo',
                'es_estreno' => 1,
                'precio' => 0.00,
                'tipo_acceso' => 'gratis'
            ],
            'mock_2' => [
                'titulo' => 'Identidad y Propósito',
                'descripcion' => 'Descubre tu diseño original y camina en tu propósito de vida.',
                'instructor' => 'Samuel Reyes',
                'duracion_total' => '5 horas',
                'miniatura_url' => 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&q=80',
                'categoria' => 'identidad',
                'es_estreno' => 0,
                'precio' => 49.99,
                'tipo_acceso' => 'pago'
            ],
            'mock_3' => [
                'titulo' => 'Principios de Gobierno',
                'descripcion' => 'Estructuras de gobierno, ciudadanía y reformas de impacto social.',
                'instructor' => 'Daniela Méndez',
                'duracion_total' => '12 horas',
                'miniatura_url' => 'https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&q=80',
                'categoria' => 'liderazgo',
                'es_estreno' => 1,
                'precio' => 0.00,
                'tipo_acceso' => 'bonus'
            ],
            'mock_4' => [
                'titulo' => 'Oratoria Persuasiva',
                'descripcion' => 'Desarrolla tus habilidades de comunicación e influencia en público.',
                'instructor' => 'Marta Gómez',
                'duracion_total' => '6 horas',
                'miniatura_url' => 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&q=80',
                'categoria' => 'liderazgo',
                'es_estreno' => 0,
                'precio' => 29.99,
                'tipo_acceso' => 'pago'
            ]
        ];

        $stmtCurso = $pdo->prepare("INSERT INTO Cursos (titulo, descripcion, instructor, duracion_total, miniatura_url, categoria, es_estreno, precio, tipo_acceso) VALUES (:titulo, :descripcion, :instructor, :duracion_total, :miniatura_url, :categoria, :es_estreno, :precio, :tipo_acceso)");
        
        $insertedCourseIds = [];
        $createdCursosCount = 0;
        foreach ($cursos as $key => $c) {
            $stmtCurso->execute($c);
            $insertedCourseIds[$key] = $pdo->lastInsertId();
            $createdCursosCount++;
        }

        // 2. Insertar lecciones referenciando los nuevos IDs auto-incrementales
        $lecciones = [
            [
                'curso_id' => $insertedCourseIds['mock_1'],
                'titulo' => 'Introducción al Liderazgo',
                'descripcion' => 'Conceptos básicos y mentalidad de un líder de reforma.',
                'video_url' => 'https://www.w3schools.com/html/mov_bbb.mp4',
                'audio_url' => null,
                'pdf_url' => 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            ],
            [
                'curso_id' => $insertedCourseIds['mock_1'],
                'titulo' => 'El carácter del Líder',
                'descripcion' => 'Principios éticos y bases del liderazgo trascendente.',
                'video_url' => null,
                'audio_url' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
                'pdf_url' => null
            ],
            [
                'curso_id' => $insertedCourseIds['mock_2'],
                'titulo' => 'El Origen del Propósito',
                'descripcion' => 'Identificando tus dones y talentos innatos.',
                'video_url' => 'https://www.w3schools.com/html/movie.mp4',
                'audio_url' => null,
                'pdf_url' => null
            ],
            [
                'curso_id' => $insertedCourseIds['mock_3'],
                'titulo' => 'Estructura Estatal',
                'descripcion' => 'Cómo funciona el diseño institucional en la reforma pública.',
                'video_url' => 'https://www.w3schools.com/html/mov_bbb.mp4',
                'audio_url' => null,
                'pdf_url' => 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            ]
        ];

        $stmtLeccion = $pdo->prepare("INSERT INTO Lecciones (curso_id, titulo, descripcion, video_url, audio_url, pdf_url) VALUES (:curso_id, :titulo, :descripcion, :video_url, :audio_url, :pdf_url)");
        $createdLeccionesCount = 0;
        foreach ($lecciones as $l) {
            $stmtLeccion->execute($l);
            $createdLeccionesCount++;
        }

        // 3. Inscribir a todos los usuarios
        $stmtUsers = $pdo->query("SELECT id FROM Usuarios");
        $allUsers = $stmtUsers->fetchAll(PDO::FETCH_COLUMN);
        
        $createdInscripcionesCount = 0;
        if (!empty($allUsers)) {
            $stmtIns = $pdo->prepare("INSERT IGNORE INTO Inscripciones (usuario_id, curso_id) VALUES (?, ?)");
            foreach ($allUsers as $uid) {
                $stmtIns->execute([$uid, $insertedCourseIds['mock_1']]);
                $stmtIns->execute([$uid, $insertedCourseIds['mock_2']]);
                $stmtIns->execute([$uid, $insertedCourseIds['mock_3']]);
                $createdInscripcionesCount += 3;
            }
        }

        // 4. Insertar feed
        $feed = [
            [
                'tipo' => 'social_embed',
                'titulo' => 'Instagram: Actividad Reciente',
                'descripcion' => 'Nueva publicación en nuestra cuenta oficial.',
                'embed_code' => '<iframe src="https://www.instagram.com/p/DaRJ5k3EuYJ/embed" style="width: 100%; max-width: 500px; height: 480px; border: 1px solid var(--line); border-radius: 12px; margin: 0 auto; display: block;" scrolling="no" frameborder="0"></iframe>',
                'referencia_id' => null
            ],
            [
                'tipo' => 'curso',
                'titulo' => 'Lanzamiento: Liderazgo Exponencial',
                'descripcion' => 'Ya está disponible nuestro nuevo curso gratuito sobre Liderazgo Exponencial.',
                'embed_code' => null,
                'referencia_id' => $insertedCourseIds['mock_1']
            ],
            [
                'tipo' => 'social_embed',
                'titulo' => 'Instagram: Juventud de Reforma',
                'descripcion' => 'Echa un vistazo a nuestra última publicación en Instagram.',
                'embed_code' => '<iframe src="https://www.instagram.com/p/DMjS2bnxY0M/embed" style="width: 100%; max-width: 500px; height: 480px; border: 1px solid var(--line); border-radius: 12px; margin: 0 auto; display: block;" scrolling="no" frameborder="0"></iframe>',
                'referencia_id' => null
            ],
            [
                'tipo' => 'cancion',
                'titulo' => 'Canción de la semana: Horizon',
                'descripcion' => 'Escucha la melodía inspiradora recomendada para esta semana.',
                'embed_code' => 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
                'referencia_id' => null
            ],
            [
                'tipo' => 'material_gratis',
                'titulo' => 'Guía PDF de Gobierno',
                'descripcion' => 'Descarga gratis la guía de principios constitucionales.',
                'embed_code' => null,
                'referencia_id' => $insertedCourseIds['mock_3']
            ]
        ];

        $stmtFeed = $pdo->prepare("INSERT INTO Feed (tipo, titulo, descripcion, embed_code, referencia_id) VALUES (:tipo, :titulo, :descripcion, :embed_code, :referencia_id)");
        $createdFeedCount = 0;
        foreach ($feed as $f) {
            $stmtFeed->execute($f);
            $createdFeedCount++;
        }

        // 5. Insertar configuraciones
        $songConfig = json_encode([
            'titulo' => 'Echoes',
            'artista' => 'Marcos Brunet',
            'url_audio' => 'uploads/audios/Echoes.mp3'
        ]);
        
        $redesConfig = json_encode([
            [
                'username' => '@marcosbrunet',
                'nombre' => 'Marcos Brunet',
                'avatar_url' => 'uploads/img/brunet.png',
                'descripcion' => 'Adoración, paternidad espiritual y discipulado. Creador de la semana.',
                'url' => 'https://www.instagram.com/marcosbrunet',
                'plataforma' => 'instagram'
            ],
            [
                'username' => '@juventud_mision',
                'nombre' => 'Juventud Misión',
                'avatar_url' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&q=80',
                'descripcion' => 'Inspiración diaria, devocionales y desafíos semanales para jóvenes apasionados.',
                'url' => 'https://www.instagram.com/juventuddereforma',
                'plataforma' => 'instagram'
            ],
            [
                'username' => '@reforma_musica',
                'avatar_url' => 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&q=80',
                'descripcion' => 'Alabanza, música nueva y recursos para el ministerio juvenil de adoración.',
                'url' => 'https://www.instagram.com/juventuddereforma'
            ]
        ]);

        $stmtConfig = $pdo->prepare("INSERT INTO Configuraciones (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)");
        $stmtConfig->execute(['cancion_semana', $songConfig]);
        $stmtConfig->execute(['top_redes', $redesConfig]);

        echo "RESUMEN DE CREACIÓN:\n";
        echo "- Cursos creados: $createdCursosCount\n";
        echo "- Lecciones creadas: $createdLeccionesCount\n";
        echo "- Inscripciones creadas: $createdInscripcionesCount\n";
        echo "- Novedades de Feed creadas: $createdFeedCount\n";
        echo "\n¡Datos mockup creados con éxito!\n";
        echo "\n<a href='seed_mockup.php'>Volver al inicio</a>";
    }

} catch (Exception $e) {
    echo "Error ejecutando el seed: " . $e->getMessage() . "\n";
    echo "\n<a href='seed_mockup.php'>Volver al inicio</a>";
}
