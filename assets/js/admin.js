/* assets/js/admin.js */

// ── CONFIG ──────────────────────────────────────────────────────────
let currentUser = null;
let allCursos = [];
let allLecciones = [];
let allAlumnos = [];
let allInscripciones = [];

async function apiCall(endpoint, method = 'GET', body = null) {
  let finalMethod = method;
  let finalEndpoint = endpoint;
  if (method === 'PUT' || method === 'DELETE') {
    finalMethod = 'POST';
    const separator = endpoint.includes('?') ? '&' : '?';
    finalEndpoint = endpoint + separator + 'method=' + method;
  }
  const options = {
    method: finalMethod,
    headers: { 
      'Content-Type': 'application/json',
      'X-HTTP-Method-Override': method
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch('api/' + finalEndpoint, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Operación fallida');
  }
  return res.json();
}

// ── INIT ─────────────────────────────────────────────────────────────
async function initApp() {
  try {
    const sessionData = await apiCall('auth.php?action=session');
    if (!sessionData.session) { window.location.href = 'admin-login.html'; return; }
    currentUser = sessionData.session.user;

    const perfil = await apiCall('usuarios.php?id=' + currentUser.id);
    if (!perfil || perfil.rol !== 'admin') { window.location.href = 'dashboard.html'; return; }

    document.getElementById('admin-name').textContent = perfil.nombre || currentUser.email;
    
    const initialsEl = document.getElementById('admin-initials');
    if (initialsEl) {
      const avatarUrl = perfil.avatar_url || currentUser.avatar_url || currentUser.picture;
      if (avatarUrl) {
        initialsEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      } else {
        initialsEl.innerText = perfil.nombre ? perfil.nombre.charAt(0).toUpperCase() : '?';
      }
    }
    
    document.getElementById('global-loader').classList.add('hidden');

    await Promise.all([loadCursos(), loadLecciones(), loadAlumnos(), loadInscripciones()]);
    loadDashboard();
    loadMonitor();
  } catch (e) {
    console.error(e);
    window.location.href = 'admin-login.html';
  }
}

// ── CONFIRM ───────────────────────────────────────────────────────────
function confirm(msg, onOk) {
  document.getElementById('confirm-msg').textContent = msg;
  const btn = document.getElementById('confirm-btn');
  btn.onclick = () => { closeModal('modal-confirm'); onOk(); };
  openModal('modal-confirm');
}

// ── NAVIGATION ─────────────────────────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-' + page).classList.add('active');
  if (page === 'feed') loadFeedPage();
  if (page === 'top-musica') loadTopMusicaPage();
  if (page === 'top-cuentas') loadTopCuentasPage();
}

// ── MODALS ─────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

// ── FORMAT HELPERS ─────────────────────────────────────────────────────
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── LOAD DATA ──────────────────────────────────────────────────────────
async function loadCursos() {
  try {
    const data = await apiCall('cursos.php');
    allCursos = data || [];
    document.getElementById('badge-cursos').textContent = allCursos.length;

    // Populate selects
    const opts = allCursos.map(c => `<option value="${c.id}">${c.titulo || '(sin título)'}</option>`).join('');
    ['leccion-curso-id', 'inscripcion-curso-id', 'filter-curso-lecciones'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const first = el.options[0]?.text;
      el.innerHTML = `<option value="">${first || '— Selecciona —'}</option>` + opts;
    });

    renderCursos();
  } catch (err) {
    toast('Error al cargar cursos', 'error');
  }
}

async function loadLecciones() {
  try {
    const data = await apiCall('lecciones.php');
    allLecciones = data || [];
    const badge = document.getElementById('badge-lecciones');
    if (badge) badge.textContent = allLecciones.length;
    renderCursos();
  } catch (err) {
    toast('Error al cargar lecciones', 'error');
  }
}

async function loadAlumnos() {
  try {
    const data = await apiCall('usuarios.php');
    allAlumnos = data || [];
    document.getElementById('badge-alumnos').textContent = allAlumnos.length;
    renderAlumnos();
  } catch (err) {
    toast('Error al cargar alumnos', 'error');
  }
}

async function loadInscripciones() {
  try {
    const [inscripciones, usuarios, cursos] = await Promise.all([
      apiCall('inscripciones.php'),
      apiCall('usuarios.php'),
      apiCall('cursos.php')
    ]);

    const usuarioMap = new Map((usuarios || []).map(u => [u.id, u]));
    const cursoMap   = new Map((cursos   || []).map(c => [c.id, c]));

    allInscripciones = (inscripciones || []).map(ins => ({
      ...ins,
      Usuarios: usuarioMap.get(ins.usuario_id) || null,
      Cursos:   cursoMap.get(ins.curso_id)     || null
    }));

    renderInscripciones();
  } catch (err) {
    toast('Error al cargar inscripciones', 'error');
  }
}

