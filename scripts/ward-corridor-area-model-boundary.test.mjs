import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { wardCorridorSceneConfig as config } from '../src/config/ward-corridor-scene.ts';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('病房走廊使用新的 Draco GLB，并保持 Y-up 坐标', async () => {
  await access(new URL(`../public${config.model.url.split('?')[0]}`, import.meta.url));
  assert.match(config.model.url, /corridor-reference-v2\.glb\?v=/);
  assert.equal(config.model.rotationX, 0);
});

test('病房走廊切换期间不显示旧备用几何体', () => {
  assert.match(areaScene, /const showFallback = this\.viewPhase === 'corridor' && this\.wardCorridorModelFailed/);
  assert.match(areaScene, /this\.corridorGroup\.visible = showFallback/);
  assert.match(areaScene, /mesh\.group\.visible = showFallback/);
});
