(function () {
  try {
    var root = document.documentElement;
    var scheme = localStorage.getItem('mantine-color-scheme-value');

    if (scheme === 'auto') {
      scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    root.setAttribute('data-mantine-color-scheme', scheme === 'light' ? 'light' : 'dark');
    root.setAttribute('data-theme-variant', localStorage.getItem('theme_variant') || 'standard');
  } catch {
    // storage blocked, Mantine applies its default on mount
  }
})();
