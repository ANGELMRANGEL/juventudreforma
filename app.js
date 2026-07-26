// Local Auth & App Logic (MySQL/PHP API)

let currentUser = null;
let userRole = 'alumno';
let isRedirecting = false;
let isAuthLoading = true;

// ── HELPERS DE ERROR ─────────────────────────────────────────────
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; }
}
function clearErr(...ids) {
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
}

function updateProfileProgress() {
  const fields = [
    'perfil-nombre', 'perfil-apellido', 'perfil-cedula', 
    'perfil-fecha', 'perfil-whatsapp', 'perfil-pais', 'perfil-ciudad'
  ];
  let filled = 0;
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el && el.value.trim() !== '') {
      filled++;
    }
  });
  const pct = Math.round((filled / fields.length) * 100);
  const fill = document.querySelector('#profile-progress .progress-fill');
  const txt = document.getElementById('progress-text');
  if (fill) fill.style.width = pct + '%';
  if (txt) txt.textContent = pct + '% COMPLETADO';
}

document.addEventListener('input', (e) => {
  if (e.target.id && e.target.id.startsWith('perfil-')) {
    updateProfileProgress();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id && e.target.id.startsWith('perfil-')) {
    updateProfileProgress();
  }
});

// Helper para llamadas a la API
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch('api/' + endpoint, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Operación fallida');
  }
  return res.json();
}

// ── ROUTING ───────────────────────────────────────────────────────
const routes = {
  '': 'page-landing', '#': 'page-landing', '#/': 'page-landing',
  '#/registro': 'page-registro', '#/login': 'page-login',
  '#/recuperar': 'page-recuperar', '#/nueva-contrasena': 'page-nueva-contrasena',
  '#/completar-perfil': 'page-completar-perfil', '#/cursos': 'page-cursos',
  '#/visor': 'page-visor', '#/ajustes': 'page-ajustes'
};

function checkRouteAccess() {
  if (isAuthLoading) return;
  const hash = window.location.hash || '';
  const targetId = routes[hash] || 'page-landing';

  if ((hash === '#/cursos' || hash === '#/visor') && !currentUser) {
    window.location.hash = '#/login';
    return;
  }

  if (hash === '#/completar-perfil' && currentUser) {
    const nombreInput = document.getElementById('perfil-nombre');
    const apellidoInput = document.getElementById('perfil-apellido');
    if (nombreInput && !nombreInput.value) {
      nombreInput.value = currentUser.nombre || '';
    }
    if (apellidoInput && !apellidoInput.value) {
      apellidoInput.value = currentUser.apellido || '';
    }
    setTimeout(updateProfileProgress, 100);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (document.getElementById(targetId)) document.getElementById(targetId).classList.add('active');

  if (hash && !hash.startsWith('#/')) {
    try {
      const el = document.querySelector(hash);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 50);
        return;
      }
    } catch (e) {}
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', checkRouteAccess);

// ── 2. CARGA INICIAL ──────────────────────────────────────────────
(async () => {
  try {
    const sessionData = await apiCall('auth.php?action=session');
    const session = sessionData?.session;
    if (session) {
      currentUser = session.user;
      
      // Obtener perfil detallado
      try {
        const perfil = await apiCall('usuarios.php?id=' + currentUser.id);
        currentUser = { ...currentUser, ...perfil };
        userRole = perfil.rol || 'alumno';
      } catch (err) {
        userRole = currentUser.rol || 'alumno';
      }

      const nameEl = document.getElementById('user-name-display');
      if (nameEl) nameEl.textContent = currentUser.nombre || 'REFORMADOR';

      const hash = window.location.hash || '';
      const publicPages = ['', '#', '#/', '#/login', '#/registro', '#/recuperar', '#/nueva-contrasena'];
      if (publicPages.includes(hash)) {
        isRedirecting = true;
        isAuthLoading = false;
        window.location.href = 'dashboard.html';
        return;
      }
    }
  } catch (e) {
    console.error('Error en carga inicial:', e);
  }
  isAuthLoading = false;
  checkRouteAccess();
})();

// ── 4. REGISTRO (email/contraseña) ────────────────────────────────
document.getElementById('form-registro')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErr('err-email', 'err-password', 'err-password2');

  const btnReg = document.getElementById('btn-registro');
  const origBtnText = btnReg ? btnReg.textContent : 'CREAR MI CUENTA';
  if (btnReg) { btnReg.disabled = true; btnReg.textContent = 'CREANDO CUENTA...'; }

  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-password').value;
  const pass2 = document.getElementById('reg-password2').value;

  if (pass !== pass2) {
    showErr('err-password2', 'Las contraseñas no coinciden.');
    if (btnReg) { btnReg.disabled = false; btnReg.textContent = origBtnText; }
    return;
  }
  if (pass.length < 6) {
    showErr('err-password', 'Mínimo 6 caracteres.');
    if (btnReg) { btnReg.disabled = false; btnReg.textContent = origBtnText; }
    return;
  }

  try {
    const data = await apiCall('auth.php?action=signup', 'POST', { email, password: pass });
    if (data.user) {
      currentUser = data.user;
      window.location.hash = '#/completar-perfil';
    } else {
      showErr('err-email', 'Error al registrar usuario.');
      if (btnReg) { btnReg.disabled = false; btnReg.textContent = origBtnText; }
    }
  } catch (err) {
    console.error('Registro error:', err);
    showErr('err-email', err.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.');
    if (btnReg) { btnReg.disabled = false; btnReg.textContent = origBtnText; }
  }
});

