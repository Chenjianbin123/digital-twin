import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const panel = readFileSync(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8');
const nurseStationPanel = readFileSync(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8');

test('SWP alert cards expose concise nurse-facing information', () => {
  assert.match(panel, /task\.startedAt/);
  assert.match(panel, /formatTaskOccurredAt/);
  assert.doesNotMatch(panel, /请在管理机或话机接听/);
  assert.match(panel, /呼叫中/);
  assert.doesNotMatch(panel, /task\.isSuspectedStale/);
  assert.doesNotMatch(panel, /疑似历史未结束/);
  assert.doesNotMatch(panel, /缺少房间\/床位编码/);
  assert.doesNotMatch(panel, /房间\/床位编码未匹配/);
  assert.doesNotMatch(panel, /位置已匹配/);
  assert.doesNotMatch(panel, /接口持续返回中/);
  assert.doesNotMatch(panel, /实时呼叫/);
  assert.doesNotMatch(panel, /接收终端/);
  assert.match(panel, /alert-task--waiting-attention/);
  assert.match(panel, /alert-task--waiting-urgent/);
});

test('active SWP calls cannot be locally resolved from the alert card', () => {
  assert.doesNotMatch(panel, /task\.resolveText \?\? '完成'/);
  assert.match(panel, /等待状态恢复后自动结束/);
  assert.match(panel, /v-if="!isDisplayOnlySwpCall\(task\)"/);
});

test('nurse station distinguishes stale event data from live event data', () => {
  assert.match(nurseStationPanel, /当前显示最近一次数据/);
  assert.match(nurseStationPanel, /呼叫数据已同步/);
});
