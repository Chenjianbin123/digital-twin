async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&reference');
  await page.locator('.data-health').waitFor();
  await page.evaluate(() => window.commandFixture.setChartHealth('warning'));
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1200 });
      await page.getByRole('tab', { name: '概览', exact: true }).click();
      const health = page.locator('.data-health');
      await health.scrollIntoViewIfNeeded();
      const layout = await health.evaluate(root => {
        const failures = [];
        for (const row of root.querySelectorAll('li')) {
          const box = el => el.getBoundingClientRect();
          const icon = box(row.querySelector('.clinical-icon'));
          const label = box(row.querySelector('span'));
          const detail = box(row.querySelector('small'));
          const status = box(row.querySelector('strong'));
          if (icon.right > label.left + 1 || Math.abs(label.left - detail.left) > 1 || label.right > status.left + 1 || detail.right > status.left + 1 || label.bottom > detail.top + 1) failures.push('overlap or misalignment');
          if (row.scrollWidth > row.clientWidth + 1) failures.push('row overflow');
        }
        return { failures, rows: root.querySelectorAll('li').length, overflow: root.scrollWidth > root.clientWidth + 1 };
      });
      assert(layout.rows === 5 && !layout.failures.length && !layout.overflow, `${theme}/${width} health: ${JSON.stringify(layout)}`);
      if ([1440, 320].includes(width)) await health.screenshot({ path: `output/playwright/health-aligned-${theme}-${width}.png` });
      await page.getByRole('tab', { name: '待办', exact: true }).click();
      const categories = page.locator('.queue-categories');
      await categories.scrollIntoViewIfNeeded();
      const cards = categories.locator('button');
      const cardLayout = await categories.evaluate(root => {
        const buttons = [...root.querySelectorAll('button')];
        return {
          overflow: buttons.some(el => el.scrollWidth > el.clientWidth + 1 || [...el.querySelectorAll('span,strong')].some(child => child.scrollWidth > child.clientWidth + 1)),
          raised: buttons.every(el => getComputedStyle(el).boxShadow !== 'none'),
          widths: buttons.map(el => el.getBoundingClientRect().width),
        };
      });
      assert(!cardLayout.overflow && cardLayout.raised && Math.max(...cardLayout.widths) - Math.min(...cardLayout.widths) < 1, `${theme}/${width} categories: ${JSON.stringify(cardLayout)}`);
      if ([1440, 320].includes(width)) await categories.screenshot({ path: `output/playwright/categories-raised-${theme}-${width}.png` });
      await cards.first().click();
      assert(await cards.first().getAttribute('aria-pressed') === 'true', 'category filter did not activate');
      await cards.first().focus();
      await page.keyboard.press('Space');
      assert(await cards.first().getAttribute('aria-pressed') === 'false', 'keyboard could not clear filter');
      results.push({ theme, width, ...layout, ...cardLayout });
    }
    await page.setViewportSize({ width: 1440, height: 1200 });
    const button = page.locator('.queue-categories button').first();
    await page.mouse.move(0, 0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const normal = await button.evaluate(el => ({ color: getComputedStyle(el.querySelector('span:not(.nurse-workspace-icon)')).color, background: getComputedStyle(el).background }));
    await button.hover();
    const hovered = await button.evaluate(el => ({ color: getComputedStyle(el.querySelector('span:not(.nurse-workspace-icon)')).color, background: getComputedStyle(el).background, transform: getComputedStyle(el).transform }));
    assert(normal.background !== hovered.background && normal.color === hovered.color && hovered.transform === 'none', `${theme}: hover or reduced-motion regression ${JSON.stringify({ normal, hovered })}`);
    await button.focus();
    assert(await button.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), 'missing keyboard focus');
    await page.locator('.queue-categories').screenshot({ path: `output/playwright/categories-hover-${theme}.png` });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  }
  assert(!errors.length, errors.join('; '));
  return { passed: true, cases: results.length, results };
}
