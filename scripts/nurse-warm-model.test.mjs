import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createDracoGeometryLoader } from './helpers/draco-geometry-loader.mjs';

const version = process.env.NURSE_WARM_VERSION ?? 'v1';
if (!['v1', 'v2', 'v3'].includes(version)) {
  throw new Error('NURSE_WARM_VERSION must be exactly v1, v2 or v3');
}
const rootName = `NurseStationWarmV${version.slice(1)}`;
const assetUrl = new URL(`../public/models/smart-ward-nurse-station/nurse-station-warm-${version}.glb`, import.meta.url);
const screenNames = ['Screen_Main', 'Clock_Display',
  ...Array.from({ length: 4 }, (_, index) => `Screen_Work_${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 7 }, (_, index) => `DoorScreen_${301 + index}`)];
const tolerance = 0.002;
let assetPromise;

async function asset() {
  assetPromise ??= (async () => {
    const bytes = await readFile(assetUrl);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF', 'Asset is a binary glTF');
    assert.equal(bytes.readUInt32LE(4), 2, 'glTF version is 2');
    assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB length matches the actual file');
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, 'First GLB chunk is JSON');
    const binaryHeader = 20 + bytes.readUInt32LE(12);
    assert.ok(binaryHeader + 8 <= bytes.length, 'Binary chunk header is present');
    assert.equal(bytes.readUInt32LE(binaryHeader + 4), 0x004e4942, 'Second GLB chunk is binary');
    assert.equal(binaryHeader + 8 + bytes.readUInt32LE(binaryHeader), bytes.length, 'Binary chunk is neither truncated nor followed by hidden data');
    const json = JSON.parse(bytes.subarray(20, binaryHeader).toString('utf8'));
    const binary = bytes.subarray(binaryHeader + 8);
    globalThis.ProgressEvent ??= class {};
    const loader = await createDracoGeometryLoader(THREE, GLTFLoader);
    // Decode the actual compressed geometry. Pixel/material appearance is checked in Blender/browser.
    const geometryDocument = structuredClone(json);
    geometryDocument.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
    geometryDocument.materials = geometryDocument.materials.map(({ name }) => ({ name }));
    delete geometryDocument.images;
    delete geometryDocument.textures;
    const scene = (await loader.parseAsync(JSON.stringify(geometryDocument), '')).scene;
    scene.updateMatrixWorld(true);
    return { bytes, json, binary, scene };
  })();
  return assetPromise;
}

function triangleCount(document, primitive) {
  assert.equal(primitive.mode ?? 4, 4, 'Every primitive is triangle geometry');
  const accessor = document.accessors[primitive.indices ?? primitive.attributes.POSITION];
  assert.ok(accessor && accessor.count > 0 && accessor.count % 3 === 0, 'Triangle accessor has a complete vertex/index count');
  return accessor.count / 3;
}

test('warm nurse-station GLB embeds all textures and stays below its delivery budgets', async () => {
  const { bytes, json, binary } = await asset();
  assert.ok(bytes.length < 18 * 1024 * 1024, `Asset must be below 18 MiB; got ${bytes.length} bytes`);
  assert.equal(json.buffers.length, 1, 'Runtime GLB has one embedded buffer');
  assert.equal(json.buffers[0].uri, undefined, 'No external binary dependency');
  assert.ok(binary.length >= json.buffers[0].byteLength && binary.length - json.buffers[0].byteLength <= 3, 'Embedded buffer length only differs by permitted GLB padding');
  assert.ok(json.images?.length > 0, 'Real material textures are present');
  if (version !== 'v1') {
    // v1 uses 28 materials / 25 images / 38 texture references. Allow refinement,
    // but catch accidental material copies and duplicate texture exports in later versions.
    assert.ok(json.materials.length <= 48, `${version} material budget is 48; got ${json.materials.length}`);
    assert.ok(json.images.length <= 40, `${version} embedded image budget is 40; got ${json.images.length}`);
    assert.ok(json.textures?.length > 0 && json.textures.length <= 64,
      `${version} texture reference budget is 64; got ${json.textures?.length ?? 0}`);
    for (const texture of json.textures) {
      assert.ok(Number.isInteger(texture.source) && json.images[texture.source], `Every ${version} texture references an embedded image`);
    }
  }
  for (const image of json.images) {
    assert.equal(image.uri, undefined, `${image.name}: image is not external`);
    assert.ok(Number.isInteger(image.bufferView), `${image.name}: image uses an embedded buffer view`);
    const view = json.bufferViews[image.bufferView];
    assert.ok(view && view.buffer === 0 && view.byteLength > 0, `${image.name}: image buffer view resolves`);
    const start = view.byteOffset ?? 0;
    assert.ok(start >= 0 && start + view.byteLength <= binary.length, `${image.name}: image pixels fit inside the binary chunk`);
    const pixels = binary.subarray(start, start + view.byteLength);
    if (image.mimeType === 'image/png') {
      assert.deepEqual(pixels.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'Embedded PNG signature is valid');
    } else {
      assert.equal(image.mimeType, 'image/jpeg', 'Material image uses a core glTF image format');
      assert.equal(pixels.readUInt16BE(0), 0xffd8, 'Embedded JPEG signature is valid');
    }
  }
  const meshTriangles = json.meshes.map(mesh => mesh.primitives.reduce((sum, primitive) => sum + triangleCount(json, primitive), 0));
  const instancedTriangles = json.nodes.reduce((sum, node) => sum + (node.mesh === undefined ? 0 : meshTriangles[node.mesh]), 0);
  assert.ok(instancedTriangles > 1000, 'The model is not an empty placeholder');
  assert.ok(instancedTriangles < 600000, `All scene instances together must remain below 600k triangles; got ${instancedTriangles}`);
});

test('warm nurse-station hierarchy has a metre-scale root and excludes preview lights/cameras', async () => {
  const { json, scene } = await asset();
  const roots = json.nodes.map((node, index) => ({ node, index })).filter(({ node }) => node.name === rootName);
  assert.equal(roots.length, 1, `There is exactly one ${rootName} root`);
  const { node: root, index: rootIndex } = roots[0];
  assert.equal(root.extras?.units, 'metres');
  assert.equal(root.extras?.surveyed, false, 'Reference reconstruction must not claim surveyed coordinates');
  if (version !== 'v1') assert.equal(root.extras?.assetRevision, `warm-${version}`, `${version} declares its authored asset revision`);
  assert.deepEqual(json.scenes[json.scene ?? 0].nodes, [rootIndex], 'The authored root owns the entire delivered scene');
  assert.equal(json.cameras?.length ?? 0, 0, 'Render cameras are not exported');
  assert.equal(json.extensions?.KHR_lights_punctual?.lights?.length ?? 0, 0, 'Render lights are not exported');
  const visited = new Set();
  function visit(index) {
    assert.ok(Number.isInteger(index) && json.nodes[index], 'Every hierarchy reference resolves');
    assert.ok(!visited.has(index), 'No cycles or multiply parented nodes');
    visited.add(index);
    const node = json.nodes[index];
    assert.equal(node.camera, undefined, `${node.name}: no camera node`);
    assert.equal(node.extensions?.KHR_lights_punctual, undefined, `${node.name}: no punctual light node`);
    for (const child of node.children ?? []) visit(child);
  }
  visit(rootIndex);
  assert.equal(visited.size, json.nodes.length, 'There are no unreachable exported nodes');
  const decodedRoot = scene.getObjectByName(rootName);
  assert.ok(decodedRoot && decodedRoot.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < tolerance, 'Metre-scale root retains scale one after actual decoding');
  scene.traverse(node => {
    assert.ok(!node.isLight && !node.isCamera, 'Decoded runtime scene has no preview lighting/cameras');
    if (!node.isMesh) return;
    const positions = node.geometry.getAttribute('position');
    assert.ok(positions && positions.count > 0, 'Actual mesh geometry is decoded');
    for (const value of positions.array) assert.ok(Number.isFinite(value), 'Decoded geometry contains finite coordinates');
  });
});

test('all 13 business screens are isolated single-primitive quad meshes with unique materials', async () => {
  const { json, scene } = await asset();
  const materialIndices = new Set();
  const meshIndices = new Set();
  for (const name of screenNames) {
    const nodes = json.nodes.filter(node => node.name === name);
    assert.equal(nodes.length, 1, `${name}: one explicitly named surface`);
    const node = nodes[0];
    assert.ok(Number.isInteger(node.mesh), `${name}: independent mesh rather than a bezel group`);
    assert.ok(!meshIndices.has(node.mesh), `${name}: does not share its mesh with another business screen`);
    meshIndices.add(node.mesh);
    const primitives = json.meshes[node.mesh].primitives;
    assert.equal(primitives.length, 1, `${name}: one primitive`);
    const primitive = primitives[0];
    assert.equal(triangleCount(json, primitive), 2, `${name}: exactly two triangles`);
    assert.ok(Number.isInteger(primitive.material), `${name}: a dedicated material is assigned`);
    assert.ok(!materialIndices.has(primitive.material), `${name}: material is not shared with another screen`);
    materialIndices.add(primitive.material);
    const uses = json.meshes.flatMap(mesh => mesh.primitives).filter(item => item.material === primitive.material);
    assert.equal(uses.length, 1, `${name}: changing its content cannot paint another static mesh`);
    const screen = scene.getObjectByName(name);
    assert.ok(screen?.isMesh && !Array.isArray(screen.material), `${name}: decoded object is a single-material Mesh`);
    const geometry = screen.geometry;
    const position = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    assert.ok(uv && uv.count === position.count, `${name}: every decoded vertex has a UV`);
    const points = Array.from({ length: position.count }, (_, index) => new THREE.Vector3().fromBufferAttribute(position, index));
    const uniquePoints = new Set(points.map(point => point.toArray().map(value => value.toFixed(6)).join(',')));
    assert.equal(uniquePoints.size, 4, `${name}: has four distinct physical corners`);
    const corners = new Set();
    for (let index = 0; index < uv.count; index++) {
      const values = [uv.getX(index), uv.getY(index)];
      assert.ok(values.every(Number.isFinite), `${name}: UVs are finite`);
      assert.ok(values.every(value => Math.abs(value) <= tolerance || Math.abs(value - 1) <= tolerance), `${name}: quad UVs are full-range screen corners`);
      corners.add(values.map(value => Math.abs(value) <= tolerance ? 0 : 1).join(','));
    }
    assert.deepEqual([...corners].sort(), ['0,0', '0,1', '1,0', '1,1'], `${name}: UVs cover the complete 0..1 rectangle`);
    const indices = geometry.index ? Array.from(geometry.index.array) : points.map((_, index) => index);
    assert.equal(indices.length, 6, `${name}: decoded quad has two triangles`);
    let plane;
    for (let offset = 0; offset < indices.length; offset += 3) {
      const triangle = indices.slice(offset, offset + 3).map(index => {
        assert.ok(Number.isInteger(index) && points[index], `${name}: triangle indices resolve`);
        return points[index];
      });
      const cross = new THREE.Vector3().subVectors(triangle[1], triangle[0]).cross(new THREE.Vector3().subVectors(triangle[2], triangle[0]));
      assert.ok(cross.length() > 1e-8, `${name}: neither triangle collapses to a line`);
      plane ??= new THREE.Plane().setFromNormalAndCoplanarPoint(cross.normalize(), triangle[0]);
    }
    for (const point of points) assert.ok(Math.abs(plane.distanceToPoint(point)) < tolerance, `${name}: all four corners remain planar`);
  }
  assert.equal(meshIndices.size, 13);
  assert.equal(materialIndices.size, 13);
});

test('decoded screens face their intended viewers with upright non-mirrored canvas UVs', async () => {
  const { scene } = await asset();
  const up = new THREE.Vector3(0, 1, 0);
  for (const name of screenNames) {
    const screen = scene.getObjectByName(name);
    assert.ok(screen?.isMesh, `${name}: screen mesh exists`);
    const expected = new THREE.Vector3(...(name.startsWith('DoorScreen_') ? [-1, 0, 0]
      : name === 'Screen_Work_04' ? [1, 0, 0]
        : name.startsWith('Screen_Work_') ? [0, 0, -1] : [0, 0, 1]));
    const positions = screen.geometry.getAttribute('position');
    const normals = screen.geometry.getAttribute('normal');
    const uv = screen.geometry.getAttribute('uv');
    assert.ok(normals && normals.count === positions.count, `${name}: every vertex has a decoded normal`);
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(screen.matrixWorld);
    const points = Array.from({ length: positions.count }, (_, index) => {
      const normal = new THREE.Vector3().fromBufferAttribute(normals, index).applyMatrix3(normalMatrix).normalize();
      assert.ok(normal.dot(expected) > 0.999, `${name}: screen faces its intended viewer in glTF Y-up space`);
      return { world: new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(screen.matrixWorld),
        u: uv.getX(index), v: uv.getY(index) };
    });
    const bounds = new THREE.Box3().setFromPoints(points.map(point => point.world));
    assert.ok(bounds.max.y - bounds.min.y > tolerance * 2, `${name}: upright screen has measurable height`);
    const top = points.filter(point => Math.abs(point.world.y - bounds.max.y) < tolerance);
    const bottom = points.filter(point => Math.abs(point.world.y - bounds.min.y) < tolerance);
    assert.ok(top.length && bottom.length, `${name}: both physical vertical edges exist`);
    assert.ok(top.every(point => Math.abs(point.v) < tolerance), `${name}: physical top maps to canvas top with flipY=false`);
    assert.ok(bottom.every(point => Math.abs(point.v - 1) < tolerance), `${name}: physical bottom maps to canvas bottom`);
    const right = new THREE.Vector3().crossVectors(up, expected).normalize();
    const leftPoints = points.filter(point => Math.abs(point.u) < tolerance);
    const rightPoints = points.filter(point => Math.abs(point.u - 1) < tolerance);
    assert.ok(leftPoints.length && rightPoints.length, `${name}: both horizontal UV edges exist`);
    const horizontal = list => list.reduce((sum, point) => sum + point.world.dot(right), 0) / list.length;
    assert.ok(horizontal(rightPoints) - horizontal(leftPoints) > tolerance, `${name}: U increases towards the viewer's right, not mirrored`);
    const indices = screen.geometry.index?.array ?? points.map((_, index) => index);
    for (let index = 0; index < indices.length; index += 3) {
      const a = points[indices[index]].world;
      const b = points[indices[index + 1]].world;
      const c = points[indices[index + 2]].world;
      const facing = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
      assert.ok(facing.dot(expected) > 0.999, `${name}: actual triangle winding agrees with the visible front`);
    }
  }
});

