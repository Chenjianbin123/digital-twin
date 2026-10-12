async page => {
  const pattern = '**/models/hospital-corridor/corridor-reference-v2.glb*';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route(pattern, route => route.abort('failed'));
  await page.goto('http://localhost:5173/scripts/fixtures/corridor-reference-preview.html');
  await page.waitForFunction(() => window.corridorPreview?.scene?.wardCorridorModelFailed === true, null, { timeout: 60000 });
  const failed = await page.evaluate(() => {
    const s = window.corridorPreview.scene;
    s.renderer.render(s.scene, s.camera);
    return { state: window.corridorPreview.state, fallbackVisible: s.corridorGroup.visible,
      calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles,
      referenceRig: !!s.scene.getObjectByName('reference-corridor-lights'),
      fallbackKey: s.scene.getObjectByName('corridor-key-shadow')?.intensity };
  });
  if (!failed.fallbackVisible || failed.triangles === 0 || failed.referenceRig || !(failed.fallbackKey > 0))
    throw Error(`Invalid failure fallback: ${JSON.stringify(failed)}`);
  await page.locator('#scene').screenshot({ path: 'output/playwright/corridor-reference-v2-fallback.png' });
  await page.unroute(pattern);
  await page.reload();
  await page.waitForFunction(() => window.corridorPreview?.state === 'ready' && window.corridorPreview.scene.wardCorridorBindings.filter(b => b.screenReady).length === 10, null, { timeout: 60000 });
  const recovered = await page.evaluate(() => {
    const s = window.corridorPreview.scene;
    return !!s.scene.getObjectByName('reference-corridor-lights') && !s.scene.getObjectByName('corridor-key-shadow');
  });
  if (!recovered) throw Error('Old fallback lights leaked into the recovered model');
  return { failed, recovered };
}
