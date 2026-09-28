// Builds prototype/index.html: a single self-contained file (no server needed)
// with the curated guides from server/content/guides.js embedded.
// Usage: npm run build:prototype
import { readFileSync, writeFileSync } from 'node:fs';

import { GUIDES, LEVELS, MEDIUMS, STYLES } from '../server/content/guides.js';

const template = readFileSync(new URL('../prototype/template.html', import.meta.url), 'utf8');
const content = JSON.stringify({
  styles: STYLES,
  levels: LEVELS,
  mediums: MEDIUMS,
  guides: GUIDES.map(({ id, title, style, level, medium, durationMinutes, canvas, summary, materials, steps, tips }) =>
    ({ id, title, style, level, medium, durationMinutes, canvas, summary, materials, steps, tips })),
}).replace(/</g, '\\u003c');

writeFileSync(new URL('../prototype/index.html', import.meta.url), template.replace('__CONTENT__', () => content));
console.log('Wrote prototype/index.html');
