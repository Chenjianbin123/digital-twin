import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nurseStation = readFileSync(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8');
const alertPanel = readFileSync(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8');

test('nurse-station text does not use unreadable sub-12px sizes', () => {
  const undersizedText = /font-size:\s*(?:[0-9]|1[01])px/;
  assert.doesNotMatch(nurseStation, undersizedText);
  assert.doesNotMatch(alertPanel, undersizedText);
  assert.match(nurseStation, /&--wallboard[\s\S]*?font-size: dash-font\(14\)/);
});

test('primary nurse-station controls expose at least a 40px hit target', () => {
  assert.match(nurseStation, /&__wallboard-toggle[\s\S]*?min-width: 40px;[\s\S]*?min-height: 40px;/);
  assert.match(nurseStation, /&__chips[\s\S]*?button[\s\S]*?min-width: 40px;[\s\S]*?min-height: 40px;/);
  assert.match(nurseStation, /&__rooms[\s\S]*?button \{[\s\S]*?min-height: 44px;/);
  assert.match(alertPanel, /&__filters[\s\S]*?button \{[\s\S]*?min-width: 40px;[\s\S]*?min-height: 40px;/);
  assert.match(alertPanel, /\.alert-task[\s\S]*?button \{[\s\S]*?min-width: 58px;[\s\S]*?min-height: 40px;/);
});

test('alert filters implement complete keyboard tab semantics', () => {
  assert.match(alertPanel, /role="tablist"/);
  assert.match(alertPanel, /role="tab"/);
  assert.match(alertPanel, /:aria-controls="`\$\{filterTabsId\}-panel`"/);
  assert.match(alertPanel, /:tabindex="filter === option\.key \? 0 : -1"/);
  assert.match(alertPanel, /role="tabpanel"/);
  assert.match(alertPanel, /:aria-labelledby="filterTabId\(filter\)"/);
  assert.match(alertPanel, /ArrowRight/);
  assert.match(alertPanel, /ArrowLeft/);
  assert.match(alertPanel, /event\.preventDefault\(\)/);
});