test('decoded counter keeps its central staff space and rear entrance open', async () => {
  const { scene } = await asset();
  const desk = scene.getObjectByName('Desk');
  assert.ok(desk, 'The counter retains its own geometry group');
  const bounds = new THREE.Box3().setFromObject(desk);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(size.x > 4 && size.y > 0.8 && size.z > 2, 'Counter geometry has a non-empty human-scale envelope');
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  // Sample comfortably inside the current U, not on bevels or panel seams.
  const staffZ = THREE.MathUtils.lerp(bounds.min.z, bounds.max.z, 0.45);
  const rearZ = bounds.min.z - 0.30;
  const ray = new THREE.Raycaster();
  const hits = (origin, direction, far) => {
    ray.set(origin, direction);
    ray.near = 0;
    ray.far = far;
    return ray.intersectObject(desk, true);
  };
  const frontHeight = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, 0.5);
  assert.ok(hits(new THREE.Vector3(centerX, frontHeight, bounds.max.z + 0.30),
    new THREE.Vector3(0, 0, -1), 0.60).length > 0, 'Positive control: the raycaster can hit the real front fascia');
  for (const fraction of [-0.10, 0, 0.10]) {
    const x = centerX + size.x * fraction;
    // Check both directions so an incorrectly wound closing face cannot escape detection.
    assert.equal(hits(new THREE.Vector3(x, bounds.max.y + 0.30, staffZ),
      new THREE.Vector3(0, -1, 0), size.y + 0.60).length, 0, 'No top slab or solid fill closes the central staff space');
    assert.equal(hits(new THREE.Vector3(x, bounds.min.y - 0.30, staffZ),
      new THREE.Vector3(0, 1, 0), size.y + 0.60).length, 0, 'Central staff space is also clear from below');
    for (const height of [0.30, 0.60, 0.90]) {
      const y = THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, height);
      assert.equal(hits(new THREE.Vector3(x, y, rearZ), new THREE.Vector3(0, 0, 1),
        staffZ - rearZ).length, 0, 'Rear entry is clear from outside to the counter interior');
      assert.equal(hits(new THREE.Vector3(x, y, staffZ), new THREE.Vector3(0, 0, -1),
        staffZ - rearZ).length, 0, 'Rear entry has no reverse-facing cap or crossbar');
    }
  }
});

test('model-only warm delivery does not switch the existing production nurse-station URL', async () => {
  const source = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /nurse-station-warm-v[123]\.glb/, 'No warm reference asset is enabled in production before integration approval');
});
