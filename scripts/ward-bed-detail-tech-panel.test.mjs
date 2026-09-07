import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8');
const mapping = readFileSync(new URL('../src/core/bed-device-mapping.ts', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/core/template/canvas-renderer.ts', import.meta.url), 'utf8');

test('does not render nursing label chips without readable text', () => {
  assert.match(panel, /const visibleNursingLabels = computed\(/);
  assert.match(panel, /v-if="visibleNursingLabels\.length"/);
  assert.match(panel, /v-for="tag in visibleNursingLabels"/);
  assert.match(mapping, /\.filter\(item => text\(item\.labelName\)\.trim\(\)\)/);
  assert.match(renderer, /if \(!text\.trim\(\)\)\s*continue;/);
});

test('uses a compact technology-styled bed detail hierarchy', () => {
  assert.match(panel, /class="bed-detail-identity"/);
  assert.match(panel, /class="bed-detail-section bed-detail-section--status"/);
  assert.match(panel, /linear-gradient\(135deg, rgba\(65, 231, 255/);
  assert.match(panel, /0 0 18px rgba\(64, 229, 255/);
});
