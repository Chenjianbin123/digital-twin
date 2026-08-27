import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('./export_high_fidelity_nurse_station_glb.py', import.meta.url),
  'utf8',
);

assert.match(
  source,
  /bpy\.ops\.wm\.open_mainfile\(filepath=str\(BLEND_PATH\)\)[\s\S]*?if bpy\.context\.mode != "OBJECT":[\s\S]*?bpy\.ops\.object\.mode_set\(mode="OBJECT"\)/,
  'exporter must leave edit mode after opening the Blender source',
);
assert.match(source, /parser\.add_argument\("--preserve-source", action="store_true"\)/);
assert.match(
  source,
  /if not args\.preserve_source:[\s\S]*?apply_source_detail_enhancements\(\)[\s\S]*?bpy\.ops\.wm\.save_as_mainfile\(filepath=str\(BLEND_PATH\)\)/,
  'preserve-source exports must not rebuild or save the Blender source',
);

console.log('Nurse-station exporter object-mode boundary check passed.');
