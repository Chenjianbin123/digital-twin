import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { AreaScene } = await server.ssrLoadModule('/src/core/area-scene.ts');
  for (const axis of ['x', 'z']) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1));
    const screen = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .1));
    door.position.set(-3, 1, -3);
    screen.position.set(-2, 1.6, -2);
    const scene = {
      wardCorridorBindings: [{ slot: { roomIndex: 0 }, door, screen }],
      shouldShowWardCorridorModel: () => true,
      wardCorridorBoundMeshes: { widthAxis: axis, floorMaxY: 0, ceilingMinY: 3,
        wallMin: -4, wallMax: 4, lengthMin: -10, lengthMax: 10 },
    };
    const focus = AreaScene.prototype.getRoomDoorFocus.call(scene, 0);
    assert.ok(focus.target.distanceTo(screen.position) < 1e-6,
      'selecting a room must center its entrance screen, not the adjacent door panel');
    assert.equal(focus.position[axis], 0, 'camera stays inside corridor');
    scene.wardCorridorBindings[0].screen = undefined;
    const fallback = AreaScene.prototype.getRoomDoorFocus.call(scene, 0);
    assert.ok(fallback.target.distanceTo(door.position) < 1e-6);
    door.geometry.dispose(); screen.geometry.dispose();
    door.material.dispose(); screen.material.dispose();
  }
}
finally { await server.close(); }