async function loadMonitor() {
  const body = document.getElementById('table-monitor');
  body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;"><span class="ml">Cargando progreso...</span></td></tr>`;

  try {
    const data = await apiCall('progreso.php?action=vista_progreso');
    if (!data || data.length === 0) {
      body.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="ml">Sin datos de progreso aún</span></div></td></tr>`;
      return;
    }

    const usuarios = await apiCall('usuarios.php');
    const userMap = {};
    (usuarios || []).forEach(u => { userMap[u.id] = u; });

    body.innerHTML = data.map(p => {
      const u = userMap[p.usuario_id];
      const nombre = u ? `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email : p.usuario_id.slice(0, 8) + '...';
      const pct = Math.round(p.porcentaje_progreso || 0);
      const barColor = pct === 100 ? 'var(--success)' : 'var(--ink)';
      return `
      <tr>
        <td>
          <strong>${nombre}</strong>
          ${u?.email ? `<br><span class="ml" style="font-size:9px;">${u.email}</span>` : ''}
        </td>
        <td>${p.nombre_curso}</td>
        <td>
          <div class="progress-wrap">
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
            <span style="font-family:'JetBrains Mono',monospace;font-size:10px;min-width:36px;">${pct}%</span>
          </div>
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-size:10px;">${p.lecciones_completadas}/${p.total_lecciones}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4"><div class="empty-state"><span class="ml">Error al cargar progreso</span></div></td></tr>`;
  }
}

// ── BANNERS ────────────────────────────────────────────────────────────
let allBanners = [];

async function loadBanners() {
  try {
    const data = await apiCall('banners.php');
    allBanners = data || [];
    document.getElementById('badge-banners').textContent = allBanners.length;
    renderBannersTable();
  } catch (err) {
    toast('Error al cargar banners', 'error');
  }
}

function renderBannersTable() {
  const body = document.getElementById('table-banners');
  if (!allBanners.length) {
    body.innerHTML = `<tr><td colspan="5"><div class="empty-state"><span class="ml">Sin banners creados aún</span></div></td></tr>`;
    return;
  }
  body.innerHTML = allBanners.map(b => `
  <tr onclick="editBanner('${b.id}')" style="cursor:pointer;">
    <td>
      <strong>${b.titulo}</strong>
      ${b.link_url ? `<br><span class="ml" style="font-size:9px;">${b.link_texto || 'Ver más'} → ${b.link_url.slice(0,40)}${b.link_url.length>40?'...':''}</span>` : ''}
    </td>
    <td><span class="ml">${b.subtitulo || '—'}</span></td>
    <td>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="width:20px;height:20px;border-radius:4px;background:${b.color_fondo || '#E63946'};border:1px solid var(--line);"></div>
        <div style="width:20px;height:20px;border-radius:4px;background:${b.color_texto || '#FFFFFF'};border:1px solid var(--line);"></div>
      </div>
    </td>
    <td>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="event.stopPropagation();">
        <input type="checkbox" ${b.activo ? 'checked' : ''} onchange="toggleBannerActivo('${b.id}', this.checked)" style="width:16px;height:16px;cursor:pointer;">
        <span class="ml" style="color:${b.activo ? 'var(--success)' : 'var(--muted)'};">${b.activo ? 'ACTIVO' : 'Inactivo'}</span>
      </label>
    </td>
    <td style="text-align:right; white-space:nowrap;">
      <button onclick="event.stopPropagation(); deleteBanner('${b.id}')" style="background:transparent; border:none; color:var(--accent); cursor:pointer; padding:8px;">
        <i class="fas fa-trash"></i>
      </button>
    </td>
  </tr>`).join('');
}

function openModalBanner(id) {
  document.getElementById('banner-edit-id').value = '';
  document.getElementById('banner-titulo').value = '';
  document.getElementById('banner-subtitulo').value = '';
  document.getElementById('banner-imagen-url').value = '';
  document.getElementById('banner-link-url').value = '';
  document.getElementById('banner-link-texto').value = 'Ver más';
  document.getElementById('banner-color-fondo').value = '#E63946';
  document.getElementById('banner-color-texto').value = '#FFFFFF';
  document.getElementById('modal-banner-title').textContent = 'Nuevo Banner';
  updateBannerPreview();
  openModal('modal-banner');
}

function editBanner(id) {
  const b = allBanners.find(x => x.id == id);
  if (!b) return;
  document.getElementById('banner-edit-id').value = b.id;
  document.getElementById('banner-titulo').value = b.titulo || '';
  document.getElementById('banner-subtitulo').value = b.subtitulo || '';
  document.getElementById('banner-imagen-url').value = b.imagen_url || '';
  document.getElementById('banner-link-url').value = b.link_url || '';
  document.getElementById('banner-link-texto').value = b.link_texto || 'Ver más';
  document.getElementById('banner-color-fondo').value = b.color_fondo || '#E63946';
  document.getElementById('banner-color-texto').value = b.color_texto || '#FFFFFF';
  document.getElementById('modal-banner-title').textContent = 'Editar Banner';
  updateBannerPreview();
  openModal('modal-banner');
}

function updateBannerPreview() {
  const titulo = document.getElementById('banner-titulo').value || 'Título del banner';
  const sub = document.getElementById('banner-subtitulo').value;
  const linkUrl = document.getElementById('banner-link-url').value;
  const linkTxt = document.getElementById('banner-link-texto').value || 'Ver más';
  const colorFondo = document.getElementById('banner-color-fondo').value;
  const colorTexto = document.getElementById('banner-color-texto').value;
  const preview = document.getElementById('banner-preview');
  if (!preview) return;
  preview.style.background = colorFondo;
  preview.style.color = colorTexto;
  document.getElementById('prev-titulo').textContent = titulo;
  document.getElementById('prev-sub').textContent = sub;
  const cta = document.getElementById('prev-cta');
  cta.style.display = linkUrl ? '' : 'none';
  cta.textContent = linkTxt + ' →';
  cta.style.color = colorTexto;
}

async function saveBanner() {
  const titulo = document.getElementById('banner-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio'); return; }

  const payload = {
    titulo,
    subtitulo: document.getElementById('banner-subtitulo').value.trim() || null,
    imagen_url: document.getElementById('banner-imagen-url').value.trim() || null,
    link_url: document.getElementById('banner-link-url').value.trim() || null,
    link_texto: document.getElementById('banner-link-texto').value.trim() || 'Ver más',
    color_fondo: document.getElementById('banner-color-fondo').value,
    color_texto: document.getElementById('banner-color-texto').value,
  };

  const editId = document.getElementById('banner-edit-id').value;
  try {
    if (editId) {
      await apiCall('banners.php?id=' + editId, 'PUT', payload);
    } else {
      await apiCall('banners.php', 'POST', payload);
    }
    closeModal('modal-banner');
    await loadBanners();
  } catch (err) {
    alert('Error guardando banner: ' + err.message);
  }
}

