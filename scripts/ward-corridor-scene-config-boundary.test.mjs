import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('病房走廊场景参数集中在独立配置文件中', async () => {
  const config = await projectFile('src/config/ward-corridor-scene.ts');

  assert.match(config, /export const wardCorridorSceneConfig/);
  assert.match(config, /3-v4\.glb\?v=20260827-3v1-model-v1/);
  assert.match(config, /rotationX: 0/);
  assert.match(config, /slotCount: 10/);
  assert.match(config, /doorNodeNames: \[[\s\S]*?"门1"[\s\S]*?"门10"[\s\S]*?\]/);
  assert.match(config, /entranceDeviceNodeNames: \[[\s\S]*?"门口机1"[\s\S]*?"门口机10"[\s\S]*?\]/);
  assert.match(config, /canvasTextureFlipY: false/);
  assert.match(config, /background: 0x0a1218/);
  assert.match(config, /lightBackground: 0xf7f3ec/);
  assert.match(config, /themeMaterials:/);
  assert.match(config, /"椅子\.003": 0x7cbdee/);
  assert.match(config, /"材质\.008": 0xff9a14/);
  assert.match(config, /exposure: 1\.2/);
  assert.match(config, /envMapIntensity: 0\.7/);
  assert.match(config, /environmentIntensity: 0\.36/);
  assert.match(config, /floorMeshName: "地板"/);
  assert.match(config, /floorStripeColorScale: 0\.42/);
  assert.match(config, /viewBounds:/);
  assert.match(config, /ceilingMesh: "天花板"/);
  assert.match(config, /wallMeshes: \["墙壁", "墙壁2"\]/);
  assert.match(config, /ceilingHeight: 2\.85/);
  assert.match(config, /halfWidth: 3\.2/);
  assert.match(config, /doorWidth: 2\.1/);
  assert.match(config, /doorHeight: 2\.5/);
});

test('病房走廊核心模块均消费统一配置', async () => {
  const [model, camera, controls, scene] = await Promise.all([
    projectFile('src/core/ward-corridor-model.ts'),
    projectFile('src/core/ward-corridor-camera.ts'),
    projectFile('src/core/area-corridor-controls.ts'),
    projectFile('src/core/area-scene.ts'),
  ]);

  for (const source of [model, camera, controls, scene])
    assert.match(source, /wardCorridorSceneConfig/);
  assert.match(model, /wardCorridorSceneConfig\.model/);
  assert.match(camera, /wardCorridorSceneConfig\.camera\.modelBoundsView/);
  assert.match(controls, /wardCorridorSceneConfig\.controls/);
  assert.match(scene, /wardCorridorSceneConfig\.fallbackGeometry/);
  assert.match(scene, /wardCorridorSceneConfig\.camera\.overviewFov/);
  assert.match(scene, /dimHospitalCorridorFloorStripes/);
  assert.match(model, /createCorridorTheme/);
  assert.match(scene, /createCorridorTheme/);
  assert.match(scene, /this\.corridorTheme/);
  assert.match(model, /polishHospitalCorridorMaterials/);
  assert.match(scene, /polishHospitalCorridorMaterials/);
  assert.match(scene, /PCFSoftShadowMap/);
  assert.match(scene, /fitCorridorKeyShadow/);
  assert.match(scene, /configureCorridorShadowCasters/);
});
