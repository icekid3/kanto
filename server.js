// server.js — app server.
// Deliberately dependency-free (built-in http + node:sqlite only) so it
// runs anywhere Node runs, with no npm install step. See PHASE-NOTES.md.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { get, all, run } from './lib/db.js';
import { seedIfEmpty } from './lib/seed.js';
import { createUser, authenticate, createSession, destroySession, userFromSession, parseCookies } from './lib/auth.js';
import { charge as chargePayment, refund as refundPayment, payout as payoutPayment, ledgerForBooking, PAYMENT_METHODS } from './lib/payments.js';
import { layout } from './views/layout.js';
import { homeView } from './views/home.js';
import { listingView, bookingConfirmedView } from './views/listing.js';
import { listingFormView } from './views/listingForm.js';
import { loginView, signupView } from './views/auth.js';
import { termsView } from './views/terms.js';
import { privacyView } from './views/privacy.js';
import { dashboardView, myBookingsView, myApplicationsView, myInquiriesView } from './views/dashboard.js';
import { bookingDetailView } from './views/booking.js';
import { applicationFormView, applicationDetailView } from './views/application.js';
import { referenceDetailView } from './views/reference.js';
import { inquiryFormView, inquiryDetailView } from './views/inquiry.js';
import { qrMatrixToSvg, qrPosterView } from './views/qr.js';
import { availabilityView } from './views/availability.js';
import { stayConflict, occupancyConflict, dayStatusMap, blocksForListing } from './lib/availability.js';
import { todayISO, shiftMonth } from './lib/calendar.js';
import { encodeQR } from './lib/qrcode.js';
import { completenessChecklist, priceTip } from './lib/listingInsights.js';
import { recordListingView, listingAnalytics, analyticsForHostListings } from './lib/analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const COMMISSION_RATE = 0.10;

// ---- tiny helpers -----------------------------------------------------

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function redirect(res, location, cookie) {
  const headers = { Location: location };
  if (cookie) headers['Set-Cookie'] = cookie;
  res.writeHead(302, headers);
  res.end();
}

