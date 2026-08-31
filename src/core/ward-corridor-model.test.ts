import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
  WARD_CORRIDOR_SLOT_COUNT,
  WARD_CORRIDOR_CANVAS_TEXTURE_FLIP_Y,
  configureWardCorridorCanvasTexture,
  buildWardCorridorSlots,
  buildWardCorridorBindingSignature,
  getWardCorridorScreenPresentation,
  getWardCorridorScreenNodeScale,
  normalizeWardCorridorNodeName,
  parseWardCorridorSlotIndex,
  shouldReserveWardCorridorModel,
  shouldUseWardCorridorModel,
  getHospitalCorridorDoorOrder,
  getHospitalCorridorEntranceDeviceOrder,
  getHospitalCorridorEntranceScreenOrder,
  getHospitalCorridorDisplayScreenOrder,
  getHospitalCorridorEntranceScreenMaterialIndex,
  getHospitalCorridorEntranceScreenAspect,
  getHospitalCorridorEntranceScreenBounds,
  createHospitalCorridorDisplayGeometry,
  fitHospitalCorridorEntranceScreenGeometry,
  shouldDepthTestHospitalCorridorScreen,
  normalizeHospitalCorridorModelTransform,
  HOSPITAL_CORRIDOR_DOOR_NAMES,
  HOSPITAL_CORRIDOR_ENTRANCE_DEVICE_NAMES,
} from './ward-corridor-model.ts';

test('creates a horizontal corridor display geometry with normalized screen UVs', () => {
  const geometry = new THREE.BoxGeometry(0.1, 2, 4);
  geometry.clearGroups();
  geometry.addGroup(0, geometry.index?.count ?? 0, 0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());

  const displayGeometry = createHospitalCorridorDisplayGeometry(mesh, 0);
  const uv = displayGeometry.getAttribute('uv');
  const values = Array.from({ length: uv.count }, (_, index) => [uv.getX(index), uv.getY(index)]);

  assert.equal(displayGeometry.groups.length, 1);
  assert.ok(values.every(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1));
  assert.ok(new Set(values.map(([u]) => u)).size > 1);
  assert.ok(new Set(values.map(([, v]) => v)).size > 1);
  const positions = displayGeometry.getAttribute('position');
  const maxZIndex = values.reduce(
    (best, _value, index) => positions.getZ(index) > positions.getZ(best) ? index : best,
    0,
  );
  assert.ok(values[maxZIndex][0] > 0.99);
  const minYIndex = values.reduce(
    (best, _value, index) => positions.getY(index) < positions.getY(best) ? index : best,
    0,
  );
  assert.ok(values[minYIndex][1] < 0.01);
});

test('maps room data to six corridor slots and fills remaining slots with empty beds', () => {
  const rooms = [
    { sickroomName: '301房' },
    { sickroomName: '302房' },
  ];
  const slots = buildWardCorridorSlots(rooms);

  assert.equal(slots.length, WARD_CORRIDOR_SLOT_COUNT);
  assert.deepEqual(slots[0], {
    slotIndex: 0,
    roomIndex: 0,
    label: '301',
    interactive: true,
  });
  assert.deepEqual(slots[1], {
    slotIndex: 1,
    roomIndex: 1,
    label: '302',
    interactive: true,
  });
  assert.deepEqual(slots[2], {
    slotIndex: 2,
    roomIndex: null,
    label: '空床',
    interactive: false,
  });
});

test('keeps the GLB active when extra rooms exceed the six physical doors', () => {
  assert.equal(shouldUseWardCorridorModel(0), true);
  assert.equal(shouldUseWardCorridorModel(6), true);
  assert.equal(shouldUseWardCorridorModel(7), true);
  assert.equal(shouldUseWardCorridorModel(-1), false);
});

test('keeps the fallback corridor visible until the GLB is loaded', () => {
  assert.equal(shouldReserveWardCorridorModel(7, false, true), true);
  assert.equal(shouldReserveWardCorridorModel(6, false, true), true);
  assert.equal(shouldReserveWardCorridorModel(7, false, false), false);
  assert.equal(shouldReserveWardCorridorModel(7, true, true), false);
  assert.equal(shouldReserveWardCorridorModel(-1, false, true), false);
});

test('recognizes and orders only the six doors from the hospital corridor model', () => {
  const doorNames = [...HOSPITAL_CORRIDOR_DOOR_NAMES];
  const nodes = [
    new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()),
    ...doorNames.map((name, index) => {
      const node = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
      node.name = name;
      node.position.z = 10 - index;
      return node;
    }),
  ];
  nodes[0].name = '宣传板1';

  assert.deepEqual(
    getHospitalCorridorDoorOrder(nodes).map(node => node.name),
    doorNames,
  );
});

