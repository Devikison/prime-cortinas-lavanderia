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
        // Efeito "vidro" (glass) sempre translúcido com blur — nunca vira
        // sólido, só fica um pouco mais opaco ao rolar para manter a
        // legibilidade do conteúdo por trás.
        var solid = st > 12;
        header.style.background = solid ? 'rgba(255,255,255,.72)' : 'rgba(255,255,255,.5)';
        header.style.borderBottomColor = solid ? 'rgba(230,227,220,.7)' : 'rgba(255,255,255,.4)';
        header.style.boxShadow = solid ? '0 1px 0 rgba(255,255,255,.5) inset, 0 1px 14px rgba(27,48,79,.08)' : '0 1px 0 rgba(255,255,255,.5) inset';
      }
    }
    if (header) {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();
    }

    // ---- Menu mobile: hambúrguer que vira "X" e abre a lista de links
    // devagar (mesmo motion do resto do site). Fecha ao clicar num link,
    // ao clicar fora, ou com Esc. ----
    var navToggle = document.getElementById('nav-toggle');
    var navLinks = document.getElementById('nav-links');
    if (navToggle && navLinks) {
      function setNavOpen(open) {
        navToggle.classList.toggle('is-open', open);
        navLinks.classList.toggle('is-open', open);
        navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      }
      navToggle.addEventListener('click', function () {
        setNavOpen(!navToggle.classList.contains('is-open'));
      });
      navLinks.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { setNavOpen(false); });
      });
      document.addEventListener('click', function (e) {
        if (!navToggle.classList.contains('is-open')) return;
        if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
        setNavOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setNavOpen(false);
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 900) setNavOpen(false);
      });
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

    // ---- Carrossel "coverflow" do Portfólio — card central em foco,
    // vizinhos desfocados nas laterais, transição lenta via setas ou
    // arraste (mouse ou dedo). ----
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

      // Arraste com mouse ou dedo (pointer events cobrem os dois)
      var dragging = false;
      var startX = 0;
      stage.addEventListener('pointerdown', function (e) { dragging = true; startX = e.clientX; stage.setPointerCapture(e.pointerId); });
      stage.addEventListener('pointerup', function (e) {
        if (!dragging) return;
        dragging = false;
        var dx = e.clientX - startX;
        if (Math.abs(dx) > 40) {
          current = dx < 0 ? (current + 1) % n : (current - 1 + n) % n;
          render();
        }
      });
      stage.addEventListener('pointercancel', function () { dragging = false; });

      render();
    }
    initCoverflow('pf-stage', 'pf-slide', 'pf-prev', 'pf-next');

    // ---- Faixa de depoimentos: auto-scroll contínuo (nunca pausa no
    // hover) que pode ser arrastado livremente com o mouse ou o dedo. O
    // arraste só desloca a posição; o auto-scroll retoma sozinho a seguir. ----
    function initDragMarquee(trackId, speed) {
      var track = document.getElementById(trackId);
      if (!track) return;
      var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var pos = 0;
      var dragging = false;
      var startX = 0;
      var startPos = 0;
      var half = track.scrollWidth / 2;
      window.addEventListener('resize', function () { half = track.scrollWidth / 2; });

      function frame() {
        if (!dragging && !reduceMotion) {
          pos -= speed;
        }
        if (half > 0) {
          if (pos <= -half) pos += half;
          if (pos > 0) pos -= half;
        }
        track.style.transform = 'translateX(' + pos + 'px)';
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);

      track.addEventListener('pointerdown', function (e) {
        dragging = true;
        startX = e.clientX;
        startPos = pos;
        track.setPointerCapture(e.pointerId);
      });
      track.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        pos = startPos + (e.clientX - startX);
      });
      function stopDrag() { dragging = false; }
      track.addEventListener('pointerup', stopDrag);
      track.addEventListener('pointercancel', stopDrag);
      track.addEventListener('pointerleave', function () { if (dragging) stopDrag(); });
    }
    initDragMarquee('testi-track', 0.5);

    // ---- "O que está incluído" no mobile: pilha compacta e de altura fixa.
    // Só o card da frente e uma lasca do próximo (atrás, mais baixo e
    // apagado) ficam visíveis; arrastar o dedo pra cima troca o da frente
    // pelo de trás, em loop infinito (do último volta pro primeiro). No
    // desktop a grade normal (CSS grid) segue intacta — este script só
    // tem efeito visual dentro da media query mobile do site.css. ----
    function initVerticalStack(containerId, itemSelector) {
      var stage = document.getElementById(containerId);
      if (!stage) return;
      itemSelector = itemSelector || '.pc-card';
      var cards = Array.prototype.slice.call(stage.children).filter(function (el) {
        return el.matches && el.matches(itemSelector);
      });
      var n = cards.length;
      if (!n) return;
      var current = 0;
      var dragY = 0;
      var dots = Array.prototype.slice.call(stage.querySelectorAll('.stack-dots span'));
      function updateDots() {
        dots.forEach(function (dot, i) { dot.classList.toggle('is-active', i === current); });
      }

      function wrapDelta(d) {
        d = ((d % n) + n) % n;
        if (d > n / 2) d -= n;
        return d;
      }
      function render(extra) {
        extra = extra || 0;
        cards.forEach(function (card, i) {
          var delta = wrapDelta(i - current);
          var ty, scale, op, z;
          if (delta === 0) { ty = extra; scale = 1; op = Math.max(.25, 1 - Math.abs(extra) / 220); z = 3; }
          else if (delta === 1) { ty = 28 + extra * .15; scale = .93; op = .85; z = 2; }
          else if (delta === -1) { ty = -28 + extra * .15; scale = .93; op = 0; z = 2; }
          else { ty = 0; scale = .9; op = 0; z = 1; }
          card.style.setProperty('--ty', ty + 'px');
          card.style.setProperty('--scale', scale);
          card.style.setProperty('--op', op);
          card.style.zIndex = z;
          card.setAttribute('aria-hidden', delta === 0 ? 'false' : 'true');
        });
      }

      var dragging = false;
      var startY = 0;
      stage.addEventListener('pointerdown', function (e) {
        dragging = true;
        startY = e.clientY;
        stage.classList.add('is-dragging');
        stage.setPointerCapture(e.pointerId);
      });
      stage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        dragY = e.clientY - startY;
        render(dragY);
      });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        stage.classList.remove('is-dragging');
        if (dragY < -50) current = (current + 1) % n;
        else if (dragY > 50) current = (current - 1 + n) % n;
        dragY = 0;
        render(0);
        updateDots();
      }
      stage.addEventListener('pointerup', endDrag);
      stage.addEventListener('pointercancel', endDrag);

      render();
      updateDots();

      // Dica automática: assim que a pilha aparece na tela, o card da
      // frente "espia" para cima e volta sozinho — ensina o gesto de
      // arrastar sem precisar só do texto abaixo.
      var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduce && 'IntersectionObserver' in window) {
        var nudged = false;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !nudged) {
              nudged = true;
              setTimeout(function () { render(-46); }, 500);
              setTimeout(function () { render(0); }, 950);
              io.disconnect();
            }
          });
        }, { threshold: .6 });
        io.observe(stage);
      }
    }
    initVerticalStack('included-grid');
    initVerticalStack('problem-items', '.problem-item');
    initVerticalStack('steps-timeline', '.step-item');

    // ---- Sliders "antes e depois": arraste com mouse, dedo ou teclado
    // (setas) revela a foto de "antes" por baixo da de "depois". ----
    var baSliders = Array.prototype.slice.call(document.querySelectorAll('[data-ba]'));
    baSliders.forEach(function (slider) {
      var dragging = false;
      function setPos(clientX) {
        var rect = slider.getBoundingClientRect();
        var pct = ((clientX - rect.left) / rect.width) * 100;
        pct = Math.max(0, Math.min(100, pct));
        slider.style.setProperty('--pos', pct + '%');
        slider.setAttribute('aria-valuenow', Math.round(pct));
      }
      slider.addEventListener('pointerdown', function (e) {
        dragging = true;
        slider.setPointerCapture(e.pointerId);
        setPos(e.clientX);
      });
      slider.addEventListener('pointermove', function (e) {
        if (dragging) setPos(e.clientX);
      });
      function stop() { dragging = false; }
      slider.addEventListener('pointerup', stop);
      slider.addEventListener('pointercancel', stop);
      slider.addEventListener('keydown', function (e) {
        var current = parseFloat(slider.style.getPropertyValue('--pos')) || 50;
        if (e.key === 'ArrowLeft') { slider.style.setProperty('--pos', Math.max(0, current - 5) + '%'); e.preventDefault(); }
        if (e.key === 'ArrowRight') { slider.style.setProperty('--pos', Math.min(100, current + 5) + '%'); e.preventDefault(); }
      });
    });

    // ---- Régua dourada que se preenche conforme a leitura avança, com os
    // números trocando de dourado para azul-marinho — usada em "O problema"
    // (sempre vertical) e em "Como funciona" (horizontal no desktop,
    // vertical no mobile, acompanhando a mudança de layout da seção). ----
    function initTimelineFill(containerId, fillId, numSelector, mode) {
      var container = document.getElementById(containerId);
      var fill = document.getElementById(fillId);
      if (!container || !fill) return;
      var nums = Array.prototype.slice.call(container.querySelectorAll(numSelector));
      var count = nums.length;
      var ticking = false;
      function update() {
        ticking = false;
        var rect = container.getBoundingClientRect();
        var refY = window.innerHeight * 0.55; // linha de leitura de referência
        var progressPx = refY - rect.top;
        var progress = rect.height > 0 ? Math.max(0, Math.min(1, progressPx / rect.height)) : 0;
        var horizontal = mode === 'horizontal' || (mode === 'responsive' && window.innerWidth > 760);
        if (horizontal) {
          fill.style.height = '';
          fill.style.width = (progress * 88) + '%'; // acompanha o trilho (6% a 94%)
        } else {
          fill.style.width = '';
          fill.style.height = (progress * 100) + '%';
        }
        nums.forEach(function (num, i) {
          var threshold = count > 1 ? i / (count - 1) : 0;
          num.classList.toggle('is-passed', progress >= threshold);
        });
      }
      function onScroll() {
        if (!ticking) { ticking = true; requestAnimationFrame(update); }
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      update();
    }
    initTimelineFill('problem-timeline', 'problem-line-fill', '.problem-num', 'vertical');
    initTimelineFill('steps-timeline', 'steps-line-fill', '.step-num', 'responsive');
    initTimelineFill('solution-timeline', 'solution-line-fill', '.solution-dot', 'vertical');

    // ---- FAQ: abre e fecha com a mesma transição suave nos dois sentidos.
    // O atributo nativo [open] do <details> some assim que o clique fecha
    // o card, então a transição CSS nunca chegava a rodar no fechamento.
    // Aqui a classe .is-open controla a animação, e o atributo [open] só
    // é removido depois que a transição termina. ----
    var faqCards = Array.prototype.slice.call(document.querySelectorAll('.faq-card'));
    if (faqCards.length) {
      var faqReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function faqClose(card) {
        var panel = card.querySelector('.faq-panel');
        card.classList.remove('is-open');
        if (faqReduce || !panel) { card.open = false; return; }
        // Trava a altura atual em px (caso esteja em "auto") antes de
        // animar para 0 — animar direto de "auto" não funciona em CSS.
        panel.style.height = panel.getBoundingClientRect().height + 'px';
        void panel.offsetHeight;
        panel.style.height = '0px';
        var onEnd = function (ev) {
          if (ev.propertyName !== 'height') return;
          panel.removeEventListener('transitionend', onEnd);
          card.open = false;
        };
        panel.addEventListener('transitionend', onEnd);
      }
      function faqOpen(card) {
        // Só um card aberto por vez (mesmo comportamento do name="faq-prime" nativo).
        faqCards.forEach(function (other) {
          if (other !== card && other.classList.contains('is-open')) faqClose(other);
        });
        card.open = true;
        card.classList.add('is-open');
        var panel = card.querySelector('.faq-panel');
        if (!panel) return;
        if (faqReduce) { panel.style.height = 'auto'; return; }
        var target = panel.scrollHeight;
        panel.style.height = '0px';
        void panel.offsetHeight;
        panel.style.height = target + 'px';
        var onEnd = function (ev) {
          if (ev.propertyName !== 'height') return;
          panel.removeEventListener('transitionend', onEnd);
          // Volta para "auto" para respeitar reflow (ex.: rotação de tela).
          panel.style.height = 'auto';
        };
        panel.addEventListener('transitionend', onEnd);
      }
      faqCards.forEach(function (card) {
        var summary = card.querySelector('.faq-summary');
        if (!summary) return;
        summary.addEventListener('click', function (e) {
          e.preventDefault();
          if (card.classList.contains('is-open')) faqClose(card);
          else faqOpen(card);
        });
      });
    }

    // ---- Formulário "A gente te chama" ----
    // AINDA SEM BACKEND: só valida e mostra a confirmação visual. Os
    // dados não são enviados nem salvos em lugar nenhum até decidirmos
    // onde gravar (Supabase, Google Sheets, Formspree etc.) e trocarmos
    // este bloco por um fetch/POST de verdade para lá.
    var leadForm = document.getElementById('lead-form');
    if (leadForm) {
      var leadMsg = document.getElementById('lead-form-msg');
      leadForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!leadForm.checkValidity()) {
          leadForm.reportValidity();
          return;
        }
        dl({ event: 'lead_form_submit' });
        leadForm.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
        leadForm.querySelector('button[type="submit"]').disabled = true;
        if (leadMsg) {
          leadMsg.textContent = 'Recebemos seus dados! Vamos entrar em contato em breve.';
          leadMsg.style.display = 'block';
        }
      });
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
