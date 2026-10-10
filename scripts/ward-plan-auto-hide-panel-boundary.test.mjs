import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import { useWorkspacePanels } from '../src/core/use-workspace-panels.ts';

test('进入 2.5D 默认展开面板，手动收起不影响护士站', () => {
  const scope = effectScope();
  try {
    const scene = ref('nurse-station');
    const view = ref('3d');
    const area = ref('area:1');
    const { panelsVisible } = scope.run(() => useWorkspacePanels(scene, view, area));
    scene.value = 'ward-interior'; view.value = 'plan';
    assert.equal(panelsVisible.value, true);
    panelsVisible.value = false;
    scene.value = 'nurse-station';
    assert.equal(panelsVisible.value, true);
    scene.value = 'ward-interior';
    assert.equal(panelsVisible.value, false);
  } finally { scope.stop(); }
});
