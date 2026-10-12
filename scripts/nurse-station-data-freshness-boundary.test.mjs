import { readWorkspaceSource } from './helpers/read-workspace-source.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, app, dataStatus, viewModel] = await Promise.all([
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readWorkspaceSource(),
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
const statusConsole = await readFile(new URL('../src/components/dashboard/NurseStatusConsole.vue', import.meta.url), 'utf8');
assert.doesNotMatch(panel, /NurseStatusConsole/);
assert.match(statusConsole, /source\.statusLabel/);
assert.match(statusConsole, /source\.reasons/);
assert.match(statusConsole, /source\.syncedAt/);
assert.match(panel, /freshnessTimeLabel/);
assert.match(panel, /最近更新/);
assert.match(app, /lastFetchedAtMs/);
assert.match(app, /wardDataSyncedAtMs:/);

console.log('Nurse-station data freshness boundary checks passed.');
