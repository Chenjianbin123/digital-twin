import { readWorkspaceSource } from './helpers/read-workspace-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
test('station workspace no longer exposes the tools menu or preview entry', () => {
  const workspace = readWorkspaceSource();
  assert.doesNotMatch(workspace, /workspace-tools|NurseStationPreviewLink|第二版模型预览/);
  assert.match(read('../src/components/dashboard/DashboardHeader.vue'), /<slot name="actions"\s*\/>/);
});
test('design preview is separate from the production scene and data', () => {
  const preview = read('../src/preview/station-preview.ts');
  assert.match(preview, /nurse-station-design-v3\.glb\?url/);
  assert.doesNotMatch(preview, /@\/api|@\/stores|nurse-station-scene/);
  assert.match(read('../src/config/nurse-station-scene.ts'), /nurse-station-design-v[234]\.glb/);
  assert.match(read('../nurse-station-preview.html'), /src\/preview\/main\.ts/);
  assert.match(read('../vite.config.ts'), /stationPreview:.*nurse-station-preview\.html/);
});
test('preview provides named screens, bounded controls, and resource cleanup', () => {
  const preview = read('../src/preview/station-preview.ts');
  for (const marker of ['Screen_Main', 'Screen_Work_0', 'texture.flipY = false', 'ResizeObserver', 'controls.dispose()', 'environmentTarget.dispose()', 'releaseAssets()', 'renderer.dispose()', 'Number.isFinite(value)']) {
    assert.ok(preview.includes(marker), marker);
  }
  const component = read('../src/preview/NurseStationPreview.vue');
  assert.match(component, /演示内容/);
  assert.match(component, /重新加载/);
  assert.match(component, /aria-pressed/);
  assert.match(component, /onBeforeUnmount/);
});
test('production build includes the preview without loading its model on the main page', t => {
  const path = new URL('../dist/nurse-station-preview.html', import.meta.url);
  if (!existsSync(path)) return t.skip('run npm run build first');
  assert.match(read('../dist/nurse-station-preview.html'), /stationPreview/);
  assert.doesNotMatch(read('../dist/index.html'), /stationPreview|nurse-station-design-v2/);
});
