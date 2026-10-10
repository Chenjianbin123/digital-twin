import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { applyWarmStationLighting, createWarmStationLights, createWarmStationTheme, prepareWarmStationShadows, WARM_STATION_APPEARANCE } from './warm-nurse-station-theme.ts';

interface TextureInfo { index: number; scale?: number }
interface GltfMaterial {
  name: string;
  alphaMode?: string;
  doubleSided?: boolean;
  normalTexture?: TextureInfo;
  emissiveTexture?: TextureInfo;
  emissiveFactor?: number[];
  extensions?: {
    KHR_materials_emissive_strength?: { emissiveStrength: number };
    KHR_materials_transmission?: { transmissionFactor: number };
  };
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    baseColorTexture?: TextureInfo;
    roughnessFactor?: number;
    metallicFactor?: number;
    metallicRoughnessTexture?: TextureInfo;
  };
}

const bytes = readFileSync(new URL('../../public/models/smart-ward-nurse-station/nurse-station-warm-v3.glb', import.meta.url));
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12))) as {
  materials: GltfMaterial[];
  textures: object[];
};

function fixture() {
  const textures = gltf.textures.map(() => new THREE.Texture());
  const materials = gltf.materials.map(source => {
    const pbr = source.pbrMetallicRoughness;
    const material = new THREE.MeshStandardMaterial({
      roughness: pbr?.roughnessFactor ?? 1,
      metalness: pbr?.metallicFactor ?? 1,
      emissiveIntensity: source.extensions?.KHR_materials_emissive_strength?.emissiveStrength ?? 1,
      transparent: source.alphaMode === 'BLEND',
      opacity: pbr?.baseColorFactor?.[3] ?? 1,
      side: source.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
    material.name = source.name;
    if (pbr?.baseColorFactor) material.color.fromArray(pbr.baseColorFactor);
    if (source.emissiveFactor) material.emissive.fromArray(source.emissiveFactor);
    if (pbr?.baseColorTexture) material.map = textures[pbr.baseColorTexture.index]!;
    if (pbr?.metallicRoughnessTexture) {
      material.roughnessMap = textures[pbr.metallicRoughnessTexture.index]!;
      material.metalnessMap = material.roughnessMap;
    }
    if (source.normalTexture) {
      material.normalMap = textures[source.normalTexture.index]!;
      material.normalScale.setScalar(source.normalTexture.scale ?? 1);
    }
    if (source.emissiveTexture) material.emissiveMap = textures[source.emissiveTexture.index]!;
    return material;
  });
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry();
  root.add(new THREE.Mesh(geometry, materials), new THREE.Mesh(geometry, materials));
  const get = (name: string) => {
    const material = materials.find(entry => entry.name === name);
    assert.ok(material, `warm-v3 must contain ${name}`);
    return material;
  };
  return { root, materials, get };
}

function state(material: THREE.MeshStandardMaterial) {
  return {
    color: material.color.toArray(), roughness: material.roughness, metalness: material.metalness,
    envMapIntensity: material.envMapIntensity, emissive: material.emissive.toArray(), emission: material.emissiveIntensity,
    opacity: material.opacity, transparent: material.transparent, side: material.side,
    normalScale: material.normalScale.toArray(), aoMapIntensity: material.aoMapIntensity, version: material.version,
  };
}

function maps(material: THREE.MeshStandardMaterial) {
  return [material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.emissiveMap, material.aoMap];
}

test('day and night share warm neutral architectural finishes and differ through lighting', () => {
  const { root, get } = fixture(), apply = createWarmStationTheme();
  const wall = get('WarmStationV1_wall'), ceiling = get('WarmStationV2_v2_ceiling_metal');
  const countertop = get('WarmStationV1_white'), panel = get('WarmStationV2_v2_wall_panel');
  const led = get('WarmStationV2_RecessedWarmLED'), lamp = get('WarmStationV1_lamp');
  const neutral = (color: THREE.Color) => {
    const rgb = color.clone().convertLinearToSRGB().toArray();
    return Math.max(...rgb) - Math.min(...rgb) < .1;
  };
  apply(root, false);
  assert.ok(neutral(wall.color) && neutral(lamp.emissive), 'light whites and lamps are neutral');
  assert.ok(wall.color.r > .65 && countertop.color.r > wall.color.r, 'medical whites stay readable');
  const lightWall = wall.color.clone(), lightCeiling = ceiling.color.clone();
  apply(root, true);
  assert.deepEqual(wall.color, lightWall);
  assert.deepEqual(ceiling.color, lightCeiling);
  assert.ok(neutral(wall.color) && neutral(ceiling.color) && neutral(panel.color), 'architecture avoids a blue wash');
  assert.ok(countertop.color.r > wall.color.r, 'counter remains a clean ivory finish');
  assert.ok(neutral(led.emissive), 'recessed strips are near-white rather than saturated cyan');
  assert.ok(neutral(lamp.emissive), 'general ceiling lamps remain neutral');
  assert.ok(get('WarmStationV1_blue').color.b > get('WarmStationV1_blue').color.r, 'wayfinding remains deep blue');
  assert.notEqual(WARM_STATION_APPEARANCE.light.background, WARM_STATION_APPEARANCE.dark.background);
  assert.ok(WARM_STATION_APPEARANCE.dark.environmentIntensity < WARM_STATION_APPEARANCE.light.environmentIntensity / 2);
  const finishes = ['WarmStationV1_oak', 'WarmStationV3_oak_column', 'WarmStationV3_oak_door',
    'WarmStationV3_oak_portal', 'WarmStationV1_floor', 'WarmStationV1_floor_blue', 'WarmStationV1_white'].map(get);
  const night = finishes.map(state);
  apply(root, false);
  assert.deepEqual(finishes.map(state), night, 'theme changes do not repaint wood, floors or counter');
});

test('light-dark-light cycles are idempotent across shared actual materials and late-loaded models', () => {
  const { root, materials } = fixture(), apply = createWarmStationTheme();
  assert.doesNotThrow(() => apply(null, true));
  apply(root, false);
  const light = materials.map(state);
  apply(root, true);
  const dark = materials.map(state);
  for (let repeat = 0; repeat < 4; repeat++) {
    apply(root, true);
    assert.deepEqual(materials.map(state), dark);
    apply(root, false);
    assert.deepEqual(materials.map(state), light);
    apply(root, false);
    assert.deepEqual(materials.map(state), light);
  }
  const late = fixture();
  apply(late.root, true);
  assert.deepEqual(late.materials.map(state), dark, 'a first dark call uses authored parameters');
  apply(late.root, false);
  assert.deepEqual(late.materials.map(state), light);
});

test('textured oak keeps its authored map and linear brightness instead of receiving a dark paint color', () => {
  const { root, get } = fixture(), apply = createWarmStationTheme();
  const wood = ['WarmStationV1_oak', 'WarmStationV3_oak_column', 'WarmStationV3_oak_door', 'WarmStationV3_oak_portal'].map(get);
  const original = wood.map(material => ({ color: material.color.clone(), roughness: material.roughness, maps: maps(material) }));
  apply(root, true);
  wood.forEach((material, index) => {
    const authored = original[index]!;
    assert.ok(material.color.r > .5 && material.color.g > .5 && material.color.b > .5, 'wood texture is not multiplied into black');
    assert.ok(material.color.b / authored.color.b > material.color.r / authored.color.r, 'cool multiplier moderates the warm texture');
    assert.equal(material.roughness, authored.roughness, 'authored roughness texture retains its full range');
    maps(material).forEach((map, slot) => assert.equal(map, authored.maps[slot]));
  });
});

test('shared materials update once per application without cloning materials, maps or enabling transmission', t => {
  const { root, materials, get } = fixture(), apply = createWarmStationTheme();
  const wallColor = t.mock.method(get('WarmStationV1_wall').color, 'set');
  const originalMaps = materials.map(maps);
  const originalTextures = new Set(originalMaps.flat().filter(Boolean));
  materials.forEach(material => t.mock.method(material, 'clone', () => { throw new Error('theme must not clone materials'); }));
  originalTextures.forEach(texture => t.mock.method(texture!, 'clone', () => { throw new Error('theme must not clone textures'); }));
  for (const dark of [false, true, true, false]) {
    apply(root, dark);
    root.children.forEach(mesh => assert.equal((mesh as THREE.Mesh).material, materials));
    materials.forEach((material, index) => {
      maps(material).forEach((map, slot) => assert.equal(map, originalMaps[index]![slot]));
      assert.equal('transmission' in material, false);
    });
    assert.deepEqual(new Set(materials.flatMap(maps).filter(Boolean)), originalTextures);
  }
  assert.equal(wallColor.mock.callCount(), 4, 'each shared material is updated once per application');
  assert.ok(gltf.materials.every(material => !material.extensions?.KHR_materials_transmission));
});

test('business displays, glass, plants, unknown materials and non-PBR screens remain unchanged', () => {
  const { root, materials } = fixture(), apply = createWarmStationTheme();
  const untouched = materials.filter(material => /screen|display|_glass$|_green$/i.test(material.name));
  assert.ok(untouched.length >= 15, 'fixture includes actual door, clock and workstation displays');
  const unknown = new THREE.MeshStandardMaterial({ color: '#ad826b', map: new THREE.Texture(), roughness: .24 });
  unknown.name = 'WarmStationV3_future';
  const screen = new THREE.MeshBasicMaterial({ color: '#abcdef', map: new THREE.Texture() });
  screen.name = 'WarmStationV1_white';
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), [unknown, screen]));
  untouched.push(unknown);
  const original = untouched.map(state), originalMaps = untouched.map(maps);
  const screenColor = screen.color.clone(), screenMap = screen.map;
  for (const dark of [false, true, false]) {
    apply(root, dark);
    assert.deepEqual(untouched.map(state), original);
    untouched.forEach((material, index) => maps(material).forEach((map, slot) => assert.equal(map, originalMaps[index]![slot])));
    assert.deepEqual(screen.color, screenColor);
    assert.equal(screen.map, screenMap);
  }
});

