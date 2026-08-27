import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const configUrl = new URL('../src/config/ward-corridor-scene.ts', import.meta.url);
const config = await readFile(configUrl, 'utf8');
const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('病房走廊使用新的 Draco GLB，并保持 Y-up 坐标', async () => {
  await access(new URL('../public/models/hospital-corridor/3-v-1.glb', import.meta.url));
  await access(new URL('../public/models/hospital-corridor/source/area-source.glb', import.meta.url));
  assert.match(config, /url: '\/models\/hospital-corridor\/3-v-1\.glb\?v=20260827-3v1-model-v1'/);
  assert.match(config, /rotationX: 0/);
});

test('病房走廊切换期间不显示旧备用几何体', () => {
  assert.match(areaScene, /this\.corridorGroup\.visible = false;/);
  assert.match(areaScene, /mesh\.group\.visible = false;/);
});
