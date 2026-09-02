import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wardScene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const cameraPresets = readFileSync(new URL('../src/core/camera-presets.ts', import.meta.url), 'utf8');
const wardControls = readFileSync(new URL('../src/core/ward-scene-controls.ts', import.meta.url), 'utf8');
const wardConfig = readFileSync(new URL('../src/config/ward-interior-scene.ts', import.meta.url), 'utf8');

test('病房内视角使用开放的缩放与旋转控制', () => {
  assert.match(wardScene, /resolveWardSceneControlLimits\(this\.roomW, this\.roomD\)/);
  assert.match(wardControls, /wardInteriorSceneConfig\.controls/);
  assert.match(wardConfig, /minDistance: 1\.1/);
  assert.match(wardConfig, /minAzimuthAngle: -Infinity/);
  assert.match(wardConfig, /maxAzimuthAngle: Infinity/);
});

test('病房默认视角降低并更靠近床区', () => {
  assert.match(cameraPresets, /wardInteriorSceneConfig\.camera\.presets/);
  assert.match(wardConfig, /position: \[6\.4, 4\.8, 8\.8\], target: \[0, 1, -0\.8\]/);
});

test('窄屏按视口倍率后退并同步选床聚焦距离', () => {
  assert.match(wardScene, /resolveWardCameraViewportScale\(this\.camera\.aspect\)/);
  assert.match(wardScene, /preset\.position\[1\] \* \(0\.92 \+ scale \* 0\.08\) \* viewportScale/);
  assert.match(wardScene, /offset\.multiplyScalar\(viewportScale\)/);
  assert.match(wardScene, /nextViewportScale \/ previousViewportScale/);
});

test('动画每帧只消耗一次时钟增量以保证相机过渡完成', () => {
  assert.match(wardScene, /this\.timer\.update\(timestamp\);\n\s*if \(this\.pageHidden\)/);
  assert.match(wardScene, /const delta = this\.timer\.getDelta\(\);\n\s*const elapsed = this\.timer\.getElapsed\(\);/);
  assert.doesNotMatch(wardScene, /new THREE\.Clock\(\)/);
});

test('容器零尺寸时不写入无效相机宽高比', () => {
  assert.match(wardScene, /if \(width <= 0 \|\| height <= 0\)\n\s*return;/);
});

test('入口墙体和场景辅助线降低遮挡', () => {
  assert.match(wardScene, /const frontWallMat = wallMat\.clone\(\)/);
  assert.match(wardScene, /frontWallMat\.opacity = 0\.18/);
  assert.match(wardScene, /opacity: 0\.16/);
  assert.match(wardScene, /opacity: 0\.08/);
});
