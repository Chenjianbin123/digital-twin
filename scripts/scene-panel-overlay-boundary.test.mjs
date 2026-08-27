import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

test('病房走廊和病房内模型保持全屏并由透明右侧面板覆盖', () => {
  assert.match(app, /'digital-twin__panel--overlay': !isNurseStation/);
  assert.match(app, /&__main--ward &__scene \{\s*right: 0;/);
  assert.match(app, /&--overlay \{/);
  assert.doesNotMatch(app, /<DashboardFrame/);
});

test('三种场景共用同一套顶部 dash-header 布局', () => {
  const headerBlock = app.match(/<DashboardHeader[\s\S]*?\/>/)?.[0] ?? '';
  assert.notEqual(headerBlock, '', '应能找到 DashboardHeader 组件');
  assert.doesNotMatch(headerBlock, /:compact="isNurseStation"/);
});
