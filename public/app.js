// Paint Practice — single-page frontend (no build step).

const view = document.getElementById('view');
const profileChip = document.getElementById('profile-chip');
const profileDialog = document.getElementById('profile-dialog');

const state = {
  meta: null,
  user: loadUser(),
};

// ---------- Helpers ----------

function loadUser() {
  try { return JSON.parse(localStorage.getItem('pp-user')); } catch { return null; }
}
function saveUser(user) {
  state.user = user;
  try { user ? localStorage.setItem('pp-user', JSON.stringify(user)) : localStorage.removeItem('pp-user'); } catch { /* storage blocked */ }
  renderProfileChip();
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (state.user) headers['X-User-Id'] = String(state.user.id);
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) openProfileDialog();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

const byId = (list, id) => list.find((x) => x.id === id);
const styleName = (id) => byId(state.meta.styles, id)?.name ?? id;
const levelName = (id) => byId(state.meta.levels, id)?.name ?? id;
const mediumName = (id) => byId(state.meta.mediums, id)?.name ?? id;

const formatDuration = (min) => (min < 60 ? `${min} min` : `${Math.round((min / 60) * 10) / 10} h`);
const starsText = (avg) => '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg));
const imgSrc = (p) => `${p.imageUrl}${state.user ? `?as=${state.user.id}` : ''}`;

function requireProfile() {
  if (state.user) return true;
  view.innerHTML = `<div class="empty"><h2>Choose a profile</h2><p>Pick or create a profile to see your page.</p>
    <button class="btn primary" type="button" data-action="profiles">Choose profile</button></div>`;
  openProfileDialog();
  return false;
}

// ---------- Profile picker (stand-in for authentication) ----------

function renderProfileChip() {
  profileChip.hidden = false;
  profileChip.textContent = state.user ? `👤 ${state.user.name}` : 'Choose profile';
}

