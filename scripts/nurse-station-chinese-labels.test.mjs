import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(
  new URL('../src/components/NurseStationPanel.vue', import.meta.url),
  'utf8',
);
const viewModel = readFileSync(
  new URL('../src/core/nurse-station-view-model.ts', import.meta.url),
  'utf8',
);

test('nurse station hero uses Chinese labels for visible status prompts', () => {
  assert.match(panel, /class="station-hero__eyebrow">护士站工作台<\/span>/);
  assert.match(panel, /viewModel\.realtime\.status !== 'ready'[\s\S]*?viewModel\.realtime\.detail/);
  assert.match(viewModel, /ready: '实时数据'/);
  assert.match(panel, /displayedStationState.label/);
  assert.match(panel, /护士站工作区/);
  assert.match(panel, /workspace-status/);
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