test('light themes are finite and idempotent, keep worktop illumination and use one static 2048 shadow', () => {
  const group = createWarmStationLights(), foreign = new THREE.PointLight('#ff8844', 3);
  group.add(foreign);
  const snapshot = () => {
    const lights: object[] = [];
    group.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      assert.ok(Number.isFinite(object.intensity) && object.intensity > 0);
      assert.ok([...object.color.toArray(), ...object.position.toArray(), ...object.quaternion.toArray()].every(Number.isFinite));
      lights.push({ color: object.color.toArray(), intensity: object.intensity,
        ground: object instanceof THREE.HemisphereLight ? object.groundColor.toArray() : undefined });
    });
    return lights;
  };
  const light = snapshot(), foreignColor = foreign.color.clone();
  const worktop = group.getObjectByName('warm-station-worktop') as THREE.RectAreaLight;
  const originalWorktopIntensity = worktop.intensity;
  applyWarmStationLighting(group, true);
  const dark = snapshot();
  assert.ok(worktop.intensity >= originalWorktopIntensity, 'dark mode retains focused clinical task light');
  for (let repeat = 0; repeat < 3; repeat++) {
    applyWarmStationLighting(group, true); assert.deepEqual(snapshot(), dark);
    applyWarmStationLighting(group, false); assert.deepEqual(snapshot(), light);
  }
  assert.deepEqual(foreign.color, foreignColor); assert.equal(foreign.intensity, 3);
  const key = group.getObjectByName('warm-station-key') as THREE.SpotLight;
  assert.equal(key.castShadow, true); assert.equal(key.shadow.autoUpdate, false); assert.equal(key.shadow.needsUpdate, true);
  assert.deepEqual(key.shadow.mapSize.toArray(), [2048, 2048]);
  assert.equal(key.target.parent, group);
  assert.equal(group.children.filter(object => object instanceof THREE.Light && object.castShadow).length, 1);
});

test('shadow preparation follows glTF node groups instead of generated primitive names', () => {
  const root = new THREE.Group(), desk = new THREE.Group(), equipment = new THREE.Group();
  desk.name = 'Desk_Static'; equipment.name = 'Equipment_Static'; root.add(desk, equipment);
  const surface = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  surface.name = 'Desk_Chinese_NurseStation001_1'; desk.add(surface);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ transparent: true }));
  equipment.add(glass);
  const screen = surface.clone(); screen.userData.runtimeSurface = true; equipment.add(screen);
  const architecture = surface.clone(); root.add(architecture);
  prepareWarmStationShadows(root);
  assert.equal(surface.castShadow, true); assert.equal(surface.receiveShadow, true);
  assert.equal(glass.castShadow, false);
  assert.equal(architecture.castShadow, false); assert.equal(architecture.receiveShadow, true);
  assert.equal(screen.castShadow, false); assert.equal(screen.receiveShadow, false);
});
