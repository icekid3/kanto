// views/layout.js — the HTML shell every page renders inside.
import { escapeHtml } from '../lib/format.js';

// Runs synchronously before first paint so the page never flashes the
// wrong theme: reads the visitor's saved choice (if any) and stamps it on
// <html> before styles.css's [data-theme] rules ever get evaluated.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('kanto-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

function themeToggleButton() {
  return `
    <button class="theme-toggle" type="button" onclick="Kanto.toggleTheme()" aria-label="Toggle dark mode" title="Toggle dark mode">
      <svg class="icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.6M12 18.9v2.6M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12h2.6M18.9 12h2.6M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>
      <svg class="icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
    </button>`;
}

export function layout({ title, user, body, activeNav = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>${THEME_INIT_SCRIPT}</script>
  <title>${escapeHtml(title)} · Kanto</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site">
    <div class="container site-nav">
      <a class="brand" href="/">Kanto<span>.</span></a>
      <nav class="nav-links">
        <a class="navlink ${activeNav === 'search' ? 'active' : ''}" href="/">Browse</a>
        ${user ? `
          <a class="navlink ${activeNav === 'dashboard' ? 'active' : ''}" href="/dashboard">Dashboard</a>
          ${themeToggleButton()}
          <span style="color:var(--muted); font-size:0.88rem;">Hi, ${escapeHtml(user.name.split(' ')[0])}</span>
          <form method="post" action="/logout" style="margin:0;">
            <button class="btn" type="submit">Log out</button>
          </form>
        ` : `
          ${themeToggleButton()}
          <a class="btn" href="/login">Log in</a>
          <a class="btn btn-primary" href="/signup">Sign up</a>
        `}
      </nav>
    </div>
  </header>
  <main class="container">
    ${body}
  </main>
  <footer class="site">
    <div class="container">Kanto — prototype, not a live marketplace yet. Placeholder name — swap it for your own brand.</div>
  </footer>
  <script src="/theme.js"></script>
</body>
</html>`;
}
