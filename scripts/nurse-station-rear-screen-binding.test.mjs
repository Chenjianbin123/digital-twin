import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('rear dynamic screens are not treated as preserved static placeholders', () => {
  const preservedSet = source.slice(
    source.indexOf('const NURSE_STATION_PRESERVED_PLACEHOLDER_OBJECTS = new Set(['),
    source.indexOf(']);', source.indexOf('const NURSE_STATION_PRESERVED_PLACEHOLDER_OBJECTS = new Set([')) + 3,
  );
  assert.doesNotMatch(preservedSet, /Nursing_Board_Title/);
  assert.doesNotMatch(preservedSet, /Patient_Status_Bar_02/);
  assert.match(source, /NURSE_STATION_DYNAMIC_BOARD_OBJECTS/);
});

test('rear screen bindings keep the model surface as a locator and create live overlays', () => {
  const attach = source.slice(
    source.indexOf('private attachNurseStationBoardDisplays('),
    source.indexOf('/** 隐藏 GLB 电脑屏', source.indexOf('private attachNurseStationBoardDisplays(')),
  );
  assert.match(attach, /const overlay = this\.attachNurseStationTextureOverlay\(object, texture, kind, displayRoot\)/);
  assert.match(attach, /this\.nurseStationBoardDisplays\.push\(\{ kind, screen: overlay, texture/);
  assert.match(attach, /const displayRoot = exactObjectName \? model\.getObjectByName\(exactObjectName\) : object/);
});

console.log('Nurse-station rear screen binding checks passed.');
