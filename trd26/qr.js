// qr.js - Generación de Pase de Acceso QR Único para TRD 2026

// Helper común para cargar y renderizar el pase en un canvas
function renderTicketOnCanvas(canvas, nombre, apellido, email) {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d');
    ctx.scale(3, 3);

    // Precargar imágenes necesarias
    const imgTrd = new Image();
    const imgLns = new Image();
    const imgQr = new Image();
    let loadedCount = 0;

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === 3) {
        try {
          draw();
        } catch (e) {
          reject(e);
        }
      }
    };

    imgTrd.onload = checkAllLoaded;
    imgLns.onload = checkAllLoaded;
    imgQr.onload = checkAllLoaded;

    imgTrd.onerror = checkAllLoaded;
    imgLns.onerror = checkAllLoaded;
    imgQr.onerror = checkAllLoaded;

    // Configurar orígenes y CORS para evitar lienzo sucio (tainted canvas)
    imgQr.crossOrigin = 'anonymous';

    // Rutas de las imágenes (relativas a la carpeta /trd26)
    imgTrd.src = '../assets/img/trd2026.png';
    imgLns.src = '../assets/img/lns_long.png';
    imgQr.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(email)}`;

    // Timeout de seguridad en caso de falla de red al cargar el QR
    const fallbackTimeout = setTimeout(() => {
      if (loadedCount < 3) {
        loadedCount = 3;
        draw();
      }
    }, 2500);

    function draw() {
      clearTimeout(fallbackTimeout);

      // Limpiar lienzo (esquinas transparentes)
      ctx.clearRect(0, 0, 300, 400);

      // 1. Recorte con bordes redondeados (radio 16)
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(284, 0);
      ctx.quadraticCurveTo(300, 0, 300, 16);
      ctx.lineTo(300, 384);
      ctx.quadraticCurveTo(300, 400, 284, 400);
      ctx.lineTo(16, 400);
      ctx.quadraticCurveTo(0, 400, 0, 384);
      ctx.lineTo(0, 16);
      ctx.quadraticCurveTo(0, 0, 16, 0);
      ctx.closePath();
      ctx.clip();

      // 2. Fondo azul TRD oficial sólido
      ctx.fillStyle = '#2d3e85';
      ctx.fillRect(0, 0, 300, 400);

      // 3. Dibujar logos superiores
      if (imgTrd.complete && imgTrd.naturalWidth) {
        const aspect = imgTrd.naturalWidth / imgTrd.naturalHeight;
        const h = 30;
        const w = h * aspect;
        ctx.drawImage(imgTrd, 150 - w / 2, 12, w, h);
      } else {
        ctx.fillStyle = '#c3ccf3';
        ctx.font = '700 12px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TRASCIENDE 2026', 150, 36);
      }

      if (imgLns.complete && imgLns.naturalWidth) {
        const aspect = imgLns.naturalWidth / imgLns.naturalHeight;
        const h = 30;
        const w = h * aspect;
        ctx.drawImage(imgLns, 150 - w / 2, 48, w, h);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 11px Plus Jakarta Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LUMINARES', 150, 68);
      }

      // Línea divisoria superior
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 95);
      ctx.lineTo(270, 95);
      ctx.stroke();

      // 4. Detalle y Título
      ctx.fillStyle = '#c3ccf3';
      ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PASE DE ACCESO', 150, 120);

      // 5. Dibujar Código QR en el centro
      if (imgQr.complete && imgQr.naturalWidth) {
        ctx.fillStyle = '#ffffff';
        const qx = 85, qy = 135, qw = 130, qh = 130, qr = 10;
        
        ctx.beginPath();
        ctx.moveTo(qx + qr, qy);
        ctx.lineTo(qx + qw - qr, qy);
        ctx.quadraticCurveTo(qx + qw, qy, qx + qw, qy + qr);
        ctx.lineTo(qx + qw, qy + qh - qr);
        ctx.quadraticCurveTo(qx + qw, qy + qh, qx + qw - qr, qy + qh);
        ctx.lineTo(qx + qr, qy + qh);
        ctx.quadraticCurveTo(qx, qy + qh, qx, qy + qh - qr);
        ctx.lineTo(qx, qy + qr);
        ctx.quadraticCurveTo(qx, qy, qx + qr, qy);
        ctx.closePath();
        ctx.fill();

        ctx.drawImage(imgQr, 93, 143, 114, 114);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(85, 135, 130, 130);
        ctx.fillStyle = '#ffffff';
        ctx.font = '500 10px Plus Jakarta Sans, sans-serif';
        ctx.fillText('Error al cargar QR', 150, 200);
      }

      // 6. Nombre y Apellido del Participante
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 16px Plus Jakarta Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${nombre.toUpperCase()} ${apellido.toUpperCase()}`, 150, 295);

      // Email en fuente JetBrains Mono pequeña
      ctx.fillStyle = '#c3ccf3';
      ctx.font = '500 10px JetBrains Mono, monospace';
      ctx.fillText(email.toLowerCase(), 150, 315);

      // Línea de corte (Tear-off line)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, 345);
      ctx.lineTo(300, 345);
      ctx.stroke();
      ctx.setLineDash([]);

      // Círculos de corte en los lados transparentes (destination-out)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 345, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(300, 345, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // 7. Pie de página
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '500 8px Plus Jakarta Sans, sans-serif';
      ctx.fillText('REFORMA© 2026', 150, 375);

      resolve();
    }
  });
}

// Función 1: Generar y descargar localmente el pase
window.downloadQrTicket = (nombre, apellido, email) => {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  return renderTicketOnCanvas(canvas, nombre, apellido, email).then(() => {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `pase_${nombre.toLowerCase()}_${apellido.toLowerCase()}.png`;
    link.href = dataUrl;
    link.click();
    return dataUrl;
  });
};

// Función 2: Generar y subir al servidor para visualización con previsualización de Open Graph
window.generateAndUploadQrTicket = (nombre, apellido, email) => {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  return renderTicketOnCanvas(canvas, nombre, apellido, email).then(() => {
    const dataUrl = canvas.toDataURL('image/png');
    return fetch('api/admin.php?action=upload_pase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, image: dataUrl })
    })
    .then(res => {
      if (!res.ok) throw new Error('Error al guardar en el servidor');
      return res.json();
    })
    .then(data => {
      if (data.success) {
        // Retornar la URL de ver_pase.php para compartir en WhatsApp
        const origin = window.location.origin;
        const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
        return `${origin}${path}/ver_pase.php?email=${encodeURIComponent(email)}`;
      } else {
        throw new Error(data.error || 'Falla al guardar pase');
      }
    });
  });
};
