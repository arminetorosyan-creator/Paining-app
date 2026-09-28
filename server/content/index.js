// Content provider for suggestions and guides.
//
// The MVP only uses the curated library. To add AI-generated guides later,
// implement the same functions for an AI source and merge its results here;
// routes and UI consume only this module.

import { GUIDES, LEVELS, MEDIUMS, STYLES } from './guides.js';

const LEVEL_ORDER = LEVELS.map((l) => l.id);

export function getMeta() {
  return { styles: STYLES, levels: LEVELS, mediums: MEDIUMS };
}

export function isStyle(id) {
  return STYLES.some((s) => s.id === id);
}

export function getGuide(id) {
  return GUIDES.find((g) => g.id === id) ?? null;
}

export function toSummary(guide) {
  const { steps, materials, tips, ...rest } = guide;
  return { ...rest, stepCount: steps.length };
}

// Returns guides matching the filters. If the exact level has nothing for the
// chosen style/medium, falls back to the closest level so the user always
// gets a suggestion, and flags it.
export function suggest({ style, level, medium } = {}) {
  const match = (g, lvl) =>
    (!style || g.style === style) && (!medium || g.medium === medium) && (!lvl || g.level === lvl);

  const exact = GUIDES.filter((g) => match(g, level));
  if (exact.length || !level) return { guides: exact.map(toSummary), fallback: false };

  const idx = LEVEL_ORDER.indexOf(level);
  const byDistance = GUIDES.filter((g) => match(g, null)).sort(
    (a, b) => Math.abs(LEVEL_ORDER.indexOf(a.level) - idx) - Math.abs(LEVEL_ORDER.indexOf(b.level) - idx),
  );
  return { guides: byDistance.map(toSummary), fallback: byDistance.length > 0 };
}