async function toggleBannerActivo(id, checked) {
  try {
    await apiCall('banners.php?id=' + id, 'PUT', { activo: checked });
    await loadBanners();
  } catch (err) {
    toast('Error al actualizar banner', 'error');
  }
}

function deleteBanner(id) {
  confirm('¿Eliminar este banner?', async () => {
    try {
      await apiCall('banners.php?id=' + id, 'DELETE');
      await loadBanners();
    } catch (err) {
      toast('Error al eliminar banner', 'error');
    }
  });
}

// ── DASHBOARD ──────────────────────────────────────────────────────────
async function loadDashboard() {
  document.getElementById('stat-cursos').textContent = allCursos.length;
  document.getElementById('stat-alumnos').textContent = allAlumnos.length;
  document.getElementById('stat-inscripciones').textContent = allInscripciones.length;
  document.getElementById('stat-lecciones').textContent = allLecciones.length;

  try {
    const progreso = await apiCall('progreso.php?completado=1');
    const count = progreso ? progreso.length : 0;
    document.getElementById('stat-completadas').textContent = count;
  } catch (err) {
    document.getElementById('stat-completadas').textContent = '—';
  }

  // Recent inscripciones
  const recent = allInscripciones.slice(0, 6);
  document.getElementById('recent-inscripciones').innerHTML = recent.length === 0
    ? `<tr><td colspan="3"><div class="empty-state"><span class="ml">Sin inscripciones</span></div></td></tr>`
    : recent.map(ins => `
        <tr>
          <td><strong>${ins.Usuarios?.nombre || '—'} ${ins.Usuarios?.apellido || ''}</strong></td>
          <td>${ins.Cursos?.titulo || '—'}</td>
          <td>${fmtDate(ins.fecha_de_compra)}</td>
        </tr>`).join('');

  // Recent cursos
  const cursosList = allCursos.slice(0, 5);
  document.getElementById('recent-cursos').innerHTML = cursosList.length === 0
    ? `<div class="empty-state"><span class="ml">Sin cursos</span></div>`
    : cursosList.map(c => `
        <div style="display:flex;align-items:center;gap:16px;padding:14px 24px;border-bottom:1px solid var(--line);">
          <img src="${c.miniatura_url || ''}" onerror="this.style.display='none'" class="thumb" alt="">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.titulo || '(sin título)'}</div>
            <div class="ml" style="margin-top:2px;">${c.instructor_nombre || c.instructor || 'Sin instructor'} · ${c.nivel || ''}</div>
          </div>
          ${c.es_estreno ? '<span class="badge badge-estreno">Estreno</span>' : ''}
        </div>`).join('');
}

// ── RENDER TABLES ──────────────────────────────────────────────────────
function renderCursos(list = allCursos) {
  const tbody = document.getElementById('table-cursos');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="ml">No hay cursos creados</span></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(c => {
    const courseLessons = (allLecciones || []).filter(l => l.curso_id == c.id).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    
    const lessonPills = courseLessons.map((l, idx) => `
      <span onclick="event.stopPropagation(); editLeccion(${l.id})" style="display:inline-block; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; background:var(--ink); color:var(--cream); padding:2px 8px; border-radius:4px; margin-right:4px; margin-top:6px; cursor:pointer;" title="${(l.titulo || '').replace(/"/g, '&quot;')}">
        ${idx + 1}
      </span>
    `).join('');
    
    const addPill = `
      <span onclick="event.stopPropagation(); openModalLeccionWithCourse('${c.id}')" style="display:inline-block; font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:700; background:transparent; border:1px dashed var(--ink); color:var(--ink); padding:1px 7px; border-radius:4px; margin-top:6px; cursor:pointer;" title="Añadir Lección">
        +
      </span>
    `;

    return `
    <tr onclick="editCurso('${c.id}')" style="cursor:pointer;">
      <td><img src="${c.miniatura_url || ''}" onerror="this.style.display='none'" class="thumb" alt=""></td>
      <td>
        <strong>${c.titulo || '(sin título)'}</strong>
        ${c.descripcion ? `<br><span class="ml" style="font-size:9px;">${c.descripcion.slice(0,50)}${c.descripcion.length>50?'…':''}</span>` : ''}
        <div style="margin-top:4px;">
          ${lessonPills} ${addPill}
        </div>
      </td>
      <td>${c.instructor_nombre || c.instructor || '—'}</td>
      <td>${c.nivel || '—'}</td>
      <td>${c.duracion_total || '—'}</td>
      <td>${c.categoria || '—'}</td>
      <td>${c.es_estreno ? '<span class="badge badge-estreno">Estreno</span>' : '<span class="ml">—</span>'}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button onclick="event.stopPropagation(); deleteCurso('${c.id}','${(c.titulo||'').replace(/'/g,"\\'")}')" style="background:transparent; border:none; color:var(--accent); cursor:pointer; padding:8px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>`;
  }).join('');
}

function renderAlumnos(list = allAlumnos) {
  const tbody = document.getElementById('table-alumnos');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="ml">No hay alumnos registrados</span></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => `
    <tr onclick="editAlumno('${u.id}')" style="cursor:pointer;">
      <td><strong>${u.nombre || '—'} ${u.apellido || ''}</strong></td>
      <td>${u.email || '—'}</td>
      <td>${u.pais || '—'}</td>
      <td>${u.telefono || u.whatsapp || '—'}</td>
      <td><span class="badge badge-${u.rol || 'alumno'}">${u.rol || 'alumno'}</span></td>
      <td style="text-align:right; white-space:nowrap;">
        <button onclick="event.stopPropagation(); deleteAlumno('${u.id}', '${((u.nombre || '') + ' ' + (u.apellido || '')).trim().replace(/'/g, "\\'")}')" style="background:transparent; border:none; color:var(--accent); cursor:pointer; padding:8px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>`).join('');
}

