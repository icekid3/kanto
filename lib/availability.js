// lib/availability.js — booking-conflict checks and calendar day-status,
// on top of the plain date math in lib/calendar.js.
//
// Date-range convention used everywhere here (bookings, blocks, and this
// module's own helpers): [start, end) — end is the day you're free again,
// same meaning as a hotel checkout date. A null/missing end means "open
// ended", i.e. occupied or blocked indefinitely until someone ends it.
import { all } from './db.js';
import { addDays } from './calendar.js';

const OPEN_ENDED = '9999-12-31'; // sentinel far-future date for "no end yet"

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  const aE = aEnd || OPEN_ENDED;
  const bE = bEnd || OPEN_ENDED;
  return aStart < bE && bStart < aE;
}

export function blocksForListing(listingId) {
  return all('SELECT * FROM availability_blocks WHERE listing_id = $id ORDER BY start_date ASC', { $id: listingId });
}

function activeBookingRanges(listingId) {
  return all(
    `SELECT id, start_date, end_date FROM bookings WHERE listing_id = $id AND status IN ('pending','confirmed')`,
    { $id: listingId }
  );
}

// For a 'stay' (nightly) listing: does [start, end) overlap any active
// booking or manual block?
export function stayConflict(listingId, start, end) {
  const bookings = activeBookingRanges(listingId);
  for (const b of bookings) {
    if (rangesOverlap(start, end, b.start_date, b.end_date)) return { reason: 'Those dates overlap an existing booking.' };
  }
  const blocks = blocksForListing(listingId);
  for (const b of blocks) {
    if (rangesOverlap(start, end, b.start_date, b.end_date)) return { reason: 'Those dates are blocked by the host.' };
  }
  return null;
}

// For a 'lease'/'storage' listing (single-occupancy, open-ended term):
// is it already occupied by an active booking, or blocked on the start date?
export function occupancyConflict(listingId, start) {
  const bookings = activeBookingRanges(listingId);
  if (bookings.length) return { reason: 'This listing already has an active booking and can only be rented to one tenant at a time.' };
  const blocks = blocksForListing(listingId);
  for (const b of blocks) {
    if (rangesOverlap(start, addDays(start, 1), b.start_date, b.end_date)) return { reason: 'The host has marked this listing unavailable for that date.' };
  }
  return null;
}

// Per-day status map across [start, end) for calendar rendering.
// Status: 'booked' | 'blocked' | 'available' (booked takes visual priority).
export function dayStatusMap(listing, startIso, endIso) {
  const bookings = activeBookingRanges(listing.id);
  const blocks = blocksForListing(listing.id);
  const map = {};
  let cur = startIso;
  while (cur < endIso) {
    let status = 'available';
    if (bookings.some((b) => cur >= b.start_date && cur < (b.end_date || OPEN_ENDED))) status = 'booked';
    else if (blocks.some((b) => cur >= b.start_date && cur < (b.end_date || OPEN_ENDED))) status = 'blocked';
    map[cur] = status;
    cur = addDays(cur, 1);
  }
  return map;
}
