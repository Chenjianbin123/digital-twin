import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(sceneConfig, /limitsEnabled:\s*false/);
assert.match(areaScene, /const STATION_CAMERA_LIMITS_ENABLED = nurseStationSceneConfig\.camera\.limitsEnabled;/);
assert.match(
  areaScene,
  /if \(!STATION_CAMERA_LIMITS_ENABLED\)\s*\{[\s\S]*?minPolarAngle = 0;[\s\S]*?maxPolarAngle = Math\.PI;[\s\S]*?minAzimuthAngle = -Infinity;[\s\S]*?maxAzimuthAngle = Infinity;[\s\S]*?minDistance = 0\.1;[\s\S]*?maxDistance = 1000;/,
);
assert.match(areaScene, /screenSpacePanning = STATION_CAMERA_LIMITS_ENABLED \? false : true;/);
assert.match(areaScene, /RIGHT: STATION_CAMERA_LIMITS_ENABLED \? THREE\.MOUSE\.ROTATE : THREE\.MOUSE\.PAN,/);
assert.match(areaScene, /TWO: STATION_CAMERA_LIMITS_ENABLED \? THREE\.TOUCH\.DOLLY_ROTATE : THREE\.TOUCH\.DOLLY_PAN,/);

console.log('Nurse-station camera unlocked boundary checks passed.');
