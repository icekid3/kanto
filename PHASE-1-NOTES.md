# Kanto — Phase 1 notes

"Kanto" is a placeholder name — swap it in `views/layout.js` (search for "Kanto") once you've picked a real one.

## A heads-up on the stack

This cloud workspace's network is locked down by your organization's settings — `npm install` can't reach the npm registry (or pypi, jsdelivr, etc.) from here. So instead of the Next.js/React/Tailwind stack I'd normally reach for, Phase 1 is built with **zero external dependencies**: plain Node.js (built-in `http` server + the built-in `node:sqlite` database) and hand-written HTML/CSS/vanilla JS. Nothing here needs `npm install` to run — just Node 22.5+.

Trade-off: less modern developer experience (no hot reload, no component framework) in exchange for something that runs anywhere, right now, with no setup. If you'd rather build on the real Next.js stack, the two ways to unlock that are: (1) ask whoever manages your Claude organization's network settings to allow the npm registry, or (2) I build directly on your own computer instead, where your normal internet access applies — just say the word and connect a folder.

## What's working right now

- **Search & browse** (`/`) — filter by vertical (stay / lease / storage), city, and price sort. Seeded with 6 sample listings, 2 per vertical, across real PH cities.
- **Listing detail** (`/listings/:id`) — photo placeholder, description, amenities, host name, and a booking box.
- **Auth** — signup and login with a guest/host role choice, sessions via httpOnly cookie, scrypt-hashed passwords.
- **Request to book** — creates a real `pending` booking row with the total, a 10% platform commission, and the host payout already calculated (no real payment is charged — that's Phase 2).
- **Dashboard** (`/dashboard`) — hosts see their listings and incoming booking requests; guests see their own bookings.

Demo accounts (seeded):
- Host — `host@demo.app` / `Demo1234!`
- Guest — `guest@demo.app` / `Demo1234!`

## How to run it

```
node --experimental-sqlite lib/seed.js   # once, to create & seed the database
node server.js                            # starts at http://localhost:3000
```

## Data model (`lib/db.js`)

`users`, `listings` (flexes across stay/lease/storage via a `vertical` column and a `price_unit` of night/month/term), `bookings` (already carries `commission_amount` / `payout_amount` / `billing_type` so the escrow split from the blueprint has somewhere to live), `messages`, `reviews`, `sessions`.

## What's deliberately not built yet (later phases)

- Real payment / escrow (GCash, PayMaya, bank, card) — right now bookings are recorded but nothing is actually charged.
- Host listing creation/editing UI — listings are seeded, not created through the app.
- Messaging between guest and host.
- Reviews.
- ID verification / trust & safety.
- Admin/moderation tools.

Say the word and I'll pick up the next phase — payments (with a sandbox GCash/PayMaya flow) is the natural next step since it completes the core booking loop end to end.
