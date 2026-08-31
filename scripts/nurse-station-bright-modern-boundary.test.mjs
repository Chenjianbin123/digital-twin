import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [exportScript, blendValidator, glbValidator, areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('./validate_high_fidelity_nurse_station.py', import.meta.url), 'utf8'),
  readFile(new URL('./validate_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(exportScript, /BRIGHT_MODERN_SCENE_VERSION = 1/);
assert.match(exportScript, /CORRIDOR_PRESENTATION_FOLD_DEGREES = 11\.0/);
assert.match(exportScript, /def apply_bright_modern_architecture\(\) -> None:/);
assert.match(exportScript, /def reset_bright_modern_presentation\(\) -> None:/);
assert.match(exportScript, /Detail_Full_Ceiling/);
assert.match(exportScript, /Detail_Canopy_Light_/);
assert.match(exportScript, /Detail_Header_Center/);
assert.match(exportScript, /Detail_Header_Left/);
assert.match(exportScript, /Detail_Header_Right/);
assert.match(exportScript, /普通外科护理单元/);
assert.match(exportScript, /GENERAL SURGERY NURSING UNIT/);
assert.match(exportScript, /病房 01-08/);
assert.match(exportScript, /病房 09-16/);
assert.doesNotMatch(exportScript, /Preview_Work_UI_/);

assert.match(blendValidator, /Detail_Header_Title/);
assert.match(blendValidator, /Detail_Full_Ceiling/);
assert.match(blendValidator, /corridor presentation fold/);
assert.match(glbValidator, /Detail_Header_Title/);
assert.match(glbValidator, /Detail_Full_Ceiling/);

assert.match(sceneConfig, /1-1\.glb\?v=20260831-nurse-station-1-1/);
assert.match(areaScene, /architecturalFillNames = new Set\(\['Detail_Full_Ceiling'\]\)/);
assert.match(areaScene, /\['taskQueue', \['Screen_Work_01', 'Monitor_UI_01_00'\]\]/);
assert.match(areaScene, /\['wardStatus', \['Screen_Work_02', 'Monitor_UI_02_02'\]\]/);
assert.match(areaScene, /\['bedMonitor', \['Screen_Work_03', 'Monitor_Frame_03'\]\]/);
assert.match(areaScene, /\['deviceHealth', \['Screen_Work_04', 'Monitor_Frame_04'\]\]/);

console.log('Nurse-station bright-modern boundary checks passed.');
