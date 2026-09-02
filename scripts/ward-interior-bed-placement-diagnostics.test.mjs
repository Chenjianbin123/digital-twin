import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wardScene = await readFile(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('prints baked bed terminal position and orientation diagnostics in development', () => {
  assert.match(wardScene, /getWardInteriorBedPlacementDebugInfo/);
  assert.match(wardScene, /import\.meta\.env\.DEV/);
  assert.match(wardScene, /debugWardTerminal/);
  assert.match(wardScene, /console\.groupCollapsed\('\[WardScene\] 床头机位置诊断'/);
  assert.match(wardScene, /console\.table/);

  const updateStart = wardScene.indexOf('  updateWard(ward: TwinWardEntity) {');
  const updateEnd = wardScene.indexOf('  private updateBedVisual', updateStart);
  assert.match(wardScene.slice(updateStart, updateEnd), /logWardInteriorBedPlacementDiagnostics/);
});
