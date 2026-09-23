async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const color = (selector, property = 'color') => page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el)[prop], property);
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const scene of ['corridor', 'room']) {
    await page.evaluate(scene => window.wardSidebarFixture.setScene(scene), scene);
    await page.locator(scene === 'corridor' ? '.area-dashboard' : '.ward-info-panel').waitFor();
    assert(await color('.digital-twin__panel', 'backgroundColor') === 'rgb(245, 251, 255)', `${scene}: sidebar surface`);
    assert(await page.locator('.ward-command-workspace > .command-frame').isVisible(), `${scene}: shared command frame`);
    assert(await page.locator('.ward-command-hero').isVisible(), `${scene}: command header`);
    if (scene === 'corridor') assert(await color('.alert-task__main', 'backgroundColor') === 'rgb(255, 255, 255)', 'Timeline card surface');
    assert(await color(scene === 'corridor' ? '.room-card__name' : '.ward-info-panel__header h2') === 'rgb(6, 51, 101)', `${scene}: heading color`);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      const overflow = await page.locator('.fixture-panel').evaluate(root => {
        const bounds = root.getBoundingClientRect();
        return [...root.querySelectorAll('button, select, .room-card, .alert-task, .patient-info, .env-item, .vitals-card')]
          .filter(el => el.getClientRects().length)
          .filter(el => { const rect = el.getBoundingClientRect(); return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || el.scrollWidth > el.clientWidth + 1; })
          .map(el => el.className);
      });
      assert(!overflow.length, `${scene} overflow at ${width}: ${overflow.join(', ')}`);
      if (width === 320 || width === 1440) await page.locator('.fixture-panel').screenshot({ path: `output/playwright/${scene}-sidebar-light-${width}.png` });
    }
    if (scene === 'corridor') {
      const intro = page.locator('.hospital-intro__note');
      const collapsedHeight = await intro.evaluate(el => el.clientHeight);
      await page.getByRole('button', { name: '展开完整介绍' }).click();
      assert(await intro.evaluate(el => el.scrollHeight <= el.clientHeight + 1), 'Expanded hospital intro is clipped');
      assert(await intro.evaluate(el => el.clientHeight) > collapsedHeight, 'Hospital intro did not expand');
      await page.getByRole('button', { name: '收起介绍' }).click();
      const filters = page.getByRole('tablist', { name: '告警任务筛选' });
      await filters.getByRole('tab').first().focus();
      await page.keyboard.press('ArrowRight');
      assert(await page.locator('.alert-task-panel__empty').isVisible(), 'Handling empty state');
      await page.keyboard.press('ArrowRight');
      await page.getByRole('button', { name: '查看更多事件' }).click();
      assert(await page.locator('.alert-task').count() === 6, 'Expand tasks');
      await page.locator('.alert-task').first().getByRole('button', { name: '定位床位' }).click();
      await page.locator('.alert-task').first().getByRole('button', { name: '确认响应' }).click();
      await page.locator('.room-card__enter').first().click();
      assert(await page.evaluate(() => ['locate', 'ack', 'enter'].every(name => window.wardSidebarFixture.events.some(event => event[0] === name))), 'Corridor action emits');
      await page.locator('.room-card').first().screenshot({ path: 'output/playwright/corridor-sidebar-room-card.png' });
    } else {
      assert(await color('.vitals-card h4') === 'rgb(6, 51, 101)', 'Vitals title contrast');
      await page.getByRole('button', { name: '下一床' }).click();
      assert(await page.locator('#ward-bed-picker').inputValue() === 'TEST-0-1', 'Next bed identity');
      await page.locator('#ward-bed-picker').selectOption('TEST-0-2');
      assert(!await page.locator('.ward-care-summary').count(), 'Empty bed must not show patient data');
      await page.getByRole('button', { name: '上一床' }).click();
      await page.locator('.bed-detail-section--patient summary').click();
      assert(await page.locator('.bed-detail-section--patient').getAttribute('open') !== null, 'Patient archive expansion');
      await page.getByRole('button', { name: '关闭患者详情' }).click();
      assert(!await page.locator('.ward-info-panel__bed').count(), 'Close patient details');
      await page.locator('#ward-bed-picker').selectOption('TEST-0-0');
      assert(await color('.ward-info-panel__inspection--overdue .inspection-card__head strong') === 'rgb(181, 38, 72)', 'Inspection warning semantics');
      await page.locator('.ward-info-panel__bed').screenshot({ path: 'output/playwright/room-sidebar-patient-card.png' });
      await page.evaluate(() => window.wardSidebarFixture.setStale(true));
      assert(await page.locator('.ward-call-list [role="status"]').isVisible(), 'Failed sync notice');
    }
    await page.evaluate(() => window.wardSidebarFixture.setEmpty(true));
    assert(await page.locator(scene === 'corridor' ? '.alert-task-panel__empty' : '.ward-call-list').isVisible(), `${scene}: empty state`);
    await page.evaluate(() => { window.wardSidebarFixture.setEmpty(false); window.wardSidebarFixture.setTheme('dark'); });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.digital-twin__panel')).getPropertyValue('--room-ink').trim() === '#dcebf2');
    assert(!await page.locator('.ward-command-hero').isVisible(), `${scene}: command header must stay light-only`);
    assert(await color(scene === 'corridor' ? '.room-card__name' : '.ward-info-panel__header h2') !== 'rgb(6, 51, 101)', `${scene}: light color leaks into dark`);
    await page.evaluate(() => window.wardSidebarFixture.setTheme('light'));
  }
  assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  return { passed: true, widths: [320, 768, 1024, 1440], scenes: ['corridor', 'room'], errors };
}
