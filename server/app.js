import express from 'express';
import multer from 'multer';
import { randomBytes, randomUUID } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readSync, unlink } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HttpError, createSessionStore, hashPassword, publicUser, rateLimiter, sameOriginOnly,
  validatePassword, validateUsername, verifyPassword,
} from './auth.js';
import { GenerationError, createClaudeGuideGenerator, sanitizeGuide } from './content/ai.js';
import { createContent, getMeta, isLevel, isMedium, isStyle, toSummary } from './content/index.js';
import { openDb } from './db.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const REPORT_REASONS = [
  { id: 'inappropriate', name: 'Nudity, violence or other inappropriate content' },
  { id: 'not-a-painting', name: 'Not a painting' },
  { id: 'copyright', name: 'Copied from someone else' },
  { id: 'harassment', name: 'Harassment or hate' },
  { id: 'spam', name: 'Spam or advertising' },
  { id: 'other', name: 'Something else' },
];

// Checks the file's first bytes really are a JPEG, PNG or WebP image.
function hasImageSignature(path) {
  const buf = Buffer.alloc(12);
  const fd = openSync(path, 'r');
  try { readSync(fd, buf, 0, 12, 0); } finally { closeSync(fd); }
  return (
    (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) ||
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
  );
}

export function createApp({
  dbPath = 'data/app.db',
  uploadDir = 'data/uploads',
  secureCookies = process.env.NODE_ENV === 'production',
  trustProxy = process.env.TRUST_PROXY,
  contactEmail = process.env.CONTACT_EMAIL || '',
  reportHideThreshold = Number(process.env.REPORT_HIDE_THRESHOLD) || 3,
  aiDailyLimit = Number(process.env.AI_DAILY_LIMIT) || 3,
  registrationsPerHour = Number(process.env.REGISTRATIONS_PER_HOUR) || 30,
  guideGenerator = process.env.ANTHROPIC_API_KEY ? createClaudeGuideGenerator() : null,
} = {}) {
  const db = openDb(dbPath);
  const content = createContent(db);
  const sessions = createSessionStore(db, { secureCookies });
  const loginLimiter = rateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
  const registerLimiter = rateLimiter({ max: registrationsPerHour, windowMs: 60 * 60 * 1000 });
  const generating = new Set();
  const uploadsPath = resolve(uploadDir);
  mkdirSync(uploadsPath, { recursive: true });

  sessions.purgeExpired();
  setInterval(() => sessions.purgeExpired(), 60 * 60 * 1000).unref();

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsPath,
      filename: (_req, file, cb) => cb(null, randomUUID() + IMAGE_TYPES[file.mimetype]),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) =>
      IMAGE_TYPES[file.mimetype]
        ? cb(null, true)
        : cb(new HttpError(400, 'Only JPEG, PNG or WebP images are allowed')),
  });

  const app = express();
  if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  app.disable('x-powered-by');

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });

  app.get('/healthz', (_req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });

  app.use('/api', express.json({ limit: '100kb' }), sameOriginOnly, sessions.middleware.bind(sessions));

  const requireUser = (req, _res, next) =>
    req.user ? next() : next(new HttpError(401, 'Please log in first'));
  const requireAdmin = (req, _res, next) =>
    req.user?.is_admin ? next() : next(new HttpError(403, 'Admins only'));

  // ---- Authentication ----
  app.post('/api/auth/register', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const { password, level = 'beginner' } = req.body ?? {};
    if (registerLimiter.isLimited(req.ip)) throw new HttpError(429, 'Too many sign-ups from this network. Try again later.');
    validateUsername(username);
    validatePassword(password);
    if (!isLevel(level)) throw new HttpError(400, 'Unknown level');
    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(username)) throw new HttpError(409, 'That username is taken');

    const hash = await hashPassword(password);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, level, password_hash) VALUES (?, ?, ?)')
      .run(username, level, hash);
    registerLimiter.hit(req.ip);
    sessions.start(res, lastInsertRowid);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    res.status(201).json(publicUser(user));
  });

  app.post('/api/auth/login', async (req, res) => {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const key = `${req.ip}|${username.toLowerCase()}`;
    if (loginLimiter.isLimited(key)) throw new HttpError(429, 'Too many failed attempts. Try again in 15 minutes.');

    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(username);
    const ok = await verifyPassword(password, user?.password_hash);
    if (!user || !ok) {
      loginLimiter.hit(key);
      throw new HttpError(401, 'Wrong username or password');
    }
    loginLimiter.reset(key);
    sessions.start(res, user.id);
    res.json(publicUser(user));
  });

  app.post('/api/auth/logout', (req, res) => {
    sessions.end(req, res);
    res.status(204).end();
  });

  app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user ? publicUser(req.user) : null });
  });

  // ---- Account ----
  app.patch('/api/me', requireUser, (req, res) => {
    const { level } = req.body ?? {};
    if (!isLevel(level)) throw new HttpError(400, 'Unknown level');
    db.prepare('UPDATE users SET level = ? WHERE id = ?').run(level, req.user.id);
    res.json(publicUser({ ...req.user, level }));
  });

  app.put('/api/me/password', requireUser, async (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(String(currentPassword ?? ''), row.password_hash))) throw new HttpError(400, 'Current password is wrong');
    validatePassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(newPassword), req.user.id);
    sessions.endOthers(req, req.user.id);
    res.status(204).end();
  });

  // Deletes the account and everything it owns (paintings, photos, ratings, likes…).
  app.delete('/api/me', requireUser, async (req, res) => {
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!(await verifyPassword(String(req.body?.password ?? ''), row.password_hash))) throw new HttpError(400, 'Password is wrong');
    const paintings = db.prepare('SELECT id, image_file FROM paintings WHERE user_id = ?').all(req.user.id);
    db.exec('BEGIN');
    try {
      for (const p of paintings) db.prepare("DELETE FROM likes WHERE target_type = 'painting' AND target_id = ?").run(String(p.id));
      // Unreviewed AI drafts go; published ones stay for others (creator becomes anonymous).
      db.prepare("DELETE FROM ai_guides WHERE user_id = ? AND status = 'private'").run(req.user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    for (const p of paintings) unlink(join(uploadsPath, p.image_file), () => {});
    sessions.end(req, res);
    res.status(204).end();
  });

  // ---- Blocking ----
  app.put('/api/users/:id/block', requireUser, (req, res) => {
    const target = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(req.params.id));
    if (!target) throw new HttpError(404, 'User not found');
    if (target.id === req.user.id) throw new HttpError(400, "You can't block yourself");
    db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_user_id) VALUES (?, ?)').run(req.user.id, target.id);
    res.json({ blocked: true });
  });
  app.delete('/api/users/:id/block', requireUser, (req, res) => {
    db.prepare('DELETE FROM blocks WHERE user_id = ? AND blocked_user_id = ?').run(req.user.id, Number(req.params.id));
    res.json({ blocked: false });
  });
  app.get('/api/me/blocks', requireUser, (req, res) => {
    res.json(db.prepare(
      'SELECT u.id, u.name AS username FROM blocks b JOIN users u ON u.id = b.blocked_user_id WHERE b.user_id = ? ORDER BY u.name',
    ).all(req.user.id));
  });

  // ---- Content ----
  app.get('/api/meta', (_req, res) =>
    res.json({ ...getMeta(), aiEnabled: !!guideGenerator, aiDailyLimit, contactEmail, reportReasons: REPORT_REASONS }));

  app.get('/api/suggestions', (req, res) => {
    const { style, level, medium } = req.query;
    res.json(content.suggest({ style, level, medium }, req.user));
  });

  const guideOr404 = (req, id = req.params.id) => {
    const guide = content.getGuide(id, req.user);
    if (!guide) throw new HttpError(404, 'Guide not found');
    return guide;
  };

  app.get('/api/guides/:id', (req, res) => {
    const guide = guideOr404(req);
    let user = { liked: false, planned: false, stepsDone: [] };
    if (req.user) {
      const uid = req.user.id;
      user = {
        liked: !!db.prepare("SELECT 1 FROM likes WHERE user_id = ? AND target_type = 'guide' AND target_id = ?").get(uid, guide.id),
        planned: !!db.prepare('SELECT 1 FROM plans WHERE user_id = ? AND guide_id = ?').get(uid, guide.id),
        stepsDone: JSON.parse(db.prepare('SELECT steps_done FROM progress WHERE user_id = ? AND guide_id = ?').get(uid, guide.id)?.steps_done ?? '[]'),
      };
    }
    const publicPaintings = db
      .prepare("SELECT COUNT(*) AS n FROM paintings WHERE guide_id = ? AND visibility = 'public' AND moderation = 'visible'")
      .get(guide.id).n;
    res.json({ ...guide, user, publicPaintings });
  });

  app.post('/api/guides/generate', requireUser, async (req, res) => {
    if (!guideGenerator) throw new HttpError(404, 'AI guides are not enabled');
    const { style, level, medium } = req.body ?? {};
    const idea = String(req.body?.idea ?? '').trim();
    if (!isStyle(style) || !isLevel(level) || !isMedium(medium)) throw new HttpError(400, 'Choose a style, level and medium');
    if (idea.length > 200) throw new HttpError(400, 'Keep your idea under 200 characters');
    const used = db.prepare("SELECT COUNT(*) AS n FROM ai_guides WHERE user_id = ? AND created_at > datetime('now', '-1 day')").get(req.user.id).n;
    if (used >= aiDailyLimit) throw new HttpError(429, `You can generate ${aiDailyLimit} guides per day. Try again tomorrow.`);
    if (generating.has(req.user.id)) throw new HttpError(429, 'A guide is already being generated for you');

    generating.add(req.user.id);
    try {
      const raw = await guideGenerator({ style, level, medium, idea });
      const guide = sanitizeGuide(raw, { style, level, medium });
      const id = `ai-${randomBytes(6).toString('hex')}`;
      db.prepare('INSERT INTO ai_guides (id, user_id, data) VALUES (?, ?, ?)').run(id, req.user.id, JSON.stringify(guide));
      res.status(201).json(content.getGuide(id, req.user));
    } catch (err) {
      if (err instanceof GenerationError) throw new HttpError(err.status, err.message);
      throw err;
    } finally {
      generating.delete(req.user.id);
    }
  });

  app.put('/api/guides/:id/like', requireUser, (req, res) => {
    const g = guideOr404(req);
    db.prepare("INSERT OR IGNORE INTO likes (user_id, target_type, target_id) VALUES (?, 'guide', ?)").run(req.user.id, g.id);
    res.json({ liked: true });
  });
  app.delete('/api/guides/:id/like', requireUser, (req, res) => {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND target_type = 'guide' AND target_id = ?").run(req.user.id, req.params.id);
    res.json({ liked: false });
  });

  app.put('/api/guides/:id/plan', requireUser, (req, res) => {
    const g = guideOr404(req);
    db.prepare('INSERT OR IGNORE INTO plans (user_id, guide_id) VALUES (?, ?)').run(req.user.id, g.id);
    res.json({ planned: true });
  });
  app.delete('/api/guides/:id/plan', requireUser, (req, res) => {
    db.prepare('DELETE FROM plans WHERE user_id = ? AND guide_id = ?').run(req.user.id, req.params.id);
    res.json({ planned: false });
  });

  app.put('/api/guides/:id/progress', requireUser, (req, res) => {
    const g = guideOr404(req);
    const done = Array.isArray(req.body?.stepsDone) ? req.body.stepsDone : [];
    const clean = [...new Set(done.map(Number))].filter((i) => Number.isInteger(i) && i >= 0 && i < g.steps.length).sort((a, b) => a - b);
    db.prepare(
      `INSERT INTO progress (user_id, guide_id, steps_done) VALUES (?, ?, ?)
       ON CONFLICT (user_id, guide_id) DO UPDATE SET steps_done = excluded.steps_done, updated_at = datetime('now')`,
    ).run(req.user.id, g.id, JSON.stringify(clean));
    res.json({ stepsDone: clean });
  });

  // ---- Paintings ----
  // Shared SELECT: adds author, average rating, and the viewer's own rating/like.
  const paintingSelect = `
    SELECT p.id, p.user_id AS userId, u.name AS author, p.title, p.description, p.style,
           p.guide_id AS guideId, p.visibility, p.moderation, p.created_at AS createdAt,
           ROUND(AVG(r.stars), 1) AS avgRating, COUNT(r.stars) AS ratingCount,
           (SELECT stars FROM ratings WHERE painting_id = p.id AND user_id = :viewer) AS myRating,
           EXISTS (SELECT 1 FROM likes WHERE user_id = :viewer AND target_type = 'painting' AND target_id = CAST(p.id AS TEXT)) AS liked,
           EXISTS (SELECT 1 FROM reports WHERE painting_id = p.id AND user_id = :viewer) AS reported
    FROM paintings p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN ratings r ON r.painting_id = p.id`;

  // Public, not hidden by moderators, and not by someone the viewer blocked.
  const publicFilter = `p.visibility = 'public' AND p.moderation = 'visible'
    AND p.user_id NOT IN (SELECT blocked_user_id FROM blocks WHERE user_id = :viewer)`;

  const shapePainting = (row) => ({
    ...row,
    liked: !!row.liked,
    reported: !!row.reported,
    guideTitle: row.guideId ? content.guideTitle(row.guideId) : null,
    imageUrl: `/api/paintings/${row.id}/image`,
  });

  const viewerId = (req) => req.user?.id ?? 0;

  // Owners and admins see everything; others only public, non-hidden paintings.
  const canView = (req, row) =>
    row.userId === req.user?.id || req.user?.is_admin || (row.visibility === 'public' && row.moderation === 'visible');

  const visiblePainting = (req, id) => {
    const row = db.prepare(`${paintingSelect} WHERE p.id = :id GROUP BY p.id`).get({ viewer: viewerId(req), id: Number(id) });
    if (!row || !canView(req, row)) throw new HttpError(404, 'Painting not found');
    return row;
  };

  const ownPainting = (req, id) => {
    const row = db.prepare('SELECT * FROM paintings WHERE id = ?').get(Number(id));
    if (!row || row.user_id !== req.user.id) throw new HttpError(404, 'Painting not found');
    return row;
  };

  const deletePainting = (row) => {
    db.prepare("DELETE FROM likes WHERE target_type = 'painting' AND target_id = ?").run(String(row.id));
    db.prepare('DELETE FROM paintings WHERE id = ?').run(row.id);
    unlink(join(uploadsPath, row.image_file), () => {});
  };

  app.post('/api/paintings', requireUser, upload.single('image'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a photo of your painting');
    try {
      if (!hasImageSignature(req.file.path)) throw new HttpError(400, 'That file is not a valid JPEG, PNG or WebP image');
      const title = String(req.body.title ?? '').trim();
      const description = String(req.body.description ?? '').trim().slice(0, 1000);
      const visibility = req.body.visibility === 'public' ? 'public' : 'private';
      const guideId = req.body.guideId || null;
      const guide = guideId ? content.getGuide(guideId, req.user) : null;
      if (guideId && !guide) throw new HttpError(400, 'Unknown guide');
      const style = guide?.style ?? req.body.style;
      if (!title || title.length > 80) throw new HttpError(400, 'Title must be 1–80 characters');
      if (!isStyle(style)) throw new HttpError(400, 'Choose a style');

      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO paintings (user_id, title, description, style, guide_id, image_file, visibility)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(req.user.id, title, description, style, guideId, req.file.filename, visibility);
      // Finishing a planned guide removes it from "planned next".
      if (guideId) db.prepare('DELETE FROM plans WHERE user_id = ? AND guide_id = ?').run(req.user.id, guideId);
      res.status(201).json(shapePainting(visiblePainting(req, lastInsertRowid)));
    } catch (err) {
      unlink(req.file.path, () => {});
      throw err;
    }
  });

  app.get('/api/gallery', (req, res) => {
    const { style, sort } = req.query;
    const order = sort === 'top' ? 'avgRating IS NULL, avgRating DESC, ratingCount DESC, p.id DESC' : 'p.id DESC';
    const rows = db
      .prepare(
        `${paintingSelect}
         WHERE ${publicFilter} AND (:style IS NULL OR p.style = :style)
         GROUP BY p.id ORDER BY ${order} LIMIT 200`,
      )
      .all({ viewer: viewerId(req), style: style || null });
    res.json(rows.map(shapePainting));
  });

  app.get('/api/paintings/:id', (req, res) => {
    res.json(shapePainting(visiblePainting(req, req.params.id)));
  });

  // Images go through the same access check, so private and hidden paintings stay private.
  app.get('/api/paintings/:id/image', (req, res) => {
    const row = db.prepare('SELECT user_id AS userId, visibility, moderation, image_file FROM paintings WHERE id = ?').get(Number(req.params.id));
    if (!row || !canView(req, row)) throw new HttpError(404, 'Not found');
    res.set('Cache-Control', 'private, max-age=300');
    res.sendFile(join(uploadsPath, row.image_file));
  });

  app.patch('/api/paintings/:id', requireUser, (req, res) => {
    const row = ownPainting(req, req.params.id);
    const { visibility, title, description } = req.body ?? {};
    if (visibility !== undefined && !['private', 'public'].includes(visibility)) throw new HttpError(400, 'Invalid visibility');
    if (title !== undefined && (!String(title).trim() || String(title).length > 80)) throw new HttpError(400, 'Title must be 1–80 characters');
    db.prepare('UPDATE paintings SET visibility = ?, title = ?, description = ? WHERE id = ?').run(
      visibility ?? row.visibility,
      title !== undefined ? String(title).trim() : row.title,
      description !== undefined ? String(description).trim().slice(0, 1000) : row.description,
      row.id,
    );
    res.json(shapePainting(visiblePainting(req, row.id)));
  });

  app.delete('/api/paintings/:id', requireUser, (req, res) => {
    deletePainting(ownPainting(req, req.params.id));
    res.status(204).end();
  });

  // Others' public paintings only (not your own, not hidden ones).
  const othersPublicPainting = (req, id) => {
    const p = visiblePainting(req, id);
    if (p.visibility !== 'public' || p.moderation !== 'visible') throw new HttpError(404, 'Painting not found');
    return p;
  };

  app.put('/api/paintings/:id/rating', requireUser, (req, res) => {
    const p = othersPublicPainting(req, req.params.id);
    if (p.userId === req.user.id) throw new HttpError(400, "You can't rate your own painting");
    const stars = Number(req.body?.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new HttpError(400, 'Rating must be 1–5 stars');
    db.prepare(
      `INSERT INTO ratings (painting_id, user_id, stars) VALUES (?, ?, ?)
       ON CONFLICT (painting_id, user_id) DO UPDATE SET stars = excluded.stars`,
    ).run(p.id, req.user.id, stars);
    res.json(shapePainting(visiblePainting(req, p.id)));
  });

  app.put('/api/paintings/:id/like', requireUser, (req, res) => {
    const p = visiblePainting(req, req.params.id);
    db.prepare("INSERT OR IGNORE INTO likes (user_id, target_type, target_id) VALUES (?, 'painting', ?)").run(req.user.id, String(p.id));
    res.json({ liked: true });
  });
  app.delete('/api/paintings/:id/like', requireUser, (req, res) => {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND target_type = 'painting' AND target_id = ?").run(req.user.id, String(Number(req.params.id)));
    res.json({ liked: false });
  });

  // ---- Moderation ----
  app.post('/api/paintings/:id/report', requireUser, (req, res) => {
    const p = othersPublicPainting(req, req.params.id);
    if (p.userId === req.user.id) throw new HttpError(400, "You can't report your own painting");
    const reason = req.body?.reason;
    if (!REPORT_REASONS.some((r) => r.id === reason)) throw new HttpError(400, 'Choose a reason');
    const details = String(req.body?.details ?? '').trim().slice(0, 500);
    db.prepare('INSERT OR IGNORE INTO reports (painting_id, user_id, reason, details) VALUES (?, ?, ?, ?)').run(p.id, req.user.id, reason, details);
    // Enough independent reports hide the painting until an admin reviews it.
    const open = db.prepare('SELECT COUNT(*) AS n FROM reports WHERE painting_id = ? AND resolved = 0').get(p.id).n;
    if (open >= reportHideThreshold) db.prepare("UPDATE paintings SET moderation = 'hidden' WHERE id = ?").run(p.id);
    res.json({ reported: true });
  });

  app.get('/api/admin/queue', requireUser, requireAdmin, (req, res) => {
    const paintings = db
      .prepare(
        `${paintingSelect}
         WHERE p.moderation = 'hidden' OR p.id IN (SELECT painting_id FROM reports WHERE resolved = 0)
         GROUP BY p.id ORDER BY p.id DESC`,
      )
      .all({ viewer: req.user.id })
      .map((row) => ({
        ...shapePainting(row),
        reports: db.prepare(
          `SELECT r.reason, r.details, r.created_at AS createdAt, u.name AS reporter
           FROM reports r JOIN users u ON u.id = r.user_id WHERE r.painting_id = ? AND r.resolved = 0 ORDER BY r.created_at`,
        ).all(row.id),
      }));
    const aiGuides = db
      .prepare(
        `SELECT g.id, g.status, g.created_at AS createdAt, u.name AS createdBy FROM ai_guides g
         LEFT JOIN users u ON u.id = g.user_id WHERE g.status = 'private' ORDER BY g.created_at DESC LIMIT 100`,
      )
      .all()
      .map((g) => ({ ...toSummary(content.getGuide(g.id, req.user)), createdByName: g.createdBy, createdAt: g.createdAt }));
    res.json({ paintings, aiGuides });
  });

  const anyPainting = (id) => {
    const row = db.prepare('SELECT * FROM paintings WHERE id = ?').get(Number(id));
    if (!row) throw new HttpError(404, 'Painting not found');
    return row;
  };

  app.post('/api/admin/paintings/:id/hide', requireUser, requireAdmin, (req, res) => {
    const row = anyPainting(req.params.id);
    db.prepare("UPDATE paintings SET moderation = 'hidden' WHERE id = ?").run(row.id);
    db.prepare('UPDATE reports SET resolved = 1 WHERE painting_id = ?').run(row.id);
    res.json({ moderation: 'hidden' });
  });

  app.post('/api/admin/paintings/:id/restore', requireUser, requireAdmin, (req, res) => {
    const row = anyPainting(req.params.id);
    db.prepare("UPDATE paintings SET moderation = 'visible' WHERE id = ?").run(row.id);
    db.prepare('UPDATE reports SET resolved = 1 WHERE painting_id = ?').run(row.id);
    res.json({ moderation: 'visible' });
  });

  app.delete('/api/admin/paintings/:id', requireUser, requireAdmin, (req, res) => {
    deletePainting(anyPainting(req.params.id));
    res.status(204).end();
  });

  const aiGuideRow = (id) => {
    const row = db.prepare('SELECT * FROM ai_guides WHERE id = ?').get(String(id));
    if (!row) throw new HttpError(404, 'Guide not found');
    return row;
  };
  app.post('/api/admin/ai-guides/:id/publish', requireUser, requireAdmin, (req, res) => {
    db.prepare("UPDATE ai_guides SET status = 'published' WHERE id = ?").run(aiGuideRow(req.params.id).id);
    res.json({ status: 'published' });
  });
  app.post('/api/admin/ai-guides/:id/unpublish', requireUser, requireAdmin, (req, res) => {
    db.prepare("UPDATE ai_guides SET status = 'private' WHERE id = ?").run(aiGuideRow(req.params.id).id);
    res.json({ status: 'private' });
  });
  app.delete('/api/admin/ai-guides/:id', requireUser, requireAdmin, (req, res) => {
    db.prepare('DELETE FROM ai_guides WHERE id = ?').run(aiGuideRow(req.params.id).id);
    res.status(204).end();
  });

  // ---- "My page" ----
  app.get('/api/me/paintings', requireUser, (req, res) => {
    const rows = db
      .prepare(`${paintingSelect} WHERE p.user_id = :viewer GROUP BY p.id ORDER BY p.id DESC`)
      .all({ viewer: req.user.id });
    res.json(rows.map(shapePainting));
  });

  app.get('/api/me/liked', requireUser, (req, res) => {
    const guides = db
      .prepare("SELECT target_id FROM likes WHERE user_id = ? AND target_type = 'guide' ORDER BY created_at DESC")
      .all(req.user.id)
      .map((r) => content.getGuide(r.target_id, req.user))
      .filter(Boolean)
      .map(toSummary);
    const paintings = db
      .prepare(
        `${paintingSelect}
         WHERE (${publicFilter} OR p.user_id = :viewer)
           AND p.id IN (SELECT CAST(target_id AS INTEGER) FROM likes WHERE user_id = :viewer AND target_type = 'painting')
         GROUP BY p.id ORDER BY p.id DESC`,
      )
      .all({ viewer: req.user.id });
    res.json({ guides, paintings: paintings.map(shapePainting) });
  });

  app.get('/api/me/planned', requireUser, (req, res) => {
    const rows = db.prepare('SELECT guide_id FROM plans WHERE user_id = ? ORDER BY created_at').all(req.user.id);
    res.json(rows.map((r) => content.getGuide(r.guide_id, req.user)).filter(Boolean).map(toSummary));
  });

  app.get('/api/me/ai-guides', requireUser, (req, res) => {
    const rows = db.prepare('SELECT id FROM ai_guides WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(rows.map((r) => toSummary(content.getGuide(r.id, req.user))));
  });

  // ---- Frontend ----
  app.use(express.static(PUBLIC_DIR));

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is larger than 10 MB' : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  app.locals.db = db;
  return app;
}