// ── 5. LOGIN (email/contraseña) ───────────────────────────────────
document.getElementById('form-login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErr('err-login-email', 'err-login-password');

  const btn = document.getElementById('btn-login');
  const originalText = btn ? btn.textContent : 'INICIAR SESIÓN';
  if (btn) { btn.disabled = true; btn.textContent = 'VERIFICANDO...'; }

  isRedirecting = true;

  try {
    const data = await apiCall('auth.php?action=login', 'POST', {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value
    });

    if (btn) { btn.textContent = 'ENTRANDO...'; }

    currentUser = data.user;
    userRole = data.user.rol || 'alumno';
    window.location.href = 'dashboard.html';

  } catch (err) {
    isRedirecting = false;
    console.error('Login error:', err);
    showErr('err-login-password', 'Credenciales inválidas. Verifica tu correo y contraseña.');
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
});

// Callback al recibir credenciales de Google
async function handleCredentialResponse(response) {
  try {
    const data = await apiCall('auth.php?action=google', 'POST', {
      token: response.credential
    });
    if (data.user) {
      currentUser = data.user;
      userRole = data.user.rol || 'alumno';
      
      // Si el nombre no está completo, pedir completar perfil
      if (!currentUser.nombre) {
        window.location.hash = '#/completar-perfil';
      } else {
        window.location.href = 'dashboard.html';
      }
    }
  } catch (err) {
    console.error('Google login error:', err);
    showToast('Error al iniciar sesión con Google: ' + (err.message || err), 'error');
  }
}

// Inicializar Google Identity Services
window.addEventListener('load', async () => {
  if (typeof google !== 'undefined') {
    try {
      google.accounts.id.initialize({
        client_id: '894522360681-pfuptfhtithl6kb28uj9mci3i5hbdk5k.apps.googleusercontent.com',
        callback: handleCredentialResponse
      });

      const btnConfig = {
        theme: 'outline',
        size: 'large',
        width: '360',
        text: 'none',
        shape: 'pill'
      };

      const btnConfigHero = {
        theme: 'filled_black',
        size: 'large',
        width: '380',
        text: 'signin_with',
        shape: 'pill'
      };

      const heroEl = document.getElementById('google-btn-hero');
      if (heroEl) google.accounts.id.renderButton(heroEl, btnConfigHero);

      const regEl = document.getElementById('google-btn-registro');
      if (regEl) google.accounts.id.renderButton(regEl, btnConfig);

      const loginEl = document.getElementById('google-btn-login');
      if (loginEl) google.accounts.id.renderButton(loginEl, btnConfig);

      // Activar One Tap automático
      google.accounts.id.prompt();
    } catch (e) {
      console.error('Error al iniciar Google Auth:', e);
    }
  }
});

