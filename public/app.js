// Paint Practice — single-page frontend (no build step).

const view = document.getElementById('view');
const accountChip = document.getElementById('account-chip');
const dialog = document.getElementById('dialog');

const state = { meta: null, user: null };

// ---------- Helpers ----------

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = body ? { 'Content-Type': 'application/json' } : {};
  const res = await fetch(path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) {
      setUser(null);
      goToLogin();
    }
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

const byId = (list, id) => list.find((x) => x.id === id);
const styleName = (id) => byId(state.meta.styles, id)?.name ?? id;
const levelName = (id) => byId(state.meta.levels, id)?.name ?? id;
const mediumName = (id) => byId(state.meta.mediums, id)?.name ?? id;

const formatDuration = (min) => (min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`);
const starsText = (avg) => '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
const emptyState = (text, cta = '') => `<div class="empty"><p>${text}</p>${cta}</div>`;
const options = (list, selected) =>
  list.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');

function setUser(user) {
  state.user = user;
  accountChip.hidden = false;
  accountChip.textContent = user ? `👤 ${user.username}` : 'Log in';
}

function goToLogin() {
  const here = location.hash || '#/';
  if (!here.startsWith('#/login') && !here.startsWith('#/register')) {
    location.hash = `#/login?next=${encodeURIComponent(here)}`;
  }
}

function requireLogin() {
  if (state.user) return true;
  goToLogin();
  return false;
}

accountChip.onclick = () => { location.hash = state.user ? '#/me' : '#/login'; };

// Shows a modal dialog; resolves with the submitted FormData or null if cancelled.
function openDialog(html) {
  dialog.innerHTML = `<form method="dialog">${html}</form>`;
  dialog.showModal();
  return new Promise((resolve) => {
    const form = dialog.querySelector('form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const data = new FormData(form);
      dialog.close();
      resolve(data);
    };
    form.querySelector('[data-cancel]')?.addEventListener('click', () => { dialog.close(); resolve(null); });
    dialog.onclose = () => resolve(null);
  });
}

// ---------- Shared renderers ----------

function aiBadge(g) {
  if (g.source !== 'ai') return '';
  return g.status === 'published'
    ? '<span class="tag ai">✨ AI · reviewed</span>'
    : '<span class="tag ai">✨ AI draft · not reviewed</span>';
}

function guideCard(g) {
  return `<a class="card" href="#/guide/${esc(g.id)}"><div class="card-body">
    <h3>${esc(g.title)}</h3>
    <p class="hint">${esc(g.summary)}</p>
    <div class="meta">
      ${aiBadge(g)}
      <span class="tag">${esc(styleName(g.style))}</span>
      <span class="tag">${esc(levelName(g.level))}</span>
      <span class="tag">${esc(mediumName(g.medium))}</span>
      <span class="tag">⏱ ${esc(formatDuration(g.durationMinutes))}</span>
    </div></div></a>`;
}

function paintingCard(p, { showAuthor = true } = {}) {
  return `<a class="card" href="#/painting/${p.id}">
    <img class="thumb" src="${esc(p.imageUrl)}" alt="${esc(p.title)}" loading="lazy">
    <div class="card-body">
      <h3>${esc(p.title)}</h3>
      ${showAuthor ? `<p class="hint">by ${esc(p.author)}</p>` : ''}
      <div class="meta">
        <span class="tag">${esc(styleName(p.style))}</span>
        ${p.visibility === 'private' ? '<span class="tag private">🔒 Private</span>' : '<span class="tag">🌍 Public</span>'}
        ${p.moderation === 'hidden' ? '<span class="tag private">⚠️ Hidden</span>' : ''}
        ${p.ratingCount ? `<span class="tag"><span class="stars">★</span> ${p.avgRating} (${p.ratingCount})</span>` : ''}
      </div></div></a>`;
}

// ---------- Login & sign-up ----------

