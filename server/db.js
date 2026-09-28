import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- "name" is the username.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  level         TEXT NOT NULL DEFAULT 'beginner',
  password_hash TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Login sessions. Only a SHA-256 hash of the cookie token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paintings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  style       TEXT NOT NULL,
  guide_id    TEXT,
  image_file  TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  -- Moderation state, independent of the owner's visibility choice.
  moderation  TEXT NOT NULL DEFAULT 'visible' CHECK (moderation IN ('visible', 'hidden')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  painting_id INTEGER NOT NULL REFERENCES paintings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars       INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (painting_id, user_id)
);

-- "Liked" covers both guides and other users' paintings.
CREATE TABLE IF NOT EXISTS likes (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('guide', 'painting')),
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id)
);

-- "Planned next": guides the user wants to paint later.
CREATE TABLE IF NOT EXISTS plans (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_id    TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, guide_id)
);

-- Which steps of a guide the user has ticked off (JSON array of step indexes).
CREATE TABLE IF NOT EXISTS progress (
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guide_id    TEXT NOT NULL,
  steps_done  TEXT NOT NULL DEFAULT '[]',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, guide_id)
);

-- User reports on public paintings.
CREATE TABLE IF NOT EXISTS reports (
  painting_id INTEGER NOT NULL REFERENCES paintings(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT NOT NULL DEFAULT '',
  resolved    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (painting_id, user_id)
);

-- A user hides everything from users they block.
CREATE TABLE IF NOT EXISTS blocks (
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, blocked_user_id)
);

-- AI-generated guides. Private to their creator until an admin publishes them.
CREATE TABLE IF NOT EXISTS ai_guides (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  data        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'private' CHECK (status IN ('private', 'published')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Columns added after the first MVP release; applied to older databases.
const ADDED_COLUMNS = [
  ['users', 'password_hash', 'TEXT'],
  ['users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0'],
  ['paintings', 'moderation', "TEXT NOT NULL DEFAULT 'visible'"],
];

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  for (const [table, column, type] of ADDED_COLUMNS) {
    const exists = db.prepare(`SELECT 1 FROM pragma_table_info('${table}') WHERE name = ?`).get(column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
  return db;
}
