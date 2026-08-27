import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
const areaComponent = await readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8');

test('病房走廊复用相机参数输出并显示调试面板', () => {
  assert.match(areaScene, /this\.viewPhase !== 'station' && this\.viewPhase !== 'corridor'/);
  assert.match(areaScene, /this\.emitCameraDebugState\(\);\s*\n\s*}/);
  assert.match(areaComponent, /areaPhase\.value === 'station' \|\| areaPhase\.value === 'corridor'/);
  assert.match(areaComponent, /病房走廊视角参数/);
});

