# Plan Frontend Alumnos - Reforma

## 1. Estructura de Navegación Simplificada
- **Sidebar (Desktop):** Reducido a 4 secciones principales:
  1. **Inicio (`#/inicio`):** Feed unificado.
  2. **Explorar (`#/cursos`):** Catálogo de cursos con filtro "Destacados" y categorías.
  3. **Mi Progreso (`#/biblioteca`):** Cursos inscritos, descargas y bonus.
  4. **Mi Perfil (`#/ajustes`):** Ajustes de perfil y contraseña.
- **Bottom Navigation (Mobile):** Barra inferior fija en pantallas <= 768px con accesos rápidos a los 4 ítems principales.
- **Tops Histórico (`#/tops`):** Acceso exclusivo mediante el botón de "Ver historial" dentro del panel flotante. El botón de Tops ha sido removido del sidebar principal.
- **Novedades (`#/novedades`):** Eliminado como página redundante. La campana del header ahora solo notifica toast/badges visuales o redirige a `#/inicio`.

---

## 2. Nueva Sección: Inicio (`#/inicio`)
Establecer `#/inicio` como la vista por defecto al iniciar sesión. Su estructura visual se divide en un feed principal y una columna lateral/widgets (en desktop).

### Paso 2.1: Feed de Novedades Cronológico
- Consumir el endpoint `api/feed.php` al cargar la vista.
- Renderizar de acuerdo al tipo de novedad:
  - **Curso (`curso`) o Material Gratis (`material_gratis`):** Mostrar tarjeta con la miniatura del curso, título, descripción breve, tipo de acceso y enlace directo.
  - **Canción (`cancion`):** Mostrar bloque minimalista con título de la canción, artista y botón para iniciar el mini-reproductor flotante.
  - **Embed Social (`social_embed`):** Insertar directamente el código HTML/Iframe de Instagram, TikTok o YouTube Shorts de manera responsiva.
  - **Texto (`texto`):** Mostrar aviso informativo minimalista.

---

## 3. Mini-Reproductor Flotante e Historial (Tops)
- El botón flotante activa el panel desplegable.
- **Botón de Historial:** Agregar el botón "Ver Historial" en el panel flotante para navegar a `#/tops`.
- **Gesto de Descarte:** Mantener soporte para gestos táctiles de deslizamiento lateral.

---

## 4. Reproductor de Micros de Audio
- Soportar reproducción persistente de fondo en `dashboard.html`.

---

## 5. Control de Exclusión de Audio
- Exclusión mutua de audio entre micros y la canción semanal.

---

## 6. Control de Acceso Visual en Catálogo (`#/cursos`)
- Filtros interactivos: Todos, Gratis, Destacados, Categorías.
- Badges de estado (Gratis, Obtenido, Adquirir).
