// views/application.js — rental application: consent + previous-landlord
// referral, submitted before a lease listing can be booked.
import { escapeHtml, formatDate, formatDateTime, statusPill } from '../lib/format.js';

export function applicationFormView({ listing, error, values = {} } = {}) {
  const body = `
    <div class="auth-wrap" style="max-width:560px;">
      <h1>Apply to rent</h1>
      <p class="sub">${escapeHtml(listing.title)} — the host reviews this before you can book and pay.</p>
      ${error ? `<div class="alert">${escapeHtml(error)}</div>` : ''}
      <form method="post" action="/listings/${listing.id}/apply">
        <label>Move-in date <input type="date" name="move_in_date" value="${escapeHtml(values.move_in_date || '')}" required></label>
        <label>Employment / occupation <input type="text" name="employment" value="${escapeHtml(values.employment || '')}" placeholder="e.g. Nurse at Chong Hua Hospital"></label>
        <label>Previous landlord's name <input type="text" name="previous_landlord_name" value="${escapeHtml(values.previous_landlord_name || '')}" required></label>
        <label>Previous landlord's contact <input type="text" name="previous_landlord_contact" value="${escapeHtml(values.previous_landlord_contact || '')}" placeholder="phone or email" required></label>
        <label>Anything you'd like the host to know
          <textarea name="message" rows="3" style="width:100%; padding:10px 12px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); font-size:0.95rem; background:var(--bg); color:var(--ink); margin-top:4px;">${escapeHtml(values.message || '')}</textarea>
        </label>
        <label style="display:flex; align-items:flex-start; gap:8px; font-weight:500;">
          <input type="checkbox" name="consent_background_check" value="yes" style="width:auto; margin-top:3px;" ${values.consent_background_check ? 'checked' : ''} required>
          <span>I consent to the host contacting my previous landlord above, and to my completed stays on Kanto being shown to hosts I apply to so they can request a reference directly from those past hosts.</span>
        </label>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px;">Submit application</button>
      </form>
      <p class="demo-note" style="margin-top:14px;">This collects your consent and a previous-landlord reference for the host to follow up on directly — it does not run an automated criminal or credit check.</p>
    </div>
  `;
  return { title: 'Apply to rent', body };
}

