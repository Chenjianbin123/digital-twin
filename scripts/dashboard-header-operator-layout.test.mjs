import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const header = readFileSync(
  new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url),
  'utf8',
);
const styles = readFileSync(new URL('../src/components/dashboard/dashboard-header.scss', import.meta.url), 'utf8');

function extractBaseOperatorStyles(source) {
  const sharedRule = source.match(/[^{}]*&__operator[^{}]*\{([^}]*display:\s*inline-flex[^}]*)\}/);
  assert.ok(sharedRule, '应能找到包含用户信息的共用横排样式');
  return sharedRule[1];
}

test('dashboard header keeps operator name and role on one horizontal line', () => {
  assert.match(header, /src="@\/components\/dashboard\/dashboard-header.scss"/);
  const operatorStyles = extractBaseOperatorStyles(styles);

  assert.match(operatorStyles, /display:\s*inline-flex/);
  assert.match(operatorStyles, /align-items:\s*center/);
  assert.match(operatorStyles, /gap:\s*\d+px/);
  assert.match(operatorStyles, /white-space:\s*nowrap/);
});
