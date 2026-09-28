// Grants or removes admin rights (moderation + AI guide review).
// Usage: npm run make-admin -- <username> [--remove]
import { openDb } from '../server/db.js';

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm run make-admin -- <username> [--remove]');
  process.exit(1);
}
const db = openDb(process.env.DB_PATH || 'data/app.db');
const isAdmin = flag === '--remove' ? 0 : 1;
const { changes } = db.prepare('UPDATE users SET is_admin = ? WHERE name = ?').run(isAdmin, username);
if (!changes) {
  console.error(`No user named "${username}". They must register in the app first.`);
  process.exit(1);
}
console.log(`${username} is ${isAdmin ? 'now an admin' : 'no longer an admin'}.`);
