import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const renderer = readFileSync(new URL('../src/core/plan-renderer.ts', import.meta.url), 'utf8');

test('2.5D 房间结构不展示会被床卡遮挡的门窗文字', () => {
  assert.doesNotMatch(renderer, /fillText\('门口'/, '不应绘制门口文字');
  assert.doesNotMatch(renderer, /fillText\('窗'/, '不应绘制窗文字');
});
