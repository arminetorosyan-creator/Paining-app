# Paint Practice

A mobile-first web app for people who want to start practising painting on a real canvas.

1. **Discover**: choose a painting style, your level and (optionally) a medium, and get suggestions.
2. **Guide**: each suggestion has a materials checklist, a step-by-step guide with saved progress, and tips.
3. **Upload**: photograph your finished canvas and upload it as **private** (only on your page) or **public** (in the gallery).
4. **Gallery**: everyone can browse public paintings, rate them 1–5 stars and like them. You can't rate your own work.
5. **My page**: *Created* (your paintings, private and public), *Liked* (guides and paintings) and *Planned next* (guides saved for later; removed automatically once you upload a painting for that guide).

## MVP scope and known limitations

| Area | MVP behaviour | Needed before a real launch |
|---|---|---|
| Accounts | **Profile picker, no password.** Anyone can select any profile, so "private" is not truly private. | Username/password (or social) login, password reset, account deletion |
| Content | Curated library of 15 guides (5 styles × 3 levels) in `server/content/guides.js` | AI-generated guides (hybrid model) plugged in via `server/content/index.js`; more curated guides |
| Moderation | None | Report/block/hide for public images (required by app stores for user-generated content) |
| Storage | SQLite file + images on local disk (`data/`) | Managed database and object storage (e.g. S3) for hosting |

## Run locally

Requires **Node.js 22.13 or newer** (uses the built-in `node:sqlite` module).

```bash
npm install
npm start          # http://localhost:3000
npm test           # API tests
```

Environment variables (optional): `PORT` (default 3000), `DB_PATH` (default `data/app.db`), `UPLOAD_DIR` (default `data/uploads`).

To try it on your phone, run it on your computer and open `http://<your-computer-ip>:3000` on a phone on the same Wi-Fi.

## Project structure

```
server/
  index.js            start the server
  app.js              HTTP API (profiles, guides, paintings, gallery, ratings)
  db.js               SQLite schema
  content/guides.js   curated styles, levels, mediums and guides
  content/index.js    suggestion logic; the place to add an AI content source
public/               frontend (plain HTML/CSS/JS, no build step)
test/api.test.js      API tests
```
