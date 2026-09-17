import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { WardRoomExpansion } from './ward-room-expansion.ts';

function room() {
  const group = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 6), new THREE.MeshBasicMaterial());
  shell.name = '外壳'; shell.position.set(-1, 1.9, 1);
  const door = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.3, .9), new THREE.MeshBasicMaterial());
  door.name = '门'; door.position.set(.7, 1.55, 2.4);
  const curtain = new THREE.Mesh(new THREE.BoxGeometry(2, 1.9, .1), new THREE.MeshBasicMaterial());
  curtain.name = '窗帘'; curtain.position.set(-1, 1.9, -1.8);
  group.add(shell, door, curtain); return { group, shell, door, curtain };
}

test('three occupied beds retain architecture and extend only room depth', () => {
  const { group, shell, door, curtain } = room();
  const originalBox = new THREE.Box3().setFromObject(shell);
  const doorSize = new THREE.Box3().setFromObject(door).getSize(new THREE.Vector3());
  const expansion = new WardRoomExpansion(group);
  group.visible = false;
  expansion.update(3);
  assert.equal(group.visible, true);
  assert.equal(expansion.slots.length, 3);
  const box = new THREE.Box3().setFromObject(shell);
  assert.ok(Math.abs(box.min.z - originalBox.min.z) < 1e-6);
  assert.ok(Math.abs(box.max.z - originalBox.max.z - expansion.extraDepth) < 1e-6);
  assert.equal(box.min.x, originalBox.min.x); assert.equal(box.max.y, originalBox.max.y);
  assert.ok(new THREE.Box3().setFromObject(door).getSize(new THREE.Vector3()).distanceTo(doorSize) < 1e-6);
  assert.equal(door.position.z, 2.4 + expansion.extraDepth);
  assert.equal(curtain.position.z, -1.8);
});

test('one occupied bed shrinks room depth without shearing the window end', () => {
  const { group, shell, door, curtain } = room();
  const light2 = new THREE.Mesh(new THREE.BoxGeometry(.7, .04, .45), new THREE.MeshBasicMaterial());
  light2.name = 'CeilingLight_2'; light2.position.set(0, .95, 1.1); group.add(light2);
  const originalBox = new THREE.Box3().setFromObject(shell);
  const expansion = new WardRoomExpansion(group);
  expansion.update(1);
  assert.ok(expansion.extraDepth < 0);
  assert.equal(expansion.slots.length, 1);
  const box = new THREE.Box3().setFromObject(shell);
  assert.ok(Math.abs(box.min.z - originalBox.min.z) < 1e-6);
  assert.ok(Math.abs(box.max.z - originalBox.max.z - expansion.extraDepth) < 1e-6);
  // Door tracks the shortened door end; curtain keeps native window clearance (not depth-scaled).
  assert.ok(door.position.z < 2.4);
  assert.equal(door.position.z, 2.4 + expansion.extraDepth);
  assert.equal(curtain.position.z, -1.8);
  assert.equal(light2.visible, false);
  expansion.update(2);
  assert.equal(expansion.extraDepth, 0);
  assert.equal(light2.visible, true);
  assert.equal(door.position.z, 2.4);
  assert.equal(curtain.position.z, -1.8);
});

test('shrinking and repeated expansion restore baseline geometry without accumulated transforms', () => {
  const { group, shell, door } = room();
  const original = new THREE.Box3().setFromObject(shell);
  const expansion = new WardRoomExpansion(group);
  for (const count of [3, 8, 2, 7, 1, 0, 3, 2]) {
    expansion.update(count);
    assert.equal(expansion.slots.length, count);
    assert.ok(Math.abs(new THREE.Box3().setFromObject(shell).max.z - original.max.z - expansion.extraDepth) < 1e-6);
    if (expansion.extraDepth >= 0)
      assert.equal(door.position.z, 2.4 + expansion.extraDepth);
    else
      assert.ok(door.position.z < 2.4);
  }
  assert.equal(expansion.update(2), false);
});

test('architectural geometry is isolated and restored before disposing the loaded asset', () => {
  const { group, shell } = room();
  const original = shell.geometry;
  const expansion = new WardRoomExpansion(group);
  assert.notEqual(shell.geometry, original);
  let disposed = 0; shell.geometry.addEventListener('dispose', () => disposed++);
  expansion.update(8); expansion.dispose();
  assert.equal(shell.geometry, original); assert.equal(disposed, 1);
  assert.throws(() => new WardRoomExpansion(room().group).update(-1));
});

test('refined fixtures retain shape and extra lights are removed when shrinking or disposing', () => {
  const { group, shell } = room();
  shell.scale.set(1.1, 1, 1.2);
  const fixture = new THREE.Mesh(new THREE.BoxGeometry(.7, .04, .45), new THREE.MeshBasicMaterial());
  fixture.name = 'CeilingLight_2'; fixture.position.set(0, .95, 1.1); shell.add(fixture);
  group.updateMatrixWorld(true);
  const initial = new THREE.Box3().setFromObject(fixture);
  const position = fixture.getWorldPosition(new THREE.Vector3());
  const expansion = new WardRoomExpansion(group);
  for (const count of [3, 7, 2, 0, 4]) {
    expansion.update(count);
    const bounds = new THREE.Box3().setFromObject(fixture);
    assert.ok(bounds.getSize(new THREE.Vector3()).distanceTo(initial.getSize(new THREE.Vector3())) < 1e-6);
    if (expansion.extraDepth >= 0) {
      assert.ok(Math.abs(fixture.getWorldPosition(new THREE.Vector3()).z - position.z - expansion.extraDepth) < 1e-6);
    }
    else {
      const shellBox = new THREE.Box3().setFromObject(shell);
      const z = fixture.getWorldPosition(new THREE.Vector3()).z;
      assert.ok(z >= shellBox.min.z - 1e-4 && z <= shellBox.max.z + 1e-4);
    }
    assert.equal(group.children.filter(n => n.name.startsWith('WardExpandedCeilingLight_')).length, Math.max(0, Math.max(count, 1) - 2));
  }
  expansion.dispose();
  assert.equal(fixture.parent, shell);
  assert.ok(fixture.getWorldPosition(new THREE.Vector3()).distanceTo(position) < 1e-6);
  assert.equal(group.children.filter(n => n.name.startsWith('WardExpandedCeilingLight_')).length, 0);
});
