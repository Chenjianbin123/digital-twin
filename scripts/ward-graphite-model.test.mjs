import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { wardInteriorSceneConfig } from '../src/config/ward-interior-scene.ts';
import { createWardBedUnit, disposeWardBedUnit, validateWardBedUnit } from '../src/core/ward-bed-unit.ts';
import { captureWardInteriorBoundMeshes, getWardInteriorPaddedBounds } from '../src/core/ward-interior-view-bounds.ts';
import { createDracoGeometryLoader } from './helpers/draco-geometry-loader.mjs';

const assetDirectory = new URL('../public/models/smart-ward-interior/', import.meta.url);
const files = { room: 'ward-graphite-room-v1.glb', bed: 'ward-graphite-bed-v1.glb' };
const bedSlots = [[-1.45, 0, -1.5], [1.45, 0, -1.5]];
const tolerance = 0.002;
let assetsPromise;

function readGlb(bytes, filename) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', filename);
  assert.equal(bytes.readUInt32LE(4), 2, filename);
  assert.equal(bytes.readUInt32LE(8), bytes.length, filename);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First GLB chunk is JSON');
  const jsonLength = bytes.readUInt32LE(12);
  const binaryHeader = 20 + jsonLength;
  assert.equal(bytes.readUInt32LE(binaryHeader + 4), 0x004e4942, 'Second GLB chunk is binary');
  const binaryLength = bytes.readUInt32LE(binaryHeader);
  assert.equal(binaryHeader + 8 + binaryLength, bytes.length, 'No truncated or trailing binary chunks');
  return {
    bytes,
    json: JSON.parse(bytes.subarray(20, binaryHeader).toString('utf8')),
    binary: bytes.subarray(binaryHeader + 8),
  };
}

async function assets() {
  assetsPromise ??= (async () => {
    globalThis.ProgressEvent ??= class {};
    const loader = await createDracoGeometryLoader(THREE, GLTFLoader);
    const result = {};
    for (const [kind, filename] of Object.entries(files)) {
      const asset = readGlb(await readFile(new URL(filename, assetDirectory)), filename);
      // CPU contract checks preserve real geometry/transforms; browser acceptance covers pixels.
      const geometryDocument = structuredClone(asset.json);
      geometryDocument.buffers[0].uri = `data:application/octet-stream;base64,${asset.binary.toString('base64')}`;
      geometryDocument.materials = geometryDocument.materials.map(({ name }) => ({ name }));
      delete geometryDocument.images;
      delete geometryDocument.textures;
      asset.scene = (await loader.parseAsync(JSON.stringify(geometryDocument), '')).scene;
      asset.scene.updateMatrixWorld(true);
      result[kind] = asset;
    }
    return result;
  })();
  return assetsPromise;
}

function meshUnder(root, name) {
  const node = root.getObjectByName(name);
  assert.ok(node, `Missing runtime node: ${name}`);
  const mesh = node.isMesh ? node : node.getObjectByProperty('isMesh', true);
  assert.ok(mesh?.isMesh, `${name} must contain rendered geometry`);
  return node;
}

function assertScreenOrientation(screen) {
  screen.updateWorldMatrix(true, false);
  const position = screen.geometry.getAttribute('position');
  const uv = screen.geometry.getAttribute('uv');
  assert.ok(uv && uv.count === position.count, 'Screen has UVs for every vertex');
  const points = Array.from({ length: position.count }, (_, index) => ({
    world: new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(screen.matrixWorld),
    u: uv.getX(index), v: uv.getY(index),
  }));
  const bounds = new THREE.Box3().setFromPoints(points.map(point => point.world));
  for (const point of points) {
    assert.ok(point.u >= -tolerance && point.u <= 1 + tolerance, 'U remains in the full screen range');
    assert.ok(point.v >= -tolerance && point.v <= 1 + tolerance, 'V remains in the full screen range');
    if (Math.abs(point.world.y - bounds.max.y) < tolerance)
      assert.ok(Math.abs(point.v) < tolerance, 'Physical top maps to canvas top with flipY=false');
    if (Math.abs(point.world.y - bounds.min.y) < tolerance)
      assert.ok(Math.abs(point.v - 1) < tolerance, 'Physical bottom maps to canvas bottom');
  }
  const left = points.filter(point => point.u < tolerance);
  const right = points.filter(point => point.u > 1 - tolerance);
  assert.ok(left.length && right.length, 'UV spans both horizontal edges');
  const averageX = list => list.reduce((sum, point) => sum + point.world.x, 0) / list.length;
  assert.ok(averageX(left) > averageX(right), 'Text is not mirrored when viewed from the bed foot (-Z)');
  const normal = screen.geometry.getAttribute('normal');
  assert.ok(normal, 'Independent display surface has normals');
  const facing = new THREE.Vector3().fromBufferAttribute(normal, 0).transformDirection(screen.matrixWorld);
  assert.ok(facing.dot(new THREE.Vector3(0, 0, -1)) > 0.999, 'Display faces the room, away from the headwall');
}

