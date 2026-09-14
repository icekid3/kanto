// views/about.js — "why Kanto" marketing splash page, and now the site's
// actual homepage ("/"). The functional Browse/search grid that used to
// live at "/" moved to "/browse" (views/home.js) — see PHASE-NOTES.md
// (Phase 15, Phase 15.1).
import { escapeHtml } from '../lib/format.js';

const ICON_SEARCH = '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>';
const ICON_FLOW = '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>';
const ICON_DASHBOARD = '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>';

function icon(path, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const FEATURES = [
  {
    icon: ICON_SEARCH,
    title: 'One search, every kind of space',
    body: 'Short-term stays, long-term leases, and rentable spaces — all in one marketplace instead of three different apps.',
  },
  {
    icon: ICON_FLOW,
    title: 'A clear path from inquiry to move-in',
    body: 'Message a host, apply with a verified reference, get approved, then pay — every step tracked in one place for both sides.',
  },
  {
    icon: ICON_DASHBOARD,
    title: 'Built for owners running a real business',
    body: 'Hosts manage listings, applications, bookings, and messages from one dashboard — no spreadsheets, no separate booking book.',
  },
];

function miniBrowsePreview() {
  const tiles = [
    { cls: 'tile-stay', title: 'Sunset Studio, Boracay', price: '₱3,200/night' },
    { cls: 'tile-lease', title: '2BR Condo, Lahug', price: '₱18,000/mo' },
    { cls: 'tile-storage', title: 'Drive-Up Space', price: '₱2,500/mo' },
  ];
  return `
    <div class="mini-grid">
      ${tiles
        .map(
          (t) => `
        <div class="mini-card">
          <div class="mini-card-photo ${t.cls}"></div>
          <div class="mini-card-body">
            <p class="mini-card-title">${escapeHtml(t.title)}</p>
            <div class="mini-card-price">${escapeHtml(t.price)}</div>
          </div>
        </div>`
        )
        .join('')}
    </div>`;
}

function miniFlowPreview() {
  const steps = [
    { label: 'Inquire', done: true },
    { label: 'Book', done: true },
    { label: 'Move in', done: false },
  ];
  return `
    <div class="mini-flow">
      ${steps
        .map(
          (s, i) => `
        ${i > 0 ? '<span class="mini-flow-arrow">&rarr;</span>' : ''}
        <span class="mini-flow-step ${s.done ? 'done' : ''}"><span class="mini-flow-dot">${s.done ? '✓' : i + 1}</span>${escapeHtml(s.label)}</span>`
        )
        .join('')}
    </div>`;
}

function miniDashboardPreview() {
  const stats = [
    { num: '6', label: 'Active listings' },
    { num: '3', label: 'Pending applications' },
    { num: '11', label: 'Bookings this month' },
    { num: '4.9★', label: 'Avg. host rating' },
  ];
  return `
    <div class="mini-stats">
      ${stats
        .map(
          (s) => `
        <div class="mini-stat">
          <div class="mini-stat-num">${escapeHtml(s.num)}</div>
          <div class="mini-stat-label">${escapeHtml(s.label)}</div>
        </div>`
        )
        .join('')}
    </div>`;
}

const SHOWCASE = [
  { title: 'Search stays, leases & spaces', body: 'Filter by city and price across every listing type, side by side.', preview: miniBrowsePreview() },
  { title: 'Inquire, book & move in', body: 'One simple flow from a first message to the keys in hand.', preview: miniFlowPreview() },
  { title: 'Run it all from one dashboard', body: 'Listings, applications, bookings, and messages, at a glance.', preview: miniDashboardPreview() },
];

export function aboutView() {
  const body = `
    <div class="about-page">
      <div class="about-hero">
        <div class="about-copy">
          <div class="about-eyebrow-row" aria-hidden="true">
            <span>Stays</span><span>Leases</span><span>Spaces</span>
          </div>

          <div class="about-cta-row about-cta-top">
            <a class="btn btn-primary" href="/browse">Browse listings</a>
            <a class="btn" href="/signup?role=host">List your space</a>
          </div>

          <h1>Every kind of space,<br><em>one easy platform.</em></h1>
          <p>Kanto brings short-term stays, long-term leases, and rentable spaces into a single marketplace — hosted by owners across the Philippines. Search and book as a guest, or list your own space and manage it from one dashboard.</p>

          <div class="about-features">
            ${FEATURES.map(
              (f) => `
              <div class="about-feature">
                <span class="about-feature-icon">${icon(f.icon)}</span>
                <div><strong>${escapeHtml(f.title)}</strong><p>${escapeHtml(f.body)}</p></div>
              </div>`
            ).join('')}
          </div>
        </div>

        <div class="about-showcase">
          ${SHOWCASE.map(
            (s, i) => `
            <div class="showcase-item">
              <div class="showcase-num">0${i + 1}</div>
              <div class="showcase-text">
                <h3>${escapeHtml(s.title)}</h3>
                <p>${escapeHtml(s.body)}</p>
              </div>
              <div class="showcase-preview">${s.preview}</div>
            </div>`
          ).join('')}
        </div>
      </div>
    </div>
  `;
  return { title: 'Kanto', body };
}
