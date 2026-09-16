import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function load(name) {
  const bytes = await readFile(new URL('../public/models/hospital-corridor/' + name, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const length = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + length)), binary: bytes.subarray(28 + length) };
}
test('optimized asset preserves nodes, material contracts and every non-image buffer byte', async () => {
  const [source, optimized] = await Promise.all([load('3-v-1.glb'), load('3-v-1-optimized.glb')]);
  for (const key of ['nodes', 'meshes', 'materials', 'accessors', 'scenes']) assert.deepEqual(optimized.json[key], source.json[key], key);
  assert.ok(optimized.bytes.length < source.bytes.length * .85, 'at least 15% download reduction');
  const imageViews = new Set(source.json.images.map(image => image.bufferView));
  source.json.bufferViews.forEach((view, index) => {
    if (imageViews.has(index)) return;
    const next = optimized.json.bufferViews[index];
    assert.deepEqual(optimized.binary.subarray(next.byteOffset ?? 0, (next.byteOffset ?? 0) + next.byteLength),
      source.binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength), 'geometry buffer ' + index);
  });
  const names = optimized.json.nodes.map(node => node.name);
  for (let i = 1; i <= 10; i++) {
    assert.equal(names.filter(name => name === '门' + i).length, 1);
    assert.equal(names.filter(name => name === '门口机' + i).length, 1);
  }
  for (const name of ['地板', '天花板', '墙壁', '墙壁2', '走廊屏1', '走廊屏2']) assert.ok(names.includes(name), name);
});
