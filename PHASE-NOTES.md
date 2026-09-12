# Kanto — build notes

"Kanto" is a placeholder name — swap it in `views/layout.js` (search for "Kanto") once you've picked a real one.

## A heads-up on the stack

This cloud workspace's network is locked down by your organization's settings — `npm install` can't reach the npm registry (or pypi, jsdelivr, etc.) from here. So instead of the Next.js/React/Tailwind stack I'd normally reach for, this is built with **zero external dependencies**: plain Node.js (built-in `http` server + the built-in `node:sqlite` database) and hand-written HTML/CSS/vanilla JS. Nothing here needs `npm install` to run — just Node 22.5+.

Trade-off: less modern developer experience (no hot reload, no component framework) in exchange for something that runs anywhere, right now, with no setup.

## How to run it

```
node --experimental-sqlite lib/seed.js   # once, to create & seed the database
node server.js                            # starts at http://localhost:3000
```

(On Windows PowerShell, if `npm run ...` complains about scripts being disabled, use the `node --experimental-sqlite ...` commands directly — see below — or run `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.)

Demo accounts (seeded):
- Host — `host@demo.app` / `Demo1234!`
- Guest — `guest@demo.app` / `Demo1234!`

Note: `server.js` now also seeds these automatically on startup if the database is empty (see `lib/seed.js`'s `seedIfEmpty()`) — the manual seed command above is still there for local use, but a fresh deploy doesn't need it run by hand. Set `AUTO_SEED_DEMO_DATA=false` to turn that off.

Want a real public URL instead of `localhost`? See **`DEPLOY.md`** — a free, no-credit-card walkthrough to get this on Render with your own link.

## Data model (`lib/db.js`)

`users`, `listings` (flexes across stay/lease/storage via a `vertical` column and a `price_unit` of night/month/term), `bookings` (`commission_amount` / `payout_amount` / `billing_type` / `payment_status`), `payments` (the money ledger — every charge, refund, and payout), `messages`, `applications` / `application_messages`, `listing_inquiries` / `inquiry_messages` (Phase 8 — pre-booking questions), `reviews`, `sessions`.

## Phase 1 — search, listing, auth, dashboard

- **Search & browse** (`/`) — filter by vertical (stay / lease / storage), city, and price sort. Seeded with 6 sample listings, 2 per vertical, across real PH cities.
- **Listing detail** (`/listings/:id`) — photo placeholder, description, amenities, host name.
- **Auth** — signup/login with a guest/host role choice, sessions via httpOnly cookie, scrypt-hashed passwords.
- **Dashboard** (`/dashboard`) — hosts see their listings and bookings; guests see their own bookings.

## Phase 2 — payments (sandbox)

- **`lib/payments.js`** — a payment *provider interface* (`charge`, `refund`, `payout`) with one sandbox implementation that always succeeds and logs a realistic-looking reference (`GC-XXXXXXXX` for GCash, `PM-` PayMaya, `BT-` bank, `CC-` card). Nothing above this file talks to a gateway directly, so swapping in a real one later doesn't touch booking logic.
- **Request-to-book now charges** — the guest picks GCash / PayMaya / bank / card, the charge is logged, and the booking's `payment_status` becomes `held` (escrow) while `status` stays `pending`.
- **Booking detail page** (`/bookings/:id`) — the full money lifecycle lives here, with a visible payment ledger:
  - Host **accepts** (`pending` → `confirmed`) or **declines** (`pending` → `declined`, auto-refund).
  - Host **marks completed** once the stay/lease term is over (`confirmed` → `completed`), which releases the payout (minus the 10% platform commission) to the host.
  - Guest can **cancel** a `pending` or `confirmed` booking any time before completion (auto-refund).
- **Dashboard** now shows a payment-status pill alongside booking status and links each row into the booking detail page.

### Known simplifications (worth knowing before you show this to anyone)

- Payments always succeed — there's no failure/retry/insufficient-funds path yet.
- A recurring (lease/storage) booking is charged once up front for the full term shown; it doesn't yet generate a new charge each billing cycle. Real monthly re-billing is a good next-phase item.
- No real gateway is wired up. Going live needs a PH payment aggregator account — PayMongo or Xendit both support GCash, PayMaya, and cards behind one API and are the standard choice for this. `lib/payments.js` is written so that's a drop-in swap, not a rewrite.

## Phase 3 — host listing creation & editing

- **`/listings/new`** (host only) — create a listing: vertical, title, description, city/region, price + billing period, capacity, size label, amenities, a placeholder photo emoji, and a status (Active / Draft / Inactive).
- **`/listings/:id/edit`** — same form, pre-filled, owner-only. A host can flip status back and forth (e.g. pause a listing without deleting it).
- **Draft/inactive listings are hidden** from search and return a 404 to anyone who isn't the owner, even with a direct link — only `active` listings are bookable.
- Dashboard's "My listings" now has a **+ New listing** button and an **Edit** link per row; a host viewing their own listing detail page also gets an Edit link.

## Phase 4 — tenant screening / landlord referral (long-term leases)

- **Applies only to `lease`-vertical listings** — short-term stays and storage still book directly, no change there.
- **`/listings/:id/apply`** — before a guest can book a lease listing, they fill out a short application: move-in date, employment/occupation, a **previous landlord's name and contact**, an optional message to the host, and a required consent checkbox ("I consent to the host contacting my previous landlord and reviewing the information above").
- **`/applications/:id`** — the application's detail page. The host sees **Approve** / **Decline** buttons while it's `submitted`; the applicant sees a status pill and, once approved, a "Continue to book & pay" link.
- **The listing page itself gates the booking form** for a lease listing: no application yet → "Apply to rent" button; `submitted` → "awaiting the host's review"; `declined` → the guest can submit a new application; `approved` → the normal pay-and-request-to-book form appears, with a note that they're cleared. `handleBook` also rejects a direct POST bypass server-side, not just in the UI.
- **Dashboard** — hosts get a "Rental applications on my listings" table (applicant, move-in date, status, review link); guests get "My rental applications" the same way.
- **This is a referral/consent workflow, not an automated background check.** It collects the previous landlord's contact info and the tenant's consent for the host to follow up directly — nothing here runs a credit, criminal, or identity check. A real background-check integration (e.g. Checkr, or a PH-specific screening vendor) would plug in as its own service call inside `handleApplyPost`/`handleApplicationDecide`, similar to how `lib/payments.js` is a swappable interface for the payment gateway.

## Phase 5 — messaging

- **Every booking has its own message thread**, on the booking detail page (`/bookings/:id`) that guest and host already share. Either side can post; both see the full thread in order, styled like a chat (your messages align right, theirs left).
- **`POST /bookings/:id/messages`** — the only new route. Access is checked the same way the rest of the booking page is: only the guest on that booking or the host who owns the listing can read or post to it (verified — a third account gets a 403 on both the page and the post).
- **Scope**: this is booking-scoped, not a general inbox — there's no message list/inbox page, no read receipts, no notifications (email/push) when a new message arrives, and no way to message a host before a booking or an approved lease application exists (a guest with a question about a listing still needs to book, or for leases, apply, before they can reach the host through the app). Good next-step candidates if this matters to you.

## Phase 6 — availability calendar

- **This closes a real gap, not just a UI nicety**: before this phase, nothing stopped two guests from booking the same stay listing on overlapping nights, or two tenants from renting the same lease/storage unit at once. That's fixed now at the point of booking, not just in the calendar display.
- **`lib/availability.js`** — the conflict rules, vertical-aware:
  - **Stay (nightly)**: a new booking's date range can't overlap another active (`pending`/`confirmed`) booking, or a host-added block. Checkout day and the next guest's check-in day are allowed to be the same date (standard hotel-style boundary).
  - **Lease / storage (open-ended term)**: single-occupancy — a listing with any active booking can't take a second one, full stop, since these are meant to be rented to one tenant at a time. A host block on the start date also blocks it.
- **`GET /listings/:id/availability`** (host-owner only) — a real calendar (3 months, paged with Earlier/Later) showing booked dates in green and host-blocked dates in red, plus a form to add a manual block (start date, optional end date — leave it blank for an indefinite block — and an optional reason like "Maintenance") and a table of current blocks with a Remove button per row. Linked from the host's own listing page and from the dashboard's listing table.
- **The listing page itself** now shows a 2-month read-only calendar so a guest can see what's actually open before they try to book, instead of finding out only after submitting dates.
- **Data model**: a new `availability_blocks` table (`listing_id`, `start_date`, `end_date` nullable, `reason`). Date ranges use the same `[start, end)` convention as bookings throughout — the end date is "the day you're free again," same meaning as a checkout date.

## Phase 7 — messaging on applications (not just bookings)

- **Closes the gap Phase 5 left**: previously a guest could only message a host once a booking existed — for a lease, that meant only *after* their application was approved. Now every application has its own message thread too, from the moment it's submitted, on `/applications/:id` right below the screening details.
- **Same privacy model as booking messages**: only the applicant and the listing's host can see or post to an application's thread — verified with a third account (403 on both viewing the page and posting). No admin view, no other host or guest can see it either.
- **`POST /applications/:id/messages`** — the only new route, mirrors `POST /bookings/:id/messages` from Phase 5 exactly (same access check, same 2000-char cap).
- **Works regardless of status** — submitted, approved, or declined, the thread stays open. A declined applicant can still ask why, an approved one can coordinate move-in details before they book.
- **Data model**: a new `application_messages` table, separate from `messages` (rather than reusing it with a nullable booking_id) — that way no existing installs need a schema migration, this is just a new table like any other phase.
- **Still not built** (as of Phase 7): messaging before *any* application or booking exists at all — e.g. a guest asking a general question about a short-term stay listing before requesting to book it. Built in Phase 8 below as its own "listing inquiry" thread type.

## Phase 8 — pre-booking inquiries, printable QR poster, Google Maps link

- **Listing inquiry thread** (`/listings/:id/inquire`, `/inquiries/:id`) — closes the gap flagged at the end of Phase 7: a guest can now message a host about a listing with no application or booking underway. One thread per (listing, guest) pair — sending again reuses the existing thread instead of starting a new one, same idea as the application/booking messaging. Only the guest and the listing's host can see a thread (403 for anyone else). New tables: `listing_inquiries`, `inquiry_messages`. Entry point is a "Have a question?" box on the listing page (hidden for the listing's own owner); both host and guest dashboards get an "Inquiries" section.
- **Printable QR poster** (`/listings/:id/qr`, host-only) — generates a QR code that opens straight to the listing's page when scanned, styled as a print-friendly poster (title, price, city, "Scan to view & inquire" call-to-action). Uses the browser's own Print / Save-as-PDF (a `@media print` stylesheet hides the site header/footer/buttons) — no image file to download or manage. The listing URL is derived from the incoming request's own `Host` header, so it links correctly whether you're testing on `localhost` or running on a real domain later, with no config needed.
  - **`lib/qrcode.js`** — a from-scratch QR Code encoder (ISO/IEC 18004: Reed–Solomon error correction, the 8 standard data masks, BCH-coded format info), written by hand because the sandbox can't `npm install` a QR library. Verified byte-for-byte correct by decoding its own output with a real QR reader across multiple versions and error-correction levels before wiring it into the app — see `lib/qrcode.js`'s header comment for scope (byte-mode text, level M, up to ~660 bytes, far more than any listing URL needs).
- **Google Maps / Street View link** — the listing form now has an optional **street address** field; the listing page shows a "View on Google Maps ↗" link (falls back to city/region if no address is set) that opens Google's own Maps/Street View for anyone, no login needed. This deliberately avoids requiring a Google Cloud API key or billing: it's a plain `maps.google.com/search` URL, not an embedded map. **Trade-off to know about**: an *embedded* Street View panel right on the listing page (rather than a link that opens Google Maps in a new tab) would need you to set up your own free-tier Google Maps Platform API key — that's a real account/billing decision on your end, so I didn't make it for you. Say the word if you'd rather have the embedded version and I'll wire it in.
- **"Boost this listing" checklist** (`lib/listingInsights.js`, host-only, on the listing detail page) — a rules-based mini-checklist suggesting concrete things a host can do to make a listing look more complete and get more activity: publish it if it's still draft/inactive, add a placeholder photo, write a fuller description, list at least 3 amenities, add a street address (which also feeds the Maps link and QR poster above), set a capacity or a size label depending on the vertical. Shows a "5 of 7 done" style score, and the host dashboard's "My listings" table gets a matching **Boost** column (e.g. `5/6`) linking straight to the checklist. Below the checklist, a few live signals surface as action items when relevant: inquiries or rental applications currently waiting on the host's reply/decision (linking to the right dashboard section), and — when there are at least 2 other active listings of the same vertical in the same city to compare against — a note if the listing's price sits more than 15% above or below that local average. Nothing here is automatic or enforced; it's all just suggestions computed fresh on each page load from the listing's own data, not a background job or a stored score.

## Phase 9 — views-vs-contacts analytics

- **`lib/analytics.js`** and a new `listing_views` table — every time someone other than the listing's own host loads the listing page, a view is logged: a signed-in visitor is identified by their account, a signed-out one by a long-lived, anonymous cookie (`vid` — no name, email, or IP stored, just enough to tell repeat visits apart). Refreshing the same listing within 30 minutes doesn't log a second view, so "views" doesn't just measure someone mashing refresh.
- **"Listing performance"** section on a host's own listing page (`/listings/:id#performance`) — total views, unique visitors, how many distinct people actually reached out (sent an inquiry, applied, or booked — deduped, so one very chatty guest only counts once), and a **view → contact rate** (contacts ÷ unique visitors). Also shows the last-30-days view count and a plain breakdown of inquiries/applications/bookings.
- **Dashboard comparison table** ("Listing performance", host dashboard, `#performance`) — the same four numbers for every listing a host owns, in one table sorted by views, so it's easy to see at a glance which listings are getting looked at and which of those views are turning into actual conversations, not just per-listing in isolation.
- Everything here is computed live from `listing_views` / `listing_inquiries` / `applications` / `bookings` on each page load — there's no separate analytics pipeline, batch job, or third-party tracker involved.

## Phase 10 — Apple-style minimalist redesign + dark mode

- **Full visual redesign**, replacing the earlier warm/serif theme with a minimalist look inspired by iOS/iPadOS/macOS: the system font (SF Pro via `-apple-system`, no external font files), a neutral gray/white surface, one blue accent color, pill-shaped buttons, a segmented-control style for the vertical tabs, rounded "grouped list" cards, soft shadows, and small hover/press animations (card lift, button scale, a blurred/translucent nav bar). No new dependencies — same zero-`npm install` stack as always, just `public/styles.css` and a handful of view templates.
- **Real dark mode** — a sun/moon toggle button in the nav (top right) flips the whole site between light and dark instantly. Defaults to following the visitor's OS/browser dark-mode setting automatically; an explicit click overrides that and is remembered per-browser via `localStorage` (`kanto-theme`), including for signed-out visitors. An inline script in `views/layout.js`'s `<head>` applies the saved choice before the page paints, so there's no light-mode flash on reload. All of this lives in CSS custom properties in `public/styles.css` (`:root` for light, `:root[data-theme="dark"]` plus a `prefers-color-scheme` media query for dark) — the same variable names the app already used (`--bg`, `--ink`, `--muted`, `--border`, etc.) just repointed to the new palette, so every view's existing inline styles picked up the new look for free.
- **Listing photos are now vertical-based icon art, not emoji** — every stay/lease/storage listing shows a gradient "app icon" tile with a simple house/building/box glyph (`lib/format.js`'s `verticalTileClass()` / `verticalIcon()`), instead of the old free-text `photo_emoji` field. Looks finished and consistent across every card without needing real photo uploads yet. The `photo_emoji` field/column and its listing-form input are untouched (still stored, still editable) in case you want to repurpose or remove it later — it's just no longer what renders visually.
- The one page that deliberately does **not** follow the theme: the printable QR poster (`/listings/:id/qr`) always renders as a plain white card, since it's meant to be printed on paper regardless of what theme you're browsing in.

## Phase 11 — Terms of Service, Privacy Policy, and signup consent

- **`views/terms.js` / `views/privacy.js`** — first-draft Terms of Service and Privacy Policy pages, served at `/terms` and `/privacy` (public, linked from the footer on every page). Both are plain content — no new dependencies. The Privacy Policy references the Philippines Data Privacy Act of 2012 (RA 10173): data subject rights (informed, access, rectification, object/withdraw consent, erasure/blocking, portability, damages), what's actually collected (matched to the real schema — account details, listing/booking/application/inquiry data, sandbox payment records, view-tracking), who it's shared with (only the other party to a transaction — never sold), and a placeholder for a Data Protection Officer contact.
- **Both pages carry a visible draft disclaimer** at the top: written for the Phase 1 demo, not yet reviewed by a lawyer, and shouldn't be relied on before Kanto is opened to the public or handles real money. Jay's plan is to have a lawyer review before publishing for real — the `[contact email]` / `[Data Protection Officer name and contact email]` placeholders in the text are there for him to fill in once that's settled.
- **Signup now requires agreeing to both** — a required checkbox on the signup form (`views/auth.js`) linking to `/terms` and `/privacy` in new tabs. Enforced server-side too (`handleSignupPost` in `server.js` rejects a signup with no `agree_terms`), not just a disabled-button trick in the browser. A new `terms_accepted_at` column on `users` (added via a small migration in `lib/db.js` so it applies to databases that already existed, not just fresh ones) records when each user agreed.
- This is a first draft, not legal advice — the honest gaps (no NPC registration yet, since a Phase 1 demo is well under the size/scale thresholds that would require it; no real DPO; PH consumer-protection specifics around real payments/escrow not yet addressed) are called out in the doc itself, matching the "going live for real" checklist in `DEPLOY.md`.

## Phase 12 — iCloud-style launcher for the guest dashboard

- **Guest `/dashboard` is now a launcher, not tables** — signed-in guests see a profile card (avatar-circle monogram, name, email, "Guest account" badge) next to a grid of colorful icon tiles (Browse, My Bookings, Applications, Inquiries), styled after iCloud.com's app-grid home screen. This only changes the **guest** view — the host dashboard is untouched (still the original tables: My listings, performance, inquiries/applications/bookings received).
- **Three new dedicated pages** (`views/dashboard.js`'s `myBookingsView` / `myApplicationsView` / `myInquiriesView`, routed at `/my-bookings`, `/my-applications`, `/my-inquiries` in `server.js`) hold the actual tables that used to live inline on the guest dashboard — each tile now links out to its own page instead of everything being on one long scrolling page. Same data, same `fetchBookingsForUser` / `fetchApplicationsForUser` / `fetchInquiriesForUser` queries as before, just moved.
- New CSS in `public/styles.css`: `.launcher` / `.launcher-profile` / `.launcher-grid` / `.tile-icon` (four gradient color variants) — reuses the same design tokens as the rest of the Phase 10 redesign, so it follows dark mode automatically.

## What's deliberately not built yet

- Real listing photo uploads — cards show a vertical-based icon graphic (see Phase 10), not an actual photo of the place.
- Reviews.
- Real automated ID verification / background checks (Phase 4 collects a referral + consent, not an automated check — see above).
- Admin/moderation tools (any host can currently publish instantly, with no review step).
- Real recurring billing cycles (see Phase 2 notes above).
- Notifications (email/SMS/push) for new messages, booking status changes, or application decisions — everything today requires visiting the app to see it.
- Calendar sync with other channels (Airbnb/Booking.com iCal import/export) — this calendar only knows about bookings and blocks made inside this app.
- Embedded Street View on the listing page (see Phase 8 note above) — today it's a link out to Google Maps, not an embedded panel, since that needs your own Google Maps API key.
- QR code download as a standalone image file — today it's print/Save-as-PDF from the browser, not a `.png`/`.svg` download button. Easy to add if you want it.
- Analytics history/trends (see Phase 9 above) — today it's live totals only, no day-by-day chart, no CSV export, and no way to tell *where* a view came from (QR poster vs. search vs. a shared link) since that would need UTM-style tagging on every link out.

Say the word and I'll pick the next phase — reviews or image upload are natural next steps, or notifications if you want people to know something happened without having to check the app.
