// views/home.js — guest-facing search / discovery page.
import { escapeHtml, peso, priceUnitLabel, verticalLabel } from '../lib/format.js';

const VERTICALS = [
  { key: '', label: 'All' },
  { key: 'stay', label: 'Short-term stays' },
  { key: 'lease', label: 'Long-term leases' },
  { key: 'storage', label: 'Storage & spaces' },
];

function qs(params) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : '';
}

function listingCard(l) {
  return `
  <a class="card" href="/listings/${l.id}">
    <div class="card-photo">${l.photo_emoji || '🏷️'}</div>
    <div class="card-body">
      <span class="card-vertical">${verticalLabel(l.vertical)}</span>
      <h3 class="card-title">${escapeHtml(l.title)}</h3>
      <span class="card-loc">${escapeHtml(l.city)}${l.size_label ? ' · ' + escapeHtml(l.size_label) : ''}</span>
      <div class="card-price">${peso(l.price_amount)} <small>${priceUnitLabel(l.price_unit)}</small></div>
    </div>
  </a>`;
}

export function homeView({ listings, query = {}, user }) {
  const vertical = query.vertical || '';
  const city = query.city || '';
  const sort = query.sort || '';

  const tabs = VERTICALS.map(
    (v) => `<a class="vtab ${vertical === v.key ? 'active' : ''}" href="/${qs({ vertical: v.key, city, sort })}">${v.label}</a>`
  ).join('');

  const cards = listings.length
    ? `<div class="grid">${listings.map(listingCard).join('')}</div>`
    : `<div class="empty-state">No listings match those filters yet. <a href="/">Clear filters</a></div>`;

  const body = `
    <div class="hero">
      <h1>Find a stay, a lease, or a space</h1>
      <p>One search across short-term stays, long-term leases, and storage or rentable spaces — hosted by owners across the Philippines. Sample listings shown below; this is a Phase 1 prototype.</p>
    </div>

    <div class="vertical-tabs">${tabs}</div>

    <form class="filter-bar" method="get" action="/">
      <input type="hidden" name="vertical" value="${escapeHtml(vertical)}">
      <div class="field">
        <label for="city">City</label>
        <input id="city" type="text" name="city" placeholder="e.g. Cebu City" value="${escapeHtml(city)}">
      </div>
      <div class="field">
        <label for="sort">Sort by</label>
        <select id="sort" name="sort">
          <option value="" ${sort === '' ? 'selected' : ''}>Newest</option>
          <option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Price: low to high</option>
          <option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Price: high to low</option>
        </select>
      </div>
      <button class="btn btn-primary" type="submit">Search</button>
    </form>

    <p class="result-count">${listings.length} listing${listings.length === 1 ? '' : 's'}</p>
    ${cards}
  `;

  return { title: 'Browse listings', body, activeNav: 'search' };
}
