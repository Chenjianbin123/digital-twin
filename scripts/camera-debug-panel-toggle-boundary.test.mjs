import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8');

test('视角参数面板由单一开关控制且生产页面默认隐藏', () => {
  assert.match(component, /const CAMERA_DEBUG_PANEL_ENABLED = (?:true|false);/);
  assert.match(component, /CAMERA_DEBUG_PANEL_ENABLED\s+&&\s+import\.meta\.env\.DEV/);
  const expression = component.match(/const cameraDebugEnabled = computed\(\(\) =>([\s\S]*?),\s*\);/)[1]
    .replaceAll('import.meta.env.DEV', 'development')
    .replaceAll('areaPhase.value', 'phase');
  const enabled = new Function('CAMERA_DEBUG_PANEL_ENABLED', 'development', 'phase', 'return (' + expression + ')');
  for (const toggle of [true, false]) {
    for (const phase of ['station', 'corridor', 'ward']) {
      assert.equal(enabled(toggle, false, phase), false, '生产构建必须隐藏调试面板');
      assert.equal(enabled(toggle, true, phase), toggle && phase !== 'ward');
    }
  }
});
