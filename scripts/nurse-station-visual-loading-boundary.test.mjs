import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, visualScene] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationVisualScene.vue', import.meta.url), 'utf8'),
]);

const nurseStationBlock = app.match(/<NurseStationVisualScene[\s\S]*?\/>/)?.[0] ?? '';

assert.match(nurseStationBlock, /v-show="isNurseStation"/);
assert.doesNotMatch(nurseStationBlock, /v-if="isNurseStation"/);

assert.match(visualScene, /class="nurse-station-visual__model-state"/);
assert.match(visualScene, /nurse-station-visual__model-state-spinner/);
assert.match(visualScene, /护士站场景加载中/);
assert.match(visualScene, /正在解析 3D 模型，请稍候/);
assert.match(visualScene, /请刷新页面重试/);
assert.match(visualScene, /backdrop-filter:\s*blur\(/);
assert.match(visualScene, /box-shadow:[\s\S]*rgba\(77, 208, 255/);
assert.match(visualScene, /&__model-state--fallback/);

console.log('Nurse-station visual loading boundary checks passed.');
