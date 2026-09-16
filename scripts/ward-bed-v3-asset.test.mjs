import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bytes = readFileSync(new URL('../public/models/smart-ward-interior/bed-unit-v3.glb', import.meta.url));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const get = name => gltf.nodes.find(n => n.name === name);

test('v3 bed asset preserves head wall, service panel, chair and rail in the reachable unit', () => {
  const visited = new Set();
  function visit(i) { assert.ok(!visited.has(i), 'each node belongs to one bed group'); visited.add(i); for (const child of gltf.nodes[i].children ?? []) visit(child); }
  for (const root of gltf.scenes[gltf.scene].nodes) visit(root);
  for (const name of ['BedUnit', 'BedSourceOrigin', 'BedBody', 'BedHeadWall', 'BedHeadServicePanel', 'BedChair', 'CurtainRail', 'BedsideCabinet', 'BedTerminalSurface', 'IVStand', 'InfusionEquipment']) {
    assert.ok(get(name), name);
    assert.ok(visited.has(gltf.nodes.indexOf(get(name))), name + ' reachable');
  }
  assert.equal(get('BedUnit').extras.source, 'onlyBed-v3(1).glb');
  assert.equal(get('BedUnit').extras.sourceSha256, '5a5bc33ff5f08558e658d600508db2d2beca182cc66b5a622ac2bbcca504d1f9');
});

test('terminal surface and infusion bottle are separate primitives from their housings', () => {
  const primitives = name => gltf.meshes[get(name).mesh].primitives;
  assert.equal(primitives('BedTerminalSurface').length, 1);
  assert.equal(gltf.materials[primitives('BedTerminalSurface')[0].material].name, '门口机内');
  const infusionNames = get('InfusionEquipment').children.map(i => gltf.nodes[i].name);
  assert.deepEqual(infusionNames, ['InfusionBottle', 'InfusionLiquid', 'InfusionTube']);
  const bottle = primitives('InfusionBottle')[0];
  assert.equal(primitives('IVStand').some(p => p.material === bottle.material), false);
  assert.ok(bottle.extensions.KHR_draco_mesh_compression);
});
