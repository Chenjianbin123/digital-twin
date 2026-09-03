import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

test('2.5D 模式下显示面板按钮使用弱化紧凑样式', () => {
  assert.match(app, /digital-twin__main--plan/);
  assert.match(app, /'digital-twin__panel-toggle--plan': isWardInterior && wardInteriorView === 'plan'/);
  assert.match(app, /&--plan/);
});
