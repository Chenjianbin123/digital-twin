import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [workflow, store, wardScene] = await Promise.all([
  readFile(new URL('../src/core/alert-workflow.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/WardScene3D.vue', import.meta.url), 'utf8'),
]);

assert.match(workflow, /ALERT_FOCUS_DURATION_MS = 8_000/);
assert.match(workflow, /createAlertFocus/);
assert.match(workflow, /isAlertFocusExpired/);
assert.match(workflow, /isAlertFocusForTask/);
assert.match(store, /focusAlertBed/);
assert.match(store, /clearAlertFocusSelection/);
assert.match(store, /isAlertFocusForTask\(alertFocus\.value, taskId\)/);
assert.match(wardScene, /selectedBedCode/);
assert.match(wardScene, /scene\.setSelectedBedCode/);

console.log('Alert scene focus boundary checks passed.');
