# Plan Backend y Base de Datos - Reforma

## 1. Actualización de Base de Datos (MySQL)
Modificar [db_update.php](file:///Volumes/MacMiniDock/Webs/reforma/db_update.php) para automatizar la ejecución de los siguientes cambios:

```sql
-- Agregar precio y tipo de acceso a Cursos
ALTER TABLE `Cursos`
ADD COLUMN `precio` DECIMAL(10,2) DEFAULT 0.00 AFTER `materiales`,
ADD COLUMN `tipo_acceso` ENUM('gratis', 'pago', 'bonus') NOT NULL DEFAULT 'pago' AFTER `precio`;

-- Agregar soporte para archivos de audio en Lecciones
ALTER TABLE `Lecciones`
ADD COLUMN `audio_url` VARCHAR(512) NULL AFTER `video_url`;

-- Crear tabla unificada de Feed de Inicio
CREATE TABLE IF NOT EXISTS `Feed` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tipo` ENUM('curso', 'material_gratis', 'cancion', 'social_embed', 'texto') NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `descripcion` TEXT NULL,
  `embed_code` TEXT NULL, -- HTML embutido o URL del MP3 de la canción
  `referencia_id` INT NULL, -- ID del curso/lección relacionado
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Crear tabla de Configuraciones dinámicas
CREATE TABLE IF NOT EXISTS `Configuraciones` (
  `clave` VARCHAR(100) PRIMARY KEY,
  `valor` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Inicializar valores por defecto
INSERT INTO `Configuraciones` (`clave`, `valor`) VALUES 
('cancion_semana', '{"titulo":"","artista":"","url_audio":""}'),
('top_redes', '[]'); -- Array JSON con: avatar_url, username, descripcion, url
```

---

## 2. Estructura de Directorios
- Crear la carpeta local `/uploads/audios/` en la raíz del proyecto para almacenar los archivos MP3 de los micros de audio y la canción de la semana.

---

## 3. Desarrollo de APIs PHP (`api/`)

### Paso 3.1: Crear `api/feed.php`
- **GET:** Retornar todas las novedades de la tabla `Feed` ordenadas por `created_at DESC`.
- **POST/PUT/DELETE:**
  - Validar token de sesión (usar la lógica estándar del proyecto).
  - Verificar que el usuario tenga `rol === 'admin'`. De lo contrario, retornar `403 Forbidden`.
  - Permitir insertar, actualizar o eliminar entradas manuales (como embeds de redes sociales o texto).

### Paso 3.2: Crear `api/configuraciones.php`
- **GET:** Leer y retornar las configuraciones del sistema (`cancion_semana` y `top_redes`).
- **POST/PUT:**
  - Validar token de sesión y confirmar `rol === 'admin'`.
  - Guardar el payload JSON actualizado de la configuración seleccionada.
  - **Efecto Secundario (Canción):** Al actualizar `cancion_semana`, insertar un registro correspondiente en la tabla `Feed` (tipo `'cancion'`) con los detalles de la nueva canción.

### Paso 3.3: Modificar `api/cursos.php`
- **POST/PUT:** Soportar los campos `precio` y `tipo_acceso`.
- **Trigger de Feed:** Al crear un curso exitosamente, insertar un registro en la tabla `Feed` de tipo `'curso'` apuntando a su `referencia_id`.

### Paso 3.4: Modificar `api/lecciones.php`
- **POST/PUT:** Soportar la subida del archivo MP3 al directorio `/uploads/audios/` y almacenar su ruta en `audio_url`.
- **Trigger de Feed:** Al crear una lección en un curso gratis, insertar un registro en la tabla `Feed` de tipo `'material_gratis'`.

### Paso 3.5: Modificar `api/inscripciones.php`
- **Inscripción Automática de Bonus:** Al procesar un pago o inscripción de un curso, verificar en la tabla `Relacion_Curso_Bonus` si tiene cursos bonus asociados. Inscribir automáticamente al usuario en ellos.

---

## 4. Sistema de Notificaciones (Novedades)
- **API `api/feed.php`:** El endpoint de feed servirá como base para "Novedades".
- **Control de Vistos:** Para saber cuántas novedades no ha visto el usuario, se comparará el ID más alto de la tabla `Feed` con el `last_seen_feed_id` almacenado localmente (localStorage) o en la sesión del usuario.
- **Endpoint Opcional:** Si se requiere persistencia multi-dispositivo, se puede añadir una columna `last_seen_feed_id` INT a la tabla `Usuarios`.
