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
}
finally { await server.close(); }
