import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [exportScript, areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(exportScript, /def optimize_information_visibility\(\) -> None:/);
assert.match(exportScript, /"Board_Nursing": \(\s*\(-3\.13, 5\.545, 2\.22\)/);
assert.match(exportScript, /"Screen_Main": \(\s*\(0\.0, 5\.545, 2\.28\)/);
assert.match(exportScript, /"Board_Patient_Status": \(\s*\(3\.13, 5\.545, 2\.22\)/);
assert.match(exportScript, /target_sign_z = 2\.55/);
assert.match(exportScript, /clock_frame\.location = \(4\.85, -0\.04, 3\.10\)/);
assert.match(exportScript, /clock\.location = \(4\.85, -0\.105, 3\.10\)/);
assert.match(exportScript, /optimize_information_visibility\(\)[\s\S]*?apply_bright_modern_architecture\(\)/);

assert.match(sceneConfig, /1-1\.glb\?v=20260901-h-n2-v1/);
assert.match(sceneConfig, /target: \{ x: -?\d+(?:\.\d+)?, y: -?\d+(?:\.\d+)?, z: -?\d+(?:\.\d+)? \}/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -?\d+(?:\.\d+)?, elevationDeg: -?\d+(?:\.\d+)? \}/);
assert.match(areaScene, /\['dashboard', \['Screen_Main', 'Screen_Main_Frame'\]\]/);
assert.match(areaScene, /\['clock', \['Clock_Display', 'Clock_Frame'\]\]/);
assert.match(areaScene, /\['taskQueue', \['Screen_Work_01', 'Monitor_UI_01_00'\]\]/);
assert.match(areaScene, /\['deviceHealth', \['Screen_Work_04', 'Monitor_Frame_04'\]\]/);

console.log('Nurse-station content visibility boundary checks passed.');
