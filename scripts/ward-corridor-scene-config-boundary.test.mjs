import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('病房走廊场景参数集中在独立配置文件中', async () => {
  const config = await projectFile('src/config/ward-corridor-scene.ts');

  assert.match(config, /export const wardCorridorSceneConfig/);
  assert.match(config, /3-v-1\.glb\?v=20260827-3v1-model-v1/);
  assert.match(config, /rotationX: 0/);
  assert.match(config, /slotCount: 10/);
  assert.match(config, /doorNodeNames: \['门1', '门2', '门3', '门4', '门5', '门6', '门7', '门8', '门9', '门10'\]/);
  assert.match(config, /entranceDeviceNodeNames: \['门口机1', '门口机2', '门口机3', '门口机4', '门口机5', '门口机6', '门口机7', '门口机8', '门口机9', '门口机10'\]/);
  assert.match(config, /canvasTextureFlipY: false/);
  assert.match(config, /background: 0x0a1218/);
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
});