// ── PERFIL SUBMIT ───────────────────────────────────────────────────
document.getElementById('form-perfil')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btnPerfil = document.getElementById('btn-guardar-perfil');
  const origPerfilText = btnPerfil ? btnPerfil.textContent : 'GUARDAR Y ENTRAR';
  if (btnPerfil) { btnPerfil.disabled = true; btnPerfil.textContent = 'GUARDANDO...'; }

  if (!currentUser) {
    await new Promise(r => setTimeout(r, 2000));
  }
  if (!currentUser) {
    showErr('err-perfil-nombre', 'Tu sesión expiró. Recarga la página e intenta de nuevo.');
    if (btnPerfil) { btnPerfil.disabled = false; btnPerfil.textContent = origPerfilText; }
    return;
  }

  const nombre = document.getElementById('perfil-nombre').value.trim();
  const apellido = document.getElementById('perfil-apellido').value.trim();
  if (!nombre) { showErr('err-perfil-nombre', 'El nombre es obligatorio.'); if (btnPerfil) { btnPerfil.disabled = false; btnPerfil.textContent = origPerfilText; } return; }
  if (!apellido) { showErr('err-perfil-apellido', 'El apellido es obligatorio.'); if (btnPerfil) { btnPerfil.disabled = false; btnPerfil.textContent = origPerfilText; } return; }

    const whatsapp = document.getElementById('perfil-whatsapp').value.trim();
  if (!whatsapp) { showErr('err-perfil-whatsapp', 'El WhatsApp es obligatorio.'); if (btnPerfil) { btnPerfil.disabled = false; btnPerfil.textContent = origPerfilText; } return; }

  const payload = {
    id: currentUser.id,
    email: currentUser.email,
    nombre,
    apellido,
    cedula: document.getElementById('perfil-cedula').value.trim(),
    fecha_nacimiento: document.getElementById('perfil-fecha').value || null,
    telefono: whatsapp,
    whatsapp: whatsapp,
    pais: document.getElementById('perfil-pais').value,
    ciudad: document.getElementById('perfil-ciudad').value.trim(),
    nivel_estudios: document.getElementById('perfil-nivel')?.value || null,
    ocupacion: document.getElementById('perfil-ocupacion')?.value.trim() || null,
    motivacion: document.getElementById('perfil-motivacion')?.value.trim() || null,
    rol: 'alumno'
  };

  try {
    const data = await apiCall('usuarios.php', 'POST', payload);
    currentUser = { ...currentUser, ...data };
    window.location.href = 'dashboard.html';
  } catch (err) {
    console.error('Perfil submit error:', err);
    showErr('err-perfil-nombre', 'Error al guardar el perfil. Inténtalo de nuevo.');
    if (btnPerfil) { btnPerfil.disabled = false; btnPerfil.textContent = origPerfilText; }
  }
});

// ── 5. LOGICA ADMIN FALLBACK / ADICIONAL ─────────────────────────────
async function initAdminPanel() {
  try {
    const cursos = await apiCall('cursos.php');
    const sl = document.getElementById('leccion-curso-id');
    const si = document.getElementById('inscripcion-curso-id');
    const lc = document.getElementById('lista-cursos-admin');
    if (sl) sl.innerHTML = cursos.map(c => `<option value="${c.id}">${c.titulo}</option>`).join('');
    if (si) si.innerHTML = sl.innerHTML;
    if (lc) lc.innerHTML = cursos.map(c => `<div style="padding:10px; border-bottom:1px solid #ddd;">${c.titulo}</div>`).join('');

    const prog = await apiCall('progreso.php?action=vista_progreso');
    const userList = await apiCall('usuarios.php');
    const body = document.getElementById('monitor-table-body');
    if (body && prog) {
      body.innerHTML = prog.map(p => {
        const u = userList.find(x => x.id === p.usuario_id);
        return `<tr><td>${u?.nombre || 'N/A'}</td><td>${u?.email || 'N/A'}</td><td>${p.nombre_curso}</td><td>${Math.round(p.porcentaje_progreso)}%</td><td>${p.lecciones_completadas}/${p.total_lecciones}</td></tr>`;
      }).join('');
    }
    document.getElementById('stat-total-cursos').textContent = cursos.length;
  } catch (err) {
    console.error('Error al inicializar panel administrativo:', err);
  }
}

