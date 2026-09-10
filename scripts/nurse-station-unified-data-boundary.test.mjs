import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, panel, metrics, liveData, viewModel, areaScene] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-metrics.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-live-data.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-view-model.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(app, /buildNurseStationViewModel/);
assert.match(panel, /viewModel: NurseStationViewModel/);
assert.match(panel, /props\.viewModel\.metrics/);
assert.doesNotMatch(panel, /buildNurseStationMetrics/);
assert.match(metrics, /buildNurseStationLiveData/);
assert.doesNotMatch(metrics, /resolveBedStatus/);
assert.match(liveData, /state:/);
assert.match(liveData, /deviceHealthRate/);
assert.match(liveData, /offlineDeviceCount/);
assert.match(liveData, /lowBatteryDeviceCount/);
assert.match(panel, /台设备离线/);
assert.match(panel, /台设备低电量/);
assert.match(viewModel, /physicalCallKey/);
assert.match(viewModel, /event\.areaId === input\.areaId/);
assert.match(areaScene, /setNurseStationViewModel/);
assert.match(areaScene, /getNurseStationSummaries/);

console.log('Nurse-station unified data boundary checks passed.');
