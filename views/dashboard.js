// views/dashboard.js — host/guest home base.
import { escapeHtml, peso, verticalLabel, formatDate, statusPill } from '../lib/format.js';
import { completenessChecklist } from '../lib/listingInsights.js';

export function dashboardView({ user, listings = [], bookings = [], applications = [], inquiries = [], performance = [] }) {
  const isHost = user.role === 'host';

  const listingsTable = isHost
    ? `
    <div class="dash-section">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px;">
        <h2 style="margin:0;">My listings</h2>
        <a class="btn btn-primary" href="/listings/new">+ New listing</a>
      </div>
      ${
        listings.length
          ? `<table class="simple">
              <tr><th>Title</th><th>Vertical</th><th>City</th><th>Price</th><th>Status</th><th>Boost</th><th></th><th></th></tr>
              ${listings
                .map((l) => {
                  const { done, total } = completenessChecklist(l);
                  const complete = done === total;
                  return `<tr>
                    <td><a href="/listings/${l.id}">${escapeHtml(l.title)}</a></td>
                    <td>${verticalLabel(l.vertical)}</td>
                    <td>${escapeHtml(l.city)}</td>
                    <td>${peso(l.price_amount)}</td>
                    <td>${statusPill(l.status)}</td>
                    <td><a href="/listings/${l.id}#boost" style="${complete ? 'color:var(--muted);' : 'font-weight:600;'}">${done}/${total}${complete ? ' ✓' : ''}</a></td>
                    <td><a href="/listings/${l.id}/edit">Edit</a></td>
                    <td><a href="/listings/${l.id}/availability">Availability</a></td>
                  </tr>`;
                })
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">No listings yet. <a href="/listings/new">Create your first one</a>.</p>`
      }
    </div>`
    : '';

  const bookingsTable = `
    <div class="dash-section">
      <h2>${isHost ? 'Booking requests on my listings' : 'My bookings'}</h2>
      ${
        bookings.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>${isHost ? 'Guest' : 'Host'}</th><th>Start</th><th>Total</th><th>Status</th><th>Payment</th></tr>
              ${bookings
                .map(
                  (b) => `<tr>
                    <td><a href="/bookings/${b.id}">${escapeHtml(b.listing_title)}</a></td>
                    <td>${escapeHtml(isHost ? b.guest_name : b.host_name)}</td>
                    <td>${formatDate(b.start_date)}</td>
                    <td>${peso(b.total_amount)}</td>
                    <td>${statusPill(b.status)}</td>
                    <td>${statusPill(b.payment_status)}</td>
                  </tr>`
                )
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">No bookings yet. Browse listings and request to book to see this fill in.</p>`
      }
    </div>`;

  const applicationsTable = `
    <div class="dash-section" id="applications">
      <h2>${isHost ? 'Rental applications on my listings' : 'My rental applications'}</h2>
      ${
        applications.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>${isHost ? 'Applicant' : 'Host'}</th><th>Move-in</th><th>Status</th><th></th></tr>
              ${applications
                .map(
                  (a) => `<tr>
                    <td>${escapeHtml(a.listing_title)}</td>
                    <td>${escapeHtml(isHost ? a.applicant_name : a.host_name)}</td>
                    <td>${formatDate(a.move_in_date)}</td>
                    <td>${statusPill(a.status)}</td>
                    <td><a href="/applications/${a.id}">${isHost && a.status === 'submitted' ? 'Review' : 'View'}</a></td>
                  </tr>`
                )
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">${isHost ? 'No rental applications yet — these show up when a guest applies to a lease listing.' : 'No applications yet — applying to a long-term lease listing starts one.'}</p>`
      }
    </div>`;

  const performanceTable =
    isHost && performance.length
      ? `
    <div class="dash-section" id="performance">
      <h2>Listing performance</h2>
      <p style="color:var(--muted); font-size:0.86rem; margin-top:-8px;">How much interest each listing is getting, and how much of that turns into an actual conversation.</p>
      <table class="simple">
        <tr><th>Title</th><th>Views</th><th>Unique visitors</th><th>Reached out</th><th>View → contact</th></tr>
        ${[...performance]
          .sort((a, b) => b.stats.totalViews - a.stats.totalViews)
          .map(
            ({ listing: l, stats }) => `<tr>
              <td><a href="/listings/${l.id}#performance">${escapeHtml(l.title)}</a></td>
              <td>${stats.totalViews}</td>
              <td>${stats.uniqueViewers}</td>
              <td>${stats.contacts}</td>
              <td>${stats.conversionRate === null ? '—' : stats.conversionRate.toFixed(1) + '%'}</td>
            </tr>`
          )
          .join('')}
      </table>
    </div>`
      : '';

  const inquiriesTable = `
    <div class="dash-section" id="inquiries">
      <h2>${isHost ? 'Inquiries about my listings' : 'My inquiries'}</h2>
      ${
        inquiries.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>${isHost ? 'Guest' : 'Host'}</th><th>Started</th><th></th></tr>
              ${inquiries
                .map(
                  (i) => `<tr>
                    <td>${escapeHtml(i.listing_title)}</td>
                    <td>${escapeHtml(isHost ? i.guest_name : i.host_name)}</td>
                    <td>${formatDate(i.created_at)}</td>
                    <td><a href="/inquiries/${i.id}">View</a></td>
                  </tr>`
                )
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">${isHost ? 'No inquiries yet — these show up when a guest messages you about a listing, before applying or booking.' : 'No inquiries yet — message a host from a listing page to ask a question before applying or booking.'}</p>`
      }
    </div>`;

  const body = `
    <div class="hero">
      <h1>${isHost ? 'Host dashboard' : 'My bookings'}</h1>
      <p>Signed in as ${escapeHtml(user.name)} (${user.role}).</p>
    </div>
    ${listingsTable}
    ${performanceTable}
    ${inquiriesTable}
    ${applicationsTable}
    ${bookingsTable}
  `;

  return { title: 'Dashboard', body, activeNav: 'dashboard' };
}
