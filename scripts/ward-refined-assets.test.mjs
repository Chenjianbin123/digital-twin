import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { wardInteriorSceneConfig } from '../src/config/ward-interior-scene.ts';

function asset(path) {
  assert.match(path, /^\/models\/smart-ward-interior\//);
  const bytes = readFileSync(new URL('../public' + path.split('?')[0], import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
}

test('configured production bed retains reachable runtime nodes and terminal surface', () => {
  const g = asset(wardInteriorSceneConfig.modular.unitUrl);
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

test('configured production room includes architecture without preview-only objects', () => {
  const g = asset(wardInteriorSceneConfig.model.url);
  for (const name of ['外壳', '灯', '窗2']) {
    assert.ok(g.nodes.some(n => n.name === name), name);
  }
  assert.ok(g.nodes.every(n => n.camera === undefined && !n.extras?.previewOnly));
  assert.ok(g.images.every(i => Number.isInteger(i.bufferView)));
});