function renderInscripciones(list = allInscripciones) {
  const tbody = document.getElementById('table-inscripciones');
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="ml">No hay inscripciones</span></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(ins => `
    <tr>
      <td><strong>${ins.Usuarios?.nombre || '—'} ${ins.Usuarios?.apellido || ''}</strong></td>
      <td>${ins.Usuarios?.email || '—'}</td>
      <td>${ins.Cursos?.titulo || '—'}</td>
      <td>${fmtDate(ins.fecha_de_compra)}</td>
      <td>${fmtDate(ins.fecha_expiracion)}</td>
      <td style="text-align:right; white-space:nowrap;">
        <button onclick="event.stopPropagation(); deleteInscripcion(${ins.id})" style="background:transparent; border:none; color:var(--accent); cursor:pointer; padding:8px;">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>`).join('');
}

// ── FILTERS ────────────────────────────────────────────────────────────
function filterCursos() {
  const q = document.getElementById('search-cursos').value.toLowerCase();
  renderCursos(allCursos.filter(c => (c.titulo||'').toLowerCase().includes(q) || (c.instructor||'').toLowerCase().includes(q)));
}

function filterAlumnos() {
  const q = document.getElementById('search-alumnos').value.toLowerCase();
  renderAlumnos(allAlumnos.filter(u =>
    (u.nombre||'').toLowerCase().includes(q) ||
    (u.apellido||'').toLowerCase().includes(q) ||
    (u.email||'').toLowerCase().includes(q)
  ));
}

// ── CURSO CRUD ─────────────────────────────────────────────────────────
function addMaterialRow(titulo = '', url = '') {
  const list = document.getElementById('materiales-list');
  const row = document.createElement('div');
  row.className = 'material-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 2fr auto;gap:8px;align-items:center;';
  row.innerHTML = `
    <input type="text" placeholder="Nombre (ej: Guía PDF)" value="${titulo.replace(/"/g,'&quot;')}"
      style="border:none;border-bottom:1px solid var(--line);padding:8px 0;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;background:transparent;">
    <input type="url" placeholder="https://drive.google.com/..." value="${url.replace(/"/g,'&quot;')}"
      style="border:none;border-bottom:1px solid var(--line);padding:8px 0;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;background:transparent;">
    <button type="button" onclick="this.closest('.material-row').remove()"
      style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:16px;padding:0 4px;" title="Eliminar">✕</button>`;
  list.appendChild(row);
}

function getMateriales() {
  return [...document.querySelectorAll('#materiales-list .material-row')].map(row => {
    const inputs = row.querySelectorAll('input');
    return { titulo: inputs[0].value.trim(), url: inputs[1].value.trim() };
  }).filter(m => m.titulo && m.url);
}

