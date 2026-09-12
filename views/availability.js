// views/availability.js — host-facing calendar: see bookings/blocks at a
// glance, and add or remove manual "blocked" date ranges (maintenance,
// personal use, off-market, etc).
import { escapeHtml, formatDate, verticalLabel } from '../lib/format.js';
import { renderCalendar } from './calendarWidget.js';
import { monthLabel, shiftMonth } from '../lib/calendar.js';

export function availabilityView({ listing, blocks, statusMap, year, month, error }) {
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const blockRows = blocks.length
    ? blocks
        .map(
          (b) => `<tr>
            <td>${formatDate(b.start_date)}</td>
            <td>${b.end_date ? formatDate(b.end_date) : 'Indefinite'}</td>
            <td>${escapeHtml(b.reason || '—')}</td>
            <td>
              <form method="post" action="/listings/${listing.id}/availability/${b.id}/delete" style="display:inline;">
                <button class="btn" type="submit">Remove</button>
              </form>
            </td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="4" style="color:var(--muted)">No manual blocks — the calendar only shows actual bookings.</td></tr>`;

  const body = `
    <div class="hero">
      <span class="card-vertical">${verticalLabel(listing.vertical)}</span>
      <h1><a href="/listings/${listing.id}" style="color:inherit; text-decoration:none;">${escapeHtml(listing.title)}</a></h1>
      <p>Availability calendar. Green days are booked by a guest; red days are blocked by you.</p>
    </div>

    ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}

    <div class="dash-section">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
        <h2 style="margin:0;">${monthLabel(year, month)} onward</h2>
        <div style="display:flex; gap:8px;">
          <a class="btn" href="/listings/${listing.id}/availability?year=${prev.year}&month=${prev.month}">← Earlier</a>
          <a class="btn" href="/listings/${listing.id}/availability?year=${next.year}&month=${next.month}">Later →</a>
        </div>
      </div>
      ${renderCalendar({ year, month, monthsToShow: 3, statusMap })}
    </div>

    <div class="dash-section">
      <h2>Block dates</h2>
      <p style="color:var(--muted); font-size:0.9rem; margin-top:-8px;">Take dates off the market — maintenance, personal use, or anything else. Guests can't book over a blocked range.</p>
      <form method="post" action="/listings/${listing.id}/availability" style="display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px;">
        <label style="font-size:0.84rem; font-weight:600;">From
          <input type="date" name="start_date" required style="display:block; margin-top:4px; padding:9px 10px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); background:var(--bg); color:var(--ink);">
        </label>
        <label style="font-size:0.84rem; font-weight:600;">Until <span style="font-weight:400; color:var(--muted);">(the day you're available again — leave blank for indefinite)</span>
          <input type="date" name="end_date" style="display:block; margin-top:4px; padding:9px 10px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); background:var(--bg); color:var(--ink);">
        </label>
        <label style="font-size:0.84rem; font-weight:600; flex:1; min-width:180px;">Reason <span style="font-weight:400; color:var(--muted);">(optional)</span>
          <input type="text" name="reason" placeholder="e.g. Maintenance" style="display:block; width:100%; margin-top:4px; padding:9px 10px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); background:var(--bg); color:var(--ink);">
        </label>
        <button class="btn btn-primary" type="submit">Add block</button>
      </form>
    </div>

    <div class="dash-section">
      <h2>Current blocks</h2>
      <table class="simple">
        <tr><th>From</th><th>Until</th><th>Reason</th><th></th></tr>
        ${blockRows}
      </table>
    </div>
  `;

  return { title: `Availability — ${listing.title}`, body };
}
