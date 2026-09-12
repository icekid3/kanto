// lib/db.js
// Storage layer. Uses Node's built-in SQLite (node:sqlite) so Phase 1 runs
// with zero external dependencies — no npm install required.
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'app.sqlite');

export const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('guest','host','admin')),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES users(id),
  vertical TEXT NOT NULL CHECK(vertical IN ('stay','lease','storage')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT,
  address TEXT,
  price_amount INTEGER NOT NULL,
  price_unit TEXT NOT NULL CHECK(price_unit IN ('night','month','term')),
  currency TEXT NOT NULL DEFAULT 'PHP',
  capacity INTEGER,
  size_label TEXT,
  amenities TEXT,
  photo_emoji TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  guest_id TEXT NOT NULL REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','active','completed','cancelled','declined')),
  billing_type TEXT NOT NULL CHECK(billing_type IN ('one_time','recurring')),
  total_amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL,
  payout_amount INTEGER NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','held','paid_out','refunded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  type TEXT NOT NULL CHECK(type IN ('charge','refund','payout')),
  method TEXT NOT NULL CHECK(method IN ('gcash','paymaya','bank','card','platform')),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('succeeded','failed')),
  reference TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  applicant_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','declined','withdrawn')),
  move_in_date TEXT,
  employment TEXT,
  previous_landlord_name TEXT,
  previous_landlord_contact TEXT,
  message TEXT,
  consent_background_check INTEGER NOT NULL DEFAULT 0,
  host_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  start_date TEXT NOT NULL,
  end_date TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A separate table from messages (rather than a nullable booking_id
-- there) so existing installs need no column migration -- this table is
-- simply new, same as any other CREATE TABLE IF NOT EXISTS here.
CREATE TABLE IF NOT EXISTS application_messages (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES applications(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pre-booking inquiries: a guest can message a host about a listing before
-- any application or booking exists. One thread per (listing, guest) pair --
-- reused for follow-up messages rather than spawning a new thread each time.
CREATE TABLE IF NOT EXISTS listing_inquiries (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  guest_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inquiry_messages (
  id TEXT PRIMARY KEY,
  inquiry_id TEXT NOT NULL REFERENCES listing_inquiries(id),
  sender_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per listing-detail-page view, for the host-facing "views vs
-- contacts" analytics (lib/analytics.js). viewer_id identifies a signed-in
-- visitor; anon_id is a long-lived, cookie-based id for signed-out
-- visitors (never a name or IP -- just enough to dedupe repeat views).
-- Exactly one of the two is set. The listing's own host is never logged
-- here (see recordListingView's caller).
CREATE TABLE IF NOT EXISTS listing_views (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  viewer_id TEXT REFERENCES users(id),
  anon_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  target_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
`;

db.exec(SCHEMA);

export function get(sql, params = {}) {
  return db.prepare(sql).get(params);
}

export function all(sql, params = {}) {
  return db.prepare(sql).all(params);
}

export function run(sql, params = {}) {
  return db.prepare(sql).run(params);
}
