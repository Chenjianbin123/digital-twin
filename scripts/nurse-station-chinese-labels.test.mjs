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
const statusConsole = readFileSync(new URL('../src/components/dashboard/NurseStatusConsole.vue', import.meta.url), 'utf8');

test('nurse station hero uses Chinese labels for visible status prompts', () => {
  assert.match(panel, /<GlassWorkspaceTitle title="护士站工作台"/);
  assert.match(statusConsole, /viewModel\.realtime\.label/);
  assert.match(viewModel, /ready: '信息已更新'/);
  assert.match(statusConsole, /status.eventLabel/);
  assert.match(panel, /护士站工作区/);
  assert.doesNotMatch(panel, /NurseStatusConsole/);
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
