// views/dashboard.js — host/guest home base.
//
// Hosts get the original table-heavy dashboard (listings, performance,
// inquiries/applications/bookings received). Guests instead land on an
// iCloud-style launcher: a profile card plus a grid of colorful icon
// tiles, each linking out to its own dedicated page (myBookingsView /
// myApplicationsView / myInquiriesView below) rather than showing tables
// inline on this page.
import { escapeHtml, peso, verticalLabel, formatDate, statusPill, verticalTileClass, verticalIcon } from '../lib/format.js';
import { completenessChecklist } from '../lib/listingInsights.js';

// ---- small stroke-icon set for the guest launcher tiles ------------------
const ICON_SEARCH = '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m21 21-4.35-4.35"/>';
const ICON_BOOKINGS = '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="m8.5 14.5 2 2 4-4"/>';
const ICON_APPLICATIONS = '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>';
const ICON_INQUIRIES = '<path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1Z"/>';

function launcherIcon(pathData, size = 26) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>`;
}

function launcherTile({ href, colorClass, icon, label }) {
  return `
    <a class="launcher-tile" href="${href}">
      <span class="tile-icon ${colorClass}">${icon}</span>
      <span class="tile-label">${escapeHtml(label)}</span>
    </a>`;
}

function guestLauncherBody(user) {
  const initial = (user.name || '?').trim().charAt(0).toUpperCase();
  return `
    <div class="launcher">
      <div class="launcher-profile">
        <div class="avatar-circle">${escapeHtml(initial)}</div>
        <h2>${escapeHtml(user.name)}</h2>
        <p>${escapeHtml(user.email)}</p>
        <span class="plan-badge">Guest account</span>
      </div>
      <div class="launcher-grid">
        ${launcherTile({ href: '/', colorClass: 'tile-icon-blue', icon: launcherIcon(ICON_SEARCH), label: 'Browse' })}
        ${launcherTile({ href: '/my-bookings', colorClass: 'tile-icon-teal', icon: launcherIcon(ICON_BOOKINGS), label: 'My Bookings' })}
        ${launcherTile({ href: '/my-applications', colorClass: 'tile-icon-purple', icon: launcherIcon(ICON_APPLICATIONS), label: 'Applications' })}
        ${launcherTile({ href: '/my-inquiries', colorClass: 'tile-icon-orange', icon: launcherIcon(ICON_INQUIRIES), label: 'Inquiries' })}
      </div>
    </div>
  `;
}

// ---- guest-only dedicated list pages (linked from the launcher tiles) ----

export function myBookingsView({ user, bookings = [] }) {
  const body = `
    <div class="hero"><h1>My bookings</h1><p><a href="/dashboard">&larr; Dashboard</a></p></div>
    ${
      bookings.length
        ? `<table class="simple">
            <tr><th>Listing</th><th>Host</th><th>Start</th><th>Total</th><th>Status</th><th>Payment</th></tr>
            ${bookings
              .map(
                (b) => `<tr>
                  <td><a href="/bookings/${b.id}">${escapeHtml(b.listing_title)}</a></td>
                  <td>${escapeHtml(b.host_name)}</td>
                  <td>${formatDate(b.start_date)}</td>
                  <td>${peso(b.total_amount)}</td>
                  <td>${statusPill(b.status)}</td>
                  <td>${statusPill(b.payment_status)}</td>
                </tr>`
              )
              .join('')}
          </table>`
        : `<p style="color:var(--muted)">No bookings yet. <a href="/">Browse listings</a> and request to book to see this fill in.</p>`
    }
  `;
  return { title: 'My bookings', body, activeNav: 'dashboard' };
}

export function myApplicationsView({ user, applications = [] }) {
  const body = `
    <div class="hero"><h1>My rental applications</h1><p><a href="/dashboard">&larr; Dashboard</a></p></div>
    ${
      applications.length
        ? `<table class="simple">
            <tr><th>Listing</th><th>Host</th><th>Move-in</th><th>Status</th><th></th></tr>
            ${applications
              .map(
                (a) => `<tr>
                  <td>${escapeHtml(a.listing_title)}</td>
                  <td>${escapeHtml(a.host_name)}</td>
                  <td>${formatDate(a.move_in_date)}</td>
                  <td>${statusPill(a.status)}</td>
                  <td><a href="/applications/${a.id}">View</a></td>
                </tr>`
              )
              .join('')}
          </table>`
        : `<p style="color:var(--muted)">No applications yet — applying to a long-term lease listing starts one.</p>`
    }
  `;
  return { title: 'My applications', body, activeNav: 'dashboard' };
}

export function myInquiriesView({ user, inquiries = [] }) {
  const body = `
    <div class="hero"><h1>My inquiries</h1><p><a href="/dashboard">&larr; Dashboard</a></p></div>
    ${
      inquiries.length
        ? `<table class="simple">
            <tr><th>Listing</th><th>Host</th><th>Started</th><th></th></tr>
            ${inquiries
              .map(
                (i) => `<tr>
                  <td>${escapeHtml(i.listing_title)}</td>
                  <td>${escapeHtml(i.host_name)}</td>
                  <td>${formatDate(i.created_at)}</td>
                  <td><a href="/inquiries/${i.id}">View</a></td>
                </tr>`
              )
              .join('')}
          </table>`
        : `<p style="color:var(--muted)">No inquiries yet — message a host from a listing page to ask a question before applying or booking.</p>`
    }
  `;
  return { title: 'My inquiries', body, activeNav: 'dashboard' };
}

// ---- main dashboard entry point -------------------------------------

export function dashboardView({ user, listings = [], bookings = [], applications = [], inquiries = [], performance = [] }) {
  const isHost = user.role === 'host';

  if (!isHost) {
    return { title: 'Dashboard', body: guestLauncherBody(user), activeNav: 'dashboard' };
  }

  const listingsTable = `
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
                    <td><a href="/listings/${l.id}" class="row-title-link"><span class="row-icon ${verticalTileClass(l.vertical)}">${verticalIcon(l.vertical, 18)}</span>${escapeHtml(l.title)}</a></td>
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
    </div>`;

  const bookingsTable = `
    <div class="dash-section">
      <h2>Booking requests on my listings</h2>
      ${
        bookings.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>Guest</th><th>Start</th><th>Total</th><th>Status</th><th>Payment</th></tr>
              ${bookings
                .map(
                  (b) => `<tr>
                    <td><a href="/bookings/${b.id}">${escapeHtml(b.listing_title)}</a></td>
                    <td>${escapeHtml(b.guest_name)}</td>
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
      <h2>Rental applications on my listings</h2>
      ${
        applications.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>Applicant</th><th>Move-in</th><th>Status</th><th></th></tr>
              ${applications
                .map(
                  (a) => `<tr>
                    <td>${escapeHtml(a.listing_title)}</td>
                    <td>${escapeHtml(a.applicant_name)}</td>
                    <td>${formatDate(a.move_in_date)}</td>
                    <td>${statusPill(a.status)}</td>
                    <td><a href="/applications/${a.id}">${a.status === 'submitted' ? 'Review' : 'View'}</a></td>
                  </tr>`
                )
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">No rental applications yet — these show up when a guest applies to a lease listing.</p>`
      }
    </div>`;

  const performanceTable = performance.length
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
      <h2>Inquiries about my listings</h2>
      ${
        inquiries.length
          ? `<table class="simple">
              <tr><th>Listing</th><th>Guest</th><th>Started</th><th></th></tr>
              ${inquiries
                .map(
                  (i) => `<tr>
                    <td>${escapeHtml(i.listing_title)}</td>
                    <td>${escapeHtml(i.guest_name)}</td>
                    <td>${formatDate(i.created_at)}</td>
                    <td><a href="/inquiries/${i.id}">View</a></td>
                  </tr>`
                )
                .join('')}
            </table>`
          : `<p style="color:var(--muted)">No inquiries yet — these show up when a guest messages you about a listing, before applying or booking.</p>`
      }
    </div>`;

  const body = `
    <div class="hero">
      <h1>Host dashboard</h1>
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
