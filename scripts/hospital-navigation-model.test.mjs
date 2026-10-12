import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

for (const kind of ['exterior', 'floor']) test(`real ${kind} GLB preserves source and navigation, within measured web budgets`, async () => {
  const root = 'public/models/hospital-navigation/';
  const info = JSON.parse(await readFile(root + kind + '-3d.json', 'utf8'));
  const data = await readFile(root + info.asset);
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const gltf = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)).trim());
  assert.equal(gltf.scenes.length, 1, 'only the web scene should be exported');
  assert.equal(gltf.meshes.length, info.drawMeshes);
  const triangles = gltf.meshes.flatMap(mesh => mesh.primitives).reduce((total, p) => total + gltf.accessors[p.indices].count / 3, 0);
  assert.equal(triangles, info.triangles);
  assert.ok(triangles < 2400000);
  assert.ok(data.length < (kind === 'exterior' ? 28 : 16) * 1024 * 1024);
  assert.ok(gltf.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert.ok(gltf.nodes.some(node => node.name === 'NavigationAnchor'));
  assert.ok(gltf.nodes.some(node => node.mesh !== undefined && node.extras?.targetScene === (kind === 'floor' ? 'nurse-station' : 'floor')));
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok((gltf.images ?? []).every(image => image.bufferView !== undefined));
  const source = await readFile(info.source);
  assert.equal(createHash('sha256').update(source).digest('hex'), info.sourceSha256);
  assert.equal(info.originalPreserved, true);
  if (kind === 'floor') { assert.equal(info.rooms, 8); assert.equal(info.beds, 16); }
  else {
    for (const [building, count] of Object.entries({ Central_Inpatient_Tower: 10, West_Wing: 5, East_Wing: 7, Outpatient_Podium: 2 })) {
      const targets = info.floorTargets?.filter(target => target.building === building) ?? [];
      assert.equal(targets.length, count, `every physical floor must be clickable: ${building}`);
      for (const target of targets) target.anchor.forEach((value, axis) => {
        assert.ok(value > target.bounds[0][axis] && value < target.bounds[1][axis]);
      });
    }
    for (const material of ['V2 context glazing', 'V2 water', 'V2 ridge far', 'V2 ridge near']) {
      assert.ok(gltf.materials.some(value => value.name === material), `missing reference background: ${material}`);
    }
    assert.ok(gltf.nodes.some(node => node.mesh !== undefined && node.extras?.backgroundContext === true));
    assert.equal(info.skippedBackgroundObjects, 0);
    assert.ok(info.backgroundTriangles > 0 && info.backgroundMeshes > 0);
    assert.deepEqual(info.cameraPosition, [78, 44, 178]);
    assert.deepEqual(info.cameraTarget, [-2, 15, 24]);
    assert.ok(info.cameraHorizontalFov > 40 && info.cameraHorizontalFov < 42);
    const environment = await readFile(root + info.environmentAsset);
    assert.equal(createHash('sha256').update(environment).digest('hex'), info.environmentSha256);
  }
});