function render(res, currentUser, page, status = 200) {
  send(res, status, layout({ title: page.title, user: currentUser, body: page.body, activeNav: page.activeNav }));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) {
    try { return JSON.parse(raw || '{}'); } catch { return {}; }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

function currentUser(req) {
  const cookies = parseCookies(req);
  return userFromSession(cookies.session);
}

function sessionCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

// A long-lived, anonymous id for signed-out visitors, used only to dedupe
// repeat listing views for the host-facing analytics (lib/analytics.js) --
// never tied to a name, email, or anything identifying.
function visitorCookie(id) {
  return `vid=${id}; HttpOnly; Path=/; Max-Age=${365 * 24 * 60 * 60}; SameSite=Lax`;
}

// Absolute URL for a listing, derived from the incoming request's own Host
// header -- so the QR code / poster links correctly whether this is running
// on localhost during testing or on a real domain later, with no config.
function listingUrl(req, id) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers.host}/listings/${id}`;
}

const CONTENT_TYPES = { '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml' };

function serveStatic(req, res, pathname) {
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

// ---- data access used by routes ---------------------------------------

function fetchListings({ vertical, city, sort }) {
  let sql = `SELECT * FROM listings WHERE status = 'active'`;
  const params = {};
  if (vertical) {
    sql += ' AND vertical = $vertical';
    params.$vertical = vertical;
  }
  if (city) {
    sql += ' AND city LIKE $city';
    params.$city = `%${city}%`;
  }
  sql += sort === 'price_asc' ? ' ORDER BY price_amount ASC' : sort === 'price_desc' ? ' ORDER BY price_amount DESC' : ' ORDER BY created_at DESC';
  return all(sql, params);
}

// Host-only "boost this listing" suggestions -- a completeness checklist,
// a price comparison against similar active listings, and counts of
// threads waiting on the host's reply. Only computed for the listing's
// own owner (see handleListing), so the extra queries here don't run on
// every page view.
function listingInsightsFor(listing) {
  const checklist = completenessChecklist(listing);

  const comparableListings = all(
    `SELECT id, price_amount FROM listings WHERE vertical = $vertical AND city = $city AND status = 'active'`,
    { $vertical: listing.vertical, $city: listing.city }
  );
  const price = priceTip(listing, comparableListings);

  const openInquiries = get(
    `SELECT COUNT(*) as n FROM listing_inquiries i
     WHERE i.listing_id = $listingId
       AND (SELECT m.sender_id FROM inquiry_messages m WHERE m.inquiry_id = i.id ORDER BY m.created_at DESC LIMIT 1) != $hostId`,
    { $listingId: listing.id, $hostId: listing.host_id }
  );

  const pendingApplications =
    listing.vertical === 'lease'
      ? get(`SELECT COUNT(*) as n FROM applications WHERE listing_id = $listingId AND status = 'submitted'`, { $listingId: listing.id })
      : { n: 0 };

  return { checklist, price, openInquiriesCount: openInquiries.n, pendingApplicationsCount: pendingApplications.n };
}

function fetchBookingsForUser(user) {
  if (user.role === 'host') {
    return all(
      `SELECT b.*, l.title as listing_title, u.name as guest_name
       FROM bookings b
       JOIN listings l ON l.id = b.listing_id
       JOIN users u ON u.id = b.guest_id
       WHERE l.host_id = $hostId
       ORDER BY b.created_at DESC`,
      { $hostId: user.id }
    );
  }
  return all(
    `SELECT b.*, l.title as listing_title, h.name as host_name
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN users h ON h.id = l.host_id
     WHERE b.guest_id = $guestId
     ORDER BY b.created_at DESC`,
    { $guestId: user.id }
  );
}

// ---- route handlers -----------------------------------------------------

async function handleHome(req, res, url, user) {
  const query = Object.fromEntries(url.searchParams);
  const listings = fetchListings(query);
  render(res, user, homeView({ listings, query, user }));
}

function latestApplicationFor(listingId, applicantId) {
  return get(
    `SELECT * FROM applications WHERE listing_id = $listingId AND applicant_id = $applicantId ORDER BY created_at DESC LIMIT 1`,
    { $listingId: listingId, $applicantId: applicantId }
  );
}

function latestInquiryFor(listingId, guestId) {
  return get(
    `SELECT * FROM listing_inquiries WHERE listing_id = $listingId AND guest_id = $guestId ORDER BY created_at DESC LIMIT 1`,
    { $listingId: listingId, $guestId: guestId }
  );
}

function calendarWindow(listing, monthsToShow) {
  const today = new Date();
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const endOfWindow = shiftMonth(year, month, monthsToShow);
  const endIso = `${endOfWindow.year}-${String(endOfWindow.month + 1).padStart(2, '0')}-01`;
  const statusMap = dayStatusMap(listing, todayISO(), endIso);
  return { year, month, statusMap };
}

async function handleListing(req, res, id, user, error) {
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: id });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.status !== 'active' && (!user || user.id !== listing.host_id)) return send(res, 404, 'Listing not found');
  const host = get('SELECT * FROM users WHERE id = $id', { $id: listing.host_id });
  const isOwner = user && user.id === listing.host_id;
  const application = user && listing.vertical === 'lease' && !isOwner ? latestApplicationFor(id, user.id) : null;
  const inquiry = user && !isOwner ? latestInquiryFor(id, user.id) : null;
  const insights = isOwner ? listingInsightsFor(listing) : null;

  if (!isOwner) {
    let anonId = null;
    if (!user) {
      const cookies = parseCookies(req);
      anonId = cookies.vid || crypto.randomUUID();
      if (!cookies.vid) res.setHeader('Set-Cookie', visitorCookie(anonId));
    }
    recordListingView(id, { viewerId: user?.id || null, anonId });
  }
  const analytics = isOwner ? listingAnalytics(listing) : null;

  const calendar = calendarWindow(listing, 2);
  render(res, user, listingView({ listing, host, user, error, application, calendar, inquiry, insights, analytics }));
}

const VERTICALS = ['stay', 'lease', 'storage'];
const PRICE_UNITS = ['night', 'month', 'term'];
const LISTING_STATUSES = ['active', 'draft', 'inactive'];

function parseListingForm(body) {
  const errors = [];
  if (!body.title || !body.title.trim()) errors.push('Title is required.');
  if (!body.description || !body.description.trim()) errors.push('Description is required.');
  if (!body.city || !body.city.trim()) errors.push('City is required.');
  if (!VERTICALS.includes(body.vertical)) errors.push('Pick a valid vertical.');
  if (!PRICE_UNITS.includes(body.price_unit)) errors.push('Pick a valid billing period.');
  if (!LISTING_STATUSES.includes(body.status)) errors.push('Pick a valid status.');

  const pesos = parseFloat(body.price_amount);
  if (!pesos || pesos <= 0) errors.push('Price must be a positive number.');

  const capacity = body.capacity ? parseInt(body.capacity, 10) : null;
  if (body.capacity && (!Number.isInteger(capacity) || capacity <= 0)) errors.push('Capacity must be a positive whole number.');

  const amenities = (body.amenities || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  if (errors.length) return { error: errors[0] };

  return {
    data: {
      $vertical: body.vertical,
      $title: body.title.trim(),
      $description: body.description.trim(),
      $city: body.city.trim(),
      $region: body.region?.trim() || null,
      $address: body.address?.trim() || null,
      $price: Math.round(pesos * 100),
      $unit: body.price_unit,
      $capacity: capacity,
      $size: body.size_label?.trim() || null,
      $amenities: JSON.stringify(amenities),
      $emoji: body.photo_emoji?.trim() || null,
      $status: body.status,
    },
  };
}

async function handleListingNewGet(req, res, user) {
  if (!user) return redirect(res, '/login?next=/listings/new');
  if (user.role !== 'host') return send(res, 403, 'Only hosts can create listings.');
  render(res, user, listingFormView({ mode: 'new' }));
}

async function handleListingNewPost(req, res, user) {
  if (!user) return redirect(res, '/login?next=/listings/new');
  if (user.role !== 'host') return send(res, 403, 'Only hosts can create listings.');
  const body = await readBody(req);
  const { data, error } = parseListingForm(body);
  if (error) return render(res, user, listingFormView({ mode: 'new', listing: { ...body, amenities: body.amenities?.split(',').map((a) => a.trim()).filter(Boolean) || [] }, error }), 400);

  const id = crypto.randomUUID();
  run(
    `INSERT INTO listings (id, host_id, vertical, title, description, city, region, address, price_amount, price_unit, currency, capacity, size_label, amenities, photo_emoji, status)
     VALUES ($id, $hostId, $vertical, $title, $description, $city, $region, $address, $price, $unit, 'PHP', $capacity, $size, $amenities, $emoji, $status)`,
    { $id: id, $hostId: user.id, ...data }
  );
  redirect(res, `/listings/${id}`);
}

async function handleListingEditGet(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/listings/${id}/edit`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: id });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can edit this listing.');
  render(res, user, listingFormView({ mode: 'edit', listing }));
}

