// views/inquiry.js — pre-booking listing inquiry thread: a guest messaging
// a host about a listing before any rental application or booking exists.
import { escapeHtml, formatDateTime } from '../lib/format.js';

export function inquiryFormView({ listing, error, values = {} } = {}) {
  const body = `
    <div class="auth-wrap" style="max-width:560px;">
      <h1>Message the host</h1>
      <p class="sub">${escapeHtml(listing.title)} — ask a question before you apply or book. No application needed.</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/listings/${listing.id}/inquire">
        <label>Your message
          <textarea name="body" rows="4" required style="width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); font-size:0.95rem; background:var(--bg); color:var(--ink); margin-top:4px;" placeholder="e.g. Is this still available in October? Is the unit pet-friendly?">${escapeHtml(values.body || '')}</textarea>
        </label>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px;">Send message</button>
      </form>
      <p class="foot-link"><a href="/listings/${listing.id}">← Back to listing</a></p>
    </div>
  `;
  return { title: `Message the host — ${listing.title}`, body };
}

export function inquiryDetailView({ inquiry, listing, guest, host, messages = [], viewerId }) {
  const isHost = viewerId === listing.host_id;

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
    : `<p style="color:var(--muted)">No messages yet.</p>`;

  const body = `
    <div class="hero">
      <span class="card-vertical">Listing inquiry</span>
      <h1><a href="/listings/${listing.id}" style="color:inherit; text-decoration:none;">${escapeHtml(listing.title)}</a></h1>
      <p>Between ${escapeHtml(guest.name)} and ${escapeHtml(host.name)} · started ${formatDateTime(inquiry.created_at)}</p>
    </div>

    <div class="detail-grid">
      <div>
        <div class="dash-section" id="messages">
          <h2>Messages</h2>
          <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">Only the two of you can see this thread.</p>
          <div class="thread">${threadRows}</div>
          <form method="post" action="/inquiries/${inquiry.id}/messages" class="msg-form">
            <textarea name="body" rows="2" placeholder="Write a message…" required></textarea>
            <button class="btn btn-primary" type="submit">Send</button>
          </form>
        </div>
      </div>
      <div class="booking-box" style="position:static;">
        <div class="price-line"><span>Listing</span><span><a href="/listings/${listing.id}">View listing →</a></span></div>
        ${!isHost && listing.vertical === 'lease' ? `<div class="price-line total"><span>Ready to move forward?</span><span><a href="/listings/${listing.id}/apply">Apply to rent →</a></span></div>` : ''}
      </div>
    </div>
  `;
  return { title: `Inquiry — ${listing.title}`, body };
}
