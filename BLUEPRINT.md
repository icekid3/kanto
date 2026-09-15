# Kanto — architecture blueprint

This is the "if everything else were lost, could you rebuild this from
this one file" document. It captures the shape of the app as it stands
today: the stack, the data model, every route, and the load-bearing
design decisions — the things a rebuild would get wrong if you had to
guess. For the story of *how* it got built, phase by phase, see
`PHASE-NOTES.md` instead; this file is the current-state map, not the
history.

**This document is a companion to the source code, not a replacement for
it.** The single safest backup is the actual code on GitHub (see
`DEPLOY.md`, Step 1) — push it there if you haven't. What you're reading
now is what lets a rebuild (by another developer, or by an AI assistant
with no memory of this project) reconstruct the *right* app instead of a
plausible-looking different one, and it's also just the fastest way to
re-orient yourself if you come back to this code in six months.

## What Kanto is

A two-sided rental marketplace for the Philippines covering three kinds
of listing in one app instead of three separate ones: short-term stays
(nightly), long-term leases (monthly, with a screening/application step),
and storage/rentable spaces (monthly). Hosts list and manage from a
dashboard; guests search, message hosts, apply (leases only), book, and
pay — with a 10% platform commission held in escrow until a booking
completes.

## Non-negotiable constraints

These shaped nearly every technical decision below, so a rebuild that
drops them will drift into a different app:

- **Zero npm dependencies.** `package.json` has an empty `dependencies`
  object on purpose. Everything is Node's own standard library:
  `node:http` for the server, `node:sqlite` for storage, `node:crypto`
  for password hashing and session tokens. This means `git clone` +
  `node server.js` runs it on any machine with no `npm install` step, no
  version-lock surprises, and nothing to audit for supply-chain risk.
  Reach for a package only if the standard library truly cannot do it —
  the QR code encoder (`lib/qrcode.js`) is a from-scratch ISO/IEC 18004
  implementation for exactly this reason, not because it was the easy
  path.
- **`node:sqlite` needs a flag.** It's still experimental in the Node
  22.x line this targets, so every run command is
  `node --experimental-sqlite server.js`, never plain `node server.js`.
  `package.json`'s `start` script already includes it.
- **No build step.** No bundler, no transpiler, no CSS preprocessor.
  Views are template-literal HTML strings; `public/styles.css` is
  hand-written CSS with custom properties for theming; the two tiny
  client-side scripts (`public/theme.js`, `public/listing.js`) are plain
  ES5-ish vanilla JS loaded as `<script src>` tags, no modules bundler
  needed since they're small enough to hand-write directly.
