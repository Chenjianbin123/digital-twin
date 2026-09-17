import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel = await readFile(
  new URL('../src/components/NurseStationSceneInfo.vue', import.meta.url),
  'utf8',
);

assert.match(panel, /class="station-info__sync"/);
assert.match(panel, /role="status"/);
assert.match(panel, /v-if="viewModel\.realtime\.status !== 'ready'"/);
assert.match(panel, /width:\s*40px;[\s\S]*?height:\s*40px;/);
assert.match(panel, /dl > div\.is-attention/);
assert.match(panel, /@keyframes station-info-border-scan/);
assert.match(panel, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(panel, /dl > div:has\(\.is-alert\)/);

console.log('Nurse-station scene info UI checks passed.');
