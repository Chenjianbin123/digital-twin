async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const waitFor = (stage, predicate, arg) => page.waitForFunction(predicate, arg, { timeout: 60000 })
    .catch(error => { throw new Error(`${stage}: ${error.message}`); });
  await page.setViewportSize({ width: 1664, height: 1080 });
  await page.goto('http://localhost:5173/scripts/fixtures/nurse-silver-preview.html');
  await waitFor('initial model load', () => window.nurseSilverPreview);
  const expect = (value, message) => { if (!value) throw new Error(message); };
  for (const [name, title] of [['front', '参考全景'], ['detail', '柜台细节'], ['staff', '护士操作位'], ['wall', '墙挂电视']]) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await waitFor(`view ${name}`, view => window.nurseSilverPreview && document.querySelector(`[data-view="${view}"]`).getAttribute('aria-pressed') === 'true', name);
    await page.screenshot({ path: `output/playwright/nurse-silver-${name}.png` });
  }
  // Probe real GPU pixels with the production binding helper's replacement faces.
  const screenPixels = await page.evaluate(async () => {
    const { model, camera, renderer, scene, controls } = window.nurseSilverPreview;
    const names = ['nurse-station-reference-display-dashboard', 'nurse-station-reference-display-taskQueue',
      'nurse-station-reference-display-wardStatus', 'nurse-station-reference-display-bedMonitor',
      'nurse-station-reference-display-deviceHealth', 'Screen_Service'];
    const results = [];
    for (const name of names) {
      const screen = model.getObjectByName(name), position = screen.geometry.getAttribute('position'), uv = screen.geometry.getAttribute('uv');
      const corner = (u, v) => {
        let index = Array.from({ length: uv.count }, (_, i) => i).find(i => Math.abs(uv.getX(i)-u) < .001 && Math.abs(uv.getY(i)-v) < .001);
        return camera.position.clone().fromBufferAttribute(position, index).applyMatrix4(screen.matrixWorld);
      };
      const a = corner(0, 0), b = corner(1, 0), c = corner(0, 1);
      const center = a.clone().add(b).add(c).sub(a).multiplyScalar(.5);
      const work = name !== names[0];
      camera.position.copy(center).add(camera.position.clone().set(0, 0, work ? -.65 : 2.8));
      controls.target.copy(center); controls.update(); camera.fov = 42; camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      const sample = a.clone().add(b.clone().sub(a).multiplyScalar(.012)).add(c.clone().sub(a).multiplyScalar(.06)).project(camera);
      const gl = renderer.getContext(), pixel = new Uint8Array(4);
      gl.readPixels(Math.floor((sample.x*.5+.5)*gl.drawingBufferWidth), Math.floor((sample.y*.5+.5)*gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      results.push({ name, pixel: [...pixel] });
    }
    return results;
  });
  for (const { name, pixel } of screenPixels) expect(Math.abs(pixel[0]-12) < 4 && Math.abs(pixel[1]-46) < 4 && Math.abs(pixel[2]-70) < 4, `${name} not visible / occluded / wrong texture: ${pixel}`);
  await page.getByRole('button', { name: '墙挂电视', exact: true }).click();
  await page.getByRole('button', { name: '播放合成视频', exact: true }).click();
  await waitFor('video starts', () => {
    const p = window.nurseSilverPreview;
    return p.video.currentTime > .3 && p.model.getObjectByName('Screen_Video').material.map.isVideoTexture;
  });
  const start = await page.evaluate(() => window.nurseSilverPreview.video.currentTime);
  await waitFor('video progresses', time => window.nurseSilverPreview.video.currentTime > time+.3, start);
  const videoPixels = await page.evaluate(() => {
    const { model, camera, renderer, scene } = window.nurseSilverPreview;
    const screen = model.getObjectByName('Screen_Video'), position = screen.geometry.getAttribute('position'), uv = screen.geometry.getAttribute('uv');
    const corner = (u, v) => {
      const i = Array.from({ length: uv.count }, (_, i) => i).find(i => uv.getX(i) === u && uv.getY(i) === v);
      return camera.position.clone().fromBufferAttribute(position, i).applyMatrix4(screen.matrixWorld);
    };
    const a = corner(0, 0), b = corner(1, 0), c = corner(0, 1);
    renderer.render(scene, camera);
    return [[.019, .032], [.981, .968]].map(([u, v]) => {
      const p = a.clone().add(b.clone().sub(a).multiplyScalar(u)).add(c.clone().sub(a).multiplyScalar(v)).project(camera);
      const gl = renderer.getContext(), pixel = new Uint8Array(4);
      gl.readPixels(Math.floor((p.x*.5+.5)*gl.drawingBufferWidth), Math.floor((p.y*.5+.5)*gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      return [...pixel];
    });
  });
  expect(videoPixels[0][0] > videoPixels[0][1]+40, `Video upper-left marker must be orange: ${videoPixels[0]}`);
  expect(videoPixels[1][1] > videoPixels[1][0]+35, `Video bottom-right marker must be green: ${videoPixels[1]}`);
  await page.screenshot({ path: 'output/playwright/nurse-silver-video.png' });
  await page.getByRole('button', { name: '停止视频', exact: true }).click();
  expect(await page.evaluate(() => window.nurseSilverPreview.video.paused && window.nurseSilverPreview.video.srcObject === null), 'Video tracks were not stopped');
  const baselineTextures = await page.evaluate(() => window.nurseSilverPreview.renderer.info.memory.textures);
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '播放合成视频', exact: true }).click();
    await waitFor('video restarts', () => !window.nurseSilverPreview.video.paused);
    await page.getByRole('button', { name: '停止视频', exact: true }).click();
  }
  expect(await page.evaluate(base => window.nurseSilverPreview.renderer.info.memory.textures <= base+1, baselineTextures), 'Repeated playback leaks textures');
  await page.evaluate(() => {
    const files = new DataTransfer();
    files.items.add(new File(['invalid video fixture'], 'invalid.mp4', { type: 'video/mp4' }));
    const input = document.querySelector('#video-file');
    input.files = files.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await waitFor('invalid video feedback', () => document.querySelector('#video-status').textContent.includes('视频未能播放'));
  await page.getByRole('button', { name: '参考全景', exact: true }).click();
  const beforePan = await page.evaluate(() => window.nurseSilverPreview.controls.target.toArray());
  await page.locator('#scene canvas').focus();
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(before => window.nurseSilverPreview.controls.target.toArray().some((v, i) => Math.abs(v-before[i]) > .001), beforePan), 'Keyboard pan did not work');
  const sizes = [];
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '参考全景', exact: true }).click();
    const result = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      canvasWidth: document.querySelector('#scene canvas').getBoundingClientRect().width,
      buttons: [...document.querySelectorAll('nav button')].every(b => b.getBoundingClientRect().height >= 44),
      finiteCamera: Number.isFinite(window.nurseSilverPreview.camera.fov),
    }));
    expect(result.scroll <= width+1 && result.canvasWidth <= width && result.buttons && result.finiteCamera, `Responsive failure: ${JSON.stringify(result)}`);
    sizes.push(result);
  }
  const asset = '**/nurse-station-silver-v1.glb';
  await page.route(asset, route => route.abort());
  await page.reload();
  await waitFor('failed model feedback', () => document.querySelector('#status').textContent.includes('模型加载失败'));
  expect(await page.getByRole('button', { name: '重新加载', exact: true }).isVisible(), 'Missing retry action');
  await page.unroute(asset);
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await waitFor('model retry recovery', () => window.nurseSilverPreview);
  await page.setViewportSize({ width: 1664, height: 1080 });
  await page.getByRole('button', { name: '参考全景', exact: true }).click();
  const render = await page.evaluate(() => {
    const p = window.nurseSilverPreview; p.renderer.render(p.scene, p.camera);
    return { ...p.renderer.info.render };
  });
  expect(errors.length === 0, `JavaScript errors: ${errors.join('; ')}`);
  return { screenPixels, videoPixels, responsive: sizes, failedAssetRecovery: true, invalidVideoHandled: true, keyboard: true, render, errors };
}
