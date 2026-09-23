async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const url = 'http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html';
  await page.goto(url);
  await page.locator('.alert-task').first().waitFor();
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const stats = () => page.locator('.command-telemetry dd').allTextContents();
  assert(JSON.stringify(await stats()) === JSON.stringify(['12项', '0项']), 'Initial statistics mismatch');
  assert(await page.locator('.alert-task').count() === 8, 'Initial task limit changed');
  assert(await page.locator('.alert-task').first().evaluate(el => getComputedStyle(el, '::before').transform) === 'none', 'Legacy call-ring transform displaced timeline');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflow = await page.locator('.nurse-workspace').evaluate(panel => {
      const bounds = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('button, summary, .alert-task__main, .task-timeline-time, .command-telemetry')]
        .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .filter(el => { const b = el.getBoundingClientRect(); return b.left < bounds.left - 1 || b.right > bounds.right + 1; })
        .map(el => el.className);
    });
    assert(!overflow.length, `Overflow at ${width}: ${overflow}`);
    const geometry = await page.locator('.alert-task').first().evaluate(el => {
      const time = el.querySelector('.task-timeline-time').getBoundingClientRect();
      const main = el.querySelector('.alert-task__main').getBoundingClientRect();
      return main.left >= time.right && main.width > time.width * 2;
    });
    assert(geometry, `Timeline columns squeezed at ${width}`);
    await page.screenshot({ path: `output/playwright/nurse-command-${width}.png` });
  }
  const moreButton = page.getByRole('button', { name: '查看更多事件' });
  await moreButton.focus();
  await page.screenshot({ path: 'output/playwright/nurse-command-footer-focus.png' });
  assert(await moreButton.evaluate(el => getComputedStyle(el).outlineOffset) === '-3px', 'Cut-corner footer focus is clipped');
  await moreButton.click();
  assert(await page.locator('.alert-task').count() === 12, 'Expand tasks failed');
  await page.getByRole('button', { name: '收起任务' }).click();
  await page.evaluate(() => window.commandFixture.setHandled(true));
  assert(JSON.stringify(await stats()) === JSON.stringify(['11项', '1项']), 'Statistics did not react to status change');
  const filters = page.getByRole('tablist', { name: '告警任务筛选' });
  await filters.getByRole('tab').nth(0).focus();
  await page.keyboard.press('ArrowRight');
  assert(await filters.getByRole('tab').nth(1).getAttribute('aria-selected') === 'true', 'Filter keyboard navigation failed');
  assert(await page.locator('.alert-task').count() === 1, 'Handling filter incorrect');
  assert((await page.locator('.alert-task').innerText()).includes('已响应'), 'Source-managed status changed');
  await page.keyboard.press('ArrowRight');
  const details = page.locator('.alert-task__details').first();
  await details.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert(await details.getAttribute('open') !== null, 'Keyboard details expansion failed');
  assert(await details.locator('small').isVisible(), 'Unmatched-location explanation missing');
  await page.evaluate(() => window.commandFixture.setTask(0, { canLocate: true, roomName: '合成病房', bedName: '01床', status: 'pending' }));
  await page.locator('.alert-task').first().getByRole('button', { name: '定位', exact: true }).click();
  await page.locator('.alert-task').first().getByRole('button', { name: '确认响应', exact: true }).click();
  assert((await page.evaluate(() => window.commandFixture.events)).length === 2, 'Task action emits changed');
  await page.evaluate(() => window.commandFixture.setTask(0, { source: 'test', type: 'env', title: '长标题边界'.repeat(16), startedAt: undefined }));
  for (const type of ['env', 'vital']) {
    await page.evaluate(type => window.commandFixture.setTask(0, { type }), type);
    const separation = await page.locator('.alert-task').first().evaluate(el => {
      const detail = el.querySelector('.alert-task__details');
      const meta = el.querySelector('.alert-task__meta');
      return detail.open && detail.getBoundingClientRect().top >= meta.getBoundingClientRect().bottom;
    });
    assert(separation, `Desktop ${type} details overlap status`);
  }
  await page.setViewportSize({ width: 320, height: 640 });
  assert(await page.locator('.alert-task').first().evaluate(el => getComputedStyle(el, '::before').transform) === 'none', 'Generic task timeline displaced');
  for (const type of ['env', 'vital']) {
    await page.evaluate(type => window.commandFixture.setTask(0, { type }), type);
    const overflow = await page.locator('.alert-task').first().evaluate(el => el.scrollWidth > el.clientWidth + 1);
    assert(!overflow, `Long ${type} task overflows narrow sidebar`);
    const handling = page.locator('.alert-task').first().getByRole('button', { name: '处理中', exact: true });
    await handling.scrollIntoViewIfNeeded();
    assert(await handling.isVisible(), 'Handling action inaccessible');
  }
  assert(await page.locator('.task-timeline-time').first().innerText() === '时间待同步', 'Missing timestamp fallback failed');
  await page.evaluate(() => window.commandFixture.setTask(0, { startedAt: '时间格式待核对' }));
  assert(await page.locator('.task-timeline-time').first().innerText() === '时间格式待核对', 'Unrecognized timestamp hidden');
  await page.evaluate(() => window.commandFixture.setEmpty(true));
  assert(await page.locator('.alert-task-panel__empty').isVisible(), 'Empty state missing');
  assert(JSON.stringify(await stats()) === JSON.stringify(['0项', '0项']), 'Empty counts incorrect');
  await page.getByRole('button', { name: '呼叫提醒，当前未开启' }).click();
  assert(await page.getByRole('button', { name: '呼叫提醒，当前已开启' }).getAttribute('aria-pressed') === 'true', 'Reminder toggle broken');
  const tabs = page.getByRole('tablist', { name: '护士站工作区' });
  await tabs.getByRole('tab', { name: '概览', exact: true }).click();
  assert(await page.locator('.overview-workspace').isVisible(), 'Overview unavailable');
  await tabs.getByRole('tab', { name: '巡视', exact: true }).click();
  assert(await page.locator('.inspection-workspace').isVisible(), 'Inspection unavailable');
  await page.getByRole('button', { name: '进入护士站大屏模式' }).click();
  assert(await page.locator('.overview-workspace').isVisible() && !await tabs.isVisible(), 'Wallboard regression');
  await page.getByRole('button', { name: '退出护士站大屏模式' }).click();
  await page.goto(url);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.commandFixture.setTheme('dark'));
  assert(!await page.locator('.command-telemetry').isVisible(), 'Light statistics leaked into dark theme');
  assert(!await page.locator('.command-frame').isVisible(), 'Light frame leaked into dark theme');
  assert(!await page.locator('.command-medical-mark').isVisible(), 'Light medical icon leaked into dark theme');
  assert(await page.getByRole('button', { name: '查看全部任务' }).isVisible(), 'Dark expansion label changed');
  assert(!await page.locator('.task-timeline-time').first().isVisible(), 'Light timeline leaked into dark theme');
  assert(await page.locator('.alert-task__time').first().isVisible(), 'Original dark timestamps hidden');
  await page.screenshot({ path: 'output/playwright/nurse-command-dark.png' });
  await page.evaluate(() => { window.commandFixture.setTheme('light'); window.commandFixture.setPartial(true); });
  assert(await page.locator('.command-frame').isVisible(), 'Reference frame missing');
  assert(await page.locator('.command-sync-label').innerText() === '部分同步', 'Sync label not driven by data');
  const statusColors = await page.locator('.workspace-status').evaluate(el => [getComputedStyle(el.querySelector('.command-state-label')).color, getComputedStyle(el.querySelector('.command-sync-label')).color]);
  assert(statusColors[0] !== statusColors[1], 'Urgency and synchronization colors conflated');
  const wallboardButton = page.getByRole('button', { name: '进入护士站大屏模式' });
  await wallboardButton.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  assert(await wallboardButton.evaluate(el => el.matches(':focus-visible')), 'Header focus is not keyboard-visible');
  assert(await wallboardButton.evaluate(el => getComputedStyle(el).outlineOffset) === '-3px', 'Header focus offset overridden by component CSS');
  await page.screenshot({ path: 'output/playwright/nurse-command-header-focus.png' });
  await page.locator('.workspace-scroll').evaluate(el => el.scrollTop = 0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.fixture-panel').screenshot({ path: 'output/playwright/nurse-command-final.png' });
  await page.goto(`${url}?integrated`);
  await page.locator('.alert-task__details summary').first().waitFor();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.locator('.alert-task__details summary').first().click();
  const mobile = await page.locator('.nurse-workspace').evaluate(el => ({ height: el.clientHeight, scrollHeight: el.scrollHeight, width: el.clientWidth, scrollWidth: el.scrollWidth }));
  assert(mobile.height < 400 && mobile.scrollHeight > mobile.height && mobile.scrollWidth <= mobile.width, 'Integrated mobile panel cannot scroll or overflows');
  await page.screenshot({ path: 'output/playwright/nurse-command-workspace-mobile.png' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.locator('.alert-task__details summary').first().click();
  await page.locator('.workspace-scroll').evaluate(el => el.scrollTop = 0);
  await page.locator('.nurse-workspace').evaluate(el => el.scrollTop = 0);
  await page.screenshot({ path: 'output/playwright/nurse-command-workspace.png' });
  assert(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  return { passed: true, widths: [320, 768, 1024, 1440], checks: ['reactive-counts', 'timeline-columns', 'task-limit', 'expand-collapse', 'keyboard-filter', 'keyboard-details', 'unmatched-location', 'locate-acknowledge', 'timestamp-fallback', 'empty', 'reminder', 'overview-inspection', 'wallboard', 'dark-isolation', 'reduced-motion'], errors };
}
