import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function load(name) {
  const bytes = await readFile(new URL('../public/models/hospital-corridor/' + name, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  const length = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + length)), binary: bytes.subarray(28 + length) };
}

test('active corridor asset preserves door, screen and bound mesh contracts', async () => {
  const { json } = await load('3-v4.glb');
  const names = json.nodes.map(node => node.name);
  for (let i = 1; i <= 10; i++) {
    assert.equal(names.filter(name => name === '门' + i).length, 1);
    assert.equal(names.filter(name => name === '门口机' + i).length, 1);
  }
  for (const name of ['地板', '天花板', '墙壁', '墙壁2', '走廊屏1', '走廊屏2']) {
    assert.ok(names.includes(name), name);
  }
});
