import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8');

assert.match(panel, /class="station-hero__scanline"/);
const statusConsole = await readFile(new URL('../src/components/dashboard/NurseStatusConsole.vue', import.meta.url), 'utf8');
assert.doesNotMatch(panel, /NurseStatusConsole/);
assert.match(statusConsole, /class="nsc-symbol"/);
assert.match(statusConsole, /class="nsc-toggle"/);
assert.match(statusConsole, /data-theme='light'/);
assert.match(panel, /appearance:\s*none/);
assert.match(panel, /@keyframes nurse-station-hero-scan/);
assert.match(panel, /@keyframes nurse-station-status-pulse/);
assert.match(panel, /@keyframes nurse-station-badge-sheen/);
assert.match(panel, /@keyframes nurse-station-chip-sheen/);
assert.match(panel, /prefers-reduced-motion:\s*reduce/);

console.log('Nurse-station hero tech-style boundary checks passed.');