async function handleListingEditPost(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/listings/${id}/edit`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: id });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can edit this listing.');

  const body = await readBody(req);
  const { data, error } = parseListingForm(body);
  if (error) {
    return render(
      res,
      user,
      listingFormView({ mode: 'edit', listing: { ...listing, ...body, id, amenities: body.amenities?.split(',').map((a) => a.trim()).filter(Boolean) || [] }, error }),
      400
    );
  }

  run(
    `UPDATE listings SET vertical=$vertical, title=$title, description=$description, city=$city, region=$region, address=$address,
       price_amount=$price, price_unit=$unit, capacity=$capacity, size_label=$size, amenities=$amenities,
       photo_emoji=$emoji, status=$status WHERE id = $id`,
    { $id: id, ...data }
  );
  redirect(res, `/listings/${id}`);
}

async function handleBook(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/listings/${id}`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: id });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.status !== 'active') return send(res, 400, 'This listing is not currently accepting bookings.');

  if (listing.vertical === 'lease') {
    const application = latestApplicationFor(id, user.id);
    if (!application || application.status !== 'approved') {
      return handleListing(req, res, id, user, 'You need an approved rental application before you can book this listing.');
    }
  }

  const body = await readBody(req);
  const start = body.start_date;
  const end = body.end_date;
  const method = body.method;

  if (!PAYMENT_METHODS.some((m) => m.value === method)) {
    return handleListing(req, res, id, user, 'Pick a payment method.');
  }

  let totalAmount = listing.price_amount;
  let billingType = 'one_time';

  if (listing.price_unit === 'night') {
    if (!start || !end) return handleListing(req, res, id, user, 'Pick a check-in and check-out date.');
    const nights = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
    if (nights < 1) return handleListing(req, res, id, user, 'Check-out must be after check-in.');
    totalAmount = listing.price_amount * nights;
    const conflict = stayConflict(id, start, end);
    if (conflict) return handleListing(req, res, id, user, conflict.reason);
  } else if (listing.price_unit === 'month') {
    if (!start) return handleListing(req, res, id, user, 'Pick a start date.');
    billingType = 'recurring';
    const conflict = occupancyConflict(id, start);
    if (conflict) return handleListing(req, res, id, user, conflict.reason);
  } else {
    if (!start) return handleListing(req, res, id, user, 'Pick a start date.');
    const conflict = occupancyConflict(id, start);
    if (conflict) return handleListing(req, res, id, user, conflict.reason);
  }

  const commission = Math.round(totalAmount * COMMISSION_RATE);
  const payoutAmount = totalAmount - commission;
  const bookingId = crypto.randomUUID();

  run(
    `INSERT INTO bookings (id, listing_id, guest_id, start_date, end_date, status, billing_type, total_amount, commission_amount, payout_amount, payment_status)
     VALUES ($id, $listingId, $guestId, $start, $end, 'pending', $billingType, $total, $commission, $payout, 'unpaid')`,
    {
      $id: bookingId,
      $listingId: id,
      $guestId: user.id,
      $start: start,
      $end: end || null,
      $billingType: billingType,
      $total: totalAmount,
      $commission: commission,
      $payout: payoutAmount,
    }
  );

  // Charge now, hold in escrow — the booking only becomes 'confirmed' once
  // the host accepts (see handleBookingAccept).
  const paymentRecord = chargePayment({ bookingId, method, amount: totalAmount });
  run('UPDATE bookings SET payment_status = $status WHERE id = $id', { $status: 'held', $id: bookingId });

  const booking = get('SELECT * FROM bookings WHERE id = $id', { $id: bookingId });
  render(res, user, bookingConfirmedView({ booking, listing, charge: paymentRecord }));
}

function fetchBookingFull(id) {
  const booking = get('SELECT * FROM bookings WHERE id = $id', { $id: id });
  if (!booking) return null;
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: booking.listing_id });
  const guest = get('SELECT * FROM users WHERE id = $id', { $id: booking.guest_id });
  const host = get('SELECT * FROM users WHERE id = $id', { $id: listing.host_id });
  return { booking, listing, guest, host };
}

function fetchMessagesForBooking(bookingId) {
  return all(
    `SELECT m.*, u.name as sender_name FROM messages m JOIN users u ON u.id = m.sender_id
     WHERE m.booking_id = $bookingId ORDER BY m.created_at ASC`,
    { $bookingId: bookingId }
  );
}

async function handleBookingDetail(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/bookings/${id}`);
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking, listing, guest, host } = full;
  if (user.id !== booking.guest_id && user.id !== listing.host_id) return send(res, 403, 'Not your booking.');
  const ledger = ledgerForBooking(id);
  const messages = fetchMessagesForBooking(id);
  render(res, user, bookingDetailView({ booking, listing, guest, host, ledger, messages, viewerId: user.id }));
}

async function handleBookingMessagePost(req, res, id, user) {
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking, listing } = full;
  if (!user || (user.id !== booking.guest_id && user.id !== listing.host_id)) return send(res, 403, 'Not your booking.');
  const body = await readBody(req);
  const text = (body.body || '').trim();
  if (text) {
    run('INSERT INTO messages (id, booking_id, sender_id, body) VALUES ($id, $bookingId, $senderId, $body)', {
      $id: crypto.randomUUID(),
      $bookingId: id,
      $senderId: user.id,
      $body: text.slice(0, 2000),
    });
  }
  redirect(res, `/bookings/${id}#messages`);
}

async function handleBookingAccept(req, res, id, user) {
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking, listing } = full;
  if (!user || user.id !== listing.host_id) return send(res, 403, 'Only the host can accept this booking.');
  if (booking.status !== 'pending') return redirect(res, `/bookings/${id}`);
  run("UPDATE bookings SET status = 'confirmed' WHERE id = $id", { $id: id });
  redirect(res, `/bookings/${id}`);
}

async function handleBookingDecline(req, res, id, user) {
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking, listing } = full;
  if (!user || user.id !== listing.host_id) return send(res, 403, 'Only the host can decline this booking.');
  if (booking.status !== 'pending') return redirect(res, `/bookings/${id}`);
  refundPayment({ bookingId: id, method: 'platform', amount: booking.total_amount });
  run("UPDATE bookings SET status = 'declined', payment_status = 'refunded' WHERE id = $id", { $id: id });
  redirect(res, `/bookings/${id}`);
}

async function handleBookingCancel(req, res, id, user) {
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking } = full;
  if (!user || user.id !== booking.guest_id) return send(res, 403, 'Only the guest can cancel this booking.');
  if (!['pending', 'confirmed'].includes(booking.status)) return redirect(res, `/bookings/${id}`);
  refundPayment({ bookingId: id, method: 'platform', amount: booking.total_amount });
  run("UPDATE bookings SET status = 'cancelled', payment_status = 'refunded' WHERE id = $id", { $id: id });
  redirect(res, `/bookings/${id}`);
}

async function handleBookingComplete(req, res, id, user) {
  const full = fetchBookingFull(id);
  if (!full) return send(res, 404, 'Booking not found');
  const { booking, listing } = full;
  if (!user || user.id !== listing.host_id) return send(res, 403, 'Only the host can mark this booking completed.');
  if (booking.status !== 'confirmed') return redirect(res, `/bookings/${id}`);
  payoutPayment({ bookingId: id, amount: booking.payout_amount });
  run("UPDATE bookings SET status = 'completed', payment_status = 'paid_out' WHERE id = $id", { $id: id });
  redirect(res, `/bookings/${id}`);
}

