import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createSilverStationLights, createSilverStationTheme, prepareSilverStation, SILVER_STATION_SCREENS } from './silver-nurse-station.ts';
import { bindReferenceStationDisplays } from './reference-nurse-station.ts';
import { nurseStationSceneConfig, legacyNurseStationSceneConfig } from '../config/nurse-station-scene.ts';

test('formal configuration selects the silver model with authored scale and safe initial camera', () => {
  const { model, camera, educationVideoUrl } = nurseStationSceneConfig;
  assert.equal(model.layout, 'silver-v1');
  assert.match(model.url, /nurse-station-silver-v2\.glb/);
  assert.equal(educationVideoUrl, '/videos/nurse-station-care-loop.mp4?v=20260929-visible');
  assert.equal(legacyNurseStationSceneConfig.model.layout, 'legacy');
  const azimuth = THREE.MathUtils.degToRad(camera.initialAngle.azimuthDeg);
  const elevation = THREE.MathUtils.degToRad(camera.initialAngle.elevationDeg);
  const position = new THREE.Vector3(Math.cos(elevation) * Math.sin(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.cos(azimuth))
    .multiplyScalar(camera.initialDistance).add(new THREE.Vector3(camera.target.x, camera.target.y, camera.target.z));
  const bounds = camera.viewBounds.localBox!;
  assert.ok(new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)).containsPoint(position));
});

test('default wall video is a bundled MP4 within the lightweight demo budget', () => {
  const bytes = readFileSync(new URL('../../public/videos/nurse-station-care-loop.mp4', import.meta.url));
  assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
  assert.ok(bytes.length > 1024 && bytes.length <= 256 * 1024, 'wall video must stay below 256 KiB');
});

test('silver preparation preserves transforms; all six business screens share the existing binder', () => {
  assert.throws(() => prepareSilverStation(new THREE.Group()), /silver-v1/);
  const model = new THREE.Group(), root = new THREE.Group();
  root.name = 'NurseStationSilverV1'; model.add(root);
  for (const name of [...SILVER_STATION_SCREENS.map(([, name]) => name), 'Clock_Display']) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshStandardMaterial());
    mesh.name = name; mesh.position.set(1, 2, -3); root.add(mesh);
  }
  prepareSilverStation(model);
  assert.deepEqual(model.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(root.getObjectByName('Screen_Main')!.position.toArray(), [1, 2, -3]);
  const displays = bindReferenceStationDisplays(model, () => new THREE.Texture(), SILVER_STATION_SCREENS);
  assert.equal(displays.length, 7);
  const service = displays.find(display => display.screen.userData.sourceScreen === 'Screen_Service')!;
  assert.equal(service.kind, 'wardStatus');
  assert.equal(service.texture.flipY, false);
  assert.equal(root.getObjectByName('Screen_Service')!.visible, false);
});

test('theme round trips restore authored colors, maps and light intensity without accumulating changes', () => {
  const model = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color: '#e8e9ed', map: new THREE.Texture(), roughness: .4, metalness: .6 });
  material.name = 'SilverV1_silver_AO';
  material.aoMap = new THREE.Texture();
  material.aoMap.channel = 1;
  model.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const original = material.color.clone(), map = material.map;
  const lights = createSilverStationLights(), originalIntensity = (lights.children[0] as THREE.Light).intensity;
  const theme = createSilverStationTheme();
  theme(model, lights, true);
  assert.notEqual(material.color.getHex(), original.getHex());
  const dark = material.color.clone();
  theme(model, lights, true);
  assert.equal(material.color.getHex(), dark.getHex());
  theme(model, lights, false);
  assert.equal(material.color.getHex(), original.getHex());
  assert.equal(material.map, map);
  assert.equal(material.aoMap.channel, 1);
  assert.equal(material.roughness, .4);
  assert.equal(material.metalness, .6);
  assert.equal((lights.children[0] as THREE.Light).intensity, originalIntensity);
});

test('hero contact shadows and AO are enabled without changing the authored secondary UV', () => {
  const model = new THREE.Group(), root = new THREE.Group();
  root.name = 'NurseStationSilverV1'; model.add(root);
  const material = new THREE.MeshStandardMaterial({ aoMap: new THREE.Texture() });
  material.aoMap!.channel = 1;
  const hero = new THREE.Mesh(new THREE.BoxGeometry(), material);
  hero.name = 'Hero_SilverV2'; hero.userData.castStationShadow = true;
  const background = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  background.name = 'Architecture_SilverV1_wall';
  root.add(hero, background);
  const ao = material.aoMap;
  prepareSilverStation(model); prepareSilverStation(model);
  assert.equal(hero.castShadow, true);
  assert.equal(background.castShadow, false);
  assert.equal(material.aoMap, ao);
  assert.equal(material.aoMap!.channel, 1);
  assert.equal(material.aoMapIntensity, .72);
});

function surfaceState(material: THREE.MeshStandardMaterial) {
  return { color: material.color.toArray(), roughness: material.roughness, metalness: material.metalness,
    env: material.envMapIntensity, emissive: material.emissive.toArray(), emission: material.emissiveIntensity };
}

