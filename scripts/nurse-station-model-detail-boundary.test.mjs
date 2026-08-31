import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [exportScript, sceneConfig] = await Promise.all([
  readFile(new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(exportScript, /ENHANCEMENT_PREFIX = "Detail_"/);
assert.match(exportScript, /def apply_source_detail_enhancements\(\) -> None:/);
assert.match(exportScript, /def remove_corridor_rail_details\(\) -> None:/);
assert.match(exportScript, /remove_corridor_rail_details\(\)/);
assert.doesNotMatch(exportScript, /segment_corridor_rails_around_doors\(\)/);
assert.doesNotMatch(exportScript, /normalize_corridor_rail_alignment\(\)/);
assert.match(exportScript, /Detail_Counter_Edge_Light_Front/);
assert.doesNotMatch(exportScript, /Detail_Counter_Edge_Light_Left/);
assert.doesNotMatch(exportScript, /Detail_Counter_Edge_Light_Right/);
assert.match(exportScript, /Detail_Backlit_Station_Sign/);
assert.match(exportScript, /Detail_Keyboard_/);
assert.match(exportScript, /Detail_Clipboard_/);
assert.match(exportScript, /Detail_Floor_Guideline_/);
assert.match(exportScript, /def hide_plant_objects\(\) -> None:/);
assert.match(exportScript, /plant|potted|pot|foliage/i);
assert.match(exportScript, /bpy\.ops\.wm\.save_as_mainfile\(filepath=str\(BLEND_PATH\)\)/);
assert.match(sceneConfig, /1-1\.glb\?v=20260831-nurse-station-1-1/);

console.log('Nurse-station model detail boundary checks passed.');