- **Dates are plain `'YYYY-MM-DD'` strings everywhere**, not `Date`
  objects, specifically to sidestep timezone bugs (see
  `lib/calendar.js`'s header comment). Any new date logic should follow
  that convention rather than reintroducing `Date` math.

## Tech stack at a glance

| Layer | Choice |
|---|---|
| Runtime | Node.js 22.x (`engines` pins `>=22.5.0 <23.0.0`) |
| HTTP server | `node:http`, hand-rolled routing (no framework) |
| Database | `node:sqlite` (`DatabaseSync`), one file at `data/app.sqlite` |
| Auth | `node:crypto` scrypt password hashing + random-token sessions in an httpOnly cookie, stored in the `sessions` table |
| Views | Template-literal HTML strings (no templating engine, no JSX) |
| Styling | One hand-written `public/styles.css`, CSS custom properties for light/dark theming |
| Client JS | Two small vanilla-JS files, no framework, no bundler |
| Payments | A sandboxed provider interface (`lib/payments.js`) that always "succeeds" and logs to a `payments` ledger table — built so a real PH aggregator (PayMongo/Xendit) can be swapped in behind the same `charge()`/`refund()`/`payout()` calls later |
| Deployment | Render.com free web service tier, via `render.yaml`; see `DEPLOY.md` |

## Running it from scratch

```
node --experimental-sqlite server.js      # or: npm start
```

That's the entire setup. On first run against an empty database,
`seedIfEmpty()` (`lib/seed.js`, called from `server.js`) creates two demo
accounts and six sample listings (two per vertical) so there's real data
to click through immediately:

- Host: `host@demo.app` / `Demo1234!`
- Guest: `guest@demo.app` / `Demo1234!`

The database lives at `data/app.sqlite` (auto-created; gitignored). Delete
that file to reset to a clean slate — the schema and demo seed will
recreate themselves on the next start.

## Project structure

```
server.js              All routing + request handlers (one file, ~1,700 lines).
views/                 One template-literal HTML view per page/feature area.
lib/                   Everything that isn't HTML: DB, auth, payments, date
                        math, QR encoding, analytics, business rules.
public/                Static assets served as-is: styles.css, theme.js,
                        listing.js.
data/                  SQLite database file lives here (gitignored).
render.yaml            Render.com "Blueprint" deploy config.
DEPLOY.md              How to actually put this on a public URL.
PHASE-NOTES.md         Chronological build log — what shipped, when, why.
BLUEPRINT.md           This file.
```

### `views/` — one file per page, each exporting a `*View()` function that
returns `{ title, body, ...optional layout flags }`

| File | Purpose |
|---|---|
| `layout.js` | The HTML shell every page renders inside — nav, theme toggle, footer, `<head>`. See "The `layout()` contract" below. |
| `about.js` | The homepage (`/`) — marketing splash, centered "one page" layout. |
| `home.js` | The guest search/discovery grid, now at `/browse`. |
| `listing.js` | Single listing detail. Branches hard on owner vs. guest — see below. |
| `listingForm.js` | Shared create/edit form for a host's listing. |
| `dashboard.js` | Host/guest home base after login — very different layouts per role. |
| `booking.js` | Booking detail: lifecycle actions (accept/decline/cancel/complete) + payment ledger. |
| `application.js` | Rental application (lease listings only): consent, previous-landlord referral, messaging. |
| `reference.js` | A verified reference-check thread between a reviewing host and an applicant's past host. |
| `inquiry.js` | Pre-booking "message the host" thread, no application needed. |
| `availability.js` | Host's calendar manager — see bookings/blocks, add manual blocks. |
| `calendarWidget.js` | Shared month-grid renderer used by both `availability.js` and the read-only calendar on a listing page. |
| `qr.js` | Renders a listing's QR code as SVG + a print-friendly poster page. |
| `auth.js` | Login and signup forms. |
| `terms.js` / `privacy.js` | Draft legal pages (explicitly marked as drafts, not reviewed). |

### `lib/` — everything that isn't HTML

| File | Purpose |
|---|---|
| `db.js` | Schema (`CREATE TABLE IF NOT EXISTS` × 15) + `get`/`all`/`run` query helpers. The single source of truth for the data model. |
| `auth.js` | scrypt password hashing, session token creation/lookup, cookie parsing. |
| `payments.js` | Sandbox payment provider — see "Payments" below. |
| `availability.js` | Booking-conflict checks and calendar day-status, built on `calendar.js`'s date math. |
| `calendar.js` | Pure date/grid math, no DB access, `'YYYY-MM-DD'` strings throughout. |
| `qrcode.js` | From-scratch QR encoder (ISO/IEC 18004), zero dependencies. |
| `listingInsights.js` | "Boost this listing" suggestions for hosts — a completeness checklist + price-vs-comparable-listings comparison. Pure rules over data the caller already fetched. |
| `analytics.js` | Host-facing "views vs. contacts" analytics (total views, unique visitors, view→contact conversion rate). |
| `format.js` | Small render helpers shared by every view (escaping, currency formatting, labels, icons). |
| `seed.js` | Demo account + demo listing seeding, called on startup if the DB is empty. |

### `public/` — static, served as-is

`styles.css` (one file, all CSS, custom-property-based theming),
`theme.js` (dark-mode toggle click handler — the no-flash *read* of the
saved theme happens inline in `layout.js`'s `<head>`, before this file
even loads), `listing.js` (hero photo carousel + header-height
measurement for the guest listing page — see below).

## Data model

Fifteen tables, defined in one place (`lib/db.js`'s `SCHEMA` string). IDs
are `crypto.randomUUID()` throughout, not autoincrement integers.

```
users                   id, role (guest|host|admin), name, email, password_hash,
                        password_salt, verified, terms_accepted_at, created_at

listings                id, host_id → users, vertical (stay|lease|storage), title,
                        description, city, region, address, price_amount,
                        price_unit (night|month|term), currency, capacity,
                        size_label, amenities (JSON array as text), photo_emoji,
                        status (draft|active|inactive), created_at

bookings                id, listing_id → listings, guest_id → users, start_date,
                        end_date, status (pending|confirmed|active|completed|
                        cancelled|declined), billing_type (one_time|recurring),
                        total_amount, commission_amount, payout_amount,
                        payment_status (unpaid|held|paid_out|refunded), created_at

payments                id, booking_id → bookings, type (charge|refund|payout),
                        method (gcash|paymaya|bank|card|platform), amount,
                        status (succeeded|failed), reference, created_at
                        -- the payment ledger; see "Payments" below

applications            id, listing_id → listings, applicant_id → users, status
                        (submitted|approved|declined|withdrawn), move_in_date,
                        employment, previous_landlord_name,
                        previous_landlord_contact, message,
                        consent_background_check, host_notes, created_at, decided_at
                        -- lease-vertical listings only

reference_requests      id, application_id → applications, applicant_id → users,
                        requesting_host_id → users, past_host_id → users,
                        past_booking_id → bookings, status (requested|responded|
                        declined_to_respond), rating (positive|neutral|negative),
                        created_at
                        -- a VERIFIED reference, tied to a real past booking on
                        this platform, as an alternative to the free-text
                        previous_landlord_name/contact fields above

reference_messages      id, reference_request_id → reference_requests,
                        sender_id → users, body, created_at

availability_blocks     id, listing_id → listings, start_date, end_date, reason,
                        created_at
                        -- manual host-added blocks (maintenance, personal use);
                        confirmed bookings are the other source of unavailability

application_messages    id, application_id → applications, sender_id → users,
                        body, created_at

messages                id, booking_id → bookings, sender_id → users, body,
                        created_at
                        -- messaging on a confirmed booking

listing_inquiries       id, listing_id → listings, guest_id → users, created_at
                        -- one thread per (listing, guest) pair, pre-booking

inquiry_messages        id, inquiry_id → listing_inquiries, sender_id → users,
                        body, created_at

listing_views           id, listing_id → listings, viewer_id → users (nullable),
                        anon_id (nullable, exactly one of the two is set),
                        created_at
                        -- powers lib/analytics.js; the listing's own host is
                        never logged viewing their own listing

reviews                 id, booking_id → bookings, author_id → users,
                        target_id → users, rating (1-5), body, created_at
                        -- ⚠️ SCHEMA EXISTS, NOTHING USES IT YET. No route, no
                        view, no write path references this table anywhere in
                        server.js or lib/. It's a stub for a future "reviews"
                        feature (see PHASE-NOTES.md's "not built yet" list) —
                        don't assume review data exists anywhere in the UI.

sessions                token (PK), user_id → users, created_at, expires_at
                        -- 30-day expiry, checked and lazily deleted in
                        userFromSession()
```

Four separate messaging tables (`messages`, `application_messages`,
`inquiry_messages`, `reference_messages`) rather than one polymorphic
table — a deliberate choice (see the comment above
`application_messages` in `lib/db.js`) so adding a new conversation
context is a new `CREATE TABLE IF NOT EXISTS`, safe on existing installs,
instead of a migration adding a nullable foreign key to a shared table.

`lib/db.js` also carries a tiny hand-rolled migration list
(`MIGRATIONS`) for columns added to a table after installs already exist
— each is a try/catch'd `ALTER TABLE` that's a no-op if the column's
already there. That's the pattern to extend for any future column
addition; there's no formal migration framework.

## Route map

All routing lives in one big if-chain in `server.js` (search for
`pathname ===` and `pathname.match`) — no router library, no
file-based routing. Roughly organized as:

```
GET  /                              Homepage (about.js)
GET  /browse                        Guest search/discovery grid
GET  /listings/new                  New listing form (host)
POST /listings/new
GET  /listings/:id                  Listing detail (branches owner/guest)
POST /listings/:id/book
GET  /listings/:id/edit
POST /listings/:id/edit
GET  /listings/:id/apply            Rental application (lease only)
POST /listings/:id/apply
GET  /listings/:id/inquire          Pre-booking inquiry
POST /listings/:id/inquire
GET  /listings/:id/qr               Printable QR poster
GET  /listings/:id/availability     Host calendar manager
POST /listings/:id/availability
POST /listings/:id/availability/:blockId/delete

GET  /bookings/:id
POST /bookings/:id/messages
POST /bookings/:id/(accept|decline|cancel|complete)

GET  /applications/:id
POST /applications/:id/messages
POST /applications/:id/(approve|decline)
GET  /applications/:id/referral
POST /applications/:id/references          (request a verified reference)

GET  /references/:id
POST /references/:id/messages
POST /references/:id/rate

GET  /inquiries/:id
POST /inquiries/:id/messages

GET  /dashboard                     Host/guest home base
GET  /my-bookings  /my-applications  /my-inquiries   (guest sub-pages)

GET  /login   POST /login
GET  /signup  POST /signup          (?role=host pre-checks the host radio)
POST /logout

GET  /terms   GET  /privacy
```

Dynamic segments are plain regexes (e.g.
`/^\/listings\/([^/]+)\/apply$/`), matched in sequence — order matters
where prefixes overlap (`/listings/new` is checked before the generic
`/listings/:id` pattern, for instance).

## Key architectural patterns

### The `layout()` contract

Every page's `{ title, body }` gets wrapped by `layout()`
(`views/layout.js`) into the full HTML document — nav, theme toggle,
footer. A handful of optional flags extend it per-page without every
page needing to know about them:

- `activeNav` — highlights a nav link.
- `fullBleed` — swaps `<main class="container">` (centered, max-width
  1080px) for `<main class="main-full-bleed">` (no padding, no
  max-width), for pages that need edge-to-edge content (the guest
  listing page's photo hero).
- `htmlClass` — adds a class to `<html>`, used today for
  `listing-snap` (enables CSS scroll-snap for the guest listing page).
- `extraScript` — a `<script src>` tag appended after the shared
  `theme.js`, for a page-specific client script (`/listing.js` on the
  guest listing page only).

Extending the shell for a new page's special layout needs means adding a
new flag here, not forking the whole layout.

### Owner vs. guest views share data, not markup

Several pages render completely differently depending on who's looking —
most sharply on the listing detail page (`views/listing.js`):
`listingView()` dispatches to `ownerListingView()` (the original
dense, dashboard-style layout: performance stats, boost checklist, the
plain booking box) or `guestListingView()` (a resort-website-style
page: full-bleed photo hero carousel, floating price line, CSS
scroll-snap sections) based on `user.id === listing.host_id`. Where the
two views need identical logic — the booking/apply call-to-action's
needs-application / pending / pay-and-book / login-prompt branching — it's
pulled into one shared helper (`bookingActionMarkup()`) so the two
renderers can't silently drift apart. `views/dashboard.js` follows the
same shape: hosts get the original table-heavy dashboard, guests get an
icon-grid launcher into dedicated `/my-bookings` etc. sub-pages.

### Guest listing page: stand-in photos + scroll-snap

Kanto has no real photo upload yet, so the guest listing hero shows three
CSS-only gradient/pattern "slides" per listing, generated from the
listing's own per-vertical brand colors (`VERTICAL_GRADIENT` in
`views/listing.js`) rather than a generic placeholder image — swap in
real photos by replacing `heroCarousel()`'s slide markup once uploads
exist; everything else (the carousel controller, the CSS) is
photo-shape-agnostic. The carousel (`public/listing.js`) auto-advances,
responds to arrow/dot clicks and finger swipes, and resets its timer on
manual interaction.

Below the hero, content is split into full-viewport `<section
class="snap-section">` blocks with CSS `scroll-snap-type: y mandatory`
on `<html>` (via the `listing-snap` htmlClass), landing one "page" per
scroll gesture. Getting this to land pixel-perfect against a sticky
header required two things most scroll-snap implementations miss: (1) a
`--header-h` CSS variable, measured live by a `ResizeObserver` in
`public/listing.js` rather than hardcoded, since the header's real
rendered height doesn't land on a round number and any mismatch
compounds section over section; and (2) `scroll-padding-top:
var(--header-h)` on the snapping element, which is the CSS property
actually meant for "content scrolls under a sticky header" — without it,
each section's snap point aligns to the true top of the viewport, which
the sticky header permanently covers, so content lands partially hidden
behind it. Both pieces are necessary together.

### Auth & sessions

Password hashing is scrypt via `node:crypto` (no bcrypt package needed —
scrypt is built in). Sessions are random 32-byte tokens stored server-side
in the `sessions` table (not JWTs — a session row can be deleted to
force-logout, e.g. on password change, though nothing does that yet) and
handed to the browser as an httpOnly cookie. `userFromSession()` checks
expiry (30 days) and lazily deletes expired sessions on lookup rather
than running a cleanup job.

### Payments are a swappable sandbox

`lib/payments.js` exposes `charge()`, `refund()`, and `payout()`. The
current implementation always succeeds and just logs to the `payments`
ledger table with a fake reference code (`GC-XXXXXXXX` for GCash, etc.) —
nothing here talks to a real bank or e-wallet. The interface is
deliberately shaped so a real PH payment aggregator (PayMongo or Xendit,
both support GCash + PayMaya + cards behind one API) can be swapped in as
a second provider implementation without any caller (`server.js`'s
booking handlers) needing to change. A 10% platform commission
(`COMMISSION_RATE` in `server.js`) is computed at booking time and held
until the host payout.

### Theming

Light/dark mode via CSS custom properties on `:root`, redefined under
`@media (prefers-color-scheme: dark)` and again under
`:root[data-theme="dark"]` so an explicit user toggle overrides the OS
setting in both directions. The toggle's *read* of a saved preference
happens inline in `<head>` (`layout.js`), before any CSS or the deferred
`theme.js` loads, specifically to avoid a flash of the wrong theme on
page load.

## What's built vs. not

`PHASE-NOTES.md` ends with a maintained "What's deliberately not built
yet" list (real photo uploads, reviews *— note the `reviews` table
already exists in the schema, see above — real automated ID
verification, moderation tools, real recurring billing, notifications,
external calendar sync, embedded Street View, QR image download, and
analytics history/trends). Check that section there for the current
state rather than duplicating it here, since it's updated as features
ship.

## Deployment

Free-tier Render.com web service, `render.yaml` present so Render offers
it as a one-click "Blueprint" deploy. Full walkthrough, including the
important caveats, lives in `DEPLOY.md` — the two that matter most for a
rebuild:

- The free tier's disk is **ephemeral**: `data/app.sqlite` is wiped on
  every sleep/wake or redeploy. The app re-seeds demo data automatically
  on an empty DB (`AUTO_SEED_DEMO_DATA` env var, defaults on) so the demo
  never looks broken, but anything a real visitor creates (account,
  listing, booking) disappears on restart. Going live for real needs
  persistent storage — a paid Render disk or a hosted database — which
  is a genuine architecture change (SQLite-via-`node:sqlite` assumes a
  local file), not a config flip.
- Node version is pinned to `22.22.2` via `NODE_VERSION`, matching what
  this has actually been tested against.

## If you're rebuilding this from nothing

In rough order:

1. `package.json` (empty deps, `type: module`, the two scripts, the
   engines pin) and `render.yaml`.
2. `lib/db.js` — paste the schema above verbatim; it's the foundation
   everything else assumes.
3. `lib/auth.js`, `lib/calendar.js`, `lib/format.js` — no DB writes of
   their own beyond what `auth.js` needs, low-risk to get right early.
4. `lib/payments.js`, `lib/availability.js`, `lib/listingInsights.js`,
   `lib/analytics.js`, `lib/qrcode.js`.
5. `views/layout.js` first (everything else renders inside it), then the
   rest of `views/` — `about.js` and `home.js` have no dependencies on
   other views; `listing.js` and `dashboard.js` are the most involved
   (owner/guest branching) and worth building last once the simpler
   views prove the shared patterns work.
6. `server.js` last, wiring routes to the view functions and lib
   helpers you've already built — the route map above is the checklist.
7. `lib/seed.js` and `public/*` (styles.css, theme.js, listing.js).

Test each layer by actually running `node --experimental-sqlite
server.js` against it rather than reading the code back — this app has
no automated test suite; manual click-through (and, in this project's
Claude sessions, Playwright screenshot verification) is the whole
verification story so far.
