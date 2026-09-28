import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApp } from '../server/app.js';

// Smallest valid PNG (1×1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const FAKE_GUIDE = {
  title: 'Lemon on a blue cloth',
  summary: 'Complementary colours on a simple still life.',
  durationMinutes: 90,
  canvas: '20 × 25 cm canvas board',
  materials: ['Acrylic paints', 'Flat brush', 'Canvas board'],
  steps: [
    { title: 'Sketch', text: 'Draw the lemon.' },
    { title: 'Block in', text: 'Paint big shapes.' },
    { title: 'Details', text: 'Add highlights.' },
  ],
  tips: ['Squint.'],
};

let server, base, tmp, app;
const generatorCalls = [];

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'painting-test-'));
  app = createApp({
    dbPath: ':memory:',
    uploadDir: join(tmp, 'uploads'),
    reportHideThreshold: 2,
    aiDailyLimit: 2,
    guideGenerator: async (input) => { generatorCalls.push(input); return FAKE_GUIDE; },
  });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
});

// A client with its own cookie jar (one per simulated user).
function client() {
  let cookie = '';
  return async function api(path, { method = 'GET', body, form, headers = {} } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (body) h['Content-Type'] = 'application/json';
    const res = await fetch(base + path, { method, headers: h, body: form ?? (body && JSON.stringify(body)) });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const [pair] = setCookie.split(';');
      cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

function paintingForm(fields, bytes = PNG) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type: 'image/png' }), 'p.png');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

const register = (api, username, password = 'correct horse', level = 'beginner') =>
  api('/api/auth/register', { method: 'POST', body: { username, password, level } });

const makeAdmin = (username) => app.locals.db.prepare('UPDATE users SET is_admin = 1 WHERE name = ?').run(username);

describe('authentication', () => {
  test('register, session, logout, login', async () => {
    const api = client();
    const reg = await register(api, 'anna');
    assert.equal(reg.status, 201);
    assert.equal(reg.data.username, 'anna');
    assert.equal((await api('/api/auth/me')).data.user.username, 'anna');

    assert.equal((await api('/api/auth/logout', { method: 'POST' })).status, 204);
    assert.equal((await api('/api/auth/me')).data.user, null);
    assert.equal((await api('/api/me/paintings')).status, 401);

    assert.equal((await api('/api/auth/login', { method: 'POST', body: { username: 'ANNA', password: 'wrong pass' } })).status, 401);
    const login = await api('/api/auth/login', { method: 'POST', body: { username: 'ANNA', password: 'correct horse' } });
    assert.equal(login.status, 200);
    assert.equal((await api('/api/auth/me')).data.user.username, 'anna');
  });

  test('validates usernames and passwords, rejects duplicates', async () => {
    const api = client();
    assert.equal((await register(api, 'anna')).status, 409);
    assert.equal((await register(api, 'a b')).status, 400);
    assert.equal((await register(api, 'newuser', 'short')).status, 400);
  });

  test('a forged session cookie is not accepted', async () => {
    const res = await fetch(`${base}/api/auth/me`, { headers: { Cookie: 'pp_session=forged' } });
    assert.equal((await res.json()).user, null);
  });

  test('locks out after repeated wrong passwords', async () => {
    const api = client();
    await register(api, 'target');
    const attacker = client();
    for (let i = 0; i < 10; i++) {
      await attacker('/api/auth/login', { method: 'POST', body: { username: 'target', password: 'guess guess' } });
    }
    const res = await attacker('/api/auth/login', { method: 'POST', body: { username: 'target', password: 'correct horse' } });
    assert.equal(res.status, 429);
  });

  test('blocks cross-site state-changing requests', async () => {
    const api = client();
    const res = await api('/api/auth/login', {
      method: 'POST', body: { username: 'anna', password: 'correct horse' }, headers: { Origin: 'https://evil.example' },
    });
    assert.equal(res.status, 403);
    const nullOrigin = await api('/api/auth/logout', { method: 'POST', headers: { Origin: 'null' } });
    assert.equal(nullOrigin.status, 403);
  });

  test('changing the password logs out other sessions', async () => {
    const phone = client();
    const laptop = client();
    await register(phone, 'carol');
    await laptop('/api/auth/login', { method: 'POST', body: { username: 'carol', password: 'correct horse' } });
    assert.equal((await phone('/api/me/password', { method: 'PUT', body: { currentPassword: 'nope nope', newPassword: 'new password 1' } })).status, 400);
    assert.equal((await phone('/api/me/password', { method: 'PUT', body: { currentPassword: 'correct horse', newPassword: 'new password 1' } })).status, 204);
    assert.equal((await laptop('/api/auth/me')).data.user, null);
    assert.equal((await phone('/api/auth/me')).data.user.username, 'carol');
  });
});

