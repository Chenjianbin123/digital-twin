import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [areaScene, areaSceneComponent] = await Promise.all([
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8'),
]);

assert.match(areaScene, /export interface AreaCameraDebugState/);
assert.match(areaScene, /onCameraState\?: \(state: AreaCameraDebugState\) => void/);
assert.match(areaScene, /private emitCameraDebugState\(\)/);
assert.match(areaScene, /azimuthDeg/);
assert.match(areaScene, /elevationDeg/);
assert.match(areaSceneComponent, /cameraDebugOpen/);
assert.match(areaSceneComponent, /onCameraState: state => \(cameraDebugState\.value = state\)/);
assert.match(areaSceneComponent, /area-scene-3d__camera-debug/);
assert.match(areaSceneComponent, /initialAngle/);
assert.match(areaSceneComponent, /initialDistance/);

console.log('Nurse-station camera debug boundary checks passed.');
