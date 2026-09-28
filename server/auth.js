import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = 'pp_session';
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// ---- Passwords (scrypt, built into Node) ----

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored ?? '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) {
    // Run a hash anyway so unknown users take as long as wrong passwords.
    await scryptAsync(password, 'timing-equaliser', KEY_LENGTH);
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(expected, actual);
}

// Usernames: 3–30 letters, digits, dot, dash, underscore.
export function validateUsername(name) {
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(name)) {
    throw new HttpError(400, 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore');
  }
}

// Length-based rule, per NIST SP 800-63B (min 8, allow long passphrases).
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (password.length > 128) throw new HttpError(400, 'Password must be at most 128 characters');
}

// ---- Sessions ----

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSessionStore(db, { secureCookies }) {
  const cookieAttrs = `Path=/; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`;

  return {
    start(res, userId) {
      const token = randomBytes(32).toString('base64url');
      db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))`)
        .run(sha256(token), userId, `+${SESSION_DAYS} days`);
      res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttrs}; Max-Age=${SESSION_DAYS * 86400}`);
    },

    end(req, res) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
      res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttrs}; Max-Age=0`);
    },

    // Ends every session of a user except the current one (after a password change).
    endOthers(req, userId) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, sha256(token ?? ''));
    },

    // Middleware: sets req.user from the session cookie.
    middleware(req, _res, next) {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      req.user = token
        ? db.prepare(
          `SELECT u.id, u.name, u.level, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ? AND s.expires_at > datetime('now')`,
        ).get(sha256(token)) ?? null
        : null;
      next();
    },

    purgeExpired() {
      db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
    },
  };
}

// Blocks cross-site state-changing requests (defence in depth on top of SameSite=Lax).
export function sameOriginOnly(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (!origin) return next();
  let host = null;
  try { host = new URL(origin).host; } catch { /* "null" or malformed origin */ }
  if (host !== req.get('Host')) return next(new HttpError(403, 'Cross-site request blocked'));
  next();
}

// ---- Simple in-memory rate limiter (per process) ----

export function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return {
    // Returns true if the key is over its limit.
    isLimited(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < now) return false;
      return entry.count >= max;
    },
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < now) hits.set(key, { count: 1, reset: now + windowMs });
      else entry.count += 1;
      if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

export const publicUser = (u) => ({ id: u.id, username: u.name, level: u.level, isAdmin: !!u.is_admin });
