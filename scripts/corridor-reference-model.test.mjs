import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { createDracoGeometryLoader } from './helpers/draco-geometry-loader.mjs';

// Inspect exported binary geometry, not just Blender source or node-name regexes.
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { GLTFLoader } = await server.ssrLoadModule('three/examples/jsm/loaders/GLTFLoader.js');
  const helpers = await server.ssrLoadModule('/src/core/ward-corridor-model.ts');
  const { captureWardCorridorBoundMeshes } = await server.ssrLoadModule('/src/core/ward-corridor-camera.ts');
  for (const version of ['v1', 'v2']) {
  const bytes = await readFile(`public/models/hospital-corridor/corridor-reference-${version}.glb`);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.ok(bytes.length < 12 * 1024 * 1024, 'Reference asset with embedded PBR/AO maps must stay under 12 MiB');
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  assert.ok(!doc.nodes.some(n => /Preview_|preview_screen/i.test(n.name)), 'Illustrative identities must never ship');
  const mapCount = doc.images.length;
  assert.ok(mapCount >= (version === 'v1' ? 2 : 10), 'Authored material maps must ship');
  assert.ok(doc.images.every(i => Number.isInteger(i.bufferView) && !i.uri), 'Textures must be embedded, not external');
  // Reused meshes still draw once per node: budget scene instances, not unique geometry only.
  const instanceMeshes = doc.nodes.filter(node => Number.isInteger(node.mesh)).map(node => doc.meshes[node.mesh]);
  const primitiveCount = instanceMeshes.reduce((n, mesh) => n + mesh.primitives.length, 0);
  assert.ok(primitiveCount <= 150, `Too many material draws: ${primitiveCount}`);
  const triangles = instanceMeshes.reduce((sum, mesh) => sum+mesh.primitives.reduce((n, p) => n+doc.accessors[p.indices].count/3, 0), 0);
  assert.ok(triangles < 240000, `Visible-detail triangle budget exceeded: ${triangles}`);
  if (version === 'v2') {
    assert.ok(doc.extensionsRequired.includes('KHR_draco_mesh_compression'));
    assert.equal(doc.nodes.find(n => n.name === 'CorridorReferenceV2').extras.surveyed, false);
    assert.ok(doc.materials.filter(m => m.occlusionTexture).length >= 10);
    for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
      const material = doc.materials[primitive.material];
      if (!material.occlusionTexture) continue;
      assert.equal(material.occlusionTexture.texCoord, 1, 'AO must not replace the primary screen/PBR UV');
      assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_1));
      assert.equal(material.pbrMetallicRoughness.baseColorTexture?.texCoord ?? 0, 0);
    }
  }
  // The Node geometry test has no image decoder; browser acceptance covers maps.
  doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + jsonLength).toString('base64')}`;
  doc.materials = doc.materials.map(({ name }) => ({ name }));
  delete doc.images; delete doc.textures;
  globalThis.ProgressEvent ??= class {};
  const loader = version === 'v2' ? await createDracoGeometryLoader(THREE, GLTFLoader) : new GLTFLoader();
  const { scene } = await loader.parseAsync(JSON.stringify(doc), '');
  helpers.normalizeHospitalCorridorModelTransform(scene);
  scene.rotation.y = Math.PI / 2;
  scene.updateMatrixWorld(true);
  const volume = captureWardCorridorBoundMeshes(scene);
  assert.ok(volume);
  assert.equal(volume.widthAxis, 'x');
  assert.ok(Math.abs(volume.wallMin + volume.wallMax) < .001, 'Runtime corridor must remain centred after +90 degree rotation');
  assert.ok(volume.lengthMax-volume.lengthMin > 26);
  const nodes = [];
  scene.traverse(n => nodes.push(n));
  assert.equal(helpers.getHospitalCorridorDoorOrder(nodes).length, 10);
  assert.equal(helpers.getHospitalCorridorEntranceScreenOrder(nodes).length, 10);
  assert.equal(helpers.getHospitalCorridorDisplayScreenOrder(nodes).length, 2);
  for (let n = 1; n <= 10; n++) {
    const device = scene.getObjectByName(`门口机${n}`);
    const door = scene.getObjectByName(`门${n}`);
    assert.ok(device && door);
    const children = [];
    device.traverse(node => children.push(node));
    const screens = helpers.getHospitalCorridorEntranceScreenOrder(children);
    assert.equal(screens.length, 1);
    const screen = screens[0];
    assert.equal(screen.name, `DoorScreen_${n}`);
    const label = helpers.getHospitalCorridorRoomLabel(screen);
    assert.equal(label?.name, `DoorLabel_${n}`);
    assert.equal(label?.userData.hospitalCorridorRoomLabel, true);
    assert.equal(helpers.getHospitalCorridorEntranceScreenOrder(children).length, 1, 'Identity plates must not be rebound as device screens');
    const doorCenter = new THREE.Box3().setFromObject(door).getCenter(new THREE.Vector3());
    const screenCenter = new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3());
    assert.equal(Math.sign(doorCenter.x), Math.sign(screenCenter.x), 'Same-side device/door required');
    assert.ok(Math.abs(doorCenter.z - screenCenter.z) < 1.3);
    helpers.fitHospitalCorridorEntranceScreenGeometry(screen);
    const aspect = helpers.orientHospitalCorridorScreenUV(screen);
    assert.ok(Math.abs(aspect-9/16) < .0001);
    const geometry = screen.geometry;
    helpers.fitHospitalCorridorEntranceScreenGeometry(screen);
    helpers.orientHospitalCorridorScreenUV(screen);
    assert.equal(screen.geometry, geometry, 'Rebinding must not allocate or resize geometry');
    const pos = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
    const points = Array.from({ length: pos.count }, (_, i) => ({ p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(screen.matrixWorld), u: uv.getX(i), v: uv.getY(i) }));
    const bottom = Math.min(...points.map(v => v.p.y)), top = Math.max(...points.map(v => v.p.y));
    const inward = new THREE.Vector3(-Math.sign(screenCenter.x), 0, 0);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward);
    const avg = side => points.filter(p => side ? p.u > .99 : p.u < .01).reduce((a, p, _, all) => a + p.p.dot(right)/all.length, 0);
    assert.ok(avg(true) > avg(false), `Screen ${n}: left/right must not mirror`);
    assert.ok(points.filter(p => Math.abs(p.p.y-top) < 1e-5).every(p => Math.abs(p.v) < 1e-5));
    assert.ok(points.filter(p => Math.abs(p.p.y-bottom) < 1e-5).every(p => Math.abs(p.v-1) < 1e-5));
    assert.ok(helpers.shouldDepthTestHospitalCorridorScreen(screen), 'Screen must not show through walls');
  }
  assert.equal(helpers.getHospitalCorridorRoomLabel(undefined), undefined);
  assert.equal(helpers.getHospitalCorridorRoomLabel(new THREE.Group()), undefined);
  for (const screen of helpers.getHospitalCorridorDisplayScreenOrder(nodes)) {
    const geometry = helpers.createHospitalCorridorDisplayGeometry(screen, helpers.getHospitalCorridorEntranceScreenMaterialIndex(screen));
    assert.ok(Math.abs(geometry.userData.displayAspect-16/9) < 1e-5);
    geometry.dispose();
  }
  console.log(JSON.stringify({ version, doors: 10, screens: 10, materialPrimitives: primitiveCount, bytes: bytes.length, triangles, embeddedMaps: mapCount }));
  }
} finally {
  await server.close();
}
