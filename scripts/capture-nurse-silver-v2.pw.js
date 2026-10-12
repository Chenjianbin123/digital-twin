async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/scripts/fixtures/nurse-silver-runtime.html');
  await page.waitForFunction(() => window.silverRuntime?.scene, null, { timeout: 60000 });
  await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60000 });
  await page.getByRole('button', { name: '隐藏所有信息面板', exact: true }).click();
  const settle = () => page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.silverRuntime.setTheme(value), theme);
    await page.waitForFunction(value => window.silverRuntime.scene.darkTheme === (value === 'dark'), theme);
    await settle();
    await page.screenshot({ path: `output/playwright/nurse-silver-v2-hero-${theme}.png` });
  }
  await page.evaluate(() => window.silverRuntime.setTheme('light'));
  await settle();
  await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    s.stationCameraInteracted = true;
    s.camera.position.set(-3.8, 1.7, 18.3);
    s.controls.target.set(-.3, 1.45, 14.2);
    s.controls.update();
  });
  await settle();
  await page.screenshot({ path: 'output/playwright/nurse-silver-v2-detail.png' });
  await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    window.silverVisualReport = {
      asset: s.nurseStationModel.getObjectByName('NurseStationSilverV1').userData.assetRevision,
      calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles,
      textures: s.renderer.info.memory.textures,
      modelTransferBytes: performance.getEntriesByType('resource').find(r => r.name.includes('nurse-station-silver-v2.glb'))?.decodedBodySize,
    };
    s.resetToNurseStationView();
  });
  await settle();
}
