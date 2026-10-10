async page => {
  const problems = [], requests = [];
  const onConsole = message => {
    if (message.type() === 'error' || /GL_INVALID_|sampler type|OUT_OF_MEMORY|CONTEXT_LOST/.test(message.text())) problems.push(message.text());
  };
  const onError = error => problems.push(error.message);
  const onRequest = request => requests.push(request.url());
  page.on('console', onConsole); page.on('pageerror', onError); page.on('request', onRequest);
  try {
    await page.setViewportSize({ width: 1672, height: 941 });
    await page.goto('http://localhost:5173/scripts/fixtures/ward-graphite-preview.html');
    await page.waitForFunction(() => window.wardGraphitePreview?.ready || window.wardGraphitePreview?.error, null, { timeout: 60000 });
    const report = await page.evaluate(() => {
      const p = window.wardGraphitePreview;
      if (p.error) throw new Error(p.error);
      const [a, b] = p.units;
      if (!a || !b || a.screen.material === b.screen.material || a.screen.geometry === b.screen.geometry || a.screen.material.map === b.screen.material.map) throw new Error('Bed terminal resources are not isolated');
      p.units.forEach((unit, index) => {
        if (unit.screen.material.map.image.dataset.bedCode !== `GRAPHITE-DEMO-${index + 1}`) throw new Error('Bed terminal content identity mismatch');
      });
      return { ready: p.ready, beds: p.units.length, calls: p.renderer.info.render.calls, triangles: p.renderer.info.render.triangles, independentScreens: true };
    });
    await page.locator('#scene').screenshot({ path: 'output/playwright/ward-graphite-web-hero.png' });
    await page.getByRole('button', { name: '床细节', exact: true }).click();
    await page.locator('#scene').screenshot({ path: 'output/playwright/ward-graphite-web-detail.png' });
    for (const index of [1, 2]) {
      await page.getByRole('button', { name: '屏幕检查', exact: true }).click();
      await page.locator('#scene').screenshot({ path: `output/playwright/ward-graphite-screen-${index}.png` });
    }
    await page.getByRole('button', { name: '复位', exact: true }).click();
    const layouts = [];
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      const layout = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, buttons: [...document.querySelectorAll('.actions button:not([hidden])')].map(b => b.getBoundingClientRect().height) }));
      if (layout.overflow || layout.buttons.some(height => height < 44)) throw new Error('Viewport controls do not fit');
      layouts.push(layout);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'output/playwright/ward-graphite-web-narrow.png' });
    await page.setViewportSize({ width: 1672, height: 941 });
    if (requests.some(url => /^https?:/.test(url) && !/^http:\/\/localhost(?::\d+)?\//.test(url))) throw new Error('Unexpected external request');
    if (requests.some(url => /\/api\/|\/swp\/|\/db-adapter\//i.test(url))) throw new Error('Unexpected hospital data request');
    if (problems.length) throw new Error(`Browser rendering errors: ${problems.join('\n')}`);
    return { ...report, layouts, externalRequests: 0, hospitalRequests: 0, renderingErrors: problems };
  } finally {
    page.off('console', onConsole); page.off('pageerror', onError); page.off('request', onRequest);
  }
}
