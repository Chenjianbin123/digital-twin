async page => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [], cases = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5199/scripts/fixtures/ai-assistant-preview.html');
  const entry = page.getByRole('button', { name: 'AI 助手', exact: true });
  const panel = page.locator('#ai-assistant-panel');
  await entry.waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.assistantFixture.setTheme(value), theme);
    for (const width of [320, 390, 768, 1024, 1100, 1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      if (await panel.isVisible()) await panel.getByRole('button', { name: '关闭 AI 助手' }).click();
      const header = await page.locator('.dash-header').evaluate(root => {
        const title = root.querySelector('h1').getBoundingClientRect();
        const boxes = [...root.querySelectorAll('button,.dash-header__operator')].filter(el => el.getBoundingClientRect().width).map(el => ({ name: el.getAttribute('aria-label') || el.textContent.trim(), box: el.getBoundingClientRect().toJSON() }));
        const overlaps = boxes.filter(({ box }) => box.left < title.right && box.right > title.left && box.top < title.bottom && box.bottom > title.top);
        return { overlaps, overflow: root.scrollWidth > root.clientWidth + 2, outOfViewport: boxes.filter(({ box }) => box.right > innerWidth || box.left < 0) };
      });
      assert(!header.overlaps.length && !header.overflow && !header.outOfViewport.length, `header layout ${theme}/${width}: ${JSON.stringify(header)}`);
      await entry.click();
      await panel.waitFor();
      const layout = await panel.evaluate(root => {
        const rect = root.getBoundingClientRect(), composer = root.querySelector('textarea').getBoundingClientRect();
        const style = getComputedStyle(root);
        return { x: rect.x, right: rect.right, bottom: rect.bottom, width: rect.width, overflow: root.scrollWidth > root.clientWidth + 2,
          composerVisible: composer.top >= rect.top && composer.bottom <= rect.bottom, color: style.color, background: style.backgroundColor };
      });
      assert(layout.x >= 0 && layout.right <= width + 1 && layout.bottom <= 901 && !layout.overflow && layout.composerVisible, `panel layout ${theme}/${width}: ${JSON.stringify(layout)}`);
      assert(layout.background === (theme === 'light' ? 'rgb(245, 251, 255)' : 'rgb(16, 43, 60)'), `theme surface ${JSON.stringify(layout)}`);
      cases.push({ theme, width, ...layout });
      if ([390, 1440].includes(width)) await page.screenshot({ path: `output/playwright/ai-assistant-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
      assert(await entry.evaluate(el => document.activeElement === el), 'close must return keyboard focus');
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const scene of ['nurse-station', 'ward', 'ward-interior']) {
    await page.evaluate(value => window.assistantFixture.setScene(value), scene);
    await entry.click();
    await panel.getByRole('button', { name: '查看未处理呼叫', exact: true }).click();
    await panel.locator('.ai-assistant__card').first().waitFor();
    assert(await panel.locator('.ai-assistant__card').count() === 3, `demo cards in ${scene}`);
    await panel.getByRole('button', { name: '定位床位', exact: true }).first().click();
    const selected = await page.evaluate(() => window.assistantFixture.selected());
    assert(selected.scene === 'ward-interior' && selected.room === 'DEMO-R305' && selected.bed === 'DEMO-R305-B1', `wrong bed ${JSON.stringify(selected)}`);
    await panel.getByRole('button', { name: '查看详情', exact: true }).first().click();
    await panel.waitFor({ state: 'hidden' });
    assert(!await panel.isVisible(), 'details should restore business panel');
  }
  await entry.click();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.assistantFixture.setTheme(value), theme);
    await panel.getByRole('button', { name: '查看未处理呼叫', exact: true }).click();
    await panel.locator('.ai-assistant__loading').waitFor({ state: 'hidden' });
    await page.screenshot({ path: `output/playwright/ai-assistant-${theme}-results.png` });
  }
  await panel.locator('summary').click();
  await panel.getByRole('button', { name: '查询失败', exact: true }).click();
  await panel.getByRole('button', { name: '重试', exact: true }).waitFor();
  await panel.getByRole('button', { name: '重试', exact: true }).click();
  await panel.locator('.ai-assistant__error').waitFor({ state: 'hidden' });
  await panel.locator('.ai-assistant__loading').waitFor({ state: 'hidden' });
  await panel.getByRole('button', { name: '空结果', exact: true }).click();
  await panel.getByText('没有找到匹配的演示床位。可输入当前场景的房间名称或床位编码。', { exact: true }).first().waitFor();
  await panel.getByRole('button', { name: '总结当前病区', exact: true }).click();
  await panel.getByRole('button', { name: '停止', exact: true }).click();
  await panel.getByText('已停止本次演示，可重新输入问题。', { exact: true }).first().waitFor();
  await panel.getByRole('button', { name: '查看未处理呼叫', exact: true }).click();
  await page.evaluate(() => window.assistantFixture.switchScope());
  await panel.locator('.ai-assistant__welcome').waitFor();
  await page.waitForTimeout(800);
  assert(await panel.locator('.ai-assistant__card').count() === 0, 'old scope response should be discarded');
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.getByRole('button', { name: '查找床位', exact: true }).click();
  await panel.locator('.ai-assistant__card').first().waitFor();
  await panel.getByRole('button', { name: '定位床位', exact: true }).first().click();
  await panel.waitFor({ state: 'hidden' });
  assert(!await panel.isVisible(), 'mobile locate must reveal scene');
  assert(!errors.length, errors.join('; '));
  return { passed: true, cases, scenes: 3, failureRetry: true, empty: true, stop: true, scopeCancellation: true, mobileLocate: true, errors };
}
