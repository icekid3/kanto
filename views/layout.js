// views/layout.js — the HTML shell every page renders inside.
import { escapeHtml } from '../lib/format.js';

export function layout({ title, user, body, activeNav = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Kanto</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="site">
    <div class="container site-nav">
      <a class="brand" href="/">Kanto<span>.</span></a>
      <nav class="nav-links">
        <a href="/" ${activeNav === 'search' ? 'style="color:var(--accent)"' : ''}>Browse</a>
        ${user ? `
          <a href="/dashboard" ${activeNav === 'dashboard' ? 'style="color:var(--accent)"' : ''}>Dashboard</a>
          <span style="color:var(--muted); font-size:0.88rem;">Hi, ${escapeHtml(user.name.split(' ')[0])}</span>
          <form method="post" action="/logout" style="margin:0;">
            <button class="btn" type="submit">Log out</button>
          </form>
        ` : `
          <a href="/login">Log in</a>
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
</body>
</html>`;
}
