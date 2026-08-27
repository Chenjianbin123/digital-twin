import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('nurse station live screens do not invent fixed contact or visit data', async () => {
  const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
  const details = await readFile(new URL('../src/core/hospital-scene-details.ts', import.meta.url), 'utf8');
  assert.match(source, /buildNurseStationLiveData/);
  assert.match(source, /\['whiteboard', 'Board_Nursing'\]/);
  assert.match(source, /\['roomStatus', 'Board_Patient_Status'\]/);
  assert.match(source, /\['taskQueue', 'Screen_Work_01'\]/);
  assert.match(source, /\['deviceHealth', 'Screen_Work_04'\]/);
  assert.match(source, /暂无公告/);
  assert.match(source, /暂无数据/);
  assert.doesNotMatch(source, /内线 119/);
  assert.doesNotMatch(source, /探视时间 14:00-19:00/);
  assert.doesNotMatch(details, /内线 119/);
  assert.doesNotMatch(details, /探视请遵守规定时间/);
});

test('dynamic rear boards hide Blender static labels before adding live overlays', async () => {
  const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');
  assert.match(source, /hideNurseStationStaticBoardContent\(model\)/);
  assert.match(source, /Nursing_Board_Title/);
  assert.match(source, /Nursing_Bed_/);
  assert.match(source, /Nursing_Row_/);
  assert.match(source, /Nursing_Level_/);
  assert.match(source, /Patient_Board_Title/);
  assert.match(source, /Patient_Room_/);
  assert.match(source, /Patient_Status_Dot_/);
  assert.match(source, /Patient_Status_Bar_/);
});