function authView(mode, params) {
  const next = params.get('next') || '#/';
  if (state.user) { location.hash = next; return; }
  const isLogin = mode === 'login';
  view.innerHTML = `
    <div class="narrow">
      <h1>${isLogin ? 'Welcome back' : 'Create your account'}</h1>
      <p class="hint">${isLogin ? 'Log in to see your paintings, likes and plans.' : 'Save your progress, upload paintings and share them in the gallery.'}</p>
      <form id="auth">
        <label for="a-user">Username</label>
        <input id="a-user" name="username" type="text" required minlength="3" maxlength="30"
          pattern="[A-Za-z0-9._\\-]+" autocomplete="username" autocapitalize="none" spellcheck="false">
        ${isLogin ? '' : '<p class="hint">3–30 letters, numbers, dots, dashes or underscores. Shown next to your public paintings.</p>'}
        <label for="a-pass">Password</label>
        <input id="a-pass" name="password" type="password" required ${isLogin ? '' : 'minlength="8"'} maxlength="128"
          autocomplete="${isLogin ? 'current-password' : 'new-password'}">
        ${isLogin ? '' : `<p class="hint">At least 8 characters. A short sentence is easy to remember and hard to guess.</p>
          <label for="a-level">Your painting level</label>
          <select id="a-level" name="level">${options(state.meta.levels, 'beginner')}</select>`}
        <div class="btn-row"><button class="btn primary" type="submit">${isLogin ? 'Log in' : 'Create account'}</button></div>
      </form>
      <p>${isLogin
    ? `New here? <a href="#/register?next=${encodeURIComponent(next)}">Create an account</a>`
    : `Already have an account? <a href="#/login?next=${encodeURIComponent(next)}">Log in</a>`}</p>
      ${isLogin ? `<p class="hint">Forgot your password? Automatic reset isn’t available yet — ${state.meta.contactEmail
    ? `email <a href="mailto:${esc(state.meta.contactEmail)}">${esc(state.meta.contactEmail)}</a>` : 'please contact support'}.</p>` : ''}
    </div>`;

  view.querySelector('#auth').onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      setUser(await api(`/api/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: fd }));
      toast(isLogin ? `Welcome back, ${state.user.username}!` : `Welcome, ${state.user.username}!`);
      location.hash = next;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };
}

// ---------- Discover ----------

async function discoverView(params) {
  const style = params.get('style') ?? '';
  const level = params.get('level') ?? state.user?.level ?? 'beginner';
  const medium = params.get('medium') ?? '';
  const { styles, levels, mediums } = state.meta;

  view.innerHTML = `
    <h1>What will you paint today?</h1>
    <p class="hint">Choose a style and your level. We'll suggest a subject, the materials you need and a step-by-step guide for a real canvas.</p>
    <form id="discover">
      <label>1. Painting style</label>
      <div class="options">
        ${styles.map((s) => `<label class="option"><input type="radio" name="style" value="${esc(s.id)}" ${s.id === style ? 'checked' : ''} required>
          <strong>${esc(s.name)}</strong><small>${esc(s.blurb)}</small></label>`).join('')}
      </div>
      <label>2. Your level</label>
      <div class="segmented">
        ${levels.map((l) => `<label class="option"><input type="radio" name="level" value="${esc(l.id)}" ${l.id === level ? 'checked' : ''}>${esc(l.name)}</label>`).join('')}
      </div>
      <label>3. Medium <span class="hint">(optional)</span></label>
      <div class="segmented">
        <label class="option"><input type="radio" name="medium" value="" ${!medium ? 'checked' : ''}>Any</label>
        ${mediums.map((m) => `<label class="option"><input type="radio" name="medium" value="${esc(m.id)}" ${m.id === medium ? 'checked' : ''}>${esc(m.name)}</label>`).join('')}
      </div>
      <div class="btn-row"><button class="btn primary" type="submit">Get suggestions</button></div>
    </form>
    <section id="results" aria-live="polite"></section>`;

  view.querySelector('#discover').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const q = new URLSearchParams({ style: fd.get('style'), level: fd.get('level') });
    if (fd.get('medium')) q.set('medium', fd.get('medium'));
    location.hash = `#/?${q}`;
  };

  if (!style) return;
  const q = new URLSearchParams({ style, level });
  if (medium) q.set('medium', medium);
  const { guides, fallback } = await api(`/api/suggestions?${q}`);
  const results = view.querySelector('#results');
  results.innerHTML = `
    <h2>Suggestions for you</h2>
    ${fallback ? `<p class="notice">No ${esc(levelName(level))} guides match exactly yet, so here are the closest levels.</p>` : ''}
    ${guides.length ? `<div class="grid">${guides.map(guideCard).join('')}</div>`
    : emptyState('No guides for this combination yet. Try “Any” medium.')}
    ${state.meta.aiEnabled ? aiGenerateForm(style, level, medium) : ''}`;
  bindAiGenerate(results);
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function aiGenerateForm(style, level, medium) {
  return `
    <section class="card ai-box"><div class="card-body">
      <h2 style="margin-top:0">✨ Want something different?</h2>
      <p class="hint">Create a new ${esc(styleName(style))} guide with AI. It stays private to you until our team reviews it.
        Limit: ${state.meta.aiDailyLimit} per day.</p>
      ${state.user ? `
      <form id="ai-generate">
        <input type="hidden" name="style" value="${esc(style)}">
        <input type="hidden" name="level" value="${esc(level)}">
        <label for="ai-medium">Medium</label>
        <select id="ai-medium" name="medium">${options(state.meta.mediums, medium || 'acrylic')}</select>
        <label for="ai-idea">Your idea <span class="hint">(optional)</span></label>
        <input id="ai-idea" name="idea" type="text" maxlength="200" placeholder="e.g. my cat sleeping on a windowsill">
        <div class="btn-row"><button class="btn primary" type="submit">Create guide</button></div>
      </form>` : '<a class="btn" href="#/login">Log in to create a guide</a>'}
    </div></section>`;
}

function bindAiGenerate(root) {
  const form = root.querySelector('#ai-generate');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creating your guide… (up to a minute)';
    try {
      const guide = await api('/api/guides/generate', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      toast('Your guide is ready!');
      location.hash = `#/guide/${guide.id}`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = 'Create guide';
    }
  };
}

// ---------- Guide ----------

async function guideView(id) {
  const g = await api(`/api/guides/${encodeURIComponent(id)}`);
  const done = new Set(g.user.stepsDone);

  const render = () => {
    const pct = Math.round((done.size / g.steps.length) * 100);
    view.innerHTML = `
      <p><a href="#/?style=${esc(g.style)}&level=${esc(g.level)}">← More ${esc(styleName(g.style))} ideas</a></p>
      <h1>${esc(g.title)}</h1>
      <p>${esc(g.summary)}</p>
      ${g.source === 'ai' && g.status !== 'published'
    ? '<p class="notice">✨ This guide was created by AI for you and hasn’t been reviewed by our team yet. Use your judgement, especially with solvents and materials.</p>' : ''}
      <div class="meta">
        ${aiBadge(g)}
        <span class="tag">${esc(styleName(g.style))}</span>
        <span class="tag">${esc(levelName(g.level))}</span>
        <span class="tag">${esc(mediumName(g.medium))}</span>
        <span class="tag">⏱ ~${esc(formatDuration(g.durationMinutes))}</span>
        <span class="tag">🖼 ${esc(g.canvas)}</span>
        ${g.publicPaintings ? `<span class="tag">${g.publicPaintings} shared painting${g.publicPaintings > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn ${g.user.liked ? 'active' : ''}" type="button" data-toggle="like">${g.user.liked ? '♥ Liked' : '♡ Like'}</button>
        <button class="btn ${g.user.planned ? 'active' : ''}" type="button" data-toggle="plan">${g.user.planned ? '✓ Planned' : '＋ Plan to paint'}</button>
        <a class="btn primary" href="#/upload?guide=${esc(g.id)}">📷 Upload my painting</a>
      </div>
      <div class="guide-layout">
        <section>
          <h2>Materials</h2>
          <ul class="checklist">
            ${g.materials.map((m, i) => `<li><input type="checkbox" id="m${i}"><label for="m${i}" style="margin:0;font-weight:400">${esc(m)}</label></li>`).join('')}
          </ul>
          ${g.tips?.length ? `<h2>Tips</h2><ul>${g.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        </section>
        <section>
          <h2>Step by step</h2>
          <div class="progress" aria-hidden="true"><div style="width:${pct}%"></div></div>
          <p class="hint">${done.size} of ${g.steps.length} steps done${state.user ? '' : ' · <a href="#/login">log in</a> to save progress'}</p>
          <ol class="checklist steps">
            ${g.steps.map((s, i) => `<li class="${done.has(i) ? 'done' : ''}">
              <span class="num">${i + 1}</span>
              <div class="step-text" style="flex:1"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>
              <input type="checkbox" data-step="${i}" ${done.has(i) ? 'checked' : ''} aria-label="Mark step ${i + 1} done">
            </li>`).join('')}
          </ol>
          ${done.size === g.steps.length ? `<p class="notice">🎉 All steps done! <a href="#/upload?guide=${esc(g.id)}">Upload a photo of your painting.</a></p>` : ''}
        </section>
      </div>`;
  };
  render();

  view.onchange = async (e) => {
    const step = e.target.dataset?.step;
    if (step === undefined) return;
    e.target.checked ? done.add(Number(step)) : done.delete(Number(step));
    render();
    if (state.user) {
      try { await api(`/api/guides/${g.id}/progress`, { method: 'PUT', body: { stepsDone: [...done] } }); } catch (err) { toast(err.message); }
    }
  };
  view.onclick = async (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn || !requireLogin()) return;
    const kind = btn.dataset.toggle;
    const key = kind === 'like' ? 'liked' : 'planned';
    try {
      const res = await api(`/api/guides/${g.id}/${kind}`, { method: g.user[key] ? 'DELETE' : 'PUT' });
      g.user[key] = res[key];
      toast(kind === 'like' ? (res.liked ? 'Added to your likes' : 'Removed from likes') : (res.planned ? 'Added to “Planned next”' : 'Removed from plan'));
      render();
    } catch (err) { toast(err.message); }
  };
}

// ---------- Upload ----------

async function uploadView(params) {
  if (!requireLogin()) return;
  const guideId = params.get('guide');
  const guide = guideId ? await api(`/api/guides/${encodeURIComponent(guideId)}`).catch(() => null) : null;

  view.innerHTML = `
    <h1>Upload your painting</h1>
    ${guide ? `<p class="hint">Painted with the guide <a href="#/guide/${esc(guide.id)}">${esc(guide.title)}</a>.</p>` : ''}
    <form id="upload">
      <label for="u-image">Photo of your painting</label>
      <input id="u-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" required>
      <p class="hint">Tip: photograph in daylight, straight on, without flash. JPEG, PNG or WebP up to 10 MB.</p>
      <img id="u-preview" class="preview" alt="" hidden>

      <label for="u-title">Title</label>
      <input id="u-title" name="title" type="text" maxlength="80" required value="${esc(guide?.title ?? '')}">

      <label for="u-desc">Notes <span class="hint">(optional)</span></label>
      <textarea id="u-desc" name="description" maxlength="1000" placeholder="What went well? What would you try differently?"></textarea>

      ${guide ? `<input type="hidden" name="guideId" value="${esc(guide.id)}">` : `
        <label for="u-style">Style</label>
        <select id="u-style" name="style" required>
          <option value="">Choose…</option>${options(state.meta.styles)}
        </select>`}

      <label>Who can see it?</label>
      <div class="options">
        <label class="option"><input type="radio" name="visibility" value="private" checked>
          <strong>🔒 Private</strong><small>Only on your page.</small></label>
        <label class="option"><input type="radio" name="visibility" value="public">
          <strong>🌍 Public</strong><small>In the gallery, where others can rate it.</small></label>
      </div>
      <p class="hint">Only upload photos of your own work. Public paintings that break the rules can be reported and removed.</p>
      <div class="btn-row"><button class="btn primary" type="submit">Save painting</button></div>
    </form>`;

  const input = view.querySelector('#u-image');
  const preview = view.querySelector('#u-preview');
  input.onchange = () => {
    const file = input.files[0];
    if (preview.src) URL.revokeObjectURL(preview.src);
    preview.hidden = !file;
    if (file) preview.src = URL.createObjectURL(file);
  };

  view.querySelector('#upload').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Uploading…';
    try {
      const p = await api('/api/paintings', { method: 'POST', form: new FormData(e.target) });
      toast('Painting saved!');
      location.hash = `#/painting/${p.id}`;
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
      btn.textContent = 'Save painting';
    }
  };
}

// ---------- Gallery ----------

async function galleryView(params) {
  const style = params.get('style') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const q = new URLSearchParams({ sort });
  if (style) q.set('style', style);
  const paintings = await api(`/api/gallery?${q}`);

  view.innerHTML = `
    <h1>Gallery</h1>
    <p class="hint">Public paintings from everyone. Rate the ones you like.</p>
    <div class="btn-row">
      <select id="g-style" aria-label="Filter by style" style="width:auto">
        <option value="">All styles</option>${options(state.meta.styles, style)}
      </select>
      <select id="g-sort" aria-label="Sort" style="width:auto">
        <option value="newest" ${sort === 'newest' ? 'selected' : ''}>Newest</option>
        <option value="top" ${sort === 'top' ? 'selected' : ''}>Top rated</option>
      </select>
    </div>
    ${paintings.length ? `<div class="grid">${paintings.map((p) => paintingCard(p)).join('')}</div>`
    : emptyState('No public paintings yet. Be the first to share one!', '<a class="btn primary" href="#/">Find something to paint</a>')}`;

  view.onchange = () => {
    const nq = new URLSearchParams({ sort: view.querySelector('#g-sort').value });
    const s = view.querySelector('#g-style').value;
    if (s) nq.set('style', s);
    location.hash = `#/gallery?${nq}`;
  };
}

// ---------- Painting ----------

async function paintingView(id) {
  let p = await api(`/api/paintings/${encodeURIComponent(id)}`);
  const isOwner = state.user?.id === p.userId;
  const canInteract = !isOwner && p.visibility === 'public' && p.moderation === 'visible';

  const render = () => {
    view.innerHTML = `
      <img class="painting-full" src="${esc(p.imageUrl)}" alt="${esc(p.title)}">
      <h1 style="margin-top:16px">${esc(p.title)}</h1>
      <p class="hint">by ${esc(p.author)} · ${esc(new Date(p.createdAt.replace(' ', 'T') + 'Z').toLocaleDateString())}</p>
      ${p.moderation === 'hidden' ? `<p class="notice">⚠️ This painting was reported and is hidden from the gallery while our team reviews it.${isOwner ? ' Only you can see it.' : ''}</p>` : ''}
      <div class="meta">
        <span class="tag">${esc(styleName(p.style))}</span>
        ${p.guideId && p.guideTitle ? `<a class="tag" href="#/guide/${esc(p.guideId)}">Guide: ${esc(p.guideTitle)}</a>` : ''}
        ${p.visibility === 'private' ? '<span class="tag private">🔒 Private</span>' : '<span class="tag">🌍 Public</span>'}
      </div>
      ${p.description ? `<p>${esc(p.description)}</p>` : ''}
      <p>${p.ratingCount ? `<span class="stars">${starsText(p.avgRating)}</span> ${p.avgRating} from ${p.ratingCount} rating${p.ratingCount > 1 ? 's' : ''}` : '<span class="hint">No ratings yet</span>'}</p>

      ${isOwner ? `
        <h2>Manage</h2>
        <div class="btn-row">
          <button class="btn" type="button" data-act="visibility">${p.visibility === 'private' ? '🌍 Make public' : '🔒 Make private'}</button>
          <button class="btn danger" type="button" data-act="delete">Delete</button>
        </div>
        <p class="hint">${p.visibility === 'private' ? 'Only you can see this painting.' : 'Everyone can see and rate this painting in the gallery.'}</p>`
    : canInteract ? `
        <h2>Your rating</h2>
        <div class="star-input" role="group" aria-label="Rate this painting">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${(p.myRating ?? 0) >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <div class="btn-row">
          <button class="btn ${p.liked ? 'active' : ''}" type="button" data-act="like">${p.liked ? '♥ Liked' : '♡ Like'}</button>
        </div>
        <div class="btn-row small-actions">
          <button class="link-btn" type="button" data-act="report" ${p.reported ? 'disabled' : ''}>${p.reported ? '⚑ Reported' : '⚑ Report'}</button>
          <button class="link-btn" type="button" data-act="block">🚫 Block ${esc(p.author)}</button>
        </div>` : ''}`;
  };
  render();

  view.onclick = async (e) => {
    const star = e.target.closest('[data-star]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!star && !act) return;
    if (!requireLogin()) return;
    try {
      if (star) {
        p = await api(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: Number(star.dataset.star) } });
        toast('Thanks for rating!');
      } else if (act === 'like') {
        const res = await api(`/api/paintings/${p.id}/like`, { method: p.liked ? 'DELETE' : 'PUT' });
        p.liked = res.liked;
      } else if (act === 'visibility') {
        p = await api(`/api/paintings/${p.id}`, { method: 'PATCH', body: { visibility: p.visibility === 'private' ? 'public' : 'private' } });
        toast(p.visibility === 'public' ? 'Now visible in the gallery' : 'Now private');
      } else if (act === 'delete') {
        if (!confirm('Delete this painting? This cannot be undone.')) return;
        await api(`/api/paintings/${p.id}`, { method: 'DELETE' });
        toast('Painting deleted');
        location.hash = '#/me';
        return;
      } else if (act === 'report') {
        const fd = await openDialog(`
          <h2 style="margin-top:0">Report this painting</h2>
          <p class="hint">Reports are anonymous to the painter. Paintings with several reports are hidden until our team reviews them.</p>
          <div class="report-reasons">
            ${state.meta.reportReasons.map((r, i) => `<label class="option"><input type="radio" name="reason" value="${esc(r.id)}" ${i === 0 ? 'checked' : ''}>${esc(r.name)}</label>`).join('')}
          </div>
          <label for="r-details">Details <span class="hint">(optional)</span></label>
          <textarea id="r-details" name="details" maxlength="500"></textarea>
          <div class="btn-row"><button class="btn primary" type="submit">Send report</button><button class="btn" type="button" data-cancel>Cancel</button></div>`);
        if (!fd) return;
        await api(`/api/paintings/${p.id}/report`, { method: 'POST', body: Object.fromEntries(fd) });
        p.reported = true;
        toast('Thanks — our team will review it.');
      } else if (act === 'block') {
        if (!confirm(`Block ${p.author}? You won't see their paintings in the gallery. You can unblock them from your page.`)) return;
        await api(`/api/users/${p.userId}/block`, { method: 'PUT' });
        toast(`${p.author} is blocked`);
        location.hash = '#/gallery';
        return;
      } else return;
      render();
    } catch (err) {
      if (err.status !== 401) toast(err.message);
    }
  };
}

// ---------- My page ----------

async function meView(params) {
  if (!requireLogin()) return;
  const tab = params.get('tab') ?? 'created';
  const tabs = [['created', 'Created'], ['liked', 'Liked'], ['planned', 'Planned next']];
  if (state.meta.aiEnabled) tabs.push(['ai', 'My AI guides']);
  tabs.push(['settings', 'Settings']);

  view.innerHTML = `
    <h1>${esc(state.user.username)}</h1>
    <p class="hint">${esc(levelName(state.user.level))}${state.user.isAdmin ? ' · <a href="#/admin">Admin: review queue</a>' : ''}</p>
    <nav class="tabs">${tabs.map(([id, label]) => `<a href="#/me?tab=${id}" class="${id === tab ? 'active' : ''}">${label}</a>`).join('')}</nav>
    <section id="me-content"></section>`;
  const content = view.querySelector('#me-content');

  if (tab === 'created') {
    const mine = await api('/api/me/paintings');
    const priv = mine.filter((p) => p.visibility === 'private').length;
    content.innerHTML = mine.length
      ? `<p class="hint">${mine.length} painting${mine.length > 1 ? 's' : ''} · ${priv} private · ${mine.length - priv} public</p>
         <div class="grid">${mine.map((p) => paintingCard(p, { showAuthor: false })).join('')}</div>`
      : emptyState('You haven’t uploaded a painting yet.', '<a class="btn primary" href="#/">Find something to paint</a>');
  } else if (tab === 'liked') {
    const { guides, paintings } = await api('/api/me/liked');
    content.innerHTML = `
      <h2>Guides</h2>
      ${guides.length ? `<div class="grid">${guides.map(guideCard).join('')}</div>` : emptyState('No liked guides yet.')}
      <h2>Paintings</h2>
      ${paintings.length ? `<div class="grid">${paintings.map((p) => paintingCard(p)).join('')}</div>` : emptyState('No liked paintings yet. <a href="#/gallery">Browse the gallery</a>.')}`;
  } else if (tab === 'planned') {
    const planned = await api('/api/me/planned');
    content.innerHTML = planned.length
      ? `<div class="grid">${planned.map(guideCard).join('')}</div>`
      : emptyState('Nothing planned. Tap “Plan to paint” on any guide to save it here.', '<a class="btn primary" href="#/">Discover guides</a>');
  } else if (tab === 'ai') {
    const guides = await api('/api/me/ai-guides');
    content.innerHTML = guides.length
      ? `<div class="grid">${guides.map(guideCard).join('')}</div>`
      : emptyState('You haven’t created any AI guides yet. Pick a style on Discover, then tap “Create guide”.', '<a class="btn primary" href="#/">Discover</a>');
  } else {
    await settingsTab(content);
  }
}

async function settingsTab(content) {
  const blocks = await api('/api/me/blocks');
  content.innerHTML = `
    <label for="s-level" style="margin-top:0">Painting level</label>
    <select id="s-level" style="max-width:240px">${options(state.meta.levels, state.user.level)}</select>

    <h2>Change password</h2>
    <form id="s-password" class="narrow">
      <label for="s-cur">Current password</label>
      <input id="s-cur" name="currentPassword" type="password" required autocomplete="current-password">
      <label for="s-new">New password</label>
      <input id="s-new" name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password">
      <div class="btn-row"><button class="btn" type="submit">Change password</button></div>
    </form>

    <h2>Blocked users</h2>
    ${blocks.length ? `<ul class="checklist">${blocks.map((b) => `<li style="align-items:center"><span style="flex:1">${esc(b.username)}</span>
      <button class="btn" type="button" data-unblock="${b.id}">Unblock</button></li>`).join('')}</ul>` : '<p class="hint">You haven’t blocked anyone.</p>'}

    <h2>Account</h2>
    <div class="btn-row">
      <button class="btn" type="button" id="s-logout">Log out</button>
      <button class="btn danger" type="button" id="s-delete">Delete account</button>
    </div>
    ${state.meta.contactEmail ? `<p class="hint">Questions or problems? Contact <a href="mailto:${esc(state.meta.contactEmail)}">${esc(state.meta.contactEmail)}</a>.</p>` : ''}`;

  content.querySelector('#s-level').onchange = async (e) => {
    try { setUser(await api('/api/me', { method: 'PATCH', body: { level: e.target.value } })); toast('Level updated'); } catch (err) { toast(err.message); }
  };
  content.querySelector('#s-password').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/me/password', { method: 'PUT', body: Object.fromEntries(new FormData(e.target)) });
      e.target.reset();
      toast('Password changed. Other devices were logged out.');
    } catch (err) { toast(err.message); }
  };
  content.onclick = async (e) => {
    const unblock = e.target.closest('[data-unblock]');
    try {
      if (unblock) {
        await api(`/api/users/${unblock.dataset.unblock}/block`, { method: 'DELETE' });
        toast('Unblocked');
        route();
      } else if (e.target.id === 's-logout') {
        await api('/api/auth/logout', { method: 'POST' });
        setUser(null);
        location.hash = '#/';
      } else if (e.target.id === 's-delete') {
        const fd = await openDialog(`
          <h2 style="margin-top:0">Delete your account?</h2>
          <p>This permanently deletes your account, all your paintings and photos, ratings, likes and plans. It cannot be undone.</p>
          <label for="d-pass">Enter your password to confirm</label>
          <input id="d-pass" name="password" type="password" required autocomplete="current-password">
          <div class="btn-row"><button class="btn danger" type="submit">Delete everything</button><button class="btn" type="button" data-cancel>Cancel</button></div>`);
        if (!fd) return;
        await api('/api/me', { method: 'DELETE', body: { password: fd.get('password') } });
        setUser(null);
        toast('Your account was deleted.');
        location.hash = '#/';
      }
    } catch (err) { toast(err.message); }
  };
}