test('dark surface roles preserve every PBR map and restore authored properties, including shared materials', () => {
  const root = new THREE.Group(), theme = createSilverStationTheme();
  const materials = ['silver', 'steel', 'cyan', 'lamp', 'sky', 'white', 'wall', 'oak', 'floor'].map(name => {
    const map = new THREE.Texture(), aoMap = new THREE.Texture(); aoMap.channel = 1;
    const material = new THREE.MeshStandardMaterial({ color: '#b5bfc8', roughness: .71, metalness: .62,
      envMapIntensity: .93, emissive: '#304857', emissiveIntensity: 1.7, map, aoMap,
      roughnessMap: map, normalMap: map, metalnessMap: map });
    material.name = `SilverV1_${name}_AO`;
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), [material, material]));
    return material;
  });
  const original = materials.map(surfaceState);
  const maps = materials.map(m => [m.map, m.aoMap, m.roughnessMap, m.normalMap, m.metalnessMap]);
  theme(root, undefined, false);
  assert.deepEqual(materials.map(surfaceState), original, 'initial light mode is unchanged');
  theme(root, undefined, true);
  const dark = materials.map(surfaceState);
  assert.ok(materials[0]!.metalness < original[0]!.metalness, 'counter has softer metallic reflections');
  assert.ok(materials[0]!.envMapIntensity < original[0]!.env, 'reflected room brightness is restrained');
  assert.ok(materials[1]!.roughness !== original[1]!.roughness, 'trim has an independent finish');
  assert.ok(materials[2]!.emissiveIntensity < original[2]!.emission, 'cyan accents do not overpower the scene');
  assert.ok(materials[4]!.emissiveIntensity < original[4]!.emission, 'window emission is dimmed at night');
  for (let repeat = 0; repeat < 3; repeat++) {
    theme(root, undefined, true);
    assert.deepEqual(materials.map(surfaceState), dark, 'shared materials do not accumulate tint/emission');
    theme(root, undefined, false);
    assert.deepEqual(materials.map(surfaceState), original);
    theme(root, undefined, true);
  }
  theme(root, undefined, false);
  assert.deepEqual(materials.map(surfaceState), original);
  materials.forEach((m, index) => {
    [m.map, m.aoMap, m.roughnessMap, m.normalMap, m.metalnessMap].forEach((map, slot) => assert.equal(map, maps[index]![slot]));
    assert.equal(m.aoMap!.channel, 1);
  });
});

test('neutral architectural palette leaves business screens and unknown materials unchanged', () => {
  const root = new THREE.Group(), theme = createSilverStationTheme();
  const wall = new THREE.MeshStandardMaterial(); wall.name = 'SilverV1_wall_AO';
  const wood = new THREE.MeshStandardMaterial(); wood.name = 'SilverV1_oak';
  const unrelated = new THREE.MeshStandardMaterial({ color: '#bf7361', roughness: .2 });
  unrelated.name = 'Corridor_wall';
  const future = unrelated.clone(); future.name = 'SilverV1_future';
  const screen = new THREE.MeshBasicMaterial({ color: '#abcdef', map: new THREE.Texture() }); screen.name = 'SilverV1_white';
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), [wall, wood, unrelated, future, screen]));
  const original = [surfaceState(unrelated), surfaceState(future)], screenColor = screen.color.clone(), screenMap = screen.map;
  theme(root, undefined, true);
  const wallRgb = wall.color.clone().convertLinearToSRGB();
  assert.ok(Math.max(wallRgb.r, wallRgb.g, wallRgb.b) - Math.min(wallRgb.r, wallRgb.g, wallRgb.b) < .1,
    'walls remain low saturation instead of receiving a blue wash');
  assert.ok(wood.color.r > wood.color.g && wood.color.g > wood.color.b, 'wood retains its warm tint');
  assert.deepEqual([surfaceState(unrelated), surfaceState(future)], original);
  assert.deepEqual(screen.color, screenColor);
  assert.equal(screen.map, screenMap);
  theme(root, undefined, false);
  assert.deepEqual([surfaceState(unrelated), surfaceState(future)], original);
  assert.deepEqual(screen.color, screenColor);
  assert.equal(screen.map, screenMap);
});

test('light roles work before model loading, do not tint foreign lights, and restore sky and ground colors', () => {
  const lighting = createSilverStationLights(), theme = createSilverStationTheme();
  const foreign = new THREE.PointLight('#ffaabb', 3); lighting.add(foreign);
  const state = () => {
    const result: object[] = [];
    lighting.traverse(o => { if (o instanceof THREE.Light) result.push({ color: o.color.toArray(), intensity: o.intensity,
      ground: o instanceof THREE.HemisphereLight ? o.groundColor.toArray() : undefined }); });
    return result;
  };
  const original = state(), foreignColor = foreign.color.clone();
  theme(null, lighting, true);
  const dark = state();
  const key = lighting.getObjectByName('station-key') as THREE.Light;
  const side = lighting.getObjectByName('station-left') as THREE.Light;
  assert.ok(key.color.r > key.color.b, 'neutral-warm key light keeps clinical whites readable');
  assert.ok(side.color.b > side.color.r, 'only the side fill is cool');
  assert.deepEqual(foreign.color, foreignColor);
  assert.equal(foreign.intensity, 3);
  theme(null, lighting, true);
  assert.deepEqual(state(), dark);
  const loaded = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color: '#dddddd' });
  material.name = 'SilverV1_white'; loaded.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  const authored = material.color.clone();
  theme(loaded, lighting, true);
  assert.notEqual(material.color.getHex(), authored.getHex(), 'late-loaded geometry receives the active theme');
  theme(loaded, lighting, false);
  assert.deepEqual(state(), original);
  assert.deepEqual(material.color, authored);
  assert.doesNotThrow(() => theme(null, undefined, true));
});
