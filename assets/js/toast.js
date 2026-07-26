// Sistema de Toast Centralizado (Fondo negro con iconos FontAwesome)
window.toast = function(message, type = 'info') {
  // Buscar o crear el contenedor (soporta toast-container y toast-root)
  let container = document.getElementById('toast-container') || document.getElementById('toast-root');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  // Crear elemento toast
  const toastEl = document.createElement('div');
  // Normalizar el tipo para el CSS
  const t = type === 'success' ? 'success' : (type === 'error' ? 'error' : (type === 'warn' || type === 'warning' ? 'warning' : 'info'));
  toastEl.className = `toast toast-${t}`;

  // Seleccionar icono de FontAwesome según el tipo
  let iconClass = 'fa-solid fa-circle-info';
  if (t === 'success') iconClass = 'fa-solid fa-circle-check';
  if (t === 'error') iconClass = 'fa-solid fa-circle-exclamation';
  if (t === 'warning') iconClass = 'fa-solid fa-triangle-exclamation';

  toastEl.innerHTML = `
    <i class="${iconClass} toast-icon"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Cerrar">&times;</button>
  `;

  container.appendChild(toastEl);

  // Botón de cerrar
  toastEl.querySelector('.toast-close').addEventListener('click', () => {
    toastEl.classList.remove('toast-show');
    toastEl.classList.add('toast-fade-out');
    toastEl.addEventListener('transitionend', () => toastEl.remove());
  });

  // Animación de entrada
  requestAnimationFrame(() => {
    toastEl.classList.add('toast-show');
  });

  // Auto-eliminar
  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.classList.remove('toast-show');
      toastEl.classList.add('toast-fade-out');
      toastEl.addEventListener('transitionend', () => toastEl.remove());
    }
  }, 4000);
};

// Mantener compatibilidad con showToast
window.showToast = window.toast;
