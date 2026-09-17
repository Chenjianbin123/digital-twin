import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function asset(name) {
  const bytes = readFileSync(new URL('../public/models/smart-ward-interior/' + name, import.meta.url));
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

test('refined bed retains reachable runtime nodes and terminal surface', () => {
  const g = asset('bed-refined-v1.glb');
  const reachable = new Set();
  const visit = i => {
    assert.ok(!reachable.has(i));
    reachable.add(i);
    for (const c of g.nodes[i].children ?? []) visit(c);
  };
  for (const i of g.scenes[g.scene ?? 0].nodes) visit(i);
  for (const name of ['BedUnit', 'BedBody', 'BedHeadWall', 'BedHeadServicePanel', 'BedsideCabinet', 'BedTerminal', 'BedTerminalSurface', 'IVStand', 'InfusionEquipment']) {
    const index = g.nodes.findIndex(n => n.name === name);
    assert.ok(reachable.has(index), name);
  }
  assert.ok(g.images.every(i => Number.isInteger(i.bufferView)));
});

test('refined room includes architecture without preview-only objects', () => {
  const g = asset('room-refined-v1.glb');
  for (const name of ['外壳', '灯', '窗2']) {
    assert.ok(g.nodes.some(n => n.name === name), name);
  }
  assert.ok(g.nodes.every(n => !n.camera && !n.extras?.previewOnly));
  assert.ok(g.images.every(i => Number.isInteger(i.bufferView)));
});
