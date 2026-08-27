import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [apiExists, builderExists, store, panel, wardPanel, app, workflow] = await Promise.all([
  readFile(new URL('../src/api/swp-call-report.ts', import.meta.url), 'utf8').then(() => true).catch(() => false),
  readFile(new URL('../src/core/swp-call-report.ts', import.meta.url), 'utf8').then(() => true).catch(() => false),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/alert-workflow.ts', import.meta.url), 'utf8'),
]);

assert.equal(apiExists, false);
assert.equal(builderExists, false);
assert.doesNotMatch(store, /reportSwpCallAnswered|saveCallEvent|接听上报/);
assert.match(store, /isDisplayOnlySwpCall/);
assert.match(store, /if \(!task \|\| isDisplayOnlySwpCall\(task\)\)\s*return;/);
assert.match(store, /synced = false/);
assert.doesNotMatch(store, /已查看/);
assert.doesNotMatch(panel, /已查看/);
assert.match(panel, /呼叫中/);
assert.doesNotMatch(panel, /请在管理机或话机接听/);
assert.match(panel, /v-if="!isDisplayOnlySwpCall\(task\)"/);
assert.doesNotMatch(panel, /重试接听/);
assert.match(wardPanel, /v-if="!isDisplayOnlySwpCall\(activeAlertTask\)/);
assert.match(wardPanel, /等待状态恢复后自动结束/);
assert.doesNotMatch(app, /已查看/);
assert.match(app, /呼叫中/);
assert.match(app, /等待状态恢复后自动结束/);
assert.doesNotMatch(app, /重试接听/);
assert.doesNotMatch(workflow, /resolveText: '本地隐藏'/);
assert.match(workflow, /export function collectLocallyHiddenSwpAlertTasks[\s\S]*?return \[\];/);

console.log('SWP call display-only boundary checks passed.');
