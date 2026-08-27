import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWardSceneControlLimits } from './ward-scene-controls.ts';

test('keeps ward interior zoom and rotation open for inspection', () => {
  const limits = resolveWardSceneControlLimits(14, 12);

  assert.ok(limits.minPolarAngle <= 0.08);
  assert.ok(limits.maxPolarAngle >= Math.PI - 0.08);
  assert.equal(limits.minAzimuthAngle, -Infinity);
  assert.equal(limits.maxAzimuthAngle, Infinity);
  assert.ok(limits.minDistance <= 1.2);
  assert.ok(limits.maxDistance >= 48);
});

test('expands ward interior zoom range for larger rooms', () => {
  const limits = resolveWardSceneControlLimits(24, 18);

  assert.ok(limits.maxDistance >= 60);
});