test('recognizes independent entrance-device template nodes', () => {
  const nodes = [...HOSPITAL_CORRIDOR_ENTRANCE_DEVICE_NAMES, '门1']
    .map((name, index) => {
      const node = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
      node.name = name;
      node.position.z = index;
      return node;
    });

  assert.deepEqual(
    getHospitalCorridorEntranceDeviceOrder(nodes).map(node => node.name),
    ['门口机10', '门口机9', '门口机8', '门口机7', '门口机6', '门口机5', '门口机4', '门口机3', '门口机2', '门口机1'],
  );
});

test('recognizes a named entrance-device group with child meshes as the screen template', () => {
  const root = new THREE.Group();
  const device = new THREE.Group();
  device.name = '门口机1';
  const screenMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.8, 0.1),
    new THREE.MeshBasicMaterial(),
  );
  screenMesh.name = '门口机1屏幕网格';
  device.add(screenMesh);
  root.add(device);

  assert.deepEqual(
    getHospitalCorridorEntranceDeviceOrder([root, device, screenMesh]).map(node => node.name),
    ['门口机1'],
  );
});

test('recognizes every mesh carrying the 门口机内 material', () => {
  const screenMaterial = new THREE.MeshBasicMaterial();
  screenMaterial.name = '门口机内';
  const bodyMaterial = new THREE.MeshBasicMaterial();
  bodyMaterial.name = '门口机周';
  const screenA = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [bodyMaterial, screenMaterial]);
  const screenB = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), screenMaterial);
  const bodyOnly = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), bodyMaterial);
  screenA.position.z = 1;
  screenB.position.z = 2;

  assert.deepEqual(
    getHospitalCorridorEntranceScreenOrder([screenA, screenB, bodyOnly]),
    [screenB, screenA],
  );
});

test('recognizes the two corridor displays before using material fallback', () => {
  const first = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  first.name = '走廊屏1';
  const second = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  second.name = '走廊屏2';
  const other = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  other.name = '门口机1';
  assert.deepEqual(
    getHospitalCorridorDisplayScreenOrder([other, second, first]).map(node => node.name),
    ['走廊屏1', '走廊屏2'],
  );
});

test('selects one screen mesh per named corridor display group', () => {
  const material = new THREE.MeshBasicMaterial();
  material.name = '门口机内';
  const firstGroup = new THREE.Group();
  firstGroup.name = '走廊屏1';
  firstGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  const firstScreen = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  firstScreen.name = '立方体024';
  firstGroup.add(firstScreen);
  const secondGroup = new THREE.Group();
  secondGroup.name = '走廊屏2';
  const secondScreen = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  secondScreen.name = '立方体024_1';
  secondGroup.add(secondScreen);

  assert.deepEqual(
    getHospitalCorridorDisplayScreenOrder([firstGroup, secondGroup]).map(node => node.name),
    ['立方体024', '立方体024_1'],
  );
});

test('does not bind the same fallback mesh twice', () => {
  const material = new THREE.MeshBasicMaterial();
  material.name = '门口机内';
  const screen = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  const result = getHospitalCorridorDisplayScreenOrder([screen, screen]);
  assert.equal(result.length, 1);
  assert.equal(result[0], screen);
});

test('returns the exact 门口机内 material index for direct model-surface rendering', () => {
  const shell = new THREE.MeshBasicMaterial();
  shell.name = '门口机周';
  const screen = new THREE.MeshBasicMaterial();
  screen.name = '门口机内';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [shell, screen]);

  assert.equal(getHospitalCorridorEntranceScreenMaterialIndex(mesh), 1);
});

test('derives the visible door-screen aspect ratio from the model geometry', () => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.2, 6),
    new THREE.MeshBasicMaterial(),
  );
  mesh.scale.set(0.5, 1, 0.25);

  assert.ok(Math.abs(getHospitalCorridorEntranceScreenAspect(mesh) - (5 / 1.5)) < 0.001);
});

test('derives the door-screen aspect ratio from the 门口机内 material surface, not the outer shell', () => {
  const shell = new THREE.MeshBasicMaterial();
  shell.name = '门口机周';
  const screen = new THREE.MeshBasicMaterial();
  screen.name = '门口机内';
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    -5, -5, 0, 5, -5, 0, 5, 5, 0, -5, 5, 0,
    -1, -2, 0, 1, -2, 0, 1, 2, 0, -1, 2, 0,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
  ]);
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, 6, 1);
  const mesh = new THREE.Mesh(geometry, [shell, screen]);

  assert.ok(Math.abs(getHospitalCorridorEntranceScreenAspect(mesh) - (4 / 2)) < 0.001);
});

test('keeps model door screens behind the physical frame for oblique views', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.userData.hospitalCorridorTemplateDevice = true;
  assert.equal(shouldDepthTestHospitalCorridorScreen(mesh), true);

  mesh.userData.generatedHospitalCorridorOverlay = true;
  assert.equal(shouldDepthTestHospitalCorridorScreen(mesh), false);
});

