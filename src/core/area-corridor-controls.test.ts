import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAreaCorridorControlLimits } from './area-corridor-controls.ts';

test('opens corridor drag and zoom limits for the new GLB model', () => {
  const limits = resolveAreaCorridorControlLimits(42);

  assert.equal(limits.minAzimuthAngle, -Infinity);
  assert.equal(limits.maxAzimuthAngle, Infinity);
  assert.ok(limits.minPolarAngle <= 0.05);
  assert.ok(limits.maxPolarAngle >= Math.PI - 0.05);
  assert.ok(limits.minDistance <= 1.2);
  assert.ok(limits.maxDistance >= 140);
});
