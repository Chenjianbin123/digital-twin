import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('corridor and ward interior share the same model loading overlay', () => {
  const overlay = read('src/components/SceneModelLoading.vue');
  const corridor = read('src/components/AreaScene3D.vue');
  const interior = read('src/components/WardScene3D.vue');
  const app = read('src/App.vue');

  assert.match(overlay, /class="scene-model-loading"/);
  assert.match(corridor, /SceneModelLoading/);
  assert.match(corridor, /正在准备病房走廊模型/);
  assert.match(corridor, /首次加载需要一点时间，后续切换会直接打开/);
  assert.match(interior, /SceneModelLoading/);
  assert.match(interior, /正在准备病房内部模型/);
  assert.match(interior, /首次加载需要一点时间，后续切换会直接打开/);
  assert.match(interior, /onModelState: state => \(modelState\.value = state\)/);
  assert.match(app, /v-show="isWardInterior && wardInteriorView === '3d'"/);
});
