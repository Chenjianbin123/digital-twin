async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [2560, 1920, 1440, 1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.locator('.fixture-panel').evaluate((el, width) => el.style.width = width >= 1024 ? `${Math.min(600, Math.max(400, width * .28))}px` : '100%', width);
      const info = await page.locator('.nurse-workspace').evaluate(root => {
        const frame = root.querySelector('.command-frame');
        const style = getComputedStyle(frame);
        const r = root.getBoundingClientRect(), f = frame.getBoundingClientRect();
        return { display: style.display, pointer: style.pointerEvents, paper: style.getPropertyValue('--frame-paper').trim(), overflow: root.scrollWidth > root.clientWidth + 1,
          rootRect: r.toJSON(), frameRect: f.toJSON(), aligned: Math.abs(r.width - f.width) < 2 && Math.abs(r.height - f.height) < 2,
          contentOverflow: [...root.querySelectorAll('.station-hero,.workspace-tabs,.workspace-scroll')].some(el => el.scrollWidth > el.clientWidth + 1) };
      });
      assert(info.display === 'block' && info.pointer === 'none' && info.aligned, `Frame missing/misaligned ${theme}/${width}: ${JSON.stringify(info)}`);
      assert(!info.overflow && !info.contentOverflow, `Overflow ${theme}/${width}`);
      assert(info.paper === (theme === 'light' ? '#f6fbff' : '#0d2235'), `Wrong theme ${theme}`);
      await page.getByRole('tab', { name: /待办/ }).click();
      await page.getByRole('tab', { name: '概览', exact: true }).click();
      if ([2560, 320].includes(width)) await page.locator('.nurse-workspace').screenshot({ path: `output/playwright/tech-frame-${theme}-${width}.png` });
      results.push({ theme, width, ...info });
    }
  }
  assert(!errors.length, errors.join(';'));
  return { passed: true, cases: results.length, results };
}
