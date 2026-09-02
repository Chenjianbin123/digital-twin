import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const modelPaths = [
  'public/models/smart-ward-interior/room-v1.glb',
  'public/models/smart-ward-nurse-station/1-1.glb',
];

function readGlbHeader(buffer, filePath) {
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF', `${filePath} must be a GLB file`);
  assert.equal(buffer.readUInt32LE(4), 2, `${filePath} must use GLB version 2`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  assert.equal(jsonType, 0x4e4f534a, `${filePath} must start with a JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('configured scene model URLs resolve to local GLB assets instead of the SPA fallback', async () => {
  for (const relativePath of modelPaths) {
    const modelPath = new URL(`../${relativePath}`, import.meta.url);
    await access(modelPath);
    const model = await readFile(modelPath);
    const json = readGlbHeader(model, relativePath);
    assert.ok(Array.isArray(json.nodes), `${relativePath} must contain a node list`);
    assert.ok(model.length > 1_000_000, `${relativePath} must contain model payload data`);
  }
});
