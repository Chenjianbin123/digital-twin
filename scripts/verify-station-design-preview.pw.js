async (page) => {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await page.reload();
    await page.getByRole('button', { name: '正面全景', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.status')?.textContent.includes('已加载'));
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [label, key] of [['正面全景', 'front'], ['柜台细节', 'detail'], ['护士工作侧', 'workstation'], ['信息屏', 'wall']]) {
      const button = page.getByRole('button', { name: label, exact: true });
      await button.click();
      if (await button.getAttribute('aria-pressed') !== 'true') throw new Error(label + ' not selected');
      await page.screenshot({ path: `output/playwright/station-v2-${key}.png` });
    }
    await page.getByRole('button', { name: '正面全景', exact: true }).click();
    const canvas = page.getByLabel('三维护士站，可拖动旋转、滚轮缩放、方向键平移', { exact: true });
    const before = await canvas.screenshot();
    const rect = await canvas.boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width / 2 + 65, rect.y + rect.height / 2 + 15, { steps: 8 });
    await page.mouse.up();
    if (before.equals(await canvas.screenshot())) throw new Error('drag does not update the scene');
    const beforeZoom = await canvas.screenshot();
    await page.mouse.wheel(0, -180);
    if (beforeZoom.equals(await canvas.screenshot())) throw new Error('zoom does not update the scene');
    await canvas.focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('slider', { name: '亮度', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    if (await page.getByRole('slider', { name: '亮度', exact: true }).inputValue() !== '1.05') throw new Error('exposure keyboard input failed');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: '正面全景', exact: true }).click();
    const layouts = [];
    for (const [width, height] of [[320, 640], [768, 1024], [1024, 768], [1440, 900]]) {
      await page.setViewportSize({ width, height });
      const result = await page.evaluate(() => {
        const failures = [];
        if (document.documentElement.scrollWidth > innerWidth) failures.push('horizontal overflow');
        for (const el of document.querySelectorAll('button, input, header a')) {
          const r = el.getBoundingClientRect();
          if (r.x < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) failures.push('control outside viewport');
        }
        return { width: innerWidth, height: innerHeight, failures };
      });
      layouts.push(result);
      if (result.failures.length) throw new Error(JSON.stringify(result));
      if (width === 320) await page.screenshot({ path: 'output/playwright/station-v2-mobile.png' });
    }
    const failedPage = await page.context().newPage();
    try {
      const modelPattern = '**/nurse-station-design-v2.glb';
      await failedPage.route(modelPattern, route => route.abort());
      await failedPage.goto(page.url());
      await failedPage.getByRole('button', { name: '重新加载', exact: true }).waitFor();
      if (await failedPage.getByRole('button', { name: '正面全景', exact: true }).isEnabled()) throw new Error('failed scene controls remain enabled');
      await failedPage.unroute(modelPattern);
      await failedPage.getByRole('button', { name: '重新加载', exact: true }).click();
      await failedPage.waitForFunction(() => document.querySelector('.status')?.textContent.includes('已加载'));
    }
    finally { await failedPage.close(); }
    await page.screenshot({ path: 'output/playwright/station-v2-front.png' });
    if (errors.length) throw new Error(errors.join('\n'));
    return { views: 4, layouts, drag: 'passed', zoom: 'passed', exposure: 'passed', modelFailureRetry: 'passed', pageErrors: errors };
  }
  finally { page.off('pageerror', onError); }
}
