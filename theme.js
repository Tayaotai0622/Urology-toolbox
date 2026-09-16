/* Appearance only. The sole saved value is "light" or "dark"; no form data. */
(function () {
  'use strict';
  const storageKey = 'urology-toolbox-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = null;
  let toggle;

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Storage may be unavailable; the switch still works for this page visit.
  }

  function applyTheme() {
    const theme = preference ?? (systemTheme.matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = theme;
    if (toggle) {
      const action = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
      toggle.textContent = action;
      toggle.setAttribute('aria-label', `Switch to ${action}`);
    }
  }

  // Run in the head before the stylesheet/body to avoid an initial wrong theme.
  applyTheme();
  systemTheme.addEventListener('change', () => {
    if (preference === null) applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    toggle = document.getElementById('theme-toggle');
    applyTheme();
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      try {
        window.localStorage.setItem(storageKey, preference);
      } catch {
        // A blocked/full store must not interrupt the UI or calculations.
      }
    });
  });
})();
