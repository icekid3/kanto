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
