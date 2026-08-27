import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, panel, station, store] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(app, /仅在当前浏览器隐藏这条呼叫/);
assert.match(app, /storage/);
assert.match(panel, /查看全部任务/);
assert.match(panel, /收起任务/);
assert.match(panel, /alert-task__ghost--handling/);
assert.match(panel, /alert-task--swp-call/);
assert.match(panel, /alert-task__signal/);
assert.match(panel, /alert-task__scan/);
assert.match(panel, /alert-task__meta-live/);
assert.match(panel, /@keyframes alert-card-enter/);
assert.match(panel, /@keyframes alert-card-scan/);
assert.match(panel, /@keyframes alert-call-ring/);
assert.match(panel, /prefers-reduced-motion: reduce/);
assert.match(station, /呼叫提醒/);
assert.match(station, /:max-items="4"/);
assert.match(station, /calling: callKeys\.size/);
assert.ok(
  (store.match(/if \(!task \|\| isDisplayOnlySwpCall\(task\)\)\s*return;/g) ?? []).length >= 1,
);
assert.match(store, /活动任务只能由真实来源状态恢复后自动结束/);
assert.doesNotMatch(store, /void setAlertTaskStatus\(taskId, 'resolved'\)/);
assert.match(store, /notifyNewSwpCalls/);

console.log('SWP call safety UI boundary checks passed.');