export function applicationDetailView({ application, listing, applicant, host, messages = [], viewerId, verifiedLandlords = [], referenceRequests = [] }) {
  const isHost = viewerId === listing.host_id;
  const isApplicant = viewerId === application.applicant_id;

  const verifiedSection = !application.consent_background_check
    ? (isHost
        ? `<div class="dash-section"><h2>Verified previous landlords on Kanto</h2><p style="color:var(--muted)">The applicant hasn't consented to sharing verified Kanto stay history for this application.</p></div>`
        : '')
    : `
    <div class="dash-section" id="verified-landlords">
      <h2>Verified previous landlords on Kanto</h2>
      <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">
        ${verifiedLandlords.length
          ? `${escapeHtml(applicant.name)} has ${verifiedLandlords.length} verified completed ${verifiedLandlords.length === 1 ? 'stay' : 'stays'} on Kanto${isHost ? ' — request a reference straight from a past host below.' : '.'}`
          : `No verified completed stays on Kanto yet for ${escapeHtml(applicant.name)}${isHost ? ' — nothing to check here besides the self-reported reference above.' : '.'}`}
      </p>
      ${
        verifiedLandlords.length
          ? `<table class="simple">
              <tr><th>Past host</th><th>Listing</th><th>Stay ended</th><th>Reference</th></tr>
              ${verifiedLandlords
                .map((l) => {
                  const existingReq = referenceRequests.find((r) => r.past_host_id === l.host_id);
                  let cell;
                  if (existingReq) {
                    cell = isHost
                      ? `<a href="/references/${existingReq.id}">${statusPill(existingReq.status)}</a>`
                      : statusPill(existingReq.status);
                  } else if (isHost) {
                    cell = `<form method="post" action="/applications/${application.id}/references" style="display:inline;">
                      <input type="hidden" name="past_host_id" value="${l.host_id}">
                      <input type="hidden" name="past_booking_id" value="${l.booking_id}">
                      <button class="btn" type="submit">Request reference</button>
                    </form>`;
                  } else {
                    cell = `<span style="color:var(--muted)">—</span>`;
                  }
                  return `<tr>
                    <td>${escapeHtml(l.host_name)}</td>
                    <td>${escapeHtml(l.listing_title)}</td>
                    <td>${formatDate(l.end_date)}</td>
                    <td>${cell}</td>
                  </tr>`;
                })
                .join('')}
            </table>`
          : ''
      }
    </div>`;

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
    : `<p style="color:var(--muted)">No messages yet — ask a question or say hello.</p>`;

  let actions = '';
  if (isHost && application.status === 'submitted') {
    actions = `
      <form method="post" action="/applications/${application.id}/approve" style="display:inline-block; margin-right:8px;">
        <button class="btn btn-primary" type="submit">Approve application</button>
      </form>
      <form method="post" action="/applications/${application.id}/decline" style="display:inline-block;">
        <button class="btn" type="submit">Decline</button>
      </form>`;
  } else if (isApplicant && application.status === 'approved') {
    actions = `<a class="btn btn-primary" href="/listings/${listing.id}">Continue to book &amp; pay →</a>`;
  }

  const body = `
    <div class="hero">
      <span class="card-vertical">Rental application</span>
      <h1><a href="/listings/${listing.id}" style="color:inherit; text-decoration:none;">${escapeHtml(listing.title)}</a></h1>
      <p>Applicant: ${escapeHtml(applicant.name)} · Move-in ${formatDate(application.move_in_date)} · ${statusPill(application.status)}</p>
    </div>

    <div class="detail-grid">
      <div>
        <div class="dash-section">
          <h2>Screening details</h2>
          <table class="simple">
            <tr><th>Employment</th><td>${escapeHtml(application.employment || '—')}</td></tr>
            <tr><th>Previous landlord</th><td>${escapeHtml(application.previous_landlord_name || '—')}</td></tr>
            <tr><th>Landlord contact</th><td>${escapeHtml(application.previous_landlord_contact || '—')}</td></tr>
            <tr><th>Background-check consent</th><td>${application.consent_background_check ? 'Given' : 'Not given'}</td></tr>
            <tr><th>Message</th><td>${escapeHtml(application.message || '—')}</td></tr>
          </table>
          <p class="demo-note" style="margin-top:14px;">${isHost ? 'Call or email the previous landlord above to verify — this app doesn\'t run an automated check on your behalf.' : 'The host may contact your previous landlord to verify this application.'}</p>
          ${actions ? `<div style="margin-top:14px;">${actions}</div>` : ''}
        </div>

        ${verifiedSection}

        <div class="dash-section" id="messages">
          <h2>Messages</h2>
          <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">Between you and ${escapeHtml(isHost ? applicant.name : host.name)}, about this application. Only the two of you can see it.</p>
          <div class="thread">${threadRows}</div>
          <form method="post" action="/applications/${application.id}/messages" class="msg-form">
            <textarea name="body" rows="2" placeholder="Write a message…" required></textarea>
            <button class="btn btn-primary" type="submit">Send</button>
          </form>
        </div>
      </div>
      <div class="booking-box" style="position:static;">
        <div class="price-line"><span>Status</span><span>${statusPill(application.status)}</span></div>
        <div class="price-line"><span>Submitted</span><span>${formatDate(application.created_at)}</span></div>
        ${application.decided_at ? `<div class="price-line total"><span>Decided</span><span>${formatDate(application.decided_at)}</span></div>` : ''}
      </div>
    </div>
  `;
  return { title: `Application — ${listing.title}`, body };
}
