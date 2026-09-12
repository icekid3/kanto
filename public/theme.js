// public/theme.js — the dark-mode toggle button's click handler. The
// no-flash theme *read* happens earlier, inline in views/layout.js's
// <head> (before this file even loads); this just handles flipping it.
window.Kanto = window.Kanto || {};

Kanto.toggleTheme = function () {
  var current = document.documentElement.getAttribute('data-theme');
  var systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var effective = current || (systemPrefersDark ? 'dark' : 'light');
  var next = effective === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem('kanto-theme', next);
  } catch (e) {
    // Private browsing / storage disabled — theme still applies for this
    // page view, it just won't be remembered next visit.
  }
};
