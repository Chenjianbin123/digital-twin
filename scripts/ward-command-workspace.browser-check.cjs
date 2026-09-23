async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html?integrated');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const scene of ['corridor', 'room', 'station']) {
    await page.evaluate(scene => window.wardSidebarFixture.setScene(scene), scene);
    const frame = page.locator(scene === 'station' ? '.nurse-workspace > .command-frame' : '.ward-command-workspace > .command-frame');
    await frame.waitFor();
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60000 });
    if (scene === 'room') {
      const taskColor = await page.locator('.task-card__meta span').first().evaluate(el => getComputedStyle(el).color);
      assert(taskColor === 'rgb(68, 103, 142)', `Room task text has dark-mode colors: ${taskColor}`);
    }
    for (const [width, height] of [[2560, 1300], [1920, 1080], [1440, 768], [1024, 768], [768, 1024], [320, 640]]) {
      await page.setViewportSize({ width, height });
      const geometry = await page.locator('.digital-twin__panel').evaluate(panel => {
        const root = panel.querySelector('.ward-command-workspace, .nurse-workspace');
        const frame = root.querySelector('.command-frame').getBoundingClientRect();
        const bounds = panel.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height, frameWidth: frame.width, frameHeight: frame.height, overflow: root.scrollWidth > root.clientWidth + 1 };
      });
      assert(geometry.frameWidth > geometry.width * .8 && geometry.frameHeight <= geometry.height + 2, `${scene} frame escapes panel: ${JSON.stringify(geometry)}`);
      assert(!geometry.overflow, `${scene} horizontal overflow at ${width}`);
      if (width >= 1024) {
        const expected = Math.max(400, Math.min(width * .28, 600));
        assert(Math.abs(geometry.width - expected) < 2, `${scene} sidebar width ${geometry.width}, expected ${expected}`);
      } else {
        assert(Math.abs(geometry.width - width) < 2, `${scene} mobile panel is not full width`);
      }
      if (scene !== 'station' && width >= 1024) {
        const contentHeight = await page.locator('.ward-command-content').evaluate(el => el.clientHeight);
        assert(contentHeight >= height * .5, `${scene} fixed header takes too much height: content ${contentHeight}`);
      }
      if (scene !== 'station' && width === 320) {
        const reachable = await page.locator('.ward-command-workspace').evaluate(el => getComputedStyle(el).overflowY === 'auto' && el.scrollHeight > el.clientHeight);
        assert(reachable, `${scene} short mobile panel cannot scroll`);
      }
      await page.locator('.digital-twin__panel').screenshot({ path: `output/playwright/${scene}-command-workspace-${width}.png` });
    }
    if (scene !== 'station') {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.evaluate(() => window.wardSidebarFixture.setTheme('dark'));
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.ward-command-hero')).display === 'none');
      assert(!await frame.isVisible(), `${scene} frame leaked into dark`);
      const darkWidth = await page.locator('.digital-twin__panel').evaluate(el => el.getBoundingClientRect().width);
      assert(Math.abs(darkWidth - 537.6) < 2, `${scene} dark width differs from nurse station: ${darkWidth}`);
      await page.evaluate(() => window.wardSidebarFixture.setTheme('light'));
    }
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole('button', { name: '进入护士站大屏模式' }).click();
  await page.waitForFunction(() => document.querySelector('.digital-twin__main--wallboard'));
  const wallboardWidth = await page.locator('.digital-twin__panel').evaluate(el => el.getBoundingClientRect().width);
  assert(Math.abs(wallboardWidth - 441.6) < 2, `Wallboard width changed: ${wallboardWidth}`);
  await page.getByRole('button', { name: '退出护士站大屏模式' }).click();
  assert(!errors.length, errors.join('; '));
  return { passed: true, scenes: ['corridor', 'room', 'station'], errors };
}
