// pagos.js - TRD 2026 Dashboard de Pagos

document.addEventListener('DOMContentLoaded', () => {
  const infoBox = document.getElementById('info-inscripcion-box');
  const cuotasForm = document.getElementById('pago-cuotas-form');
  const submitCuotaBtn = document.getElementById('submit-cuota-btn');
  const tipoPagoCuota = document.getElementById('tipo_pago_cuota');
  const montoCuotaInput = document.getElementById('monto_cuota');
  const ayudaBCVCalculo = document.getElementById('ayuda-bcv-calculo');
  const userDisplayEmail = document.getElementById('user-display-email');

  let globalTasaBCV = 0.0;
  let registeredEventId = null;

  const sedesNombres = {
    '1': 'Maracay - Sede La Fuente',
    '2': 'Tinaquillo - Sede Cojedes',
    '3': 'El Tigre - Sede Visión Profética'
  };

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
        { label: 'Email', value: 'Trd.reforma@gmail.com' }
      ],
      copyAllValue: "Trd.reforma@gmail.com"
    },
    'Zinli': {
      logo: '/assets/img/zinli.png',
      fields: [
        { label: 'Email', value: 'juventudereforma@gmail.com' }
      ],
      copyAllValue: "juventudereforma@gmail.com"
    }
  };

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
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Get email from URL or sessionStorage
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email') || sessionStorage.getItem('trd_user_email') || '';
  const autoReport = urlParams.get('auto_report') === '1';

  if (!email) {
    infoBox.innerHTML = `
      <div style="text-align: center; padding: 20px; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; color: var(--accent-gold); margin-bottom: 15px; display: block;"></i>
        <p style="font-weight: 600; margin-bottom: 12px;">No hay sesión activa.</p>
        <a href="index.html" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #2d3e85; color: #ffffff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 11px;">
          <i class="fa-solid fa-arrow-left"></i> IR AL INICIO
        </a>
      </div>
    `;
    return;
  }

  if (userDisplayEmail) userDisplayEmail.textContent = email;

  // Update BCV calculation
  function actualizarCalculoBCVCuota() {
    if (!montoCuotaInput) return;
    const montoUsd = parseFloat(montoCuotaInput.value) || 0.0;
    const moneda = document.getElementById('moneda_cuota').value;
    const montoBsInput = document.getElementById('monto_bs');

    if (moneda === 'VES' && globalTasaBCV > 0 && montoUsd > 0) {
      const totalBs = montoUsd * globalTasaBCV;
      const totalBsFmt = totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      if (montoBsInput) montoBsInput.value = totalBsFmt + ' Bs.';
      if (ayudaBCVCalculo) ayudaBCVCalculo.textContent = `Tasa del día ${globalTasaBCV.toFixed(4)} Bs/$`;
    } else {
      if (montoBsInput) montoBsInput.value = 'N/A';
      if (ayudaBCVCalculo) ayudaBCVCalculo.textContent = '';
    }
  }

  if (montoCuotaInput) {
    montoCuotaInput.addEventListener('input', actualizarCalculoBCVCuota);
  }

  // Load user status
  async function loadUserStatus() {
    try {
      const res = await fetch(`api/registro.php?action=check_status&email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Error al conectar con el servidor');
      const status = await res.json();
      globalTasaBCV = parseFloat(status.tasa_bcv) || 0.0;

      if (!status.registrado) {
        infoBox.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <i class="fa-solid fa-user-slash" style="font-size: 28px; color: var(--text-muted); margin-bottom: 15px; display: block;"></i>
            <p style="font-weight: 600; font-size: 13px; margin-bottom: 12px; color: var(--text-main);">No estás inscrito en este evento.</p>
            <a href="inscripcion.html?email=${encodeURIComponent(email)}" style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; background: #2d3e85; color: #ffffff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 11px;">
              <i class="fa-solid fa-pen"></i> INSCRIBIRME AHORA
            </a>
          </div>
        `;
        return;
      }

      registeredEventId = status.evento_id;
      const sedeNombre = sedesNombres[status.evento_id] || 'Sede registrada';

      // Pagos list
      let pagosHtml = '';
      if (status.pagos.length === 0) {
        pagosHtml = `<p style="font-size: 12px; color: var(--text-muted); text-align: center; margin-top: 10px;">No tienes pagos reportados aún.</p>`;
      } else {
        pagosHtml = status.pagos.map(p => {
          let bg = 'rgba(255,255,255,0.05)';
          let fg = 'var(--text-main)';
          if (p.estado === 'Verificado') { bg = 'rgba(37,149,112,0.1)'; fg = '#259570'; }
          else if (p.estado === 'Pendiente') { bg = 'rgba(249,115,22,0.1)'; fg = '#f97316'; }
          else if (p.estado === 'Rechazado') { bg = 'rgba(239,68,68,0.1)'; fg = '#ef4444'; }

          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(255,255,255,0.02); border-radius: 6px; margin-bottom: 6px; border: 1px solid var(--border-color);">
              <span style="font-weight: 600; color: var(--text-main); font-size: 12px;">${p.tipo_pago}</span>
              <span style="font-size: 10px; padding: 4px 10px; font-weight: 700; border-radius: 4px; display: inline-block; background: ${bg}; color: ${fg}; text-transform: uppercase; letter-spacing: 0.5px;">${p.estado}</span>
            </div>
          `;
        }).join('');
      }

      // Calcular total verificado
      const totalVerificado = status.pagos
        .filter(p => p.estado === 'Verificado')
        .reduce((sum, p) => sum + parseFloat(p.monto || 0), 0);

      const montoTotal = status.plan_pago === 'Completo' ? 30.00 : 30.00;
      const is100 = status.plan_pago === 'Completo' ? totalVerificado >= 30.00 : totalVerificado >= 30.00;

      infoBox.innerHTML = `
        <div style="margin-bottom: 16px; text-align: left;">
          <!-- Fila 1: Nombre -->
          <div style="font-size: 15px; font-weight: 800; color: var(--text-main); margin-bottom: 4px;">
            ${status.nombre} ${status.apellido}
          </div>
          <!-- Fila 2: Sede -->
          <div style="font-size: 11px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace; margin-bottom: 12px;">
            ${sedeNombre}
          </div>
          <!-- Fila 3: Plan --------- Verificado -->
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div>
              <span style="font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 800; background: ${status.plan_pago === 'Completo' ? '#2d3e85' : '#c3ccf3'}; color: ${status.plan_pago === 'Completo' ? '#ffffff' : '#2d3e85'}; padding: 4px 10px; border-radius: 4px; display: inline-block;">${status.plan_pago === 'Completo' ? 'PAGO COMPLETO' : 'PLAN FINANCIADO'}</span>
            </div>
            <div style="font-size: 10px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--text-muted);">
              $${totalVerificado.toFixed(2)} / $30.00
            </div>
          </div>
        </div>
        <div style="margin-top: 10px;">${pagosHtml}</div>
      `;

      if (is100) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(status.email)}`;
        infoBox.innerHTML += `
          <p style="color: var(--accent-neon); font-weight: bold; margin-top: 15px; font-size: 12px; text-align: center;">¡Inscripción 100% pagada! Estás totalmente al día.</p>
          <div style="margin-top: 20px; padding: 15px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-color); text-align: center;">
            <p style="margin: 0 0 12px 0; color: var(--accent-neon); font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Pase de Acceso QR</p>
            <div style="background: #ffffff; padding: 10px; border-radius: 8px; display: inline-block; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15); margin: 0 auto 12px auto;">
              <img src="${qrUrl}" alt="Código QR de Acceso" style="display: block; width: 140px; height: 140px;">
            </div>
            <p style="margin: 0 0 15px 0; color: var(--text-muted); font-size: 11px; font-weight: 500; line-height: 1.4;">
              Muestra este código QR en las puertas para garantizar tu acceso al evento.
            </p>
            <button onclick="downloadQrTicket('${status.nombre.replace(/'/g, "\\'")}', '${status.apellido.replace(/'/g, "\\'")}', '${status.email.replace(/'/g, "\\'")}')" class="submit-btn" style="background: #ffffff; color: #2d3e85; width: 100%; border: none; font-weight: bold; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 8px; cursor: pointer;">
              <i class="fa-solid fa-download"></i> DESCARGAR TICKET DE ACCESO
            </button>
          </div>
        `;
      } else {
        const tieneInicialPendiente = status.pagos.some(p => p.tipo_pago === 'Inicial' && p.estado === 'Pendiente');
        if (tieneInicialPendiente) {
          infoBox.innerHTML += `
            <div style="margin-top: 20px; padding: 14px; border-radius: 8px; background: rgb(232 87 15 / 9%); text-align: left;">
              <p style="margin: 0 0 8px 0; color: #e7570f; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-triangle-exclamation"></i> INICIAL AUN NO VERIFICADA
              </p>
              <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 11px; line-height: 1.5; font-weight: 500;">
                Para reportar cuotas adicionales, primero necesitamos verificar tu pago inicial.
              </p>
              <a href="https://wa.me/584127529976?text=Hola,%20necesito%20verificar%20mi%20pago%20inicial%20de%20Luminares" target="_blank" style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; background: #259570; color: #fff; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 11px;">
                <i class="fa-brands fa-whatsapp"></i> CONTACTO
              </a>
            </div>
          `;
          return;
        }

        // Botón Reportar Pago
        const btnReportar = document.createElement('button');
        btnReportar.type = 'button';
        btnReportar.className = 'submit-btn';
        btnReportar.style.marginTop = '20px';
        btnReportar.style.width = '100%';
        btnReportar.style.background = '#2d3e85';
        btnReportar.style.color = '#ffffff';
        btnReportar.style.fontWeight = 'bold';
        btnReportar.innerHTML = '<span>REPORTAR PAGO</span> <i class="fa-solid fa-money-bill-transfer"></i>';
        infoBox.appendChild(btnReportar);

        // Populate Concepto de Pago checkboxes
        const conceptoChecksContainer = document.getElementById('concepto-pago-checks');
        conceptoChecksContainer.innerHTML = '';

        if (status.plan_pago === 'Completo') {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.alignItems = 'center';
          div.style.gap = '8px';
          div.style.padding = '10px 14px';
          div.style.border = '1px solid var(--border-color)';
          div.style.borderRadius = '8px';
          div.style.background = 'rgba(255,255,255,0.02)';

          div.innerHTML = `
            <input type="checkbox" id="check-completo" checked disabled style="accent-color: #EA580C; width: 18px; height: 18px; cursor: not-allowed;">
            <label for="check-completo" style="margin: 0; cursor: not-allowed; text-transform: none; font-size: 13px; font-weight: 600; color: var(--text-main); display: flex; justify-content: space-between; width: 100%;">
              <span>Pago Completo</span>
              <span style="color: var(--accent-gold);">$30.00 USD</span>
            </label>
          `;
          conceptoChecksContainer.appendChild(div);

          tipoPagoCuota.value = 'Completo';
          montoCuotaInput.value = '30.00';
          montoCuotaInput.readOnly = true;
        } else {
          const items = [
            { name: 'Inicial', label: 'Pago Inicial', amount: 6.00 },
            { name: 'Cuota 1', label: 'Cuota 1', amount: 8.00 },
            { name: 'Cuota 2', label: 'Cuota 2', amount: 8.00 },
            { name: 'Cuota 3', label: 'Cuota 3', amount: 8.00 }
          ];

          const isItemReported = (itemName) => {
            return status.pagos.some(p => p.estado !== 'Rechazado' && p.tipo_pago.includes(itemName));
          };

          const updateCheckboxesState = () => {
            let previousIsChecked = true;
            let totalAmountToPay = 0.00;
            let checkedConcepts = [];

            items.forEach((item, index) => {
              const cb = document.getElementById(`check-${index}`);
              const labelEl = document.getElementById(`label-${index}`);
              const containerEl = document.getElementById(`container-${index}`);

              const reported = isItemReported(item.name);

              if (reported) {
                cb.checked = true;
                cb.disabled = true;
                containerEl.style.opacity = '0.7';
                containerEl.style.background = 'rgba(0,0,0,0.05)';
                labelEl.style.color = 'var(--text-muted)';
                labelEl.style.cursor = 'not-allowed';
                cb.style.cursor = 'not-allowed';
                previousIsChecked = true;
              } else {
                if (previousIsChecked) {
                  cb.disabled = false;
                  containerEl.style.opacity = '1';
                  containerEl.style.background = cb.checked ? 'rgba(195, 204, 243, 0.08)' : 'rgba(255,255,255,0.02)';
                  containerEl.style.borderColor = cb.checked ? 'var(--accent-gold)' : 'var(--border-color)';
                  labelEl.style.color = 'var(--text-main)';
                  labelEl.style.cursor = 'pointer';
                  cb.style.cursor = 'pointer';

                  if (cb.checked) {
                    totalAmountToPay += item.amount;
                    checkedConcepts.push(item.name);
                    previousIsChecked = true;
                  } else {
                    previousIsChecked = false;
                  }
                } else {
                  cb.checked = false;
                  cb.disabled = true;
                  containerEl.style.opacity = '0.4';
                  containerEl.style.background = 'rgba(255,255,255,0.01)';
                  containerEl.style.borderColor = 'var(--border-color)';
                  labelEl.style.color = 'var(--text-muted)';
                  labelEl.style.cursor = 'not-allowed';
                  cb.style.cursor = 'not-allowed';
                }
              }
            });

            montoCuotaInput.value = totalAmountToPay.toFixed(2);
            tipoPagoCuota.value = checkedConcepts.join(' + ');
            actualizarCalculoBCVCuota();
          };

          items.forEach((item, index) => {
            const reported = isItemReported(item.name);
            const reportedStatus = reported ? status.pagos.find(p => p.estado !== 'Rechazado' && p.tipo_pago.includes(item.name))?.estado : '';
            const statusText = reportedStatus ? ` (${reportedStatus})` : '';
            const statusColor = reportedStatus === 'Verificado' ? '#259570' : '#f97316';

            const div = document.createElement('div');
            div.id = `container-${index}`;
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '10px';
            div.style.padding = '12px 14px';
            div.style.border = '1px solid var(--border-color)';
            div.style.borderRadius = '10px';
            div.style.transition = 'all 0.2s';

            div.innerHTML = `
              <input type="checkbox" id="check-${index}" style="accent-color: #EA580C; width: 18px; height: 18px; transition: all 0.2s;">
              <label id="label-${index}" for="check-${index}" style="margin: 0; text-transform: none; font-size: 13px; font-weight: 600; display: flex; justify-content: space-between; width: 100%; align-items: center; user-select: none;">
                <span>${item.label}${reported ? `<span style="font-size: 11px; font-weight: 700; color: ${statusColor}; margin-left: 8px;">${statusText}</span>` : ''}</span>
                <span style="color: var(--accent-gold); font-family: 'JetBrains Mono', monospace;">$${item.amount.toFixed(2)} USD</span>
              </label>
            `;
            conceptoChecksContainer.appendChild(div);

            const cb = div.querySelector('input');
            cb.addEventListener('change', updateCheckboxesState);
          });

          updateCheckboxesState();
        }

        btnReportar.addEventListener('click', () => {
          btnReportar.style.display = 'none';
          cuotasForm.style.display = 'block';
          document.getElementById('cuotas-substep-1').classList.remove('hidden');
          document.getElementById('cuotas-substep-2').classList.add('hidden');
        });

        if (autoReport) {
          btnReportar.click();
        }
      }
    } catch (e) {
      infoBox.innerHTML = `<p style="color: var(--error); font-size: 12px; text-align: center;">Error al cargar datos: ${e.message}</p>`;
      console.error(e);
    }
  }

  loadUserStatus();

  // Payment method buttons
  const btnPayments = document.querySelectorAll('.btn-payment');
  btnPayments.forEach(btn => {
    btn.addEventListener('click', () => {
      const method = btn.getAttribute('data-method');
      document.getElementById('metodo_pago_cuota').value = method;

      const isBs = method === 'Pago Móvil';
      document.getElementById('moneda_cuota').value = isBs ? 'VES' : 'USD';


      const infoPayBox = document.getElementById('cuotas-payment-info');
      const details = paymentDetails[method];
      if (infoPayBox && details) {
        let rowsHtml = '';
        details.fields.forEach(field => {
          rowsHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 12px; border-bottom: 1px dashed rgba(0,0,0,0.06); padding-bottom: 4px;">
              <span style="color: var(--text-muted); margin-right: 5px;">${field.label}:</span>
              <span style="font-weight: 700; color: var(--text-main); flex-grow: 1; text-align: right; margin-right: 8px;">${field.value}</span>
              <button type="button" onclick="copyToClipboard('${field.value}')" title="Copiar" style="background: none; border: none; color: var(--accent-gold); cursor: pointer; padding: 2px 5px; font-size: 13px;">
                <i class="far fa-copy"></i>
              </button>
            </div>
          `;
        });

        let copyAllBtn = '';
        if (details.copyAllValue) {
          const escaped = details.copyAllValue.replace(/`/g, "'").replace(/\n/g, '\\n');
          copyAllBtn = `
            <div style="text-align: center; margin-top: 10px;">
              <button type="button" class="btn-control" onclick="copyToClipboard(\`${escaped}\`)" style="font-size: 10px; padding: 6px 12px;">
                <i class="far fa-copy"></i> Copiar Datos
              </button>
            </div>
          `;
        }

        infoPayBox.innerHTML = `
          <div style="text-align: center; margin-bottom: 14px;">
            <img src="${details.logo}" alt="${method}" style="height: 35px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)); margin: 8px;">
          </div>
          ${rowsHtml}
          ${copyAllBtn}
        `;
      }

      actualizarCalculoBCVCuota();

      document.getElementById('cuotas-substep-1').classList.add('hidden');
      document.getElementById('cuotas-substep-2').classList.remove('hidden');
    });
  });

  // Back button
  const btnVolverSubstep1 = document.getElementById('btn-volver-substep-1');
  if (btnVolverSubstep1) {
    btnVolverSubstep1.addEventListener('click', () => {
      document.getElementById('cuotas-substep-2').classList.add('hidden');
      document.getElementById('cuotas-substep-1').classList.remove('hidden');
    });
  }



  // Image preview
  const fileInput = document.getElementById('comprobante_imagen_cuota');
  const uploadContent = document.getElementById('upload-content-cuota');
  const previewContainer = document.getElementById('preview-container-cuota');
  const imgPreview = document.getElementById('image-preview-cuota');
  const uploadWrapper = document.getElementById('file-upload-wrapper-cuota');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (imgPreview) imgPreview.src = e.target.result;
          if (uploadContent) uploadContent.style.display = 'none';
          if (previewContainer) previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (uploadWrapper) {
    uploadWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadWrapper.classList.add('dragover');
    });
    uploadWrapper.addEventListener('dragleave', () => {
      uploadWrapper.classList.remove('dragover');
    });
    uploadWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadWrapper.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && fileInput) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      }
    });
  }

  // Form Submit
  if (cuotasForm) {
    cuotasForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!fileInput || fileInput.files.length === 0) {
        showToast('Debe adjuntar el capture de la transferencia.', 'error');
        return;
      }

      const formData = new FormData();
      formData.append('email', email);
      formData.append('evento_id', registeredEventId || '1');
      formData.append('tipo_pago', tipoPagoCuota.value);
      formData.append('moneda', document.getElementById('moneda_cuota').value);
      formData.append('metodo_pago', document.getElementById('metodo_pago_cuota').value.trim());
      formData.append('referencia', document.getElementById('referencia_cuota').value.trim());
      formData.append('monto', parseFloat(montoCuotaInput.value));
      formData.append('comprobante_imagen', fileInput.files[0]);

      if (!email || !tipoPagoCuota.value || !document.getElementById('metodo_pago_cuota').value.trim()) {
        showToast('Todos los campos son obligatorios.', 'error');
        return;
      }

      submitCuotaBtn.disabled = true;
      submitCuotaBtn.innerHTML = '<span>ENVIANDO...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

      try {
        const res = await fetch('api/registro.php?action=report_pago', {
          method: 'POST',
          body: formData
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Error al reportar pago');

        showToast(result.message, 'success');
        cuotasForm.reset();
        cuotasForm.style.display = 'none';

        if (uploadContent) uploadContent.style.display = 'block';
        if (previewContainer) previewContainer.style.display = 'none';
        if (imgPreview) imgPreview.src = '';
        if (ayudaBCVCalculo) ayudaBCVCalculo.textContent = '';

        document.getElementById('cuotas-substep-2').classList.add('hidden');
        document.getElementById('cuotas-substep-1').classList.remove('hidden');

        await loadUserStatus();
      } catch (error) {
        showToast(error.message, 'error');
        submitCuotaBtn.disabled = false;
        submitCuotaBtn.innerHTML = '<span>ENVIAR REPORTE</span> <i class="fa-solid fa-paper-plane"></i>';
      }
    });
  }
});
