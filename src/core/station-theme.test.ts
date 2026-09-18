import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStationTheme } from './station-theme.ts';

test('station theme applies both themes and leaves screens untouched', () => {
  const apply = createStationTheme();
  const root = new THREE.Group();
  let wall = new THREE.MeshStandardMaterial({ color: '#dddbca' });
  wall.name = 'Warm_White_Paint';
  const screen = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), wall), new THREE.Mesh(new THREE.BoxGeometry(), screen));
  const light = new THREE.HemisphereLight(0xe6f1ff, 0xb3a28a, .6);
  const lights = new THREE.Group();
  lights.add(light);
  const original = wall.color.clone();
  for (let i = 0; i < 3; i++) {
    apply(root, lights, true);
    wall = (root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.notEqual(wall.color.getHex(), original.getHex());
    assert.equal(screen.color.getHex(), 0xffffff);
    apply(root, lights, false);
    wall = (root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(wall.color.getHexString(), 'e3ecee');
    assert.equal(screen.color.getHex(), 0xffffff);
    assert.ok(light.intensity < .6);
  }
});

test('dark materials soften reflections and light mode keeps stable physical props', () => {
  const apply = createStationTheme();
  const root = new THREE.Group();
  let surface = new THREE.MeshStandardMaterial({ color: '#eeeecc', roughness: .31, envMapIntensity: 1.2 });
  surface.name = 'Warm_White_Solid_Surface';
  let led = new THREE.MeshStandardMaterial({ color: '#ffeed0', emissive: '#ffc070', emissiveIntensity: 3 });
  led.name = 'Warm_LED';
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), surface), new THREE.Mesh(new THREE.BoxGeometry(), led));
  for (let i = 0; i < 4; i++) {
    apply(root, undefined, true);
    surface = (root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    led = (root.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(surface.roughness, .82);
    assert.ok(surface.envMapIntensity < 1.2);
    assert.ok(led.emissiveIntensity < 3);
    apply(root, undefined, false);
    surface = (root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    led = (root.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    assert.equal(surface.roughness, .86);
    assert.ok(surface.envMapIntensity < 1.2);
    assert.equal(surface.color.getHexString(), 'eef3f2');
    assert.equal(led.emissive.getHexString(), 'edf3f3');
    assert.ok(led.emissiveIntensity >= .35);
  }
});

test('approved palette separates shared wood surfaces in dark and light themes', () => {
  const root = new THREE.Group();
  const apply = createStationTheme();
  const map = new THREE.Texture();
  const normalMap = new THREE.Texture();
  const wood = new THREE.MeshStandardMaterial({ color: '#a48361', map, normalMap });
  wood.name = 'Natural_Oak';
  const wall = new THREE.Mesh(new THREE.BoxGeometry(), wood);
  wall.name = 'Oak_Wall_Panel_00';
  const counter = new THREE.Mesh(new THREE.BoxGeometry(), wood);
  counter.name = 'Nurse_Counter_Oak';
  root.add(wall, counter);
  apply(root, undefined, true);
  const darkWall = wall.material as THREE.MeshStandardMaterial;
  const darkCounter = counter.material as THREE.MeshStandardMaterial;
  assert.notEqual(darkWall, darkCounter);
  assert.equal(darkWall.color.getHexString(), 'd8e1df');
  assert.equal(darkCounter.color.getHexString(), '7ca0ae');
  assert.equal(darkWall.map, null);
  assert.equal(darkWall.normalMap, null);
  assert.equal(wood.map, map);
  for (let i = 0; i < 3; i++) {
    apply(root, undefined, false);
    const lightWall = wall.material as THREE.MeshStandardMaterial;
    const lightCounter = counter.material as THREE.MeshStandardMaterial;
    assert.equal(lightWall.map, null);
    assert.equal(lightWall.normalMap, normalMap);
    assert.equal(lightWall.color.getHexString(), 'ced8d5');
    assert.equal(lightCounter.color.getHexString(), 'b8cdd1');
    assert.equal(lightCounter.map, null);
    apply(root, undefined, true);
    assert.equal(wall.material, darkWall);
    assert.equal(counter.material, darkCounter);
  }
});

test('approved architecture colors keep shared paint and counter surfaces independent', () => {
  const root = new THREE.Group();
  const apply = createStationTheme();
  const paint = new THREE.MeshStandardMaterial({ color: '#ddddcc' });
  paint.name = 'Warm_White_Paint';
  const surface = new THREE.MeshStandardMaterial({ color: '#eeeecc' });
  surface.name = 'Warm_White_Solid_Surface';
  const wood = new THREE.MeshStandardMaterial({ color: '#aa8866' });
  wood.name = 'Natural_Oak';
  const darkCases = [
    ['Ceiling', paint, 'eceee6'],
    ['墙壁', paint, '83aabb'],
    ['Corridor_Inner_Wall_1', paint, '83aabb'],
    ['Back_Wall', paint, 'd8e1df'],
    ['Nurse_Counter', surface, '7ca0ae'],
    ['Nurse_Counter_Top', surface, 'e1e8ea'],
    ['Station_Canopy', surface, '7da2b0'],
    ['Ward_Door_1_0', wood, '527d8d'],
    ['Oak_Wall_Panel_00', wood, 'd8e1df'],
  ] as const;
  const lightCases = [
    ['Ceiling', 'eef2f1'],
    ['墙壁', 'e3ecee'],
    ['Corridor_Inner_Wall_1', 'e3ecee'],
    ['Back_Wall', 'e5edec'],
    ['Nurse_Counter', 'eef3f2'],
    ['Nurse_Counter_Top', 'f4f6f4'],
    ['Station_Canopy', 'f0f4f3'],
    ['Ward_Door_1_0', '78969d'],
    ['Oak_Wall_Panel_00', 'ced8d5'],
  ] as const;
  for (const [name, material] of darkCases) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.name = name;
    root.add(mesh);
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    apply(root, undefined, true);
    darkCases.forEach(([name, , color], i) =>
      assert.equal(
        (root.children[i] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.color.getHexString(),
        color,
        `dark:${name}`,
      ));
    apply(root, undefined, false);
    lightCases.forEach(([name, color], i) =>
      assert.equal(
        (root.children[i] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.color.getHexString(),
        color,
        `light:${name}`,
      ));
  }
});
