import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站屏幕绑定日志包含可定位覆盖层的关键字段', () => {
  const bindingLog = areaScene.slice(
    areaScene.indexOf("console.info('[NurseStationDisplay] bound'"),
    areaScene.indexOf("if (!this.nurseStationBoardDisplays.length"),
  );
  assert.match(bindingLog, /displayRootName/);
  assert.match(bindingLog, /selectedMaterial/);
  assert.match(areaScene, /门口机内/);
  assert.match(areaScene, /Nursing_Whiteboard\|Whiteboard_Ink/);
  assert.match(areaScene, /preferredMaterialPattern/);
  assert.match(areaScene, /preferredMaterialPattern\.test\(materialText\)/);
  assert.match(bindingLog, /overlayWidth/);
  assert.match(bindingLog, /overlayHeight/);
  assert.match(bindingLog, /depthAxis/);
  assert.match(bindingLog, /overlayPosition/);
  assert.match(bindingLog, /overlayParent/);
});
