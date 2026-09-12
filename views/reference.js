// views/reference.js — a single verified reference-check thread: the
// reviewing (requesting) host asking one of an applicant's past, verified
// Kanto hosts about their experience. Visible only to those two hosts —
// same 2-party privacy convention as booking/application/inquiry messages
// elsewhere in the app. The applicant themselves never sees this thread,
// only that a request exists and its status (see applicationDetailView).
import { escapeHtml, formatDate, formatDateTime, statusPill } from '../lib/format.js';

const RATING_LABEL = { positive: 'Would rent to again', neutral: 'Neutral', negative: 'Would not rent again' };

export function referenceDetailView({ ref, application, listing, pastListing, applicant, requestingHost, pastHost, messages = [], viewerId }) {
  const isPastHost = viewerId === ref.past_host_id;
  const isRequestingHost = viewerId === ref.requesting_host_id;

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
    : `<p style="color:var(--muted)">No messages yet.${isRequestingHost ? ` Say hello and ask ${escapeHtml(pastHost.name)} about their experience with ${escapeHtml(applicant.name)}.` : ''}</p>`;

  const ratingBlock = isPastHost
    ? `
    <div class="dash-section">
      <h2>Your reference</h2>
      <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">Optional — a quick signal alongside your message, visible to ${escapeHtml(requestingHost.name)}.</p>
      <form method="post" action="/references/${ref.id}/rate" style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn ${ref.rating === 'positive' ? 'btn-primary' : ''}" name="rating" value="positive" type="submit">👍 Would rent to again</button>
        <button class="btn ${ref.rating === 'neutral' ? 'btn-primary' : ''}" name="rating" value="neutral" type="submit">Neutral</button>
        <button class="btn ${ref.rating === 'negative' ? 'btn-primary' : ''}" name="rating" value="negative" type="submit">👎 Would not rent again</button>
      </form>
    </div>`
    : ref.rating
    ? `<div class="dash-section"><h2>Reference given</h2><p>${escapeHtml(pastHost.name)} said: <strong>${RATING_LABEL[ref.rating] || ref.rating}</strong></p></div>`
    : '';

  const body = `
    <div class="hero">
      <span class="card-vertical">Reference check</span>
      <h1>${escapeHtml(applicant.name)}'s stay at ${escapeHtml(pastListing.title)}</h1>
      <p>
        ${isRequestingHost ? `You asked ${escapeHtml(pastHost.name)}` : `${escapeHtml(requestingHost.name)} asked you`}
        about ${escapeHtml(applicant.name)}'s completed stay (ended ${formatDate(ref.stay_end_date)}),
        for their application to <a href="/applications/${application.id}">${escapeHtml(listing.title)}</a>.
        ${statusPill(ref.status)}
      </p>
    </div>

    <div class="detail-grid">
      <div>
        ${ratingBlock}
        <div class="dash-section" id="messages">
          <h2>Messages</h2>
          <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">Between ${escapeHtml(requestingHost.name)} and ${escapeHtml(pastHost.name)} only — ${escapeHtml(applicant.name)} can't see this thread, only that a reference was requested.</p>
          <div class="thread">${threadRows}</div>
          <form method="post" action="/references/${ref.id}/messages" class="msg-form">
            <textarea name="body" rows="2" placeholder="Write a message…" required></textarea>
            <button class="btn btn-primary" type="submit">Send</button>
          </form>
        </div>
      </div>
      <div class="booking-box" style="position:static;">
        <div class="price-line"><span>Status</span><span>${statusPill(ref.status)}</span></div>
        <div class="price-line"><span>Requested</span><span>${formatDate(ref.created_at)}</span></div>
        ${ref.rating ? `<div class="price-line total"><span>Reference</span><span>${RATING_LABEL[ref.rating] || ref.rating}</span></div>` : ''}
      </div>
    </div>
  `;
  return { title: `Reference check — ${applicant.name}`, body };
}
