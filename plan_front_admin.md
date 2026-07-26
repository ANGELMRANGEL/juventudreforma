# Plan Frontend Panel Administrativo - Reforma (Actualizado)

---

## Estado Actual del Admin

### Páginas existentes
- `page-dashboard` — Métricas generales
- `page-cursos` — CRUD de cursos
- `page-lecciones` — CRUD de lecciones
- `page-alumnos` — Gestión de usuarios
- `page-inscripciones` — Gestión de inscripciones
- `page-monitor` — Analítica
- `page-banners` — Banners promocionales

---

## PENDIENTE: Correcciones en páginas existentes

### 1. Modal de Cursos (`modal-curso` + `saveCurso()`)

**Faltan campos críticos que el frontend ya consume:**

- Agregar campo numérico `precio` (`step="0.01"`, placeholder: `Ej: 9.99`, default: `0`)
- Agregar selector `tipo_acceso` con opciones:
  - `pago` — Por defecto
  - `gratis`
  - `bonus`
- Actualizar `saveCurso()` para incluir `precio` y `tipo_acceso` en el payload al backend.

> **Nota:** La categoría `nuevos` del selector de cursos debe eliminarse. Los "estrenos" se controlan con el checkbox `es_estreno`, no con categoría.

---

### 2. Modal de Lecciones (`modal-leccion` + `saveLeccion()`)

**Falta soporte de audio:**

- Agregar `<input type="file" accept="audio/*">` para subir archivos de audio al servidor.
- Agregar campo alternativo `audio_url` (input de texto) para ingresar URL de audio externa.
- Modificar `saveLeccion()` para manejar subida de archivo MP3 o envío de URL al backend (`api/lecciones.php`).

---

## PENDIENTE: Nueva sección — "Inicio & Feed" (`page-feed`)

Agregar entrada en el sidebar del admin bajo la sección **Contenido**:

```
Feed & Configuraciones
```

Con icono SVG de publicación/broadcast y navegación a `page-feed`.

---

### 3. Gestión del Feed (posts del inicio del alumno)

**Formulario de nueva publicación:**
- Título del post (texto, obligatorio)
- Selector de tipo:
  - `texto` — Aviso informativo
  - `social_embed` — Embed de Instagram / TikTok / YouTube Shorts
- Área de texto (`textarea`) para el contenido o el código `iframe`/HTML embebido.
- Botón "Publicar" que hace POST a `api/feed.php` con `{ tipo, titulo, descripcion, embed_code }`.

**Listado de publicaciones actuales:**
- Carga `GET api/feed.php` al entrar a la sección.
- Muestra lista con: fecha, tipo (badge), título.
- Botón de eliminación con icono `<i class="fas fa-trash"></i>` → `DELETE api/feed.php?id={id}`.
- No se muestran las canciones en este listado (se gestionan desde el módulo de Canción de la Semana).

---

### 4. Módulo: Canción de la Semana

**Formulario:**
- Campo `titulo` (texto) — Título de la canción.
- Campo `artista` (texto) — Nombre del artista.
- Input de archivo `<input type="file" accept="audio/mp3,audio/mpeg">` para subir MP3 a `uploads/audios/`.
- Campo alternativo `url_audio` (texto) para usar URL directa si no se sube archivo.
- Botón "Actualizar Canción" → PUT/POST a `api/configuraciones.php` con `clave: cancion_semana` y el valor `{ titulo, artista, url_audio }`.

**Efecto esperado en el backend:**
- El endpoint `api/configuraciones.php` guarda en la tabla `Configuraciones`.
- Automáticamente inserta en la tabla `Feed` un registro con `tipo = 'cancion'`, `titulo = titulo`, `descripcion = artista`, `embed_code = url_audio`.
- Esto hace que la canción aparezca en la playlist histórica del alumno (`#/tops → Música`).

**Vista previa:**
- Mostrar la canción activa actual (cargada del GET de configuraciones) antes del formulario.

---

### 5. Módulo: Cuentas Recomendadas (Top Redes)

**Lista dinámica:**
- Carga la lista actual `config.top_redes` desde `GET api/configuraciones.php`.
- Muestra cada cuenta con:
  - Avatar (URL de imagen)
  - Username (`@nombre`)
  - Descripción corta
  - URL de enlace
  - Plataforma: `instagram`, `tiktok` o `youtube`
  - Botón eliminar

**Formulario para agregar cuenta:**
- Campos: `nombre`, `username`, `descripcion`, `url`, `avatar_url`, `plataforma` (selector).
- Botón "Añadir Cuenta" → añade el item a la lista en memoria.
- Botón "Guardar Cambios" → PUT a `api/configuraciones.php` con `clave: top_redes` y el array JSON actualizado.

---

## Estilo y Coherencia Visual

- Paleta: `--cream` (fondo), `--ink` (textos/inputs), `--line` (bordes `1px solid`).
- Tipografías: `--font-display` para títulos, `JetBrains Mono` para labels y detalles.
- Iconos: exclusivamente FontAwesome local (`assets/css/fontawesome.min.css`).

---

## Lógica de Notificaciones (Sin cambios)

Cualquier nueva publicación en el Feed (curso, canción, post) incrementa el ID máximo de la tabla `Feed`, lo que activa automáticamente el badge de novedades no leídas en el panel del alumno sin lógica adicional.
