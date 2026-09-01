import assert from 'node:assert/strict';
import test from 'node:test';

import * as THREE from 'three';

import {
  WARD_INTERIOR_MODEL_URL,
  bindWardInteriorBakedBed,
  cloneWardInteriorBed,
  configureWardInteriorCanvasTexture,
  disposeWardInteriorModel,
  fitWardInteriorEnvironment,
  getWardInteriorAssetParts,
  hideWardInteriorCeiling,
  prepareWardInteriorModelMaterials,
  resolveWardInteriorModelBedPose,
  syncWardInteriorBakedBedVisibility,
} from './ward-interior-model.ts';


function createBedPrototype() {
  const prototype = new THREE.Group();
  prototype.name = 'BedPrototype';

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const addMesh = (name: string) => {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.name = name;
    prototype.add(mesh);
    return mesh;
  };

  addMesh('Bed_1_Mattress');
  addMesh('SmartBedhead_1_Status');
  addMesh('BedTerminalSurface');
  addMesh('Monitor_1_Screen');
  return prototype;
}


function createAssetRoot() {
  const root = new THREE.Group();
  const architecture = new THREE.Group();
  architecture.name = 'WardArchitecture';
  architecture.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  const props = new THREE.Group();
  props.name = 'WardProps';
  const prop = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  prop.position.set(2, 1, -3);
  props.add(prop);
  root.add(architecture, props, createBedPrototype());
  return root;
}

function createBakedAssetRoot() {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 0.4, 2);

  const bedA = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
  bedA.name = '床';
  bedA.position.set(-1, 0.5, -1);

  const pillowA = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshStandardMaterial());
  pillowA.name = '枕头';
  pillowA.position.set(-1.4, 0.7, -1);

  const bedB = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff }));
  bedB.name = '床.001';
  bedB.position.set(-1, 0.5, 1.5);

  const pillowB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.5), new THREE.MeshStandardMaterial());
  pillowB.name = '枕头.001';
  pillowB.position.set(-1.4, 0.7, 1.5);

  const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
  chair.name = '椅子坐';
  chair.position.set(1, 0.25, 0);

  root.add(bedA, pillowA, bedB, pillowB, chair);
  return root;
}


test('uses the versioned smart ward interior model URL', () => {
  assert.equal(
    WARD_INTERIOR_MODEL_URL,
    '/models/smart-ward-interior/room-v1.glb?v=20260901-room-v1-native',
  );
});

test('rejects assets that do not provide a supported ward interior layout', () => {
  assert.throws(
    () => getWardInteriorAssetParts(new THREE.Group()),
    /床/,
  );
});

test('clones a bed with shared geometry and isolated dynamic materials', () => {
  const prototype = createBedPrototype();
  const first = cloneWardInteriorBed(prototype, 'BED-01');
  const second = cloneWardInteriorBed(prototype, 'BED-02');

  assert.equal(first.group.userData.bedCode, 'BED-01');
  assert.equal(second.group.userData.bedCode, 'BED-02');
  assert.equal(first.mattress.geometry, second.mattress.geometry);
  assert.notEqual(first.mattress.material, second.mattress.material);
  assert.notEqual(first.indicator.material, second.indicator.material);
  assert.notEqual(first.bedTerminalScreen.material, second.bedTerminalScreen.material);
  assert.notEqual(first.bedsideMonitor?.material, second.bedsideMonitor?.material);
});

test('rejects cloning a bed without the required bedside monitor screen', () => {
  const prototype = createBedPrototype();
  prototype.remove(prototype.getObjectByName('Monitor_1_Screen')!);

  assert.throws(
    () => cloneWardInteriorBed(prototype, 'BED-01'),
    /Monitor_1_Screen/,
  );
});

test('configures CanvasTexture for glTF UV orientation', () => {
  const texture = { flipY: true, needsUpdate: false };
  configureWardInteriorCanvasTexture(texture);
  assert.deepEqual(texture, { flipY: false, needsUpdate: true });
});

