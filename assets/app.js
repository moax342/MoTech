(function () {
  'use strict';
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Language toggle (EN ⇄ AR) ── */
  var lang = 'en';
  function toggleLang() {
    lang = (lang === 'en') ? 'ar' : 'en';
    var html = document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.getElementById('langBtn').textContent = (lang === 'en') ? 'ع' : 'EN';
    document.querySelectorAll('[data-en]').forEach(function (el) {
      var val = el.getAttribute('data-' + lang);
      if (val !== null) el.innerHTML = val;
    });
  }

  /* ── Theme toggle (light ⇄ dark) ── */
  var themeChange = [];                      // listeners that need to repaint
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F6F8FB' : '#0B0F14');
    themeChange.forEach(function (fn) { fn(t); });
  }

  function toggleTheme() {
    var next = currentTheme() === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('theme', next); } catch (e) {}
    applyTheme(next);
  };

  /* Follow the OS while the visitor hasn't made an explicit choice */
  var mq = matchMedia('(prefers-color-scheme: light)');
  (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(function (e) {
    var saved = null;
    try { saved = localStorage.getItem('theme'); } catch (err) {}
    if (saved !== 'light' && saved !== 'dark') applyTheme(e.matches ? 'light' : 'dark');
  });

  /* ── Reveal / falling-card entrances ── */
  var animated = document.querySelectorAll('.rv, .fall');
  function revealAll() { animated.forEach(function (el) { el.classList.add('in'); }); }

  if (reduced || !('IntersectionObserver' in window)) {
    revealAll();
  } else {
    setTimeout(revealAll, 3500);           // safety net: never leave content hidden
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    animated.forEach(function (el) { io.observe(el); });
  }

  /* ── Active nav tracking ── */
  var navLinks = [].slice.call(document.querySelectorAll('.nav-links a'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var current = null;
    function paintNav() {
      var target = (window.scrollY < 120) ? null : current;
      navLinks.forEach(function (a) {
        a.classList.toggle('active', target !== null && a.getAttribute('href') === target);
      });
    }
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) current = '#' + e.target.id; });
      paintNav();
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
    addEventListener('scroll', paintNav, { passive: true });
  }

  /* ── Hero backdrop: blocks falling through the grid ──
     Cheap 2D canvas, capped block count, paused whenever the hero is
     off-screen or the tab is hidden so it costs nothing in the background. */
  (function fallingBlocks() {
    var cv = document.getElementById('blocks');
    if (!cv || reduced) { if (cv) cv.style.display = 'none'; return; }

    var ctx = cv.getContext('2d', { alpha: true });
    if (!ctx) return;

    var blocks = [], W = 0, H = 0, dpr = 1, raf = null, visible = true;
    var COUNT = 34;
    /* Ember palette — red through orange. Light mode uses deeper, more
       saturated tones because bright orange washes out on white. */
    var PALETTE = {
      dark:  { colors: ['rgba(255,126,60,', 'rgba(248,88,64,',  'rgba(255,168,84,'], gain: 1.15 },
      light: { colors: ['rgba(208,68,22,',  'rgba(190,40,28,',  'rgba(222,104,34,'], gain: 1.35 }
    };
    var COLORS = PALETTE.dark.colors, GAIN = 1;
    function usePalette(t) {
      var p = PALETTE[t] || PALETTE.dark;
      COLORS = p.colors; GAIN = p.gain;
      for (var i = 0; i < blocks.length; i++) blocks[i].c = COLORS[(Math.random() * COLORS.length) | 0];
    }

    function size() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn(seeded) {
      var s = 7 + Math.random() * 20;
      return {
        x: Math.random() * W,
        y: seeded ? Math.random() * H : -s - Math.random() * H * 0.4,
        s: s,
        vy: 8 + Math.random() * 24,             // px per second
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.5,
        a: 0.38 + Math.random() * 0.5,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      };
    }

    function build() { blocks = []; for (var i = 0; i < COUNT; i++) blocks.push(spawn(true)); }

    var last = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      if (!visible) { last = t; return; }
      var dt = last ? Math.min((t - last) / 1000, 0.05) : 0;
      last = t;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        if (b.y - b.s > H) blocks[i] = spawn(false);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.strokeStyle = b.c + (b.a * GAIN) + ')';
        ctx.lineWidth = 1;
        ctx.strokeRect(-b.s / 2, -b.s / 2, b.s, b.s);
        ctx.fillStyle = b.c + (b.a * GAIN * 0.32) + ')';
        ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s);
        ctx.restore();
      }
    }

    size(); build();
    usePalette(currentTheme());
    themeChange.push(usePalette);
    raf = requestAnimationFrame(frame);

    var rt;
    addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { size(); build(); }, 160);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () { visible = !document.hidden; last = 0; });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting && !document.hidden;
        last = 0;
      }, { threshold: 0 }).observe(cv);
    }
  })();

  /* ── Controls: bound here, not via inline handlers, so the page needs no
        script-src 'unsafe-inline' in its Content-Security-Policy ── */
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  on('themeBtn', toggleTheme);
  on('langBtn',  toggleLang);
  on('printBtn', function () { window.print(); });

  /* ── Everything visible before printing ── */
  addEventListener('beforeprint', revealAll);
})();