// ---------- Admin ----------

async function adminView() {
  if (!requireLogin()) return;
  if (!state.user.isAdmin) { view.innerHTML = emptyState('Admins only.'); return; }
  const { paintings, aiGuides } = await api('/api/admin/queue');

  view.innerHTML = `
    <h1>Review queue</h1>
    <h2>Reported or hidden paintings (${paintings.length})</h2>
    ${paintings.length ? paintings.map((p) => `
      <div class="card admin-item"><div class="card-body admin-row">
        <a href="#/painting/${p.id}"><img class="admin-thumb" src="${esc(p.imageUrl)}" alt="${esc(p.title)}"></a>
        <div style="flex:1;min-width:0">
          <h3>${esc(p.title)}</h3>
          <p class="hint">by ${esc(p.author)} · ${p.visibility} · ${p.moderation === 'hidden' ? '⚠️ hidden' : 'visible'}</p>
          <ul>${p.reports.map((r) => `<li>${esc(byId(state.meta.reportReasons, r.reason)?.name ?? r.reason)}${r.details ? ` — “${esc(r.details)}”` : ''} <span class="hint">(${esc(r.reporter)})</span></li>`).join('') || '<li class="hint">No open reports</li>'}</ul>
          <div class="btn-row">
            <button class="btn" type="button" data-admin="restore" data-id="${p.id}">✓ Keep visible</button>
            <button class="btn" type="button" data-admin="hide" data-id="${p.id}">Hide</button>
            <button class="btn danger" type="button" data-admin="delete" data-id="${p.id}">Delete</button>
          </div>
        </div>
      </div></div>`).join('') : emptyState('Nothing to review. 🎉')}

    <h2>AI guides waiting for review (${aiGuides.length})</h2>
    <p class="hint">Read the guide before publishing: check materials, safety notes and that the steps make sense. Published guides appear in everyone's suggestions.</p>
    ${aiGuides.length ? aiGuides.map((g) => `
      <div class="card admin-item"><div class="card-body">
        <h3><a href="#/guide/${esc(g.id)}">${esc(g.title)}</a></h3>
        <p class="hint">${esc(styleName(g.style))} · ${esc(levelName(g.level))} · ${esc(mediumName(g.medium))} · by ${esc(g.createdByName ?? 'deleted user')}</p>
        <div class="btn-row">
          <button class="btn" type="button" data-admin="publish" data-id="${esc(g.id)}">Publish</button>
          <button class="btn danger" type="button" data-admin="delete-guide" data-id="${esc(g.id)}">Delete</button>
        </div>
      </div></div>`).join('') : emptyState('No AI guides waiting.')}`;

  view.onclick = async (e) => {
    const btn = e.target.closest('[data-admin]');
    if (!btn) return;
    const { admin: action, id } = btn.dataset;
    const calls = {
      restore: [`/api/admin/paintings/${id}/restore`, 'POST'],
      hide: [`/api/admin/paintings/${id}/hide`, 'POST'],
      delete: [`/api/admin/paintings/${id}`, 'DELETE'],
      publish: [`/api/admin/ai-guides/${id}/publish`, 'POST'],
      'delete-guide': [`/api/admin/ai-guides/${id}`, 'DELETE'],
    };
    if (action.startsWith('delete') && !confirm('Delete permanently?')) return;
    try {
      await api(calls[action][0], { method: calls[action][1] });
      toast('Done');
      route();
    } catch (err) { toast(err.message); }
  };
}

