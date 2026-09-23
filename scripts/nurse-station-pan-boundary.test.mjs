import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
const sceneConfig = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');

assert.match(sceneConfig, /pan: \{ xLimit: 2\.8, yMin: 0\.3, yMax: 1\.85 \}/);
assert.match(sceneConfig, /endWallMesh:\s*"立方体\.005"/);
// Both constrained presentation and unrestricted camera calibration are supported.
assert.match(sceneConfig, /limitsEnabled:\s*(?:true|false)/);
assert.match(areaScene, /this\.controls\.enablePan = true;/);
assert.match(areaScene, /this\.controls\.screenSpacePanning = true;/);
assert.match(areaScene, /this\.controls\.minAzimuthAngle = -Infinity;/);
assert.match(areaScene, /this\.controls\.maxAzimuthAngle = Infinity;/);
assert.match(areaScene, /this\.controls\.minDistance = 0\.1;/);
assert.match(areaScene, /this\.controls\.maxDistance = 1000;/);
assert.match(areaScene, /const STATION_CAMERA_LIMITS_ENABLED = nurseStationSceneConfig\.camera\.limitsEnabled;/);
assert.match(areaScene, /private applyStationOrbitCeilingConstraint\(\)\s*\{[\s\S]*?if \(!STATION_CAMERA_LIMITS_ENABLED\)/);
assert.match(areaScene, /this\.controls\.screenSpacePanning = true;/);
assert.match(areaScene, /按对峙轴向取内表面/);
assert.match(areaScene, /slidePointIntoNurseStationBounds/);
assert.match(areaScene, /slideStationCameraAlongBounds/);
assert.match(areaScene, /stationCameraInteracted/);
assert.match(areaScene, /端头 立方体\.005/);
assert.doesNotMatch(areaScene, /expandNurseStationBoundsToIncludeInitialView/);
assert.doesNotMatch(areaScene, /getNurseStationZoomOutLimit/);

console.log('Nurse-station pan boundary checks passed.');
