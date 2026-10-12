async page => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const result = [];
  for (const version of ['v1', 'v2']) {
    await page.goto(`http://localhost:5173/scripts/fixtures/corridor-reference-preview.html?model=${version}`);
    await page.waitForFunction(() => window.corridorPreview?.state === 'ready' && window.corridorPreview.scene.wardCorridorBindings.every(b => b.screenReady), null, { timeout: 60000 });
    result.push(await page.evaluate(version => {
      const s = window.corridorPreview.scene;
      s.setActive(false);
      s.renderer.render(s.scene, s.camera);
      const entry = performance.getEntriesByType('resource').find(x => x.name.includes(`corridor-reference-${version}.glb`));
      return { version, calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles,
        geometryCount: s.renderer.info.memory.geometries, decodedBytes: entry?.decodedBodySize,
        camera: s.camera.position.toArray(), dpr: s.renderer.getPixelRatio(), viewport: [innerWidth, innerHeight] };
    }, version));
    await page.locator('#scene').screenshot({ path: `output/playwright/corridor-reference-${version}-comparison.png` });
  }
  await page.evaluate(result => { window.corridorComparison = result; }, result);
  return result;
}
