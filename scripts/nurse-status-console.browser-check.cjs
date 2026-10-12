async page => {
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440, 1024, 768, 320, 2560]) {
      await page.setViewportSize({ width, height: 720 });
      await page.locator('.fixture-panel').evaluate((el, width) => el.style.width = width === 1440 ? '560px' : '100%', width);
      const root = page.locator('.nurse-status-console');
      const background = await root.evaluate(el => getComputedStyle(el).getPropertyValue('--nsc-bg').trim());
      check(background === (theme === 'light' ? '#edf5fc' : '#142936'), 'wrong theme background');
      check((await root.innerText()).includes('有患者呼叫，待处理'), 'call wording missing');
      const collapse = root.locator('.nsc-collapse');
      await collapse.click();
      check(await collapse.getAttribute('aria-expanded') === 'false', 'panel collapse failed');
      check(!await root.locator('.nsc-disclosure').first().isVisible(), 'collapsed content still visible');
      check((await root.innerText()).includes('提醒') && (await root.innerText()).includes('数据：'), 'compact status missing');
      check(!await root.evaluate(el => el.scrollWidth > el.clientWidth + 1), 'collapsed panel overflow');
      await root.screenshot({ path: `output/playwright/status-console-${theme}-${width}-collapsed.png` });
      await collapse.focus();
      await page.keyboard.press('Enter');
      check(await collapse.getAttribute('aria-expanded') === 'true', 'keyboard expand failed');
      const summaries = root.locator('summary');
      for (let i = 0; i < 2; i++) {
        if (!await root.locator('details').nth(i).evaluate(el => el.open)) await summaries.nth(i).click();
      }
      check(await root.locator('.nsc-sources li').count() === 4, 'source details missing');
      const typography = await root.evaluate(el => {
        const size = selector => getComputedStyle(el.querySelector(selector)).fontSize;
        const panel = el.closest('.nurse-panel');
        return {
          heading: size('.nsc-event strong'), body: size('.nsc-event p'), caption: size('.nsc-sources small'),
          peerHeading: getComputedStyle(panel.querySelector('.alert-task__head strong')).fontSize,
          peerBody: getComputedStyle(panel.querySelector('.alert-task__subtitle')).fontSize,
          peerCaption: getComputedStyle(panel.querySelector('.alert-task__time')).fontSize,
        };
      });
      check(typography.heading === typography.peerHeading && typography.body === typography.peerBody && typography.caption === typography.peerCaption, `typography mismatch: ${JSON.stringify(typography)}`);
      const before = await root.innerText();
      check(before.includes('最近成功同步') && before.includes('关闭不影响呼叫接收'), 'required information missing');
      const overflow = await root.evaluate(el => el.scrollWidth > el.clientWidth + 1);
      check(!overflow, `${theme}/${width} overflow`);
      await summaries.first().focus();
      await page.keyboard.press('Enter');
      check(!await root.locator('details').first().evaluate(el => el.open), 'keyboard collapse failed');
      await page.keyboard.press('Enter');
      await root.getByRole('button', { name: '检查授权', exact: true }).scrollIntoViewIfNeeded();
      check(await root.evaluate(el => el.clientHeight <= innerHeight * .6 + 2), 'expanded status exceeds viewport budget');
      await root.evaluate(el => el.scrollTop = 0);
      await root.screenshot({ path: `output/playwright/status-console-${theme}-${width}.png` });
      await root.locator('details').evaluateAll(items => items.forEach(el => el.open = false));
      await root.screenshot({ path: `output/playwright/status-console-${theme}-${width}-compact.png` });
      results.push({ theme, width, text: before });
    }
  }
  for (let i = 0; i < 5; i++) check(results[i].text === results[i + 5].text, 'theme changes information');
  const serviceResult = await page.evaluate(async () => {
    const service = await import('/src/services/swp-call-notifier.ts');
    const audio = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    const notification = Object.getOwnPropertyDescriptor(window, 'Notification');
    try {
      Object.defineProperty(window, 'AudioContext', { configurable: true, value: class { constructor() { throw new Error('test blocked audio'); } } });
      Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'denied' } });
      await service.enableSwpCallAlerts();
      const failure = { ...service.callReminderFeedback };
      service.disableSwpCallAlerts();
      Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'default', requestPermission: async () => { throw new Error('test denied'); } } });
      await service.requestCallNotificationPermission();
      return { failure, permission: service.callReminderFeedback.notification, enabled: service.loadSwpCallAlertsEnabled() };
    } finally {
      if (audio) Object.defineProperty(window, 'AudioContext', audio); else delete window.AudioContext;
      if (notification) Object.defineProperty(window, 'Notification', notification); else delete window.Notification;
      service.refreshCallNotificationPermission();
    }
  });
  check(serviceResult.failure.sound.includes('失败') && serviceResult.failure.notification.includes('已阻止'), 'channel errors hidden');
  check(!serviceResult.failure.busy && !serviceResult.enabled && serviceResult.permission.includes('授权失败'), 'failure blocks controls');
  check(!errors.length, JSON.stringify(errors));
  await page.evaluate(result => window.statusConsoleResult = result, { passed: true, layouts: results.length, serviceResult });
}