// ---- rental applications (tenant screening) ----------------------------

function fetchApplicationFull(id) {
  const application = get('SELECT * FROM applications WHERE id = $id', { $id: id });
  if (!application) return null;
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: application.listing_id });
  const applicant = get('SELECT * FROM users WHERE id = $id', { $id: application.applicant_id });
  const host = get('SELECT * FROM users WHERE id = $id', { $id: listing.host_id });
  return { application, listing, applicant, host };
}

async function handleApplyGet(req, res, listingId, user, error) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/apply`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.vertical !== 'lease') return redirect(res, `/listings/${listingId}`);
  if (user.id === listing.host_id) return send(res, 403, "You can't apply to your own listing.");
  const existing = latestApplicationFor(listingId, user.id);
  if (existing && existing.status !== 'declined') return redirect(res, `/applications/${existing.id}`);
  render(res, user, applicationFormView({ listing, error }));
}

async function handleApplyPost(req, res, listingId, user) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/apply`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.vertical !== 'lease') return redirect(res, `/listings/${listingId}`);
  if (user.id === listing.host_id) return send(res, 403, "You can't apply to your own listing.");

  const existing = latestApplicationFor(listingId, user.id);
  if (existing && existing.status !== 'declined') return redirect(res, `/applications/${existing.id}`);

  const body = await readBody(req);
  const errors = [];
  if (!body.move_in_date) errors.push('Move-in date is required.');
  if (!body.previous_landlord_name || !body.previous_landlord_name.trim()) errors.push("Previous landlord's name is required.");
  if (!body.previous_landlord_contact || !body.previous_landlord_contact.trim()) errors.push("Previous landlord's contact is required.");
  if (body.consent_background_check !== 'yes') errors.push('You need to give consent for the host to follow up with your previous landlord.');

  if (errors.length) {
    return render(res, user, applicationFormView({ listing, error: errors[0], values: { ...body, consent_background_check: body.consent_background_check === 'yes' } }), 400);
  }

  const id = crypto.randomUUID();
  run(
    `INSERT INTO applications (id, listing_id, applicant_id, status, move_in_date, employment, previous_landlord_name, previous_landlord_contact, message, consent_background_check)
     VALUES ($id, $listingId, $applicantId, 'submitted', $moveIn, $employment, $landlordName, $landlordContact, $message, 1)`,
    {
      $id: id,
      $listingId: listingId,
      $applicantId: user.id,
      $moveIn: body.move_in_date,
      $employment: body.employment?.trim() || null,
      $landlordName: body.previous_landlord_name.trim(),
      $landlordContact: body.previous_landlord_contact.trim(),
      $message: body.message?.trim() || null,
    }
  );
  redirect(res, `/applications/${id}`);
}

function fetchMessagesForApplication(applicationId) {
  return all(
    `SELECT m.*, u.name as sender_name FROM application_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.application_id = $applicationId ORDER BY m.created_at ASC`,
    { $applicationId: applicationId }
  );
}

async function handleApplicationDetail(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/applications/${id}`);
  const full = fetchApplicationFull(id);
  if (!full) return send(res, 404, 'Application not found');
  const { application, listing, applicant, host } = full;
  if (user.id !== application.applicant_id && user.id !== listing.host_id) return send(res, 403, 'Not your application.');
  const messages = fetchMessagesForApplication(id);
  const verifiedLandlords = fetchVerifiedPastLandlords(application.applicant_id, listing.host_id);
  const referenceRequests = fetchReferenceRequestsForApplication(id);
  render(res, user, applicationDetailView({ application, listing, applicant, host, messages, viewerId: user.id, verifiedLandlords, referenceRequests }));
}

async function handleApplicationMessagePost(req, res, id, user) {
  const full = fetchApplicationFull(id);
  if (!full) return send(res, 404, 'Application not found');
  const { application, listing } = full;
  if (!user || (user.id !== application.applicant_id && user.id !== listing.host_id)) return send(res, 403, 'Not your application.');
  const body = await readBody(req);
  const text = (body.body || '').trim();
  if (text) {
    run('INSERT INTO application_messages (id, application_id, sender_id, body) VALUES ($id, $applicationId, $senderId, $body)', {
      $id: crypto.randomUUID(),
      $applicationId: id,
      $senderId: user.id,
      $body: text.slice(0, 2000),
    });
  }
  redirect(res, `/applications/${id}#messages`);
}

async function handleApplicationDecide(req, res, id, user, decision) {
  const full = fetchApplicationFull(id);
  if (!full) return send(res, 404, 'Application not found');
  const { application, listing } = full;
  if (!user || user.id !== listing.host_id) return send(res, 403, 'Only the host can decide on this application.');
  if (application.status !== 'submitted') return redirect(res, `/applications/${id}`);
  run("UPDATE applications SET status = $status, decided_at = datetime('now') WHERE id = $id", { $status: decision, $id: id });
  redirect(res, `/applications/${id}`);
}

// ---- verified reference checks ------------------------------------------
// A *reviewing* host asking one of an applicant's past, verified Kanto
// hosts about their experience -- tied to a real completed booking, not
// the self-reported previous_landlord_name/contact fields above.

// Up to 3 most recent DISTINCT hosts the applicant has a completed booking
// with elsewhere on Kanto (excluding the host currently reviewing them --
// no point "requesting a reference" from yourself).
function fetchVerifiedPastLandlords(applicantId, excludeHostId) {
  const rows = all(
    `SELECT b.id as booking_id, b.end_date, l.title as listing_title, l.host_id, u.name as host_name
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN users u ON u.id = l.host_id
     WHERE b.guest_id = $applicantId AND b.status = 'completed'
     ORDER BY b.end_date DESC, b.created_at DESC`,
    { $applicantId: applicantId }
  );
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    if (row.host_id === excludeHostId || seen.has(row.host_id)) continue;
    seen.add(row.host_id);
    result.push(row);
    if (result.length === 3) break;
  }
  return result;
}

