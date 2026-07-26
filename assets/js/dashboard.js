
  let currentUser = null;

  let apiCache = {};
  
  function clearApiCache(endpoint = null) {
    if (endpoint) {
      delete apiCache[endpoint];
    } else {
      apiCache = {};
    }
  }

  async function apiCall(endpoint, method = 'GET', body = null) {
    if (method === 'GET') {
      if (!apiCache[endpoint]) {
        apiCache[endpoint] = (async () => {
          const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
          };
          const res = await fetch('api/' + endpoint, options);
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Operación fallida');
          }
          return res.json();
        })();
      }
      return apiCache[endpoint];
    }

    // For POST/PUT/DELETE, invalidate cache and perform direct fetch
    clearApiCache();
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

  // 2. INICIALIZADOR
  async function initApp() {
    const loaderStatus = document.getElementById('loader-status');

    try {
      const sessionData = await apiCall('auth.php?action=session');
      if (!sessionData.session) { window.location.href = "index.html#/login"; return; }
      currentUser = sessionData.session.user;

      // Guardián de perfil: obtener datos y verificar si está completo
      const profileData = await loadUserProfile();
      if (!profileData) {
        window.location.href = "index.html#/login";
        return;
      }

      // Copiar datos del perfil al currentUser global
      currentUser = { ...currentUser, ...profileData };

      const isComplete = profileData.rol === 'admin' || (
        profileData.nombre && 
        profileData.apellido && 
        profileData.cedula && 
        profileData.fecha_nacimiento && 
        profileData.telefono && 
        profileData.pais && 
        profileData.ciudad
      );

      if (!isComplete) {
        // Ocultar loader para que se vea el modal de bienvenida
        document.getElementById('global-loader').classList.add('hidden');
        showWelcomeModal(profileData);
        return;
      }

      // Perfil confirmado — cargar academia en paralelo
      await startDashboardLoad();
    } catch (err) {
      console.error(err);
      document.getElementById('global-loader').classList.add('hidden');
      checkRouteAccess();
    }
  }

  async function loadHubConfigs() {
    try {
      const configs = await apiCall('configuraciones.php');
      console.log("DEBUG: loadHubConfigs fetched:", configs);
      if (configs) {
        renderSongWidget(configs.cancion_semana);
        renderRedesWidget(configs.top_redes);
      }
    } catch (err) {
      console.error('Error al cargar configuraciones del Hub:', err);
    }
  }

  async function startDashboardLoad() {
    await Promise.all([
      loadPromoBanner(),
      loadCatalog(),
      loadMyCourses('biblioteca'),
      loadMyCourses('bonus'),
      loadResources(),
      loadTopCursos(),
      loadTopMusica(),
      loadTopCuentas(),
      checkUnreadNovedades(),
      loadHubConfigs()
    ]);

    document.getElementById('global-loader').classList.add('hidden');
    checkRouteAccess();

    // Trigger floating tooltip (fade in then fade out after 5 seconds) when feed is shown
    const tooltip = document.getElementById('floating-trigger-tooltip');
    if (tooltip) {
      setTimeout(() => {
        tooltip.style.opacity = '1';
        setTimeout(() => {
          tooltip.style.opacity = '0';
        }, 5000);
      }, 3000);
    }
  }

  // 3. CARGAR CATÁLOGO (EXPLORAR)
  async function loadCatalog() {
    const grid = document.getElementById('catalog-grid');

    try {
      const [cursos, inscripciones] = await Promise.all([
        apiCall('cursos.php'),
        apiCall('inscripciones.php')
      ]);

      const enrolledIds = new Set((inscripciones || []).map(i => i.curso_id));

      // Determinar top cursos (estreno primero, luego precio descendente)
      const topIds = new Set(
        [...cursos]
          .sort((a, b) => {
            if (a.es_estreno && !b.es_estreno) return -1;
            if (!a.es_estreno && b.es_estreno) return 1;
            return (b.precio || 0) - (a.precio || 0);
          })
          .slice(0, 4)
          .map(c => c.id)
      );

      // Hero banner — primer estreno
      const estreno = cursos.find(c => c.es_estreno);
      renderHeroBanner(estreno);

      // Sort: free courses first
      cursos.sort((a, b) => {
        const aFree = a.tipo_acceso === 'gratis' ? 1 : 0;
        const bFree = b.tipo_acceso === 'gratis' ? 1 : 0;
        return bFree - aFree;
      });

      // Render course cards
      grid.innerHTML = cursos.map(c => {
        const enrolled = enrolledIds.has(c.id);
        const thumb = c.miniatura_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80';
        const classes = ['course-card'];
        if (c.es_estreno) classes.push('course-estreno');
        
        let cates = (c.categoria || '').toLowerCase().trim().split(/\s+/);
        if (cates.length === 0 || cates[0] === '') cates = [];
        cates.push('todos');
        if (c.tipo_acceso === 'gratis') cates.push('gratis');
        if (enrolled) cates.push('mis-cursos');
        if (topIds.has(c.id)) cates.push('top-cursos');

        let ctaBtn = '';
        let badgeAcceso = '';
        
        if (c.tipo_acceso === 'gratis') {
          badgeAcceso = `<span class="course-level-badge" style="background:var(--accent); color:#fff; font-weight:700;">Gratis</span>`;
          ctaBtn = enrolled
            ? `<button class="course-enroll-btn" onclick="window.location.hash='#/visor?id=${c.id}'">▶ IR AL CURSO</button>`
            : `<button class="course-enroll-btn" onclick="inscribirCurso('${c.id}', this)">ACCEDER GRATIS</button>`;
        } else {
          // Pago o Bonus
          badgeAcceso = c.precio > 0 
            ? `<span class="course-level-badge" style="background:var(--ink); color:var(--cream); font-weight:700;">$${c.precio}</span>`
            : `<span class="course-level-badge">${c.tipo_acceso.toUpperCase()}</span>`;
          
          ctaBtn = enrolled
            ? `<button class="course-enroll-btn" onclick="window.location.hash='#/visor?id=${c.id}'">▶ IR AL CURSO</button>`
            : `<button class="course-enroll-btn" onclick="window.open('https://wa.me/584121234567?text=Hola,%20quiero%20adquirir%20el%20curso:%20${encodeURIComponent(c.titulo)}', '_blank')">ADQUIRIR</button>`;
        }

        return `
  <div class="course-card" data-category="${cates.join(' ')}">
    <div class="course-thumb">
      <img src="${thumb}" alt="${c.titulo}" loading="lazy">
      ${c.es_estreno ? '<span class="course-tag-badge premiere">ESTRENO</span>' : ''}
    </div>
    <div class="course-body">
      <div class="course-instructor-row">
        <div class="course-avatar">R</div>
        <span class="course-instructor-name">${c.instructor_nombre || c.instructor || 'REFORMA'}</span>
        ${badgeAcceso}
      </div>
      <div class="course-title">${c.titulo}</div>
      <p class="course-desc">${c.descripcion || ''}</p>
      <div class="course-footer">
        <span class="course-duration">${c.duracion_total || ''}</span>
        ${ctaBtn}
      </div>
    </div>
  </div>`;
      }).join('');

      attachFilters();
      filterByCat('todos');
    } catch (err) {
      console.error(err);
    }
  }

  // ── PROMO BANNER ───────────────────────────────────────────────────
  async function loadPromoBanner() {
    const wrap = document.getElementById('promo-banner-wrap');
    if (!wrap) return;

    // Si el usuario ya lo cerró en esta sesión, no mostrarlo
    const bannerId = sessionStorage.getItem('promoBannerDismissed');

    try {
      const banners = await apiCall('banners.php?activo=1');
      const b = banners?.[0];
      if (!b) return;

      // Si fue dismissed y es el mismo banner, no mostrar
      if (bannerId === String(b.id)) return;

      const colorFondo = b.color_fondo || '#E63946';
      const colorTexto = b.color_texto || '#FFFFFF';

      const imgHtml = b.imagen_url
        ? `<img class="promo-banner-bg" src="${b.imagen_url}" alt="">`
        : '';

      const ctaHtml = b.link_url
        ? `<a class="promo-banner-cta" href="${b.link_url}" target="_blank" rel="noopener" style="color:${colorTexto};">${b.link_texto || 'Ver más'} →</a>`
        : '';

      wrap.innerHTML = `
  <div class="promo-banner" style="background:${colorFondo};color:${colorTexto};">
    ${imgHtml}
    <div class="promo-banner-body">
      <div class="promo-banner-texts">
        <div class="promo-banner-titulo">${b.titulo}</div>
        ${b.subtitulo ? `<div class="promo-banner-sub">${b.subtitulo}</div>` : ''}
      </div>
      ${ctaHtml}
    </div>
    <button class="promo-banner-close" onclick="dismissPromoBanner('${b.id}')" style="color:${colorTexto};" title="Cerrar">✕</button>
  </div>`;
    } catch (err) {
      console.error(err);
    }
  }

  function dismissPromoBanner(id) {
    sessionStorage.setItem('promoBannerDismissed', id);
    const wrap = document.getElementById('promo-banner-wrap');
    if (wrap) wrap.innerHTML = '';
  }

  function renderHeroBanner(curso) {
    const wrap = document.getElementById('hero-banner-wrap');
    if (!wrap || !curso) return;
    const thumb = curso.miniatura_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80';
    wrap.innerHTML = `
<div class="hero-banner">
  <img class="hero-banner-img" src="${thumb}" alt="${curso.titulo}">
  <div class="hero-banner-content">
    <div class="hero-estreno-badge">Estreno</div>
    <h2>${curso.titulo}</h2>
    <p>${curso.instructor_nombre || curso.instructor || 'REFORMA'} · ${curso.nivel || 'Todos los niveles'}</p>
    <button class="hero-cta" onclick="window.location.hash='#/visor?id=${curso.id}'">
      ▶ VER AHORA
    </button>
  </div>
</div>`;
  }



  function filterByCat(cat) {
    // Sync filter pills
    document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
    const pill = document.querySelector(`.cat-pill[data-filter="${cat}"]`);
    if (pill) pill.classList.add('active');
    // Sync tiles
    document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('active-tile'));
    const tile = document.querySelector(`.cat-tile[data-cat="${cat}"]`);
    if (tile) tile.classList.add('active-tile');
    // Filter cards
    const banner = document.getElementById('nuevos-banner');
    if (banner) banner.classList.toggle('visible', cat === 'nuevos');
    document.querySelectorAll('#catalog-grid .course-card').forEach(card => {
      const cats = (card.dataset.category || '').split(' ');
      card.classList.toggle('hidden-filter', !cats.includes(cat));
    });
  }

  // 4. CARGAR MI BIBLIOTECA / MIS BONUS
  async function loadMyCourses(type = 'biblioteca') {
    const gridId = type === 'bonus' ? 'bonus-grid' : 'biblioteca-grid';
    const grid = document.getElementById(gridId);
    if (!grid) return;

    try {
      const [inscripciones, progreso, cursos, lecciones] = await Promise.all([
        apiCall('inscripciones.php'),
        apiCall('progreso.php?completado=1'),
        apiCall('cursos.php'),
        apiCall('lecciones.php')
      ]);

      const cursoMap = new Map((cursos || []).map(c => [c.id, c]));

      // Filter enrollments based on type
      const filteredInscripciones = (inscripciones || []).filter(ins => {
        const curso = cursoMap.get(ins.curso_id);
        if (!curso) return false;
        if (type === 'bonus') {
          return curso.tipo_acceso === 'bonus';
        } else {
          return curso.tipo_acceso !== 'bonus';
        }
      });

      if (filteredInscripciones.length === 0) {
        grid.innerHTML = `
          <div style="grid-column:1/-1; text-align:center; padding: 60px 20px;">
            <div style="font-size:40px; margin-bottom:16px;">📚</div>
            <p class="ml" style="margin-bottom:20px;">${type === 'bonus' ? 'No tienes bonus activos aún.' : 'No tienes cursos activos aún en tu biblioteca.'}</p>
            <button class="pill-dark" onclick="window.location.hash='#/cursos'">EXPLORAR CATÁLOGO</button>
          </div>`;
        return;
      }

      const leccionesCompletadas = new Set((progreso || []).map(p => p.leccion_id));

      // Agrupar lecciones por curso
      const lecsPorCurso = {};
      (lecciones || []).forEach(l => {
        if (!lecsPorCurso[l.curso_id]) lecsPorCurso[l.curso_id] = [];
        lecsPorCurso[l.curso_id].push(l);
      });

      grid.innerHTML = filteredInscripciones.map(ins => {
        const curso = cursoMap.get(ins.curso_id);
        if (!curso) return '';
        const lecs = lecsPorCurso[curso.id] || [];
        const total = lecs.length;
        const done = lecs.filter(l => leccionesCompletadas.has(l.id)).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const completed = pct === 100 && total > 0;
        const thumb = curso.miniatura_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80';
        const btnText = completed ? '✓ COMPLETADO' : pct > 0 ? '▶ CONTINUAR' : '▶ COMENZAR';
        return `
  <div class="my-course-card" onclick="window.location.hash='#/visor?id=${curso.id}'">
    <div class="my-course-thumb">
      <img src="${thumb}" alt="${curso.titulo}" loading="lazy">
      <div class="my-course-progress-bar">
        <div class="my-course-progress-fill" style="width:${pct}%"></div>
      </div>
      ${completed ? '<span class="completed-badge">✓ COMPLETADO</span>' : ''}
    </div>
    <div class="my-course-body">
      <div class="my-course-title">${curso.titulo}</div>
      ${total > 0 ? `
      <div class="my-course-progress-text">${done} de ${total} lecciones — ${pct}%</div>
      <div class="my-course-bar-wrap"><div class="my-course-bar-fill" style="width:${pct}%"></div></div>` : ''}
      <button class="my-course-continue-btn" style="${completed ? 'background:#22c55e;' : ''}">${btnText}</button>
    </div>
  </div>`;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // 4b. CARGAR TOP CURSOS
  async function loadTopCursos() {
    const grid = document.getElementById('top-cursos-grid');
    if (!grid) return;

    try {
      const [cursos, inscripciones] = await Promise.all([
        apiCall('cursos.php'),
        apiCall('inscripciones.php')
      ]);

      const enrolledIds = new Set((inscripciones || []).map(i => i.curso_id));
      
      // Filter top courses (premiere / es_estreno first, then by price/popularity)
      const topCursos = (cursos || []).sort((a, b) => {
        if (a.es_estreno && !b.es_estreno) return -1;
        if (!a.es_estreno && b.es_estreno) return 1;
        return (b.precio || 0) - (a.precio || 0);
      });

      if (topCursos.length === 0) {
        grid.innerHTML = '<p class="ml" style="grid-column:1/-1; text-align:center; padding: 40px;">No hay cursos disponibles.</p>';
        return;
      }

      grid.innerHTML = topCursos.map(c => {
        const enrolled = enrolledIds.has(c.id);
        const thumb = c.miniatura_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80';
        
        let ctaBtn = '';
        let badgeAcceso = '';
        
        if (c.tipo_acceso === 'gratis') {
          badgeAcceso = `<span class="course-level-badge" style="background:var(--accent); color:#fff; font-weight:700;">Gratis</span>`;
          ctaBtn = enrolled
            ? `<button class="course-enroll-btn" onclick="window.location.hash='#/visor?id=${c.id}'">▶ IR AL CURSO</button>`
            : `<button class="course-enroll-btn" onclick="inscribirCurso('${c.id}', this)">ACCEDER GRATIS</button>`;
        } else {
          badgeAcceso = c.precio > 0 
            ? `<span class="course-level-badge" style="background:var(--ink); color:var(--cream); font-weight:700;">$${c.precio}</span>`
            : `<span class="course-level-badge">${c.tipo_acceso.toUpperCase()}</span>`;
          
          ctaBtn = enrolled
            ? `<button class="course-enroll-btn" onclick="window.location.hash='#/visor?id=${c.id}'">▶ IR AL CURSO</button>`
            : `<button class="course-enroll-btn" onclick="window.open('https://wa.me/584121234567?text=Hola,%20quiero%20adquirir%20el%20curso:%20${encodeURIComponent(c.titulo)}', '_blank')">ADQUIRIR</button>`;
        }

        return `
  <div class="course-card">
    <div class="course-thumb">
      <img src="${thumb}" alt="${c.titulo}" loading="lazy">
      ${c.es_estreno ? '<span class="course-tag-badge premiere">ESTRENO</span>' : ''}
    </div>
    <div class="course-body">
      <div class="course-instructor-row">
        <div class="course-avatar">R</div>
        <span class="course-instructor-name">${c.instructor_nombre || c.instructor || 'REFORMA'}</span>
        ${badgeAcceso}
      </div>
      <div class="course-title">${c.titulo}</div>
      <p class="course-desc">${c.descripcion || ''}</p>
      <div class="course-footer">
        <span class="course-duration">${c.duracion_total || ''}</span>
        ${ctaBtn}
      </div>
    </div>
  </div>`;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // 4c. CARGAR TOP MÚSICA
  async function loadTopMusica() {
    const playlistContainer = document.getElementById('top-music-playlist');
    try {
      const [config, feedItems] = await Promise.all([
        apiCall('configuraciones.php'),
        apiCall('feed.php')
      ]);
      
      const songData = config.cancion_semana || null;
      
      const titleEl = document.getElementById('top-music-song-title');
      const artistEl = document.getElementById('top-music-song-artist');
      const playBtn = document.getElementById('top-music-play-btn');
      
      if (!titleEl || !artistEl || !playBtn || !playlistContainer) return;
      
      if (songData && songData.titulo) {
        titleEl.textContent = songData.titulo;
        artistEl.textContent = songData.artista || 'ARTISTA';
        
        playBtn.style.display = 'inline-flex';
        playBtn.onclick = () => {
          if (!songAudio || songAudio.src === '' || currentSongUrl !== songData.url_audio) {
            if (songData.url_audio) {
              startSongOfWeek(songData.url_audio, songData.titulo);
            }
          } else {
            // Alternar Play/Pause si ya está cargada
            if (songAudio.paused) {
              songAudio.play();
              const topMusicPlayIcon = document.getElementById('top-music-play-icon');
              if (topMusicPlayIcon) {
                topMusicPlayIcon.className = 'fas fa-pause';
                playBtn.style.padding = '0';
              }
              const panelPlayIcon = document.getElementById('panel-song-play-icon');
              if (panelPlayIcon) panelPlayIcon.className = 'fas fa-pause';
            } else {
              songAudio.pause();
              const topMusicPlayIcon = document.getElementById('top-music-play-icon');
              if (topMusicPlayIcon) {
                topMusicPlayIcon.className = 'fas fa-play';
                playBtn.style.padding = '0 0 0 3px';
              }
              const panelPlayIcon = document.getElementById('panel-song-play-icon');
              if (panelPlayIcon) panelPlayIcon.className = 'fas fa-play';
            }
          }
        };
      } else {
        titleEl.textContent = 'Ninguna canción asignada';
        artistEl.textContent = 'ARTISTA';
        playBtn.style.display = 'none';
      }

      // Enlazar evento click al slider wrap para cambiar posición de reproducción
      const sliderWrap = document.getElementById('top-music-slider-wrap');
      if (sliderWrap) {
        sliderWrap.onclick = (e) => {
          if (!songAudio || songAudio.duration === 0 || isNaN(songAudio.duration)) return;
          const rect = sliderWrap.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const width = rect.width;
          const pct = clickX / width;
          songAudio.currentTime = pct * songAudio.duration;
        };
      }

      // Filtrar canciones históricas del feed
      const songs = (feedItems || []).filter(item => item.tipo === 'cancion');

       // Construir la playlist completa: primero la canción de la semana, luego el historial
      const allTracks = [];
      if (songData && songData.titulo) {
        allTracks.push({ titulo: songData.titulo, artista: songData.artista || '—', url: songData.url_audio, esSemana: true });
      }
      songs.forEach(s => {
        let cleanTitle = s.titulo;
        let artist = s.descripcion || '—';
        
        // Limpiar títulos históricos viejos si tienen el prefijo de antes
        if (cleanTitle.startsWith('Nueva canción de la semana: ')) {
          cleanTitle = cleanTitle.replace('Nueva canción de la semana: ', '');
        }
        
        // Si la descripción es la genérica y el título contiene " - ", extraer el artista
        if ((artist.includes('Escucha la canción') || artist.includes('Escucha la melodía')) && cleanTitle.includes(' - ')) {
          const parts = cleanTitle.split(' - ');
          cleanTitle = parts[0];
          artist = parts[1];
        }
        
        allTracks.push({ titulo: cleanTitle, artista: artist, url: s.embed_code, esSemana: false });
      });

      let activeIdx = 0;

      const renderPlaylist = () => {
        playlistContainer.innerHTML = allTracks.map((track, idx) => {
          const isActive = idx === activeIdx;
          return `
            <div onclick="window._playTrack(${idx})" style="display: flex; align-items: center; gap: 16px; padding: 14px 20px; cursor: pointer; transition: background 0.15s; background: ${isActive ? 'rgba(0,0,0,0.05)' : 'transparent'}; ${idx < allTracks.length - 1 ? 'border-bottom: 1px solid var(--line);' : ''}">
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${isActive ? 'var(--ink)' : 'var(--muted)'}; min-width: 20px;">${isActive ? '<i class="fas fa-volume-up" style="font-size:10px;"></i>' : String(idx + 1).padStart(2, '0')}</span>
              <div style="flex: 1; min-width: 0;">
                <div style="font-size: 12px; font-weight: ${isActive ? '900' : '700'}; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${track.titulo}</div>
                <div style="font-size: 9px; color: var(--muted); font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.05em;">${track.artista}</div>
              </div>
              ${track.esSemana ? '<span style="font-size: 8px; font-weight: 800; color: var(--accent); font-family: \'JetBrains Mono\', monospace; text-transform: uppercase; letter-spacing: 0.08em;">Esta semana</span>' : ''}
            </div>
          `;
        }).join('');
      };

      window._playTrack = (idx) => {
        if (idx < 0 || idx >= allTracks.length) return;
        
        const track = allTracks[idx];
        const titleEl = document.getElementById('top-music-song-title');
        const artistEl = document.getElementById('top-music-song-artist');
        
        if (activeIdx === idx && songAudio && songAudio.src !== '') {
          // Si hace clic en la misma canción activa, alternar Play/Pause
          if (songAudio.paused) {
            songAudio.play();
            const topMusicPlayIcon = document.getElementById('top-music-play-icon');
            if (topMusicPlayIcon) {
              topMusicPlayIcon.className = 'fas fa-pause';
              if (playBtn) playBtn.style.padding = '0';
            }
          } else {
            songAudio.pause();
            const topMusicPlayIcon = document.getElementById('top-music-play-icon');
            if (topMusicPlayIcon) {
              topMusicPlayIcon.className = 'fas fa-play';
              if (playBtn) playBtn.style.padding = '0 0 0 3px';
            }
          }
        } else {
          // Cambiar de canción
          activeIdx = idx;
          if (titleEl) titleEl.textContent = track.titulo;
          if (artistEl) artistEl.textContent = track.artista;
          renderPlaylist();
          if (track.url) startSongOfWeek(track.url, track.titulo);
        }
      };

      renderPlaylist();

      // Auto-cargar la primera canción en el player sin reproducirla
      if (allTracks.length > 0) {
        const first = allTracks[0];
        if (titleEl) titleEl.textContent = first.titulo;
        if (artistEl) artistEl.textContent = first.artista;
      }

    } catch (err) {
      console.error(err);
      if (playlistContainer) {
        playlistContainer.innerHTML = '<p class="ml" style="text-align: center; padding: 20px; font-size: 11px;">Error al cargar la playlist.</p>';
      }
    }
  }

  // 4d. CARGAR TOP CUENTAS
  async function loadTopCuentas() {
    const list = document.getElementById('top-cuentas-list');
    if (!list) return;

    try {
      const config = await apiCall('configuraciones.php');
      const redesList = config.top_redes || [];
      
      if (redesList.length === 0) {
        list.innerHTML = '<p class="ml" style="text-align:center; padding: 40px;">No hay cuentas recomendadas.</p>';
        return;
      }

      list.innerHTML = redesList.map(red => {
        const avatar = red.avatar_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=200&q=80';
        const username = red.username || '@cuenta';
        const desc = red.descripcion || '';
        const link = red.url || '#';

        return `
          <div style="background:var(--cream); border:1px solid var(--line); border-radius:16px; padding:20px; max-width:500px; margin:0 auto 16px; color:var(--ink); width:100%; display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; align-items:center; gap:16px;">
              <img src="${avatar}" alt="${username}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; border: 1px solid var(--line); flex-shrink:0;">
              <div style="flex:1; min-width:0;">
                <h3 style="margin:0 0 4px; font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${username}</h3>
                <p style="margin:0; font-size:12px; color:var(--muted); line-height:1.4;">${desc}</p>
              </div>
            </div>
            <a href="${link}" target="_blank" class="pill-dark" style="display:block; text-align:center; font-size:11px; font-weight:700; padding:10px; border-radius:8px; text-decoration:none; background:var(--ink); color:var(--cream); border:none;">
              VISITAR PERFIL
            </a>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // 5. CARGAR RECURSOS PDF
  async function loadResources() {
    const container = document.getElementById('descargables-grid');
    if (!container) return;

    try {
      const [lecciones, cursos] = await Promise.all([
        apiCall('lecciones.php'),
        apiCall('cursos.php')
      ]);

      const items = [];

      // Materiales de lección (PDF por lección)
      (lecciones || []).forEach(l => {
        if (l.pdf_url) {
          items.push({ titulo: l.titulo, url: l.pdf_url, subtitulo: 'Material de lección', tipo: 'PDF' });
        }
      });

      // Materiales de curso
      (cursos || []).forEach(c => {
        const mats = Array.isArray(c.materiales) ? c.materiales : [];
        mats.forEach(m => {
          if (m.url) items.push({ titulo: m.titulo || 'Material', url: m.url, subtitulo: c.titulo, tipo: 'DOC' });
        });
      });

      if (items.length === 0) {
        container.innerHTML = '<p class="ml" style="text-align:center;padding:40px 0;">No hay recursos disponibles aún.</p>';
        return;
      }

      container.innerHTML = items.map(item => `
        <div class="pdf-card">
          <div style="display:flex; gap:16px; align-items:center;">
            <div class="pdf-icon-wrap" style="background:var(--accent);">${item.tipo}</div>
            <div>
              <h3 style="font-size:14px; font-weight:800;">${item.titulo}</h3>
              <p style="font-size:11px; color:var(--muted);">${item.subtitulo}</p>
            </div>
          </div>
          <a href="${item.url}" target="_blank" rel="noopener" class="pill-outline" style="width:100%; text-align:center;">↓ DESCARGAR</a>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // 6. CLASES GRABADAS
  async function loadClasesGrabadas() {
    const grid = document.getElementById('clases-grid');
    if (!grid) return;

    try {
      const [lecciones, cursos] = await Promise.all([
        apiCall('lecciones.php'),
        apiCall('cursos.php')
      ]);

      const lecsGrabadas = (lecciones || []).filter(l => l.video_url !== null);

      if (lecsGrabadas.length === 0) {
        grid.innerHTML = '<p class="ml" style="grid-column:1/-1;text-align:center;">No hay clases grabadas disponibles aún.</p>';
        return;
      }

      const cursoMap = new Map((cursos || []).map(c => [c.id, c]));

      grid.innerHTML = lecsGrabadas.map(l => {
        const curso = cursoMap.get(l.curso_id);
        const thumb = l.miniatura_url || curso?.miniatura_url || 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80';
        const dur = l.duracion_min ? `${l.duracion_min} min` : '';
        return `
  <div class="course-card" onclick="abrirLeccion('${l.id}','${l.curso_id}')">
    <div class="course-thumb">
      <img src="${thumb}" alt="${l.titulo}" loading="lazy">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
        <div style="width:44px;height:44px;background:rgba(255,255,255,0.9);border-radius:50%;display:grid;place-items:center;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--ink)" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <span class="course-cat-badge">CLASE</span>
    </div>
    <div class="course-body">
      <div class="course-instructor-row">
        <div class="course-avatar">R</div>
        <span class="course-instructor-name">REFORMA</span>
        ${dur ? `<span class="course-level-badge">${dur}</span>` : ''}
      </div>
      <div class="course-title">${l.titulo}</div>
      ${curso ? `<div class="course-meta-row"><span class="course-meta-item">${curso.titulo}</span></div>` : ''}
    </div>
  </div>`; }).join('');
    } catch (err) {
      console.error(err);
    }
  }

  // 7. FUNCIONES AUXILIARES
  async function inscribirCurso(cursoId, btn) {
    if (!currentUser) { window.location.href = 'index.html#/login'; return; }
    const orig = btn.textContent;
    btn.textContent = 'AÑADIENDO...'; btn.disabled = true;

    try {
      await apiCall('inscripciones.php', 'POST', { curso_id: cursoId });
      btn.textContent = '✓ EN MIS ENTRENAMIENTOS'; btn.style.background = '#22c55e';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; }, 3000);
      loadMyCourses();
    } catch (err) {
      console.error(err);
      btn.textContent = 'ERROR'; btn.style.background = '#ef4444';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; btn.disabled = false; }, 2500);
    }
  }

  function attachFilters() {
    const filterBar = document.getElementById('explore-filters');
    if (!filterBar || filterBar._filtersAttached) return;
    filterBar._filtersAttached = true;
    filterBar.addEventListener('click', e => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      // Sync tiles
      document.querySelectorAll('.cat-tile').forEach(t => t.classList.remove('active-tile'));
      const filter = pill.dataset.filter;
      const matchTile = document.querySelector(`.cat-tile[data-cat="${filter}"]`);
      if (matchTile) matchTile.classList.add('active-tile');
      const banner = document.getElementById('nuevos-banner');
      if (banner) banner.classList.toggle('visible', filter === 'nuevos');
      document.querySelectorAll('#catalog-grid .course-card').forEach(card => {
        const cats = (card.dataset.category || '').split(' ');
        card.classList.toggle('hidden-filter', !cats.includes(filter));
      });
    });
  }

  document.getElementById('global-search')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#catalog-grid .course-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.classList.toggle('hidden-filter', q.length > 0 && !text.includes(q));
    });
    if (q.length > 0 && document.getElementById('page-cursos') && !document.getElementById('page-cursos').classList.contains('active')) {
      window.location.hash = '#/cursos';
    }
  });

  // 8. VISOR FUNCTIONS
  let currentLeccion = null;
  let currentCursoLecciones = [];
  let visorProgresoSet = new Set(); 

  async function loadVisor(cursoId) {
    try {
      const [curso, lecciones, progreso] = await Promise.all([
        apiCall('cursos.php?id=' + cursoId),
        apiCall('lecciones.php?curso_id=' + cursoId),
        apiCall('progreso.php?completado=1')
      ]);

      if (!curso) return;
      currentCursoLecciones = lecciones || [];
      
      const lecsDelCurso = new Set(currentCursoLecciones.map(l => l.id));
      visorProgresoSet = new Set((progreso || []).filter(p => lecsDelCurso.has(p.leccion_id)).map(p => p.leccion_id));

      // Nombre del curso en el sidebar
      document.getElementById('playlist-name').textContent = curso.titulo;

      // Cargar stats del usuario en el sidebar
      loadUserStatsCard(cursoId);

      if (!lecciones || lecciones.length === 0) {
        document.getElementById('current-video-title').textContent = curso.titulo;
        document.getElementById('current-video-desc').textContent = 'Este curso no tiene lecciones disponibles aún.';
        document.getElementById('playlist-container').innerHTML =
          '<p style="padding:20px;font-family:\'JetBrains Mono\',monospace;font-size:10px;color:var(--muted);text-transform:uppercase;">Sin lecciones disponibles</p>';
        return;
      }

      renderPlaylist(lecciones, cursoId);

      // Continuar desde la última lección no completada, o la primera
      const nextLeccion = lecciones.find(l => !visorProgresoSet.has(l.id)) || lecciones[0];
      reproducirLeccion(nextLeccion);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadUserStatsCard(cursoId) {
    if (!currentUser) return;

    // Nombre del usuario (ya cargado en perfil)
    const nombreEl  = document.getElementById('visor-user-name');
    const emailEl   = document.getElementById('visor-user-email');
    const avatarEl  = document.getElementById('visor-avatar');

    try {
      const perfil = await apiCall('usuarios.php?id=' + currentUser.id);
      const nombre = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : currentUser.email;
      const initial = nombre.charAt(0).toUpperCase();
      if (nombreEl) nombreEl.textContent = nombre || '—';
      if (emailEl) emailEl.textContent = currentUser.email;
      if (avatarEl) {
        const avatarUrl = currentUser.avatar_url || currentUser.picture;
        if (avatarUrl) {
          avatarEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          avatarEl.textContent = initial;
        }
      }

      // Stats
      const [progreso, inscripciones, lecsDelCurso] = await Promise.all([
        apiCall('progreso.php?completado=1'),
        apiCall('inscripciones.php'),
        apiCall('lecciones.php?curso_id=' + cursoId)
      ]);

      const totalCompletadas = progreso?.length || 0;
      const totalCursos      = inscripciones?.length || 0;
      const totalLecs        = lecsDelCurso?.length || 0;
      const donaEnCurso      = (lecsDelCurso || []).filter(l => visorProgresoSet.has(l.id)).length;
      const pctCurso         = totalLecs > 0 ? Math.round((donaEnCurso / totalLecs) * 100) : 0;

      const statComp  = document.getElementById('stat-completadas');
      const statCurs  = document.getElementById('stat-cursos');
      const statPct   = document.getElementById('stat-pct');
      if (statComp) statComp.textContent = totalCompletadas;
      if (statCurs) statCurs.textContent = totalCursos;
      if (statPct)  statPct.textContent  = pctCurso + '%';
    } catch (err) {
      console.error(err);
    }
  }

  function renderPlaylist(lecciones, cursoId) {
    const container = document.getElementById('playlist-container');

    // Agrupar por sección
    const sections = {};
    lecciones.forEach((l, i) => {
      const sec = l.seccion || 'Contenido';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push({ ...l, _idx: i });
    });

    let html = '';
    Object.entries(sections).forEach(([secName, items]) => {
      html += `<div class="playlist-section-hdr">${secName}</div>`;
      items.forEach(l => {
        const done   = visorProgresoSet.has(l.id);
        const durMin = l.duracion_min ? `${l.duracion_min} min` : '';
        html += `
<div class="playlist-item" id="pli-${l.id}" data-idx="${l._idx}" style="display:flex;align-items:center;gap:12px;padding:14px 20px;cursor:pointer;border-bottom:1px solid var(--line);transition:background .2s;">
  <div style="width:26px;height:26px;border-radius:50%;border:1.5px solid ${done ? '#22c55e' : 'var(--line)'};background:${done ? '#22c55e' : 'transparent'};display:grid;place-items:center;flex-shrink:0;transition:all .2s;">
    ${done
      ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
      : `<span style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);">${l._idx + 1}</span>`}
  </div>
  <div style="flex:1;min-width:0;">
    <p style="font-size:13px;font-weight:600;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.titulo}</p>
    <p style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--muted);margin:0;text-transform:uppercase;">${durMin}</p>
  </div>
  ${done ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--line)" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'}
</div>`;
      });
    });

    container.innerHTML = html;

    container.querySelectorAll('.playlist-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        reproducirLeccion(currentCursoLecciones[idx]);
      });
    });

    updateProgress(lecciones);
  }

  function reproducirLeccion(l) {
    currentLeccion = l;
    const iframe = document.getElementById('main-video');
    const audioPlaceholder = document.getElementById('audio-placeholder');
    
    if (l.audio_url) {
      // Es una lección de audio
      if (iframe) {
        iframe.style.display = 'none';
        iframe.src = '';
      }
      if (audioPlaceholder) {
        audioPlaceholder.style.display = 'flex';
      }
      initMicroPlayer(l.audio_url, l.titulo, 'Lección de Audio');
    } else {
      // Es una lección de video
      if (iframe) {
        iframe.style.display = 'block';
        let src = l.video_url || '';
        const ytMatch = src.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([^&\s?]+)/);
        if (ytMatch) src = `https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1`;
        iframe.src = src;
      }
      if (audioPlaceholder) {
        audioPlaceholder.style.display = 'none';
      }
      pauseAllAudio();
    }
    
    document.getElementById('current-video-title').textContent = l.titulo;
    document.getElementById('current-video-desc').textContent = l.descripcion || '';
    const pdfBtn = document.getElementById('btn-pdf-download');
    pdfBtn.style.display = l.pdf_url ? '' : 'none';
    pdfBtn.onclick = () => window.open(l.pdf_url, '_blank');
    // Highlight active
    document.querySelectorAll('.playlist-item').forEach(el => el.style.background = '');
    const activeEl = document.getElementById('pli-' + l.id);
    if (activeEl) { activeEl.style.background = 'rgba(0,0,0,0.05)'; activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    // Sync "marcar completado" button state
    const btn = document.getElementById('btn-completar');
    if (btn) {
      const done = visorProgresoSet.has(l.id);
      btn.textContent = done ? '✓ COMPLETADO' : '✓ MARCAR COMO COMPLETADO';
      btn.style.background = done ? '#22c55e' : '';
    }
  }

  function abrirLeccion(leccionId, cursoId) {
    window.location.hash = '#/visor?id=' + cursoId;
  }

  function updateProgress(lecciones) {
    const done = lecciones.filter(l => visorProgresoSet.has(l.id)).length;
    const pct  = lecciones.length ? Math.round((done / lecciones.length) * 100) : 0;
    const bar  = document.getElementById('progress-bar');
    const txt  = document.getElementById('progress-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = `${done} de ${lecciones.length} completadas · ${pct}%`;
  }

  document.getElementById('btn-completar')?.addEventListener('click', async () => {
    if (!currentLeccion || !currentUser) return;
    const lecId = currentLeccion.id;
    const ya    = visorProgresoSet.has(lecId);
    const btn   = document.getElementById('btn-completar');
    btn.disabled = true;

    try {
      await apiCall('progreso.php', 'POST', { leccion_id: lecId, completado: !ya });
      if (ya) {
        visorProgresoSet.delete(lecId);
      } else {
        visorProgresoSet.add(lecId);
      }
      reproducirLeccion(currentLeccion);
      renderPlaylist(currentCursoLecciones, currentLeccion.curso_id);
      loadUserStatsCard(currentLeccion.curso_id);
    } catch (err) {
      console.error(err);
    } finally {
      btn.disabled = false;
    }
  });

  async function loadUserProfile() {
    if (!currentUser) return null;
    try {
      const data = await apiCall('usuarios.php?id=' + currentUser.id);
      
      const initialsEl = document.getElementById('user-initials');
      if (initialsEl) {
        const avatarUrl = data.avatar_url || currentUser.avatar_url || currentUser.picture;
        if (avatarUrl) {
          initialsEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          initialsEl.innerText = data.nombre ? data.nombre.charAt(0).toUpperCase() : '?';
        }
      }
      const emailEl = document.getElementById('display-email');
      if (emailEl) emailEl.value = data.email || currentUser.email || '';
      const form = document.getElementById('profile-form');
      if (form) {
        if (form.nombre)           form.nombre.value           = data.nombre           || '';
        if (form.apellido)         form.apellido.value         = data.apellido         || '';
        if (form.telefono)         form.telefono.value         = data.telefono         || '';
        if (form.cedula)           form.cedula.value           = data.cedula           || '';
        if (form.fecha_nacimiento) form.fecha_nacimiento.value = data.fecha_nacimiento || '';
        if (form.pais)             form.pais.value             = data.pais             || 'VE';
        if (form.ciudad)           form.ciudad.value           = data.ciudad           || '';
        if (form.nivel_estudios)   form.nivel_estudios.value   = data.nivel_estudios   || '';
        if (form.ocupacion)        form.ocupacion.value        = data.ocupacion        || '';
        if (form.motivacion)       form.motivacion.value       = data.motivacion       || '';
      }
      if (data.rol === 'admin') {
        const adminSection = document.getElementById('sidebar-admin-section');
        if (adminSection) adminSection.style.display = 'flex';
        const adminAccess = document.getElementById('admin-access-section');
        if (adminAccess) adminAccess.style.display = 'block';
      }
      return data;
    } catch (e) {
      console.error('loadUserProfile error:', e);
      return null;
    }
  }

  function showWelcomeModal(data) {
    const modal = document.getElementById('welcome-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Rellenar campos si existen
    document.getElementById('m-perfil-nombre').value = data.nombre || currentUser.nombre || '';
    document.getElementById('m-perfil-apellido').value = data.apellido || currentUser.apellido || '';
    document.getElementById('m-perfil-cedula').value = data.cedula || '';
    document.getElementById('m-perfil-fecha').value = data.fecha_nacimiento || '';
    document.getElementById('m-perfil-whatsapp').value = data.telefono || data.whatsapp || '';
    document.getElementById('m-perfil-pais').value = data.pais || 'VE';
    document.getElementById('m-perfil-ciudad').value = data.ciudad || '';
    
    if (document.getElementById('m-perfil-nivel')) {
      document.getElementById('m-perfil-nivel').value = data.nivel_estudios || '';
    }
    if (document.getElementById('m-perfil-ocupacion')) {
      document.getElementById('m-perfil-ocupacion').value = data.ocupacion || '';
    }
    if (document.getElementById('m-perfil-motivacion')) {
      document.getElementById('m-perfil-motivacion').value = data.motivacion || '';
    }
    
    updateModalProfileProgress();
  }

  function updateModalProfileProgress() {
    const fields = [
      'm-perfil-nombre', 'm-perfil-apellido', 'm-perfil-cedula', 
      'm-perfil-fecha', 'm-perfil-whatsapp', 'm-perfil-pais', 'm-perfil-ciudad'
    ];
    let filled = 0;
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value.trim() !== '') {
        filled++;
      }
    });
    const pct = Math.round((filled / fields.length) * 100);
    const fill = document.querySelector('#modal-profile-progress .progress-fill');
    const txt = document.getElementById('modal-progress-text');
    if (fill) fill.style.width = pct + '%';
    if (txt) txt.textContent = pct + '% COMPLETADO';
  }

  document.addEventListener('input', (e) => {
    if (e.target.id && e.target.id.startsWith('m-perfil-')) {
      updateModalProfileProgress();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id && e.target.id.startsWith('m-perfil-')) {
      updateModalProfileProgress();
    }
  });

  document.getElementById('modal-form-perfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Limpiar errores previos
    document.querySelectorAll('#modal-form-perfil .form-error').forEach(el => el.textContent = '');
    
    const btn = document.getElementById('btn-m-guardar-perfil');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';
    
    const nombre = document.getElementById('m-perfil-nombre').value.trim();
    const apellido = document.getElementById('m-perfil-apellido').value.trim();
    const cedula = document.getElementById('m-perfil-cedula').value.trim();
    const fecha = document.getElementById('m-perfil-fecha').value;
    const whatsapp = document.getElementById('m-perfil-whatsapp').value.trim();
    const pais = document.getElementById('m-perfil-pais').value;
    const ciudad = document.getElementById('m-perfil-ciudad').value.trim();
    
    let hasError = false;
    if (!nombre) { document.getElementById('err-m-perfil-nombre').textContent = 'El nombre es obligatorio.'; hasError = true; }
    if (!apellido) { document.getElementById('err-m-perfil-apellido').textContent = 'El apellido es obligatorio.'; hasError = true; }
    if (!cedula) { document.getElementById('err-m-perfil-cedula').textContent = 'La cédula/ID es obligatoria.'; hasError = true; }
    if (!fecha) { document.getElementById('err-m-perfil-fecha').textContent = 'La fecha de nacimiento es obligatoria.'; hasError = true; }
    if (!whatsapp) { document.getElementById('err-m-perfil-whatsapp').textContent = 'El WhatsApp es obligatorio.'; hasError = true; }
    if (!pais) { document.getElementById('err-m-perfil-pais').textContent = 'El país es obligatorio.'; hasError = true; }
    if (!ciudad) { document.getElementById('err-m-perfil-ciudad').textContent = 'La ciudad es obligatoria.'; hasError = true; }
    
    if (hasError) {
      btn.disabled = false;
      btn.textContent = origText;
      return;
    }
    
    const payload = {
      id: currentUser.id,
      email: currentUser.email,
      nombre,
      apellido,
      cedula,
      fecha_nacimiento: fecha,
      telefono: whatsapp,
      whatsapp: whatsapp,
      pais,
      ciudad,
      nivel_estudios: document.getElementById('m-perfil-nivel')?.value || null,
      ocupacion: document.getElementById('m-perfil-ocupacion')?.value.trim() || null,
      motivacion: document.getElementById('m-perfil-motivacion')?.value.trim() || null,
      rol: 'alumno'
    };
    
    try {
      const data = await apiCall('usuarios.php', 'POST', payload);
      currentUser = { ...currentUser, ...data };
      
      // Ocultar modal
      document.getElementById('welcome-modal').style.display = 'none';
      
      // Cargar resto de la academia
      const loaderStatus = document.getElementById('loader-status');
      if (loaderStatus) loaderStatus.innerText = 'Cargando academia...';
      document.getElementById('global-loader').classList.remove('hidden');
      
      await loadUserProfile(); // refrescar UI del perfil
      await startDashboardLoad();
      showToast('¡Registro completado con éxito!', 'success');
    } catch (err) {
      console.error('Error al guardar perfil desde modal:', err);
      showToast('Error al guardar el perfil. Inténtalo de nuevo.', 'error');
      btn.disabled = false;
      btn.textContent = origText;
    }
  });

  const routes = {
    '': 'page-inicio', '#/inicio': 'page-inicio', '#/cursos': 'page-cursos', 
    '#/tops': 'page-tops', '#/biblioteca': 'page-biblioteca', 
    '#/visor': 'page-visor', '#/ajustes': 'page-ajustes'
  };

  // ── REPRODUCTORES Y CONFIGURACIONES DE AUDIO GLOBALES ──────────
  let songAudio = null;
  let currentSongUrl = '';
  let microAudio = new Audio();
  let currentFloatingSongData = null;
  let floatPlayerDismissed = false;
  let isPlayingTransition = false;

  function pauseAllAudio() {
    if (songAudio && !songAudio.paused) {
      songAudio.pause();
      const playIcon = document.getElementById('panel-song-play-icon');
      if (playIcon) playIcon.className = 'fas fa-play';
      updateFloatingTriggerAudioState(false);
      
      const playBtn = document.querySelector('.cancion-play-btn-feed');
      if (playBtn) playBtn.innerHTML = '<i class="fas fa-play"></i> Reproducir';

      const topMusicPlayIcon = document.getElementById('top-music-play-icon');
      if (topMusicPlayIcon) topMusicPlayIcon.className = 'fas fa-play';
    }
    if (microAudio && !microAudio.paused) {
      microAudio.pause();
      const playIcon = document.getElementById('micro-play-icon');
      if (playIcon) playIcon.className = 'fas fa-play';
    }
  }

  function checkRouteAccess() {
    window.scrollTo(0, 0);
    const fullHash = window.location.hash || '';
    const hash = fullHash.split('?')[0] || '';
    const targetId = routes[hash] || 'page-inicio';
    document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
    if (document.getElementById(targetId)) document.getElementById(targetId).classList.add('active');
    document.querySelectorAll('.nav-item-app').forEach(nav => nav.classList.remove('active'));
    
    // Resaltar botón activo en la sidebar y bottom-nav
    const pageKey = (hash === '#/inicio' || hash === '') ? 'inicio' :
                    hash === '#/cursos' ? 'cursos' :
                    hash === '#/biblioteca' ? 'biblioteca' :
                    hash === '#/ajustes' ? 'ajustes' : '';
                    
    if (pageKey) {
      const activeSidebarBtn = document.getElementById('nav-btn-' + pageKey);
      if (activeSidebarBtn) activeSidebarBtn.classList.add('active');
      const activeMobileBtn = document.getElementById('mobile-nav-btn-' + pageKey);
      if (activeMobileBtn) activeMobileBtn.classList.add('active');
    }

    // Cargar contenido de la página Inicio
    if (hash === '#/inicio' || hash === '') {
      loadInicioPage();
    }
    // Tops Page
    if (hash === '#/tops') {
      switchTopsTab('musica');
    }
    // Biblioteca Page
    if (hash === '#/biblioteca') {
      switchBiblioTab('cursos');
    }
    // Visor de clases
    if (hash === '#/visor') {
      const params = new URLSearchParams(fullHash.split('?')[1] || '');
      const id = params.get('id');
      if (id) loadVisor(id);
    }
    // Ajustes
    if (hash === '#/ajustes') {
      loadUserProfile();
    }
  }

  async function handleLogout() {
    try {
      await apiCall('auth.php?action=logout');
    } catch (e) {}
    window.location.href = "index.html";
  }

  // ── INICIO Y NOVEDADES ─────────────────────────────────────────
  async function loadInicioPage() {
    const timelineContainer = document.getElementById('feed-timeline-container');
    const cancionBody = document.getElementById('widget-cancion-body');
    const redesList = document.getElementById('widget-redes-list');

    try {
      // 1. Cargar configuraciones (Canción y Redes)
      const configs = await apiCall('configuraciones.php');
      console.log("DEBUG: loadInicioPage configs fetched:", configs);
      if (configs) {
        renderSongWidget(configs.cancion_semana);
        renderRedesWidget(configs.top_redes);
      }
    } catch (err) {
      console.error('Error al cargar configuraciones de Inicio:', err);
    }

    try {
      // 2. Cargar Timeline unificado de Feed
      const feedItems = await apiCall('feed.php');
      renderFeedTimeline(feedItems);
    } catch (err) {
      console.error('Error al cargar el feed de novedades:', err);
      if (timelineContainer) timelineContainer.innerHTML = '<p class="ml">Error al conectar con el servidor.</p>';
    }
  }

  // ── PANEL INTELIGENTE Y REPRODUCTORES ──────────────────────────
  
  function toggleSmartPanel() {
    const panel = document.getElementById('reforma-smart-panel');
    const overlay = document.getElementById('reforma-smart-panel-overlay');
    if (!panel || !overlay) return;
    
    if (panel.classList.contains('open')) {
      closeSmartPanel();
    } else {
      overlay.style.display = 'block';
      setTimeout(() => {
        overlay.style.opacity = '1';
        panel.classList.add('open');
      }, 10);
    }
  }

  function closeSmartPanel() {
    const panel = document.getElementById('reforma-smart-panel');
    const overlay = document.getElementById('reforma-smart-panel-overlay');
    if (!panel || !overlay) return;

    panel.classList.remove('open');
    overlay.style.opacity = '0';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);
  }

  // ── FLOATING TRIGGER DYNAMIC ICON & CYCLE LOGIC ──────────────────
  let floatingCycleInterval = null;

  function updateFloatingTriggerAudioState(playing) {
    const icon = document.getElementById('floating-trigger-icon');
    const circle = document.querySelector('.floating-progress-circle');
    const songCard = document.getElementById('panel-song-card');
    
    if (songCard) {
      if (playing) {
        songCard.classList.add('playing');
      } else {
        songCard.classList.remove('playing');
      }
    }

    const musicIcon = document.getElementById('hub-sleeve-music-icon');
    const sleeveEq = document.getElementById('hub-sleeve-equalizer');
    if (musicIcon && sleeveEq) {
      if (playing) {
        musicIcon.style.display = 'none';
        sleeveEq.style.display = 'flex';
      } else {
        musicIcon.style.display = 'inline-block';
        sleeveEq.style.display = 'none';
      }
    }
    
    if (playing) {
      stopFloatingTriggerCycle();
      if (icon) {
        icon.className = 'fas fa-pause';
        icon.classList.remove('icon-pulse');
      }
      if (circle) {
        circle.style.display = 'block';
        circle.style.strokeDasharray = '131.95 131.95';
        circle.style.strokeDashoffset = '131.95';
      }
    } else {
      if (circle) {
        circle.style.display = 'none';
        circle.style.strokeDashoffset = '131.95';
      }
      startFloatingTriggerCycle();
    }
  }

  function startFloatingTriggerCycle() {
    stopFloatingTriggerCycle();

    const icon = document.getElementById('floating-trigger-icon');
    const circle = document.querySelector('.floating-progress-circle');
    if (!icon) return;

    if (circle) {
      circle.style.display = 'none';
      circle.style.strokeDashoffset = '131.95';
    }

    const icons = ['fas fa-headphones', 'fab fa-instagram', 'fab fa-tiktok', 'fab fa-youtube'];
    let index = 0;

    const tick = () => {
      if (songAudio && !songAudio.paused) {
        updateFloatingTriggerAudioState(true);
        return;
      }

      icon.className = icons[index % icons.length];
      index++;

      // Trigger pulse animation
      icon.classList.remove('icon-pulse');
      void icon.offsetWidth; // Trigger reflow
      icon.classList.add('icon-pulse');
    };

    tick();
    floatingCycleInterval = setInterval(tick, 2200); // Rotate every 2.2s
  }

  function stopFloatingTriggerCycle() {
    if (floatingCycleInterval) {
      clearInterval(floatingCycleInterval);
      floatingCycleInterval = null;
    }
  }

  // Inicializar Botón Flotante Interactivo (Draggable via Pointer Events)
  function initDraggableTrigger() {
    const trigger = document.getElementById('reforma-floating-trigger');
    if (!trigger) return;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let isDragging = false;



    // 1. Posición inicial abajo a la derecha (con offset en móvil por la bottom nav)
    const isMobile = window.innerWidth <= 768;
    trigger.style.left = 'calc(100vw - 76px)';
    trigger.style.top = isMobile ? 'calc(100vh - 148px)' : 'calc(100vh - 88px)';

    // 2. Elegir entrada aleatoria
    const entryAnimations = ['entry-spring', 'entry-bounce-down', 'entry-glide-reveal'];
    const selectedAnimation = entryAnimations[Math.floor(Math.random() * entryAnimations.length)];
    trigger.classList.add(selectedAnimation);

    // Cuando termina la animación de entrada, activar la flotación persistente
    const animationEndHandler = (e) => {
      if (entryAnimations.includes(e.animationName) || e.animationName.toLowerCase().includes('entry')) {
        trigger.classList.remove(selectedAnimation);
        trigger.classList.add('idle-floating');
        trigger.removeEventListener('animationend', animationEndHandler);
      }
    };
    trigger.addEventListener('animationend', animationEndHandler);

    trigger.addEventListener('pointerdown', (e) => {
      trigger.classList.remove('idle-floating');
      trigger.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = trigger.offsetLeft;
      initialTop = trigger.offsetTop;
      isDragging = false;
      trigger.style.transition = 'none';
    });

    trigger.addEventListener('pointermove', (e) => {
      if (!trigger.hasPointerCapture(e.pointerId)) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragging = true;
      }

      // Restricción dentro de los límites de la pantalla
      let newLeft = initialLeft + dx;
      let newTop = initialTop + dy;

      const maxLeft = window.innerWidth - trigger.offsetWidth;
      const bottomNavHeight = (window.innerWidth <= 768) ? 60 : 0;
      const maxTop = window.innerHeight - trigger.offsetHeight - bottomNavHeight;

      newLeft = Math.max(10, Math.min(newLeft, maxLeft - 10));
      newTop = Math.max(10, Math.min(newTop, maxTop - 10));

      trigger.style.left = newLeft + 'px';
      trigger.style.top = newTop + 'px';
    });

    trigger.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (trigger.hasPointerCapture(e.pointerId)) {
        trigger.releasePointerCapture(e.pointerId);
      }
      trigger.style.transition = 'transform 0.1s, left 0.3s ease, top 0.3s ease';
      
      // Restaurar flotación después de soltarlo
      setTimeout(() => {
        trigger.classList.add('idle-floating');
      }, 300);
      
      if (!isDragging) {
        if (songAudio && !songAudio.paused) {
          pauseAllAudio();
        } else {
          toggleSmartPanel();
        }
      }
    });

    // Permitir arrastrar el panel hacia abajo mediante el handle
    const handle = document.getElementById('panel-drag-handle');
    const panel = document.getElementById('reforma-smart-panel');
    if (handle && panel) {
      let handleStartY = 0;
      let isHandleDragging = false;

      handle.addEventListener('touchstart', (e) => {
        handleStartY = e.touches[0].clientY;
        isHandleDragging = true;
        panel.style.transition = 'none';
      }, { passive: true });

      handle.addEventListener('touchmove', (e) => {
        if (!isHandleDragging) return;
        const currentY = e.touches[0].clientY;
        const dy = currentY - handleStartY;
        if (dy > 0) {
          panel.style.transform = `translate(-50%, ${dy}px)`;
        }
      }, { passive: true });

      handle.addEventListener('touchend', (e) => {
        if (!isHandleDragging) return;
        isHandleDragging = false;
        panel.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
        
        const rect = panel.getBoundingClientRect();
        // Si se deslizó más del 30% del panel, se cierra
        if (rect.top > window.innerHeight - rect.height * 0.7) {
          closeSmartPanel();
        } else {
          panel.classList.add('open');
          panel.style.transform = '';
        }
      });
    }

    startFloatingTriggerCycle();
  }

  function renderSongWidget(songData) {
    const titleEl = document.getElementById('panel-song-title');
    const artistEl = document.getElementById('panel-song-artist');
    if (!titleEl || !artistEl) return;

    if (!songData || !songData.titulo) {
      titleEl.textContent = 'No recomendada';
      artistEl.textContent = 'Ninguna canción asignada esta semana';
      return;
    }

    currentFloatingSongData = songData;
    titleEl.textContent = songData.titulo;
    artistEl.textContent = songData.artista || 'Artista Desconocido';
  }

  function renderRedesWidget(redesList) {
    const nameEl = document.getElementById('panel-account-name');
    const platEl = document.getElementById('panel-account-platform');
    const linkEl = document.getElementById('panel-account-link');
    const iconEl = document.getElementById('panel-account-icon');
    const cardEl = document.getElementById('panel-account-card');
    if (!nameEl || !platEl || !linkEl) return;

    if (!redesList || redesList.length === 0) {
      nameEl.textContent = 'Ninguna cuenta';
      platEl.textContent = 'No hay cuentas recomendadas';
      return;
    }

    const red = redesList[0];
    let iconClass = 'fab fa-instagram';
    let platformText = 'Instagram';
    
    // Auto-detect platform from URL if not defined
    let plataforma = red.plataforma;
    if (!plataforma && red.url) {
      if (red.url.includes('tiktok.com')) plataforma = 'tiktok';
      else if (red.url.includes('youtube.com')) plataforma = 'youtube';
      else plataforma = 'instagram';
    }
    
    if (cardEl) {
      cardEl.classList.remove('instagram', 'tiktok', 'youtube');
      cardEl.classList.add(plataforma || 'instagram');
    }

    if (plataforma === 'tiktok') {
      iconClass = 'fab fa-tiktok';
      platformText = 'TikTok';
    } else if (plataforma === 'youtube') {
      iconClass = 'fab fa-youtube';
      platformText = 'YouTube';
    }

    nameEl.textContent = red.nombre || red.username || 'Cuenta recomendada';
    platEl.innerHTML = `<i class="${iconClass}" style="margin-right: 4px; font-size: 11px; vertical-align: middle;"></i> <span style="vertical-align: middle;">${platformText}</span>`;
    linkEl.href = red.url || '#';
    
    const avatarInnerEl = document.querySelector('#panel-account-card .avatar-inner');
    if (avatarInnerEl) {
      if (red.avatar_url) {
        avatarInnerEl.innerHTML = `<img src="${red.avatar_url}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
      } else {
        avatarInnerEl.innerHTML = `<i class="${iconClass}" id="panel-account-icon"></i>`;
      }
    }
    const linkIcon = document.getElementById('panel-account-link-icon');
    if (linkIcon) {
      linkIcon.className = iconClass;
    }
  }

  function timeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    // Convert SQL datetime string format stably across browsers
    const past = new Date(dateString.replace(/-/g, '/')); 
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `hace ${diffDay} día${diffDay > 1 ? 's' : ''}`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `hace ${diffMonth} mes${diffMonth > 1 ? 'es' : ''}`;
    const diffYear = Math.floor(diffMonth / 12);
    return `hace ${diffYear} año${diffYear > 1 ? 's' : ''}`;
  }

  function renderFeedTimeline(items, containerId = 'feed-timeline-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<p class="ml" style="text-align:center; padding: 40px; color: var(--muted);">No hay publicaciones recientes en el feed.</p>';
      return;
    }

    let html = '';
    items.forEach(item => {
      let badgeText = 'Publicación';
      let badgeClass = 'feed-card-badge';
      let actionBtnHtml = '';
      let embedHtml = '';

      if (item.tipo === 'curso') {
        badgeText = 'Nuevo Curso';
        badgeClass = 'feed-card-badge badge-curso';
        actionBtnHtml = `<button class="pill-dark" onclick="window.location.hash='#/visor?id=${item.referencia_id}'">Ver Curso <i class="fas fa-chevron-right" style="font-size: 8px;"></i></button>`;
      } else if (item.tipo === 'material_gratis') {
        badgeText = 'Material Gratis';
        badgeClass = 'feed-card-badge badge-gratis';
        actionBtnHtml = `<button class="pill-outline" onclick="abrirLeccionGratis(${item.referencia_id})">Ver Contenido Gratis <i class="fas fa-eye" style="font-size: 8px;"></i></button>`;
      } else if (item.tipo === 'cancion') {
        badgeText = 'Canción Semanal';
        actionBtnHtml = `<button class="pill-outline" onclick="playSongOfWeekFromFeed('${item.embed_code}', '${item.titulo}')"><i class="fas fa-play"></i> Escuchar Canción</button>`;
      } else if (item.tipo === 'social_embed' && item.embed_code) {
        badgeText = 'Redes';
        embedHtml = `<div class="feed-embed-container">${item.embed_code}</div>`;
      }

      html += `
        <div class="feed-card">
          <div class="feed-card-header">
            <span class="${badgeClass}">${badgeText}</span>
            <span class="ml" style="font-size: 9px; color: var(--muted);">${timeAgo(item.created_at)}</span>
          </div>
          <h2 class="feed-card-title">${item.titulo}</h2>
          ${item.descripcion ? `<p class="feed-card-desc">${item.descripcion}</p>` : ''}
          ${embedHtml}
          ${actionBtnHtml ? `<div style="margin-top: 16px;">${actionBtnHtml}</div>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;

    // Procesar embeds dinámicos de redes sociales cargados
    setTimeout(() => {
      if (window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
      }
      document.querySelectorAll('.feed-embed-container script').forEach(script => {
        const newScript = document.createElement('script');
        Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(script.innerHTML));
        script.parentNode.replaceChild(newScript, script);
      });
    }, 100);
  }

  async function checkUnreadNovedades() {
    try {
      const feedItems = await apiCall('feed.php');
      if (!feedItems || feedItems.length === 0) return;
      
      const lastSeenId = parseInt(localStorage.getItem('last_seen_feed_id')) || 0;
      let unreadCount = 0;
      feedItems.forEach(item => {
        const idVal = parseInt(item.id) || 0;
        if (idVal > lastSeenId) {
          unreadCount++;
        }
      });
      
      const badge = document.getElementById('novedades-badge');
      if (badge) {
        if (unreadCount > 0) {
          badge.style.display = 'flex';
          badge.textContent = unreadCount;
        } else {
          badge.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Error checking unread news:', e);
    }
  }

  // ── REPRODUCTOR DE MICROS DE AUDIO ─────────────────────────────────
  function initMicroPlayer(url, title, subtitle) {
    pauseAllAudio();

    const player = document.getElementById('micros-audio-player');
    const titleEl = document.getElementById('micro-player-title');
    const subtitleEl = document.getElementById('micro-player-subtitle');
    const playIcon = document.getElementById('micro-play-icon');

    if (!player) return;

    player.style.display = 'flex';
    titleEl.textContent = title;
    subtitleEl.textContent = subtitle || 'Micro de Audio';

    microAudio.src = url;
    microAudio.load();
    microAudio.play().then(() => {
      playIcon.className = 'fas fa-pause';
    }).catch(e => console.error("Error al reproducir micro audio:", e));

    microAudio.ontimeupdate = () => {
      const current = microAudio.currentTime;
      const duration = microAudio.duration || 0;
      const fill = document.getElementById('micro-slider-fill');
      const timeCurrent = document.getElementById('micro-time-current');
      const timeDuration = document.getElementById('micro-time-duration');

      if (fill) fill.style.width = (duration > 0 ? (current / duration) * 100 : 0) + '%';
      if (timeCurrent) timeCurrent.textContent = formatTime(current);
      if (timeDuration && duration) timeDuration.textContent = formatTime(duration);
    };

    microAudio.onended = () => {
      playIcon.className = 'fas fa-play';
    };

    const sliderWrap = document.getElementById('micro-slider-wrap');
    if (sliderWrap) {
      sliderWrap.onclick = (e) => {
        const rect = sliderWrap.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        if (microAudio.duration) {
          microAudio.currentTime = pct * microAudio.duration;
        }
      };
    }
  }

  document.getElementById('micro-btn-play')?.addEventListener('click', () => {
    const playIcon = document.getElementById('micro-play-icon');
    if (microAudio.paused) {
      pauseAllAudio();
      microAudio.play().then(() => {
        playIcon.className = 'fas fa-pause';
      });
    } else {
      microAudio.pause();
      playIcon.className = 'fas fa-play';
    }
  });

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // ── REPRODUCTOR DE CANCIÓN DE LA SEMANA (Aro de progreso circular) ─
  
  function playSongOfWeek() {
    if (!currentFloatingSongData || !currentFloatingSongData.url_audio) {
      showToast('No hay archivo de audio para la canción de la semana.', 'error');
      return;
    }
    startSongOfWeek(currentFloatingSongData.url_audio, currentFloatingSongData.titulo);
  }

  function playSongOfWeekFromFeed(url, title) {
    if (!url) {
      showToast('No hay archivo de audio para esta publicación.', 'error');
      return;
    }
    // Abrir panel inteligente de manera visual
    toggleSmartPanel();
    startSongOfWeek(url, title);
  }

  // IndexedDB Cache for Audio Files
  function getCachedAudioUrl(url) {
    return new Promise((resolve) => {
      const request = indexedDB.open('AudioCacheDB', 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('audios')) {
          db.createObjectStore('audios');
        }
      };
      
      request.onerror = () => {
        resolve(url); // Fallback on DB error
      };
      
      request.onsuccess = (e) => {
        const db = e.target.result;
        try {
          const transaction = db.transaction(['audios'], 'readonly');
          const store = transaction.objectStore('audios');
          const getRequest = store.get(url);
          
          getRequest.onsuccess = async () => {
            if (getRequest.result) {
              console.log("DEBUG: Audio loaded from IndexedDB cache:", url);
              const objectUrl = URL.createObjectURL(getRequest.result);
              resolve(objectUrl);
            } else {
              console.log("DEBUG: Audio not cached. Streaming from network and caching in background:", url);
              resolve(url); // Stream immediately!
              
              // Cache in background
              (async () => {
                try {
                  const response = await fetch(url);
                  if (response.ok) {
                    const blob = await response.blob();
                    const writeTransaction = db.transaction(['audios'], 'readwrite');
                    const writeStore = writeTransaction.objectStore('audios');
                    writeStore.put(blob, url);
                    console.log("DEBUG: Audio cached in background successfully:", url);
                  }
                } catch (err) {
                  console.error("DEBUG: Failed to cache audio in background:", err);
                }
              })();
            }
          };
          
          getRequest.onerror = () => resolve(url);
        } catch (err) {
          resolve(url);
        }
      };
    });
  }

  async function startSongOfWeek(url, title) {
    if (isPlayingTransition) return;
    pauseAllAudio();
    currentSongUrl = url;

    if (!songAudio) {
      songAudio = new Audio();
    }

    const finalUrl = await getCachedAudioUrl(url);

    songAudio.src = finalUrl;
    songAudio.load();

    const playIcon = document.getElementById('panel-song-play-icon');
    const topMusicPlayIcon = document.getElementById('top-music-play-icon');
    const topMusicPlayBtn = document.getElementById('top-music-play-btn');
    const topMusicTitle = document.getElementById('top-music-song-title');
    const topMusicArtist = document.getElementById('top-music-song-artist');

    if (topMusicTitle) topMusicTitle.textContent = title;
    
    // Intentar deducir artista del título si viene formateado como "Título - Artista"
    if (topMusicArtist && title.includes(' - ')) {
      topMusicArtist.textContent = title.split(' - ')[1];
    } else if (topMusicArtist) {
      topMusicArtist.textContent = 'Artista';
    }

    isPlayingTransition = true;
    songAudio.play().then(() => {
      isPlayingTransition = false;
      if (playIcon) playIcon.className = 'fas fa-pause';
      if (topMusicPlayIcon) {
        topMusicPlayIcon.className = 'fas fa-pause';
        if (topMusicPlayBtn) topMusicPlayBtn.style.padding = '0'; // Pause no lleva padding lateral
      }
      updateFloatingTriggerAudioState(true);
    }).catch(e => {
      isPlayingTransition = false;
      console.error("Error al reproducir canción:", e);
      showToast("Error de audio: " + e.name + " - " + e.message, "error");
    });

    const circle = document.querySelector('.panel-progress-ring-circle');
    const r = circle ? (parseFloat(circle.getAttribute('r')) || 25) : 25;
    const circumference = 2 * Math.PI * r;
    if (circle) {
      circle.style.strokeDasharray = `${circumference} ${circumference}`;
      circle.style.strokeDashoffset = circumference;
    }

    const topMusicTimeCurrent = document.getElementById('top-music-time-current');
    const topMusicTimeDuration = document.getElementById('top-music-time-duration');
    const topMusicSliderFill = document.getElementById('top-music-slider-fill');

    songAudio.ontimeupdate = () => {
      const current = songAudio.currentTime;
      const duration = songAudio.duration || 0;
      if (duration > 0) {
        const pct = current / duration;
        if (circle) {
          const offset = circumference - pct * circumference;
          circle.style.strokeDashoffset = offset;
        }

        // Floating progress ring (r=21, circumference=131.95)
        const floatingCircle = document.querySelector('.floating-progress-circle');
        if (floatingCircle) {
          const floatingOffset = 131.95 - pct * 131.95;
          floatingCircle.style.strokeDashoffset = floatingOffset;
        }

        // Actualizar slider e información en la sección de Top Música
        if (topMusicSliderFill) topMusicSliderFill.style.width = (pct * 100) + '%';
        if (topMusicTimeCurrent) topMusicTimeCurrent.textContent = formatTime(current);
        if (topMusicTimeDuration) topMusicTimeDuration.textContent = formatTime(duration);
      }
    };

    songAudio.onended = () => {
      if (playIcon) playIcon.className = 'fas fa-play';
      if (topMusicPlayIcon) {
        topMusicPlayIcon.className = 'fas fa-play';
        if (topMusicPlayBtn) topMusicPlayBtn.style.padding = '0 0 0 3px'; // Volver al padding de Play
      }
      if (circle) circle.style.strokeDashoffset = circumference;
      if (topMusicSliderFill) topMusicSliderFill.style.width = '0%';
      if (topMusicTimeCurrent) topMusicTimeCurrent.textContent = '0:00';
      updateFloatingTriggerAudioState(false);
    };
  }

  window.handlePanelPlayClick = function(ev) {
    if (ev) ev.stopPropagation();
    console.log("DEBUG: handlePanelPlayClick called!");
    if (isPlayingTransition) return;

    if (!songAudio || !songAudio.src) {
      playSongOfWeek();
      return;
    }

    const playIcon = document.getElementById('panel-song-play-icon');
    if (songAudio.paused) {
      pauseAllAudio();
      isPlayingTransition = true;
      songAudio.play().then(() => {
        isPlayingTransition = false;
        if (playIcon) playIcon.className = 'fas fa-pause';
        updateFloatingTriggerAudioState(true);
      }).catch(e => {
        isPlayingTransition = false;
        console.error("DEBUG: play() failed:", e);
        showToast("Error de audio: " + e.name + " - " + e.message, "error");
      });
    } else {
      songAudio.pause();
      if (playIcon) playIcon.className = 'fas fa-play';
      updateFloatingTriggerAudioState(false);
    }
  };

  // Helper para lección gratis auto-inscripción
  async function abrirLeccionGratis(leccionId) {
    try {
      const leccion = await apiCall('lecciones.php?id=' + leccionId);
      if (leccion) {
        await apiCall('inscripciones.php', 'POST', { curso_id: leccion.curso_id });
        window.location.hash = `#/visor?id=${leccion.curso_id}`;
      }
    } catch (err) {
      console.error('Error al abrir lección gratis:', err);
    }
  }



  // ── PERFIL Y CONFIGURACIONES DE USUARIO ────────────────────────
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const saveBtn = form.querySelector('button[type="submit"]');
    
    try {
      await apiCall('usuarios.php?id=' + currentUser.id, 'PUT', {
        nombre: form.nombre.value,
        apellido: form.apellido.value,
        cedula: form.cedula.value,
        fecha_nacimiento: form.fecha_nacimiento.value,
        telefono: form.telefono.value,
        whatsapp: form.telefono.value,
        pais: form.pais.value,
        ciudad: form.ciudad.value,
        nivel_estudios: form.nivel_estudios.value,
        ocupacion: form.ocupacion.value,
        motivacion: form.motivacion.value
      });
      saveBtn.textContent = '✓ GUARDADO';
      saveBtn.style.background = '#22c55e';
      setTimeout(() => { saveBtn.textContent = 'GUARDAR CAMBIOS'; saveBtn.style.background = ''; }, 2500);
    } catch (err) {
      console.error(err);
      saveBtn.textContent = 'ERROR AL GUARDAR';
      saveBtn.style.background = '#E63946';
      setTimeout(() => { saveBtn.textContent = 'GUARDAR CAMBIOS'; saveBtn.style.background = ''; }, 2500);
    }
  });

  // ── CAMBIAR CONTRASEÑA ─────────────────────────────────────────
  document.getElementById('form-cambiar-pass')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-cambiar-pass');
    const pass  = document.getElementById('cp-nueva').value;
    const pass2 = document.getElementById('cp-confirmar').value;
    const err1  = document.getElementById('err-cp-nueva');
    const err2  = document.getElementById('err-cp-confirmar');

    err1.textContent = '';
    err2.textContent = '';

    if (pass.length < 6) { err1.textContent = 'Mínimo 6 caracteres.'; return; }
    if (pass !== pass2)  { err2.textContent = 'Las contraseñas no coinciden.'; return; }

    btn.disabled = true;
    btn.textContent = 'GUARDANDO...';

    try {
      await apiCall('auth.php?action=update_password', 'POST', { password: pass });
      btn.textContent = '✓ CONTRASEÑA ACTUALIZADA';
      btn.style.background = '#22c55e';
      document.getElementById('cp-nueva').value = '';
      document.getElementById('cp-confirmar').value = '';
      setTimeout(() => { btn.textContent = 'CAMBIAR CONTRASEÑA'; btn.style.background = ''; btn.disabled = false; }, 3000);
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'CAMBIAR CONTRASEÑA';
      return;
    }
  });

  // ── SIDEBAR: desktop collapse / mobile drawer ──────────────────
  const sidebar   = document.getElementById('app-sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  const btnToggle = document.getElementById('btn-toggle-sidebar');

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
    pauseAllAudio();
    if (isMobile()) {
      sidebar.classList.contains('drawer-open') ? closeDrawer() : openDrawer();
    } else {
      document.body.classList.toggle('sidebar-collapsed');
    }
  });

  overlay.addEventListener('click', closeDrawer);

  // Cerrar drawer al navegar en mobile
  window.addEventListener('hashchange', () => {
    if (isMobile()) closeDrawer();
    checkRouteAccess();

    // Mover flotante a una nueva altura aleatoria en la navegación de forma fluida
    const trigger = document.getElementById('reforma-floating-trigger');
    if (trigger) {
      const randomPercent = 15 + Math.random() * 55;
      trigger.style.transition = 'top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.8s ease';
      trigger.style.top = `${randomPercent}vh`;
    }
  });

  // ── PLAYLIST TOGGLE (mobile) ────────────────────────────────────
  function togglePlaylist() {
    const btn  = document.getElementById('playlist-toggle');
    const wrap = document.getElementById('playlist-container-wrap');
    btn.classList.toggle('collapsed');
    wrap.classList.toggle('collapsed');
  }

  function syncPlaylistToggle() {
    const btn = document.getElementById('playlist-toggle');
    if (!btn) return;
    btn.style.display = isMobile() ? 'flex' : 'none';
  }

  window.addEventListener('resize', syncPlaylistToggle);

  function startAll() {
    syncPlaylistToggle();
    initApp();
    initDraggableTrigger();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startAll();
  } else {
    window.addEventListener('load', startAll);
  }

  // ── TAB SWITCHERS FOR TOPS AND BIBLIOTECA ────────────────────────
  window.switchTopsTab = function(tabName) {
    document.querySelectorAll('#tops-tabs .cat-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tops-tab-content').forEach(c => c.style.display = 'none');
    
    const btn = Array.from(document.querySelectorAll('#tops-tabs .cat-pill')).find(p => p.getAttribute('onclick').includes(tabName));
    if (btn) btn.classList.add('active');
    
    const content = document.getElementById(`tops-tab-${tabName}`);
    if (content) content.style.display = 'block';
  };

  window.switchBiblioTab = function(tabName) {
    document.querySelectorAll('#biblioteca-tabs .cat-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.biblio-tab-content').forEach(c => c.style.display = 'none');
    
    const btn = Array.from(document.querySelectorAll('#biblioteca-tabs .cat-pill')).find(p => p.getAttribute('onclick').includes(tabName));
    if (btn) btn.classList.add('active');
    
    const content = document.getElementById(`biblio-tab-${tabName}`);
    if (content) content.style.display = 'block';
  };

  window.switchAjustesTab = function(tabName) {
    document.querySelectorAll('#page-ajustes .category-pills .cat-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#page-ajustes .ajustes-tab-content').forEach(c => c.style.display = 'none');
    
    const btn = document.getElementById(`ajustes-tab-${tabName}-btn`);
    if (btn) btn.classList.add('active');
    
    const content = document.getElementById(`ajustes-tab-${tabName}`);
    if (content) content.style.display = 'block';
  };

  // ── GENERIC SEARCH BAR LOGIC FOR ALL SPA PAGES ───────────────────
  window.togglePageSearch = function(pageId) {
    const container = document.getElementById(`${pageId}-search-container`);
    const input = document.getElementById(`${pageId}-search-input`);
    if (!container || !input) return;
    
    container.classList.toggle('active');
    if (container.classList.contains('active')) {
      input.focus();
    } else {
      input.value = '';
      window.filterPageContent(pageId, '');
    }
  };

  window.filterPageContent = function(pageId, query) {
    const q = query.toLowerCase().trim();
    
    if (pageId === 'inicio') {
      document.querySelectorAll('#feed-timeline-container .feed-card').forEach(card => {
        const title = card.querySelector('.feed-card-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.feed-card-desc')?.textContent.toLowerCase() || '';
        const matches = title.includes(q) || desc.includes(q);
        card.style.display = matches ? 'block' : 'none';
      });
    }
    
    else if (pageId === 'cursos') {
      document.querySelectorAll('#catalog-grid .course-card').forEach(card => {
        const title = card.querySelector('.course-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.course-desc')?.textContent.toLowerCase() || '';
        const instructor = card.querySelector('.course-instructor-name')?.textContent.toLowerCase() || '';
        const matches = title.includes(q) || desc.includes(q) || instructor.includes(q);
        card.classList.toggle('hidden-search', !matches);
      });
    }
    
    else if (pageId === 'biblioteca') {
      // Filtrar cursos y descargables
      document.querySelectorAll('#biblioteca-grid .my-course-card, #bonus-grid .my-course-card').forEach(card => {
        const title = card.querySelector('.my-course-title')?.textContent.toLowerCase() || '';
        const matches = title.includes(q);
        card.style.display = matches ? 'block' : 'none';
      });
      document.querySelectorAll('#descargables-grid .pdf-card').forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const subtitle = card.querySelector('p')?.textContent.toLowerCase() || '';
        const matches = title.includes(q) || subtitle.includes(q);
        card.style.display = matches ? 'flex' : 'none';
      });
    }
    
    else if (pageId === 'tops') {
      // Filtrar top cursos
      document.querySelectorAll('#top-cursos-grid .course-card').forEach(card => {
        const title = card.querySelector('.course-title')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('.course-desc')?.textContent.toLowerCase() || '';
        const instructor = card.querySelector('.course-instructor-name')?.textContent.toLowerCase() || '';
        const matches = title.includes(q) || desc.includes(q) || instructor.includes(q);
        card.style.display = matches ? 'block' : 'none';
      });
      // Filtrar top cuentas
      document.querySelectorAll('#top-cuentas-list > div').forEach(row => {
        const text = row.textContent.toLowerCase();
        const matches = text.includes(q);
        row.style.display = matches ? 'flex' : 'none';
      });
    }
  };

  // ── CUSTOM CURSOR LERP ──────────────────────────────────────────
  (function initCursor() {
    const dot = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;
    let mx = 0, my = 0, rx = 0, ry = 0;
    
    document.addEventListener('mousemove', e => { 
      mx = e.clientX; 
      my = e.clientY; 
    });
    
    function tick() {
      rx += (mx - rx) * 0.15; 
      ry += (my - ry) * 0.15;
      dot.style.transform = `translate(${mx - 4}px,${my - 4}px)`;
      ring.style.transform = `translate(${rx - 16}px,${ry - 16}px)`;
      requestAnimationFrame(tick);
    }
    tick();

    // Hover effect for interactive elements
    const updateHoverListeners = () => {
      const targets = document.querySelectorAll('a, button, input, select, textarea, [onclick], [role="button"], .cat-pill, .pill-dark, .pill-outline, .audio-control-btn');
      targets.forEach(el => {
        if (el.dataset.hasCursorHover) return;
        el.dataset.hasCursorHover = '1';
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
      });
    };

    updateHoverListeners();
    const observer = new MutationObserver(updateHoverListeners);
    observer.observe(document.body, { childList: true, subtree: true });
  })();

  // Bloquear gestos de zoom y doble toque en móviles (especialmente pinch en Safari)
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchmove', function (e) {
    if (e.scale !== 1 && e.scale !== undefined) {
      e.preventDefault();
    }
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);


