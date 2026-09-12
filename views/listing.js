// views/listing.js — single listing detail + request-to-book form.
import { escapeHtml, peso, priceUnitLabel, verticalLabel, statusPill, verticalTileClass, verticalIcon } from '../lib/format.js';
import { PAYMENT_METHODS } from '../lib/payments.js';
import { renderCalendar } from './calendarWidget.js';

export function listingView({ listing, host, user, error, application, calendar, inquiry, insights, analytics }) {
  const amenities = JSON.parse(listing.amenities || '[]');
  const isLease = listing.vertical === 'lease';
  const needsApplication = isLease && (!application || application.status === 'declined');
  const applicationPending = isLease && application && application.status === 'submitted';
  const isOwner = user && user.id === listing.host_id;
  const mapsQuery = listing.address || `${listing.city}${listing.region ? ', ' + listing.region : ''}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const dateFields =
    listing.price_unit === 'night'
      ? `
        <label for="start_date">Check-in
          <input id="start_date" type="date" name="start_date" required>
        </label>
        <label for="end_date">Check-out
          <input id="end_date" type="date" name="end_date" required>
        </label>`
      : `
        <label for="start_date">Move-in / start date
          <input id="start_date" type="date" name="start_date" required>
        </label>`;

  const performanceSection = analytics
    ? `<div class="dash-section" id="performance">
        <h2>Listing performance</h2>
        <div class="stat-row">
          <div class="stat-tile"><div class="stat-num">${analytics.totalViews}</div><div class="stat-label">Total views</div></div>
          <div class="stat-tile"><div class="stat-num">${analytics.uniqueViewers}</div><div class="stat-label">Unique visitors</div></div>
          <div class="stat-tile"><div class="stat-num">${analytics.contacts}</div><div class="stat-label">Reached out</div></div>
          <div class="stat-tile"><div class="stat-num">${analytics.conversionRate === null ? '—' : analytics.conversionRate.toFixed(1) + '%'}</div><div class="stat-label">View → contact rate</div></div>
        </div>
        <p style="color:var(--muted); font-size:0.86rem; margin-top:14px;">
          ${analytics.views30d} view${analytics.views30d === 1 ? '' : 's'} in the last 30 days ·
          ${analytics.inquiryCount} inquir${analytics.inquiryCount === 1 ? 'y' : 'ies'}${
        listing.vertical === 'lease' ? `, ${analytics.applicationCount} application${analytics.applicationCount === 1 ? '' : 's'}` : ''
      }, ${analytics.bookingCount} booking${analytics.bookingCount === 1 ? '' : 's'}
        </p>
        ${
          analytics.totalViews === 0
            ? `<p class="demo-note" style="margin-top:10px;">No views logged yet — views count once your listing's been visited by someone other than you (your own visits while signed in don't count). Print a QR poster or share the link to start driving traffic here.</p>`
            : ''
        }
      </div>`
    : '';

  const boostSection = insights
    ? `<div class="dash-section" id="boost">
        <h2>Boost this listing</h2>
        <p style="color:var(--muted); font-size:0.9rem; margin-top:-8px;">${insights.checklist.done} of ${insights.checklist.total} done${insights.checklist.done === insights.checklist.total ? " — you've covered the basics." : ''}</p>
        <ul class="checklist">
          ${insights.checklist.items
            .map(
              (item) => `<li class="checklist-item ${item.done ? 'checklist-done' : ''}">
                <span class="checklist-icon">${item.done ? '✓' : '○'}</span>
                <span>
                  <strong>${escapeHtml(item.label)}</strong>
                  ${!item.done ? `<div class="checklist-tip">${escapeHtml(item.tip)}</div>` : ''}
                </span>
              </li>`
            )
            .join('')}
        </ul>
        ${
          insights.openInquiriesCount > 0 || insights.pendingApplicationsCount > 0 || insights.price
            ? `<div class="checklist-tips">
                ${insights.openInquiriesCount > 0 ? `<p>💬 <a href="/dashboard#inquiries">${insights.openInquiriesCount} inquir${insights.openInquiriesCount === 1 ? 'y is' : 'ies are'} waiting on your reply</a> — quick replies win more bookings.</p>` : ''}
                ${insights.pendingApplicationsCount > 0 ? `<p>📋 <a href="/dashboard#applications">${insights.pendingApplicationsCount} rental application${insights.pendingApplicationsCount === 1 ? '' : 's'} waiting on your decision</a>.</p>` : ''}
                ${
                  insights.price
                    ? `<p>💰 Your price is ${insights.price.diffPercent}% ${insights.price.direction} the average for ${verticalLabel(listing.vertical).toLowerCase()} listings in ${escapeHtml(listing.city)} (${peso(Math.round(insights.price.avg))}, based on ${insights.price.sampleSize} similar listing${insights.price.sampleSize === 1 ? '' : 's'}).</p>`
                    : ''
                }
              </div>`
            : ''
        }
      </div>`
    : '';

  const body = `
    <div class="listing-head">
      <div class="listing-photo ${verticalTileClass(listing.vertical)}">${verticalIcon(listing.vertical, 84)}</div>
      <div class="listing-main">
        <span class="card-vertical card-vertical-${listing.vertical}">${verticalLabel(listing.vertical)}</span>
        <h1>${escapeHtml(listing.title)}</h1>
        <div class="listing-loc">
          ${escapeHtml(listing.city)}${listing.region ? ', ' + escapeHtml(listing.region) : ''}${listing.size_label ? ' · ' + escapeHtml(listing.size_label) : ''}
          · <a href="${mapsUrl}" target="_blank" rel="noopener">View on Google Maps ↗</a>
        </div>
        <p>${escapeHtml(listing.description)}</p>
        <ul class="amenity-list">${amenities.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
        <p style="color:var(--muted); font-size:0.9rem;">Hosted by ${escapeHtml(host?.name || 'a Kanto host')}</p>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="dash-section">
          <h2>What's here</h2>
          <p style="color:var(--muted)">Capacity: ${listing.capacity ? listing.capacity + ' guests' : 'n/a'} · Listed ${escapeHtml(listing.city)}</p>
        </div>

        ${performanceSection}

        ${boostSection}

        ${
          calendar
            ? `<div class="dash-section">
                <h2>Availability</h2>
                ${renderCalendar({ year: calendar.year, month: calendar.month, monthsToShow: 2, statusMap: calendar.statusMap })}
              </div>`
            : ''
        }

        ${
          !isOwner
            ? `<div class="dash-section">
                <h2>Have a question?</h2>
                ${
                  user
                    ? inquiry
                      ? `<p style="color:var(--muted)">You've already messaged ${escapeHtml(host?.name || 'this host')} about this listing.</p>
                         <a class="btn" href="/inquiries/${inquiry.id}">View conversation</a>`
                      : `<p style="color:var(--muted); font-size:0.9rem;">Ask ${escapeHtml(host?.name || 'the host')} anything before you apply or book — no application needed.</p>
                         <a class="btn" href="/listings/${listing.id}/inquire">Message the host</a>`
                    : `<p style="color:var(--muted)"><a href="/login?next=/listings/${listing.id}/inquire">Log in</a> to message the host before you apply or book.</p>`
                }
              </div>`
            : ''
        }
      </div>

      <div class="booking-box">
        <div class="price-line total" style="border-bottom:1px solid var(--border); padding-bottom:10px;">
          <span>${peso(listing.price_amount)} <small style="font-weight:500;color:var(--muted)">${priceUnitLabel(listing.price_unit)}</small></span>
        </div>
        ${error ? `<div class="alert" style="margin-top:12px;">${escapeHtml(error)}</div>` : ''}
        ${
          user
            ? user.id === listing.host_id
              ? `<p style="margin-top:14px;">This is your own listing. ${listing.status !== 'active' ? statusPill(listing.status) + ' — hidden from search.' : ''}</p>
                 <a class="btn btn-block" href="/listings/${listing.id}/edit">Edit listing</a>
                 <a class="btn btn-block" style="margin-top:8px;" href="/listings/${listing.id}/availability">Manage availability</a>
                 <a class="btn btn-block" style="margin-top:8px;" href="/listings/${listing.id}/qr">Print QR poster</a>`
              : needsApplication
              ? `<a class="btn btn-primary btn-block" href="/listings/${listing.id}/apply">Apply to rent</a>
                 <p class="demo-note">${
                   application && application.status === 'declined'
                     ? 'Your previous application for this listing was declined. You can submit a new one with updated details.'
                     : "Long-term leases go through the host's screening first — including a reference from your previous landlord — before you can book and pay."
                 }</p>`
              : applicationPending
              ? `<p style="margin-top:14px;">Your rental application is submitted and waiting on the host's review.</p>
                 <a class="btn btn-block" href="/applications/${application.id}">View application</a>`
              : `${isLease ? `<p class="demo-note" style="margin-bottom:12px;">Your application was approved — you're clear to book and pay. <a href="/applications/${application.id}">View application</a></p>` : ''}
                <form method="post" action="/listings/${listing.id}/book">
                  ${dateFields}
                  <label style="display:block; margin-top:4px;">Pay with
                    <select name="method" required style="width:100%; padding:9px 10px; border:1px solid var(--border); border-radius:8px; font-family:var(--font-body); background:var(--bg); color:var(--ink); margin-top:4px;">
                      ${PAYMENT_METHODS.map((m) => `<option value="${m.value}">${m.label}</option>`).join('')}
                    </select>
                  </label>
                  <button class="btn btn-primary btn-block" type="submit">Pay &amp; request to book</button>
                </form>
                <p class="demo-note">Sandbox payment — no real money moves. It logs a charge, holds the funds in escrow against this booking, and the host still has to accept before anything's confirmed.</p>`
            : `<a class="btn btn-primary btn-block" href="/login?next=/listings/${listing.id}">Log in to request booking</a>
               <p class="demo-note">New here? <a href="/signup">Create an account</a> first.</p>`
        }
      </div>
    </div>
  `;

  return { title: listing.title, body };
}

export function bookingConfirmedView({ booking, listing, charge }) {
  const body = `
    <div class="auth-wrap" style="max-width:520px;">
      <h1>Paid &amp; request sent</h1>
      <p class="sub">Your payment for <strong>${escapeHtml(listing.title)}</strong> was charged and is held in escrow. The booking is <strong>pending</strong> until the host accepts.</p>
      <table class="simple">
        <tr><th>Charged via ${charge.method.toUpperCase()}</th><td>${peso(charge.amount)}</td></tr>
        <tr><th>Reference</th><td>${escapeHtml(charge.reference)}</td></tr>
        <tr><th>Platform commission (10%)</th><td>${peso(booking.commission_amount)}</td></tr>
        <tr><th>Host payout (on completion)</th><td>${peso(booking.payout_amount)}</td></tr>
        <tr><th>Billing</th><td>${booking.billing_type === 'recurring' ? 'Recurring (monthly)' : 'One-time'}</td></tr>
      </table>
      <a class="btn btn-primary btn-block" style="margin-top:16px;" href="/bookings/${booking.id}">View booking</a>
    </div>
  `;
  return { title: 'Booking requested', body };
}
