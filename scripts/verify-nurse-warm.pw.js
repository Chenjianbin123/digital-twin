async (page) => {
  const origin = 'http://127.0.0.1:5194', errors = [], external = [];
  const expect = (condition, message) => { if (!condition) throw Error(message); };
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', route => {
    const url = route.request().url();
    const localAsset = /^\/(?:scripts\/fixtures\/|src\/|node_modules\/|@vite\/|@fs\/|@id\/|models\/|draco\/|output\/nurse-station-warm-v[123]\/manifest\.json|output\/playwright\/nurse-warm-theme-cache\/)/;
    if (url.startsWith(origin + '/') && route.request().method() === 'GET'
        && localAsset.test(url.slice(origin.length))) return route.continue();
    external.push(url); return route.abort();
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/scripts/fixtures/nurse-warm-preview.html?model=invalid');
  await page.waitForFunction(() => window.nurseWarmPreview?.error);
  expect(await page.locator('#scene canvas').count() === 0, 'Invalid model created WebGL resources');
  expect((await page.locator('#status').textContent()).includes('model 仅支持'), 'Invalid model was not rejected explicitly');
  await page.goto(origin + '/scripts/fixtures/nurse-warm-preview.html?model=v3');
  const ready = async () => {
    await page.waitForFunction(() => window.nurseWarmPreview?.ready || window.nurseWarmPreview?.error, null, { timeout: 60000 });
    expect(await page.evaluate(() => window.nurseWarmPreview.ready), await page.locator('#status').textContent());
  };
  await ready();
  expect(await page.evaluate(() => window.nurseWarmPreview.version === 'v3'), 'Wrong model version');
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-light.png' });
  await page.getByRole('button', { name: '深色模式', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-dark.png' });
  await page.getByRole('button', { name: '浅色模式', exact: true }).click();
  await page.getByRole('button', { name: '绑定合成屏幕', exact: true }).click();
  const bindingResult = await page.evaluate(() => {
    const p = window.nurseWarmPreview;
    for (const binding of p.bindings) {
      if (binding.mesh.material !== binding.material || binding.material.map !== binding.texture
          || binding.texture.image !== binding.canvas) throw Error('Actual screen binding differs from its declared texture');
    }
    for (const key of ['mesh', 'material', 'texture', 'canvas']) {
      if (new Set(p.bindings.map(binding => binding[key])).size !== 13) throw Error('Shared screen resource: ' + key);
    }
    const sample = index => {
      p.inspectScreen(index);
      const binding = p.bindings[index], mesh = binding.mesh;
      p.renderer.render(p.scene, p.camera);
      const position = mesh.geometry.getAttribute('position');
      const points = Array.from({ length: position.count }, (_, i) => {
        const world = p.camera.position.clone().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        return { world, projected: world.clone().project(p.camera) };
      });
      const xs = points.map(point => point.projected.x), ys = points.map(point => point.projected.y);
      // Physical visual corners, deliberately independent of the UV being tested.
      const corner = (x, y) => {
        const distance = point => (point.projected.x - x) ** 2 + (point.projected.y - y) ** 2;
        return points.reduce((a, b) => distance(a) < distance(b) ? a : b).world;
      };
      const a = corner(Math.min(...xs), Math.max(...ys)), b = corner(Math.max(...xs), Math.max(...ys));
      const c = corner(Math.min(...xs), Math.min(...ys));
      const read = (u, v) => {
        const point = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v).project(p.camera);
        const gl = p.renderer.getContext(), pixel = new Uint8Array(4);
        gl.readPixels(Math.floor((point.x * .5 + .5) * gl.drawingBufferWidth),
          Math.floor((point.y * .5 + .5) * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        return [...pixel];
      };
      return { name: mesh.name, upperLeft: read(.025, .025), upperRight: read(.975, .025),
        lowerLeft: read(.025, .975), lowerRight: read(.975, .975), revision: read(.16, .765) };
    };
    const pixels = p.bindings.map((_, index) => sample(index));
    const versions = p.bindings.map(binding => binding.texture.version);
    p.updateScreen(0);
    const after = p.bindings.map((_, index) => sample(index));
    const independent = p.bindings.map((binding, index) => ({ index,
      changed: binding.texture.version !== versions[index],
      pixelsChanged: pixels[index].revision.some((value, channel) => value !== after[index].revision[channel]) }));
    const uv = p.bindings[0].mesh.geometry.getAttribute('uv'), original = Array.from(uv.array);
    let mirrored;
    try {
      for (let index = 0; index < uv.count; index++) uv.setX(index, 1 - uv.getX(index));
      uv.needsUpdate = true; mirrored = sample(0);
    } finally {
      uv.array.set(original); uv.needsUpdate = true;
    }
    return { pixels, independent, mirrored };
  });
  const { pixels, independent, mirrored } = bindingResult;
  expect(pixels.length === 13, 'Expected all 13 screen surfaces');
  for (const pixel of pixels) {
    expect(pixel.upperLeft.slice(0, 3).every((v, i) => Math.abs(v - [233, 121, 67][i]) < 12), `${pixel.name}: upper-left corner is occluded or mirrored: ${pixel.upperLeft}`);
    expect(pixel.upperRight.slice(0, 3).every((v, i) => Math.abs(v - [72, 157, 222][i]) < 12), `${pixel.name}: upper-right corner is wrong`);
    expect(pixel.lowerLeft.slice(0, 3).every((v, i) => Math.abs(v - [168, 137, 215][i]) < 12), `${pixel.name}: lower-left corner is wrong`);
    expect(pixel.lowerRight.slice(0, 3).every((v, i) => Math.abs(v - [89, 183, 121][i]) < 12), `${pixel.name}: lower-right corner is occluded or mirrored: ${pixel.lowerRight}`);
  }
  expect(independent.every(item => item.changed === (item.index === 0) && item.pixelsChanged === (item.index === 0)), 'Updating one screen did not affect only its actual pixels');
  expect(mirrored.upperLeft.slice(0, 3).some((value, index) => Math.abs(value - [233, 121, 67][index]) > 30), 'Negative control: a mirrored UV escaped physical-corner sampling');
  await page.evaluate(() => window.nurseWarmPreview.inspectScreen(0));
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-screen.png' });
  await page.getByRole('button', { name: '还原模型屏幕', exact: true }).click();
  await page.getByRole('button', { name: '柜台细节', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/nurse-warm-v3-detail.png' });
  await page.getByRole('button', { name: '参考全景', exact: true }).click();
  const target = await page.evaluate(() => window.nurseWarmPreview.controls.target.toArray());
  await page.locator('#scene canvas').focus(); await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(before => window.nurseWarmPreview.controls.target.toArray().some((v, i) => Math.abs(v - before[i]) > .001), target), 'Keyboard pan failed');
  const responsive = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: '参考全景', exact: true }).click();
    const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      canvas: document.querySelector('#scene canvas').getBoundingClientRect().width,
      targets: [...document.querySelectorAll('nav button')].every(b => b.getBoundingClientRect().height >= 44),
      finite: Number.isFinite(window.nurseWarmPreview.camera.fov) }));
    expect(result.scroll <= width + 1 && result.canvas <= width && result.targets && result.finite, 'Responsive failure: ' + JSON.stringify(result));
    responsive.push(result);
    if (width === 320) await page.screenshot({ path: 'output/playwright/nurse-warm-v3-narrow.png' });
  }
  const asset = '**/nurse-station-warm-v3.glb';
  await page.route(asset, route => route.abort()); await page.reload();
  await page.waitForFunction(() => window.nurseWarmPreview?.error, null, { timeout: 60000 });
  expect(await page.getByRole('button', { name: '重新加载', exact: true }).isVisible(), 'Missing failed-model retry');
  await page.unroute(asset); await page.getByRole('button', { name: '重新加载', exact: true }).click(); await ready();
  await page.goto(origin + '/scripts/fixtures/nurse-warm-preview.html?model=invalid');
  await page.waitForFunction(() => window.nurseWarmPreview?.error);
  await page.goBack(); await ready();
  const environment = await page.evaluate(() => {
    const p = window.nurseWarmPreview, gl = p.renderer.getContext();
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    const asset = performance.getEntriesByType('resource').find(entry => entry.name.endsWith('nurse-station-warm-v3.glb'));
    return { userAgent: navigator.userAgent, hardwareConcurrency: navigator.hardwareConcurrency,
      devicePixelRatio, webgl: gl.getParameter(gl.VERSION), renderer,
      softwareRenderer: /swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer),
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
      modelTransfer: asset ? { transferSize: asset.transferSize, encodedBodySize: asset.encodedBodySize,
        decodedBodySize: asset.decodedBodySize, duration: asset.duration } : null };
  });
  environment.browserVersion = page.context().browser()?.version();
  const performance = await page.evaluate(() => window.nurseWarmPreview.measure());
  expect(Number.isFinite(performance.frameMedianMs) && performance.calls > 0 && performance.triangles > 1000, 'Missing real render statistics');
  const assetTriangles = await page.evaluate(() => window.nurseWarmPreview.manifest.triangles);
  expect(Number.isInteger(assetTriangles) && assetTriangles > 0
    && performance.triangles <= assetTriangles * 1.05, `Whole-scene extra render pass: ${performance.triangles} rendered / ${assetTriangles} asset triangles`);
  expect(errors.length === 0, 'JavaScript errors: ' + errors.join('; '));
  expect(external.length === 0, 'Unexpected external requests: ' + external.join('; '));
  return { passed: true, syntheticOnly: true, invalidModelRejected: true, pixels, independent, mirroredUvRejected: true,
    responsive, failedAssetRecovery: true, historyRecovery: true, keyboard: true, noWholeSceneDoublePass: true,
    environment, performance, errors, external };
}