test('graphite assets are embedded, reachable, and stay inside agreed delivery budgets', async () => {
  const loaded = await assets();
  for (const [kind, asset] of Object.entries(loaded)) {
    const doc = asset.json;
    assert.ok(asset.bytes.length <= 10 * 1024 * 1024, `${kind}: at most 10 MiB per asset`);
    assert.ok(doc.images?.length > 0, `${kind}: embedded material textures are present`);
    assert.ok(doc.images.every(image => Number.isInteger(image.bufferView) && !image.uri), 'No external texture dependencies');
    assert.ok(doc.buffers.every(buffer => !buffer.uri), 'Binary buffers are embedded');
    const aoMaterials = doc.materials.filter(material => material.occlusionTexture);
    assert.ok(aoMaterials.length > 0, `${kind}: baked occlusion textures are exported`);
    const aoNames = new Set(aoMaterials.map(material => material.name));
    for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
      const material = doc.materials[primitive.material];
      if (!material.occlusionTexture) continue;
      assert.equal(material.occlusionTexture.texCoord, 1, `${material.name}: AO uses a separate UV atlas`);
      assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_1), `${material.name}: primitive contains UV1`);
      assert.equal(doc.accessors[primitive.attributes.TEXCOORD_1].count, doc.accessors[primitive.attributes.POSITION].count);
      assert.equal(material.pbrMetallicRoughness?.baseColorTexture?.texCoord ?? 0, 0, 'Base color retains authored UV0');
      assert.equal(material.normalTexture?.texCoord ?? 0, 0, 'Surface detail retains authored UV0');
      const texture = doc.textures[material.occlusionTexture.index];
      assert.ok(texture && Number.isInteger(doc.images[texture.source]?.bufferView), 'AO pixels are embedded in this GLB');
    }
    let decodedAoMeshes = 0;
    asset.scene.traverse(node => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (!materials.some(material => aoNames.has(material.name))) return;
      const uv = node.geometry.getAttribute('uv1');
      assert.ok(uv, 'Real decoded geometry contains the AO atlas, not only JSON declarations');
      assert.equal(uv.count, node.geometry.getAttribute('position').count);
      for (const component of uv.array) assert.ok(Number.isFinite(component) && component >= -tolerance && component <= 1 + tolerance, 'Decoded AO coordinates stay within the packed atlas');
      decodedAoMeshes++;
    });
    assert.ok(decodedAoMeshes > 0, `${kind}: decoded AO geometry is reachable`);
    const reachable = new Set();
    function visit(index) {
      assert.ok(!reachable.has(index), 'Exported hierarchy has no cycles or multiply parented nodes');
      reachable.add(index);
      const node = doc.nodes[index];
      assert.ok(node, 'Child node index resolves');
      assert.equal(node.camera, undefined, 'Preview cameras are not in runtime assets');
      assert.ok(!node.extras?.previewOnly && !/^Preview_/i.test(node.name ?? ''), 'No demonstration-only screen content');
      for (const child of node.children ?? []) visit(child);
    }
    for (const root of doc.scenes[doc.scene ?? 0].nodes) visit(root);
    assert.equal(reachable.size, doc.nodes.length, 'All exported nodes belong to the scene');
    const triangles = doc.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((sum, primitive) => {
      assert.equal(primitive.mode ?? 4, 4, 'Triangle geometry only');
      return sum + doc.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3;
    }, 0), 0);
    assert.ok(triangles > 1000, `${kind}: not an empty placeholder`);
    assert.ok(triangles <= (kind === 'room' ? 150000 : 160000), `${kind}: ${triangles} triangles exceeds its budget`);
  }
  assert.ok(loaded.room.bytes.length + loaded.bed.bytes.length <= 20 * 1024 * 1024, 'Combined runtime delivery is at most 20 MiB');
});

test('new room uses the documented metre-scale envelope without baked-in duplicate beds', async () => {
  const { room } = await assets();
  meshUnder(room.scene, '外壳');
  meshUnder(room.scene, '灯');
  assert.equal(room.scene.getObjectByName('BedUnit'), undefined, 'Room shell must not contain a preview bed unit');
  assert.equal(room.scene.getObjectByName('BedBody'), undefined, 'Bed body is supplied by the separate unit');
  const bounds = new THREE.Box3().setFromObject(room.scene.getObjectByName('外壳'));
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 6.4) < 0.4, `Room width is approximately 6.4 m, got ${size.x}`);
  assert.ok(Math.abs(size.y - 3.1) < 0.3, `Room height is approximately 3.1 m, got ${size.y}`);
  assert.ok(Math.abs(size.z - 4.6) < 0.4, `Room depth is approximately 4.6 m, got ${size.z}`);
  assert.ok(Math.abs(bounds.min.y) < 0.2, 'Floor is near metre-scale origin, not the legacy Y=0.9 offset');
  const raw = captureWardInteriorBoundMeshes(room.scene);
  assert.ok(raw && getWardInteriorPaddedBounds(raw), 'Shell and light still expose a valid future camera envelope');
});

