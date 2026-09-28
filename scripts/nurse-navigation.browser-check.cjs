async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?charts');
  const tabs = page.getByRole('tablist', { name: '护士站工作区' });
  const overview = tabs.getByRole('tab', { name: '概览', exact: true });
  const tasks = tabs.getByRole('tab', { name: /^待办/ });
  const inspection = tabs.getByRole('tab', { name: '巡视', exact: true });
  await overview.waitFor();
  assert(JSON.stringify(await tabs.locator('.workspace-tabs__label').allTextContents()) === '["概览","待办","巡视"]', 'Wrong navigation order');
  assert(await overview.getAttribute('aria-selected') === 'true', 'Overview is not the initial view');
  await page.getByRole('meter', { name: '床位使用率' }).waitFor();
  const colors = {};
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    for (const width of [1440, 1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1100 });
      const bad = await tabs.evaluate(root => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll('button,span,svg')].filter(el => {
          if (!el.getClientRects().length) return false;
          const r = el.getBoundingClientRect();
          return r.left < bounds.left - 1 || r.right > bounds.right + 1 || el.scrollWidth > el.clientWidth + 1;
        }).map(el => el.className.baseVal ?? el.className);
      });
      assert(!bad.length, `${theme} ${width} navigation overflow: ${bad}`);
      const style = await overview.evaluate(el => { const css = getComputedStyle(el); return { direction:css.flexDirection, radius:css.borderRadius, color:css.color, background:css.backgroundColor, height:el.getBoundingClientRect().height }; });
      assert(style.direction === 'row' && style.radius === '10px' && style.height >= 50, `${theme}/${width}: segmented tab shape regressed ${JSON.stringify(style)}`);
      colors[theme] = await tabs.locator('.nurse-workspace-icon svg').first().evaluate(el => getComputedStyle(el).color);
      if (width === 1440 || width === 320) {
        await page.waitForFunction(() => getComputedStyle(document.querySelector('.overview-workspace')).opacity === '1');
        await page.locator('.nurse-panel').screenshot({ path: `output/playwright/nurse-overview-first-${theme}-${width}.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.mouse.move(0,0);
    const idle = await tasks.evaluate(el => getComputedStyle(el).backgroundColor);
    await tasks.hover();
    assert(await tasks.evaluate(el => getComputedStyle(el).backgroundColor) !== idle, `${theme}: tab hover missing`);
    await page.mouse.move(0,0);
    assert(await tasks.evaluate(el => getComputedStyle(el).backgroundColor) === idle, `${theme}: tab mouseout failed`);
    await page.keyboard.press('Tab');
    await overview.focus();
    assert(await overview.evaluate(el => getComputedStyle(el).outlineStyle) !== 'none', `${theme}: tab keyboard focus missing`);
    await page.keyboard.press('ArrowRight');
    assert(await tasks.getAttribute('aria-selected') === 'true', 'Right arrow must select tasks');
    assert(await page.locator('.station-charts').count() === 0, 'Charts should unmount when hidden');
    assert(await page.locator('.queue-categories .nurse-workspace-icon').count() === 3, 'Missing category icons');
    await page.locator('.nurse-panel').screenshot({ path: `output/playwright/nurse-navigation-tasks-${theme}.png` });
    await page.keyboard.press('End');
    assert(await inspection.getAttribute('aria-selected') === 'true', 'End must select inspection');
    await page.keyboard.press('Home');
    assert(await overview.getAttribute('aria-selected') === 'true', 'Home must select overview');
    await page.keyboard.press('ArrowLeft');
    assert(await inspection.getAttribute('aria-selected') === 'true', 'Left arrow should wrap to inspection');
    await page.keyboard.press('Home');
    await page.getByRole('button', { name: '查看事件队列' }).click();
    assert(await tasks.getAttribute('aria-selected') === 'true' && await tasks.evaluate(el => el === document.activeElement), 'Overview CTA should open and focus tasks');
    await overview.click();
    await page.getByRole('button', { name: '进入护士站大屏模式' }).click();
    assert(await tabs.count() === 0 && await page.locator('.station-charts').isVisible(), 'Wallboard overview regressed');
    await page.getByRole('button', { name: '退出护士站大屏模式' }).click();
  }
  assert(colors.dark !== colors.light, 'Icon theme did not switch');
  assert(!errors.length, `Browser errors: ${errors}`);
  return { passed: true, colors, checks: 'overview first/default, arrow/Home/End keys, chart CTA, unmount, wallboard, both themes and four widths' };
}
