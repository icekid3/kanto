// views/booking.js — booking detail: lifecycle actions + payment ledger.
import { escapeHtml, peso, formatDate, formatDateTime, statusPill, methodLabel, verticalLabel } from '../lib/format.js';

function actionForm(action, label, kind = '') {
  return `<form method="post" action="${action}" style="display:inline-block; margin-right:8px;">
    <button class="btn ${kind}" type="submit">${label}</button>
  </form>`;
}

export function bookingDetailView({ booking, listing, guest, host, ledger, messages = [], viewerId }) {
  const isHost = viewerId === listing.host_id;
  const isGuest = viewerId === booking.guest_id;

  let actions = '';
  if (isHost && booking.status === 'pending') {
    actions =
      actionForm(`/bookings/${booking.id}/accept`, 'Accept booking', 'btn-primary') +
      actionForm(`/bookings/${booking.id}/decline`, 'Decline & refund');
  } else if (isHost && booking.status === 'confirmed') {
    actions = actionForm(`/bookings/${booking.id}/complete`, 'Mark completed & release payout', 'btn-primary');
  } else if (isGuest && (booking.status === 'pending' || booking.status === 'confirmed')) {
    actions = actionForm(`/bookings/${booking.id}/cancel`, 'Cancel booking & refund');
  }

  const ledgerRows = ledger.length
    ? ledger
        .map(
          (p) => `<tr>
            <td>${formatDate(p.created_at)}</td>
            <td style="text-transform:capitalize">${p.type}</td>
            <td>${methodLabel(p.method)}</td>
            <td>${peso(p.amount)}</td>
            <td>${statusPill(p.status)}</td>
            <td style="color:var(--muted)">${escapeHtml(p.reference)}</td>
          </tr>`
        )
        .join('')
    : `<tr><td colspan="6" style="color:var(--muted)">No payment activity yet.</td></tr>`;

  const threadRows = messages.length
    ? messages
        .map((m) => {
          const mine = m.sender_id === viewerId;
          return `<div class="msg ${mine ? 'msg-mine' : 'msg-theirs'}">
            <div class="msg-meta">${escapeHtml(mine ? 'You' : m.sender_name)} · ${formatDateTime(m.created_at)}</div>
            <div class="msg-body">${escapeHtml(m.body)}</div>
          </div>`;
        })
        .join('')
    : `<p style="color:var(--muted)">No messages yet — say hello.</p>`;

  const body = `
    <div class="hero">
      <span class="card-vertical">${verticalLabel(listing.vertical)}</span>
      <h1><a href="/listings/${listing.id}" style="color:inherit; text-decoration:none;">${escapeHtml(listing.title)}</a></h1>
      <p>${escapeHtml(listing.city)} · ${formatDate(booking.start_date)}${booking.end_date ? ' → ' + formatDate(booking.end_date) : ''} · ${booking.billing_type === 'recurring' ? 'Recurring (monthly)' : 'One-time'}</p>
    </div>

    <div class="detail-grid">
      <div>
        <div class="dash-section">
          <h2>Status</h2>
          <p>Booking ${statusPill(booking.status)} &nbsp; Payment ${statusPill(booking.payment_status)}</p>
          <p style="color:var(--muted); font-size:0.9rem;">Guest: ${escapeHtml(guest.name)} · Host: ${escapeHtml(host.name)}</p>
          ${actions ? `<div style="margin-top:14px;">${actions}</div>` : `<p class="demo-note" style="margin-top:14px;">No actions available for this booking's current status.</p>`}
        </div>

        <div class="dash-section">
          <h2>Payment ledger</h2>
          <table class="simple">
            <tr><th>Date</th><th>Type</th><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th></tr>
            ${ledgerRows}
          </table>
        </div>

        <div class="dash-section" id="messages">
          <h2>Messages</h2>
          <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">Between you and ${escapeHtml(isHost ? guest.name : host.name)}, about this booking.</p>
          <div class="thread">${threadRows}</div>
          <form method="post" action="/bookings/${booking.id}/messages" class="msg-form">
            <textarea name="body" rows="2" placeholder="Write a message…" required></textarea>
            <button class="btn btn-primary" type="submit">Send</button>
          </form>
        </div>
      </div>

      <div class="booking-box" style="position:static;">
        <div class="price-line"><span>Total</span><span>${peso(booking.total_amount)}</span></div>
        <div class="price-line"><span>Platform commission (10%)</span><span>${peso(booking.commission_amount)}</span></div>
        <div class="price-line total"><span>Host payout</span><span>${peso(booking.payout_amount)}</span></div>
      </div>
    </div>
  `;

  return { title: `${listing.title} — booking`, body };
}
