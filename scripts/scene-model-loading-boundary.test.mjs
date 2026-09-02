import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('场景切换不再挂载旧的模型加载遮罩', () => {
  const corridor = read('src/components/AreaScene3D.vue');
  const interior = read('src/components/WardScene3D.vue');
  const app = read('src/App.vue');
  const visual = read('src/components/NurseStationVisualScene.vue');
  const areaScene = read('src/core/area-scene.ts');
  const wardScene = read('src/core/ward-scene.ts');

  assert.doesNotMatch(corridor, /SceneModelLoading/);
  assert.doesNotMatch(corridor, /corridorModelState/);
  assert.doesNotMatch(interior, /SceneModelLoading/);
  assert.doesNotMatch(interior, /modelState/);
  assert.match(app, /SceneSwitchLoader/);
  assert.doesNotMatch(app, /SceneModelLoading/);
  assert.match(app, /digital-twin__scene-layer--inactive/);
  assert.match(app, /:active="interiorSceneActive"/);
  assert.match(app, /model-kind="corridor"/);
  assert.match(visual, /model-kind="station"/);
  assert.match(areaScene, /setActive\(active: boolean\)/);
  assert.match(wardScene, /setActive\(active: boolean\)/);
});
