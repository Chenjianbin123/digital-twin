import assert from 'node:assert/strict';
import test from 'node:test';

import { getWardCorridorCameraView } from './ward-corridor-camera.ts';

test('starts inside the corridor and looks down its long axis', () => {
  const view = getWardCorridorCameraView({
    minX: -2.6,
    maxX: 2.6,
    minY: 0,
    maxY: 3.9,
    minZ: -17.1,
    maxZ: 10.1,
  });

  assert.ok(view.position.x > -2.6 && view.position.x < 2.6);
  assert.ok(view.position.y > 1.5 && view.position.y < 3.9);
  assert.ok(view.position.z < 10.1 && view.position.z > 0);
  assert.ok(view.target.z < view.position.z);
});

test('frames the normalized hospital corridor bounds without crossing the floor', () => {
  const view = getWardCorridorCameraView({
    minX: -15.5,
    maxX: 15.5,
    minY: 0,
    maxY: 3.66,
    minZ: -22,
    maxZ: 22,
  });

  assert.ok(view.position.y > 1.5 && view.position.y < 3.66);
  assert.ok(view.position.z < 22 && view.position.z > 0);
  assert.ok(view.target.y > 0 && view.target.y < 3.66);
});

test('keeps a wider standoff from the far corridor wall for model framing', () => {
  const view = getWardCorridorCameraView({
    minX: -15.5,
    maxX: 15.5,
    minY: 0,
    maxY: 3.66,
    minZ: -22,
    maxZ: 22,
  });

  assert.ok(22 - view.position.z >= 2.4);
  assert.ok(view.position.y >= 2.1);
});
