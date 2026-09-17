import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import { useWorkspacePanels } from '../src/core/use-workspace-panels.ts';

test('进入 2.5D 默认隐藏面板，返回护士站恢复原有可见状态', () => {
  const scope = effectScope();
  try {
    const scene = ref('nurse-station');
    const view = ref('3d');
    const area = ref('area:1');
    const { panelsVisible } = scope.run(() => useWorkspacePanels(scene, view, area));
    scene.value = 'ward-interior'; view.value = 'plan';
    assert.equal(panelsVisible.value, false);
    scene.value = 'nurse-station';
    assert.equal(panelsVisible.value, true);
  } finally { scope.stop(); }
});
