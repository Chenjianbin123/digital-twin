import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { GLTFLoader } = await server.ssrLoadModule('three/examples/jsm/loaders/GLTFLoader.js');
  const modelTools = await server.ssrLoadModule('/src/core/ward-corridor-model.ts');
  const bytes = await readFile(`public${modelTools.WARD_CORRIDOR_MODEL_URL.split('?')[0]}`);
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binStart = 20 + jsonLength + 8;
  doc.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(binStart).toString('base64')}`;
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
  modelTools.normalizeHospitalCorridorModelTransform(scene);
  scene.rotation.y = Math.PI / 2; scene.updateMatrixWorld(true);
  const { CorridorMarker } = await server.ssrLoadModule('/src/core/ward-corridor-markers.ts');
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
  try {
    const corridorBounds = new THREE.Box3().setFromObject(scene);
    const size = corridorBounds.getSize(new THREE.Vector3());
    const widthAxis = size.x < size.z ? 'x' : 'z';
    for (const name of modelTools.HOSPITAL_CORRIDOR_DOOR_NAMES) {
      const door = scene.getObjectByName(name);
      assert.ok(door, `missing model door: ${name}`);
      const marker = new CorridorMarker(door, corridorBounds, widthAxis);
      const doorBounds = new THREE.Box3().setFromObject(door);
      const plateBounds = new THREE.Box3().setFromObject(marker.sprite);
      assert.ok(plateBounds.min.y > doorBounds.max.y, `${name}: plate must clear the frame`);
      assert.ok(plateBounds.max.y < corridorBounds.max.y, `${name}: plate must remain below the model roof`);
      marker.dispose();
    }
  } finally { globalThis.document = previousDocument; }
  let checked = 0;
  for (let n = 1; n <= 10; n++) {
    const root = scene.getObjectByName(`门口机${n}`);
    assert.ok(root);
    const nodes = []; root.traverse(node => nodes.push(node));
    const mesh = modelTools.getHospitalCorridorEntranceScreenOrder(nodes)[0];
    assert.ok(mesh);
    const beforeScreen = new THREE.Box3().setFromObject(mesh);
    const beforeDevice = new THREE.Box3().setFromObject(root);
    const screenSize = beforeScreen.getSize(new THREE.Vector3());
    const widthAxis = screenSize.x > screenSize.z ? 'x' : 'z';
    modelTools.fitHospitalCorridorEntranceScreenGeometry(mesh);
    const afterScreen = new THREE.Box3().setFromObject(mesh);
    const afterDevice = new THREE.Box3().setFromObject(root);
    const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
    close(afterScreen.getSize(new THREE.Vector3())[widthAxis] / screenSize.y, 9 / 16);
    close(afterScreen.min.y, beforeScreen.min.y);
    close(afterScreen.max.y, beforeScreen.max.y);
    close(afterScreen.getCenter(new THREE.Vector3())[widthAxis], beforeScreen.getCenter(new THREE.Vector3())[widthAxis]);
    close(afterScreen.min[widthAxis] - afterDevice.min[widthAxis], beforeScreen.min[widthAxis] - beforeDevice.min[widthAxis]);
    close(afterDevice.max[widthAxis] - afterScreen.max[widthAxis], beforeDevice.max[widthAxis] - beforeScreen.max[widthAxis]);
    const fittedGeometry = mesh.geometry;
    modelTools.fitHospitalCorridorEntranceScreenGeometry(mesh);
    assert.equal(mesh.geometry, fittedGeometry, 'rebinding must not resize the screen again');
    const aspect = modelTools.orientHospitalCorridorScreenUV(mesh);
    const geometry = mesh.geometry;
    assert.equal(modelTools.orientHospitalCorridorScreenUV(mesh), aspect);
    assert.equal(mesh.geometry, geometry, 'rebinding must reuse oriented geometry');
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.getAttribute('position'), uv = mesh.geometry.getAttribute('uv');
    const points = Array.from({ length: pos.count }, (_, i) => ({
      p: new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld),
      u: uv.getX(i), v: uv.getY(i),
    }));
    const lo = Math.min(...points.map(x => x.p.y)), hi = Math.max(...points.map(x => x.p.y));
    const bounds = new THREE.Box3().setFromPoints(points.map(x => x.p));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    assert.ok(Math.abs(aspect - Math.max(size.x, size.z) / size.y) < 1e-5);
    const inward = new THREE.Vector3(-center.x, 0, -center.z);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward).normalize();
    const leftPoints = points.filter(x => x.u < 1e-4);
    const rightPoints = points.filter(x => x.u > 1 - 1e-4);
    const average = list => list.reduce((sum, x) => sum + x.p.dot(right), 0) / list.length;
    assert.ok(average(rightPoints) > average(leftPoints), `${root.name}: text must not be mirrored`);
    const top = points.filter(x => Math.abs(x.p.y - hi) < 1e-5);
    const bottom = points.filter(x => Math.abs(x.p.y - lo) < 1e-5);
    assert.ok(top.every(x => Math.abs(x.v) < 1e-4), `${root.name}: canvas top must map to physical screen top (flipY=false)`);
    assert.ok(bottom.every(x => Math.abs(x.v - 1) < 1e-4), `${root.name}: canvas bottom must map to physical screen bottom`);
    checked++;
  }
  assert.equal(checked, 10);
}
finally { await server.close(); }
