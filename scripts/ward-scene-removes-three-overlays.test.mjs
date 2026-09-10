import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

test('keeps model surfaces and anchors the persistent selection highlight for baked beds', () => {
  const start = source.indexOf('  private createBakedModelBedMesh');
  const end = source.indexOf('  private createModelBedMesh', start);
  const method = source.slice(start, end);

  assert.match(method, /bedTerminalScreen: bound\.bedTerminalScreen/);
  assert.match(method, /indicator: bound\.indicator/);
  assert.match(method, /createSelectionMeshes/);
  assert.match(method, /anchorSelectionMeshesToBed\(group, bound\.mattress, selection\)/);
  assert.match(method, /selectionRing: selection\.ring/);
  assert.doesNotMatch(method, /createGeneratedBedMesh/);
});

test('does not allocate temporary Three.js effects during bed updates or animation', () => {
  const updateStart = source.indexOf('  private updateBedVisual');
  const updateEnd = source.indexOf('  private usesNativeCameraPose', updateStart);
  const update = source.slice(updateStart, updateEnd);
  const animateStart = source.indexOf('  private animate = ');
  const animateEnd = source.indexOf('  dispose()', animateStart);
  const animate = source.slice(animateStart, animateEnd);

  for (const forbidden of ['infusionPump', 'callRing', 'selectionPillar', 'curtainPanels']) {
    assert.doesNotMatch(update, new RegExp(forbidden));
    assert.doesNotMatch(animate, new RegExp(forbidden));
  }
  assert.doesNotMatch(update, /new THREE\./);
  assert.doesNotMatch(animate, /new THREE\./);
  assert.match(update, /setBedSelectionVisible/);
  assert.match(animate, /selectionRing\.scale\.set/);
});
