import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  captureWardCorridorBoundMeshes,
  clampPointToWardCorridorBounds,
  getWardCorridorCameraView,
  getWardCorridorPaddedBounds,
} from './ward-corridor-camera.ts';

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

function makeBoundModel() {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 40));
  floor.name = '地板';
  floor.position.set(0, 0, 0);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 40));
  ceiling.name = '天花板';
  ceiling.position.set(0, 3.5, 0);
  const wallA = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 40));
  wallA.name = '墙壁';
  wallA.position.set(-3.1, 1.75, 0);
  const wallB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 40));
  wallB.name = '墙壁2';
  wallB.position.set(3.1, 1.75, 0);
  root.add(floor, ceiling, wallA, wallB);
  root.updateMatrixWorld(true);
  return root;
}

test('captures interior volume from 地板 / 墙壁 / 墙壁2 / 天花板', () => {
  const raw = captureWardCorridorBoundMeshes(makeBoundModel());
  assert.ok(raw);
  assert.equal(raw!.widthAxis, 'x');
  assert.ok(raw!.wallMin < raw!.wallMax);
  assert.ok(raw!.floorMaxY < raw!.ceilingMinY);
  assert.ok(raw!.lengthMin < raw!.lengthMax);
});

test('pads mesh bounds and clamps points inside the corridor', () => {
  const raw = captureWardCorridorBoundMeshes(makeBoundModel());
  assert.ok(raw);
  const bounds = getWardCorridorPaddedBounds(raw!, {
    floor: 0.2,
    ceiling: 0.2,
    wall: 0.2,
    depth: 0.5,
  });
  assert.ok(bounds);
  const outside = new THREE.Vector3(20, -5, 100);
  clampPointToWardCorridorBounds(outside, bounds!);
  assert.ok(outside.x >= bounds!.minX && outside.x <= bounds!.maxX);
  assert.ok(outside.y >= bounds!.minY && outside.y <= bounds!.maxY);
  assert.ok(outside.z >= bounds!.minZ && outside.z <= bounds!.maxZ);
});
