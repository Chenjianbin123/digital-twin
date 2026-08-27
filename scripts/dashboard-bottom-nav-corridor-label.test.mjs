import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/components/dashboard/DashboardBottomNav.vue', import.meta.url), 'utf8');

test('底部导航使用病房走廊名称并为长标签预留样式', () => {
  assert.match(source, /label: '病房走廊'/);
  assert.match(source, /dash-bottom__item--corridor/);
  assert.match(source, /&--corridor[\s\S]*?min-width:\s*92px/);
});

