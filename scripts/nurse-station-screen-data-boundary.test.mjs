import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [areaScene, screenData] = await Promise.all([
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/nurse-station-screen-data.ts', import.meta.url), 'utf8'),
]);

assert.match(areaScene, /buildNurseStationHandoffRows/);
assert.match(areaScene, /buildNurseStationPatientRows/);
assert.match(areaScene, /'护理交班'/);
assert.match(areaScene, /'患者状态'/);
assert.match(areaScene, /\['whiteboard', \['Board_Nursing', 'Nursing_Board_Title'\]\]/);
assert.match(areaScene, /\['roomStatus', \['Board_Patient_Status', 'Patient_Status_Bar_02'\]\]/);
assert.match(screenData, /export interface NurseStationScreenRow/);
assert.match(screenData, /export function buildNurseStationHandoffRows/);
assert.match(screenData, /export function buildNurseStationPatientRows/);

console.log('Nurse-station screen data boundary checks passed.');
