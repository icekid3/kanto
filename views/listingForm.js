// views/listingForm.js — shared create/edit form for a host's listing.
import { escapeHtml } from '../lib/format.js';

const VERTICALS = [
  { value: 'stay', label: 'Short-term stay' },
  { value: 'lease', label: 'Long-term lease' },
  { value: 'storage', label: 'Storage / space' },
];
const PRICE_UNITS = [
  { value: 'night', label: 'Per night' },
  { value: 'month', label: 'Per month' },
  { value: 'term', label: 'Flat, per term' },
];
const STATUSES = [
  { value: 'active', label: 'Active — visible in search' },
  { value: 'draft', label: 'Draft — hidden, still working on it' },
  { value: 'inactive', label: 'Inactive — hidden, paused' },
];

function select(name, options, current) {
  return `<select id="${name}" name="${name}">
    ${options.map((o) => `<option value="${o.value}" ${o.value === current ? 'selected' : ''}>${o.label}</option>`).join('')}
  </select>`;
}

export function listingFormView({ mode, listing, error } = {}) {
  const v = listing || {
    vertical: 'stay',
    title: '',
    description: '',
    city: '',
    region: '',
    address: '',
    price_amount: '',
    price_unit: 'night',
    capacity: '',
    size_label: '',
    amenities: '[]',
    photo_emoji: '',
    status: 'active',
  };
  const priceDisplay = typeof v.price_amount === 'number' ? (v.price_amount / 100).toString() : v.price_amount;
  const amenitiesDisplay = Array.isArray(v.amenities) ? v.amenities.join(', ') : JSON.parse(v.amenities || '[]').join(', ');
  const action = mode === 'edit' ? `/listings/${listing.id}/edit` : '/listings/new';

  const body = `
    <div class="auth-wrap" style="max-width:560px;">
      <h1>${mode === 'edit' ? 'Edit listing' : 'New listing'}</h1>
      <p class="sub">${mode === 'edit' ? 'Update the details renters see.' : 'Fill this in the way a renter would want to see it — it goes straight to search once published.'}</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="${action}">
        <label>Vertical ${select('vertical', VERTICALS, v.vertical)}</label>
        <label>Title
          <input type="text" name="title" value="${escapeHtml(v.title)}" required maxlength="120" placeholder="e.g. Sunset Studio near Boracay Station 1">
        </label>
        <label>Description
          <textarea name="description" required rows="4" style="width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); font-size:0.95rem; background:var(--bg); color:var(--ink); margin-top:4px;">${escapeHtml(v.description)}</textarea>
        </label>
        <label>City <input type="text" name="city" value="${escapeHtml(v.city)}" required placeholder="e.g. Cebu City"></label>
        <label>Region <input type="text" name="region" value="${escapeHtml(v.region || '')}" placeholder="e.g. Central Visayas (optional)"></label>
        <label>Street address
          <input type="text" name="address" value="${escapeHtml(v.address || '')}" placeholder="optional — shown publicly as a Google Maps / Street View link so renters can check the location before inquiring">
        </label>
        <div style="display:flex; gap:14px;">
          <label style="flex:1;">Price (₱)
            <input type="number" name="price_amount" min="1" step="1" value="${escapeHtml(priceDisplay)}" required placeholder="e.g. 3200">
          </label>
          <label style="flex:1;">Billed ${select('price_unit', PRICE_UNITS, v.price_unit)}</label>
        </div>
        <label>Capacity (guests) <input type="number" name="capacity" min="1" step="1" value="${escapeHtml(v.capacity ?? '')}" placeholder="optional"></label>
        <label>Size / layout label <input type="text" name="size_label" value="${escapeHtml(v.size_label || '')}" placeholder="e.g. 2BR / 65 sqm (optional)"></label>
        <label>Amenities <input type="text" name="amenities" value="${escapeHtml(amenitiesDisplay)}" placeholder="comma-separated, e.g. WiFi, Aircon, Pool"></label>
        <label>Photo emoji <input type="text" name="photo_emoji" value="${escapeHtml(v.photo_emoji || '')}" maxlength="4" placeholder="🏖️ (used as a placeholder photo)"></label>
        <label>Status ${select('status', STATUSES, v.status)}</label>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px;">${mode === 'edit' ? 'Save changes' : 'Create listing'}</button>
      </form>
      ${mode === 'edit' ? `<p class="foot-link"><a href="/listings/${listing.id}">← Back to listing</a></p>` : ''}
    </div>
  `;

  return { title: mode === 'edit' ? 'Edit listing' : 'New listing', body };
}
