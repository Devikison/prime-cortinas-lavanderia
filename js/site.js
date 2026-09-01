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
      a.setAttribute('href', '/obrigado/?wa=' + encodeURIComponent(wa) + (utmQS ? '&' + utmQS : ''));
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

    // ---- Portfólio: carrossel infinito (100% CSS, sem JS) ----

    // ---- Depoimentos: pager de 3 em 3, com setas e indicadores ----
    var testiTrack = document.getElementById('testi-track');
    if (testiTrack) {
      var testiCards = Array.prototype.slice.call(testiTrack.querySelectorAll('.testi-card'));
      var testiPrev = document.getElementById('testi-prev');
      var testiNext = document.getElementById('testi-next');
      var testiDotsWrap = document.getElementById('testi-dots');
      var PAGE_SIZE = 3;
      var pageCount = Math.max(1, Math.ceil(testiCards.length / PAGE_SIZE));
      var page = 0;

      var dots = [];
      if (testiDotsWrap && pageCount > 1) {
        for (var d = 0; d < pageCount; d++) {
          var dot = document.createElement('span');
          testiDotsWrap.appendChild(dot);
          dots.push(dot);
        }
      }

      function renderTesti() {
        testiCards.forEach(function (card, i) {
          card.classList.toggle('is-active', i >= page * PAGE_SIZE && i < (page + 1) * PAGE_SIZE);
        });
        dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === page); });
        if (testiPrev) testiPrev.disabled = page === 0;
        if (testiNext) testiNext.disabled = page === pageCount - 1;
        if (testiPrev) testiPrev.style.display = pageCount > 1 ? '' : 'none';
        if (testiNext) testiNext.style.display = pageCount > 1 ? '' : 'none';
      }
      if (testiPrev) testiPrev.addEventListener('click', function () {
        if (page > 0) { page--; renderTesti(); }
      });
      if (testiNext) testiNext.addEventListener('click', function () {
        if (page < pageCount - 1) { page++; renderTesti(); }
      });
      renderTesti();
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
      setTimeout(function () { window.open(target, '_blank'); }, 900);
    }
  });
})();
