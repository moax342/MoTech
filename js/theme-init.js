/* Runs before first paint, so neither the theme nor the language flashes the
   wrong value on load. Kept deliberately tiny and dependency-free. */
(function () {
  var r = document.documentElement;
  r.classList.add('js');

  var theme = null, lang = null;
  try {
    theme = localStorage.getItem('theme');
    lang = localStorage.getItem('lang');
  } catch (e) { /* storage blocked (private mode, cookies off) — use defaults */ }

  r.setAttribute('data-theme',
    (theme === 'light' || theme === 'dark') ? theme
      : (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));

  /* English is the default; Arabic only when the visitor chose it before. */
  if (lang === 'ar') {
    r.setAttribute('lang', 'ar');
    r.setAttribute('dir', 'rtl');
  }
})();