function openModalCurso() {
  document.getElementById('modal-curso-title').textContent = 'Nuevo Curso';
  document.getElementById('curso-edit-id').value = '';
  ['curso-titulo','curso-instructor-nombre','curso-miniatura','curso-descripcion','curso-duracion-total'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('curso-nivel').value = 'Todos los niveles';
  document.getElementById('curso-categoria').value = '';
  document.getElementById('curso-estreno').checked = false;
  document.getElementById('materiales-list').innerHTML = '';
  openModal('modal-curso');
}

function editCurso(id) {
  const c = allCursos.find(x => x.id == id);
  if (!c) return;
  document.getElementById('modal-curso-title').textContent = 'Editar Curso';
  document.getElementById('curso-edit-id').value = c.id;
  document.getElementById('curso-titulo').value = c.titulo || '';
  document.getElementById('curso-instructor-nombre').value = c.instructor_nombre || c.instructor || '';
  document.getElementById('curso-miniatura').value = c.miniatura_url || '';
  document.getElementById('curso-descripcion').value = c.descripcion || '';
  document.getElementById('curso-nivel').value = c.nivel || 'Todos los niveles';
  document.getElementById('curso-duracion-total').value = c.duracion_total || '';
  document.getElementById('curso-categoria').value = c.categoria || '';
  document.getElementById('curso-estreno').checked = !!c.es_estreno;
  document.getElementById('materiales-list').innerHTML = '';
  const mats = Array.isArray(c.materiales) ? c.materiales : [];
  mats.forEach(m => addMaterialRow(m.titulo || '', m.url || ''));
  openModal('modal-curso');
}

async function saveCurso() {
  const id    = document.getElementById('curso-edit-id').value;
  const titulo = document.getElementById('curso-titulo').value.trim();
  if (!titulo) { toast('El título es obligatorio', 'error'); return; }

  const instrNombre = document.getElementById('curso-instructor-nombre').value.trim() || null;
  const payload = {
    titulo,
    instructor_nombre: instrNombre,
    instructor:        instrNombre,
    miniatura_url:     document.getElementById('curso-miniatura').value.trim() || null,
    descripcion:       document.getElementById('curso-descripcion').value.trim() || null,
    nivel:             document.getElementById('curso-nivel').value || 'Todos los niveles',
    duracion_total:    document.getElementById('curso-duracion-total').value.trim() || null,
    categoria:         document.getElementById('curso-categoria').value || null,
    es_estreno:        document.getElementById('curso-estreno').checked ? 1 : 0,
    tipo_acceso:       document.getElementById('curso-tipo-acceso').value || 'pago',
    precio:            parseFloat(document.getElementById('curso-precio').value) || 0,
    materiales:        getMateriales(),
  };

  try {
    if (id) {
      await apiCall('cursos.php?id=' + id, 'PUT', payload);
    } else {
      await apiCall('cursos.php', 'POST', payload);
    }
    toast(id ? 'Curso actualizado ✓' : 'Curso creado ✓', 'success');
    closeModal('modal-curso');
    await loadCursos();
    loadDashboard();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

function deleteCurso(id, titulo) {
  confirm(`¿Eliminar el curso "${titulo}"? Esto también eliminará sus lecciones.`, async () => {
    try {
      await apiCall('cursos.php?id=' + id, 'DELETE');
      toast('Curso eliminado', 'success');
      await Promise.all([loadCursos(), loadLecciones()]);
      loadDashboard();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });
}

// ── LECCIÓN CRUD ───────────────────────────────────────────────────────
function openModalLeccion() {
  document.getElementById('modal-leccion-title').textContent = 'Nueva Lección';
  document.getElementById('leccion-edit-id').value = '';
  ['leccion-titulo','leccion-video-url','leccion-seccion','leccion-pdf-url','leccion-miniatura-url','leccion-descripcion','leccion-audio-url'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('leccion-duracion-min').value = '';
  document.getElementById('leccion-orden').value = '';
  document.getElementById('leccion-curso-id').value = '';
  document.getElementById('leccion-audio-file').value = '';
  document.getElementById('btn-delete-leccion-modal').style.display = 'none';
  openModal('modal-leccion');
}

function openModalLeccionWithCourse(cursoId) {
  openModalLeccion();
  document.getElementById('leccion-curso-id').value = cursoId;
  onLeccionCursoChange();
}

function onLeccionCursoChange() {
  const cursoId = document.getElementById('leccion-curso-id').value;
  if (!cursoId) return;
  
  const ordenInput = document.getElementById('leccion-orden');
  const seccionInput = document.getElementById('leccion-seccion');
  
  const courseLessons = allLecciones.filter(l => l.curso_id == cursoId);
  if (courseLessons.length > 0) {
    if (!ordenInput.value) {
      const maxOrder = Math.max(...courseLessons.map(l => parseInt(l.orden) || 0));
      ordenInput.value = maxOrder + 1;
    }
    if (!seccionInput.value) {
      // Ordenar por orden descendente para obtener la sección de la última lección agregada
      const sorted = [...courseLessons].sort((a, b) => (parseInt(b.orden) || 0) - (parseInt(a.orden) || 0));
      const lastSection = sorted[0].seccion;
      if (lastSection) {
        seccionInput.value = lastSection;
      }
    }
  } else {
    if (!ordenInput.value) ordenInput.value = 1;
  }
}

function editLeccion(id) {
  const l = allLecciones.find(x => x.id == id);
  if (!l) return;
  const videoUrl = l.video_url || (l.youtube_id ? `https://www.youtube.com/watch?v=${l.youtube_id}` : '');
  document.getElementById('modal-leccion-title').textContent = 'Editar Lección';
  document.getElementById('leccion-edit-id').value = l.id;
  document.getElementById('leccion-curso-id').value = l.curso_id || '';
  document.getElementById('leccion-titulo').value = l.titulo || '';
  document.getElementById('leccion-video-url').value = videoUrl;
  document.getElementById('leccion-seccion').value = l.seccion || '';
  document.getElementById('leccion-duracion-min').value = l.duracion_min || '';
  document.getElementById('leccion-orden').value = l.orden || '';
  document.getElementById('leccion-pdf-url').value = l.pdf_url || '';
  document.getElementById('leccion-miniatura-url').value = l.miniatura_url || '';
  document.getElementById('leccion-audio-url').value = l.audio_url || '';
  document.getElementById('leccion-descripcion').value = l.descripcion || '';
  document.getElementById('leccion-audio-file').value = '';
  document.getElementById('btn-delete-leccion-modal').style.display = 'block';
  openModal('modal-leccion');
}

async function autoFetchYoutubeMetadata() {
  const url = document.getElementById('leccion-video-url').value.trim();
  if (!url) return;
  
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s?]+)/);
  if (!ytMatch) return;
  const youtubeId = ytMatch[1];
  
  toast('Consultando metadatos...', 'info');
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    
    if (data.title) {
      const titleInput = document.getElementById('leccion-titulo');
      if (!titleInput.value) {
        titleInput.value = data.title;
      }
      
      const miniaturaInput = document.getElementById('leccion-miniatura-url');
      if (!miniaturaInput.value) {
        miniaturaInput.value = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
      }
      
      // Consultar endpoint seguro de backend para IA
      try {
        const dsRes = await fetch('api/ia.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            titulo: data.title
          })
        });
        const dsData = await dsRes.json();
        if (dsData.choices && dsData.choices[0] && dsData.choices[0].message) {
          const descInput = document.getElementById('leccion-descripcion');
          if (!descInput.value) {
            descInput.value = dsData.choices[0].message.content.trim();
          }
        }
      } catch (dsErr) {
        console.error('Error con DeepSeek (Backend):', dsErr);
      }
      
      toast('Datos autocompletados ✓', 'success');
    }
  } catch (err) {
    console.error('Error al obtener metadatos:', err);
  }
}

