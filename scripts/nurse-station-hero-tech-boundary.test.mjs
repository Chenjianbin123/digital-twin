import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8');

assert.match(panel, /class="station-hero__scanline"/);
assert.match(panel, /class="station-state__signal"/);
assert.match(panel, /class="[^"]*\bstation-hero__chip\b/);
assert.match(panel, /class="station-hero__alert-toggle"/);
assert.match(panel, /appearance:\s*none/);
assert.match(panel, /@keyframes nurse-station-hero-scan/);
assert.match(panel, /@keyframes nurse-station-status-pulse/);
assert.match(panel, /@keyframes nurse-station-badge-sheen/);
assert.match(panel, /@keyframes nurse-station-chip-sheen/);
assert.match(panel, /prefers-reduced-motion:\s*reduce/);

console.log('Nurse-station hero tech-style boundary checks passed.');
