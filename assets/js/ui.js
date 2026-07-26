// UI & Interactions Script

// CURSOR (LERP handled in Animation System block)
    (function () {
      document.querySelectorAll('a,button,[data-href]').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
      });
    })();

    // LOADER
    window.addEventListener('load', () => { setTimeout(() => document.getElementById('loader').classList.add('hidden'), 700) });

    // NAVBAR SCROLL + DARK SECTION DETECTION
    const navbar = document.getElementById('navbar');
    function updateNavbar() {
      navbar.classList.toggle('scrolled', window.scrollY > 10);
      const sampleY = 72;
      const sampleX = window.innerWidth * 0.75;
      const el = document.elementFromPoint(sampleX, sampleY);
      let isDark = false;
      if (el) {
        let cur = el;
        while (cur && cur !== document.body) {
          if (cur.classList && (cur.classList.contains('s-dark') || cur.classList.contains('auth-left-admin'))) {
            isDark = true; break;
          }
          const bg = getComputedStyle(cur).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            const m = bg.match(/\d+/g);
            if (m && m.length >= 3) {
              const lum = 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2];
              if (lum < 50) { isDark = true; break; }
            }
          }
          cur = cur.parentElement;
        }
      }
      navbar.classList.toggle('dark-nav', isDark);
      document.body.classList.toggle('on-dark', isDark);
    }
    window.addEventListener('scroll', updateNavbar);
    window.addEventListener('hashchange', () => setTimeout(updateNavbar, 200));

    // MENU
    const navTrigger = document.getElementById('nav-trigger');
    const menuDd = document.getElementById('menu-dd');
    let menuOpen = false;
    navTrigger.addEventListener('click', e => { e.stopPropagation(); menuOpen = !menuOpen; menuDd.classList.toggle('open', menuOpen); navTrigger.textContent = menuOpen ? '× CERRAR' : '+ MENÚ' });
    document.addEventListener('click', e => { if (menuOpen && !menuDd.contains(e.target) && e.target !== navTrigger) { menuOpen = false; menuDd.classList.remove('open'); navTrigger.textContent = '+ MENÚ' } });
    menuDd.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuOpen = false;
        menuDd.classList.remove('open');
        navTrigger.textContent = '+ MENÚ';
      });
    });

    // ACCORDION
    document.querySelectorAll('.acc-trigger').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.acc-item'); const was = item.classList.contains('open');
        document.querySelectorAll('.acc-item').forEach(i => i.classList.remove('open'));
        if (!was) item.classList.add('open');
      });
    });

    // SERVICE ACCORDION
    document.querySelectorAll('.svc-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        const isOpen = row.classList.contains('open');
        document.querySelectorAll('.svc-row').forEach(r => r.classList.remove('open'));
        if (!isOpen) row.classList.add('open');
      });
    });

    // VIEWER TABS
    document.querySelectorAll('.viewer-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.viewer-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.viewer-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.vtab).classList.add('active');
      });
    });

    // ADMIN TABS
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });

    // TEAM SCROLL NAVIGATION
    (function() {
      const teamGrid = document.querySelector('.team-grid');
      const btnLeft = document.querySelector('.team-scroll-btn.btn-left');
      const btnRight = document.querySelector('.team-scroll-btn.btn-right');
      
      if (teamGrid && btnLeft && btnRight) {
        function updateTeamScrollButtons() {
          const sl = teamGrid.scrollLeft;
          const cw = teamGrid.clientWidth;
          const sw = teamGrid.scrollWidth;
          
          if (sl <= 5) {
            btnLeft.style.setProperty('display', 'none', 'important');
          } else {
            btnLeft.style.setProperty('display', 'inline-flex', 'important');
          }
          
          if (sl + cw >= sw - 5) {
            btnRight.style.setProperty('display', 'none', 'important');
          } else {
            btnRight.style.setProperty('display', 'inline-flex', 'important');
          }
        }
        
        teamGrid.addEventListener('scroll', updateTeamScrollButtons);
        window.addEventListener('resize', updateTeamScrollButtons);
        setTimeout(updateTeamScrollButtons, 300);
      }
    })();