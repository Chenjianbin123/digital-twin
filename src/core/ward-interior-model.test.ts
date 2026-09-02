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
  getWardInteriorBedPlacementDebugInfo,
  getWardInteriorAssetParts,
  hideWardInteriorCeiling,
  prepareWardInteriorModelMaterials,
  resolveBakedWardInteriorCameraFromRays,
  resolveBakedWardInteriorPresetView,
  resolveWardInteriorModelBedPose,
  setWardInteriorBedTerminalMaterial,
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

function createBakedScreen(name: string, z: number) {
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.38),
    new THREE.MeshBasicMaterial({ name: '门口机内' }),
  );
  screen.name = name;
  screen.position.set(-1.05, 1.75, z);
  screen.rotation.y = Math.PI / 2;
  return screen;
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

test('reports each baked bed terminal candidate and proxy orientation', () => {
  const root = createBakedAssetRoot();
  root.add(createBakedScreen('检测设施.002', -1));
  root.add(createBakedScreen('检测设施.010', 1.5));

  const parts = getWardInteriorAssetParts(root);
  const diagnostics = getWardInteriorBedPlacementDebugInfo(parts);

  assert.equal(diagnostics.length, 2);
  assert.equal(diagnostics[0].bedIndex, 0);
  assert.equal(diagnostics[0].screenSource, 'model');
  assert.deepEqual(diagnostics[0].terminalCandidates.map(candidate => candidate.name), ['检测设施.002']);
  assert.ok(diagnostics[0].proxy.worldPosition[0] < diagnostics[0].mattress.worldCenter[0]);
  assert.ok(diagnostics[0].proxy.frontNormal[0] > 0.9);
  assert.equal(diagnostics[1].terminalCandidates[0].name, '检测设施.010');
});

test('uses GLTFLoader duplicate names and binds the inner screen mesh from a terminal group', () => {
  const root = createBakedAssetRoot();
  root.getObjectByName('床.001')!.name = '床001';

  const terminal = new THREE.Group();
  terminal.name = '检测设施002';
  terminal.position.set(-1.08, 1.35, -1);
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.52, 0.68),
    new THREE.MeshBasicMaterial({ name: '门口机周' }),
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.62),
    new THREE.MeshBasicMaterial({ name: '门口机内' }),
  );
  screen.name = '立方体035_1';
  screen.rotation.y = Math.PI / 2;
  const uv = screen.geometry.getAttribute('uv');
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, 0.25 + uv.getX(index) * 0.5, 0.2 + uv.getY(index) * 0.6);
  }
  terminal.add(shell, screen);
  root.add(terminal);

  const parts = getWardInteriorAssetParts(root);

  assert.equal(parts.bakedBeds.length, 2);
  assert.equal(parts.bakedBeds[0].bedTerminalScreen.name, '立方体035_1');
  assert.equal(parts.bakedBeds[0].bedTerminalScreen.parent?.name, '检测设施002');
  assert.equal(getWardInteriorBedPlacementDebugInfo(parts)[0].screenSource, 'model');
  const normalizedUv = parts.bakedBeds[0].bedTerminalScreen.geometry.getAttribute('uv');
  const uvValues = Array.from({ length: normalizedUv.count }, (_, index) => [
    normalizedUv.getX(index),
    normalizedUv.getY(index),
  ]);
  assert.deepEqual(
    uvValues.reduce(
      (bounds, [u, v]) => ({
        minU: Math.min(bounds.minU, u),
        maxU: Math.max(bounds.maxU, u),
        minV: Math.min(bounds.minV, v),
        maxV: Math.max(bounds.maxV, v),
      }),
      { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity },
    ),
    { minU: 0, maxU: 1, minV: 0, maxV: 1 },
  );
  assert.deepEqual(
    uvValues.map(([u, v]) => [Number(u.toFixed(3)), Number(v.toFixed(3))]),
    [[1, 1], [1, 0], [0, 1], [0, 0]],
  );
});

test('replaces only the inner screen material group on a multi-material terminal mesh', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      0, 0, 0, 0, 1, 0, 0, 0, 1,
      0.02, 0, 0, 0.02, 0, 1, 0.02, 1, 0,
    ], 3),
  );
  geometry.addGroup(0, 3, 0);
  geometry.addGroup(3, 3, 1);
  const shell = new THREE.MeshStandardMaterial({ name: '门口机周' });
  const screen = new THREE.MeshStandardMaterial({ name: '门口机内' });
  const mesh = new THREE.Mesh(geometry, [shell, screen]);
  const dynamic = new THREE.MeshBasicMaterial({ name: '门口机内·动态模板' });

  setWardInteriorBedTerminalMaterial(mesh, dynamic);

  assert.ok(Array.isArray(mesh.material));
  assert.equal(mesh.material.length, 2);
  assert.equal(mesh.material[0], shell);
  assert.equal(mesh.material[1], dynamic);
  assert.equal(mesh.geometry.groups[1].materialIndex, 1);
  assert.equal(mesh.userData.wardInteriorTerminalMaterialIndex, 1);
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

test('locks the doorway camera from floor, wall and door ray hits', () => {
  const root = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(6, 0.08, 8), new THREE.MeshStandardMaterial());
  floor.name = '地板';
  floor.position.set(0, 0.04, 0);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.08), new THREE.MeshStandardMaterial());
  door.name = '门把手.001';
  door.position.set(0, 1.05, 3.96);
  const back = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.08), new THREE.MeshStandardMaterial());
  back.name = '后墙';
  back.position.set(0, 1.5, -4);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 8), new THREE.MeshStandardMaterial());
  left.name = '左墙';
  left.position.set(-3, 1.5, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 8), new THREE.MeshStandardMaterial());
  right.name = '右墙';
  right.position.set(3, 1.5, 0);
  root.add(floor, door, back, left, right);

  const framed = resolveBakedWardInteriorCameraFromRays(root);
  assert.equal(framed.debug.door?.name, '门把手.001');
  assert.ok(framed.debug.floor);
  assert.ok(framed.view.position.z > framed.view.target.z);
  assert.ok(framed.view.position.y > 1.4 && framed.view.position.y < 1.8);
  assert.ok(framed.view.position.z > 2.5);

  const top = resolveBakedWardInteriorPresetView('top', framed.view, root);
  assert.ok(top.position.y > framed.view.position.y);
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