describe('guides and paintings', () => {
  const anna = client();
  const ben = client();
  const anon = client();

  before(async () => {
    await anna('/api/auth/login', { method: 'POST', body: { username: 'anna', password: 'correct horse' } });
    await register(ben, 'ben', 'correct horse', 'advanced');
  });

  test('suggests guides by style and level, with level fallback', async () => {
    const { data } = await anon('/api/suggestions?style=realism&level=beginner');
    assert.ok(data.guides.length > 0);
    assert.ok(data.guides.every((g) => g.style === 'realism' && g.level === 'beginner'));
    assert.equal(data.fallback, false);

    const fb = await anon('/api/suggestions?style=realism&level=beginner&medium=oil');
    assert.equal(fb.data.fallback, true);
    assert.ok(fb.data.guides.length > 0);
  });

  test('guide detail includes materials, steps and user state', async () => {
    await anna('/api/guides/realism-beginner-apple/like', { method: 'PUT' });
    await anna('/api/guides/minimalism-beginner-moon/plan', { method: 'PUT' });
    await anna('/api/guides/realism-beginner-apple/progress', { method: 'PUT', body: { stepsDone: [0, 2, 2, 99] } });
    const { data } = await anna('/api/guides/realism-beginner-apple');
    assert.ok(data.materials.length > 0 && data.steps.length > 0);
    assert.deepEqual(data.user, { liked: true, planned: false, stepsDone: [0, 2] });
  });

  test('private paintings are visible only to their owner', async () => {
    const created = await anna('/api/paintings', {
      method: 'POST', form: paintingForm({ title: 'My moon', guideId: 'minimalism-beginner-moon', visibility: 'private' }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.style, 'minimalism');
    const id = created.data.id;

    assert.deepEqual((await anna('/api/me/planned')).data, []);
    assert.equal((await ben(`/api/paintings/${id}`)).status, 404);
    assert.equal((await anon(`/api/paintings/${id}/image`)).status, 404);
    assert.equal((await anna(`/api/paintings/${id}/image`)).status, 200);
    assert.equal((await anon('/api/gallery')).data.length, 0);

    assert.equal((await ben(`/api/paintings/${id}`, { method: 'PATCH', body: { visibility: 'public' } })).status, 404);
    await anna(`/api/paintings/${id}`, { method: 'PATCH', body: { visibility: 'public' } });
    const gallery = (await anon('/api/gallery')).data;
    assert.equal(gallery.length, 1);
    assert.equal(gallery[0].author, 'anna');
  });

  test('others can rate and like public paintings; owners cannot rate their own', async () => {
    const [p] = (await anon('/api/gallery')).data;
    assert.equal((await anna(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: 5 } })).status, 400);
    const rated = await ben(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: 4 } });
    assert.equal(rated.data.avgRating, 4);
    assert.equal(rated.data.myRating, 4);
    assert.equal((await ben(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: 9 } })).status, 400);
    assert.equal((await anon(`/api/paintings/${p.id}/rating`, { method: 'PUT', body: { stars: 3 } })).status, 401);

    await ben(`/api/paintings/${p.id}/like`, { method: 'PUT' });
    assert.equal((await ben('/api/me/liked')).data.paintings.length, 1);
  });

  test('blocking a user hides their paintings from your gallery', async () => {
    const [p] = (await ben('/api/gallery')).data;
    await ben(`/api/users/${p.userId}/block`, { method: 'PUT' });
    assert.equal((await ben('/api/gallery')).data.length, 0);
    assert.equal((await ben('/api/me/liked')).data.paintings.length, 0);
    assert.equal((await ben('/api/me/blocks')).data[0].username, 'anna');
    await ben(`/api/users/${p.userId}/block`, { method: 'DELETE' });
    assert.equal((await ben('/api/gallery')).data.length, 1);
  });

  test('validates uploads', async () => {
    assert.equal((await anon('/api/paintings', { method: 'POST', form: paintingForm({ title: 'x', style: 'abstract' }) })).status, 401);
    assert.equal((await ben('/api/paintings', { method: 'POST', form: paintingForm({ title: 'x' }) })).status, 400);
    // Declared as PNG but isn't one.
    const fake = await ben('/api/paintings', { method: 'POST', form: paintingForm({ title: 'x', style: 'abstract' }, Buffer.from('<html>')) });
    assert.equal(fake.status, 400);
  });

  test('owner can delete a painting', async () => {
    const { data } = await ben('/api/paintings', {
      method: 'POST', form: paintingForm({ title: 'Blocks', style: 'abstract', visibility: 'public' }),
    });
    assert.equal((await anna(`/api/paintings/${data.id}`, { method: 'DELETE' })).status, 404);
    assert.equal((await ben(`/api/paintings/${data.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await anon(`/api/paintings/${data.id}`)).status, 404);
  });
});

describe('moderation', () => {
  const owner = client();
  const r1 = client();
  const r2 = client();
  const admin = client();
  let paintingId;

  before(async () => {
    await register(owner, 'painter');
    await register(r1, 'reporter1');
    await register(r2, 'reporter2');
    await register(admin, 'moderator');
    makeAdmin('moderator');
    paintingId = (await owner('/api/paintings', {
      method: 'POST', form: paintingForm({ title: 'Spam', style: 'abstract', visibility: 'public' }),
    })).data.id;
  });

  test('reports hide a painting once the threshold is reached', async () => {
    assert.equal((await owner(`/api/paintings/${paintingId}/report`, { method: 'POST', body: { reason: 'spam' } })).status, 400);
    assert.equal((await r1(`/api/paintings/${paintingId}/report`, { method: 'POST', body: { reason: 'nonsense' } })).status, 400);
    await r1(`/api/paintings/${paintingId}/report`, { method: 'POST', body: { reason: 'spam' } });
    assert.equal((await r2(`/api/paintings/${paintingId}`)).status, 200);
    await r2(`/api/paintings/${paintingId}/report`, { method: 'POST', body: { reason: 'spam', details: 'ad link' } });

    assert.equal((await r2(`/api/paintings/${paintingId}`)).status, 404);
    assert.ok(!(await r2('/api/gallery')).data.some((p) => p.id === paintingId));
    const own = await owner(`/api/paintings/${paintingId}`);
    assert.equal(own.status, 200);
    assert.equal(own.data.moderation, 'hidden');
  });

  test('only admins see the queue; they can restore or hide', async () => {
    assert.equal((await r1('/api/admin/queue')).status, 403);
    const queue = (await admin('/api/admin/queue')).data;
    const item = queue.paintings.find((p) => p.id === paintingId);
    assert.equal(item.reports.length, 2);
    assert.equal((await admin(`/api/paintings/${paintingId}/image`)).status, 200);

    await admin(`/api/admin/paintings/${paintingId}/restore`, { method: 'POST' });
    assert.equal((await r2(`/api/paintings/${paintingId}`)).status, 200);
    assert.ok(!(await admin('/api/admin/queue')).data.paintings.some((p) => p.id === paintingId));

    await admin(`/api/admin/paintings/${paintingId}/hide`, { method: 'POST' });
    assert.equal((await r2(`/api/paintings/${paintingId}`)).status, 404);
  });
});

describe('AI-generated guides', () => {
  const maker = client();
  const other = client();
  const admin = client();
  let guideId;

  before(async () => {
    await register(maker, 'maker');
    await register(other, 'other');
    await admin('/api/auth/login', { method: 'POST', body: { username: 'moderator', password: 'correct horse' } });
  });

  test('meta reports that AI is enabled', async () => {
    assert.equal((await other('/api/meta')).data.aiEnabled, true);
  });

  test('generated guide is a private draft until an admin publishes it', async () => {
    const bad = await maker('/api/guides/generate', { method: 'POST', body: { style: 'realism', level: 'beginner', medium: 'crayon' } });
    assert.equal(bad.status, 400);

    const res = await maker('/api/guides/generate', {
      method: 'POST', body: { style: 'realism', level: 'beginner', medium: 'acrylic', idea: 'a lemon' },
    });
    assert.equal(res.status, 201);
    assert.equal(res.data.source, 'ai');
    assert.equal(res.data.status, 'private');
    assert.equal(res.data.style, 'realism');
    assert.deepEqual(generatorCalls.at(-1), { style: 'realism', level: 'beginner', medium: 'acrylic', idea: 'a lemon' });
    guideId = res.data.id;

    const mine = (await maker('/api/suggestions?style=realism&level=beginner')).data.guides;
    assert.ok(mine.some((g) => g.id === guideId));
    const theirs = (await other('/api/suggestions?style=realism&level=beginner')).data.guides;
    assert.ok(!theirs.some((g) => g.id === guideId));
    assert.equal((await other(`/api/guides/${guideId}`)).status, 404);

    assert.ok((await admin('/api/admin/queue')).data.aiGuides.some((g) => g.id === guideId));
    await admin(`/api/admin/ai-guides/${guideId}/publish`, { method: 'POST' });
    assert.equal((await other(`/api/guides/${guideId}`)).data.status, 'published');
  });

  test('enforces the daily limit', async () => {
    const body = { style: 'abstract', level: 'beginner', medium: 'acrylic' };
    assert.equal((await maker('/api/guides/generate', { method: 'POST', body })).status, 201);
    assert.equal((await maker('/api/guides/generate', { method: 'POST', body })).status, 429);
  });

  test('is unavailable without a generator', async () => {
    const plain = createApp({ dbPath: ':memory:', uploadDir: join(tmp, 'u2'), guideGenerator: null });
    const srv = await new Promise((r) => { const s = plain.listen(0, () => r(s)); });
    const res = await fetch(`http://127.0.0.1:${srv.address().port}/api/meta`);
    assert.equal((await res.json()).aiEnabled, false);
    srv.close();
  });
});

describe('account deletion', () => {
  test('deletes the user and their paintings', async () => {
    const api = client();
    const viewer = client();
    await register(api, 'leaver');
    await register(viewer, 'viewer');
    const { data } = await api('/api/paintings', {
      method: 'POST', form: paintingForm({ title: 'Bye', style: 'abstract', visibility: 'public' }),
    });
    await viewer(`/api/paintings/${data.id}/like`, { method: 'PUT' });

    assert.equal((await api('/api/me', { method: 'DELETE', body: { password: 'wrong wrong' } })).status, 400);
    assert.equal((await api('/api/me', { method: 'DELETE', body: { password: 'correct horse' } })).status, 204);
    assert.equal((await viewer(`/api/paintings/${data.id}`)).status, 404);
    assert.equal((await viewer('/api/me/liked')).data.paintings.length, 0);
    const login = await api('/api/auth/login', { method: 'POST', body: { username: 'leaver', password: 'correct horse' } });
    assert.equal(login.status, 401);
  });
});
