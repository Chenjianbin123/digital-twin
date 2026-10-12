async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/scripts/fixtures/corridor-reference-preview.html');
  await page.waitForFunction(() => window.corridorPreview?.state === 'ready', null, { timeout: 60000 });
  const waitReady = () => page.waitForFunction(() => window.corridorPreview.scene.wardCorridorBindings.filter(b => b.screenReady).length === 10, null, { timeout: 30000 });
  await waitReady();
  const inspect = () => page.evaluate(() => {
    const s = window.corridorPreview.scene;
    return s.wardCorridorBindings.filter(b => b.slot.interactive).map(b => ({
      slot: b.slot.deviceNode, room: s.area.rooms[b.slot.roomIndex].sickroomId,
      screen: b.screen.uuid, original: !b.screen.userData.generatedHospitalCorridorOverlay,
      label: b.label?.uuid, nativeLabel: !!b.label?.userData.hospitalCorridorRoomLabel,
      labelWritesDepth: b.label?.material.depthWrite, duplicateMarker: !!b.marker,
      ready: !!b.screenReady, flipY: b.screenTexture.flipY, depthTest: b.screen.material.depthTest, depthWrite: b.screen.material.depthWrite,
      width: b.screenTexture.image.width, height: b.screenTexture.image.height,
    }));
  });
  const initial = await inspect();
  if (initial.length !== 10 || initial.some(b => !b.original || b.flipY || !b.depthTest || !b.depthWrite))
    throw Error(`Invalid native screen contract: ${JSON.stringify(initial)}`);
  if (initial.some(b => !b.nativeLabel || !b.labelWritesDepth || b.duplicateMarker))
    throw Error('Wall-mounted room labels are missing, occluded, or duplicated');
  const bounds = await page.evaluate(() => window.corridorPreview.scene.wardCorridorBoundMeshes);
  if (Math.abs(bounds.wallMin + bounds.wallMax) > .001) throw Error('Asset centre is wrong after runtime rotation');
  const production = await page.evaluate(() => {
    const s = window.corridorPreview.scene;
    return {
      revision: s.wardCorridorModel.getObjectByName('CorridorReferenceV2')?.userData.assetRevision,
      indoorLights: !!s.scene.getObjectByName('reference-corridor-lights'),
      frontScreens: [1, 6].map(n => {
        const screen = s.wardCorridorModel.getObjectByName(`DoorScreen_${n}`);
        const p = screen.getWorldPosition(s.camera.position.clone()).project(s.camera);
        return { slot: n, x: p.x, y: p.y, z: p.z };
      }),
    };
  });
  if (production.revision !== 'reference-v2' || !production.indoorLights) throw Error('Preview is not using the production v2 model/light rig');
  if (production.frontScreens.some(p => Math.abs(p.x) > .97 || Math.abs(p.y) > .97 || p.z > 1))
    throw Error(`Entry camera crops the first door screens: ${JSON.stringify(production.frontScreens)}`);
  await page.screenshot({ path: 'output/playwright/corridor-reference-v2-overview.png' });
  for (const [button, file] of [['左侧门口屏', 'left'], ['右侧门口屏', 'right']]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await page.screenshot({ path: `output/playwright/corridor-reference-v2-${file}-portrait.png` });
  }
  const renderedPixels = [];
  for (let slot = 1; slot <= 10; slot++) {
    const pixel = await page.evaluate(slot => {
      window.corridorPreview.showScreen(slot);
      return window.corridorPreview.readScreenPixel(slot);
    }, slot);
    if (Math.abs(pixel[0]-17) > 2 || Math.abs(pixel[1]-48) > 2 || Math.abs(pixel[2]-75) > 2)
      throw Error(`Screen ${slot} is covered by its chassis: rendered pixel ${pixel}`);
    renderedPixels.push(pixel);
  }
  await page.getByRole('button', { name: '打乱房间顺序' }).click();
  await waitReady();
  const reversed = await inspect();
  if (JSON.stringify(reversed) !== JSON.stringify(initial)) throw Error('Room order changed stable screen binding');
  await page.getByRole('button', { name: '清空 / 恢复' }).click();
  const empty = await page.evaluate(() => {
    const s = window.corridorPreview.scene;
    return { bound: s.wardCorridorBindings.filter(b => b.slot.interactive).length,
      visible: Array.from({ length: 10 }, (_, i) => s.wardCorridorModel.getObjectByName(`门口机${i+1}`).visible) };
  });
  if (empty.bound !== 0 || empty.visible.some(Boolean)) throw Error('Unbound screens remain visible');
  await page.getByRole('button', { name: '清空 / 恢复' }).click();
  await waitReady();
  if (JSON.stringify(await inspect()) !== JSON.stringify(initial)) throw Error('Screen identity changed after empty/restore');
  await page.getByRole('combobox', { name: '模板', exact: true }).selectOption('landscape');
  await page.waitForFunction(() => {
    const s = window.corridorPreview.scene;
    return s.wardCorridorBindings.every(b => {
      const canvas = b.screenTexture.image;
      const pixel = canvas.getContext('2d').getImageData(100, 100, 1, 1).data;
      return b.screenReady && pixel[0] === 17 && pixel[1] === 48 && pixel[2] === 75;
    });
  }, null, { timeout: 30000 });
  await page.getByRole('button', { name: '左侧门口屏', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/corridor-reference-v2-left-landscape.png' });
  const landscape = await inspect();
  if (landscape.some(b => Math.abs(b.width / b.height - 9/16) > .001)) throw Error('Landscape template stretched physical screen');
  await page.getByRole('combobox', { name: '模板', exact: true }).selectOption('missing');
  await waitReady();
  await page.getByRole('button', { name: '右侧门口屏', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/corridor-reference-v2-missing.png' });
  await page.getByRole('combobox', { name: '模板', exact: true }).selectOption('failed');
  await page.waitForFunction(() => window.corridorPreview.scene.corridorScreenRetryCount > 0);
  const failureRetries = await page.evaluate(() => window.corridorPreview.scene.corridorScreenRetryCount);
  await page.getByRole('combobox', { name: '模板', exact: true }).selectOption('portrait');
  await waitReady();
  await page.getByRole('button', { name: '全景', exact: true }).click();
  await page.getByRole('button', { name: '深浅主题', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/corridor-reference-v2-dark.png' });
  const layouts = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    layouts.push(await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth })));
  }
  if (layouts.some(x => x.overflow)) throw Error(`Fixture horizontal overflow: ${JSON.stringify(layouts)}`);
  await page.getByRole('button', { name: '深浅主题', exact: true }).click();
  const metrics = await page.evaluate(() => ({
    calls: window.corridorPreview.scene.renderer.info.render.calls,
    triangles: window.corridorPreview.scene.renderer.info.render.triangles,
    geometryCount: window.corridorPreview.scene.renderer.info.memory.geometries,
  }));
  if (errors.length) throw Error(`Browser errors: ${JSON.stringify(errors)}`);
  const report = { production, nativeScreens: 10, stableAfterReverse: true, stableAfterEmptyRestore: true, landscapeContain: true,
    failedTemplateRetries: failureRetries, renderedPixels, layouts, metrics, errors };
  await page.evaluate(report => { window.corridorReport = report; }, report);
  return report;
}
