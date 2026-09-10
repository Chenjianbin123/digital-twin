import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const controls = readFileSync(new URL('../src/core/ward-scene-controls.ts', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/config/ward-interior-scene.ts', import.meta.url), 'utf8');

test('病房内左右上下平移有明确边界配置', () => {
  assert.match(config, /pan:\s*\{\s*xSpanFactor:\s*0\.32,\s*zSpanFactor:\s*0\.3,\s*yMin:\s*0\.35,\s*yMax:\s*1\.65\s*\}/);
  assert.match(controls, /pan:\s*\{/);
  assert.match(controls, /xLimit:\s*roomWidth \* controls\.pan\.xSpanFactor/);
  assert.match(controls, /zLimit:\s*roomDepth \* controls\.pan\.zSpanFactor/);
  assert.match(controls, /yMin:\s*controls\.pan\.yMin/);
  assert.match(controls, /yMax:\s*controls\.pan\.yMax/);
});

test('病房内优先用外壳/灯网格钳制，缺失时回退房间平移限制', () => {
  assert.match(scene, /private applyWardInteriorViewBoundsConstraint/);
  assert.match(scene, /private clampWardInteriorPanTarget/);
  assert.match(scene, /captureWardInteriorBoundMeshes\(model\)/);
  assert.match(scene, /clampPointToWardInteriorBounds\(this\.controls\.target/);
  assert.match(scene, /clampPointToWardInteriorBounds\(this\.camera\.position/);
  assert.match(scene, /this\.clampWardInteriorPanTarget\(\);/);
  assert.match(scene, /this\.enforceWardInteriorControlBounds\(\);\s*\/\/ window\.clearTimeout\(this\.cameraViewLogTimer\);/);
  assert.match(scene, /this\.controls\.update\(\);\s*this\.enforceWardInteriorControlBounds\(\);/);
  assert.match(scene, /this\.controls\.target\.lerpVectors\(this\.cameraTransition\.fromTarget, this\.cameraTransition\.toTarget, t\);\s*this\.enforceWardInteriorControlBounds\(\);/);
});

test('病房内拖拽、尺寸变化和相机过渡共用统一边界约束', () => {
  assert.match(scene, /private clampWardInteriorPanTarget/);
  assert.match(scene, /const clampedTarget = this\.controls\.target\.clone\(\);/);
  assert.match(scene, /clampedTarget\.x = THREE\.MathUtils\.clamp\(clampedTarget\.x, -limits\.pan\.xLimit, limits\.pan\.xLimit\);/);
  assert.match(scene, /clampedTarget\.y = THREE\.MathUtils\.clamp\(clampedTarget\.y, limits\.pan\.yMin, limits\.pan\.yMax\);/);
  assert.match(scene, /clampedTarget\.z = THREE\.MathUtils\.clamp\(clampedTarget\.z, -limits\.pan\.zLimit, limits\.pan\.zLimit\);/);
  assert.match(scene, /this\.camera\.position\.add\(correction\);/);
  assert.match(scene, /private onControlsChange[\s\S]*?this\.enforceWardInteriorControlBounds\(\)/);
  assert.match(scene, /this\.controls\.target\.lerpVectors\(this\.cameraTransition\.fromTarget, this\.cameraTransition\.toTarget, t\);[\s\S]*?this\.enforceWardInteriorControlBounds\(\)/);
});