// ---------- Router ----------

async function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = (path || '/').split('/').filter(Boolean);
  view.onclick = null;
  view.onchange = null;

  const section = ['gallery', 'painting'].includes(parts[0]) ? 'gallery'
    : ['me', 'upload', 'admin', 'login', 'register'].includes(parts[0]) ? 'me' : 'discover';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));

  try {
    if (!parts.length) await discoverView(params);
    else if (parts[0] === 'login' || parts[0] === 'register') authView(parts[0], params);
    else if (parts[0] === 'guide' && parts[1]) await guideView(parts[1]);
    else if (parts[0] === 'upload') await uploadView(params);
    else if (parts[0] === 'gallery') await galleryView(params);
    else if (parts[0] === 'painting' && parts[1]) await paintingView(parts[1]);
    else if (parts[0] === 'me') await meView(params);
    else if (parts[0] === 'admin') await adminView();
    else view.innerHTML = emptyState('Page not found. <a href="#/">Go home</a>.');
  } catch (err) {
    if (err.status !== 401) view.innerHTML = emptyState(`${esc(err.message)}. <a href="#/">Go home</a>.`);
  }
  if (!params.has('style')) window.scrollTo(0, 0);
}

async function start() {
  const [meta, me] = await Promise.all([api('/api/meta'), api('/api/auth/me')]);
  state.meta = meta;
  setUser(me.user);
  window.addEventListener('hashchange', route);
  await route();
}

start();
