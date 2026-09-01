/* Prime Higienização de Cortinas — comportamento compartilhado.
   Roda em todas as páginas; cada bloco só age se os elementos daquela
   página existirem. */
(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function dl(o) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(o);
  }

  ready(function () {
    var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var qp = new URLSearchParams(location.search);

    // ---- Captura e propagação de UTM para os CTAs de WhatsApp ----
    var utmStore = {};
    try { utmStore = JSON.parse(sessionStorage.getItem('prime_utm') || '{}'); } catch (e) {}
    var foundUtm = false;
    UTM_KEYS.forEach(function (k) {
      var v = qp.get(k);
      if (v) { utmStore[k] = v; foundUtm = true; }
    });
    if (foundUtm) {
      try { sessionStorage.setItem('prime_utm', JSON.stringify(utmStore)); } catch (e) {}
    }
    var utmQS = UTM_KEYS.filter(function (k) { return utmStore[k]; })
      .map(function (k) { return k + '=' + encodeURIComponent(utmStore[k]); })
      .join('&');

    var waLinks = Array.prototype.slice.call(document.querySelectorAll('a[data-wa]'));
    waLinks.forEach(function (a) {
      var wa = a.getAttribute('href') + (utmQS ? '&' + utmQS : '');
      a.setAttribute('data-wa-url', wa);
      a.setAttribute('href', 'obrigado/?wa=' + encodeURIComponent(wa) + (utmQS ? '&' + utmQS : ''));
      a.addEventListener('click', function () {
        dl({ event: 'cta_click', cta_section: a.getAttribute('data-cta') || '' });
      });
    });

    // ---- Cabeçalho sólido ao rolar. O botão flutuante de WhatsApp (#wa-fab)
    // fica sempre visível — sem show/hide por scroll ou por tamanho de tela. ----
    var header = document.getElementById('site-header');
    var scrollFired = {};
    function onScroll() {
      var st = window.scrollY || document.documentElement.scrollTop || 0;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var pct = h > 0 ? (st / h) * 100 : 0;
      if (pct >= 50 && !scrollFired[50]) { scrollFired[50] = 1; dl({ event: 'scroll_50' }); }
      if (pct >= 90 && !scrollFired[90]) { scrollFired[90] = 1; dl({ event: 'scroll_90' }); }
      if (header) {
        var solid = st > 12;
        header.style.background = solid ? '#FFFFFF' : 'rgba(255,255,255,.78)';
        header.style.borderBottomColor = solid ? '#E6E3DC' : 'transparent';
        header.style.boxShadow = solid ? '0 1px 14px rgba(27,48,79,.06)' : 'none';
      }
    }
    if (header) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    }

    // ---- Revelação suave das seções ao entrar na tela ----
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var reveals = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    if (reveals.length) {
      if (reduce || !('IntersectionObserver' in window)) {
        reveals.forEach(function (el) { el.classList.add('is-visible'); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
        reveals.forEach(function (el) { io.observe(el); });
      }
    }

    // ---- Carrossel "coverflow" reutilizável — card central em foco,
    // vizinhos desfocados nas laterais, transição lenta via setas ou
    // arraste. Usado no Portfólio e na Prova social. ----
    function initCoverflow(stageId, slideClass, prevId, nextId) {
      var stage = document.getElementById(stageId);
      if (!stage) return;
      var slides = Array.prototype.slice.call(stage.querySelectorAll('.' + slideClass));
      var n = slides.length;
      if (!n) return;
      var current = 0;

      function wrapDelta(d) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
        return d;
      }
      function render() {
        slides.forEach(function (slide, i) {
          var delta = wrapDelta(i - current);
          var ad = Math.abs(delta);
          var scale = ad === 0 ? 1 : ad === 1 ? 0.78 : 0.62;
          var op = ad === 0 ? 1 : ad === 1 ? 0.55 : 0;
          var blur = ad === 0 ? 0 : ad === 1 ? 2 : 5;
          slide.style.setProperty('--delta', delta);
          slide.style.setProperty('--scale', scale);
          slide.style.setProperty('--op', op);
          slide.style.setProperty('--blur', blur + 'px');
          slide.style.zIndex = 10 - ad;
          slide.style.pointerEvents = ad === 0 ? 'auto' : 'none';
          slide.setAttribute('aria-hidden', ad === 0 ? 'false' : 'true');
        });
      }
      var prevBtn = document.getElementById(prevId);
      var nextBtn = document.getElementById(nextId);
      if (prevBtn) prevBtn.addEventListener('click', function () { current = (current - 1 + n) % n; render(); });
      if (nextBtn) nextBtn.addEventListener('click', function () { current = (current + 1) % n; render(); });

      // Arraste/toque para passar no celular
      var touchX = null;
      stage.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (touchX === null) return;
        var dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) {
          current = dx < 0 ? (current + 1) % n : (current - 1 + n) % n;
          render();
        }
        touchX = null;
      });

      render();
    }
    initCoverflow('pf-stage', 'pf-slide', 'pf-prev', 'pf-next');
    initCoverflow('testi-stage', 'testi-slide', 'testi-prev', 'testi-next');

    // ---- "O problema": régua dourada que se preenche conforme a leitura
    // avança, e os números 01-04 trocam de dourado para azul-marinho ----
    var problemTimeline = document.getElementById('problem-timeline');
    var problemFill = document.getElementById('problem-line-fill');
    if (problemTimeline && problemFill) {
      var problemNums = Array.prototype.slice.call(problemTimeline.querySelectorAll('.problem-num'));
      var problemTicking = false;
      function updateProblemTimeline() {
        problemTicking = false;
        var rect = problemTimeline.getBoundingClientRect();
        var refY = window.innerHeight * 0.55; // linha de leitura de referência
        var progressPx = refY - rect.top;
        var progress = rect.height > 0 ? Math.max(0, Math.min(1, progressPx / rect.height)) : 0;
        problemFill.style.height = (progress * 100) + '%';
        problemNums.forEach(function (num) {
          var numRect = num.getBoundingClientRect();
          var numMid = (numRect.top + numRect.height / 2) - rect.top;
          num.classList.toggle('is-passed', progressPx >= numMid);
        });
      }
      function onScrollProblemTimeline() {
        if (!problemTicking) { problemTicking = true; requestAnimationFrame(updateProblemTimeline); }
      }
      window.addEventListener('scroll', onScrollProblemTimeline, { passive: true });
      window.addEventListener('resize', onScrollProblemTimeline);
      updateProblemTimeline();
    }

    // ---- Barra de consentimento de cookies ----
    var bar = document.getElementById('cookie-bar');
    if (bar) {
      var choice = null;
      try { choice = localStorage.getItem('prime_cookie_consent'); } catch (e) {}
      if (!choice) bar.style.display = 'block';
      Array.prototype.slice.call(bar.querySelectorAll('button[data-cookie]')).forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.getAttribute('data-cookie');
          try { localStorage.setItem('prime_cookie_consent', v); } catch (e) {}
          bar.style.display = 'none';
          dl({ event: 'cookie_consent', consent: v === 'allow' ? 'granted' : 'denied' });
        });
      });
    }

    // ---- Página /obrigado: abre o WhatsApp automaticamente ----
    var waLink = document.getElementById('wa-link');
    if (waLink) {
      var waParam = qp.get('wa');
      var target = waParam ? decodeURIComponent(waParam) : 'https://wa.me/5515976040209';
      waLink.setAttribute('href', target);
      dl({ event: 'whatsapp_redirect', destination: target });
      dl({ event: 'lead' });
      // Navega a própria aba (em vez de window.open) — celulares bloqueiam
      // pop-ups abertos fora de um clique direto do usuário, então
      // window.open() silenciosamente falhava e a página ficava parada
      // no "Te levando para o WhatsApp…" para sempre.
      setTimeout(function () { location.href = target; }, 900);
    }
  });
})();
