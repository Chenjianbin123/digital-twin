import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [app, visualScene, areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationVisualScene.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(sceneConfig, /distance: \{ min: 1\.6, max: 8 \}/);
assert.match(sceneConfig, /azimuthLimit: Math\.PI \/ 12/);
assert.match(sceneConfig, /limitsEnabled:\s*false/);
assert.match(sceneConfig, /floorCameraMargin: 0\.18/);
assert.match(areaScene, /this\.controls\.enableRotate = true;/);
assert.match(areaScene, /this\.controls\.enableZoom = true;/);
assert.match(areaScene, /this\.controls\.enablePan = true;/);
assert.match(areaScene, /this\.controls\.screenSpacePanning = true;/);
assert.match(sceneConfig, /pan: \{ xLimit: 0\.42, yMin: 0\.42, yMax: 1\.35 \}/);
assert.match(areaScene, /this\.controls\.minAzimuthAngle = -Infinity;/);
assert.match(areaScene, /this\.controls\.maxAzimuthAngle = Infinity;/);
assert.match(areaScene, /this\.controls\.minDistance = 0\.1;/);
assert.match(areaScene, /this\.controls\.maxDistance = 1000;/);
assert.match(areaScene, /const STATION_CAMERA_LIMITS_ENABLED = nurseStationSceneConfig\.camera\.limitsEnabled;/);
assert.match(areaScene, /private applyStationOrbitCeilingConstraint\(\)\s*\{[\s\S]*?if \(!STATION_CAMERA_LIMITS_ENABLED\)/);
assert.match(areaScene, /this\.controls\.screenSpacePanning = STATION_CAMERA_LIMITS_ENABLED \? false : true;/);
assert.match(areaScene, /RIGHT: STATION_CAMERA_LIMITS_ENABLED \? THREE\.MOUSE\.ROTATE : THREE\.MOUSE\.PAN,/);
assert.match(areaScene, /TWO: STATION_CAMERA_LIMITS_ENABLED \? THREE\.TOUCH\.DOLLY_ROTATE : THREE\.TOUCH\.DOLLY_PAN,/);

assert.match(app, /const panelsVisible = ref\(true\);/);
assert.match(app, /v-if="isNurseStation \|\| isWard \|\| isWardInterior"/);
assert.match(app, /class="digital-twin__panel-toggle"/);
assert.match(app, /panelsVisible = !panelsVisible/);
assert.match(app, /:overlays-visible="panelsVisible"/);
assert.match(app, /v-show="panelsVisible"/);
assert.match(app, /<DashboardLeftPanel v-if="panelsVisible"/);
assert.match(app, /v-if="isWard && panelsVisible"/);
assert.match(app, /v-if="isWardInterior && currentWard && panelsVisible"/);
assert.match(app, /v-if="activeAlertTask && !isNurseStation && panelsVisible"/);
assert.match(app, /<WardLegend v-if="\(isWard \|\| isWardInterior\) && panelsVisible"/);
assert.match(app, /'digital-twin__main--panels-hidden': !panelsVisible/);
assert.match(app, /'digital-twin__main--interior': isWardInterior/);
assert.match(app, /&__panel-toggle \{[\s\S]*?bottom: 10px;/);
assert.match(app, /&__panel-toggle \{[\s\S]*?min-height: 34px;/);
assert.match(app, /&__panel-toggle \{[\s\S]*?border: 1px solid rgba\(157, 245, 235, 0\.24\);/);
assert.match(app, /&__panel-toggle \{[\s\S]*?@include down\(\$bp-md\) \{[\s\S]*?bottom: calc\(var\(--mobile-panel-height\) \+ 88px \+ env\(safe-area-inset-bottom\)\);/);
assert.match(app, /&__panel-toggle-icon[\s\S]*?&::after/);
assert.match(app, /&__panel-toggle--hidden &__panel-toggle-icon::after/);
assert.match(app, /&__main--panels-hidden &__scene/);

assert.match(visualScene, /overlaysVisible: boolean;/);
assert.doesNotMatch(visualScene, /nurse-station-visual__markers/);
assert.doesNotMatch(visualScene, /class="nurse-station-visual__caption"/);
assert.doesNotMatch(visualScene, /class="nurse-station-visual__caption-mark"/);
assert.doesNotMatch(visualScene, /area\.areaName/);
assert.doesNotMatch(visualScene, /area\.deptName/);
assert.doesNotMatch(visualScene, /class="nurse-station-visual__corridor"/);
assert.match(visualScene, /class="nurse-station-visual__model-state"/);
assert.match(visualScene, /:deep\(\.area-scene-3d__canvas-host\)[\s\S]*?pointer-events: auto;/);
assert.doesNotMatch(visualScene, /:deep\(\.area-scene-3d__reset\)[\s\S]*?display: none;/);

console.log('Nurse-station controls and panel-toggle boundary checks passed.');
