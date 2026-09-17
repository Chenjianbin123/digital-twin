import { readWorkspaceSource } from './helpers/read-workspace-source.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, panel, styles] = await Promise.all([
  readWorkspaceSource(),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/dashboard.scss', import.meta.url), 'utf8'),
]);

assert.match(app, /NURSE_STATION_WALLBOARD_KEY/);
assert.match(app, /nurseStationWallboard/);
assert.match(app, /nurse-station-wallboard/);
assert.match(app, /set-wallboard/);
assert.match(panel, /wallboard\??:\s*boolean/);
assert.match(panel, /大屏模式/);
assert.match(panel, /返回工作台/);
assert.match(panel, /setWallboard/);
assert.match(styles, /digital-twin__main--wallboard/);

console.log('Nurse-station wallboard boundary checks passed.');
