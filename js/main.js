/* ═══════════════════════════════════════════════════════════════════════════
   Mohammed Altoum — portfolio behaviour.
   No framework, no dependencies, no network calls. Every listener is bound
   here rather than inline so the page needs no script-src 'unsafe-inline'.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ══ 1. Language (EN ⇄ AR) ════════════════════════════════════════════════
     Both translations live on the element itself as data-en / data-ar, so a
     string can never drift away from the markup it belongs to. Attributes that
     also need translating carry data-{lang}-aria and data-{lang}-ph.

     The values are author-written static markup, and the page's CSP forbids
     inline scripts and handlers — but this is the one place markup is parsed
     at runtime, so it does not rely on either fact. setMarkup parses into a
     detached template and keeps only the handful of inline tags the copy
     actually uses, dropping every attribute and every other element. An
     injected <img onerror>, <script> or <iframe> does not survive it, whatever
     a future edit or a loosened CSP might allow. */
  var LANG_LABEL = { en: 'ع', ar: 'EN' };
  /* The copy only ever uses <strong>, <b> and <br>; <em>/<i> are allowed as
     equivalents. Anything else is either unwrapped to its text or, for the
     containers below whose text is code rather than prose, dropped whole. */
  var ALLOWED_TAGS = { STRONG: 1, B: 1, EM: 1, I: 1, BR: 1 };
  var DROP_WHOLE = { SCRIPT: 1, STYLE: 1, TEMPLATE: 1, NOSCRIPT: 1, IFRAME: 1,
                     OBJECT: 1, EMBED: 1, LINK: 1, META: 1, SVG: 1, MATH: 1 };

  function sanitise(node) {
    var child = node.firstChild;
    while (child) {
      var next = child.nextSibling;
      if (child.nodeType === 1) {                       /* element */
        if (DROP_WHOLE[child.tagName] === 1) {
          node.removeChild(child);
        } else if (ALLOWED_TAGS[child.tagName] !== 1) {
          /* Keep the text, drop the element and anything hanging off it. */
          node.replaceChild(document.createTextNode(child.textContent), child);
        } else {
          while (child.attributes.length) child.removeAttribute(child.attributes[0].name);
          sanitise(child);
        }
      } else if (child.nodeType !== 3) {                /* comment, CDATA, … */
        node.removeChild(child);
      }
      child = next;
    }
  }

  function setMarkup(el, html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    sanitise(tpl.content);
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(tpl.content);
  }

  function applyLang(lang) {
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');

    $$('[data-' + lang + ']').forEach(function (el) {
      var val = el.getAttribute('data-' + lang);
      if (val === null) return;
      if (el.hasAttribute('data-i18n-content')) el.setAttribute('content', val);
      else setMarkup(el, val);
    });
    $$('[data-' + lang + '-aria]').forEach(function (el) {
      el.setAttribute('aria-label', el.getAttribute('data-' + lang + '-aria'));
    });
    $$('[data-' + lang + '-ph]').forEach(function (el) {
      el.setAttribute('placeholder', el.getAttribute('data-' + lang + '-ph'));
    });

    $$('.lang-btn').forEach(function (b) { b.textContent = LANG_LABEL[lang]; });
  }

  function toggleLang() {
    var next = root.getAttribute('lang') === 'ar' ? 'en' : 'ar';
    store.set('lang', next);
    applyLang(next);
  }

  /* theme-init.js already set lang="ar" pre-paint; fill in the content now. */
  if (root.getAttribute('lang') === 'ar') applyLang('ar');

  /* ══ 2. Theme (dark ⇄ light) ═════════════════════════════════════════════ */
  function currentTheme() { return root.getAttribute('data-theme') || 'dark'; }

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F7F8FC' : '#05070F');
    $$('.theme-btn').forEach(function (b) {
      b.setAttribute('aria-pressed', String(t === 'light'));
    });
  }

  function toggleTheme() {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    store.set('theme', next);
    applyTheme(next);
  }
  applyTheme(currentTheme());

  /* Keep following the OS until the visitor makes an explicit choice. */
  var mq = matchMedia('(prefers-color-scheme: light)');
  var onScheme = function (e) {
    var saved = store.get('theme');
    if (saved !== 'light' && saved !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
  };
  if (mq.addEventListener) mq.addEventListener('change', onScheme);
  else if (mq.addListener) mq.addListener(onScheme);

  /* ══ 3. Mobile drawer ════════════════════════════════════════════════════ */
  var drawer = $('#drawer'), burger = $('#burger');

  function setDrawer(open) {
    if (!drawer || !burger) return;
    drawer.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  }
  if (burger) {
    burger.addEventListener('click', function () {
      setDrawer(!drawer.classList.contains('open'));
    });
  }
  if (drawer) {
    drawer.addEventListener('click', function (e) {
      if (e.target.closest('a,button')) setDrawer(false);
    });
  }
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setDrawer(false);
  });
  /* A drawer left open across the desktop breakpoint would hang over the page. */
  var wide = matchMedia('(min-width: 981px)');
  var onWide = function (e) { if (e.matches) setDrawer(false); };
  if (wide.addEventListener) wide.addEventListener('change', onWide);
  else if (wide.addListener) wide.addListener(onWide);

  /* ══ 4. Scroll chrome: progress bar, nav border, active section ══════════ */
  var bar = $('#progress'), nav = $('#nav'), toTop = $('#toTop');
  var navLinks = $$('.nav-link');
  var sections = navLinks
    .map(function (a) { return $(a.getAttribute('href')); })
    .filter(Boolean);
  var activeId = null;
  var ticking = false;

  function paintScroll() {
    ticking = false;
    var y = scrollY;
    var max = document.documentElement.scrollHeight - innerHeight;

    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    if (nav) nav.classList.toggle('stuck', y > 8);
    if (toTop) toTop.classList.toggle('show', y > innerHeight * 0.9);

    var target = y < 140 ? null : activeId;
    navLinks.forEach(function (a) {
      a.classList.toggle('active', target !== null && a.getAttribute('href') === target);
    });
  }
  addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(paintScroll); }
  }, { passive: true });
  addEventListener('resize', paintScroll, { passive: true });

  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activeId = '#' + e.target.id; });
      paintScroll();
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }
  paintScroll();

  if (toTop) {
    toTop.addEventListener('click', function () {
      scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ══ 5. Reveal on scroll ═════════════════════════════════════════════════ */
  var revealables = $$('.rv');
  function revealAll() { revealables.forEach(function (el) { el.classList.add('in'); }); }

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    /* Safety net: content is never left invisible, whatever the observer does. */
    setTimeout(revealAll, 4000);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ══ 6. Statistic counters ═══════════════════════════════════════════════ */
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;

    if (reduced || !('IntersectionObserver' in window)) { el.textContent = target; return; }

    var run = function () {
      var t0 = null, dur = 1100;
      var step = function (t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var co = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { run(); co.disconnect(); }
    }, { threshold: 0.6 });
    co.observe(el);
  });

  /* ══ 7. Project filters ══════════════════════════════════════════════════ */
  var chips = $$('.chip'), cards = $$('.project'), count = $('#projCount');

  function filter(cat) {
    var shown = 0;
    cards.forEach(function (c) {
      var match = cat === 'all' || (' ' + c.getAttribute('data-cats') + ' ').indexOf(' ' + cat + ' ') > -1;
      c.hidden = !match;
      if (match) shown++;
    });
    chips.forEach(function (ch) {
      ch.setAttribute('aria-pressed', String(ch.getAttribute('data-filter') === cat));
    });
    if (count) {
      count.textContent = shown;
      /* Newly shown cards must not stay stuck at opacity 0. */
      cards.forEach(function (c) { if (!c.hidden) c.classList.add('in'); });
    }
  }
  chips.forEach(function (ch) {
    ch.addEventListener('click', function () { filter(ch.getAttribute('data-filter')); });
  });

  /* ══ 8. Contact form → the visitor's own mail client ══════════════════════
     There is no backend behind this site, so the form composes a message in
     whatever mail client the visitor already uses rather than pretending to
     send one. To post to a real endpoint instead, set MAIL_ENDPOINT below and
     the form will POST JSON to it — note the CSP in index.html and _headers
     restricts connect-src, so that origin has to be allowed there too. */
  var MAIL_ENDPOINT = '';
  var TO = 'mabdulla.alt@gmail.com';
  var form = $('#contactForm');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();
      if (!name || !email || !message) return;

      if (MAIL_ENDPOINT) {
        fetch(MAIL_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, message: message })
        });
        return;
      }
      var subject = 'Portfolio enquiry — ' + name;
      var body = message + '\n\n— ' + name + '\n' + email;
      location.href = 'mailto:' + TO +
        '?subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
    });
  }

  /* ══ 9. Buttons ══════════════════════════════════════════════════════════ */
  $$('.theme-btn').forEach(function (b) { b.addEventListener('click', toggleTheme); });
  $$('.lang-btn').forEach(function (b) { b.addEventListener('click', toggleLang); });
  $$('.print-btn').forEach(function (b) { b.addEventListener('click', function () { print(); }); });

  /* Nothing may be mid-animation when the print sheet is captured — a counter
     caught mid-tween would print a number that is simply wrong. */
  function snapCounters() {
    $$('[data-count]').forEach(function (el) {
      var target = el.getAttribute('data-count');
      if (el.textContent !== target) el.textContent = target;
    });
  }
  addEventListener('beforeprint', function () { revealAll(); snapCounters(); });
})();
