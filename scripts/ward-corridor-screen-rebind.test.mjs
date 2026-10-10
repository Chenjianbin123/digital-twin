import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const THREE = await server.ssrLoadModule('three');
  const { AreaScene } = await server.ssrLoadModule('/src/core/area-scene.ts');
  const { getHospitalCorridorEntranceScreenOrder: screens, getHospitalCorridorEntranceScreenMaterialIndex: index } =
    await server.ssrLoadModule('/src/core/ward-corridor-model.ts');
  for (const multiMaterial of [false, true]) {
    const shell = new THREE.MeshBasicMaterial({ name: '门口机周' });
    const original = new THREE.MeshBasicMaterial({ name: '门口机内' });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), multiMaterial ? [shell, original] : original);
    mesh.name = 'ScreenPrimitive';
    const slot = multiMaterial ? 1 : 0;
    mesh.userData.hospitalCorridorTemplateDevice = true;
    mesh.userData.hospitalCorridorTemplateMaterialIndex = slot;
    const textures = [];
    const materials = new Set([shell, original]);
    try {
      for (let round = 0; round < 4; round++) {
        assert.equal(screens([mesh])[0], mesh, 'rebind must use the same GLB screen, not generate a replacement plane');
        assert.equal(index(mesh), slot);
        const texture = new THREE.CanvasTexture();
        textures.push(texture);
        AreaScene.prototype.applyWardCorridorTexture.call({}, mesh, texture, slot);
        const material = multiMaterial ? mesh.material[slot] : mesh.material;
        materials.add(material);
        assert.equal(material.map, texture, 'new template must reach the original screen');
        assert.equal(material.name, '门口机内', 'placeholder must not erase screen identity');
        assert.equal(material.depthTest, true, 'native templates must stay behind walls');
        assert.equal(material.depthWrite, true, 'a later-rendered chassis must not paint over an opaque native screen');
        if (multiMaterial) assert.equal(mesh.material[0], shell, 'frame must be untouched');
      }
      // A scene already affected by an earlier unnamed replacement must recover too.
      (multiMaterial ? mesh.material[slot] : mesh.material).name = '';
      assert.equal(index(mesh), slot);
      assert.equal(screens([mesh])[0], mesh);
      mesh.userData.hospitalCorridorTemplateMaterialIndex = 99;
      assert.equal(index(mesh), -1, 'invalid cached indices must not target the frame');
      assert.equal(screens([mesh]).length, 0);
    }
    finally {
      textures.forEach(texture => texture.dispose());
      materials.forEach(material => material.dispose());
      mesh.geometry.dispose();
    }
  }
  const fallback = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  fallback.userData.generatedHospitalCorridorOverlay = true;
  const fallbackTexture = new THREE.CanvasTexture();
  const fallbackOriginalMaterial = fallback.material;
  try {
    AreaScene.prototype.applyWardCorridorTexture.call({}, fallback, fallbackTexture);
    assert.equal(fallback.material.depthWrite, false, 'generated overlays must retain their existing depth policy');
    assert.equal(fallback.material.depthTest, false);
  }
  finally {
    fallbackOriginalMaterial.dispose();
    fallback.material.dispose();
    fallback.geometry.dispose();
    fallbackTexture.dispose();
  }
  const label = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial());
  label.userData.hospitalCorridorRoomLabel = true;
  const binding = { slot: { roomIndex: 0, label: '301' }, label };
  const draws = [];
  const markerContext = {
    wardCorridorBindings: [binding], area: { rooms: [{ sickroomName: '301 病房', isOnline: true }] },
    summaries: [{ priority: 'normal', statusText: '' }], focusedRoomIndex: -1,
    createWardCorridorLabelTexture(...args) { draws.push(args); return new THREE.CanvasTexture(); },
    applyWardCorridorTexture: AreaScene.prototype.applyWardCorridorTexture,
  };
  try {
    const refresh = () => AreaScene.prototype.updateCorridorMarkers.call(markerContext);
    refresh();
    assert.equal(label.material.depthWrite, true);
    refresh();
    assert.equal(draws.length, 1, 'unchanged native labels must not allocate new textures');
    markerContext.area.rooms[0].isOnline = false;
    refresh();
    assert.equal(draws.at(-1)[3], '门口机离线');
    markerContext.area.rooms[0].isOnline = true;
    markerContext.summaries[0] = { priority: 'calling', statusText: '患者呼叫' };
    refresh();
    assert.equal(draws.at(-1)[3], '患者呼叫');
    markerContext.focusedRoomIndex = 0;
    refresh();
    assert.equal(draws.at(-1)[4], true);
    binding.labelTexture.dispose();
    binding.labelTexture = undefined;
    refresh();
    assert.ok(binding.labelTexture, 'rebinding must recreate a disposed texture even with the same signature');
  }
  finally {
    binding.labelTexture?.dispose();
    label.material.dispose();
    label.geometry.dispose();
  }
}
finally { await server.close(); }