async function saveLeccion() {
  const id       = document.getElementById('leccion-edit-id').value;
  const titulo   = document.getElementById('leccion-titulo').value.trim();
  const curso_id = document.getElementById('leccion-curso-id').value;
  const videoUrl = document.getElementById('leccion-video-url').value.trim();

  if (!titulo || !curso_id || !videoUrl) {
    toast('Título, curso y URL del video son obligatorios', 'error');
    return;
  }

  const ytMatch  = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s?]+)/);
  const youtube_id = ytMatch ? ytMatch[1] : null;

  const durMin = parseInt(document.getElementById('leccion-duracion-min').value) || null;
  const orden  = parseInt(document.getElementById('leccion-orden').value) || null;

  let audioUrl = document.getElementById('leccion-audio-url').value.trim() || null;
  const audioFile = document.getElementById('leccion-audio-file').files[0];
  if (audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    try {
      const upRes = await fetch('api/upload.php?tipo=audio', { method: 'POST', body: formData });
      const upData = await upRes.json();
      if (upData.url) audioUrl = upData.url;
    } catch (upErr) {
      toast('No se pudo subir el audio: ' + upErr.message, 'error');
    }
  }

  const payload = {
    titulo,
    curso_id,
    video_url:   videoUrl,
    youtube_id:  youtube_id,
    seccion:     document.getElementById('leccion-seccion').value.trim() || null,
    duracion_min: durMin,
    orden,
    pdf_url:     document.getElementById('leccion-pdf-url').value.trim() || null,
    miniatura_url: document.getElementById('leccion-miniatura-url').value.trim() || null,
    audio_url:   audioUrl,
    descripcion: document.getElementById('leccion-descripcion').value.trim() || null,
  };

  try {
    if (id) {
      await apiCall('lecciones.php?id=' + id, 'PUT', payload);
    } else {
      await apiCall('lecciones.php', 'POST', payload);
    }
    toast(id ? 'Lección actualizada ✓' : 'Lección creada ✓', 'success');
    closeModal('modal-leccion');
    await Promise.all([loadCursos(), loadLecciones()]);
    loadDashboard();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

function deleteLeccion(id, titulo) {
  confirm(`¿Eliminar la lección "${titulo}"?`, async () => {
    try {
      await apiCall('lecciones.php?id=' + id, 'DELETE');
      toast('Lección eliminada', 'success');
      closeModal('modal-leccion');
      await Promise.all([loadCursos(), loadLecciones()]);
      loadDashboard();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });
}

function deleteLeccionFromModal() {
  const id = document.getElementById('leccion-edit-id').value;
  const titulo = document.getElementById('leccion-titulo').value;
  if (id) {
    deleteLeccion(id, titulo);
  }
}

// ── ALUMNO CRUD ────────────────────────────────────────────────────────
async function editAlumno(id) {
  const u = allAlumnos.find(x => x.id == id);
  if (!u) return;
  try {
    const fullUser = await apiCall('usuarios.php?id=' + u.id);
    document.getElementById('alumno-edit-id').value = fullUser.id;
    document.getElementById('alumno-nombre').value = fullUser.nombre || '';
    document.getElementById('alumno-apellido').value = fullUser.apellido || '';
    document.getElementById('alumno-email').value = fullUser.email || '';
    document.getElementById('alumno-rol').value = fullUser.rol || 'alumno';
    document.getElementById('alumno-cedula').value = fullUser.cedula || '';
    document.getElementById('alumno-telefono').value = fullUser.telefono || fullUser.whatsapp || '';
    document.getElementById('alumno-pais').value = fullUser.pais || '';
    document.getElementById('alumno-ciudad').value = fullUser.ciudad || '';
    document.getElementById('alumno-ocupacion').value = fullUser.ocupacion || '';
    document.getElementById('alumno-estudios').value = fullUser.nivel_estudios || '';
    document.getElementById('alumno-motivacion').value = fullUser.motivacion || '';
    openModal('modal-alumno');
  } catch (err) {
    toast('Error al cargar datos del alumno: ' + err.message, 'error');
  }
}

async function saveAlumno() {
  const id = document.getElementById('alumno-edit-id').value;
  const payload = {
    nombre: document.getElementById('alumno-nombre').value.trim(),
    apellido: document.getElementById('alumno-apellido').value.trim(),
    email: document.getElementById('alumno-email').value.trim(),
    rol: document.getElementById('alumno-rol').value,
    cedula: document.getElementById('alumno-cedula').value.trim(),
    telefono: document.getElementById('alumno-telefono').value.trim(),
    pais: document.getElementById('alumno-pais').value.trim(),
    ciudad: document.getElementById('alumno-ciudad').value.trim(),
    ocupacion: document.getElementById('alumno-ocupacion').value.trim(),
    nivel_estudios: document.getElementById('alumno-estudios').value.trim(),
    motivacion: document.getElementById('alumno-motivacion').value.trim()
  };

  if (!payload.nombre || !payload.email) {
    toast('Nombre y email son requeridos', 'error');
    return;
  }

  try {
    await apiCall('usuarios.php?id=' + id, 'PUT', payload);
    toast('Alumno actualizado ✓', 'success');
    closeModal('modal-alumno');
    await loadAlumnos();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function resetPasswordFromModal() {
  const email = document.getElementById('alumno-email').value;
  if (!email) { toast('El email es requerido para restablecer contraseña', 'error'); return; }
  confirm(`¿Enviar email de restablecimiento de contraseña a:\n${email}?`, async () => {
    toast(`Funcionalidad de correo no configurada. El correo es: ${email}`, 'success');
  });
}

function deleteAlumno(id, nombre) {
  confirm(`¿Eliminar al alumno "${nombre}" y todo su progreso e inscripciones? Esta acción no se puede deshacer.`, async () => {
    try {
      await apiCall('usuarios.php?id=' + id, 'DELETE');
      toast('Alumno eliminado ✓', 'success');
      await Promise.all([loadAlumnos(), loadInscripciones()]);
      loadDashboard();
      loadMonitor();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });
}


// ── INSCRIPCIÓN CRUD ───────────────────────────────────────────────────
function openModalInscripcion() {
  document.getElementById('inscripcion-email').value = '';
  document.getElementById('inscripcion-curso-id').value = '';
  document.getElementById('inscripcion-expiracion').value = '';
  openModal('modal-inscripcion');
}

async function saveInscripcion() {
  const email = document.getElementById('inscripcion-email').value.trim();
  const curso_id = document.getElementById('inscripcion-curso-id').value;
  if (!email || !curso_id) { toast('Email y curso son obligatorios', 'error'); return; }

  try {
    const usuario = await apiCall('usuarios.php?email=' + encodeURIComponent(email));
    if (!usuario) { toast('No se encontró un usuario con ese email', 'error'); return; }

    const expiracion = document.getElementById('inscripcion-expiracion').value;
    const payload = { usuario_id: usuario.id, curso_id };
    if (expiracion) payload.fecha_expiracion = expiracion;

    await apiCall('inscripciones.php', 'POST', payload);
    toast('Alumno inscrito correctamente', 'success');
    closeModal('modal-inscripcion');
    await loadInscripciones();
    loadDashboard();
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

function deleteInscripcion(id) {
  confirm('¿Revocar esta inscripción?', async () => {
    try {
      await apiCall('inscripciones.php?id=' + id, 'DELETE');
      toast('Inscripción revocada', 'success');
      await loadInscripciones();
      loadDashboard();
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    }
  });
}

// ── FEED DE NOVEDADES ──────────────────────────────────────────────────
let feedPostsData = [];

async function loadFeedPage() {
  updateFeedForm();
  await loadFeedPosts();
}

function updateFeedForm() {
  const tipo = document.getElementById('feed-tipo').value;
  const label = document.getElementById('feed-contenido-label');
  const txt = document.getElementById('feed-contenido');
  if (tipo === 'social_embed') {
    label.textContent = 'Código iframe o URL de Embed';
    txt.placeholder = 'Pega el código iframe (<iframe>) o el enlace directo de Instagram, TikTok, YouTube o Spotify...';
  } else {
    label.textContent = 'Contenido / Texto del aviso';
    txt.placeholder = 'Escribe el mensaje o aviso para la comunidad...';
  }
}

async function loadFeedPosts() {
  const list = document.getElementById('feed-posts-list');
  try {
    const data = await apiCall('feed.php');
    feedPostsData = (data || []).filter(p => p.tipo !== 'cancion');
    if (feedPostsData.length === 0) {
      list.innerHTML = '<p class="ml" style="padding:24px;text-align:center;">No hay publicaciones aún.</p>';
      return;
    }
    list.innerHTML = feedPostsData.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);gap:12px;">
        <div style="flex:1;min-width:0;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:8px;color:var(--muted);text-transform:uppercase;">${p.tipo} · ${fmtDate(p.created_at)}</span>
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.titulo}</div>
        </div>
        <button onclick="deleteFeedPost(${p.id})" style="background:transparent;border:none;cursor:pointer;color:var(--accent);flex-shrink:0;padding:4px;">
          <i class="fas fa-trash" style="font-size:13px;"></i>
        </button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="ml" style="padding:24px;text-align:center;">Error al cargar.</p>';
  }
}

async function deleteFeedPost(id) {
  confirm('¿Eliminar esta publicación del feed?', async () => {
    try {
      await apiCall('feed.php?id=' + id, 'DELETE');
      toast('Publicación eliminada', 'success');
      loadFeedPosts();
    } catch (err) { toast('Error: ' + err.message, 'error'); }
  });
}

async function publishFeedPost() {
  const tipo = document.getElementById('feed-tipo').value;
  const titulo = document.getElementById('feed-titulo').value.trim();
  const contenido = document.getElementById('feed-contenido').value.trim();
  if (!titulo) { toast('El título es obligatorio', 'error'); return; }
  const payload = { tipo, titulo };
  if (tipo === 'social_embed') { payload.embed_code = contenido; }
  else { payload.descripcion = contenido; }
  try {
    await apiCall('feed.php', 'POST', payload);
    toast('Publicado en el feed ✓', 'success');
    document.getElementById('feed-titulo').value = '';
    document.getElementById('feed-contenido').value = '';
    loadFeedPosts();
  } catch (err) { toast('Error: ' + err.message, 'error'); }
}

// ── TOP MÚSICA ─────────────────────────────────────────────────────────
async function loadTopMusicaPage() {
  await Promise.all([loadConfigMusica(), loadHistoricalSongs()]);
}

async function loadConfigMusica() {
  try {
    const config = await apiCall('configuraciones.php');
    const song = config.cancion_semana || null;
    const actualEl = document.getElementById('config-cancion-actual');
    if (song && song.titulo) {
      document.getElementById('config-cancion-titulo').textContent = song.titulo;
      document.getElementById('config-cancion-artista').textContent = song.artista || '—';
      actualEl.style.display = 'block';
      document.getElementById('config-song-titulo').value = song.titulo;
      document.getElementById('config-song-artista').value = song.artista || '';
      document.getElementById('config-song-url').value = song.url_audio || '';
    } else {
      actualEl.style.display = 'none';
      document.getElementById('config-song-titulo').value = '';
      document.getElementById('config-song-artista').value = '';
      document.getElementById('config-song-url').value = '';
    }
  } catch (err) { console.error(err); }
}

async function saveCancionSemana() {
  const titulo = document.getElementById('config-song-titulo').value.trim();
  const artista = document.getElementById('config-song-artista').value.trim();
  if (!titulo || !artista) { toast('Título y artista son obligatorios', 'error'); return; }

  let url_audio = document.getElementById('config-song-url').value.trim();
  const audioFile = document.getElementById('config-song-file').files[0];
  if (audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    try {
      const upRes = await fetch('api/upload.php?tipo=audio', { method: 'POST', body: formData });
      const upData = await upRes.json();
      if (upData.url) url_audio = upData.url;
    } catch (e) { toast('No se pudo subir el audio', 'error'); return; }
  }

  if (!url_audio) { toast('Sube un archivo o ingresa la URL del audio', 'error'); return; }

  try {
    await apiCall('configuraciones.php', 'POST', { clave: 'cancion_semana', valor: { titulo, artista, url_audio } });
    toast('Canción de la semana actualizada ✓', 'success');
    document.getElementById('config-song-file').value = '';
    await loadTopMusicaPage();
  } catch (err) { toast('Error: ' + err.message, 'error'); }
}

async function loadHistoricalSongs() {
  const list = document.getElementById('historical-songs-list');
  try {
    const data = await apiCall('feed.php');
    const songs = (data || []).filter(p => p.tipo === 'cancion');
    if (songs.length === 0) {
      list.innerHTML = '<p class="ml" style="padding:24px;text-align:center;">No hay canciones en el historial.</p>';
      return;
    }
    list.innerHTML = songs.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line);gap:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.titulo}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);text-transform:uppercase;">${p.descripcion || '—'}</div>
        </div>
        <button onclick="deleteHistoricalSong(${p.id})" style="background:transparent;border:none;cursor:pointer;color:var(--accent);flex-shrink:0;padding:4px;">
          <i class="fas fa-trash" style="font-size:13px;"></i>
        </button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="ml" style="padding:24px;text-align:center;">Error al cargar historial.</p>';
  }
}

async function deleteHistoricalSong(id) {
  confirm('¿Eliminar esta canción del historial?', async () => {
    try {
      await apiCall('feed.php?id=' + id, 'DELETE');
      toast('Canción eliminada del historial', 'success');
      loadHistoricalSongs();
    } catch (err) { toast('Error: ' + err.message, 'error'); }
  });
}

// ── TOP CUENTAS ────────────────────────────────────────────────────────
let redesData = [];

async function loadTopCuentasPage() {
  try {
    const config = await apiCall('configuraciones.php');
    redesData = config.top_redes || [];
    renderRedesList();
  } catch (err) { console.error(err); }
}

function renderRedesList() {
  const container = document.getElementById('redes-list');
  if (!redesData.length) {
    container.innerHTML = '<p class="ml" style="padding:12px 0; text-align:center;">No hay cuentas. Usa + Añadir Cuenta.</p>';
    return;
  }
  container.innerHTML = redesData.map((red, idx) => `
    <div style="border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: rgba(0, 0, 0, 0.02); display: flex; flex-direction: column; gap: 12px; position: relative;">
      <!-- Eliminar cuenta -->
      <button onclick="redesData.splice(${idx},1);renderRedesList()" style="position: absolute; top: 12px; right: 12px; background:transparent; border:none; cursor:pointer; color:var(--accent); padding:4px;">
        <i class="fas fa-trash"></i>
      </button>

      <!-- Username & Nombre -->
      <div class="form-grid" style="gap: 12px;">
        <div class="form-group">
          <label>Username</label>
          <input type="text" value="${red.username || ''}" oninput="redesData[${idx}].username=this.value" placeholder="@cuenta">
        </div>
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" value="${red.nombre || ''}" oninput="redesData[${idx}].nombre=this.value" placeholder="Nombre visible">
        </div>
      </div>

      <!-- Descripción & Plataforma -->
      <div class="form-grid" style="gap: 12px;">
        <div class="form-group">
          <label>Descripción</label>
          <input type="text" value="${red.descripcion || ''}" oninput="redesData[${idx}].descripcion=this.value" placeholder="Descripción corta">
        </div>
        <div class="form-group">
          <label>Plataforma</label>
          <select onchange="redesData[${idx}].plataforma=this.value" style="background:transparent; border:none; border-bottom:1px solid var(--line); width:100%; color:var(--ink); padding:8px 0;">
            <option value="instagram" ${(red.plataforma||'instagram')==='instagram'?'selected':''}>Instagram</option>
            <option value="tiktok" ${red.plataforma==='tiktok'?'selected':''}>TikTok</option>
            <option value="youtube" ${red.plataforma==='youtube'?'selected':''}>YouTube</option>
          </select>
        </div>
      </div>

      <!-- Enlace -->
      <div class="form-group">
        <label>URL de enlace</label>
        <input type="url" value="${red.url || ''}" oninput="redesData[${idx}].url=this.value" placeholder="https://...">
      </div>

      <!-- Avatar -->
      <div class="form-group">
        <label>Avatar URL</label>
        <input type="url" value="${red.avatar_url || ''}" oninput="redesData[${idx}].avatar_url=this.value" placeholder="https://...">
      </div>
    </div>
  `).join('');
}

function addRedRow() {
  redesData.unshift({ username: '', nombre: '', descripcion: '', url: '', avatar_url: '', plataforma: 'instagram' });
  renderRedesList();
}

async function saveTopRedes() {
  try {
    await apiCall('configuraciones.php', 'POST', { clave: 'top_redes', valor: redesData });
    toast('Cuentas guardadas ✓', 'success');
  } catch (err) { toast('Error: ' + err.message, 'error'); }
}

// ── LOGOUT ──────────────────────────────────────────────────────────────
async function handleLogout() {
  try {
    await apiCall('auth.php?action=logout');
  } catch (e) {}
  window.location.href = 'index.html';
}

// ── SIDEBAR TOGGLE (Desktop Collapse & Mobile Drawer) ──────────────────
const sidebar = document.getElementById('app-sidebar');
const overlay = document.getElementById('sidebar-overlay');
const btnToggle = document.getElementById('btn-toggle');

function isMobile() { return window.innerWidth <= 768; }

function openDrawer() {
  overlay.style.display = 'block';
  requestAnimationFrame(() => overlay.classList.add('open'));
  sidebar.classList.add('drawer-open');
}

function closeDrawer() {
  overlay.classList.remove('open');
  sidebar.classList.remove('drawer-open');
  setTimeout(() => { overlay.style.display = 'none'; }, 250);
}

btnToggle.addEventListener('click', () => {
  if (isMobile()) {
    sidebar.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
  } else {
    document.body.classList.toggle('collapsed');
  }
});

overlay.addEventListener('click', closeDrawer);

// ── BOOT ───────────────────────────────────────────────────────────────
window.addEventListener('load', initApp);
