import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync, unlink } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getGuide, getMeta, isStyle, suggest, toSummary } from './content/index.js';
import { openDb } from './db.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const LEVEL_IDS = getMeta().levels.map((l) => l.id);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createApp({ dbPath = 'data/app.db', uploadDir = 'data/uploads' } = {}) {
  const db = openDb(dbPath);
  const uploadsPath = resolve(uploadDir);
  mkdirSync(uploadsPath, { recursive: true });

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
  app.use(express.json());

  // ---- Identity (MVP stand-in for authentication) ----
  // The client sends the chosen profile id in X-User-Id. There is no password:
  // this is NOT secure and must be replaced by real authentication before launch.
  app.use('/api', (req, _res, next) => {
    const raw = req.get('X-User-Id');
    req.user = raw ? db.prepare('SELECT * FROM users WHERE id = ?').get(Number(raw)) ?? null : null;
    next();
  });

  const requireUser = (req, _res, next) =>
    req.user ? next() : next(new HttpError(401, 'Choose a profile first'));

  // ---- Profiles ----
  app.get('/api/users', (_req, res) => {
    res.json(db.prepare('SELECT id, name, level FROM users ORDER BY name').all());
  });

  app.post('/api/users', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const level = req.body?.level ?? 'beginner';
    if (name.length < 2 || name.length > 30) throw new HttpError(400, 'Name must be 2–30 characters');
    if (!LEVEL_IDS.includes(level)) throw new HttpError(400, 'Unknown level');
    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) {
      throw new HttpError(409, 'That name is taken');
    }
    const { lastInsertRowid } = db.prepare('INSERT INTO users (name, level) VALUES (?, ?)').run(name, level);
    res.status(201).json(db.prepare('SELECT id, name, level FROM users WHERE id = ?').get(lastInsertRowid));
  });

  app.patch('/api/me', requireUser, (req, res) => {
    const { level } = req.body ?? {};
    if (!LEVEL_IDS.includes(level)) throw new HttpError(400, 'Unknown level');
    db.prepare('UPDATE users SET level = ? WHERE id = ?').run(level, req.user.id);
    res.json({ ...req.user, level });
  });

  // ---- Content ----
  app.get('/api/meta', (_req, res) => res.json(getMeta()));

  app.get('/api/suggestions', (req, res) => {
    const { style, level, medium } = req.query;
    res.json(suggest({ style, level, medium }));
  });

  app.get('/api/guides/:id', (req, res) => {
    const guide = getGuide(req.params.id);
    if (!guide) throw new HttpError(404, 'Guide not found');
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
      .prepare("SELECT COUNT(*) AS n FROM paintings WHERE guide_id = ? AND visibility = 'public'")
      .get(guide.id).n;
    res.json({ ...guide, user, publicPaintings });
  });

  const guideOr404 = (id) => {
    const guide = getGuide(id);
    if (!guide) throw new HttpError(404, 'Guide not found');
    return guide;
  };

  app.put('/api/guides/:id/like', requireUser, (req, res) => {
    const g = guideOr404(req.params.id);
    db.prepare("INSERT OR IGNORE INTO likes (user_id, target_type, target_id) VALUES (?, 'guide', ?)").run(req.user.id, g.id);
    res.json({ liked: true });
  });
  app.delete('/api/guides/:id/like', requireUser, (req, res) => {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND target_type = 'guide' AND target_id = ?").run(req.user.id, req.params.id);
    res.json({ liked: false });
  });

  app.put('/api/guides/:id/plan', requireUser, (req, res) => {
    const g = guideOr404(req.params.id);
    db.prepare('INSERT OR IGNORE INTO plans (user_id, guide_id) VALUES (?, ?)').run(req.user.id, g.id);
    res.json({ planned: true });
  });
  app.delete('/api/guides/:id/plan', requireUser, (req, res) => {
    db.prepare('DELETE FROM plans WHERE user_id = ? AND guide_id = ?').run(req.user.id, req.params.id);
    res.json({ planned: false });
  });

  app.put('/api/guides/:id/progress', requireUser, (req, res) => {
    const g = guideOr404(req.params.id);
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
           p.guide_id AS guideId, p.visibility, p.created_at AS createdAt,
           ROUND(AVG(r.stars), 1) AS avgRating, COUNT(r.stars) AS ratingCount,
           (SELECT stars FROM ratings WHERE painting_id = p.id AND user_id = :viewer) AS myRating,
           EXISTS (SELECT 1 FROM likes WHERE user_id = :viewer AND target_type = 'painting' AND target_id = CAST(p.id AS TEXT)) AS liked
    FROM paintings p
    JOIN users u ON u.id = p.user_id
    LEFT JOIN ratings r ON r.painting_id = p.id`;

  const shapePainting = (row) => ({
    ...row,
    liked: !!row.liked,
    guideTitle: row.guideId ? getGuide(row.guideId)?.title ?? null : null,
    imageUrl: `/api/paintings/${row.id}/image`,
  });

  const viewerId = (req) => req.user?.id ?? 0;

  // Loads a painting the viewer is allowed to see: public ones, or their own.
  const visiblePainting = (req, id) => {
    const row = db.prepare(`${paintingSelect} WHERE p.id = :id GROUP BY p.id`).get({ viewer: viewerId(req), id: Number(id) });
    if (!row || (row.visibility !== 'public' && row.userId !== req.user?.id)) {
      throw new HttpError(404, 'Painting not found');
    }
    return row;
  };

  const ownPainting = (req, id) => {
    const row = db.prepare('SELECT * FROM paintings WHERE id = ?').get(Number(id));
    if (!row || row.user_id !== req.user.id) throw new HttpError(404, 'Painting not found');
    return row;
  };

  app.post('/api/paintings', requireUser, upload.single('image'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a photo of your painting');
    const discard = () => unlink(req.file.path, () => {});
    try {
      const title = String(req.body.title ?? '').trim();
      const description = String(req.body.description ?? '').trim().slice(0, 1000);
      const visibility = req.body.visibility === 'public' ? 'public' : 'private';
      const guideId = req.body.guideId || null;
      const guide = guideId ? getGuide(guideId) : null;
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
      discard();
      throw err;
    }
  });

  app.get('/api/gallery', (req, res) => {
    const { style, sort } = req.query;
    const order = sort === 'top' ? 'avgRating IS NULL, avgRating DESC, ratingCount DESC, p.id DESC' : 'p.id DESC';
    const rows = db
      .prepare(
        `${paintingSelect}
         WHERE p.visibility = 'public' AND (:style IS NULL OR p.style = :style)
         GROUP BY p.id ORDER BY ${order} LIMIT 200`,
      )
      .all({ viewer: viewerId(req), style: style || null });
    res.json(rows.map(shapePainting));
  });

  app.get('/api/paintings/:id', (req, res) => {
    res.json(shapePainting(visiblePainting(req, req.params.id)));
  });

  // Images go through an access check so private paintings stay private.
  app.get('/api/paintings/:id/image', (req, res) => {
    const row = db.prepare('SELECT user_id, visibility, image_file FROM paintings WHERE id = ?').get(Number(req.params.id));
    // <img> tags can't send headers, so the owner's id may also come as ?as=<id>.
    const viewer = req.user?.id ?? Number(req.query.as);
    if (!row || (row.visibility !== 'public' && row.user_id !== viewer)) throw new HttpError(404, 'Not found');
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
    const row = ownPainting(req, req.params.id);
    db.prepare("DELETE FROM likes WHERE target_type = 'painting' AND target_id = ?").run(String(row.id));
    db.prepare('DELETE FROM paintings WHERE id = ?').run(row.id);
    unlink(join(uploadsPath, row.image_file), () => {});
    res.status(204).end();
  });

  app.put('/api/paintings/:id/rating', requireUser, (req, res) => {
    const p = visiblePainting(req, req.params.id);
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

  // ---- "My page" ----
  app.get('/api/me/paintings', requireUser, (req, res) => {
    const rows = db
      .prepare(`${paintingSelect} WHERE p.user_id = :viewer GROUP BY p.id ORDER BY p.id DESC`)
      .all({ viewer: req.user.id });
    res.json(rows.map(shapePainting));
  });

  app.get('/api/me/liked', requireUser, (req, res) => {
    const guideIds = db
      .prepare("SELECT target_id FROM likes WHERE user_id = ? AND target_type = 'guide' ORDER BY created_at DESC")
      .all(req.user.id)
      .map((r) => r.target_id);
    const paintings = db
      .prepare(
        `${paintingSelect}
         WHERE (p.visibility = 'public' OR p.user_id = :viewer)
           AND p.id IN (SELECT CAST(target_id AS INTEGER) FROM likes WHERE user_id = :viewer AND target_type = 'painting')
         GROUP BY p.id ORDER BY p.id DESC`,
      )
      .all({ viewer: req.user.id });
    res.json({
      guides: guideIds.map(getGuide).filter(Boolean).map(toSummary),
      paintings: paintings.map(shapePainting),
    });
  });

  app.get('/api/me/planned', requireUser, (req, res) => {
    const rows = db.prepare('SELECT guide_id FROM plans WHERE user_id = ? ORDER BY created_at').all(req.user.id);
    res.json(rows.map((r) => getGuide(r.guide_id)).filter(Boolean).map(toSummary));
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
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  app.locals.db = db;
  return app;
}
