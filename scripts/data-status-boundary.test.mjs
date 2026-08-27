import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, header, store, nurseStation, dataStatus] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/data-status.ts', import.meta.url), 'utf8'),
]);

assert.match(app, /dataStatus/);
assert.match(app, /lastFetchedAtMs/);
assert.match(app, /dataStatusNow/);
assert.match(app, /data-status/);
assert.match(header, /dataStatus/);
assert.match(header, /已过期/);
assert.match(store, /dataPhase/);
assert.match(dataStatus, /buildDataHealthSummary/);
assert.match(dataStatus, /床位与患者/);
assert.match(nurseStation, /数据未完全同步，暂不能判断病区运行正常/);
assert.match(nurseStation, /暂不能确认本班无待交接事项/);

console.log('Data status boundary checks passed.');
