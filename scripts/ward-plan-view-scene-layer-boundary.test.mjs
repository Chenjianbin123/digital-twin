import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

test('病房内 2.5D 视图使用统一场景层渲染，避免画布空白', () => {
  assert.match(
    app,
    /<WardPlanView[\s\S]*?class="digital-twin__scene-layer"[\s\S]*?:class="\{ 'digital-twin__scene-layer--inactive': wardInteriorView !== 'plan' \}"/,
    'WardPlanView 应挂载到与 3D 场景一致的绝对定位层，并随 2.5D 状态激活',
  );
});
