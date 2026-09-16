import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const previousDocument = globalThis.document;
const ctx = new Proxy({}, { get: () => () => {} });
globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
try {
  const THREE = await server.ssrLoadModule('three');
  const { AreaScene } = await server.ssrLoadModule('/src/core/area-scene.ts');
  const { WardCorridorLayout } = await server.ssrLoadModule('/src/core/ward-corridor-layout.ts');
  const doors = Array.from({ length: 10 }, (_, i) => `门${i + 1}`);
  const devices = Array.from({ length: 10 }, (_, i) => `门口机${i + 1}`);
  const model = new THREE.Group();
  doors.forEach((name, i) => {
    const door = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    door.name = name;
    const device = new THREE.Group(); device.name = devices[i];
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ name: '门口机内' }));
    device.add(screen); model.add(door, device);
  });
  const state = {
    wardCorridorModel: model, scene: new THREE.Scene(), focusedRoomIndex: -1,
    corridorLayout: new WardCorridorLayout(doors, devices), wardCorridorBindings: [],
    disposeWardCorridorOverlays() {},
    disposeWardCorridorTextures() {
      this.wardCorridorBindings.forEach(b => { b.marker?.dispose(); b.screenTexture?.dispose(); b.labelTexture?.dispose(); });
    },
    bindCorridorModelDisplays() {}, updateCorridorMarkers() {}, refreshWardCorridorScreens() {},
    createHospitalCorridorDoorOverlays(door, screen) { return { screen, screenMaterialIndex: 0 }; },
    createWardCorridorLabelTexture() { return new THREE.CanvasTexture(); },
    applyWardCorridorScreenPresentation() {}, applyWardCorridorTexture() {},
  };
  const rooms = Array.from({ length: 11 }, (_, i) => ({ sickroomCode: String(i + 1), sickroomName: `测试${i + 1}`, beds: [], isOnline: false }));
  function check(list, count, page = 0) {
    state.area = { rooms: list };
    state.corridorLayout.resolve(list, page);
    AreaScene.prototype.bindWardCorridorSlots.call(state);
    assert.equal(devices.filter(name => model.getObjectByName(name).visible).length, count);
    assert.equal(state.wardCorridorBindings.filter(b => b.screen).length, count);
    assert.equal(state.wardCorridorBindings.filter(b => b.marker).length, count);
    assert.ok(doors.every(name => model.getObjectByName(name).visible), 'architecture stays intact');
  }
  check([], 0); check(rooms.slice(0, 1), 1); check(rooms.slice(0, 2), 2);
  check(rooms.slice(0, 2).reverse(), 2); check(rooms.slice(0, 10), 10);
  check(rooms, 1, 1); check(rooms, 10, 0);
  state.focusedRoomIndex = 0; check([], 0); assert.equal(state.focusedRoomIndex, -1);
  check(rooms.slice(0, 1), 1); // Reconnecting restores hidden device roots, even offline.
  state.disposeWardCorridorTextures();
  model.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
}
finally { globalThis.document = previousDocument; await server.close(); }
