// lib/format.js — small render helpers shared by every view.
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Amounts are stored in minor units (centavos) to avoid float math on money.
export function peso(minorUnits) {
  const value = minorUnits / 100;
  const formatted = value.toLocaleString('en-PH', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `₱${formatted}`;
}

export function priceUnitLabel(unit) {
  return { night: '/ night', month: '/ month', term: '/ term' }[unit] || '';
}

export function verticalLabel(vertical) {
  return { stay: 'Short-term stay', lease: 'Long-term lease', storage: 'Storage / space' }[vertical] || vertical;
}

// Vertical-based placeholder art: a gradient "app icon" tile plus a stroke
// SVG glyph, used everywhere a listing photo would go until real photo
// uploads are supported. Deliberately vertical-only (not photo_emoji) so
// every card looks finished and consistent — see PHASE-NOTES.md.
export function verticalTileClass(vertical) {
  return { stay: 'tile-stay', lease: 'tile-lease', storage: 'tile-storage' }[vertical] || 'tile-stay';
}

const ICON_HOUSE =
  '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9"/><path d="M10 20v-5h4v5"/>';
const ICON_BUILDING =
  '<rect x="5" y="3" width="14" height="18" rx="1.2"/><rect x="8.4" y="6.6" width="2.6" height="2.6" fill="currentColor" stroke="none"/><rect x="13" y="6.6" width="2.6" height="2.6" fill="currentColor" stroke="none"/><rect x="8.4" y="11.4" width="2.6" height="2.6" fill="currentColor" stroke="none"/><rect x="13" y="11.4" width="2.6" height="2.6" fill="currentColor" stroke="none"/>';
const ICON_BOX = '<path d="M3 8l9-4 9 4-9 4-9-4Z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>';

export function verticalIcon(vertical, size = 44) {
  const glyph = { stay: ICON_HOUSE, lease: ICON_BUILDING, storage: ICON_BOX }[vertical] || ICON_HOUSE;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  // SQLite's datetime('now') returns "YYYY-MM-DD HH:MM:SS" in UTC with no
  // timezone marker — normalize to real ISO-8601 so Date parses it as UTC
  // instead of (inconsistently, per engine) local time.
  const normalized = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(normalized).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function statusPill(status) {
  return `<span class="pill pill-${status}">${status}</span>`;
}

export function methodLabel(method) {
  return { gcash: 'GCash', paymaya: 'PayMaya', bank: 'Bank transfer', card: 'Card', platform: 'Platform' }[method] || method;
}
