import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bytes = readFileSync(new URL('../public/models/smart-ward-interior/bed-v2.glb', import.meta.url));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const get = name => gltf.nodes.find(n => n.name === name);

test('refined bed asset preserves head wall, service panel and infusion in the reachable unit', () => {
  const visited = new Set();
  function visit(i) {
    assert.ok(!visited.has(i), 'each node belongs to one bed group');
    visited.add(i);
    for (const child of gltf.nodes[i].children ?? []) visit(child);
  }
  for (const root of gltf.scenes[gltf.scene].nodes) visit(root);
  for (const name of ['BedUnit', 'BedBody', 'BedHeadWall', 'BedHeadServicePanel', 'BedsideCabinet', 'BedTerminalSurface', 'IVStand', 'InfusionEquipment']) {
    assert.ok(get(name), name);
    assert.ok(visited.has(gltf.nodes.indexOf(get(name))), name + ' reachable');
  }
});

test('terminal surface and infusion bottle are separate primitives from their housings', () => {
  const primitives = name => gltf.meshes[get(name).mesh].primitives;
  assert.equal(primitives('BedTerminalSurface').length, 1);
  const infusionNames = get('InfusionEquipment').children.map(i => gltf.nodes[i].name);
  assert.ok(infusionNames.includes('InfusionBottle'));
  const bottle = primitives('InfusionBottle')[0];
  assert.equal(primitives('IVStand').some(p => p.material === bottle.material), false);
});
