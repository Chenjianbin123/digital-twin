import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, app, dataStatus, viewModel] = await Promise.all([
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/data-status.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-view-model.ts', import.meta.url), 'utf8'),
]);

assert.match(dataStatus, /buildDataFreshnessItems/);
assert.match(dataStatus, /label: '病区数据'/);
assert.match(dataStatus, /label: '呼叫报警'/);
assert.match(dataStatus, /label: '响应指标'/);
assert.match(dataStatus, /label: '巡视记录'/);
assert.match(viewModel, /buildDataFreshnessItems/);
assert.match(viewModel, /realtime:/);
assert.match(panel, /props\.viewModel\.dataFreshnessItems/);
assert.match(panel, /viewModel\.realtime\.label/);
assert.match(panel, /freshnessTimeLabel/);
assert.match(panel, /最近同步/);
assert.match(app, /lastFetchedAtMs/);
assert.match(app, /wardDataSyncedAtMs:/);

console.log('Nurse-station data freshness boundary checks passed.');
