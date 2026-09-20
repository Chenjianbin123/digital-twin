import assert from 'node:assert/strict';
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const previous = globalThis.document;
globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
try {
  const THREE = await server.ssrLoadModule('three');
  const { CorridorMarker } = await server.ssrLoadModule('/src/core/ward-corridor-markers.ts');
  for (const axis of ['x', 'z']) for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.2 : 1.2, 2.4, axis === 'z' ? 0.2 : 1.2));
    door.position.set(0, 1.2, 0); door.position[axis] = side * 2;
    const corridor = new THREE.Box3(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 3, 3));
    const marker = new CorridorMarker(door, corridor, axis);
    const bounds = new THREE.Box3().setFromObject(door);
    assert.ok(marker.sprite.position.y - marker.sprite.scale.y / 2 > bounds.max.y, 'plate must be above the door, not covering it');
    assert.ok(marker.sprite.position.y - marker.sprite.scale.y / 2 - bounds.max.y < .02, 'plate should sit close to the door frame');
    assert.ok(marker.sprite.isMesh, 'plate must have a fixed installation direction');
    const expectedFace = side > 0 ? bounds.min[axis] : bounds.max[axis];
    assert.ok(Math.abs(Math.abs(marker.sprite.position[axis] - expectedFace) - (.04 + marker.sprite.scale.x / 2)) < 1e-6);
    assert.ok(Math.abs(marker.sprite.position[axis] - expectedFace) + marker.sprite.scale.x / 2 < .65, 'keep the side plate close to the wall');
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(marker.sprite.quaternion);
    assert.ok(Math.abs(normal[axis]) < 1e-6, 'plate must face along the corridor, perpendicular to the wall');
    marker.sprite.updateMatrixWorld(true);
    const back = marker.sprite.getObjectByName('room-plate-back');
    assert.ok(back);
    const backNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(back.getWorldQuaternion(new THREE.Quaternion()));
    assert.ok(normal.dot(backNormal) < -.99, 'opposite outward-facing surfaces avoid mirrored text');
    assert.equal(back.material, marker.sprite.material, 'both faces use the same live content');
    const mount = marker.sprite.getObjectByName('room-plate-wall-mount');
    assert.ok(Math.abs(mount.getWorldPosition(new THREE.Vector3())[axis] - expectedFace) < 1e-6);
    assert.equal(marker.sprite.material.side, THREE.FrontSide);
    assert.equal(marker.sprite.material.depthWrite, true, 'text faces must occlude their housing');
    marker.dispose(); door.geometry.dispose(); door.material.dispose();
  }
} finally { globalThis.document = previous; await server.close(); }
