// lib/analytics.js — host-facing "views vs contacts" analytics: how many
// people looked at a listing, and how many of them actually reached out
// (inquiry, rental application, or booking). Queries the DB directly, same
// pattern as lib/availability.js, rather than being a pure function --
// server.js just calls straight into this.
import crypto from 'node:crypto';
import { all, get, run } from './db.js';

// Re-viewing the same listing within this window doesn't log a second row
// -- otherwise one visitor hitting refresh a dozen times would swamp the
// "views" number relative to "unique visitors" and make the comparison
// meaningless.
const VIEW_DEDUP_WINDOW = '-30 minutes';

// Records one listing-detail-page view, unless the same visitor (by
// account, or by anonymous cookie id for signed-out visitors) already
// viewed this listing within the last 30 minutes. Callers should not call
// this for the listing's own host -- see server.js's handleListing.
export function recordListingView(listingId, { viewerId, anonId }) {
  if (viewerId) {
    const recent = get(
      `SELECT id FROM listing_views WHERE listing_id = $listingId AND viewer_id = $viewerId AND created_at > datetime('now', $window) LIMIT 1`,
      { $listingId: listingId, $viewerId: viewerId, $window: VIEW_DEDUP_WINDOW }
    );
    if (recent) return;
  } else if (anonId) {
    const recent = get(
      `SELECT id FROM listing_views WHERE listing_id = $listingId AND anon_id = $anonId AND created_at > datetime('now', $window) LIMIT 1`,
      { $listingId: listingId, $anonId: anonId, $window: VIEW_DEDUP_WINDOW }
    );
    if (recent) return;
  } else {
    return; // no way to identify the visitor at all -- skip rather than risk double-counting later
  }

  run('INSERT INTO listing_views (id, listing_id, viewer_id, anon_id) VALUES ($id, $listingId, $viewerId, $anonId)', {
    $id: crypto.randomUUID(),
    $listingId: listingId,
    $viewerId: viewerId || null,
    $anonId: viewerId ? null : anonId,
  });
}

// The set of distinct guests who reached out about a listing at all --
// sent an inquiry, submitted a rental application, or made a booking --
// deduped, since the interesting number is "how many different people
// contacted you", not "how many contact events happened".
function contactingGuestIds(listing) {
  const fromInquiries = all('SELECT DISTINCT guest_id as id FROM listing_inquiries WHERE listing_id = $id', { $id: listing.id }).map((r) => r.id);
  const fromApplications =
    listing.vertical === 'lease'
      ? all('SELECT DISTINCT applicant_id as id FROM applications WHERE listing_id = $id', { $id: listing.id }).map((r) => r.id)
      : [];
  const fromBookings = all('SELECT DISTINCT guest_id as id FROM bookings WHERE listing_id = $id', { $id: listing.id }).map((r) => r.id);
  return new Set([...fromInquiries, ...fromApplications, ...fromBookings]);
}

// The full "views vs contacts" picture for one listing.
export function listingAnalytics(listing) {
  const totalViews = get('SELECT COUNT(*) as n FROM listing_views WHERE listing_id = $id', { $id: listing.id }).n;
  const uniqueViewers = get(
    'SELECT COUNT(DISTINCT COALESCE(viewer_id, anon_id)) as n FROM listing_views WHERE listing_id = $id',
    { $id: listing.id }
  ).n;
  const views30d = get(
    `SELECT COUNT(*) as n FROM listing_views WHERE listing_id = $id AND created_at > datetime('now', '-30 days')`,
    { $id: listing.id }
  ).n;

  const contacts = contactingGuestIds(listing).size;
  const inquiryCount = get('SELECT COUNT(*) as n FROM listing_inquiries WHERE listing_id = $id', { $id: listing.id }).n;
  const applicationCount =
    listing.vertical === 'lease' ? get('SELECT COUNT(*) as n FROM applications WHERE listing_id = $id', { $id: listing.id }).n : 0;
  const bookingCount = get('SELECT COUNT(*) as n FROM bookings WHERE listing_id = $id', { $id: listing.id }).n;

  const conversionRate = uniqueViewers > 0 ? (contacts / uniqueViewers) * 100 : null;

  return { totalViews, uniqueViewers, views30d, contacts, inquiryCount, applicationCount, bookingCount, conversionRate };
}

// The comparison a host sees across all of their own listings at once, on
// the dashboard -- which ones are getting looked at, and which of those
// looks are turning into an actual conversation.
export function analyticsForHostListings(listings) {
  return listings.map((listing) => ({ listing, stats: listingAnalytics(listing) }));
}
