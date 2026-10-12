async page => {
  await page.setViewportSize({ width: 1672, height: 1107 });
  await page.goto('http://localhost:5173/scripts/fixtures/corridor-reference-preview.html');
  await page.waitForFunction(() => window.corridorPreview?.state === 'ready' && window.corridorPreview.scene.wardCorridorBindings.every(b => b.screenReady), null, { timeout: 60000 });
  await page.locator('#scene').screenshot({ path: 'output/playwright/corridor-reference-v2-light-scene.png' });
  await page.getByRole('button', { name: '深浅主题', exact: true }).click();
  await page.locator('#scene').screenshot({ path: 'output/playwright/corridor-reference-v2-dark-scene.png' });
  await page.getByRole('button', { name: '深浅主题', exact: true }).click();
  return page.evaluate(() => {
    const s = window.corridorPreview.scene;
    return { calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles, camera: s.camera.position.toArray() };
  });
}
