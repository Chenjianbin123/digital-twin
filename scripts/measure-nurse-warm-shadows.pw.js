async (page) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:5194/scripts/fixtures/nurse-warm-preview.html?model=v3');
  await page.waitForFunction(() => window.nurseWarmPreview?.ready);
  return page.evaluate(async () => {
    const { BasicShadowMap, PCFShadowMap } = await import('/node_modules/three/build/three.module.js');
    const p = window.nurseWarmPreview, result = [];
    const key = p.scene.getObjectByName('warm-station-key');
    const originalType = p.renderer.shadowMap.type;
    try {
      for (const [label, type] of [['pcf', PCFShadowMap], ['basic', BasicShadowMap], ['pcf-restored', PCFShadowMap]]) {
        p.renderer.shadowMap.type = type; key.shadow.needsUpdate = true;
        p.model.traverse(object => {
          if (!object.isMesh) return;
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.needsUpdate = true;
        });
        for (let warmup = 0; warmup < 6; warmup++) {
          await new Promise(requestAnimationFrame); p.renderer.render(p.scene, p.camera);
        }
        result.push({ label, ...(await p.measure()) });
      }
    } finally {
      p.renderer.shadowMap.type = originalType; key.shadow.needsUpdate = true;
      p.model.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.needsUpdate = true;
      });
      p.renderer.render(p.scene, p.camera);
    }
    return result;
  });
}
