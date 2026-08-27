import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('./render_high_fidelity_nurse_station.py', import.meta.url),
  'utf8',
);

assert.match(source, /PREVIEW_PNG_PATH\s*=/);
assert.match(source, /def render_outputs\(scene, preview=False\):/);
assert.match(source, /png_path = PREVIEW_PNG_PATH if preview else PNG_PATH/);
assert.match(source, /if not args\.preview:\s*\n\s*bpy\.ops\.wm\.save_as_mainfile/);
assert.match(source, /render_outputs\(scene, preview=args\.preview\)/);

console.log('Nurse-station render output boundary tests passed.');
