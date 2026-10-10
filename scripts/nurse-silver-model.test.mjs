import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Validate the delivered binary rather than matching Blender-script strings.
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { GLTFLoader } = await server.ssrLoadModule('three/examples/jsm/loaders/GLTFLoader.js');
  const { bindReferenceStationDisplays } = await server.ssrLoadModule('/src/core/reference-nurse-station.ts');
  const bytes = await readFile('public/models/smart-ward-nurse-station/nurse-station-silver-v2.glb');
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 16*1024*1024, 'Refined asset with embedded 2K PBR/AO maps: 16 MiB');
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20+jsonLength).toString());
  const embeddedMaps = doc.images.length;
  assert.ok(!doc.nodes.some(node => /Preview_/i.test(node.name)), 'No illustrative dashboard/clock/video content in GLB');
  assert.ok(doc.images.length >= 10, 'Baked material maps must be present');
  assert.ok(doc.images.every(image => Number.isInteger(image.bufferView) && !image.uri), 'All maps embedded');
  const draws = doc.meshes.reduce((sum, mesh) => sum+mesh.primitives.length, 0);
  assert.ok(draws <= 50, `Consolidate static meshes: ${draws} primitives`);
  const triangles = doc.meshes.reduce((sum, mesh) => sum+mesh.primitives.reduce((n, p) => n+doc.accessors[p.indices].count/3, 0), 0);
  assert.ok(triangles < 230000 && triangles > 50000);
  const aoMaterials = doc.materials.filter(material => material.occlusionTexture);
  assert.ok(aoMaterials.length >= 10, 'Real occlusion maps on visible surfaces, not merely base-color tint');
  for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
    const material = doc.materials[primitive.material];
    if (!material.occlusionTexture) continue;
    assert.equal(material.occlusionTexture.texCoord, 1, 'AO has an independent packed atlas');
    assert.ok(Number.isInteger(primitive.attributes.TEXCOORD_1));
    assert.equal(material.pbrMetallicRoughness.baseColorTexture?.texCoord ?? 0, 0, 'PBR UV0 is retained');
  }
  // Node has no bitmap decoder. Real texture and video pixels are browser-tested.
  doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28+jsonLength).toString('base64')}`;
  doc.materials = doc.materials.map(({ name }) => ({ name }));
  delete doc.images; delete doc.textures;
  globalThis.ProgressEvent ??= class {};
  const wrapper = await readFile('public/draco/draco_wasm_wrapper.js', 'utf8');
  const factory = new Function('module', 'exports', 'require', '__dirname', `${wrapper}; return module.exports;`)(
    { exports: {} }, {}, createRequire(import.meta.url), resolve('public/draco'));
  const draco = await factory({ wasmBinary: await readFile('public/draco/draco_decoder.wasm') });
  const loader = new GLTFLoader().setDRACOLoader({ preload() {}, decodeDracoFile(buffer, done, ids) {
    const decoder = new draco.Decoder(), input = new draco.DecoderBuffer(), mesh = new draco.Mesh();
    input.Init(new Int8Array(buffer), buffer.byteLength);
    assert.ok(decoder.DecodeBufferToMesh(input, mesh).ok());
    const geometry = new THREE.BufferGeometry();
    for (const [name, id] of Object.entries(ids)) {
      const attribute = decoder.GetAttributeByUniqueId(mesh, id), values = new draco.DracoFloat32Array();
      decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
      const array = Float32Array.from({ length: values.size() }, (_, i) => values.GetValue(i));
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.num_components()));
      draco.destroy(values);
    }
    const faces = new draco.DracoInt32Array(), index = [];
    for (let i = 0; i < mesh.num_faces(); i++) {
      decoder.GetFaceFromMesh(mesh, i, faces);
      index.push(faces.GetValue(0), faces.GetValue(1), faces.GetValue(2));
    }
    geometry.setIndex(index);
    draco.destroy(faces); draco.destroy(mesh); draco.destroy(input); draco.destroy(decoder);
    done(geometry);
  } });
  const { scene } = await loader.parseAsync(JSON.stringify(doc), '');
  scene.updateMatrixWorld(true);
  const root = scene.getObjectByName('NurseStationSilverV1');
  assert.equal(root.userData.units, 'metres');
  assert.equal(root.userData.surveyed, false);
  assert.equal(root.userData.assetRevision, 'silver-v2');
  assert.equal(root.userData.detailPolicy, 'visible-first');
  const names = ['Screen_Main', 'Screen_Work_01', 'Screen_Work_02', 'Screen_Work_03', 'Screen_Work_04', 'Screen_Video', 'Screen_Service'];
  for (const name of names) {
    const screen = scene.getObjectByName(name);
    assert.ok(screen?.isMesh, name);
    assert.equal(screen.geometry.index.count, 6, 'Independent quad, not the entire display chassis');
    const position = screen.geometry.getAttribute('position'), uv = screen.geometry.getAttribute('uv');
    const normal = screen.geometry.getAttribute('normal');
    const n = new THREE.Vector3().fromBufferAttribute(normal, 0).transformDirection(screen.matrixWorld);
    const staffFacing = name.includes('Work') || name.includes('Service');
    assert.ok(n.dot(new THREE.Vector3(0, 0, staffFacing ? -1 : 1)) > .999, `${name} viewing side`);
    const points = Array.from({ length: position.count }, (_, i) => ({
      p: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(screen.matrixWorld),
      u: uv.getX(i), v: uv.getY(i),
    }));
    const bounds = new THREE.Box3().setFromObject(screen), size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(size.x/size.y-(name === 'Screen_Main' ? 2.25 : 16/9)) < .001, `${name} aspect`);
    assert.ok(points.filter(p => Math.abs(p.p.y-bounds.max.y) < .0001).every(p => p.v === 0), `${name} top UV`);
    assert.ok(points.filter(p => Math.abs(p.p.y-bounds.min.y) < .0001).every(p => p.v === 1), `${name} bottom UV`);
    const mean = u => points.filter(p => p.u === u).reduce((sum, p, _, all) => sum+p.p.x/all.length, 0);
    assert.ok((mean(1)-mean(0))*(staffFacing ? -1 : 1) > 0, `${name} text must not mirror`);
    assert.equal(screen.material.transparent, false);
  }
  const tv = scene.getObjectByName('Screen_Video');
  // Compare actual delivered geometry against v1, not only the builder's names.
  const previous = await readFile('public/models/smart-ward-nurse-station/nurse-station-silver-v1.glb');
  const previousJsonLength = previous.readUInt32LE(12);
  const previousDoc = JSON.parse(previous.subarray(20, 20+previousJsonLength).toString());
  previousDoc.buffers[0].uri = `data:application/octet-stream;base64,${previous.subarray(28+previousJsonLength).toString('base64')}`;
  previousDoc.materials = previousDoc.materials.map(({ name }) => ({ name }));
  delete previousDoc.images; delete previousDoc.textures;
  const previousScene = (await loader.parseAsync(JSON.stringify(previousDoc), '')).scene;
  previousScene.updateMatrixWorld(true);
  for (const name of [...names, 'Clock_Display', 'Screen_Main_Frame', 'TV_Frame', 'TV_Wall_Mount']) {
    const before = new THREE.Box3().setFromObject(previousScene.getObjectByName(name));
    const after = new THREE.Box3().setFromObject(scene.getObjectByName(name));
    assert.ok(before.min.distanceTo(after.min) < .0001 && before.max.distanceTo(after.max) < .0001,
      `${name} retains original placement and dimensions within 0.1 mm after compression`);
  }
  assert.equal(tv.userData.mounting, 'wall');
  assert.equal(tv.userData.displayRole, 'education-video');
  const center = node => new THREE.Box3().setFromObject(scene.getObjectByName(node)).getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center('TV_Wall_Mount').x-center('TV_Frame').x) < 1e-4);
  assert.ok(center('Screen_Video').z > center('TV_Frame').z);
  assert.ok(center('TV_Frame').z > center('TV_Wall_Mount').z);
  assert.ok(center('TV_Wall_Mount').y > 2, 'TV must be wall mounted, not placed on worktop');
  const displays = bindReferenceStationDisplays(scene, () => new THREE.Texture());
  assert.equal(displays.length, 6, 'Project binder: main + four work screens + clock');
  assert.equal(scene.getObjectByName('Screen_Main').visible, false);
  assert.ok(displays.every(display => display.screen.visible && display.screen.material.depthTest && display.screen.material.depthWrite));
  assert.equal(tv.visible, true, 'Business screen binding must not hide the video surface');
  for (const name of ['Screen_Main_Frame', 'Clock_Display', 'TV_Frame']) assert.ok(scene.getObjectByName(name));
  console.log(JSON.stringify({ bytes: bytes.length, triangles, materialPrimitives: draws, embeddedMaps, screens: names.length, runtimeBindings: displays.length }));
} finally {
  await server.close();
}
