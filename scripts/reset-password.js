// Sets a temporary password for a user who forgot theirs and logs out their sessions.
// Usage: npm run reset-password -- <username>
// Give the printed password to the user privately and ask them to change it in Settings.
import { randomBytes } from 'node:crypto';

import { hashPassword } from '../server/auth.js';
import { openDb } from '../server/db.js';

const [username] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run reset-password -- <username>');
  process.exit(1);
}
const db = openDb(process.env.DB_PATH || 'data/app.db');
const user = db.prepare('SELECT id, name FROM users WHERE name = ?').get(username);
if (!user) {
  console.error(`No user named "${username}".`);
  process.exit(1);
}
const temporary = randomBytes(9).toString('base64url');
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await hashPassword(temporary), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
console.log(`Temporary password for ${user.name}: ${temporary}`);
