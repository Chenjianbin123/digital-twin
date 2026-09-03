import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('护士站主屏会隐藏模型内置的静态大字占位内容', () => {
  const hidePlaceholderMaterials = areaScene.slice(
    areaScene.indexOf('private hideNurseStationPlaceholderMaterialsOnMesh('),
    areaScene.indexOf('private hideNurseStationStaticBoardContent('),
  );
  const hideStaticContent = areaScene.slice(
    areaScene.indexOf('private hideNurseStationStaticBoardContent('),
    areaScene.indexOf('private refreshNurseStationBoardDisplays('),
  );
  assert.match(hidePlaceholderMaterials, /Screen_Main_Frame/);
  assert.match(hidePlaceholderMaterials, /mesh\.parent\?\.name/);
  assert.match(hidePlaceholderMaterials, /白偏蓝/);
  for (const name of [
    'Detail_Header_Left_Text',
    'Detail_Header_Right_Text',
    'Detail_Header_Subtitle',
    'Detail_Header_Title',
    'Main_Board_Title',
    'Main_Board_Beds',
    'Main_Board_Tasks',
    'Main_Board_Bar_',
  ]) {
    assert.match(hideStaticContent, new RegExp(`'${name}'`));
  }
  for (const name of [
    'Nursing_Board_Title',
    'Patient_Status_Bar_02',
    'Detail_Header_Accent',
    'Detail_Header_Center',
    'Detail_Header_Left',
    'Detail_Header_Right',
  ]) {
    assert.doesNotMatch(hideStaticContent, new RegExp(`'${name}'`));
  }
});
