import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [ack, store, panel, app] = await Promise.all([
  readFile(new URL('../src/core/alert-ack.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
]);

assert.match(ack, /syncState: 'pending'/);
assert.match(ack, /updateAlertAckSyncState/);
assert.match(store, /setAlertOperator/);
assert.match(store, /'synced'/);
assert.match(store, /'failed'/);
assert.match(store, /'local'/);
assert.match(panel, /同步失败/);
assert.match(panel, /本地保存/);
assert.match(app, /setAlertOperator/);

console.log('Alert closure boundary checks passed.');
