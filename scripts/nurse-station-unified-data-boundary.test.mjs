import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, metrics, liveData] = await Promise.all([
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-metrics.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-live-data.ts', import.meta.url), 'utf8'),
]);

assert.match(panel, /buildNurseStationLiveData/);
assert.match(panel, /calling: callKeys\.size/);
assert.match(panel, /hiddenAlertTasks/);
assert.doesNotMatch(panel, /buildNurseStationMetrics/);
assert.match(metrics, /buildNurseStationLiveData/);
assert.doesNotMatch(metrics, /resolveBedStatus/);
assert.match(liveData, /state:/);
assert.match(liveData, /deviceHealthRate/);
assert.match(liveData, /offlineDeviceCount/);
assert.match(liveData, /lowBatteryDeviceCount/);
assert.match(panel, /台设备离线/);
assert.match(panel, /台设备低电量/);

console.log('Nurse-station unified data boundary checks passed.');
