import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Geometry-only decoder for binary-contract tests. Browser tests cover actual texture decoding.
export async function createDracoGeometryLoader(THREE, GLTFLoader) {
  const wrapper = await readFile('public/draco/draco_wasm_wrapper.js', 'utf8');
  const factory = new Function('module', 'exports', 'require', '__dirname', `${wrapper}; return module.exports;`)(
    { exports: {} }, {}, createRequire(import.meta.url), resolve('public/draco'));
  const draco = await factory({ wasmBinary: await readFile('public/draco/draco_decoder.wasm') });
  return new GLTFLoader().setDRACOLoader({ preload() {}, decodeDracoFile(buffer, done, ids) {
    const decoder = new draco.Decoder(), input = new draco.DecoderBuffer(), mesh = new draco.Mesh();
    const faces = new draco.DracoInt32Array();
    try {
      input.Init(new Int8Array(buffer), buffer.byteLength);
      assert.ok(decoder.DecodeBufferToMesh(input, mesh).ok());
      const geometry = new THREE.BufferGeometry();
      for (const [name, id] of Object.entries(ids)) {
        const attribute = decoder.GetAttributeByUniqueId(mesh, id), values = new draco.DracoFloat32Array();
        try {
          decoder.GetAttributeFloatForAllPoints(mesh, attribute, values);
          const array = Float32Array.from({ length: values.size() }, (_, i) => values.GetValue(i));
          geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.num_components()));
        } finally { draco.destroy(values); }
      }
      const index = [];
      for (let i = 0; i < mesh.num_faces(); i++) {
        decoder.GetFaceFromMesh(mesh, i, faces);
        index.push(faces.GetValue(0), faces.GetValue(1), faces.GetValue(2));
      }
      geometry.setIndex(index);
      done(geometry);
    } finally {
      draco.destroy(faces); draco.destroy(mesh); draco.destroy(input); draco.destroy(decoder);
    }
  } });
}
