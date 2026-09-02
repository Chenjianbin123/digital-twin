import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const header = readFileSync(
  new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url),
  'utf8',
);

function extractBaseOperatorStyles(source) {
  const marker = '  &__operator {';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, '应能找到顶部用户信息样式');

  const end = source.indexOf('\n  &__actions {', start);
  assert.notEqual(end, -1, '用户信息样式应在操作按钮样式之前结束');

  return source.slice(start, end);
}

test('dashboard header keeps operator name and role on one horizontal line', () => {
  const operatorStyles = extractBaseOperatorStyles(header);

  assert.match(operatorStyles, /display:\s*inline-flex/);
  assert.match(operatorStyles, /align-items:\s*center/);
  assert.match(operatorStyles, /gap:\s*\d+px/);
  assert.match(operatorStyles, /white-space:\s*nowrap/);
});
