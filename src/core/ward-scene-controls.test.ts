import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampWardSceneOrbit,
  resolveWardSceneControlLimits,
} from './ward-scene-controls.ts';

test('keeps ward interior zoom and rotation inside presentation-safe bounds', () => {
  const limits = resolveWardSceneControlLimits(14, 12);

  assert.ok(limits.minPolarAngle >= 0);
  assert.ok(limits.maxPolarAngle <= Math.PI / 2 + 0.08);
  assert.ok(limits.minAzimuthAngle >= -0.6);
  assert.ok(limits.maxAzimuthAngle <= 0.6);
  assert.ok(limits.minDistance >= 3);
  assert.ok(limits.maxDistance <= 20);
});

test('keeps larger rooms inspectable without allowing unlimited zoom out', () => {
  const limits = resolveWardSceneControlLimits(24, 18);

  assert.equal(limits.maxDistance, 20);
});

test('hard clamps ward interior camera orbit values after touchpad inertia', () => {
  const limits = resolveWardSceneControlLimits(14, 12);
  const clamped = clampWardSceneOrbit(
    {
      phi: Math.PI - 0.1,
      theta: 1.8,
      radius: 32,
    },
    limits,
  );

  assert.equal(clamped.phi, limits.maxPolarAngle);
  assert.equal(clamped.theta, limits.maxAzimuthAngle);
  assert.equal(clamped.radius, limits.maxDistance);
});
