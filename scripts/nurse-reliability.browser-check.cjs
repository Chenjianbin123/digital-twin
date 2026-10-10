async page => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = await page.evaluate(() => location.origin);
  await page.goto(`${origin}/scripts/fixtures/nurse-light-command.html?clinical`);
  await page.locator('.nurse-panel').waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1920, 1440, 1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.locator('.fixture-panel').evaluate((el, width) => el.style.width = width >= 1024 ? `${Math.min(600, Math.max(400, width * .28))}px` : '100%', width);
      await page.evaluate(() => { const f = window.commandFixture; f.setEmpty(false); f.setClinicalSync('ready'); f.setSyncTimestamp(new Date().toISOString()); f.setHandled(false); });
      await page.getByRole('tab', { name: '待办', exact: true }).click();
      const wait = page.locator('.queue-wait').first();
      check(await wait.isVisible(), `${theme}/${width}: waiting time hidden`);
      const overflow = await page.locator('.tasks-workspace').evaluate(root => [...root.querySelectorAll('.alert-task,.alert-task__main,.alert-task__actions,.queue-wait')].filter(el => el.checkVisibility() && el.scrollWidth > el.clientWidth + 2).map(el => el.className));
      check(!overflow.length, `${theme}/${width}: overflow ${overflow}`);
      const confirm = page.getByRole('button', { name: '本机确认', exact: true }).first();
      check(await confirm.isVisible(), `${theme}/${width}: acknowledgement inaccessible`);
      await confirm.click();
      check(await page.evaluate(() => window.commandFixture.events.some(e => e[0] === 'acknowledge')), 'confirmation event missing');
      await page.evaluate(() => window.commandFixture.setHandled(true));
      await page.getByRole('tab', { name: /^全部/ }).click();
      check((await page.locator('.alert-task__meta').allTextContents()).some(text => text.includes('本机已确认')), 'local acknowledgement mislabeled');
      if (width === 1920 || width === 320) await page.locator('.alert-task-panel').screenshot({ path: `output/playwright/reliability-${theme}-${width}-queue.png` });
      await page.evaluate(() => { window.commandFixture.setEmpty(true); window.commandFixture.setSyncTimestamp(null); });
      for (const phase of ['loading', 'error', 'partial']) {
        await page.evaluate(phase => window.commandFixture.setClinicalSync(phase), phase);
        const empty = await page.locator('.alert-task-panel__empty').innerText();
        check(!empty.includes('暂无待处理告警') && empty.includes('暂不能据此判断无告警'), `${phase}: misleading empty state`);
        check((await page.locator('.alert-task-panel__filters').innerText()).includes('--'), 'unknown counts became zero');
      }
      await page.getByRole('tab', { name: '概览', exact: true }).click();
      check((await page.locator('.surface-panel--response .env-card > strong').allTextContents()).every(text => text === '--'), 'initial failure response became zero');
      await page.evaluate(() => { const f = window.commandFixture; f.setClinicalSync('ready'); f.setSyncTimestamp(new Date(Date.now() - 360000).toISOString()); });
      check((await page.locator('.surface-panel--response').innerText()).includes('指标数据已过期'), 'stale metrics shown current');
      check((await page.locator('.handoff-card').innerText()).includes('复核'), 'handoff claims fresh old data');
      await page.evaluate(() => { const f = window.commandFixture; f.setEmpty(false); f.setClinicalSync('error'); });
      await page.getByRole('tab', { name: '待办', exact: true }).click();
      check(await page.locator('.alert-task').count() > 0, 'last data removed on error');
      check((await page.locator('.alert-task-panel__notice').innerText()).includes('保留已获取'), 'retained data not labeled');
      if (width === 1920) await page.locator('.alert-task-panel').screenshot({ path: `output/playwright/reliability-${theme}-failure.png` });
      results.push({ theme, width, waiting: true, stateChecks: true });
    }
  }
  await page.evaluate(() => { const f = window.commandFixture; f.setClinicalSync('ready'); f.setSyncTimestamp(new Date().toISOString()); f.setEmpty(true); });
  check((await page.locator('.alert-task-panel__empty').innerText()).includes('当前已获取数据'), 'successful empty not distinguished');
  await page.getByRole('tab', { name: '概览', exact: true }).click();
  await page.evaluate(() => window.commandFixture.setChartMetrics({ deviceOnline: 2, deviceTotal: 21, deviceHealthRate: 10, offlineDeviceCount: 0, lowBatteryDeviceCount: 0 }));
  check(!(await page.locator('.surface-panel--env').innerText()).includes('设备链路正常'), 'incomplete devices declared healthy');
  check(await page.getByRole('heading', { name: '病区负责人', exact: true }).count() === 1, 'staff misrepresented as roster');
  check(!errors.length, `browser errors ${errors}`);
  return { passed: true, cases: results.length, results, errors };
}