test('fits only the 门口机内 geometry to a 9:16 screen without stretching the frame', () => {
  const shell = new THREE.MeshBasicMaterial();
  shell.name = '门口机周';
  const screen = new THREE.MeshBasicMaterial();
  screen.name = '门口机内';
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5,
    -1, 0, -2, 1, 0, -2, 1, 0, 2, -1, 0, 2,
  ]), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  geometry.addGroup(0, 6, 0);
  geometry.addGroup(6, 6, 1);
  const mesh = new THREE.Mesh(geometry, [shell, screen]);
  const originalShellSize = new THREE.Box3().setFromBufferAttribute(
    geometry.getAttribute('position') as THREE.BufferAttribute,
  ).getSize(new THREE.Vector3());

  fitHospitalCorridorEntranceScreenGeometry(mesh);

  const fittedBounds = getHospitalCorridorEntranceScreenBounds(mesh, 1);
  const fittedSize = fittedBounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(fittedSize.z / fittedSize.x - 9 / 16) < 0.001);
  assert.deepEqual(
    new THREE.Box3().setFromBufferAttribute(
      mesh.geometry.getAttribute('position') as THREE.BufferAttribute,
    ).getSize(new THREE.Vector3()).toArray(),
    originalShellSize.toArray(),
  );
});

test('normalizes the Y-up corridor model to centered bounds', () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 6, 2), new THREE.MeshBasicMaterial());
  mesh.position.set(10, -20, 5);
  root.add(mesh);

  const bounds = normalizeHospitalCorridorModelTransform(root);

  assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x) < 1e-6);
  assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).z) < 1e-6);
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 4) < 1e-6);
  assert.ok(Math.abs(size.y - 6) < 1e-6);
  assert.ok(Math.abs(size.z - 2) < 1e-6);
});

test('parses one-based Blender room object names into zero-based slot indexes', () => {
  assert.equal(parseWardCorridorSlotIndex('Room 01 door'), 0);
  assert.equal(parseWardCorridorSlotIndex('Room 06 live screen surface'), 5);
  assert.equal(parseWardCorridorSlotIndex('Room_01_live_screen_surface'), 0);
  assert.equal(parseWardCorridorSlotIndex('Room number 301 text'), null);
  assert.equal(parseWardCorridorSlotIndex('Room 07 door'), 6);
});

test('normalizes GLTFLoader sanitized room node names', () => {
  assert.equal(
    normalizeWardCorridorNodeName('Room_01_live_screen_surface'),
    'Room 01 live screen surface',
  );
  assert.equal(
    normalizeWardCorridorNodeName('Room_01_vertical_frame001'),
    'Room 01 vertical frame001',
  );
});

test('changes binding signature when a room template or door orientation changes', () => {
  const before = buildWardCorridorBindingSignature([
    { sickroomCode: '301', templateId: 3, director: '0' },
  ]);
  const after = buildWardCorridorBindingSignature([
    { sickroomCode: '301', templateId: 797, director: '1' },
  ]);
  assert.notEqual(before, after);
});

test('preserves readable horizontal and vertical door-screen aspect ratios', () => {
  const horizontal = getWardCorridorScreenPresentation(true);
  const vertical = getWardCorridorScreenPresentation(false);

  assert.ok(Math.abs(horizontal.width / horizontal.height - 16 / 9) < 0.03);
  assert.ok(Math.abs(vertical.width / vertical.height - 540 / 810) < 0.03);
  assert.ok(horizontal.shellWidth > horizontal.width);
  assert.ok(vertical.shellWidth > vertical.width);
  assert.ok(horizontal.shellWidth > horizontal.shellHeight);
  assert.ok(vertical.shellWidth < vertical.shellHeight);
});

test('maps corridor screen dimensions to the exported glTF node axes', () => {
  const horizontal = getWardCorridorScreenNodeScale(true);
  const vertical = getWardCorridorScreenNodeScale(false);

  assert.ok(horizontal.screen.x > horizontal.screen.z);
  assert.ok(vertical.screen.x < vertical.screen.z);
  assert.equal(horizontal.screen.y, 1);
  assert.ok(horizontal.shell.z > horizontal.shell.y);
  assert.ok(vertical.shell.z > vertical.screen.x);
});

test('configures corridor canvas textures for glTF UV orientation', () => {
  const texture = { flipY: true, needsUpdate: false };

  configureWardCorridorCanvasTexture(texture);

  assert.equal(WARD_CORRIDOR_CANVAS_TEXTURE_FLIP_Y, false);
  assert.deepEqual(texture, { flipY: false, needsUpdate: true });
});
