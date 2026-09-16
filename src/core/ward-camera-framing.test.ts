import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { frameWardSubjects } from './ward-camera-framing.ts';

const room = (count: number) => ({ minX: -2.5, maxX: .63, minY: 1.06, maxY: 2.77, minZ: -1.9, maxZ: 4 + Math.max(0, count - 2) * 2.37 });
const subjects = (count: number) => new THREE.Box3(new THREE.Vector3(-2.4, 1, -.9), new THREE.Vector3(-.2, 2.2, .9 + (count - 1) * 2.37));

test('overview and focus remain inside the original room for 1, 2, 3, 6 and 8 beds', () => {
  for (const count of [1, 2, 3, 6, 8]) for (const aspect of [1.44, .46]) {
    for (const focus of [false, true]) {
      const bounds = room(count);
      const box = focus ? subjects(1).translate(new THREE.Vector3(0, 0, (count - 1) * 2.37)) : subjects(count);
      const pose = frameWardSubjects(box, bounds, aspect, focus);
      for (const point of [pose.position, pose.target]) {
        assert.ok(point.x >= bounds.minX && point.x <= bounds.maxX);
        assert.ok(point.y >= bounds.minY && point.y <= bounds.maxY);
        assert.ok(point.z >= bounds.minZ && point.z <= bounds.maxZ);
      }
      assert.ok(pose.position.distanceTo(pose.target) > .6);
      assert.ok(pose.fov >= 52 && pose.fov <= 95);
    }
  }
});

test('when framing fits within the lens limit every subject corner is inside the viewport', () => {
  for (const count of [1, 2, 3, 6, 8]) {
    const subject = subjects(count), pose = frameWardSubjects(subject, { ...room(count), maxX: 2.5 }, 1.44);
    assert.ok(pose.requiredFov <= 95);
    const camera = new THREE.PerspectiveCamera(pose.fov, 1.44, .1, 100);
    camera.position.copy(pose.position); camera.lookAt(pose.target); camera.updateMatrixWorld();
    for (const x of [subject.min.x, subject.max.x]) for (const y of [subject.min.y, subject.max.y]) for (const z of [subject.min.z, subject.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1);
    }
  }
});
