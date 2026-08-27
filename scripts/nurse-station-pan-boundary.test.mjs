import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
const sceneConfig = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');

assert.match(sceneConfig, /pan: \{ xLimit: 0\.42, yMin: 0\.42, yMax: 1\.35 \}/);
assert.match(areaScene, /const STATION_TARGET_Z = STATION_TARGET_LOCAL\.z;/);
assert.match(areaScene, /this\.controls\.enablePan = true;/);
assert.match(areaScene, /this\.controls\.screenSpacePanning = true;/);
assert.match(
  areaScene,
  /const clampedX = THREE\.MathUtils\.clamp\(\s*targetLocal\.x,\s*-STATION_PAN_X_LIMIT,\s*STATION_PAN_X_LIMIT,\s*\);/,
);
assert.match(
  areaScene,
  /const clampedY = THREE\.MathUtils\.clamp\(\s*targetLocal\.y,\s*STATION_PAN_Y_MIN,\s*STATION_PAN_Y_MAX,\s*\);/,
);
assert.match(areaScene, /targetLocal\.y = clampedY;/);
assert.match(areaScene, /targetLocal\.z = STATION_TARGET_Z;/);
assert.match(areaScene, /const clampedTarget = this\.worldFromNurseLocal\(targetLocal\);/);
assert.match(areaScene, /const correction = clampedTarget\.clone\(\)\.sub\(this\.controls\.target\);/);
assert.match(areaScene, /this\.controls\.target\.copy\(clampedTarget\);/);
assert.match(areaScene, /this\.camera\.position\.add\(correction\);/);
assert.match(areaScene, /if \(this\.viewPhase === 'station'\)\s*this\.applyStationOrbitCeilingConstraint\(\);/);

console.log('Nurse-station pan boundary checks passed.');
