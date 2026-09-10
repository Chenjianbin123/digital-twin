import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = process.argv[2] ?? 'output/nurse-station-reference-v1/nurse-station-design-v1.glb';
const bytes = await readFile(file);
assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const jsonLength = bytes.readUInt32LE(12);
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 20 + jsonLength + 8;
assert.equal(bytes.readUInt32LE(binaryStart - 4), 0x004e4942);
assert.equal(binaryStart + bytes.readUInt32LE(binaryStart - 8), bytes.length);
const byName = new Map(gltf.nodes.map(node => [node.name, node]));
assert.equal(byName.size, gltf.nodes.length, 'Node names must be unique');
assert.ok(!gltf.nodes.some(node => node.name?.startsWith('Preview_')), 'Preview text must not ship');
assert.ok(!gltf.cameras?.length, 'Review cameras must not ship');
assert.ok(!gltf.extensions?.KHR_lights_punctual, 'Review lighting must not ship');

function values(index) {
  const accessor = gltf.accessors[index];
  assert.equal(accessor.componentType, 5126, 'Expected uncompressed float attributes');
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  assert.ok(size);
  const start = binaryStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = bufferView.byteStride ?? size * 4;
  return Array.from({ length: accessor.count }, (_, i) =>
    Array.from({ length: size }, (_, j) => bytes.readFloatLE(start + i * stride + j * 4)));
}

const displays = ['Screen_Main', ...Array.from({ length: 4 }, (_, i) => `Screen_Work_0${i + 1}`)];
for (const name of displays) {
  const node = byName.get(name);
  assert.ok(node && node.mesh !== undefined, `Missing independent display: ${name}`);
  assert.equal(node.extras.displayRole, name);
  const primitives = gltf.meshes[node.mesh].primitives;
  assert.equal(primitives.length, 1, `${name} must contain only its display face`);
  const primitive = primitives[0];
  assert.equal(gltf.accessors[primitive.indices].count, 6, `${name} must have two triangles`);
  const uv = values(primitive.attributes.TEXCOORD_0);
  assert.deepEqual(new Set(uv.map(pair => pair.join(','))), new Set(['0,0', '1,0', '1,1', '0,1']));
  const positions = values(primitive.attributes.POSITION);
  const normals = values(primitive.attributes.NORMAL);
  for (const tuple of [...positions, ...normals]) assert.ok(tuple.every(Number.isFinite));
  for (const normal of normals) assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-5);
}
for (const name of ['Nurse_Counter', 'Screen_Main_Frame', 'Clock_Display', 'Clock_Frame'])
  assert.ok(byName.has(name), `Missing design anchor: ${name}`);
if (process.argv.includes('--refined')) {
  for (const name of ['Staff_Worktop', 'Staff_Worktop_Riser', 'Lobby_Back_Wall',
    'Corridor_Inner_Wall_-1', 'Corridor_Inner_Wall_1', 'Window_Glazing_-1', 'Window_Glazing_1'])
    assert.ok(byName.has(name), `Missing refinement: ${name}`);
  assert.equal(gltf.nodes.filter(node => /^Staff_Drawer_\d+_\d+$/.test(node.name)).length, 15);
  const top = gltf.meshes[byName.get('Staff_Worktop').mesh].primitives[0];
  const positions = values(top.attributes.POSITION);
  // The exported glTF uses Y-up; the authored worktop is 0.79 m high.
  assert.ok(Math.abs(Math.max(...positions.map(point => point[1])) - .79) < .002);
  for (const name of ['Natural_Oak', 'Warm_White_Solid_Surface', 'Warm_Grey_Vinyl', 'Charcoal_Mesh_Fabric']) {
    const material = gltf.materials.find(item => item.name === name);
    assert.ok(material?.normalTexture, `${name}: missing normal map`);
    assert.ok(material?.pbrMetallicRoughness?.baseColorTexture, `${name}: missing color map`);
    assert.ok(material?.pbrMetallicRoughness?.metallicRoughnessTexture, `${name}: missing roughness map`);
  }
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      const material = gltf.materials[primitive.material];
      if (material.normalTexture)
        assert.notEqual(primitive.attributes.TEXCOORD_0, undefined, `${mesh.name}: normal map requires UVs`);
    }
  }
}
const vertices = gltf.meshes.flatMap(mesh => mesh.primitives)
  .reduce((sum, primitive) => sum + gltf.accessors[primitive.attributes.POSITION].count, 0);
const triangles = gltf.meshes.flatMap(mesh => mesh.primitives)
  .reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0);
console.log(JSON.stringify({ file, bytes: bytes.length, nodes: gltf.nodes.length,
  meshes: gltf.meshes.length, materials: gltf.materials.length,
  triangles, vertices, verifiedIndependentScreens: displays, status: 'design-contract-passed' }, null, 2));
