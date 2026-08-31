import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [areaScene, visualScene, exportScript, sceneConfig] = await Promise.all([
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationVisualScene.vue', import.meta.url), 'utf8'),
  readFile(new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

// The default PC view prioritizes the station while retaining both corridor signs.
assert.match(sceneConfig, /deskFov: \d+(?:\.\d+)?/);
assert.match(sceneConfig, /target: \{ x: -?\d+(?:\.\d+)?, y: -?\d+(?:\.\d+)?, z: -?\d+(?:\.\d+)? \}/);
assert.match(sceneConfig, /initialDistance: \d+(?:\.\d+)?/);
assert.match(sceneConfig, /initialAngle: \{ azimuthDeg: -?\d+(?:\.\d+)?, elevationDeg: -?\d+(?:\.\d+)? \}/);

// Header typography and the live clock are readable without covering ward directions.
assert.match(exportScript, /add_text\("Detail_Header_Title", "普通外科护理单元", \(0\.0, -0\.095, 3\.45\), 0\.32/);
assert.match(exportScript, /add_text\("Detail_Header_Subtitle", "GENERAL SURGERY NURSING UNIT", \(0\.0, -0\.097, 3\.245\), 0\.115/);
assert.match(exportScript, /clock\.location = \(4\.85, -0\.105, 3\.10\)/);
assert.match(exportScript, /clock\.dimensions = \(1\.20, 0\.05, 0\.32\)/);

// Live JSON-driven work screens remain mapped to the exported model meshes.
assert.match(areaScene, /\['taskQueue', \['Screen_Work_01', 'Monitor_UI_01_00'\]\]/);
assert.match(areaScene, /\['wardStatus', \['Screen_Work_02', 'Monitor_UI_02_02'\]\]/);
assert.match(areaScene, /\['bedMonitor', \['Screen_Work_03', 'Monitor_Frame_03'\]\]/);
assert.match(areaScene, /\['deviceHealth', \['Screen_Work_04', 'Monitor_Frame_04'\]\]/);
assert.match(areaScene, /\['clock', \['Clock_Display', 'Clock_Frame'\]\]/);
assert.match(areaScene, /ctx\.font = '700 124px ui-monospace/);

// Keep the scene bright and neutral enough for an on-site hospital display.
assert.match(visualScene, /&__ambient[\s\S]*?opacity: 0\.42;/);
assert.match(visualScene, /&::after[\s\S]*?opacity: 0\.28;/);

console.log('Nurse-station page presentation boundary checks passed.');
