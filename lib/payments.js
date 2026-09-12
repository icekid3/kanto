// lib/payments.js
// A payment PROVIDER interface with one sandbox implementation. Nothing here
// talks to a real bank or e-wallet yet — every charge/refund/payout is
// simulated and logged to the `payments` ledger table. When you're ready to
// go live, a PH payment aggregator (PayMongo or Xendit both support GCash +
// PayMaya + cards behind one API) plugs in here as a second provider without
// touching booking logic — everything above this file only calls charge(),
// refund(), and payout(); it never talks to a gateway directly.
import crypto from 'node:crypto';
import { run, all } from './db.js';

const REFERENCE_PREFIX = { gcash: 'GC', paymaya: 'PM', bank: 'BT', card: 'CC', platform: 'PLT' };

function reference(method) {
  const prefix = REFERENCE_PREFIX[method] || 'TX';
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

function record({ bookingId, type, method, amount, status, reference: ref }) {
  const id = crypto.randomUUID();
  run(
    `INSERT INTO payments (id, booking_id, type, method, amount, status, reference)
     VALUES ($id, $bookingId, $type, $method, $amount, $status, $reference)`,
    { $id: id, $bookingId: bookingId, $type: type, $method: method, $amount: amount, $status: status, $reference: ref }
  );
  return { id, bookingId, type, method, amount, status, reference: ref };
}

// Sandbox provider: always succeeds. Swap this function's body for a real
// gateway call later — callers never need to change.
export function charge({ bookingId, method, amount }) {
  const ref = reference(method);
  return record({ bookingId, type: 'charge', method, amount, status: 'succeeded', reference: ref });
}

export function refund({ bookingId, method, amount }) {
  const ref = reference(method);
  return record({ bookingId, type: 'refund', method, amount, status: 'succeeded', reference: ref });
}

export function payout({ bookingId, amount }) {
  const ref = reference('platform');
  return record({ bookingId, type: 'payout', method: 'platform', amount, status: 'succeeded', reference: ref });
}

export function ledgerForBooking(bookingId) {
  return all('SELECT * FROM payments WHERE booking_id = $id ORDER BY created_at ASC', { $id: bookingId });
}

export const PAYMENT_METHODS = [
  { value: 'gcash', label: 'GCash' },
  { value: 'paymaya', label: 'PayMaya' },
  { value: 'bank', label: 'Bank transfer' },
  { value: 'card', label: 'Card' },
];
