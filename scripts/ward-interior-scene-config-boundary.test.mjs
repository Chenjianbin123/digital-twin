import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('病房内部场景参数集中在独立配置文件中', async () => {
  const config = await projectFile('src/config/ward-interior-scene.ts');

  assert.match(config, /export const wardInteriorSceneConfig/);
  assert.match(config, /room-refined-v1\.glb\?v=20260917/);
  assert.match(config, /baseSize: \{ width: 12, height: 3\.92, depth: 9 \}/);
  assert.match(config, /height: 4\.2/);
  assert.match(config, /position: \[0\.5, 2\.4, 3\.95\], target: \[-1\.3, 1\.4, 0\.25\]/);
  assert.match(config, /referenceAspect: 0\.92/);
  assert.match(config, /background: 0xd8d2c8/);
  assert.match(config, /exposure: 1\.12/);
  assert.match(config, /baseFogDensity: 0/);
  assert.match(config, /envMapIntensity: 0\.18/);
  assert.match(config, /maxMetalness: 0\.32/);
  assert.match(config, /shellMesh: '外壳'/);
  assert.match(config, /lightMesh: '灯'/);
  assert.match(config, /baseWidth: 3\.92/);
  assert.match(config, /maxBeds: 7/);
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