test('fits architecture while repositioning props without stretching them', () => {
  const parts = getWardInteriorAssetParts(createAssetRoot());
  assert.equal(parts.mode, 'prototype');
  const prop = parts.props.children[0];
  fitWardInteriorEnvironment(parts, 18, 14, 4.2);

  assert.deepEqual(parts.architecture.scale.toArray().map(v => Number(v.toFixed(3))), [1.5, 1.071, 1.556]);
  assert.deepEqual(prop.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(prop.position.toArray().map(v => Number(v.toFixed(3))), [3, 1.071, -4.667]);
});

test('fits props from their original positions instead of accumulating scale', () => {
  const parts = getWardInteriorAssetParts(createAssetRoot());
  const prop = parts.props.children[0];

  fitWardInteriorEnvironment(parts, 18, 14, 4.2);
  fitWardInteriorEnvironment(parts, 12, 9, 3.92);

  assert.deepEqual(prop.position.toArray(), [2, 1, -3]);
});

test('organizes baked Chinese-named beds with proxy screens', () => {
  const parts = getWardInteriorAssetParts(createBakedAssetRoot());
  assert.equal(parts.mode, 'baked');
  assert.equal(parts.bedPrototype, null);
  assert.equal(parts.bakedBeds.length, 2);
  assert.equal(parts.bakedBeds[0].mattress.name, '床');
  assert.equal(parts.bakedBeds[1].mattress.name, '床.001');
  assert.ok(parts.bakedBeds[0].bedTerminalScreen);
  assert.ok(parts.bakedBeds[0].bedsideMonitor);
  assert.equal(parts.bakedBeds[0].group.parent, parts.architecture);
  assert.equal(parts.bakedBeds[0].mattress.parent, parts.bakedBeds[0].group);

  const bound = bindWardInteriorBakedBed(parts.bakedBeds[0], 'BED-A');
  assert.equal(bound.group.userData.bedCode, 'BED-A');
  assert.equal(bound.group.userData.wardInteriorBakedBed, true);
  assert.ok(bound.mattress.material instanceof THREE.MeshStandardMaterial);

  syncWardInteriorBakedBedVisibility(parts, 1);
  assert.equal(parts.bakedBeds[0].group.visible, true);
  assert.equal(parts.bakedBeds[1].group.visible, false);
});

test('keeps baked rooms at native Blender scale without stretching', () => {
  const parts = getWardInteriorAssetParts(createBakedAssetRoot());
  fitWardInteriorEnvironment(parts, 12, 9, 3.92);
  assert.deepEqual(parts.architecture.scale.toArray(), [1, 1, 1]);
  const first = parts.architecture.position.toArray().map(v => Number(v.toFixed(4)));
  fitWardInteriorEnvironment(parts, 18, 14, 4.2);
  assert.deepEqual(parts.architecture.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(
    parts.architecture.position.toArray().map(v => Number(v.toFixed(4))),
    first,
  );
});

test('caps extreme metalness so bright glTF surfaces stay readable without studio HDRI', () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15 }),
  );
  root.add(mesh);
  prepareWardInteriorModelMaterials(root, { envMapIntensity: 0.22, maxMetalness: 0.78 });
  const mat = mesh.material as THREE.MeshStandardMaterial;
  assert.equal(mat.metalness, 0.78);
  assert.equal(mat.envMapIntensity, 0.22);
});

test('hides model ceiling occluders for the overhead ward camera', () => {
  const architecture = new THREE.Group();
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  ceiling.name = 'Ceiling';
  const ceilingPanel = ceiling.clone();
  ceilingPanel.name = 'CeilingPanel';
  const backWall = ceiling.clone();
  backWall.name = 'BackWall';
  architecture.add(ceiling, ceilingPanel, backWall);

  hideWardInteriorCeiling(architecture);

  assert.equal(ceiling.visible, false);
  assert.equal(ceilingPanel.visible, false);
  assert.equal(backWall.visible, true);
});

test('keeps every configured bed inside the room for one to six beds', () => {
  assert.deepEqual(resolveWardInteriorModelBedPose(0, 0, 12, 10), null);

  for (let total = 1; total <= 6; total++) {
    const roomW = total <= 2 ? 13 : total === 3 ? 14.8 : total === 4 ? 16 : total === 5 ? 17 : 18;
    const roomD = total <= 2 ? 10.8 : total === 3 ? 11.5 : total === 4 ? 12 : total === 5 ? 13 : 14;
    for (let index = 0; index < total; index++) {
      const pose = resolveWardInteriorModelBedPose(index, total, roomW, roomD);
      assert.ok(pose);
      assert.ok(Math.abs(pose.x) + 1.15 <= roomW / 2 + 0.001);
      assert.ok(pose.z > -roomD / 2);
      assert.ok(pose.z < roomD / 2);
    }
  }
});

test('scales full Blender bed modules to avoid overlap for one to six beds', () => {
  const moduleWidth = 3.92;

  for (let total = 1; total <= 6; total++) {
    const roomW = total <= 2 ? 13 : total === 3 ? 14.8 : total === 4 ? 16 : total === 5 ? 17 : 18;
    const roomD = total <= 2 ? 10.8 : total === 3 ? 11.5 : total === 4 ? 12 : total === 5 ? 13 : 14;
    const poses = Array.from(
      { length: total },
      (_, index) => resolveWardInteriorModelBedPose(index, total, roomW, roomD)!,
    );

    for (const pose of poses) {
      assert.ok(pose.scale >= 0.7 && pose.scale <= 1);
      assert.ok(Math.abs(pose.x) + moduleWidth * pose.scale / 2 <= roomW / 2 + 0.001);
    }
    for (let index = 1; index < poses.length; index++) {
      assert.ok(
        poses[index].x - poses[index - 1].x >= moduleWidth * poses[index].scale - 0.001,
      );
    }
  }
});

test('disposes shared model geometry, materials, and textures only once', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  let geometryDisposals = 0;
  let materialDisposals = 0;
  let textureDisposals = 0;
  geometry.dispose = () => { geometryDisposals++; };
  material.dispose = () => { materialDisposals++; };
  texture.dispose = () => { textureDisposals++; };
  root.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));

  disposeWardInteriorModel(root);

  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(textureDisposals, 1);
});
