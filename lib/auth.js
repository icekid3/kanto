// lib/auth.js
// Minimal auth: scrypt password hashing + DB-backed session tokens in an
// httpOnly cookie. No external packages — everything here is node:crypto.
import crypto from 'node:crypto';
import { get, run } from './db.js';

const SESSION_DAYS = 30;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check), Buffer.from(hash));
}

export function createUser({ name, email, password, role, termsAccepted }) {
  const existing = get('SELECT id FROM users WHERE email = $email', { $email: email.toLowerCase() });
  if (existing) throw new Error('An account with that email already exists.');
  const { hash, salt } = hashPassword(password);
  const id = crypto.randomUUID();
  // termsAccepted is enforced server-side before this is ever called (see
  // handleSignupPost) -- this timestamp is just the record of when they did.
  const termsAcceptedAt = termsAccepted ? new Date().toISOString() : null;
  run(
    `INSERT INTO users (id, role, name, email, password_hash, password_salt, terms_accepted_at)
     VALUES ($id, $role, $name, $email, $hash, $salt, $termsAcceptedAt)`,
    { $id: id, $role: role, $name: name, $email: email.toLowerCase(), $hash: hash, $salt: salt, $termsAcceptedAt: termsAcceptedAt }
  );
  return id;
}

export function authenticate(email, password) {
  const user = get('SELECT * FROM users WHERE email = $email', { $email: email.toLowerCase() });
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash, user.password_salt)) return null;
  return user;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES ($token, $userId, $expires)', {
    $token: token,
    $userId: userId,
    $expires: expires,
  });
  return token;
}

export function destroySession(token) {
  run('DELETE FROM sessions WHERE token = $token', { $token: token });
}

export function userFromSession(token) {
  if (!token) return null;
  const session = get('SELECT * FROM sessions WHERE token = $token', { $token: token });
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) {
    destroySession(token);
    return null;
  }
  return get('SELECT * FROM users WHERE id = $id', { $id: session.user_id });
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) cookies[k] = decodeURIComponent(v.join('='));
  }
  return cookies;
}
