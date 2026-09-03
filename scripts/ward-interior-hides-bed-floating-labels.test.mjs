import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const scene = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/components/WardScene3D.vue', import.meta.url), 'utf8');

test('病房内不再创建床位信息卡片和设备状态悬浮标签', () => {
  assert.doesNotMatch(scene, /const label = this\.createBedLabel\(bed\);/);
  assert.doesNotMatch(scene, /new CSS2DObject\(this\.createDeviceTagElement\(bed\)\)/);
  assert.doesNotMatch(scene, /createDeviceTagElement/);
  assert.doesNotMatch(scene, /applyDeviceTagElement/);
  assert.doesNotMatch(style, /bed-device-tag/);
});
