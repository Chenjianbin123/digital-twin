const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.LOCAL_MOCK_PLAYWRIGHT || 'playwright');
const origin = process.env.HOSPITAL_NAV_ORIGIN || 'http://127.0.0.1:5197';
const out = 'output/playwright/hospital-navigation-3d';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const errors = [], external = [], models = [], bitmaps = [], report = { stages: {}, checks: [] };
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin || request.method() !== 'GET') { external.push(url.pathname); return route.abort(); }
    if (url.pathname.endsWith('.glb')) models.push(url.pathname);
    if (/hospital-navigation\/.*\.webp/.test(url.pathname)) bitmaps.push(url.pathname);
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const root = kind => page.locator(`.hospital-overview[data-view="${kind}"]`);
  const ready = kind => page.locator(`.hospital-overview[data-view="${kind}"][data-state="ready"]`).waitFor({ timeout: 90000 });
  const view = kind => page.locator(`.hospital-workspace[data-hospital-view="${kind}"]`).waitFor();
  const diagnostics = kind => root(kind).evaluate(el => el.__vueParentComponent.exposed.getDiagnostics());
  const shot = name => page.screenshot({ path: `${out}/${name}.png` });
  const enterMarker = kind => kind === 'exterior' ? clickModel(kind) : root(kind).locator('.hospital-overview__marker').click();
  const exteriorBack = async () => {
    await root('floor').locator('.hospital-overview__viewport').focus();
    await page.keyboard.press('Escape'); await view('exterior');
  };
  const fullViewport = async kind => {
    const size = await root(kind).locator('canvas').boundingBox(), viewport = page.viewportSize();
    assert.equal(size.x, 0); assert.equal(size.y, 0);
    assert.equal(size.width, viewport.width); assert.equal(size.height, viewport.height);
    assert.equal(await page.locator('.hospital-workspace__header, .hospital-overview__footer, .hospital-overview__tools').count(), 0);
  };
  const clickModel = async kind => {
    const info = await diagnostics(kind), canvas = await root(kind).locator('canvas').boundingBox();
    assert.ok(info.anchor && Math.abs(info.anchor[0]) < 1 && Math.abs(info.anchor[1]) < 1);
    await page.mouse.click(canvas.x + (info.anchor[0] + 1) / 2 * canvas.width,
      canvas.y + (1 - info.anchor[1]) / 2 * canvas.height);
  };
  try {
    await page.goto(origin);
    await ready('exterior'); await page.locator('.startup-loader').waitFor({ state: 'hidden', timeout: 30000 });
    await page.waitForTimeout(800); await view('exterior');
    assert.equal(await root('exterior').locator('canvas').count(), 1);
    assert.equal(await root('exterior').locator('img').count(), 0);
    assert.equal(await root('exterior').locator('.hospital-overview__marker').count(), 0, 'no floor entry prompt');
    assert.deepEqual(models, ['/models/hospital-navigation/hospital-exterior-v3.glb']);
    await fullViewport('exterior');
    report.stages.exterior = await diagnostics('exterior'); await shot('exterior-light');
    assert.equal(report.stages.exterior.projection, 'PerspectiveCamera');
    assert.ok(report.stages.exterior.backgroundMeshes > 0, 'native city, river and mountains must be in the real scene');
    report.checks.push('reference perspective camera and real background geometry');
    const targets = report.stages.exterior.floorTargets;
    assert.equal(targets.length, 24);
    await page.mouse.click(12, 12); await view('exterior');
    report.floorClicks = [];
    const exteriorCanvas = await root('exterior').locator('canvas').boundingBox();
    for (const target of targets) {
      assert.ok(Math.abs(target.point[0]) < 1 && Math.abs(target.point[1]) < 1, `${target.building} outside viewport`);
      await page.mouse.click(exteriorCanvas.x + (target.point[0] + 1) / 2 * exteriorCanvas.width,
        exteriorCanvas.y + (1 - target.point[1]) / 2 * exteriorCanvas.height);
      try { await view('floor'); }
      catch (error) { throw new Error(`Floor click failed: ${target.building} ${JSON.stringify(target.point)}`, { cause: error }); }
      await ready('floor'); report.floorClicks.push(target);
      await exteriorBack(); await page.waitForTimeout(500);
    }
    assert.equal(models.filter(path => path.includes('hospital-floor')).length, 1, 'all floor entries reuse the ward overview');
    report.checks.push('all 24 physical floors enter by actual mesh click; no entry prompt');
    await root('exterior').locator('.hospital-overview__viewport').focus();
    await page.keyboard.press('Enter'); await view('floor'); await exteriorBack(); await page.waitForTimeout(500);
    report.checks.push('keyboard exterior entry without a visible prompt');
    await clickModel('exterior'); await view('floor'); await ready('floor'); await page.waitForTimeout(800);
    report.stages.floor = await diagnostics('floor'); await shot('floor-light');
    await fullViewport('floor');
    assert.ok(report.stages.floor.triangles > 1000000 && report.stages.floor.meshes > 30);
    const sleeping = await diagnostics('exterior'); await page.waitForTimeout(400);
    assert.equal((await diagnostics('exterior')).renderCount, sleeping.renderCount, 'hidden exterior keeps drawing');
    report.checks.push('actual GLB first; no bitmap overview', 'actual floor raycast', 'hidden exterior paused');
    await clickModel('floor'); await view('clinical');
    await page.locator('.nurse-station-visual canvas').waitFor({ timeout: 60000 });
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 90000 });
    await shot('nurse-station');
    await page.getByRole('button', { name: '切换深色主题', exact: true }).click();
    await page.getByRole('button', { name: '返回楼层总览', exact: false }).click(); await view('floor'); await page.waitForTimeout(700);
    await shot('floor-dark');
    await exteriorBack(); await page.waitForTimeout(700); await shot('exterior-dark');
    assert.equal(models.filter(path => path.includes('hospital-exterior')).length, 1);
    await enterMarker('exterior'); await view('floor'); await enterMarker('floor'); await view('clinical');
    await page.getByRole('button', { name: '切换浅色主题', exact: true }).click();
    await page.getByRole('button', { name: '返回楼层总览', exact: false }).click(); await view('floor'); await page.waitForTimeout(700);
    assert.equal(models.filter(path => path.includes('hospital-floor')).length, 1, 'theme must reuse floor geometry');
    const beforeOrbit = await diagnostics('floor');
    const canvas = await root('floor').locator('canvas').boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .2, canvas.y + canvas.height * .5); await page.mouse.down();
    const started = Date.now(), startFrames = beforeOrbit.renderCount;
    for (let step = 1; step <= 30; step++) {
      await page.mouse.move(canvas.x + canvas.width * .2 + step * 3, canvas.y + canvas.height * .5 + step);
      await page.waitForTimeout(20);
    }
    await page.mouse.up(); await page.waitForTimeout(700);
    const afterOrbit = await diagnostics('floor');
    await view('floor');
    assert.notDeepEqual(afterOrbit.camera, beforeOrbit.camera, 'drag must rotate the 3D camera');
    report.orbit = { frames: afterOrbit.renderCount - startFrames, elapsedMs: Date.now() - started, frameMs: afterOrbit.frameMs };
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.wheel(0, -180); await page.waitForTimeout(700);
    assert.ok((await diagnostics('floor')).zoom > afterOrbit.zoom);
    await enterMarker('floor'); await view('clinical');
    await page.locator('.nurse-station-visual canvas').waitFor({ timeout: 60000 });
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 90000 });
    await shot('nurse-station');
    const floorInactive = await diagnostics('floor'); await page.waitForTimeout(400);
    assert.equal((await diagnostics('floor')).renderCount, floorInactive.renderCount);
    await page.getByRole('button', { name: '返回楼层总览', exact: false }).click(); await view('floor'); await page.waitForTimeout(700);
    const returned = await diagnostics('floor');
    // OrbitControls leaves a subpixel damping residual when it stops drawing.
    returned.camera.forEach((value, index) => assert.ok(Math.abs(value - floorInactive.camera[index]) < .005));
    assert.deepEqual(returned.target, floorInactive.target); assert.equal(returned.zoom, floorInactive.zoom);
    const station = root('floor').locator('.hospital-overview__marker'); await station.focus(); await page.keyboard.press('Enter'); await view('clinical');
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 30000 });
    assert.equal(models.filter(path => path.includes('nurse-station-silver-v2')).length, 1);
    await page.getByRole('button', { name: '返回楼层总览', exact: false }).click(); await view('floor');
    report.checks.push('two themes share geometry', 'real camera orbit', 'real zoom', 'nurse sign raycast', 'return camera retained', 'keyboard station entry', 'clinical GLB reused');
    await page.reload(); await ready('exterior'); await page.locator('.startup-loader').waitFor({ state: 'hidden' });
    await enterMarker('exterior'); await view('floor'); await ready('floor'); await page.waitForTimeout(700);
    report.sizes = [];
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(650);
      const size = await root('floor').evaluate(el => {
        const marker = el.querySelector('.hospital-overview__marker').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, left: marker.left, right: marker.right,
          bottom: marker.bottom, width: innerWidth, height: innerHeight };
      });
      assert.equal(size.overflow, false); assert.ok(size.left >= 0 && size.right <= width && size.bottom <= 900);
      await fullViewport('floor');
      report.sizes.push(size); await shot(`floor-${width}`);
    }
    await exteriorBack();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await enterMarker('exterior'); await view('floor');
    assert.equal(await root('floor').evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    report.checks.push('full viewport without header or footer', 'Escape returns to exterior', '320/768/1024/1440 no overflow', 'reduced motion');
    await root('floor').locator('canvas').evaluate(canvas => {
      const context = canvas.getContext('webgl2');
      const extension = context.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('WebGL loss simulation unavailable');
      extension.loseContext();
    });
    await root('floor').locator('.scene-switch-loader[data-state="fallback"]').waitFor();
    await root('floor').getByRole('button', { name: /重试加载/ }).click(); await ready('floor');
    assert.equal(await root('floor').locator('canvas').count(), 1, 'context retry must replace the old canvas');
    report.checks.push('WebGL context loss and recreation');
    await page.reload(); await ready('exterior'); await page.locator('.startup-loader').waitFor({ state: 'hidden' });
    let failedFloor = false;
    await page.route('**/hospital-floor-v4.glb', route => { if (!failedFloor) { failedFloor = true; return route.abort(); } return route.continue(); });
    await enterMarker('exterior');
    await root('floor').locator('.scene-switch-loader[data-state="fallback"]').waitFor(); await root('floor').getByRole('button', { name: /重试加载/ }).click(); await ready('floor');
    await page.unroute('**/hospital-floor-v4.glb');
    let failedExterior = false;
    await page.route('**/hospital-exterior-v3.glb', route => { if (!failedExterior) { failedExterior = true; return route.abort(); } return route.continue(); });
    await page.reload(); await page.locator('.startup-loader').getByText('医院场景暂未就绪').waitFor();
    await page.locator('.startup-loader').getByRole('button', { name: /重试/ }).click(); await ready('exterior');
    await page.locator('.startup-loader').waitFor({ state: 'hidden', timeout: 30000 });
    await page.setViewportSize({ width: 2560, height: 1441 }); await page.waitForTimeout(700);
    await shot('exterior-reference-2560');
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(bitmaps, []);
    report.checks.push('floor GLB retry', 'startup GLB retry', 'no JS or external errors');
    report.passed = true; report.models = models; report.errors = errors; report.external = external; report.bitmaps = bitmaps;
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } catch (error) {
    await shot('failure'); report.passed = false; report.failure = error.message;
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); throw error;
  }
  finally { await context.close(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
