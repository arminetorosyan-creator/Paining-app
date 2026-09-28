# Putting Paint Practice online

The app is one Node.js process that keeps its **database (SQLite) and uploaded photos on disk** in `/app/data`.
Whatever host you choose must therefore offer a **persistent volume**. Without one, every redeploy wipes all
accounts and paintings.

## Choose a host

All three below run the included `Dockerfile` and offer persistent volumes. Prices are from search results
(September 2026), not from the providers' pages directly. **Check the current pricing page before you sign up.**

| Host | Volume storage | Notes |
|---|---|---|
| [Railway](https://railway.com/pricing) | ~$0.15 / GB / month ([docs](https://docs.railway.com/volumes/reference)) | Simple dashboard; volumes on paid plans |
| [Fly.io](https://fly.io/docs/about/pricing/) | ~$0.15 / GB / month; snapshots extra | Volume is tied to one machine in one region |
| [Render](https://render.com/pricing) | ~$0.25 / GB / month ([docs](https://render.com/docs/disks)) | Disks need a paid instance, not the free tier |

Recommendation for a first launch: **Railway or Render**. They are the easiest to set up from a GitHub repository
without a command line. Start with a 1 GB volume. At ~2–4 MB per phone photo, that holds roughly 250–500 paintings.

## Steps (any host)

1. Create a new service from the GitHub repository `arminetorosyan-creator/Paining-app` using the **Dockerfile**.
2. Add a persistent volume mounted at **`/app/data`**.
3. Set environment variables (see `.env.example`):
   - `NODE_ENV=production` (required: turns on secure cookies, so the site must be served over HTTPS)
   - `TRUST_PROXY=1` (required behind the host's load balancer, so rate limits see real visitor IPs)
   - `CONTACT_EMAIL=…` (shown to users for support and password help)
   - `ANTHROPIC_API_KEY=…` (optional, enables AI guides)
4. Run **one instance only** (see limitations below). Health check path: `/healthz`.
5. Deploy, open the site, and register your own account.
6. In the host's shell/console, make yourself an admin:
   ```bash
   npm run make-admin -- <your-username>
   ```

## Operating it

- **Admin review queue:** My page → "Admin: review queue". Reported paintings, and AI guides waiting to be published.
- **Forgotten passwords:** there is no email reset yet. Verify the person, then run
  `npm run reset-password -- <username>` in the host's shell and send them the temporary password privately.
- **Backups:** copy `/app/data` regularly (volume snapshots if the host offers them). SQLite runs in WAL mode.
  For a consistent copy, stop the app first or use `sqlite3 app.db ".backup backup.db"`.

## Limitations to know before scaling

- **Single instance only.** SQLite, the photo folder and the login rate limiter all live on one machine.
  Running two instances would split the data. To scale, move to PostgreSQL plus object storage (e.g. S3), and a
  shared rate limiter.
- **No automatic image moderation.** Only user reports and admin review. For a larger audience, consider an
  automated image-screening service.
- **No email.** So there's no email verification and no self-service password reset.
- **AI cost control:** `AI_DAILY_LIMIT` caps guides per user per day (default 3). Each guide is one Claude API call.
  Set a monthly spend limit in the Anthropic Console as a backstop.
