async (page) => {
  const phase = await page.evaluate(() => new URL(location.href).searchParams.get('phase') === 'before' ? 'before' : 'after');
  const checks = [], errors = [];
  const expect = (value, message) => { if (!value) throw new Error(message); checks.push(message); };
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`http://localhost:5173/scripts/fixtures/nurse-silver-runtime.html?phase=${phase}`);
  await page.waitForFunction(() => window.silverRuntime?.scene, null, { timeout: 60000 });
  await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60000 });
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationModel
    .getObjectByName('nurse-station-education-video')?.material.map?.isVideoTexture, null, { timeout: 30000 });
  const settle = () => page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const theme = async value => {
    await page.evaluate(v => window.silverRuntime.setTheme(v), value);
    await page.waitForFunction(v => window.silverRuntime.scene.darkTheme === (v === 'dark'), value);
    await settle();
  };
  const snapshot = () => page.evaluate(() => {
    const s = window.silverRuntime.scene, materials = new Map(), lights = [];
    s.nurseStationModel.traverse(o => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m.isMeshStandardMaterial) continue;
        materials.set(m.uuid, { uuid: m.uuid, name: m.name, color: m.color.toArray(), roughness: m.roughness,
          metalness: m.metalness, env: m.envMapIntensity, emissive: m.emissive.toArray(), emission: m.emissiveIntensity,
          maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].map(k => [m[k]?.uuid, m[k]?.channel]) });
      }
    });
    s.scene.getObjectByName('silver-nurse-station-lights').traverse(o => {
      if (o.isLight) lights.push({ uuid: o.uuid, color: o.color.toArray(), ground: o.groundColor?.toArray(), intensity: o.intensity });
    });
    return { materials: [...materials.values()], lights,
      boards: s.nurseStationBoardDisplays.map(d => d.texture.uuid),
      calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles, textures: s.renderer.info.memory.textures };
  });
  await page.getByRole('button', { name: '隐藏所有信息面板', exact: true }).click();
  await settle();
  const original = await snapshot();
  await page.screenshot({ path: `output/playwright/nurse-silver-theme-${phase}-light.png` });
  await theme('dark');
  await page.screenshot({ path: `output/playwright/nurse-silver-theme-${phase}-dark.png` });
  const dark = await snapshot();
  expect(JSON.stringify(dark.materials) !== JSON.stringify(original.materials), 'dark surfaces differ from light');
  expect(dark.calls === original.calls && dark.triangles === original.triangles && dark.textures === original.textures,
    `theme adds no draw calls, geometry or GPU textures (${original.calls}/${original.triangles}/${original.textures} -> ${dark.calls}/${dark.triangles}/${dark.textures})`);
  expect(JSON.stringify(dark.boards) === JSON.stringify(original.boards), 'business screen textures remain bound');
  await page.evaluate(() => window.silverRuntime.scene.setTheme('dark'));
  await settle();
  expect(JSON.stringify(await snapshot()) === JSON.stringify(dark), 'repeated dark application does not accumulate');
  await theme('light');
  expect(JSON.stringify(await snapshot()) === JSON.stringify(original), 'light restores all PBR properties, maps and lights exactly');
  await theme('dark');
  await page.getByRole('button', { name: '显示所有信息面板', exact: true }).click();
  await settle();
  await page.screenshot({ path: `output/playwright/nurse-silver-theme-${phase}-workspace.png` });
  await page.evaluate(() => {
    const s = window.silverRuntime.scene;
    window.silverThemeVideo = s.nurseStationModel.getObjectByName('nurse-station-education-video').material.map.image;
    window.silverThemeVideoTime = window.silverThemeVideo.currentTime;
    window.silverRuntime.setCalls(7);
  });
  await page.waitForFunction(() => window.silverRuntime.scene.nurseStationViewModel.metrics.callingCount === 7);
  expect((await page.locator('.nurse-station-visual__info').innerText()).includes('7'), 'call data still updates in the themed workspace');
  await page.waitForFunction(() => window.silverThemeVideo.currentTime !== window.silverThemeVideoTime && !window.silverThemeVideo.paused);
  expect(await page.evaluate(() => window.silverThemeVideo.loop && !window.silverThemeVideo.error), 'wall TV keeps playing the existing loop');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1080 });
    await page.waitForFunction(w => window.silverRuntime.scene.container.clientWidth === w, width);
    await settle();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth
      && Number.isFinite(window.silverRuntime.scene.camera.fov)), `${width}px no horizontal overflow and valid camera`);
    if (width === 320 || width === 1024) await page.screenshot({ path: `output/playwright/nurse-silver-theme-${phase}-${width}.png` });
  }
  expect(!errors.length, `no browser page errors: ${errors.join('; ')}`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await settle();
  await page.evaluate(report => window.silverThemeReport = report, { phase, checks, original, dark });
}