function fetchReferenceRequestsForApplication(applicationId) {
  return all('SELECT * FROM reference_requests WHERE application_id = $applicationId', { $applicationId: applicationId });
}

function fetchReferenceFull(id) {
  const ref = get('SELECT * FROM reference_requests WHERE id = $id', { $id: id });
  if (!ref) return null;
  const application = get('SELECT * FROM applications WHERE id = $id', { $id: ref.application_id });
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: application.listing_id });
  const pastBooking = get('SELECT * FROM bookings WHERE id = $id', { $id: ref.past_booking_id });
  const pastListing = get('SELECT * FROM listings WHERE id = $id', { $id: pastBooking.listing_id });
  const applicant = get('SELECT * FROM users WHERE id = $id', { $id: ref.applicant_id });
  const requestingHost = get('SELECT * FROM users WHERE id = $id', { $id: ref.requesting_host_id });
  const pastHost = get('SELECT * FROM users WHERE id = $id', { $id: ref.past_host_id });
  return {
    ref: { ...ref, stay_end_date: pastBooking.end_date },
    application,
    listing,
    pastListing,
    applicant,
    requestingHost,
    pastHost,
  };
}

function fetchMessagesForReference(referenceId) {
  return all(
    `SELECT m.*, u.name as sender_name FROM reference_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.reference_request_id = $referenceId ORDER BY m.created_at ASC`,
    { $referenceId: referenceId }
  );
}

// Also used by the host dashboard's "Reference checks" section, for
// either side of the conversation (the host who asked, or the past host
// being asked).
function fetchReferenceRequestsForUser(userId) {
  return all(
    `SELECT r.*, ap.name as applicant_name, rh.name as requesting_host_name, ph.name as past_host_name,
            pl.title as past_listing_title
     FROM reference_requests r
     JOIN bookings b ON b.id = r.past_booking_id
     JOIN listings pl ON pl.id = b.listing_id
     JOIN users ap ON ap.id = r.applicant_id
     JOIN users rh ON rh.id = r.requesting_host_id
     JOIN users ph ON ph.id = r.past_host_id
     WHERE r.requesting_host_id = $userId OR r.past_host_id = $userId
     ORDER BY r.created_at DESC`,
    { $userId: userId }
  );
}

async function handleReferenceRequestPost(req, res, applicationId, user) {
  const full = fetchApplicationFull(applicationId);
  if (!full) return send(res, 404, 'Application not found');
  const { application, listing } = full;
  if (!user || user.id !== listing.host_id) return send(res, 403, 'Only the reviewing host can request a reference.');
  if (!application.consent_background_check) return send(res, 403, 'The applicant has not consented to sharing verified Kanto history.');
  const body = await readBody(req);
  const pastHostId = body.past_host_id;
  const pastBookingId = body.past_booking_id;
  // Re-derive the verified list server-side instead of trusting the posted
  // ids outright -- confirms this really is a completed stay by this
  // applicant with this host, not something spoofed via the form.
  const verified = fetchVerifiedPastLandlords(application.applicant_id, listing.host_id);
  const match = verified.find((l) => l.host_id === pastHostId && l.booking_id === pastBookingId);
  if (!match) return send(res, 400, 'That reference could not be verified.');
  const existing = get(
    'SELECT id FROM reference_requests WHERE application_id = $applicationId AND past_host_id = $pastHostId',
    { $applicationId: applicationId, $pastHostId: pastHostId }
  );
  if (existing) return redirect(res, `/references/${existing.id}`);
  const id = crypto.randomUUID();
  run(
    `INSERT INTO reference_requests (id, application_id, applicant_id, requesting_host_id, past_host_id, past_booking_id)
     VALUES ($id, $applicationId, $applicantId, $requestingHostId, $pastHostId, $pastBookingId)`,
    {
      $id: id,
      $applicationId: applicationId,
      $applicantId: application.applicant_id,
      $requestingHostId: user.id,
      $pastHostId: pastHostId,
      $pastBookingId: pastBookingId,
    }
  );
  redirect(res, `/references/${id}`);
}

async function handleReferenceDetail(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/references/${id}`);
  const full = fetchReferenceFull(id);
  if (!full) return send(res, 404, 'Reference request not found');
  const { ref } = full;
  if (user.id !== ref.requesting_host_id && user.id !== ref.past_host_id) return send(res, 403, 'Not your reference check.');
  const messages = fetchMessagesForReference(id);
  render(res, user, referenceDetailView({ ...full, messages, viewerId: user.id }));
}

async function handleReferenceMessagePost(req, res, id, user) {
  const full = fetchReferenceFull(id);
  if (!full) return send(res, 404, 'Reference request not found');
  const { ref } = full;
  if (!user || (user.id !== ref.requesting_host_id && user.id !== ref.past_host_id)) return send(res, 403, 'Not your reference check.');
  const body = await readBody(req);
  const text = (body.body || '').trim();
  if (text) {
    run('INSERT INTO reference_messages (id, reference_request_id, sender_id, body) VALUES ($id, $referenceId, $senderId, $body)', {
      $id: crypto.randomUUID(),
      $referenceId: id,
      $senderId: user.id,
      $body: text.slice(0, 2000),
    });
    if (user.id === ref.past_host_id && ref.status === 'requested') {
      run("UPDATE reference_requests SET status = 'responded' WHERE id = $id", { $id: id });
    }
  }
  redirect(res, `/references/${id}#messages`);
}

async function handleReferenceRatePost(req, res, id, user) {
  const full = fetchReferenceFull(id);
  if (!full) return send(res, 404, 'Reference request not found');
  const { ref } = full;
  if (!user || user.id !== ref.past_host_id) return send(res, 403, 'Only the past host can leave this reference.');
  const body = await readBody(req);
  const rating = ['positive', 'neutral', 'negative'].includes(body.rating) ? body.rating : null;
  if (rating) {
    run("UPDATE reference_requests SET rating = $rating, status = 'responded' WHERE id = $id", { $id: id, $rating: rating });
  }
  redirect(res, `/references/${id}`);
}

// ---- pre-booking listing inquiries --------------------------------------

