import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站顶部主屏使用左中右三栏布局', () => {
  const dashboard = areaScene.slice(
    areaScene.indexOf('private createNurseRearDashboardTexture()'),
    areaScene.indexOf('private createNurseRearPriorityTexture()'),
  );
  assert.match(dashboard, /病区概览/);
  assert.match(dashboard, /患者动态/);
  assert.match(dashboard, /设备状态/);
  assert.match(dashboard, /const columnWidth =/);
});
