import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('nurse station live screens do not invent fixed contact or visit data', async () => {
  const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
  const details = await readFile(new URL('../src/core/hospital-scene-details.ts', import.meta.url), 'utf8');
  assert.match(source, /buildNurseStationLiveData/);
  assert.match(source, /\['whiteboard', \['Board_Nursing', 'Nursing_Board_Title'\]\]/);
  assert.match(source, /\['roomStatus', \['Board_Patient_Status', 'Patient_Status_Bar_02'\]\]/);
  assert.match(source, /\['taskQueue', \['Screen_Work_01', 'Monitor_UI_01_00'\]\]/);
  assert.match(source, /\['deviceHealth', \['Screen_Work_04', 'Monitor_Frame_04'\]\]/);
  assert.match(source, /暂无公告/);
  assert.match(source, /暂无数据/);
  assert.doesNotMatch(source, /内线 119/);
  assert.doesNotMatch(source, /探视时间 14:00-19:00/);
  assert.doesNotMatch(details, /内线 119/);
  assert.doesNotMatch(details, /探视请遵守规定时间/);
});

test('dynamic rear boards hide Blender static labels before adding live overlays', async () => {
  const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
  const hideStaticContent = source.slice(
    source.indexOf('private hideNurseStationStaticBoardContent('),
    source.indexOf('private refreshNurseStationBoardDisplays('),
  );
  assert.match(source, /hideNurseStationStaticBoardContent\(model\)/);
  assert.match(source, /NURSE_STATION_PRESERVED_PLACEHOLDER_OBJECTS/);
  assert.match(source, /NURSE_STATION_PRESERVED_PLACEHOLDER_OBJECTS\.has\(object\.name\)/);
  assert.match(source, /'Nursing_Board_Title'/);
  assert.match(source, /'Patient_Status_Bar_02'/);
  assert.match(source, /'Detail_Header_Center'/);
  assert.match(source, /'Detail_Header_Accent'/);
  assert.doesNotMatch(hideStaticContent, /'Nursing_Board_Title'/);
  assert.doesNotMatch(hideStaticContent, /'Patient_Status_Bar_02'/);
  assert.doesNotMatch(hideStaticContent, /'Detail_Header_Center'/);
  assert.doesNotMatch(hideStaticContent, /'Detail_Header_Left'/);
  assert.doesNotMatch(hideStaticContent, /'Detail_Header_Right'/);
  assert.doesNotMatch(hideStaticContent, /'Detail_Header_Accent'/);
  assert.match(hideStaticContent, /Nursing_Bed_/);
  assert.match(hideStaticContent, /Nursing_Row_/);
  assert.match(hideStaticContent, /Nursing_Level_/);
  assert.match(hideStaticContent, /Patient_Board_Title/);
  assert.match(hideStaticContent, /Patient_Room_/);
  assert.match(hideStaticContent, /Patient_Status_Dot_/);
  assert.match(hideStaticContent, /Patient_Status_Bar_/);
});