function fetchInquiryFull(id) {
  const inquiry = get('SELECT * FROM listing_inquiries WHERE id = $id', { $id: id });
  if (!inquiry) return null;
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: inquiry.listing_id });
  const guest = get('SELECT * FROM users WHERE id = $id', { $id: inquiry.guest_id });
  const host = get('SELECT * FROM users WHERE id = $id', { $id: listing.host_id });
  return { inquiry, listing, guest, host };
}

function fetchMessagesForInquiry(inquiryId) {
  return all(
    `SELECT m.*, u.name as sender_name FROM inquiry_messages m JOIN users u ON u.id = m.sender_id
     WHERE m.inquiry_id = $inquiryId ORDER BY m.created_at ASC`,
    { $inquiryId: inquiryId }
  );
}

async function handleInquireGet(req, res, listingId, user, error) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/inquire`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (user.id === listing.host_id) return send(res, 403, "You can't message yourself about your own listing.");
  const existing = latestInquiryFor(listingId, user.id);
  if (existing) return redirect(res, `/inquiries/${existing.id}`);
  render(res, user, inquiryFormView({ listing, error }));
}

async function handleInquirePost(req, res, listingId, user) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/inquire`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (user.id === listing.host_id) return send(res, 403, "You can't message yourself about your own listing.");

  const existing = latestInquiryFor(listingId, user.id);
  if (existing) return redirect(res, `/inquiries/${existing.id}`);

  const body = await readBody(req);
  const text = (body.body || '').trim();
  if (!text) return render(res, user, inquiryFormView({ listing, error: 'Write a message first.', values: body }), 400);

  const id = crypto.randomUUID();
  run('INSERT INTO listing_inquiries (id, listing_id, guest_id) VALUES ($id, $listingId, $guestId)', {
    $id: id,
    $listingId: listingId,
    $guestId: user.id,
  });
  run('INSERT INTO inquiry_messages (id, inquiry_id, sender_id, body) VALUES ($id, $inquiryId, $senderId, $body)', {
    $id: crypto.randomUUID(),
    $inquiryId: id,
    $senderId: user.id,
    $body: text.slice(0, 2000),
  });
  redirect(res, `/inquiries/${id}`);
}

async function handleInquiryDetail(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/inquiries/${id}`);
  const full = fetchInquiryFull(id);
  if (!full) return send(res, 404, 'Inquiry not found');
  const { inquiry, listing, guest, host } = full;
  if (user.id !== inquiry.guest_id && user.id !== listing.host_id) return send(res, 403, 'Not your inquiry.');
  const messages = fetchMessagesForInquiry(id);
  render(res, user, inquiryDetailView({ inquiry, listing, guest, host, messages, viewerId: user.id }));
}

async function handleInquiryMessagePost(req, res, id, user) {
  const full = fetchInquiryFull(id);
  if (!full) return send(res, 404, 'Inquiry not found');
  const { inquiry, listing } = full;
  if (!user || (user.id !== inquiry.guest_id && user.id !== listing.host_id)) return send(res, 403, 'Not your inquiry.');
  const body = await readBody(req);
  const text = (body.body || '').trim();
  if (text) {
    run('INSERT INTO inquiry_messages (id, inquiry_id, sender_id, body) VALUES ($id, $inquiryId, $senderId, $body)', {
      $id: crypto.randomUUID(),
      $inquiryId: id,
      $senderId: user.id,
      $body: text.slice(0, 2000),
    });
  }
  redirect(res, `/inquiries/${id}#messages`);
}

function fetchInquiriesForUser(user) {
  if (user.role === 'host') {
    return all(
      `SELECT i.*, l.title as listing_title, u.name as guest_name
       FROM listing_inquiries i
       JOIN listings l ON l.id = i.listing_id
       JOIN users u ON u.id = i.guest_id
       WHERE l.host_id = $hostId
       ORDER BY i.created_at DESC`,
      { $hostId: user.id }
    );
  }
  return all(
    `SELECT i.*, l.title as listing_title, h.name as host_name
     FROM listing_inquiries i
     JOIN listings l ON l.id = i.listing_id
     JOIN users h ON h.id = l.host_id
     WHERE i.guest_id = $guestId
     ORDER BY i.created_at DESC`,
    { $guestId: user.id }
  );
}

// ---- QR poster (host-printable, links back to the listing) -------------

async function handleListingQr(req, res, id, user) {
  if (!user) return redirect(res, `/login?next=/listings/${id}/qr`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: id });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can generate a QR poster for this listing.');

  const url = listingUrl(req, id);
  const matrix = encodeQR(url);
  const qrSvg = qrMatrixToSvg(matrix);
  render(res, user, qrPosterView({ listing, listingUrl: url, qrSvg }));
}

// ---- availability calendar (host-managed blocks) -----------------------

function parseMonthParams(url) {
  const now = new Date();
  const year = parseInt(url.searchParams.get('year'), 10) || now.getUTCFullYear();
  const month = url.searchParams.get('month') !== null ? parseInt(url.searchParams.get('month'), 10) : now.getUTCMonth();
  return { year, month };
}

async function handleAvailabilityGet(req, res, listingId, user, url, error) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/availability`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can manage availability.');

  const { year, month } = parseMonthParams(url);
  const monthsToShow = 3;
  const endOfWindow = shiftMonth(year, month, monthsToShow);
  const startIso = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endIso = `${endOfWindow.year}-${String(endOfWindow.month + 1).padStart(2, '0')}-01`;
  const statusMap = dayStatusMap(listing, startIso, endIso);
  const blocks = blocksForListing(listingId);
  render(res, user, availabilityView({ listing, blocks, statusMap, year, month, error }));
}

async function handleAvailabilityBlockPost(req, res, listingId, user) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/availability`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can manage availability.');

  const body = await readBody(req);
  const start = body.start_date;
  const end = body.end_date || null;
  if (!start) return handleAvailabilityGet(req, res, listingId, user, new URL(req.url, `http://${req.headers.host}`), 'A start date is required.');
  if (end && end <= start) return handleAvailabilityGet(req, res, listingId, user, new URL(req.url, `http://${req.headers.host}`), 'The end date must be after the start date.');

  run('INSERT INTO availability_blocks (id, listing_id, start_date, end_date, reason) VALUES ($id, $listingId, $start, $end, $reason)', {
    $id: crypto.randomUUID(),
    $listingId: listingId,
    $start: start,
    $end: end,
    $reason: body.reason?.trim() || null,
  });
  redirect(res, `/listings/${listingId}/availability`);
}

