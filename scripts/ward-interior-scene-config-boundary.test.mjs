import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('病房内部场景参数集中在独立配置文件中', async () => {
  const config = await projectFile('src/config/ward-interior-scene.ts');

  assert.match(config, /export const wardInteriorSceneConfig/);
  assert.match(config, /room-v1\.glb\?v=20260901-room-v1-native/);
  assert.match(config, /baseSize: \{ width: 12, height: 3\.92, depth: 9 \}/);
  assert.match(config, /height: 4\.2/);
  assert.match(config, /position: \[6\.4, 4\.8, 8\.8\], target: \[0, 1, -0\.8\]/);
  assert.match(config, /referenceAspect: 0\.92/);
  assert.match(config, /background: 0xd8d2c8/);
  assert.match(config, /baseFogDensity: 0/);
  assert.match(config, /envMapIntensity: 0\.22/);
  assert.match(config, /maxMetalness: 0\.78/);
  assert.match(config, /baseWidth: 3\.92/);
  assert.match(config, /maxBeds: 6/);
});

test('病房内部核心模块均消费统一配置', async () => {
  const [model, camera, controls, scene] = await Promise.all([
    projectFile('src/core/ward-interior-model.ts'),
    projectFile('src/core/camera-presets.ts'),
    projectFile('src/core/ward-scene-controls.ts'),
    projectFile('src/core/ward-scene.ts'),
  ]);

  for (const source of [model, camera, controls, scene])
    assert.match(source, /wardInteriorSceneConfig/);
  assert.match(model, /wardInteriorSceneConfig\.modelBedLayout/);
  assert.match(camera, /wardInteriorSceneConfig\.camera\.presets/);
  assert.match(controls, /wardInteriorSceneConfig\.controls/);
  assert.match(scene, /wardInteriorSceneConfig\.appearance/);
  assert.match(scene, /wardInteriorSceneConfig\.camera/);
});

