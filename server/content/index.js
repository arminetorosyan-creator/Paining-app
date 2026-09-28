// Content provider for suggestions and guides (hybrid model).
//
// Two sources:
//  - the curated library in guides.js (reviewed, visible to everyone)
//  - AI-generated guides in the ai_guides table: private to their creator
//    until an admin reviews and publishes them.
// Routes and UI consume only this module.

import { GUIDES, LEVELS, MEDIUMS, STYLES } from './guides.js';

const LEVEL_ORDER = LEVELS.map((l) => l.id);

export function getMeta() {
  return { styles: STYLES, levels: LEVELS, mediums: MEDIUMS };
}

export const isStyle = (id) => STYLES.some((s) => s.id === id);
export const isLevel = (id) => LEVELS.some((l) => l.id === id);
export const isMedium = (id) => MEDIUMS.some((m) => m.id === id);

export function toSummary(guide) {
  const { steps, materials, tips, ...rest } = guide;
  return { ...rest, stepCount: steps.length };
}

export function createContent(db) {
  const aiRow = (row) => ({
    ...JSON.parse(row.data),
    id: row.id,
    source: 'ai',
    status: row.status,
    createdBy: row.user_id,
  });

  // AI guides a viewer can see: published ones + their own drafts.
  function visibleAiGuides(viewer) {
    return db
      .prepare("SELECT * FROM ai_guides WHERE status = 'published' OR user_id = ? ORDER BY created_at DESC")
      .all(viewer?.id ?? 0)
      .map(aiRow);
  }

  function getGuide(id, viewer) {
    const curated = GUIDES.find((g) => g.id === id);
    if (curated) return { ...curated, source: 'curated', status: 'published' };
    const row = db.prepare('SELECT * FROM ai_guides WHERE id = ?').get(String(id));
    if (!row) return null;
    const canSee = row.status === 'published' || (viewer && (viewer.id === row.user_id || viewer.is_admin));
    return canSee ? aiRow(row) : null;
  }

  // Title lookup that ignores visibility (for labels on paintings).
  function guideTitle(id) {
    const curated = GUIDES.find((g) => g.id === id);
    if (curated) return curated.title;
    const row = db.prepare('SELECT data FROM ai_guides WHERE id = ?').get(String(id));
    return row ? JSON.parse(row.data).title : null;
  }

  // Returns guides matching the filters. If the exact level has nothing for
  // the chosen style/medium, falls back to the closest levels and flags it.
  function suggest({ style, level, medium } = {}, viewer) {
    const all = [...GUIDES.map((g) => ({ ...g, source: 'curated', status: 'published' })), ...visibleAiGuides(viewer)];
    const match = (g, lvl) =>
      (!style || g.style === style) && (!medium || g.medium === medium) && (!lvl || g.level === lvl);

    const exact = all.filter((g) => match(g, level));
    if (exact.length || !level) return { guides: exact.map(toSummary), fallback: false };

    const idx = LEVEL_ORDER.indexOf(level);
    const byDistance = all.filter((g) => match(g, null)).sort(
      (a, b) => Math.abs(LEVEL_ORDER.indexOf(a.level) - idx) - Math.abs(LEVEL_ORDER.indexOf(b.level) - idx),
    );
    return { guides: byDistance.map(toSummary), fallback: byDistance.length > 0 };
  }

  return { getGuide, guideTitle, suggest, visibleAiGuides };
}