async function openProfileDialog() {
  if (profileDialog.open) return;
  let users = [];
  try { users = await api('/api/users'); } catch { /* shown as empty list */ }
  const levels = state.meta.levels.map((l, i) =>
    `<option value="${esc(l.id)}" ${i === 0 ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  profileDialog.innerHTML = `
    <h2 style="margin-top:0">Who's painting?</h2>
    <p class="hint">Demo mode: profiles have no password yet.</p>
    <div class="profile-list">
      ${users.map((u) => `<button class="btn ${state.user?.id === u.id ? 'active' : ''}" type="button" data-pick="${u.id}">
        ${esc(u.name)} · ${esc(levelName(u.level))}</button>`).join('') || '<p class="hint">No profiles yet — create the first one.</p>'}
    </div>
    <form id="new-profile">
      <h3>New profile</h3>
      <label for="np-name">Name</label>
      <input id="np-name" name="name" type="text" minlength="2" maxlength="30" required autocomplete="nickname">
      <label for="np-level">Your painting level</label>
      <select id="np-level" name="level">${levels}</select>
      <div class="btn-row">
        <button class="btn primary" type="submit">Create profile</button>
        ${state.user ? '<button class="btn" type="button" data-close>Cancel</button>' : ''}
      </div>
    </form>`;

  profileDialog.onclick = (e) => {
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      saveUser(users.find((u) => u.id === Number(pick.dataset.pick)));
      profileDialog.close();
      route();
    }
    if (e.target.closest('[data-close]')) profileDialog.close();
  };
  profileDialog.querySelector('#new-profile').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const user = await api('/api/users', { method: 'POST', body: { name: fd.get('name'), level: fd.get('level') } });
      saveUser(user);
      profileDialog.close();
      toast(`Welcome, ${user.name}!`);
      route();
    } catch (err) { toast(err.message); }
  };
  profileDialog.showModal();
}

profileChip.onclick = openProfileDialog;
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="profiles"]')) openProfileDialog();
});

// ---------- Shared renderers ----------

function guideCard(g) {
  return `<a class="card" href="#/guide/${esc(g.id)}"><div class="card-body">
    <h3>${esc(g.title)}</h3>
    <p class="hint">${esc(g.summary)}</p>
    <div class="meta">
      <span class="tag">${esc(styleName(g.style))}</span>
      <span class="tag">${esc(levelName(g.level))}</span>
      <span class="tag">${esc(mediumName(g.medium))}</span>
      <span class="tag">⏱ ${esc(formatDuration(g.durationMinutes))}</span>
    </div></div></a>`;
}

function paintingCard(p, { showAuthor = true } = {}) {
  return `<a class="card" href="#/painting/${p.id}">
    <img class="thumb" src="${esc(imgSrc(p))}" alt="${esc(p.title)}" loading="lazy">
    <div class="card-body">
      <h3>${esc(p.title)}</h3>
      ${showAuthor ? `<p class="hint">by ${esc(p.author)}</p>` : ''}
      <div class="meta">
        <span class="tag">${esc(styleName(p.style))}</span>
        ${p.visibility === 'private' ? '<span class="tag private">🔒 Private</span>' : '<span class="tag">🌍 Public</span>'}
        ${p.ratingCount ? `<span class="tag"><span class="stars">★</span> ${p.avgRating} (${p.ratingCount})</span>` : ''}
      </div></div></a>`;
}

const emptyState = (text, cta = '') => `<div class="empty"><p>${text}</p>${cta}</div>`;

// ---------- Screens ----------

// Discover: choose style + level (+ optional medium) and get suggestions.
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
      : emptyState('No guides for this combination yet. Try “Any” medium.')}`;
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function guideView(id) {
  const g = await api(`/api/guides/${encodeURIComponent(id)}`);
  const done = new Set(g.user.stepsDone);

  const render = () => {
    const pct = Math.round((done.size / g.steps.length) * 100);
    view.innerHTML = `
      <p><a href="#/?style=${esc(g.style)}&level=${esc(g.level)}">← More ${esc(styleName(g.style))} ideas</a></p>
      <h1>${esc(g.title)}</h1>
      <p>${esc(g.summary)}</p>
      <div class="meta">
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
          <p class="hint">${done.size} of ${g.steps.length} steps done${state.user ? '' : ' · choose a profile to save progress'}</p>
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
      try { await api(`/api/guides/${g.id}/progress`, { method: 'PUT', body: { stepsDone: [...done] } }); }
      catch (err) { toast(err.message); }
    }
  };
  view.onclick = async (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
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

async function uploadView(params) {
  if (!requireProfile()) return;
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
          <option value="">Choose…</option>
          ${state.meta.styles.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}
        </select>`}

      <label>Who can see it?</label>
      <div class="options">
        <label class="option"><input type="radio" name="visibility" value="private" checked>
          <strong>🔒 Private</strong><small>Only on your page.</small></label>
        <label class="option"><input type="radio" name="visibility" value="public">
          <strong>🌍 Public</strong><small>In the gallery, where others can rate it.</small></label>
      </div>
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
        <option value="">All styles</option>
        ${state.meta.styles.map((s) => `<option value="${esc(s.id)}" ${s.id === style ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
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

async function paintingView(id) {
  let p = await api(`/api/paintings/${encodeURIComponent(id)}`);
  const isOwner = state.user?.id === p.userId;

  const render = () => {
    view.innerHTML = `
      <img class="painting-full" src="${esc(imgSrc(p))}" alt="${esc(p.title)}">
      <h1 style="margin-top:16px">${esc(p.title)}</h1>
      <p class="hint">by ${esc(p.author)} · ${esc(new Date(p.createdAt + 'Z').toLocaleDateString())}</p>
      <div class="meta">
        <span class="tag">${esc(styleName(p.style))}</span>
        ${p.guideId ? `<a class="tag" href="#/guide/${esc(p.guideId)}">Guide: ${esc(p.guideTitle)}</a>` : ''}
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
      : `
        <h2>Your rating</h2>
        <div class="star-input" role="group" aria-label="Rate this painting">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" class="${(p.myRating ?? 0) >= n ? 'on' : ''}" aria-label="${n} star${n > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <div class="btn-row"><button class="btn ${p.liked ? 'active' : ''}" type="button" data-act="like">${p.liked ? '♥ Liked' : '♡ Like'}</button></div>`}`;
  };
  render();

  view.onclick = async (e) => {
    const star = e.target.closest('[data-star]');
    const act = e.target.closest('[data-act]')?.dataset.act;
    try {
      if (star) {
        if (!state.user) return openProfileDialog();
        p = await api(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: Number(star.dataset.star) } });
        toast('Thanks for rating!');
      } else if (act === 'like') {
        if (!state.user) return openProfileDialog();
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
      } else return;
      render();
    } catch (err) { toast(err.message); }
  };
}

async function meView(params) {
  if (!requireProfile()) return;
  const tab = params.get('tab') ?? 'created';
  const tabs = [['created', 'Created'], ['liked', 'Liked'], ['planned', 'Planned next']];

  view.innerHTML = `
    <h1>${esc(state.user.name)}</h1>
    <label for="me-level" style="margin-top:0">Painting level</label>
    <select id="me-level" style="max-width:220px">
      ${state.meta.levels.map((l) => `<option value="${esc(l.id)}" ${l.id === state.user.level ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
    </select>
    <nav class="tabs">${tabs.map(([id, label]) => `<a href="#/me?tab=${id}" class="${id === tab ? 'active' : ''}">${label}</a>`).join('')}</nav>
    <section id="me-content"></section>`;

  view.querySelector('#me-level').onchange = async (e) => {
    try {
      saveUser(await api('/api/me', { method: 'PATCH', body: { level: e.target.value } }));
      toast('Level updated');
    } catch (err) { toast(err.message); }
  };

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
  } else {
    const planned = await api('/api/me/planned');
    content.innerHTML = planned.length
      ? `<div class="grid">${planned.map(guideCard).join('')}</div>`
      : emptyState('Nothing planned. Tap “Plan to paint” on any guide to save it here.', '<a class="btn primary" href="#/">Discover guides</a>');
  }
}

// ---------- Router ----------

async function route() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const parts = (path || '/').split('/').filter(Boolean);
  view.onclick = null;
  view.onchange = null;

  const section = parts[0] === 'gallery' || parts[0] === 'painting' ? 'gallery' : parts[0] === 'me' || parts[0] === 'upload' ? 'me' : 'discover';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));

  try {
    if (!parts.length) await discoverView(params);
    else if (parts[0] === 'guide' && parts[1]) await guideView(parts[1]);
    else if (parts[0] === 'upload') await uploadView(params);
    else if (parts[0] === 'gallery') await galleryView(params);
    else if (parts[0] === 'painting' && parts[1]) await paintingView(parts[1]);
    else if (parts[0] === 'me') await meView(params);
    else view.innerHTML = emptyState('Page not found. <a href="#/">Go home</a>.');
  } catch (err) {
    view.innerHTML = emptyState(`${esc(err.message)}. <a href="#/">Go home</a>.`);
  }
  if (!params.has('style')) window.scrollTo(0, 0);
}

async function start() {
  state.meta = await api('/api/meta');
  // Refresh the stored profile in case it was deleted or changed.
  if (state.user) {
    const users = await api('/api/users').catch(() => []);
    saveUser(users.find((u) => u.id === state.user.id) ?? null);
  }
  renderProfileChip();
  window.addEventListener('hashchange', route);
  await route();
  if (!state.user) openProfileDialog();
}

start();
