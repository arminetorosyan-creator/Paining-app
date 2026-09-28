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

let server, base, tmp;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'painting-test-'));
  const app = createApp({ dbPath: ':memory:', uploadDir: join(tmp, 'uploads') });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function api(path, { user, method = 'GET', body, form } = {}) {
  const headers = {};
  if (user) headers['X-User-Id'] = String(user.id);
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form ?? (body && JSON.stringify(body)) });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function paintingForm(fields) {
  const form = new FormData();
  form.append('image', new Blob([PNG], { type: 'image/png' }), 'p.png');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

describe('painting app API', () => {
  let anna, ben;

  test('creates profiles and rejects duplicates', async () => {
    anna = (await api('/api/users', { method: 'POST', body: { name: 'Anna', level: 'beginner' } })).data;
    ben = (await api('/api/users', { method: 'POST', body: { name: 'Ben', level: 'advanced' } })).data;
    assert.equal(anna.name, 'Anna');
    const dup = await api('/api/users', { method: 'POST', body: { name: 'anna' } });
    assert.equal(dup.status, 409);
  });

  test('suggests guides by style and level, with level fallback', async () => {
    const { data } = await api('/api/suggestions?style=realism&level=beginner');
    assert.ok(data.guides.length > 0);
    assert.ok(data.guides.every((g) => g.style === 'realism' && g.level === 'beginner'));
    assert.equal(data.fallback, false);

    // No beginner oil guides for realism → closest levels returned.
    const fb = await api('/api/suggestions?style=realism&level=beginner&medium=oil');
    assert.equal(fb.data.fallback, true);
    assert.ok(fb.data.guides.length > 0);
  });

  test('guide detail includes materials, steps and user state', async () => {
    await api('/api/guides/realism-beginner-apple/like', { user: anna, method: 'PUT' });
    await api('/api/guides/minimalism-beginner-moon/plan', { user: anna, method: 'PUT' });
    await api('/api/guides/realism-beginner-apple/progress', { user: anna, method: 'PUT', body: { stepsDone: [0, 2, 2, 99] } });
    const { data } = await api('/api/guides/realism-beginner-apple', { user: anna });
    assert.ok(data.materials.length > 0 && data.steps.length > 0);
    assert.deepEqual(data.user, { liked: true, planned: false, stepsDone: [0, 2] });
  });

  test('private paintings are visible only to their owner', async () => {
    const created = await api('/api/paintings', {
      user: anna, method: 'POST',
      form: paintingForm({ title: 'My moon', guideId: 'minimalism-beginner-moon', visibility: 'private' }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.style, 'minimalism');
    const id = created.data.id;

    // Finishing a planned guide removes it from "planned next".
    assert.deepEqual((await api('/api/me/planned', { user: anna })).data, []);

    assert.equal((await api(`/api/paintings/${id}`, { user: ben })).status, 404);
    assert.equal((await api(`/api/paintings/${id}/image`)).status, 404);
    assert.equal((await api(`/api/paintings/${id}/image`, { user: anna })).status, 200);
    assert.equal((await api('/api/gallery')).data.length, 0);

    // Only the owner can change visibility.
    assert.equal((await api(`/api/paintings/${id}`, { user: ben, method: 'PATCH', body: { visibility: 'public' } })).status, 404);
    await api(`/api/paintings/${id}`, { user: anna, method: 'PATCH', body: { visibility: 'public' } });
    const gallery = (await api('/api/gallery')).data;
    assert.equal(gallery.length, 1);
    assert.equal(gallery[0].author, 'Anna');
  });

  test('others can rate and like public paintings; owners cannot rate their own', async () => {
    const [p] = (await api('/api/gallery')).data;
    assert.equal((await api(`/api/paintings/${p.id}/rating`, { user: anna, method: 'PUT', body: { stars: 5 } })).status, 400);
    const rated = await api(`/api/paintings/${p.id}/rating`, { user: ben, method: 'PUT', body: { stars: 4 } });
    assert.equal(rated.data.avgRating, 4);
    assert.equal(rated.data.myRating, 4);
    assert.equal((await api(`/api/paintings/${p.id}/rating`, { user: ben, method: 'PUT', body: { stars: 9 } })).status, 400);

    await api(`/api/paintings/${p.id}/like`, { user: ben, method: 'PUT' });
    const liked = (await api('/api/me/liked', { user: ben })).data;
    assert.equal(liked.paintings.length, 1);

    // Making it private again hides it from Ben's liked list and the gallery.
    await api(`/api/paintings/${p.id}`, { user: anna, method: 'PATCH', body: { visibility: 'private' } });
    assert.equal((await api('/api/me/liked', { user: ben })).data.paintings.length, 0);
    assert.equal((await api('/api/gallery')).data.length, 0);
  });

  test('validates uploads and requires a profile', async () => {
    assert.equal((await api('/api/paintings', { method: 'POST', form: paintingForm({ title: 'x', style: 'abstract' }) })).status, 401);
    const noStyle = await api('/api/paintings', { user: ben, method: 'POST', form: paintingForm({ title: 'x' }) });
    assert.equal(noStyle.status, 400);

    const bad = new FormData();
    bad.append('image', new Blob(['hello'], { type: 'text/plain' }), 'a.txt');
    bad.append('title', 'x');
    bad.append('style', 'abstract');
    assert.equal((await api('/api/paintings', { user: ben, method: 'POST', form: bad })).status, 400);
  });

  test('owner can delete a painting', async () => {
    const { data } = await api('/api/paintings', {
      user: ben, method: 'POST', form: paintingForm({ title: 'Blocks', style: 'abstract', visibility: 'public' }),
    });
    assert.equal((await api(`/api/paintings/${data.id}`, { user: anna, method: 'DELETE' })).status, 404);
    assert.equal((await api(`/api/paintings/${data.id}`, { user: ben, method: 'DELETE' })).status, 204);
    assert.equal((await api(`/api/paintings/${data.id}`)).status, 404);
  });
});
