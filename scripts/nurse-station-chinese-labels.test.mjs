import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(
  new URL('../src/components/NurseStationPanel.vue', import.meta.url),
  'utf8',
);

test('nurse station hero uses Chinese labels for visible status prompts', () => {
  assert.match(panel, /class="station-hero__eyebrow">护士站指挥中心<\/span>/);
  assert.match(panel, /class="station-hero__status-live"[\s\S]*?实时数据/);
  assert.match(panel, /return "需要立即处理"/);
  assert.match(panel, /return "需要复核"/);
  assert.match(panel, /return "系统运行正常"/);
  assert.doesNotMatch(panel, /NURSE COMMAND|LIVE DATA|ACTION REQUIRED|REVIEW REQUIRED|SYSTEM ONLINE/);
});

test('nurse station hero labels stay on one line', () => {
  const eyebrowStart = panel.indexOf('  &__eyebrow {');
  assert.notEqual(eyebrowStart, -1, '应能找到护士站标题样式');
  const eyebrowStyles = panel.slice(eyebrowStart, panel.indexOf('}', eyebrowStart) + 1);
  assert.match(eyebrowStyles, /white-space:\s*nowrap/);

  const liveStart = panel.indexOf('    &-live {');
  assert.notEqual(liveStart, -1, '应能找到实时状态样式');
  const liveStyles = panel.slice(liveStart, panel.indexOf('}', liveStart) + 1);
  assert.match(liveStyles, /white-space:\s*nowrap/);
});
