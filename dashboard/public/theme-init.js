// Applies the saved theme before the page paints, so there is no flash of the wrong colours.
(function () {
  var theme = 'dark';
  try {
    var saved = JSON.parse(localStorage.getItem('fc.prefs.v1') || '{}').theme;
    if (saved === 'light') theme = 'light';
    else if (saved === 'system' && window.matchMedia('(prefers-color-scheme: light)').matches) theme = 'light';
  } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();
