// index.js - TRD 2026 Authentication Router

document.addEventListener('DOMContentLoaded', () => {
  const btnManualFlow = document.getElementById('btn-manual-flow');
  const initialView = document.getElementById('initial-view');
  const manualView = document.getElementById('manual-view');
  const btnBackInitial = document.getElementById('btn-back-initial');

  // Tab Switching
  const tabs = document.querySelectorAll('.tab-btn');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  if (btnManualFlow) {
    btnManualFlow.addEventListener('click', () => {
      initialView.classList.add('hidden');
      manualView.classList.remove('hidden');
    });
  }

  if (btnBackInitial) {
    btnBackInitial.addEventListener('click', () => {
      manualView.classList.add('hidden');
      initialView.classList.remove('hidden');
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const target = tab.getAttribute('data-tab');
      if (target === 'login') {
        formLogin.classList.remove('hidden');
        formRegister.classList.add('hidden');
      } else {
        formRegister.classList.remove('hidden');
        formLogin.classList.add('hidden');
      }
    });
  });

  // Toast notifications helper
  function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
      <span>${msg}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Handle Manual Login Submit
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value.trim();
      const submitBtn = formLogin.querySelector('.submit-btn');

      if (!email || !password) {
        showToast('Por favor rellene todos los campos.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>INGRESANDO...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const res = await fetch('api/registro.php?action=login_manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');

        showToast('¡Ingreso exitoso!', 'success');
        
        // Guardar email en sessionStorage
        sessionStorage.setItem('trd_user_email', data.email);
        sessionStorage.setItem('trd_user_nombre', data.nombre);
        sessionStorage.setItem('trd_user_apellido', data.apellido);

        setTimeout(() => {
          if (data.registrado) {
            window.location.href = `pagos.html?email=${encodeURIComponent(data.email)}`;
          } else {
            window.location.href = `inscripcion.html?email=${encodeURIComponent(data.email)}&nombre=${encodeURIComponent(data.nombre)}&apellido=${encodeURIComponent(data.apellido)}`;
          }
        }, 1000);
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>INGRESAR</span>';
      }
    });
  }

  // Handle Manual Register Submit
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('reg-nombre').value.trim();
      const apellido = document.getElementById('reg-apellido').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value.trim();
      const confirmPassword = document.getElementById('reg-confirm-password').value.trim();
      const submitBtn = formRegister.querySelector('.submit-btn');

      if (!nombre || !apellido || !email || !password || !confirmPassword) {
        showToast('Todos los campos son obligatorios.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showToast('Las contraseñas no coinciden.', 'error');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>REGISTRANDO...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const res = await fetch('api/registro.php?action=register_manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, apellido, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al registrarse');

        showToast('¡Registro de cuenta exitoso!', 'success');
        
        sessionStorage.setItem('trd_user_email', data.email);
        sessionStorage.setItem('trd_user_nombre', data.nombre);
        sessionStorage.setItem('trd_user_apellido', data.apellido);

        setTimeout(() => {
          window.location.href = `inscripcion.html?email=${encodeURIComponent(data.email)}&nombre=${encodeURIComponent(data.nombre)}&apellido=${encodeURIComponent(data.apellido)}`;
        }, 1000);
      } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>CREAR CUENTA</span>';
      }
    });
  }

  // Google Authentication Callback
  window.handleCredentialResponse = async (response) => {
    try {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const email = payload.email;
      const given_name = payload.given_name || '';
      const family_name = payload.family_name || '';
      const picture = payload.picture || '';

      // Guardar avatar
      sessionStorage.setItem('trd_google_avatar', picture);

      // Consultar estado en el backend
      const res = await fetch(`api/registro.php?action=check_status&email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Error al conectar con el servidor');
      const status = await res.json();

      sessionStorage.setItem('trd_user_email', email);
      sessionStorage.setItem('trd_user_nombre', given_name);
      sessionStorage.setItem('trd_user_apellido', family_name);

      if (status.registrado) {
        window.location.href = `pagos.html?email=${encodeURIComponent(email)}`;
      } else {
        window.location.href = `inscripcion.html?email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(given_name)}&apellido=${encodeURIComponent(family_name)}`;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Google client initialization helper
  window.initializeGoogle = () => {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: "894522360681-pfuptfhtithl6kb28uj9mci3i5hbdk5k.apps.googleusercontent.com",
        callback: window.handleCredentialResponse
      });
      google.accounts.id.renderButton(
        document.getElementById("google-btn-container"),
        { theme: "outline", size: "large", width: "100%" }
      );
    }
  };

  // Initialize Google client if library is ready
  if (typeof google !== 'undefined') {
    window.initializeGoogle();
  }
});
