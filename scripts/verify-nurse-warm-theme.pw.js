async (page) => {
  const origin = 'http://127.0.0.1:5194', errors = [], blocked = [];
  const expect = (condition, message) => { if (!condition) throw Error(message); };
  page.on('pageerror', error => errors.push(error.message));
  await page.context().unroute('**/*');
  await page.context().route('**/*', route => {
    const url = route.request().url();
    const asset = /^\/(?:scripts\/fixtures\/|src\/|node_modules\/|@vite\/|@fs\/|@id\/|models\/|draco\/|images\/|fonts\/|output\/nurse-station-warm-v3\/manifest\.json|output\/playwright\/nurse-warm-theme-cache\/)/;
    if (url.startsWith(origin + '/') && route.request().method() === 'GET' && asset.test(url.slice(origin.length))) return route.continue();
    blocked.push(url); return route.abort();
  });
  await page.bringToFront();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(origin + '/scripts/fixtures/nurse-warm-preview.html?model=v3&presentation=1');
  // Readiness is not an animation: keep polling when a static WebGL page has no RAF work.
  await page.waitForFunction(() => Boolean(window.nurseWarmPreview?.ready && document.querySelector('.warm-sidebar')), null, { timeout: 15000, polling: 100 })
    .catch(async error => { throw Error('Initial model/sidebar wait: ' + error.message + ' ' + JSON.stringify(await page.evaluate(() => ({ ready: window.nurseWarmPreview?.ready, error: window.nurseWarmPreview?.error, side: !!document.querySelector('.warm-sidebar'), status: document.getElementById('status')?.textContent })))); });
  await page.locator('#theme-sidebar').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  const digest = () => page.evaluate(() => {
    const p = window.nurseWarmPreview, unique = new Map();
    p.model.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        unique.set(material.uuid, { id: material.uuid, name: material.name, color: material.color?.toArray(),
          emissive: material.emissive?.toArray(), intensity: material.emissiveIntensity,
          maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap'].map(key => material[key]?.uuid),
          roughness: material.roughness, opacity: material.opacity });
      }
    });
    const key = p.scene.getObjectByName('warm-station-key'), casters = [];
    p.model.traverse(object => { if (object.isMesh && object.castShadow) casters.push(object.name); });
    p.renderer.render(p.scene, p.camera);
    return { materials: [...unique.values()], casters, shadowReady: !!key.shadow.map && !key.shadow.needsUpdate,
      textures: p.renderer.info.memory.textures, geometry: p.renderer.info.memory.geometries,
      triangles: p.renderer.info.render.triangles, calls: p.renderer.info.render.calls,
      shadowType: p.renderer.shadowMap.type,
      exposure: p.renderer.toneMappingExposure, environmentIntensity: p.scene.environmentIntensity,
      theme: document.documentElement.dataset.theme, sidebarTheme: document.querySelector('.warm-sidebar').dataset.theme };
  });
  const light = await digest();
  expect(light.casters.length > 0 && light.shadowReady, 'Static furniture shadows were not prepared');
  expect(light.shadowType === 0, 'Expected BasicShadowMap to avoid the measured multi-sample shadow regression');
  expect(light.triangles === 371565 && light.calls === 49, 'Unexpected repeated scene pass after cached shadow');
  await page.screenshot({ path: 'output/playwright/nurse-warm-theme-light.png', animations: 'disabled' });
  await page.getByRole('button', { name: '深色模式', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.warm-sidebar').dataset.theme === 'dark', null, { polling: 100 })
    .catch(error => { throw Error('Dark sidebar wait: ' + error.message); });
  const dark = await digest();
  expect(dark.theme === 'dark' && dark.sidebarTheme === 'dark', 'UI/model theme mismatch');
  const byName = (data, name) => data.materials.find(material => material.name === name);
  for (const name of ['WarmStationV1_wall', 'WarmStationV1_white', 'WarmStationV1_oak', 'WarmStationV1_floor_blue']) {
    expect(JSON.stringify(byName(light, name).color) === JSON.stringify(byName(dark, name).color), 'Day/night repainted finish: ' + name);
  }
  expect(dark.exposure < light.exposure && dark.environmentIntensity < light.environmentIntensity / 2, 'Night lighting must remain distinct');
  for (let cycle = 0; cycle < 8; cycle++) {
    await page.evaluate(() => { window.nurseWarmPreview.setTheme('light'); window.nurseWarmPreview.setTheme('dark'); });
  }
  const stableDark = await digest();
  expect(JSON.stringify(stableDark.materials) === JSON.stringify(dark.materials), 'Theme color drift or material reallocation');
  expect(stableDark.textures === light.textures && stableDark.geometry === light.geometry, 'Theme switch resource growth');
  await page.screenshot({ path: 'output/playwright/nurse-warm-theme-dark.png', animations: 'disabled' });
  await page.getByRole('button', { name: '浅色模式', exact: true }).click();
  const restored = await digest();
  expect(JSON.stringify(restored.materials) === JSON.stringify(light.materials), 'Light palette not restored exactly');
  const displays = data => data.materials.filter(material => /screen|display/i.test(material.name));
  expect(JSON.stringify(displays(light)) === JSON.stringify(displays(dark)), 'Authored screen content was tinted');
  const responsive = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.nurseWarmPreview.setTheme(value), theme);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(() => {
        const p = window.nurseWarmPreview, host = document.getElementById('scene');
        return Math.abs(p.camera.aspect - host.clientWidth / host.clientHeight) < .001;
      }, null, { polling: 100 }).catch(error => { throw Error(`Responsive camera wait ${theme}/${width}: ` + error.message); });
      const box = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        sidebar: document.querySelector('#theme-sidebar').getBoundingClientRect().width,
        canvas: document.querySelector('#scene canvas').getBoundingClientRect().width,
        toolbarTargets: [...document.querySelectorAll('.warm-preview-toolbar button')].every(button => button.offsetHeight >= 44),
        canScroll: getComputedStyle(document.body).overflowY !== 'hidden' }));
      expect(box.scroll <= width + 1 && box.canvas > 0 && box.sidebar <= width && box.toolbarTargets && box.canScroll, 'Responsive failure: ' + JSON.stringify(box));
      responsive.push({ theme, ...box });
      if (width === 320) await page.screenshot({ path: `output/playwright/nurse-warm-theme-${theme}-narrow.png`, fullPage: true, animations: 'disabled' });
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  const overview = page.getByRole('tab', { name: '概览', exact: true });
  await overview.focus(); await page.keyboard.press('ArrowRight');
  expect(await page.getByRole('tab', { name: /^待办/ }).getAttribute('aria-selected') === 'true', 'Production sidebar keyboard tabs failed');
  await page.getByRole('button', { name: '确认关注', exact: true }).first().click();
  await page.getByRole('tab', { name: /^已关注/ }).click();
  expect(await page.locator('.alert-task:visible').count() === 1, 'Confirmation deleted the source task instead of retaining it');
  expect((await page.locator('.alert-task:visible').textContent()).includes('演示呼叫'), 'Confirmed source call is missing');
  await page.getByRole('tab', { name: /^待办/ }).focus();
  await page.keyboard.press('ArrowLeft');
  expect(await overview.getAttribute('aria-selected') === 'true', 'Overview keyboard return failed');
  await page.getByRole('button', { name: '隐藏项目侧边栏', exact: true }).click();
  await page.getByRole('button', { name: '显示项目侧边栏', exact: true }).click();
  expect(await page.locator('.warm-sidebar').count() === 1, 'Sidebar duplicated on reopen');
  expect(errors.length === 0 && blocked.length === 0, `Unexpected JS/network errors: ${JSON.stringify({ errors, blocked })}`);
  return { passed: true, themes: 2, cycles: 8, independentScreenMaterials: displays(light).length,
    staticShadowCasters: light.casters.length, cachedDrawCalls: light.calls, triangles: light.triangles,
    responsive, keyboard: true, confirmationRetainsSource: true, errors, blocked };
}
