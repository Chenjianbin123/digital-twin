import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import type { TwinSceneType } from '../types/twin.ts';
import * as THREE from 'three';
import { hospitalModels } from './hospital-navigation.ts';
import { hospitalCameraFrame } from './hospital-3d-camera.ts';
import { useHospitalNavigation } from './use-hospital-navigation.ts';

test('opens exterior first, walks through floor and station, and returns without resetting clinical routing', () => {
  const scope = effectScope();
  const scene = ref<TwinSceneType>('nurse-station');
  const nav = scope.run(() => useHospitalNavigation(scene))!;
  try {
    assert.equal(nav.view.value, 'exterior');
    assert.equal(nav.clinicalVisited.value, false);
    nav.openFloor(); assert.equal(nav.view.value, 'floor');
    nav.openClinical(); assert.equal(nav.clinicalActive.value, true);
    scene.value = 'ward-interior';
    nav.openFloor();
    assert.equal(scene.value, 'ward-interior');
    assert.equal(nav.clinicalVisited.value, true);
    assert.equal(nav.clinicalActive.value, false);
    nav.openExterior(); assert.equal(nav.view.value, 'exterior');
    scene.value = 'ward';
    assert.equal(nav.view.value, 'clinical', 'existing room/alert navigation must still open its target');
  } finally { scope.stop(); }
});

test('fits complete 3D floor bounds across viewport ratios and fills 95 percent on one axis', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-12.75, -.25, -8.25), new THREE.Vector3(12.75, 2.84, 8.25));
  const direction = new THREE.Vector3(.310003, .720757, .620006);
  for (const [w, h] of [[1440, 774], [320, 500], [768, 850], [1024, 600]]) {
    const frame = hospitalCameraFrame(bounds, direction, w / h);
    const camera = new THREE.OrthographicCamera(-frame.height * w / h / 2, frame.height * w / h / 2, frame.height / 2, -frame.height / 2, .1, 3000);
    camera.position.copy(frame.position); camera.lookAt(frame.target); camera.updateMatrixWorld();
    let extent = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(point.x) <= .950001 && Math.abs(point.y) <= .950001);
      extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
    }
    assert.ok(extent > .949, 'default camera should not leave large margins');
  }
});

test('navigation routes each real GLB to the next scene without bitmap resources', () => {
  assert.ok(hospitalModels.exterior.asset.endsWith('.glb'));
  assert.ok(hospitalModels.floor.asset.endsWith('.glb'));
  assert.equal(hospitalModels.exterior.target, 'floor');
  assert.equal(hospitalModels.floor.target, 'nurse-station');
});
