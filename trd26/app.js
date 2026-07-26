// app.js - TRD 2026 Registro (Multi-pasos Premium + Google Auth)

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registro-form');
  const submitBtn = document.getElementById('submit-btn');
  const planRadios = document.querySelectorAll('input[name="plan_pago"]');
  const terminosBox = document.getElementById('terminos-financiamiento-box');
  const aceptaTerminos = document.getElementById('acepta_terminos');

  // Controles de Pasos
  let currentStep = 1;
  const totalSteps = 6;
  const steps = document.querySelectorAll('.form-step');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const progressLine = document.getElementById('progress-line');
  const stepDots = document.querySelectorAll('.step-dot');
  let googleAvatarUrl = '';
  let registeredEventId = null;
  let globalTasaBCV = 0.0;

  const paymentDetails = {
    'Pago Móvil': {
      logo: '/assets/img/pmbancamiga.png',
      fields: [
        { label: 'Teléfono', value: '0424-3983556' },
        { label: 'CI', value: '27654324' },
        { label: 'Banco', value: 'Bancamiga (0172)' },
      ],
      copyAllValue: "0172\n27654324\n04243983556"
    },
    'Binance': {
      logo: '/assets/img/binance.png',
      fields: [
        { label: 'Correo', value: 'Trd.reforma@gmail.com' }
      ]
    },
    'Zinli': {
      logo: '/assets/img/zinli.png',
      fields: [
        { label: 'Correo', value: 'juventudereforma@gmail.com' }
      ]
    }
  };

  window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copiado al portapapeles', 'success');
    }).catch(err => {
      console.error('Error al copiar: ', err);
    });
  };
  let isReturningUserNoPayments = false;

  // Accordion Toggle: Google vs Manual
  const toggleManualBtn = document.getElementById('toggle-manual-btn');
  const manualFieldsContainer = document.getElementById('manual-fields-container');
  const googleAuthSection = document.getElementById('google-auth-section');

  if (toggleManualBtn && manualFieldsContainer && googleAuthSection) {
    toggleManualBtn.addEventListener('click', () => {
      if (manualFieldsContainer.style.display === 'none') {
        manualFieldsContainer.style.display = 'grid';
        googleAuthSection.style.display = 'none';
        toggleManualBtn.innerHTML = '<i class="fab fa-google" style="color: var(--accent-gold);"></i> COMPLETAR CON GOOGLE';
      } else {
        manualFieldsContainer.style.display = 'none';
        googleAuthSection.style.display = 'block';
        toggleManualBtn.innerHTML = '<i class="fa-solid fa-keyboard" style="color: var(--accent-gold);"></i> O REGISTRARSE MANUALMENTE';
      }
    });
  }

  // Nombres de Sedes para el resumen
  const sedesNombres = {
    '1': 'Maracay (16 - 17 Oct)',
    '2': 'San Carlos (30 - 31 Oct)',
    '3': 'El Tigre (13 - 16 Nov)'
  };

  // Callback al recibir credenciales de Google
  async function handleCredentialResponse(response) {
    try {
      showToast('Autenticando con Google...', 'success');
      
      const res = await fetch('../api/auth.php?action=google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error de autenticación');

      // Autocompletar inputs
      if (result.user) {
        document.getElementById('nombre').value = result.user.nombre || '';
        document.getElementById('apellido').value = result.user.apellido || '';
        document.getElementById('email').value = result.user.email || '';
        document.getElementById('cedula').value = result.user.cedula || '';
        document.getElementById('whatsapp').value = result.user.whatsapp || '';
        document.getElementById('ciudad').value = result.user.ciudad || '';
        googleAvatarUrl = result.user.avatar_url || '';
        showToast('Datos de contacto completados desde tu cuenta de Google.', 'success');
        
        // Verificar si ya está inscrito
        await checkUserEventRegistration(result.user.email);
        
        // Avanzar automáticamente al paso 2 (Sede) si no está inscrito
        const cuotasContainer = document.getElementById('pago-cuotas-container');
        if (cuotasContainer && cuotasContainer.style.display !== 'block') {
          setTimeout(() => {
            if (validateStep(currentStep)) {
              currentStep = 2;
              showStep(currentStep);
            }
          }, 1200);
        }
      }
    } catch (e) {
      showToast('Error al conectar con Google: ' + e.message, 'error');
    }
  }

  // Inicializar Google Identity Services
  window.initializeGoogle = function() {
    if (typeof google !== 'undefined') {
      try {
        google.accounts.id.initialize({
          client_id: '894522360681-pfuptfhtithl6kb28uj9mci3i5hbdk5k.apps.googleusercontent.com',
          callback: handleCredentialResponse
        });

        const regEl = document.getElementById('google-btn-registro');
        if (regEl) {
          google.accounts.id.renderButton(regEl, {
            theme: 'outline',
            size: 'large',
            text: 'signup_with',
            shape: 'rectangular',
            width: 320
          });
        }
      } catch (e) {
        console.error('Error initializing Google Sign-In:', e);
      }
    }
  };

  // Si ya cargó la librería de Google, inicializar de inmediato
  if (typeof google !== 'undefined') {
    window.initializeGoogle();
  }

  // Ajustar montos y visibilidad de términos según el plan
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

  // Inicializar UI de Plan
  updatePlanUI();

  // Actualizar UI del Indicador de Progreso
  function updateProgress() {
    let pct = 0;
    if (isReturningUserNoPayments) {
      pct = ((currentStep - 5) / (totalSteps - 5)) * 100;
    } else {
      pct = ((currentStep - 1) / (totalSteps - 1)) * 100;
    }
    progressLine.style.width = pct + '%';

    stepDots.forEach((dot, idx) => {
      const stepNum = idx + 1;
      dot.classList.remove('active', 'completed');
      
      if (isReturningUserNoPayments && stepNum < 5) {
        dot.style.display = 'none';
      } else {
        dot.style.display = '';
      }

      if (stepNum === currentStep) {
        dot.classList.add('active');
      } else if (stepNum < currentStep) {
        dot.classList.add('completed');
      }
    });

    const minStep = isReturningUserNoPayments ? 5 : 1;
    if (currentStep === minStep) {
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

  // Cambiar de Paso
  function showStep(stepNum) {
    steps.forEach(step => {
      step.classList.remove('active');
    });
    const targetStep = document.querySelector(`.form-step[data-step="${stepNum}"]`);
    if (targetStep) {
      targetStep.classList.add('active');
    }
    updateProgress();
  }

  // Validar inputs de un paso específico
  function validateStep(stepNum) {
    const activeStepEl = document.querySelector(`.form-step[data-step="${stepNum}"]`);
    if (!activeStepEl) return true;

    const inputs = activeStepEl.querySelectorAll('input[required], select[required]');
    let isValid = true;

    for (let input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        isValid = false;
        break;
      }
    }

    if (stepNum === 5) {
      const selectedPlan = document.querySelector('input[name="plan_pago"]:checked').value;
      if (selectedPlan === 'Financiado' && !aceptaTerminos.checked) {
        showToast('Debes aceptar los términos y condiciones del financiamiento.', 'error');
        isValid = false;
      }
    }

    return isValid;
  }

  // Rellenar resumen
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

  // Navegación - Siguiente
  nextBtn.addEventListener('click', () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        currentStep++;
        if (currentStep === totalSteps) {
          populateResumen();
        }
        showStep(currentStep);
      }
    }
  });

  // Navegación - Anterior
  prevBtn.addEventListener('click', () => {
    const minStep = isReturningUserNoPayments ? 5 : 1;
    if (currentStep > minStep) {
      currentStep--;
      showStep(currentStep);
    }
  });

  // Sistema de Toasts
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <i class="fa-solid fa-xmark" style="cursor:pointer; margin-left: 10px;" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, 5000);
  }

  // Enviar Formulario Final
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (currentStep < totalSteps) {
      if (validateStep(currentStep)) {
        currentStep++;
        if (currentStep === totalSteps) {
          populateResumen();
        }
        showStep(currentStep);
      }
      return;
    }

    if (!validateStep(currentStep)) return;

    const formData = new FormData(form);
    
    if (googleAvatarUrl) {
      formData.append('avatar_url', googleAvatarUrl);
    }
    
    // Asegurar valor de checkbox
    formData.set('acepta_terminos', aceptaTerminos.checked ? 1 : 0);
    formData.set('pagar_luego', 1);

    let targetUrl = 'api/registro.php';
    if (isReturningUserNoPayments) {
      const planVal = document.querySelector('input[name="plan_pago"]:checked').value;
      const tipoPago = planVal === 'Financiado' ? 'Inicial' : 'Completo';
      formData.set('tipo_pago', tipoPago);
      if (registeredEventId) {
        formData.set('evento_id', registeredEventId);
      }
      targetUrl = 'api/registro.php?action=report_pago';
    }

    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `<span>REGISTRANDO CUPO...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        body: formData
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Ocurrió un error al procesar el registro.');
      }

      const userEmail = document.getElementById('email').value.trim();

      showToast(result.message, 'success');
      form.reset();
      
      // Resetear preview de imagen
      const uploadContentReg = document.getElementById('upload-content-registro');
      const previewContainerReg = document.getElementById('preview-container-registro');
      const imgPreviewReg = document.getElementById('image-preview-registro');
      if (uploadContentReg && previewContainerReg && imgPreviewReg) {
        uploadContentReg.style.display = 'block';
        previewContainerReg.style.display = 'none';
        imgPreviewReg.src = '';
      }
      
      currentStep = 1;
      isReturningUserNoPayments = false;
      steps.forEach(step => {
        step.style.display = '';
      });
      updatePlanUI();
      showStep(currentStep);

      if (userEmail) {
        mostrarPreguntaPagoModal(userEmail);
      }

    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  });

  // Mostrar modal de pago rápido
  function mostrarPreguntaPagoModal(email) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0, 0, 0, 0.85)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '99999';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.fontFamily = "'Plus Jakarta Sans', sans-serif";

    modal.innerHTML = `
      <div style="background: #1e1e2f; border: 1px solid var(--border-color); border-radius: 16px; padding: 30px; width: 90%; max-width: 400px; text-align: center; color: var(--text-main); box-shadow: 0 20px 45px rgba(0,0,0,0.5);">
        <i class="fa-solid fa-circle-check" style="font-size: 48px; color: #259570; margin-bottom: 16px;"></i>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: var(--text-main);">¡Inscripción Registrada!</h3>
        <p style="margin: 0 0 24px 0; font-size: 13px; color: var(--text-muted); line-height: 1.6;">
          ¿Quieres reportar tu pago de una vez y asegurar tu cupo al 100%?
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-pago-si" class="submit-btn" style="width: 100%; margin: 0; background: var(--accent-gold); color: #12121c;">
            <span>SÍ, REPORTAR PAGO AHORA</span>
          </button>
          <button id="btn-pago-no" style="width: 100%; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 12px; border-radius: 8px; cursor: pointer; font-size: 12px; font-weight: 600; transition: all 0.2s;">
            PAGAR LUEGO
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#btn-pago-si').addEventListener('click', async () => {
      modal.remove();
      await checkUserEventRegistration(email);
      setTimeout(() => {
        const btnReportar = document.querySelector('#info-inscripcion-box button');
        if (btnReportar) btnReportar.click();
      }, 300);
    });

    modal.querySelector('#btn-pago-no').addEventListener('click', async () => {
      modal.remove();
      await checkUserEventRegistration(email);
    });
  }

  // Verificar estado de inscripción del usuario
  async function checkUserEventRegistration(email) {
    if (!email) return;
    try {
      const res = await fetch(`api/registro.php?action=check_status&email=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const status = await res.json();
      globalTasaBCV = parseFloat(status.tasa_bcv) || 0.0;
      
      const cuotasContainer = document.getElementById('pago-cuotas-container');
      const infoBox = document.getElementById('info-inscripcion-box');
      const wizardForm = document.getElementById('registro-form');
      const progressContainer = document.querySelector('.step-progress-container');
      
      if (status.registrado) {


        // Caso 2: Tiene pagos (completos o parciales)
        registeredEventId = status.evento_id;
        const sedeNombre = sedesNombres[status.evento_id] || 'Sede registrada';

        // Ocultar registro normal
        wizardForm.style.display = 'none';
        progressContainer.style.display = 'none';
        cuotasContainer.style.display = 'block';
        isReturningUserNoPayments = false;
        
        // Cargar información en la caja de manera estética
        let pagosHtml = status.pagos.map(p => {
          let bg = 'rgba(255,255,255,0.05)';
          let fg = 'var(--text-main)';
          if (p.estado === 'Verificado') {
            bg = 'rgba(37, 149, 112, 0.1)';
            fg = '#259570';
          } else if (p.estado === 'Pendiente') {
            bg = 'rgba(249, 115, 22, 0.1)';
            fg = '#f97316';
          } else if (p.estado === 'Rechazado') {
            bg = 'rgba(239, 68, 68, 0.1)';
            fg = '#ef4444';
          }
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color);">
              <span style="font-weight: 600; color: var(--text-main); font-size: 12px;">${p.tipo_pago}</span>
              <span style="font-size: 10px; padding: 4px 10px; font-weight: 700; border-radius: 4px; display: inline-block; background: ${bg}; color: ${fg}; text-transform: uppercase; letter-spacing: 0.5px;">${p.estado}</span>
            </div>
          `;
        }).join('');

        infoBox.innerHTML = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 12px; margin-bottom: 16px; text-align: left;">
              <div style="padding: 12px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px;">
                <span style="display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px;">Sede</span>
                <span style="font-size: 13px; font-weight: 700; color: var(--text-main);">${sedeNombre}</span>
              </div>
              <div style="padding: 12px; background: rgba(255,255,255,0.01); border: 1px solid var(--border-color); border-radius: 8px;">
                <span style="display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px;">Plan de Pago</span>
                <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 800; background: ${status.plan_pago === 'Completo' ? '#2d3e85' : '#c3ccf3'}; color: ${status.plan_pago === 'Completo' ? '#ffffff' : '#2d3e85'}; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-top: 2px;">${status.plan_pago === 'Completo' ? 'PAGO COMPLETO' : 'PLAN FINANCIADO'}</span>
              </div>
            </div>
            
            <div style="margin-top: 16px; text-align: left;">
              <span style="display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; font-weight: 600;">Historial de Pagos</span>
              <div style="display: flex; flex-direction: column;">
                ${pagosHtml}
              </div>
            </div>
          </div>
        `;
        
        const tipoPagoSelect = document.getElementById('tipo_pago_cuota');
        const submitCuotaBtn = document.getElementById('submit-cuota-btn');
        const formGrid = cuotasContainer.querySelector('.form-grid');

        // Calcular total verificado
        let totalVerificado = 0;
        status.pagos.forEach(p => {
          if (p.estado === 'Verificado') {
            totalVerificado += parseFloat(p.monto);
          }
        });
        const is100PercentPaid = (
          (status.plan_pago === 'Completo' && totalVerificado > 0) || 
          (totalVerificado >= 30.00)
        );

        if (is100PercentPaid) {
          infoBox.innerHTML += `<p style="color: var(--accent-neon); font-weight: bold; margin-top: 15px; font-size: 13px;">¡Tu inscripción a TRD 2026 se encuentra 100% pagada! Te encuentras totalmente al día con este evento.</p>`;
          if (tipoPagoSelect) tipoPagoSelect.parentElement.style.display = 'none';
          if (formGrid) formGrid.style.display = 'none';
          if (submitCuotaBtn) submitCuotaBtn.style.display = 'none';
          // Ocultar formulario por defecto
          if (cuotasForm) cuotasForm.style.display = 'none';

          // Verificar si tiene un pago inicial pendiente
          const tieneInicialPendiente = status.pagos.some(p => p.tipo_pago === 'Inicial' && p.estado === 'Pendiente');
          if (tieneInicialPendiente) {
             infoBox.innerHTML += `
              <div style="margin-top: 20px; padding: 16px; border-radius: 8px; background: rgb(232 87 15 / 9%); font-family: 'Plus Jakarta Sans', sans-serif; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02); text-align: left;">
                <p style="margin: 0 0 8px 0; color: #e7570f; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-triangle-exclamation" style="font-size: 14px;"></i> INICIAL AUN NO VERIFICADA
                </p>
                <p style="margin: 0 0 14px 0; color: #6b7280; font-size: 12px; line-height: 1.5; font-weight: 500;">
                  ¡Hola, ${status.nombre}! Para comenzar a reportar tus cuotas, primero necesitamos verificar tu pago inicial. Haz clic abajo y escríbenos directamente para activarte de inmediato.
                </p>
                <a href="https://wa.me/584127529976?text=Hola,%20necesito%20verificar%20mi%20pago%20inicial%20de%20Luminares" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #259570; color: #fff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(37, 149, 112, 0.2); transition: all 0.2s;">
                  <i class="fa-brands fa-whatsapp" style="font-size: 13px;"></i> CONTACTO
                </a>
              </div>
             `;
             return;
          }

          // Crear botón de reporte de pago
          const btnReportar = document.createElement('button');
          btnReportar.type = 'button';
          btnReportar.className = 'submit-btn';
          btnReportar.style.marginTop = '20px';
          btnReportar.style.width = '100%';
          btnReportar.innerHTML = '<span>REPORTAR PAGO</span> <i class="fa-solid fa-money-bill-transfer"></i>';
          infoBox.appendChild(btnReportar);

          btnReportar.addEventListener('click', () => {
            btnReportar.style.display = 'none';
            if (cuotasForm) cuotasForm.style.display = 'block';
            document.getElementById('cuotas-substep-1').classList.remove('hidden');
            document.getElementById('cuotas-substep-2').classList.add('hidden');
          });

          // Poblar dinámicamente las opciones
          const reportedTypes = status.pagos.filter(p => p.estado !== 'Rechazado').map(p => p.tipo_pago);
          tipoPagoSelect.innerHTML = '';

          if (status.plan_pago === 'Completo') {
            const opt = document.createElement('option');
            opt.value = 'Completo';
            opt.textContent = 'Pago Completo ($30.00)';
            tipoPagoSelect.appendChild(opt);
            montoCuotaInput.value = '30.00';
            montoCuotaInput.placeholder = '30.00';
            montoCuotaInput.readOnly = true;
          } else {
            // Plan Financiado
            if (!reportedTypes.includes('Inicial')) {
              const opt = document.createElement('option');
              opt.value = 'Inicial';
              opt.textContent = 'Pago Inicial ($6.00)';
              tipoPagoSelect.appendChild(opt);
              montoCuotaInput.value = '6.00';
              montoCuotaInput.placeholder = '6.00';
              montoCuotaInput.readOnly = true;
            } else {
              montoCuotaInput.readOnly = true;
              
              const totalReportado = status.pagos
                .filter(p => p.estado !== 'Rechazado')
                .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);
              
              const remainingReportable = 30.00 - totalReportado;
              const maxCuotasReportables = Math.round(remainingReportable / 8.00);

              if (maxCuotasReportables >= 1) {
                const opt = document.createElement('option');
                opt.value = '1 Cuota';
                opt.textContent = '1 Cuota ($8.00)';
                tipoPagoSelect.appendChild(opt);
                montoCuotaInput.value = '8.00';
                montoCuotaInput.placeholder = '8.00';
              }
              if (maxCuotasReportables >= 2) {
                const opt = document.createElement('option');
                opt.value = '2 Cuotas';
                opt.textContent = '2 Cuotas ($16.00)';
                tipoPagoSelect.appendChild(opt);
              }
              if (maxCuotasReportables >= 3) {
                const opt = document.createElement('option');
                opt.value = '3 Cuotas';
                opt.textContent = '3 Cuotas ($24.00)';
                tipoPagoSelect.appendChild(opt);
              }
            }
          }
        }
      } else {
        // Mostrar registro normal
        wizardForm.style.display = 'block';
        progressContainer.style.display = 'block';
        cuotasContainer.style.display = 'none';
        isReturningUserNoPayments = false;
        
        // Asegurar que los primeros 4 pasos estén visibles
        steps.forEach(step => {
          step.style.display = '';
        });
      }
    } catch (e) {
      console.error('Error al verificar inscripción:', e);
    }
  }

  // Listener para el blur en el input de email
  const emailInput = document.getElementById('email');
  if (emailInput) {
    emailInput.addEventListener('blur', async () => {
      if (emailInput.checkValidity() && emailInput.value.trim() !== '') {
        await checkUserEventRegistration(emailInput.value.trim());
      }
    });
  }

  // Controles de pago cuotas
  const cuotasForm = document.getElementById('pago-cuotas-form');
  const submitCuotaBtn = document.getElementById('submit-cuota-btn');
  const volverRegistroBtn = document.getElementById('volver-registro-btn');
  const tipoPagoCuota = document.getElementById('tipo_pago_cuota');
  const montoCuotaInput = document.getElementById('monto_cuota');
  const ayudaBCVCalculo = document.getElementById('ayuda-bcv-calculo');

  // Función para actualizar cálculo de BCV
  function actualizarCalculoBCVCota() {
    if (!montoCuotaInput || !ayudaBCVCalculo) return;
    const montoUsd = parseFloat(montoCuotaInput.value) || 0.0;
    const moneda = document.getElementById('moneda_cuota').value;
    
    if (moneda === 'VES' && globalTasaBCV > 0) {
      const totalBs = (montoUsd * globalTasaBCV).toFixed(2);
      const integerPart = Math.floor(totalBs).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      const decimalPart = (totalBs - Math.floor(totalBs)).toFixed(2).substring(2);
      ayudaBCVCalculo.textContent = `Calculado: $${montoUsd.toFixed(2)} USD x tasa BCV ${globalTasaBCV.toFixed(4)} Bs/$ = ${integerPart + ',' + decimalPart} Bs.`;
    } else {
      ayudaBCVCalculo.textContent = `Monto a reportar: $${montoUsd.toFixed(2)} USD.`;
    }
  }

  if (tipoPagoCuota && montoCuotaInput) {
    tipoPagoCuota.addEventListener('change', () => {
      if (tipoPagoCuota.value === 'Inicial') {
        montoCuotaInput.value = '6.00';
        montoCuotaInput.placeholder = '6.00';
      } else if (tipoPagoCuota.value === 'Completo') {
        montoCuotaInput.value = '30.00';
        montoCuotaInput.placeholder = '30.00';
      } else if (tipoPagoCuota.value === '1 Cuota') {
        montoCuotaInput.value = '8.00';
        montoCuotaInput.placeholder = '8.00';
      } else if (tipoPagoCuota.value === '2 Cuotas') {
        montoCuotaInput.value = '16.00';
        montoCuotaInput.placeholder = '16.00';
      } else if (tipoPagoCuota.value === '3 Cuotas') {
        montoCuotaInput.value = '24.00';
        montoCuotaInput.placeholder = '24.00';
      }
      actualizarCalculoBCVCota();
    });
  }

  // Configuración de botones de métodos de pago
  const btnPayments = document.querySelectorAll('.btn-payment');
  btnPayments.forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.getAttribute('data-method');
      document.getElementById('metodo_pago_cuota').value = method;

      const isBs = method === 'Pago Móvil';
      document.getElementById('moneda_cuota').value = isBs ? 'VES' : 'USD';

      // Mostrar/ocultar banco emisor
      const grupoBanco = document.getElementById('grupo-banco-emisor');
      const bancoInput = document.getElementById('banco_origen_cuota');
      if (grupoBanco && bancoInput) {
        if (isBs) {
          grupoBanco.style.display = 'block';
          bancoInput.setAttribute('required', 'required');
          bancoInput.value = '';
        } else {
          grupoBanco.style.display = 'none';
          bancoInput.removeAttribute('required');
          bancoInput.value = 'N/A';
        }
      }

      // Renderizar datos de cuenta destino
      const infoBox = document.getElementById('cuotas-payment-info');
      const details = paymentDetails[method];
      if (infoBox && details) {
        let rowsHtml = '';
        details.fields.forEach(field => {
          rowsHtml += `
            <div class="data-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 4px;">
              <span class="data-label" style="color: var(--text-muted); margin-right: 5px;">${field.label}:</span>
              <span class="data-value" style="font-weight: 600; color: var(--text-main); word-break: break-all; margin-right: 8px; flex-grow: 1; text-align: right;">${field.value}</span>
              <button type="button" class="btn-copy" onclick="copyToClipboard('${field.value}')" title="Copiar" style="background: none; border: none; color: var(--accent-gold); cursor: pointer; padding: 2px 5px; font-size: 14px;">
                <i class="far fa-copy"></i>
              </button>
            </div>
          `;
        });

        let copyAllBtn = '';
        if (details.copyAllValue) {
          copyAllBtn = `
            <div style="text-align: center; margin-top: 12px;">
              <button type="button" class="btn-control" onclick="copyToClipboard(\`${details.copyAllValue.replace(/\n/g, '\\n')}\`)" style="font-size: 11px; padding: 6px 12px;">
                <i class="far fa-copy"></i> Copiar Datos de Pago
              </button>
            </div>
          `;
        }

        infoBox.innerHTML = `
          <div style="text-align: center; margin-bottom: 15px;">
            <img src="${details.logo}" alt="${method}" style="height: 35px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)); margin: 8px;">
          </div>
          <div style="width: 100%;">${rowsHtml}</div>
          ${copyAllBtn}
        `;
      }

      // Actualizar cálculo de BCV
      actualizarCalculoBCVCota();

      // Cambiar de vista
      document.getElementById('cuotas-substep-1').classList.add('hidden');
      document.getElementById('cuotas-substep-2').classList.remove('hidden');
    });
  });

  // Botón Volver a Sub-paso 1
  const btnVolverSubstep1 = document.getElementById('btn-volver-substep-1');
  if (btnVolverSubstep1) {
    btnVolverSubstep1.addEventListener('click', () => {
      document.getElementById('cuotas-substep-2').classList.add('hidden');
      document.getElementById('cuotas-substep-1').classList.remove('hidden');
    });
  }

  if (volverRegistroBtn) {
    volverRegistroBtn.addEventListener('click', () => {
      document.getElementById('pago-cuotas-container').style.display = 'none';
      document.getElementById('registro-form').style.display = 'block';
      document.querySelector('.step-progress-container').style.display = 'block';
      isReturningUserNoPayments = false;
      currentStep = 1;
      steps.forEach(step => {
        step.style.display = '';
      });
      showStep(1);
    });
  }

  if (cuotasForm) {
    cuotasForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value.trim();
      const eventIdVal = registeredEventId || document.querySelector('input[name="evento_id"]:checked')?.value || '1';
      
      const fileInput = document.getElementById('comprobante_imagen_cuota');
      if (!fileInput || fileInput.files.length === 0) {
        showToast('Debe adjuntar el capture de la transferencia.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('email', email);
      formData.append('evento_id', eventIdVal);
      formData.append('tipo_pago', tipoPagoCuota.value);
      formData.append('moneda', document.getElementById('moneda_cuota').value);
      formData.append('metodo_pago', document.getElementById('metodo_pago_cuota').value.trim());
      formData.append('banco_origen', document.getElementById('banco_origen_cuota').value.trim());
      formData.append('referencia', document.getElementById('referencia_cuota').value.trim());
      formData.append('monto', parseFloat(montoCuotaInput.value));
      formData.append('comprobante_imagen', fileInput.files[0]);

      if (!email || !eventIdVal || !tipoPagoCuota.value || !document.getElementById('metodo_pago_cuota').value.trim() || !document.getElementById('banco_origen_cuota').value.trim() || !document.getElementById('referencia_cuota').value.trim() || !montoCuotaInput.value) {
        showToast('Todos los campos son obligatorios.', 'error');
        return;
      }

      submitCuotaBtn.disabled = true;
      const originalText = submitCuotaBtn.innerHTML;
      submitCuotaBtn.innerHTML = `<span>ENVIANDO PAGO...</span> <i class="fa-solid fa-spinner fa-spin"></i>`;

      try {
        const res = await fetch('api/registro.php?action=report_pago', {
          method: 'POST',
          body: formData
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al reportar pago');

        showToast(result.message, 'success');
        cuotasForm.reset();
        
        // Resetear vistas
        document.getElementById('cuotas-substep-2').classList.add('hidden');
        document.getElementById('cuotas-substep-1').classList.remove('hidden');
        if (ayudaBCVCalculo) ayudaBCVCalculo.textContent = '';
        
        // Resetear preview de imagen
        const uploadContentCuo = document.getElementById('upload-content-cuota');
        const previewContainerCuo = document.getElementById('preview-container-cuota');
        const imgPreviewCuo = document.getElementById('image-preview-cuota');
        if (uploadContentCuo && previewContainerCuo && imgPreviewCuo) {
          uploadContentCuo.style.display = 'block';
          previewContainerCuo.style.display = 'none';
          imgPreviewCuo.src = '';
        }
        
        await checkUserEventRegistration(email);
      } catch (error) {
        showToast(error.message, 'error');
      } finally {
        submitCuotaBtn.disabled = false;
        submitCuotaBtn.innerHTML = originalText;
      }
    });
  }

  // Autocompletar Congregación
  const congregacionInput = document.getElementById('congregacion');
  if (congregacionInput) {
    const redPastoralInput = document.getElementById('red_pastoral');
    const redPastoralSelect = document.getElementById('red_pastoral_select');

    congregacionInput.addEventListener('input', async () => {
      const val = congregacionInput.value.trim().toLowerCase();
      const keywords = ['don divino', 'base sucre', 'la pedrera', 'la fuente', 'manantial', 'el limón'];
      const isMatch = keywords.some(kw => val.includes(kw));

      if (isMatch) {
        if (redPastoralInput) {
          redPastoralInput.style.display = 'none';
          redPastoralInput.disabled = true;
          redPastoralInput.removeAttribute('name');
          redPastoralInput.removeAttribute('required');
        }
        if (redPastoralSelect) {
          redPastoralSelect.style.display = 'block';
          redPastoralSelect.disabled = false;
          redPastoralSelect.setAttribute('name', 'red_pastoral');
          redPastoralSelect.setAttribute('required', 'required');
        }
      } else {
        if (redPastoralSelect) {
          redPastoralSelect.style.display = 'none';
          redPastoralSelect.disabled = true;
          redPastoralSelect.removeAttribute('name');
          redPastoralSelect.removeAttribute('required');
        }
        if (redPastoralInput) {
          redPastoralInput.style.display = 'block';
          redPastoralInput.disabled = false;
          redPastoralInput.setAttribute('name', 'red_pastoral');
          redPastoralInput.setAttribute('required', 'required');
        }
      }

      if (val.length >= 3) {
        try {
          const res = await fetch(`api/registro.php?action=get_congregaciones&q=${encodeURIComponent(val)}`);
          if (!res.ok) return;
          let list = await res.json();
          
          if (val.toLowerCase().includes('don') && !list.some(item => item.toLowerCase() === 'don divino')) {
            list.unshift('Don Divino');
          }
          
          const datalist = document.getElementById('congregaciones-list');
          if (datalist) {
            datalist.innerHTML = list.map(item => `<option value="${item}"></option>`).join('');
          }
        } catch (e) {
          console.error('Error al autocompletar congregaciones:', e);
        }
      }
    });
  }

  // --- Lógica de Upload de Imágenes (Registro & Cuotas) ---
  function setupFileUpload(dropZoneId, inputId, contentId, previewContainerId, imagePreviewId, removeBtnId) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(inputId);
    const uploadContent = document.getElementById(contentId);
    const previewContainer = document.getElementById(previewContainerId);
    const imagePreview = document.getElementById(imagePreviewId);
    const removeBtn = document.getElementById(removeBtnId);

    if (dropZone && fileInput) {
      dropZone.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
          fileInput.click();
        }
      });

      fileInput.addEventListener('change', function () {
        handleFiles(this.files);
      });

      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); }, false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files;
        handleFiles(files);
      });

      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        uploadContent.style.display = 'block';
        previewContainer.style.display = 'none';
        imagePreview.src = '';
      });

      function handleFiles(files) {
        if (files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              imagePreview.src = e.target.result;
              uploadContent.style.display = 'none';
              previewContainer.style.display = 'flex';
            };
            reader.readAsDataURL(file);
          } else {
            showToast('Por favor, selecciona un archivo de tipo imagen.', 'error');
            fileInput.value = '';
          }
        }
      }
    }
  }

  setupFileUpload('drop-zone-registro', 'comprobante_imagen', 'upload-content-registro', 'preview-container-registro', 'image-preview-registro', 'remove-file-registro');
  setupFileUpload('drop-zone-cuota', 'comprobante_imagen_cuota', 'upload-content-cuota', 'preview-container-cuota', 'image-preview-cuota', 'remove-file-cuota');

  // Prevent zoom (double-tap and pinch-to-zoom)
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });
});
