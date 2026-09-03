import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [app, wardPanel, introPanel] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/HospitalIntroPanel.vue', import.meta.url), 'utf8'),
]);

test('病房内侧边栏使用独立的科技化视觉边界', () => {
  assert.match(app, /'digital-twin__panel--interior':\s*isWardInterior/);
  assert.match(app, /&--interior\s*\{/);
  assert.match(app, /&--interior[\s\S]*?:deep\(\.hospital-intro\)/);
});

test('病房内信息卡片提供层次化高光与轻量动效', () => {
  assert.match(wardPanel, /@keyframes ward-panel-/);
  assert.match(wardPanel, /animation:\s*ward-panel-[^;]+infinite/);
  assert.match(wardPanel, /&__header[\s\S]*?::after/);
  assert.match(wardPanel, /\.stat-chip[\s\S]*?box-shadow:/);
  assert.match(wardPanel, /\.bed-list[\s\S]*?li[\s\S]*?transition:/);
});

test('医院介绍图片加载失败时不显示破损图标', () => {
  assert.match(introPanel, /logoFailed/);
  assert.match(introPanel, /@error="handleLogoError"/);
  assert.match(introPanel, /v-if="logoUrl && !logoFailed"/);
});