async function handleAvailabilityUnblockPost(req, res, listingId, blockId, user) {
  if (!user) return redirect(res, `/login?next=/listings/${listingId}/availability`);
  const listing = get('SELECT * FROM listings WHERE id = $id', { $id: listingId });
  if (!listing) return send(res, 404, 'Listing not found');
  if (listing.host_id !== user.id) return send(res, 403, 'Only the owner can manage availability.');
  run('DELETE FROM availability_blocks WHERE id = $id AND listing_id = $listingId', { $id: blockId, $listingId: listingId });
  redirect(res, `/listings/${listingId}/availability`);
}

async function handleLoginGet(req, res, url) {
  render(res, null, loginView({ next: url.searchParams.get('next') || '' }));
}

async function handleLoginPost(req, res) {
  const body = await readBody(req);
  const user = authenticate(body.email || '', body.password || '');
  if (!user) return render(res, null, loginView({ error: 'Incorrect email or password.', next: body.next }), 401);
  const token = createSession(user.id);
  redirect(res, body.next && body.next.startsWith('/') ? body.next : '/dashboard', sessionCookie(token));
}

async function handleSignupGet(req, res) {
  render(res, null, signupView({}));
}

async function handleSignupPost(req, res) {
  const body = await readBody(req);
  try {
    if (!body.name || !body.email || !body.password) throw new Error('All fields are required.');
    if (body.password.length < 8) throw new Error('Password must be at least 8 characters.');
    if (!body.agree_terms) throw new Error('You must agree to the Terms of Service and Privacy Policy to create an account.');
    const role = body.role === 'host' ? 'host' : 'guest';
    const id = createUser({ name: body.name, email: body.email, password: body.password, role, termsAccepted: true });
    const token = createSession(id);
    redirect(res, '/dashboard', sessionCookie(token));
  } catch (err) {
    render(res, null, signupView({ error: err.message, values: body }), 400);
  }
}

async function handleLogout(req, res) {
  const cookies = parseCookies(req);
  if (cookies.session) destroySession(cookies.session);
  redirect(res, '/', 'session=; HttpOnly; Path=/; Max-Age=0');
}

function fetchApplicationsForUser(user) {
  if (user.role === 'host') {
    return all(
      `SELECT a.*, l.title as listing_title, u.name as applicant_name
       FROM applications a
       JOIN listings l ON l.id = a.listing_id
       JOIN users u ON u.id = a.applicant_id
       WHERE l.host_id = $hostId
       ORDER BY a.created_at DESC`,
      { $hostId: user.id }
    );
  }
  return all(
    `SELECT a.*, l.title as listing_title, h.name as host_name
     FROM applications a
     JOIN listings l ON l.id = a.listing_id
     JOIN users h ON h.id = l.host_id
     WHERE a.applicant_id = $applicantId
     ORDER BY a.created_at DESC`,
    { $applicantId: user.id }
  );
}

async function handleDashboard(req, res, user) {
  if (!user) return redirect(res, '/login?next=/dashboard');
  const listings = user.role === 'host' ? all('SELECT * FROM listings WHERE host_id = $id ORDER BY created_at DESC', { $id: user.id }) : [];
  const bookings = fetchBookingsForUser(user);
  const applications = fetchApplicationsForUser(user);
  const inquiries = fetchInquiriesForUser(user);
  const performance = user.role === 'host' ? analyticsForHostListings(listings) : [];
  const referenceRequests = user.role === 'host' ? fetchReferenceRequestsForUser(user.id) : [];
  render(res, user, dashboardView({ user, listings, bookings, applications, inquiries, performance, referenceRequests }));
}

// The guest launcher's tiles (see views/dashboard.js) link out to these
// three dedicated pages instead of showing tables inline on /dashboard.
async function handleMyBookings(req, res, user) {
  if (!user) return redirect(res, '/login?next=/my-bookings');
  render(res, user, myBookingsView({ user, bookings: fetchBookingsForUser(user) }));
}

async function handleMyApplications(req, res, user) {
  if (!user) return redirect(res, '/login?next=/my-applications');
  render(res, user, myApplicationsView({ user, applications: fetchApplicationsForUser(user) }));
}

async function handleMyInquiries(req, res, user) {
  if (!user) return redirect(res, '/login?next=/my-inquiries');
  render(res, user, myInquiriesView({ user, inquiries: fetchInquiriesForUser(user) }));
}

