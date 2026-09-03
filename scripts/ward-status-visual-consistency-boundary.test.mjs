import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const status = readFileSync(new URL('../src/core/bed-status.ts', import.meta.url), 'utf8');
const renderer = readFileSync(new URL('../src/core/plan-renderer.ts', import.meta.url), 'utf8');

test('病房 3D 与 2.5D 使用统一语义状态色', () => {
  assert.match(status, /WARD_BED_STATUS_COLORS/);
  assert.match(status, /occupied:\s*\{ color: '#2FE6A6'/);
  assert.match(status, /empty:\s*\{ color: '#8FA3B8'/);
  assert.match(status, /calling:\s*\{ color: '#FF4D8D'/);
  assert.match(status, /infusing:\s*\{ color: '#FFB84D'/);
  assert.match(status, /offline:\s*\{ color: '#FF6B6B'/);
});

test('2.5D 对异常床位做顶部摘要与卡片优先突出', () => {
  assert.match(renderer, /drawAbnormalSummary/);
  assert.match(renderer, /getAbnormalBeds/);
  assert.match(renderer, /sortBedsForPlan/);
});
