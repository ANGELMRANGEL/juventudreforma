// inscripcion.js - TRD 2026 Registration Wizard Logic

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registro-form');
  const submitBtn = document.getElementById('submit-btn');
  const planRadios = document.querySelectorAll('input[name="plan_pago"]');
  const terminosBox = document.getElementById('terminos-financiamiento-box');
  const aceptaTerminos = document.getElementById('acepta_terminos');

  // Steps Navigation
  let currentStep = 1;
  const totalSteps = 5;
  const steps = document.querySelectorAll('.form-step');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const progressLine = document.getElementById('progress-line');
  const stepDots = document.querySelectorAll('.step-dot');

  const sedesNombres = {
    '1': 'Maracay - Sede La Fuente',
    '2': 'Tinaquillo - Sede Cojedes',
    '3': 'El Tigre - Sede Visión Profética'
  };

  // Parse URL Parameters
  const urlParams = new URLSearchParams(window.location.search);
  const paramEmail = urlParams.get('email') || sessionStorage.getItem('trd_user_email') || '';
  const paramNombre = urlParams.get('nombre') || sessionStorage.getItem('trd_user_nombre') || '';
  const paramApellido = urlParams.get('apellido') || sessionStorage.getItem('trd_user_apellido') || '';

  if (paramEmail) {
    document.getElementById('email').value = paramEmail;
  }
  if (paramNombre) {
    document.getElementById('nombre').value = paramNombre;
  }
  if (paramApellido) {
    document.getElementById('apellido').value = paramApellido;
  }

  // Pastor / Red de servicio - lógica de toggle
  const redSelect = document.getElementById('red_pastoral_select');
  const redTextContainer = document.getElementById('otro-pastor-container');
  const redInput = document.getElementById('red_pastoral');

  // Estado inicial: input libre visible, select oculto
  function initPastorFields() {
    if (redSelect) {
      redSelect.style.display = 'none';
      redSelect.disabled = true;
      redSelect.removeAttribute('name');
      redSelect.removeAttribute('required');
    }
    if (redInput) {
      redInput.style.display = 'block';
      redInput.disabled = false;
      redInput.setAttribute('name', 'red_pastoral');
      redInput.setAttribute('required', 'required');
    }
  }

  function showPastorSelect() {
    if (redSelect) {
      redSelect.style.display = 'block';
      redSelect.disabled = false;
      redSelect.setAttribute('name', 'red_pastoral');
      redSelect.setAttribute('required', 'required');
    }
    if (redInput) {
      redInput.style.display = 'none';
      redInput.disabled = true;
      redInput.removeAttribute('name');
      redInput.removeAttribute('required');
    }
    if (redTextContainer) redTextContainer.classList.add('hidden');
  }

  function showPastorInput() {
    if (redSelect) {
      redSelect.style.display = 'none';
      redSelect.disabled = true;
      redSelect.removeAttribute('name');
      redSelect.removeAttribute('required');
    }
    if (redInput) {
      redInput.style.display = 'block';
      redInput.disabled = false;
      redInput.setAttribute('name', 'red_pastoral');
      redInput.setAttribute('required', 'required');
    }
  }

  initPastorFields();

  if (redSelect) {
    redSelect.addEventListener('change', () => {
      if (redSelect.value === 'Otra Red') {
        if (redTextContainer) redTextContainer.classList.remove('hidden');
        if (redInput) {
          redInput.disabled = false;
          redInput.setAttribute('required', 'required');
          redInput.value = '';
        }
      } else {
        if (redTextContainer) redTextContainer.classList.add('hidden');
        if (redInput) {
          redInput.removeAttribute('required');
          redInput.value = redSelect.value;
        }
      }
    });
  }

  // plan update UI
  function updatePlanUI() {
    const selectedPlan = document.querySelector('input[name="plan_pago"]:checked').value;
    if (selectedPlan === 'Financiado') {
      if (terminosBox) terminosBox.classList.remove('hidden');
    } else {
      if (terminosBox) terminosBox.classList.add('hidden');
      if (aceptaTerminos) aceptaTerminos.checked = false;
    }
  }

  planRadios.forEach(radio => {
    radio.addEventListener('change', updatePlanUI);
  });
  updatePlanUI();

  // Progress Bar update
  function updateProgress() {
    const pct = ((currentStep - 1) / (totalSteps - 1)) * 100;
    if (progressLine) progressLine.style.width = pct + '%';

    stepDots.forEach((dot, idx) => {
      const stepNum = idx + 1;
      dot.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        dot.classList.add('active');
      } else if (stepNum < currentStep) {
        dot.classList.add('completed');
      }
    });

    if (currentStep === 1) {
      prevBtn.style.visibility = 'hidden';
    } else {
      prevBtn.style.visibility = 'visible';
    }

    if (currentStep === totalSteps) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'inline-flex';
    }
  }

  // Display Step
  function showStep(stepNum) {
    steps.forEach(step => {
      step.classList.remove('active');
    });
    const currentStepEl = document.querySelector(`.form-step[data-step="${stepNum}"]`);
    if (currentStepEl) currentStepEl.classList.add('active');
    currentStep = stepNum;
    updateProgress();
  }

  // Validate fields for a step
  function validateStep(stepNum) {
    const stepEl = document.querySelector(`.form-step[data-step="${stepNum}"]`);
    if (!stepEl) return true;
    const inputs = stepEl.querySelectorAll('input[required], select[required]');
    let isValid = true;

    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        if (!input.checked) {
          isValid = false;
          input.classList.add('error');
        } else {
          input.classList.remove('error');
        }
      } else {
        if (input.value.trim() === '') {
          isValid = false;
          input.classList.add('error');
        } else {
          input.classList.remove('error');
        }
      }
    });

    if (stepNum === 2) {
      const emailInput = document.getElementById('email');
      if (emailInput && !emailInput.checkValidity()) {
        isValid = false;
        emailInput.classList.add('error');
        showToast('Por favor ingrese un correo electrónico válido.', 'error');
      }
    }

    return isValid;
  }

  // Populate Resumen Step
  function populateResumen() {
    const sedeVal = document.querySelector('input[name="evento_id"]:checked').value;
    document.getElementById('resumen-sede').textContent = sedesNombres[sedeVal] || 'Sede';
    
    document.getElementById('resumen-nombre').textContent = `${document.getElementById('nombre').value} ${document.getElementById('apellido').value}`;
    document.getElementById('resumen-cedula').textContent = document.getElementById('cedula').value;
    document.getElementById('resumen-email').textContent = document.getElementById('email').value;
    document.getElementById('resumen-whatsapp').textContent = document.getElementById('whatsapp').value;
    document.getElementById('resumen-edad').textContent = document.getElementById('edad').value || '-';
    document.getElementById('resumen-sexo').textContent = document.getElementById('sexo').value || '-';

    document.getElementById('resumen-iglesia').textContent = document.getElementById('congregacion').value;
    const pastorVal = document.getElementById('red_pastoral').value || document.getElementById('red_pastoral_select').value || '-';
    document.getElementById('resumen-red').textContent = pastorVal;
    document.getElementById('resumen-funcion').textContent = document.getElementById('funcion_congregacion').value;

    const planVal = document.querySelector('input[name="plan_pago"]:checked').value;
    document.getElementById('resumen-plan').textContent = planVal === 'Financiado' ? 'Plan Financiado (Cuotas)' : 'Pago Completo';
  }

  // Next Step Action
  nextBtn.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        if (currentStep + 1 === totalSteps) {
          populateResumen();
        }
        showStep(currentStep + 1);
      }
    } else {
      showToast('Por favor complete todos los campos obligatorios.', 'error');
    }
  });

  // Prev Step Action
  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      showStep(currentStep - 1);
    }
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

  // Congregación Autocomplete + toggle pastores
  const congregacionInput = document.getElementById('congregacion');
  const autocompleteList = document.getElementById('autocomplete-list');

  const donDivinoKeywords = ['don divino', 'base sucre', 'la pedrera', 'la fuente', 'manantial', 'el limón', 'tinaquillo', 'cojedes', 'tiuna', 'agua viva'];

  function checkCongregacionKeywords(val) {
    const lower = val.toLowerCase();
    const isMatch = donDivinoKeywords.some(kw => lower.includes(kw));
    if (isMatch) {
      showPastorSelect();
    } else {
      showPastorInput();
    }
  }

  if (congregacionInput && autocompleteList) {
    let debounceTimer = null;
    let abortController = null;

    congregacionInput.addEventListener('input', () => {
      const val = congregacionInput.value.trim();
      autocompleteList.innerHTML = '';
      checkCongregacionKeywords(val);

      clearTimeout(debounceTimer);
      if (abortController) abortController.abort();

      if (val.length < 3) return;

      debounceTimer = setTimeout(async () => {
        abortController = new AbortController();
        try {
          const res = await fetch(
            `api/registro.php?action=get_congregaciones&q=${encodeURIComponent(val)}`,
            { signal: abortController.signal }
          );
          if (!res.ok) return;
          const list = await res.json();

          // Predefined list of Don Divino congregations with synonyms/keywords
          const presetsData = [
            { name: 'Don Divino Base Sucre', kws: ['sucre', 'base sucre'] },
            { name: 'Don Divino La Pedrera', kws: ['pedrera', 'la pedrera'] },
            { name: 'Don Divino La Fuente', kws: ['fuente', 'la fuente'] },
            { name: 'Don Divino Manantial', kws: ['manantial', 'tiuna'] },
            { name: 'Don Divino El Limón', kws: ['limon', 'limón', 'el limón', 'agua viva'] },
            { name: 'Don Divino Tinaquillo', kws: ['tinaquillo', 'cojedes'] }
          ];

          const query = val.toLowerCase();

          // Filter presets matching the typed value or its keywords
          const matchedPresets = presetsData
            .filter(item => item.name.toLowerCase().includes(query) || item.kws.some(kw => query.includes(kw) || kw.includes(query)))
            .map(item => item.name);

          const presets = presetsData.map(item => item.name);

          // Filter database list to exclude messy variations of presets
          const branchKeywords = ['sucre', 'pedrera', 'fuente', 'manantial', 'limon', 'limón', 'tinaquillo', 'cojedes', 'tiuna', 'agua viva'];
          const cleanedList = list.filter(item => {
            const lowerItem = item.toLowerCase();
            const hasBranch = branchKeywords.some(bk => lowerItem.includes(bk));
            if (hasBranch) {
              // Only keep if it is exactly one of our presets
              return presets.some(p => p.toLowerCase() === lowerItem);
            }
            return true;
          });

          // Merge presets and cleaned results, keeping unique values
          const combined = [...new Set([...matchedPresets, ...cleanedList])];

          autocompleteList.innerHTML = '';
          combined.slice(0, 6).forEach(item => {
            const div = document.createElement('div');
            div.textContent = item;
            div.addEventListener('click', () => {
               congregacionInput.value = item;
               autocompleteList.innerHTML = '';
               checkCongregacionKeywords(item);
            });
            autocompleteList.appendChild(div);
          });
        } catch (e) {
          if (e.name !== 'AbortError') console.error('Autocomplete error:', e);
        }
      }, 300);
    });

    document.addEventListener('click', (e) => {
      if (e.target !== congregacionInput) {
        autocompleteList.innerHTML = '';
      }
    });
  }

  // Create payment prompt modal
  function mostrarPreguntaPagoModal(email) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.backdropFilter = 'blur(10px)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '9999';
    modal.style.padding = '20px';

    modal.innerHTML = `
      <div style="background: #ffffff; border: 1px solid rgba(0,0,0,0.08); border-radius: 20px; max-width: 400px; width: 100%; padding: 30px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
        <div style="margin: 0 auto 20px; width: 60px; height: 60px; border-radius: 50%; background: rgba(37, 149, 112, 0.1); color: #259570; display: flex; align-items: center; justify-content: center; font-size: 30px;">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <h3 style="margin-bottom: 10px; font-weight: 800; font-size: 18px; color: #1f2937;">¡Inscripción Registrada!</h3>
        <p style="font-size: 13px; color: #4b5563; line-height: 1.5; margin-bottom: 25px;">¿Quieres reportar tu pago de una vez y asegurar tu cupo al 100%?</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button type="button" id="btn-pago-si" class="submit-btn" style="background: #2d3e85; color: #ffffff !important; font-weight: bold; width: 100%; text-transform: uppercase; border: none; border-radius: 8px; padding: 14px; cursor: pointer;">
            <span style="color: #ffffff !important;">SÍ, REPORTAR PAGO AHORA</span>
          </button>
          <button type="button" id="btn-pago-no" style="width: 100%; border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; background: rgba(0,0,0,0.02); color: #4b5563; font-size: 11px; padding: 12px; font-weight: bold; cursor: pointer; transition: all 0.2s;">
            PAGAR LUEGO
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-pago-si').addEventListener('click', () => {
      modal.remove();
      window.location.href = `pagos.html?email=${encodeURIComponent(email)}&auto_report=1`;
    });

    modal.querySelector('#btn-pago-no').addEventListener('click', () => {
      modal.remove();
      window.location.href = `pagos.html?email=${encodeURIComponent(email)}`;
    });
  }

  // Handle Form Submit
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateStep(currentStep)) {
        showToast('Por favor complete todos los campos obligatorios.', 'error');
        return;
      }

      const email = document.getElementById('email').value.trim();

      const formData = new FormData();
      formData.append('nombre', document.getElementById('nombre').value.trim());
      formData.append('apellido', document.getElementById('apellido').value.trim());
      formData.append('cedula', document.getElementById('cedula').value.trim());
      formData.append('email', email);
      formData.append('whatsapp', document.getElementById('whatsapp').value.trim());
      formData.append('edad', document.getElementById('edad').value.trim());
      formData.append('sexo', document.getElementById('sexo').value);
      formData.append('congregacion', document.getElementById('congregacion').value.trim());
      
      const pastorVal = document.getElementById('red_pastoral').value || document.getElementById('red_pastoral_select').value;
      formData.append('red_pastoral', pastorVal.trim());
      
      formData.append('funcion_congregacion', document.getElementById('funcion_congregacion').value);
      formData.append('ciudad', document.getElementById('ciudad').value.trim());
      formData.append('evento_id', document.querySelector('input[name="evento_id"]:checked').value);
      formData.append('plan_pago', document.querySelector('input[name="plan_pago"]:checked').value);
      formData.append('codigo_promocional', document.getElementById('codigo_promocional').value.trim());
      formData.append('pagar_luego', '1'); // Siempre se inscribe para pagar después

      if (document.querySelector('input[name="plan_pago"]:checked').value === 'Financiado') {
        formData.append('acepta_terminos', aceptaTerminos.checked ? '1' : '');
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>REGISTRANDO CUPO...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const res = await fetch('api/registro.php', {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error en el registro');

        showToast(result.message, 'success');
        mostrarPreguntaPagoModal(email);
      } catch (error) {
        showToast(error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>CONFIRMAR</span>';
      }
    });
  }
});
