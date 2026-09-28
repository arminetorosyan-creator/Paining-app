# Paint Practice

A mobile-first web app for people who want to start practising painting on a real canvas.

1. **Discover**: choose a painting style, your level and (optionally) a medium, and get suggestions.
2. **Guide**: each suggestion has a materials checklist, a step-by-step guide with saved progress, and tips.
3. **AI guides** (optional): generate a new guide for your own idea with Claude. It stays private to you until an admin reviews and publishes it.
4. **Upload**: photograph your finished canvas and upload it as **private** (only on your page) or **public** (in the gallery).
5. **Gallery**: everyone can browse public paintings, rate them 1–5 stars, like, report or block the painter.
6. **My page**: *Created*, *Liked*, *Planned next*, *My AI guides* and *Settings* (level, password, blocked users, log out, delete account).

## Accounts and security

- Username + password (min. 8 characters). Passwords are hashed with scrypt, and sessions use an HttpOnly cookie (Secure in production).
- Login is rate-limited (10 failed attempts per 15 minutes per username and IP), and cross-site requests are blocked.
- Private and hidden paintings, including their image files, are only served to their owner (and admins).
- Uploaded files must really be JPEG, PNG or WebP images (checked by content, not just the name). Maximum 10 MB.
- Users can change their password and permanently delete their account and all their data.
- **Not yet available:** email verification and self-service password reset (no email service). Admins can issue a temporary password with `npm run reset-password -- <username>`.

## Moderation

- Anyone can **report** a public painting with a reason. When `REPORT_HIDE_THRESHOLD` (default 3) people report it, it's hidden until an admin reviews it.
- Users can **block** another user, which hides that user's paintings from their gallery.
- Admins (`npm run make-admin -- <username>`) get a **review queue**: keep visible, hide or delete reported paintings, and publish or delete AI guides.

## Run locally

Requires **Node.js 22.13 or newer** (uses the built-in `node:sqlite` module).

```bash
npm install
npm start          # http://localhost:3000
npm test           # API tests
```

To enable AI guides locally, start with an Anthropic API key: `ANTHROPIC_API_KEY=sk-ant-... npm start`.
All settings are listed in [`.env.example`](.env.example).

To try it on your phone, run it on your computer and open `http://<your-computer-ip>:3000` on a phone on the same Wi-Fi.

## Going live

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Docker image, hosting options, admin setup, backups and scaling limits.
Before launch, have a painter check the guides with [docs/CONTENT_REVIEW.md](docs/CONTENT_REVIEW.md).

## Project structure

```
server/
  index.js            start the server
  app.js              HTTP API (auth, guides, paintings, gallery, moderation, admin)
  auth.js             passwords, sessions, rate limiting
  db.js               SQLite schema
  content/guides.js   curated styles, levels, mediums and guides
  content/index.js    suggestions from curated + AI guides
  content/ai.js       AI guide generation (Claude API)
scripts/              make-admin, reset-password
public/               frontend (plain HTML/CSS/JS, no build step)
test/api.test.js      API tests
docs/                 deployment guide, content review checklist
```
