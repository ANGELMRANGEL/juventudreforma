// Animations System Script

(function () {
      'use strict';
      const EASE = 'cubic-bezier(.16,1,.3,1)';

      // CURSOR LERP
      (function initCursor() {
        const dot = document.getElementById('cursor-dot');
        const ring = document.getElementById('cursor-ring');
        let mx = 0, my = 0, rx = 0, ry = 0;
        document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
        function tick() {
          rx += (mx - rx) * 0.15; ry += (my - ry) * 0.15;
          if (dot) dot.style.transform = `translate(${mx - 4}px,${my - 4}px)`;
          if (ring) ring.style.transform = `translate(${rx - 16}px,${ry - 16}px)`;
          requestAnimationFrame(tick);
        }
        tick();
      })();

      // HERO SEQUENCE
      window.addEventListener('load', () => {
        setTimeout(() => {
          document.querySelectorAll('#hero .rv').forEach((l, i) => setTimeout(() => l.classList.add('revealed'), i * 80));
          document.querySelectorAll('.hero-desc-col .rv, .hero-cta-col > div').forEach((el, i) => {
            el.style.opacity = '0'; el.style.transform = 'translateY(20px)';
            el.style.transition = `opacity .7s ${EASE}, transform .7s ${EASE}`;
            setTimeout(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; }, 200 + i * 120);
          });
          document.querySelector('.mq-track')?.classList.add('mq-visible');
        }, 900);
      });

      // SCROLL OBSERVER
      const revealIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.querySelectorAll('.rv').forEach((l, i) => setTimeout(() => l.classList.add('revealed'), i * 70));
          el.querySelectorAll('.count-up').forEach(cu => {
            if (cu.dataset.done) return; cu.dataset.done = '1';
            let start = null; const to = parseFloat(cu.dataset.target);
            function step(ts) {
              if (!start) start = ts; const p = Math.min((ts - start) / 1400, 1);
              cu.textContent = (to * (1 - Math.pow(1 - p, 4))).toFixed(parseInt(cu.dataset.dec || 0)) + (cu.dataset.suffix || '');
              if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          });
          revealIO.unobserve(el);
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -50px 0px' });
      document.querySelectorAll('section, .team-card, .price-card').forEach(el => revealIO.observe(el));

      // WORD WIPE
      const wipeTexts = document.querySelectorAll('.scroll-wipe-text');
      wipeTexts.forEach(el => {
        const txt = el.innerText; el.innerHTML = '';
        txt.split(/\s+/).forEach(w => {
          const s = document.createElement('span'); s.className = 'scroll-wipe-word'; s.innerText = w + ' '; el.appendChild(s);
        });
      });
      window.addEventListener('scroll', () => {
        wipeTexts.forEach(el => {
          const r = el.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (window.innerHeight * 0.85 - r.top) / (window.innerHeight * 0.5)));
          el.querySelectorAll('.scroll-wipe-word').forEach((s, i, a) => {
            const wp = Math.max(0, Math.min(1, (p - i / a.length) / (1 / a.length))); s.style.setProperty('--w-p', wp);
          });
        });
      }, { passive: true });
    })();