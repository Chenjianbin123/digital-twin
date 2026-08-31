import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站电脑屏幕使用覆盖平面铺满可见屏幕区域', () => {
  assert.match(areaScene, /const overlay = this\.attachNurseStationTextureOverlay\(object, texture, kind, displayRoot\);/);
  assert.doesNotMatch(areaScene, /NurseStationDisplay\] direct bind/);
  assert.match(areaScene, /surfaceGroups/);
  assert.match(areaScene, /深蓝\|Screen_Glass/);
  assert.match(areaScene, /const overlayWidth = Math\.max\(surfaceAxes\[0\]\.size/);
  assert.match(areaScene, /const overlayOpacity = 1;/);
  assert.match(areaScene, /hideNurseStationPlaceholderMaterials/);
  assert.match(areaScene, /if \(\/深蓝\|Screen_Glass\/i\.test\(materialText\)\)/);
});