test('new bed exports a complete cloneable unit at human scale with an independent upright terminal', async () => {
  const { bed } = await assets();
  validateWardBedUnit(bed.scene);
  const root = bed.scene.getObjectByName('BedUnit');
  assert.ok(root && root.position.length() < tolerance, 'Reusable unit root is at the origin');
  assert.ok(root.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < tolerance, 'Reusable unit uses scale one');
  for (const name of ['BedBody', 'BedsideCabinet', 'BedTerminal', 'IVStand', 'InfusionEquipment']) meshUnder(root, name);
  const body = new THREE.Box3().setFromObject(root.getObjectByName('BedBody'));
  const size = body.getSize(new THREE.Vector3());
  assert.ok(size.x >= 0.9 && size.x <= 1.5, `Bed width is human-scale: ${size.x}`);
  assert.ok(size.z >= 2 && size.z <= 2.6, `Bed length is human-scale: ${size.z}`);
  assert.ok(body.min.y >= -0.05 && body.min.y <= 0.15, 'Bed wheels reach the floor');
  const screen = root.getObjectByName('BedTerminalSurface');
  assert.ok(screen.isMesh && !Array.isArray(screen.material), 'Terminal is a separate single-material display mesh');
  assert.equal((screen.geometry.index?.count ?? screen.geometry.getAttribute('position').count) / 3, 2, 'Display is a quad, not its bezel');
  const local = new THREE.Box3().setFromBufferAttribute(screen.geometry.getAttribute('position'));
  const localSize = local.getSize(new THREE.Vector3());
  assert.ok(localSize.x < tolerance && localSize.y > 0.01 && localSize.z > 0.01, 'Terminal remains a local YZ plane for runtime UV normalization');
  assertScreenOrientation(screen);
});

test('two reference beds fit the new room and isolate dynamic screens while sharing static geometry', async () => {
  const { room, bed } = await assets();
  const a = createWardBedUnit(bed.scene, 'SYNTHETIC-A');
  const b = createWardBedUnit(bed.scene, 'SYNTHETIC-B');
  try {
    assert.notEqual(a.screen.geometry, b.screen.geometry, 'Each screen owns its UV geometry');
    assert.notEqual(a.screen.material, b.screen.material, 'Patient data cannot leak through a shared material');
    const firstMesh = node => node.isMesh ? node : node.getObjectByProperty('isMesh', true);
    assert.equal(firstMesh(a.body).geometry, firstMesh(b.body).geometry, 'Static detailed beds share geometry');
    assert.equal(a.infusion.visible, false);
    assert.equal(b.infusion.visible, false);
    a.infusion.visible = true;
    assert.equal(b.infusion.visible, false, 'Infusion visibility belongs to one bed');
    const shell = new THREE.Box3().setFromObject(room.scene.getObjectByName('外壳'));
    [a, b].forEach((unit, index) => {
      unit.group.position.set(...bedSlots[index]);
      unit.group.updateMatrixWorld(true);
      const body = new THREE.Box3().setFromObject(unit.body);
      assert.ok(shell.clone().expandByScalar(tolerance).containsBox(body), 'Reference bed body remains inside its room');
      assertScreenOrientation(unit.screen);
    });
    assert.ok(!new THREE.Box3().setFromObject(a.body).intersectsBox(new THREE.Box3().setFromObject(b.body)), 'Reference bed bodies do not overlap');
    assert.equal(a.screen.userData.bedCode, 'SYNTHETIC-A');
    assert.equal(b.screen.userData.bedCode, 'SYNTHETIC-B');
    a.screen.material.color.set('#ef4050');
    assert.equal(b.screen.material.color.getHex(), 0xffffff, 'One terminal update does not change its neighbour');
  } finally {
    disposeWardBedUnit(a);
    disposeWardBedUnit(b);
  }
});

test('0/1/2/3 prototype clones are independent without pretending the legacy room expansion fits the new coordinates', async () => {
  const { bed } = await assets();
  for (const count of [0, 1, 2, 3]) {
    const units = Array.from({ length: count }, (_, index) => createWardBedUnit(bed.scene, `SYNTHETIC-${count}-${index}`));
    try {
      assert.equal(new Set(units.map(unit => unit.group)).size, count);
      assert.equal(new Set(units.map(unit => unit.screen.material)).size, count);
      assert.equal(new Set(units.map(unit => unit.screen.userData.bedCode)).size, count);
    } finally {
      units.forEach(disposeWardBedUnit);
    }
  }
});

test('model-only delivery leaves both existing production asset URLs unchanged', () => {
  assert.match(wardInteriorSceneConfig.model.url, /^\/models\/smart-ward-interior\/room-refined-v1\.glb(?:\?|$)/);
  assert.match(wardInteriorSceneConfig.modular.unitUrl, /^\/models\/smart-ward-interior\/bed-v2\.glb(?:\?|$)/);
});
