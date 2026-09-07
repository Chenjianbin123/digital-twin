import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('keeps only the model terminal screen and model status indicator for baked beds', () => {
  const start = source.indexOf('  private createBakedModelBedMesh');
  const end = source.indexOf('  private createModelBedMesh', start);
  const method = source.slice(start, end);

  assert.match(method, /bedTerminalScreen: bound\.bedTerminalScreen/);
  assert.match(method, /indicator: bound\.indicator/);
  assert.doesNotMatch(method, /createSelectionMeshes/);
  assert.doesNotMatch(method, /createGeneratedBedMesh/);
});

test('does not attach temporary Three.js effects during bed updates or animation', () => {
  const updateStart = source.indexOf('  private updateBedVisual');
  const updateEnd = source.indexOf('  private usesNativeCameraPose', updateStart);
  const update = source.slice(updateStart, updateEnd);
  const animateStart = source.indexOf('  private animate = ');
  const animateEnd = source.indexOf('  dispose()', animateStart);
  const animate = source.slice(animateStart, animateEnd);

  for (const forbidden of ['infusionPump', 'callRing', 'selectionRing', 'selectionPillar', 'selectionBeam', 'curtainPanels']) {
    assert.doesNotMatch(update, new RegExp(forbidden));
    assert.doesNotMatch(animate, new RegExp(forbidden));
  }
});
