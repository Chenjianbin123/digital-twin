import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('场景切换使用独立的全区域加载层并展示路径信息', async () => {
  const loader = await read('src/components/SceneSwitchLoader.vue');
  const app = await read('src/App.vue');
  const transition = await read('src/core/scene-transition.ts');

  assert.match(loader, /class="scene-switch-loader"/);
  assert.match(loader, /role="status"/);
  assert.match(loader, /scene-switch-loader__backdrop/);
  assert.match(loader, /scene-switch-loader__progress/);
  assert.match(loader, /scene-switch-loader__route/);
  assert.match(loader, /scene-switch-loader--\$\{feedback\.tone\}/);
  assert.match(app, /import SceneSwitchLoader from ['"]@\/components\/SceneSwitchLoader\.vue['"]/);
  assert.match(app, /<SceneSwitchLoader[\s\S]*:feedback="sceneSwitchFeedback"/);
  assert.doesNotMatch(app, /class="digital-twin__scene-switch"/);
  assert.match(transition, /fromLabel:/);
  assert.match(transition, /toLabel:/);
});
