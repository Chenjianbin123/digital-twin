import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [exportScript, validator, areaScene, sceneConfig] = await Promise.all([
  readFile(new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url), 'utf8'),
  readFile(new URL('./validate_high_fidelity_nurse_station.py', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8'),
]);

assert.match(exportScript, /CORRIDOR_WING_EXTRA_WIDTH = 1\.75/);
assert.match(exportScript, /CORRIDOR_DOOR_SETBACK_Y = 1\.55/);
assert.match(exportScript, /CORRIDOR_REAR_EXTENSION_Y = 1\.40/);
assert.match(exportScript, /def widen_corridor_wings\(\) -> None:/);
assert.match(exportScript, /def setback_corridor_doors\(\) -> None:/);
assert.match(exportScript, /def remove_corridor_rail_details\(\) -> None:/);
assert.doesNotMatch(exportScript, /def segment_corridor_rails_around_doors\(\) -> None:/);
assert.doesNotMatch(exportScript, /def normalize_corridor_rail_alignment\(\) -> None:/);
assert.match(exportScript, /def repair_wayfinding_sign_text\(\) -> None:/);
assert.match(exportScript, /STHeiti Medium\.ttc/);
assert.match(exportScript, /WAYFINDING_SIGN_MOUNT_X = 5\.85/);
assert.match(exportScript, /def normalize_wayfinding_sign_mount\(\) -> None:/);
assert.match(exportScript, /"Corridor_Left"/);
assert.match(exportScript, /"Corridor_Right"/);
assert.match(exportScript, /"Ward_Door_Left_"/);
assert.match(exportScript, /"Ward_Door_Right_"/);
assert.match(exportScript, /"Door_Frame_Left_"/);
assert.match(exportScript, /"Door_Frame_Right_"/);
assert.match(exportScript, /"Door_Handle_Left_"/);
assert.match(exportScript, /"Door_Handle_Right_"/);
assert.match(exportScript, /"Door_Window_Left_"/);
assert.match(exportScript, /"Door_Window_Right_"/);
assert.match(exportScript, /"Door_Sign_Left_"/);
assert.match(exportScript, /"Door_Sign_Right_"/);
assert.match(exportScript, /"Wayfinding_Sign_Left"/);
assert.match(exportScript, /"Wayfinding_Sign_Right"/);
assert.match(validator, /corridor_wing_width = abs\(right\.location\.x - left\.location\.x\)/);
assert.match(validator, /assert corridor_wing_width >= 13\.5/);
assert.match(validator, /horizontal_clearance >= 0\.10/);
assert.match(validator, /0\.96 <= abs\(door_axis\.y\) <= 0\.99/);
assert.match(validator, /assert not continuous_rails/);
assert.match(validator, /corridor rail segments clutter the nurse-station close view/);
assert.match(validator, /wayfinding title must stay inside panel/);
assert.match(validator, /wayfinding sign intersects corridor wall/);
assert.match(validator, /door_front_y >= counter_back_y \+ 0\.80/);
assert.match(validator, /wall_back_y >= last_door_back_y/);
assert.match(sceneConfig, /20260820-latest-blender-v3-export-v20/);
assert.match(sceneConfig, /maxSize: \{ x: 11\.04, y: 2\.3895, z: 5\.102 \}/);
assert.match(sceneConfig, /halfWidth: 5\.55/);

console.log('Nurse-station corridor width boundary checks passed.');