// ---- router ---------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { pathname } = url;
    const user = currentUser(req);

    if (req.method === 'GET' && serveStatic(req, res, pathname)) return;

    if (req.method === 'GET' && pathname === '/') return handleHome(req, res, url, user);

    if (req.method === 'GET' && pathname === '/listings/new') return handleListingNewGet(req, res, user);
    if (req.method === 'POST' && pathname === '/listings/new') return handleListingNewPost(req, res, user);

    const listingEditMatch = pathname.match(/^\/listings\/([^/]+)\/edit$/);
    if (req.method === 'GET' && listingEditMatch) return handleListingEditGet(req, res, listingEditMatch[1], user);
    if (req.method === 'POST' && listingEditMatch) return handleListingEditPost(req, res, listingEditMatch[1], user);

    const applyMatch = pathname.match(/^\/listings\/([^/]+)\/apply$/);
    if (req.method === 'GET' && applyMatch) return handleApplyGet(req, res, applyMatch[1], user);
    if (req.method === 'POST' && applyMatch) return handleApplyPost(req, res, applyMatch[1], user);

    const inquireMatch = pathname.match(/^\/listings\/([^/]+)\/inquire$/);
    if (req.method === 'GET' && inquireMatch) return handleInquireGet(req, res, inquireMatch[1], user);
    if (req.method === 'POST' && inquireMatch) return handleInquirePost(req, res, inquireMatch[1], user);

    const qrMatch = pathname.match(/^\/listings\/([^/]+)\/qr$/);
    if (req.method === 'GET' && qrMatch) return handleListingQr(req, res, qrMatch[1], user);

    const unblockMatch = pathname.match(/^\/listings\/([^/]+)\/availability\/([^/]+)\/delete$/);
    if (req.method === 'POST' && unblockMatch) return handleAvailabilityUnblockPost(req, res, unblockMatch[1], unblockMatch[2], user);

    const availabilityMatch = pathname.match(/^\/listings\/([^/]+)\/availability$/);
    if (req.method === 'GET' && availabilityMatch) return handleAvailabilityGet(req, res, availabilityMatch[1], user, url);
    if (req.method === 'POST' && availabilityMatch) return handleAvailabilityBlockPost(req, res, availabilityMatch[1], user);

    const listingMatch = pathname.match(/^\/listings\/([^/]+)$/);
    if (req.method === 'GET' && listingMatch) return handleListing(req, res, listingMatch[1], user);

    const bookMatch = pathname.match(/^\/listings\/([^/]+)\/book$/);
    if (req.method === 'POST' && bookMatch) return handleBook(req, res, bookMatch[1], user);

    const bookingMatch = pathname.match(/^\/bookings\/([^/]+)$/);
    if (req.method === 'GET' && bookingMatch) return handleBookingDetail(req, res, bookingMatch[1], user);

    const bookingMessageMatch = pathname.match(/^\/bookings\/([^/]+)\/messages$/);
    if (req.method === 'POST' && bookingMessageMatch) return handleBookingMessagePost(req, res, bookingMessageMatch[1], user);

    const bookingActionMatch = pathname.match(/^\/bookings\/([^/]+)\/(accept|decline|cancel|complete)$/);
    if (req.method === 'POST' && bookingActionMatch) {
      const [, bookingId, action] = bookingActionMatch;
      if (action === 'accept') return handleBookingAccept(req, res, bookingId, user);
      if (action === 'decline') return handleBookingDecline(req, res, bookingId, user);
      if (action === 'cancel') return handleBookingCancel(req, res, bookingId, user);
      if (action === 'complete') return handleBookingComplete(req, res, bookingId, user);
    }

    const applicationMatch = pathname.match(/^\/applications\/([^/]+)$/);
    if (req.method === 'GET' && applicationMatch) return handleApplicationDetail(req, res, applicationMatch[1], user);

    const applicationMessageMatch = pathname.match(/^\/applications\/([^/]+)\/messages$/);
    if (req.method === 'POST' && applicationMessageMatch) return handleApplicationMessagePost(req, res, applicationMessageMatch[1], user);

    const applicationActionMatch = pathname.match(/^\/applications\/([^/]+)\/(approve|decline)$/);
    if (req.method === 'POST' && applicationActionMatch) {
      const [, applicationId, action] = applicationActionMatch;
      return handleApplicationDecide(req, res, applicationId, user, action === 'approve' ? 'approved' : 'declined');
    }

    const referenceRequestMatch = pathname.match(/^\/applications\/([^/]+)\/references$/);
    if (req.method === 'POST' && referenceRequestMatch) return handleReferenceRequestPost(req, res, referenceRequestMatch[1], user);

    const referenceMessageMatch = pathname.match(/^\/references\/([^/]+)\/messages$/);
    if (req.method === 'POST' && referenceMessageMatch) return handleReferenceMessagePost(req, res, referenceMessageMatch[1], user);

    const referenceRateMatch = pathname.match(/^\/references\/([^/]+)\/rate$/);
    if (req.method === 'POST' && referenceRateMatch) return handleReferenceRatePost(req, res, referenceRateMatch[1], user);

    const referenceMatch = pathname.match(/^\/references\/([^/]+)$/);
    if (req.method === 'GET' && referenceMatch) return handleReferenceDetail(req, res, referenceMatch[1], user);

    const inquiryMatch = pathname.match(/^\/inquiries\/([^/]+)$/);
    if (req.method === 'GET' && inquiryMatch) return handleInquiryDetail(req, res, inquiryMatch[1], user);

    const inquiryMessageMatch = pathname.match(/^\/inquiries\/([^/]+)\/messages$/);
    if (req.method === 'POST' && inquiryMessageMatch) return handleInquiryMessagePost(req, res, inquiryMessageMatch[1], user);

    if (req.method === 'GET' && pathname === '/terms') return render(res, user, termsView());
    if (req.method === 'GET' && pathname === '/privacy') return render(res, user, privacyView());

    if (req.method === 'GET' && pathname === '/login') return handleLoginGet(req, res, url);
    if (req.method === 'POST' && pathname === '/login') return handleLoginPost(req, res);
    if (req.method === 'GET' && pathname === '/signup') return handleSignupGet(req, res);
    if (req.method === 'POST' && pathname === '/signup') return handleSignupPost(req, res);
    if (req.method === 'POST' && pathname === '/logout') return handleLogout(req, res);
    if (req.method === 'GET' && pathname === '/dashboard') return handleDashboard(req, res, user);
    if (req.method === 'GET' && pathname === '/my-bookings') return handleMyBookings(req, res, user);
    if (req.method === 'GET' && pathname === '/my-applications') return handleMyApplications(req, res, user);
    if (req.method === 'GET' && pathname === '/my-inquiries') return handleMyInquiries(req, res, user);

    send(res, 404, layout({ title: 'Not found', user, body: '<div class="empty-state">Page not found. <a href="/">Go home</a></div>' }), {});
  } catch (err) {
    console.error(err);
    send(res, 500, 'Something went wrong.');
  }
});

// Demo/staging convenience: auto-seed the two demo accounts + six sample
// listings on startup if the database is empty, so a host on an ephemeral
// filesystem (e.g. Render's free tier, which wipes local files on every
// spin-down) doesn't come back to a blank site after every restart. Set
// AUTO_SEED_DEMO_DATA=false once this is a real deployment with real
// hosts, so a fresh disk doesn't silently repopulate demo listings.
if (process.env.AUTO_SEED_DEMO_DATA !== 'false') {
  seedIfEmpty();
}

server.listen(PORT, () => {
  console.log(`Kanto running at http://localhost:${PORT}`);
});
