async (page) => {
  await page.waitForFunction(() => window.nurseWarmPreview?.ready);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const setup = await page.evaluate(() => {
    const p = window.nurseWarmPreview;
    p.setView('front'); p.setTheme('light'); p.setBinding(false);
    const materials = new Set();
    p.model.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material.transmission > 0) materials.add(material);
      }
    });
    p.transmissionDiagnostic = [...materials].map(material => ({ material, original: material.transmission }));
    return { materials: p.transmissionDiagnostic.map(({ material, original }) => ({ name: material.name,
      transmission: original, transparent: material.transparent, side: material.side })), pixelRatio: p.renderer.getPixelRatio() };
  });
  if (!setup.materials.length) {
    await page.evaluate(() => { delete window.nurseWarmPreview.transmissionDiagnostic; });
    return { passed: true, comparisonSkipped: 'The current runtime asset has no physical transmission', ...setup };
  }
  const baseline = await page.evaluate(() => window.nurseWarmPreview.measure());
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-performance-baseline.png' });
  let transmissionDisabled;
  try {
    await page.evaluate(async () => {
      const p = window.nurseWarmPreview;
      for (const item of p.transmissionDiagnostic) { item.material.transmission = 0; item.material.needsUpdate = true; }
      await p.renderer.compileAsync(p.scene, p.camera);
    });
    transmissionDisabled = await page.evaluate(() => window.nurseWarmPreview.measure());
    await page.screenshot({ path: 'output/playwright/nurse-warm-v3-performance-no-transmission.png' });
  } finally {
    await page.evaluate(async () => {
      const p = window.nurseWarmPreview;
      for (const item of p.transmissionDiagnostic) { item.material.transmission = item.original; item.material.needsUpdate = true; }
      await p.renderer.compileAsync(p.scene, p.camera);
    });
  }
  const restored = await page.evaluate(() => window.nurseWarmPreview.measure());
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-performance-restored.png' });
  let pixelRatioOne = { skipped: 'Baseline pixel ratio is already 1' };
  if (setup.pixelRatio > 1) {
    try {
      await page.evaluate(() => window.nurseWarmPreview.renderer.setPixelRatio(1));
      pixelRatioOne = await page.evaluate(() => window.nurseWarmPreview.measure());
    } finally { await page.evaluate(value => window.nurseWarmPreview.renderer.setPixelRatio(value), setup.pixelRatio); }
  }
  const valuesRestored = await page.evaluate(() => {
    const p = window.nurseWarmPreview;
    const result = p.transmissionDiagnostic.every(item => item.material.transmission === item.original);
    delete p.transmissionDiagnostic; return result;
  });
  if (!valuesRestored) throw Error('Diagnostic did not restore the authored transmission values');
  return { passed: true, viewport: [1440, 1000], ...setup, baseline, transmissionDisabled,
    restored, pixelRatioOne, valuesRestored, filesModified: false };
}
