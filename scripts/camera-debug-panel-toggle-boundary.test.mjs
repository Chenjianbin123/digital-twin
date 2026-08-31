import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8');

test('视角参数面板由单一开关控制且默认隐藏', () => {
  assert.match(component, /const CAMERA_DEBUG_PANEL_ENABLED = false;/);
  assert.match(component, /CAMERA_DEBUG_PANEL_ENABLED\s+&&\s+import\.meta\.env\.DEV/);
});
