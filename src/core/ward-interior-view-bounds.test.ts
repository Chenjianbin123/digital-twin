import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  captureWardInteriorBoundMeshes,
  clampPointToWardInteriorBounds,
  getWardInteriorPaddedBounds,
} from './ward-interior-view-bounds.ts';

function makeBoundModel() {
  const root = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 8));
  shell.name = '外壳';
  shell.position.set(0, 1.6, 0);
  const light = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1));
  light.name = '灯';
  light.position.set(0, 3.0, 0);
  root.add(shell, light);
  root.updateMatrixWorld(true);
  return root;
}

test('captures interior volume from 外壳 and 灯', () => {
  const raw = captureWardInteriorBoundMeshes(makeBoundModel());
  assert.ok(raw);
  assert.ok(raw!.shellMinX < raw!.shellMaxX);
  assert.ok(raw!.shellMinZ < raw!.shellMaxZ);
  assert.ok(raw!.lightMinY > raw!.shellMinY);
});

test('pads shell/light bounds and clamps points inside the room', () => {
  const raw = captureWardInteriorBoundMeshes(makeBoundModel());
  assert.ok(raw);
  const bounds = getWardInteriorPaddedBounds(raw!, {
    floor: 0.2,
    ceiling: 0.15,
    wall: 0.25,
    depth: 0.25,
  });
  assert.ok(bounds);
  assert.ok(bounds!.maxY < raw!.lightMinY);
  const outside = new THREE.Vector3(40, 20, -40);
  clampPointToWardInteriorBounds(outside, bounds!);
  assert.ok(outside.x >= bounds!.minX && outside.x <= bounds!.maxX);
  assert.ok(outside.y >= bounds!.minY && outside.y <= bounds!.maxY);
  assert.ok(outside.z >= bounds!.minZ && outside.z <= bounds!.maxZ);
});

test('returns null when named meshes are missing', () => {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry()));
  assert.equal(captureWardInteriorBoundMeshes(root), null);
});