document.getElementById('btn-crear-curso')?.addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    await apiCall('cursos.php', 'POST', { titulo: document.getElementById('curso-titulo').value });
    initAdminPanel();
  } catch (err) {
    console.error('Error al crear curso:', err);
  }
});

document.getElementById('btn-crear-leccion')?.addEventListener('click', async () => {
  try {
    await apiCall('lecciones.php', 'POST', {
      curso_id: document.getElementById('leccion-curso-id').value,
      titulo: document.getElementById('leccion-titulo').value,
      youtube_id: document.getElementById('leccion-youtube-id').value
    });
    showToast('Lección añadida con éxito', 'success');
  } catch (err) {
    console.error('Error al crear lección:', err);
  }
});

document.getElementById('form-inscripcion-manual')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const email = document.getElementById('inscripcion-email').value;
    const u = await apiCall('usuarios.php?email=' + encodeURIComponent(email));
    if (!u) { showToast('Usuario no encontrado', 'error'); return; }
    await apiCall('inscripciones.php', 'POST', {
      usuario_id: u.id,
      curso_id: document.getElementById('inscripcion-curso-id').value
    });
    showToast('Alumno inscrito con éxito', 'success');
  } catch (err) {
    console.error('Error al inscribir alumno:', err);
    showToast('Error al inscribir alumno', 'error');
  }
});

document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
  try {
    await apiCall('auth.php?action=logout');
  } catch (e) {}
  window.location.href = 'index.html';
});

// ── 6. RECUPERAR CONTRASEÑA ───────────────────────────────────────
document.getElementById('form-recuperar')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-recuperar');
  const email = document.getElementById('recuperar-email').value.trim();
  const errEl = document.getElementById('err-recuperar-email');
  const successEl = document.getElementById('recuperar-success');

  errEl.textContent = '';
  successEl.style.display = 'none';

  if (!email) { errEl.textContent = 'Ingresa tu email.'; return; }

  btn.disabled = true;
  btn.textContent = 'ENVIANDO...';

  // Mostrar mensaje de éxito simulado por cuestiones de configuración de email
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'ENVIAR ENLACE';
    successEl.style.display = 'block';
    document.getElementById('recuperar-email').value = '';
  }, 1000);
});

// ── 7. NUEVA CONTRASEÑA ──────────────────────────────────────────
document.getElementById('form-nueva-contrasena')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-nueva-pass');
  const pass = document.getElementById('nueva-pass').value;
  const pass2 = document.getElementById('nueva-pass2').value;
  const err1 = document.getElementById('err-nueva-pass');
  const err2 = document.getElementById('err-nueva-pass2');

  err1.textContent = '';
  err2.textContent = '';

  if (pass.length < 6) { err1.textContent = 'Mínimo 6 caracteres.'; return; }
  if (pass !== pass2) { err2.textContent = 'Las contraseñas no coinciden.'; return; }

  btn.disabled = true;
  btn.textContent = 'GUARDANDO...';

  try {
    await apiCall('auth.php?action=update_password', 'POST', { password: pass });
    btn.textContent = '✓ CONTRASEÑA ACTUALIZADA';
    btn.style.background = '#22c55e';
    setTimeout(async () => {
      await apiCall('auth.php?action=logout');
      window.location.hash = '#/login';
    }, 1800);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'GUARDAR CONTRASEÑA';
    err1.textContent = 'No se pudo actualizar la contraseña. Inténtalo de nuevo.';
  }
});