async (page) => {
  const errors = [], requests = [], checks = [];
  const expect = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(request.url()));
  await page.addInitScript(() => {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      const labels = this.canvas.__labels ??= [];
      labels.push(String(text)); if (labels.length > 100) labels.shift();
      return fillText.call(this, text, ...args);
    };
  });
  const url = 'http://localhost:5173/scripts/fixtures/nurse-silver-runtime.html';
  const ready = async () => {
    await page.waitForFunction(() => window.silverRuntime?.scene, null, { timeout: 60000 });
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60000 });
  };
  await page.setViewportSize({ width: 1664, height: 1000 });
  await page.goto(`${url}?video=`); await ready();
  const initial = await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    return { scale: s.nurseStationModel.scale.toArray(), boards: s.nurseStationBoardDisplays.map(d => ({
      kind: d.kind, source: d.screen.userData.sourceScreen, labels: d.texture.image.__labels,
      flipY: d.texture.flipY, size: [d.texture.image.width, d.texture.image.height],
    })), textures: s.renderer.info.memory.textures, position: s.camera.position.toArray() };
  });
  expect(initial.scale.every(x => x === 1), 'authored metre scale');
  expect(initial.boards.length === 7, 'main + four work screens + service + clock');
  expect(initial.boards.find(d => d.kind === 'dashboard').labels.includes('12'), 'canvas dashboard shows actual view-model count 12');
  expect(initial.boards.find(d => d.source === 'Screen_Service').kind === 'wardStatus', 'service terminal uses ward data');
  expect(initial.boards.filter(d => d.source?.includes('Work') || d.source === 'Screen_Service').every(d => d.size[0]/d.size[1] === 16/9 && !d.flipY), 'work faces use native 16:9 UV');
  expect(!requests.some(url => /nurse-station\.glb|hospital-handwashing|\.mp4|\.webm/.test(url)), 'no legacy model or unconfigured video downloaded');
  await page.evaluate(() => window.silverRuntime.setCalls(7));
  await page.waitForFunction(() => {
    const s = window.silverRuntime.scene;
    return s.nurseStationViewModel.metrics.callingCount === 7
      && s.nurseStationBoardDisplays.find(d => d.kind === 'dashboard').texture.image.__labels.includes('7');
  });
  expect((await page.locator('.nurse-station-visual__info').innerText()).includes('7'), 'overlay and 3D use the same updated count');
  const signatures = await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    return { uuid: s.nurseStationBoardDisplays.map(d => d.texture.uuid), signatures: s.nurseStationBoardDisplays.map(d => d.signature) };
  });
  await page.evaluate(() => window.silverRuntime.setCalls(0));
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationViewModel.metrics.callingCount === 0);
  expect(await page.evaluate(ids => window.silverRuntime.scene.nurseStationBoardDisplays.every((d,i) => d.texture.uuid === ids[i]), signatures.uuid), 'data updates reuse GPU textures');
  await page.evaluate(() => window.silverRuntime.setCalls(7));
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationViewModel.metrics.callingCount === 7);
  const materials = await page.evaluate(() => {
    const model = window.silverRuntime.scene.nurseStationModel, snapshot = [];
    model.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === 'SilverV1_silver_AO') snapshot.push([m.color.getHex(), m.map?.uuid, m.aoMap?.uuid]); });
    return snapshot;
  });
  expect(materials.length > 0 && materials.every(m => m[2]), 'refined silver materials carry real AO textures');
  expect(await page.evaluate(() => {
    const s = window.silverRuntime.scene, meshes = [];
    s.nurseStationModel.getObjectByName('Hero_SilverV2').traverse(o => { if (o.isMesh) meshes.push(o); });
    return meshes.length > 0 && meshes.every(mesh => mesh.castShadow && mesh.geometry.getAttribute('uv1')
      && mesh.material.aoMap?.channel === 1);
  }), 'visible hero primitives cast shadows and use UV1 occlusion');
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.silverRuntime.setTheme(value), theme);
    await page.waitForFunction(value => window.silverRuntime.scene.darkTheme === (value === 'dark'), theme);
    // Wait for CSS transitions plus two rendered frames, not just the theme flag.
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: `output/playwright/nurse-silver-v2-runtime-${theme}.png` });
  }
  await page.evaluate(() => window.silverRuntime.setTheme('light'));
  await page.waitForFunction(() => !window.silverRuntime.scene.darkTheme);
  expect(await page.evaluate(previous => {
    const result = []; window.silverRuntime.scene.nurseStationModel.traverse(o => { if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.name === 'SilverV1_silver_AO') result.push([m.color.getHex(), m.map?.uuid, m.aoMap?.uuid]); });
    return JSON.stringify(previous) === JSON.stringify(result);
  }, materials), 'light-dark-light restores the original PBR material');
  for (const width of [320, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1080 });
    await page.waitForFunction(w => window.silverRuntime.scene.container.clientWidth === w, width);
    const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth,
      fov: window.silverRuntime.scene.camera.fov, active: window.silverRuntime.scene.isActive }));
    expect(!layout.overflow && Number.isFinite(layout.fov) && layout.active, `${width}px no overflow and finite camera`);
    if (width === 320 || width === 1024) await page.screenshot({ path: `output/playwright/nurse-silver-v2-runtime-${width}.png` });
  }
  const bounds = await page.evaluate(() => {
    const s = window.silverRuntime.scene; s.setActive(false); s.stationCameraInteracted = true;
    s.camera.position.set(100, 100, -100); s.controls.target.set(-100, 100, -100);
    s.applyStationOrbitCeilingConstraint();
    const b = s.getNurseStationPaddedBounds(), p = s.camera.position;
    const valid = p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY && p.z >= b.minZ && p.z <= b.maxZ;
    s.resetToNurseStationView(); s.setActive(true); return valid;
  });
  expect(bounds, 'camera cannot escape floor ceiling or outer/back walls');
  await page.getByRole('button', { name: /病房走廊/ }).click();
  await page.waitForFunction(() => !window.silverRuntime.scene.isActive);
  await page.getByRole('navigation', { name: '场景切换' }).getByRole('button', { name: '护士站', exact: true }).click();
  await ready();
  expect(await page.evaluate(() => window.silverRuntime.scene.isActive), 'station resumes after corridor switch');

  // The no-source state is explicit above; a local fixture keeps lifecycle checks network-independent.
  await page.goto(`${url}?video=/videos/hospital-handwashing-education.mp4`); await ready();
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video').material.map.isVideoTexture, null, { timeout: 30000 });
  await page.evaluate(() => { const s=window.silverRuntime.scene; window.testVideo=s.nurseStationModel.getObjectByName('nurse-station-education-video').material.map.image; window.testVideoTime=window.testVideo.currentTime; });
  await page.waitForFunction(() => window.testVideo.currentTime > window.testVideoTime + .2);
  expect(true, 'TV plays decoded video frames');
  await page.evaluate(() => window.silverRuntime.scene.setActive(false));
  expect(await page.evaluate(() => window.testVideo.paused), 'inactive scene pauses video');
  await page.evaluate(() => window.silverRuntime.scene.setActive(true));
  await page.waitForFunction(() => !window.testVideo.paused);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => window.testVideo.paused), 'hidden page pauses video');
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => !window.testVideo.paused);
  await page.evaluate(() => window.silverRuntime.setMounted(false));
  await page.waitForFunction(() => !document.querySelector('.digital-twin'));
  expect(await page.evaluate(() => window.testVideo.paused && !window.testVideo.getAttribute('src')), 'unmount pauses and releases media source');
  await page.goto(`${url}?video=/videos/nonexistent-silver-test.mp4`); await ready();
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationModel.getObjectByName('nurse-station-education-video').material.map.image.__labels.includes('视频加载失败'));
  expect(true, 'invalid video gives explicit status without failing model load');
  await page.route('**/nurse-station-silver-v2.glb*', route => route.abort());
  await page.goto(url);
  await page.locator('.scene-switch-loader[data-state="fallback"]').waitFor({ timeout: 60000 });
  expect(true, 'model failure is visible');
  await page.unroute('**/nurse-station-silver-v2.glb*');
  await page.route('**/nurse-station-silver-v2.glb*', route => route.fulfill({ json: {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'WrongLayoutRoot' }],
  } }));
  await page.reload();
  await page.locator('.scene-switch-loader[data-state="fallback"]').waitFor({ timeout: 60000 });
  expect(await page.evaluate(() => window.silverRuntime.scenes.every(s => !s.nurseStationModel)), 'invalid layout releases the decoded model');
  await page.unroute('**/nurse-station-silver-v2.glb*');
  await page.reload(); await ready();
  expect(true, 'model recovers after reload');
  expect(errors.length === 0, `no uncaught JS errors: ${errors.join('; ')}`);
  await page.evaluate(result => { window.silverRuntimeReport = result; }, { checks, initial, errors });
}
