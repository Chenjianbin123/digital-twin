async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.commandFixture.setPartial(true));
  for (const wallboard of [false, true]) {
    if (wallboard) await page.getByRole('button', { name: '进入护士站大屏模式' }).click();
    for (const [width, height, panelWidth] of [[2560,1300,600],[1920,1080,538],[1440,768,403],[1024,768,400],[768,1024,580],[320,640,304]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.fixture-panel').evaluate((el, size) => el.style.width = `${size}px`, panelWidth);
      await page.locator('.nurse-workspace').evaluate(el => { el.scrollTop = 0; });
      const result = await page.locator('.nurse-workspace').evaluate(root => {
        const frame = root.querySelector('.command-frame').getBoundingClientRect();
        const safe = { left: frame.left + frame.width * .07 + 8, right: frame.left + frame.width * .96 - 8, top: frame.top + frame.height * 34 / 1600 + 8 };
        const sections = [...root.querySelectorAll(':scope > .station-hero, :scope > .workspace-tabs, :scope > .workspace-scroll')].filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect());
        const top = root.querySelector('.station-hero .command-section-label').getBoundingClientRect().top;
        const overflow = [...root.querySelectorAll('.station-hero button, .station-hero__identity, .command-telemetry, .command-queue-heading')].filter(el => el.getClientRects().length).filter(el => { const b = el.getBoundingClientRect(); return b.left < safe.left || b.right > safe.right || el.scrollWidth > el.clientWidth + 1; }).map(el => el.className);
        return { safe, top, left: Math.min(...sections.map(b => b.left)), right: Math.max(...sections.map(b => b.right)), overflow };
      });
      assert(result.left >= result.safe.left && result.right <= result.safe.right && result.top >= result.safe.top && !result.overflow.length, `Nurse inner-frame violation at ${width}, wallboard=${wallboard}: ${JSON.stringify(result)}`);
      if (width === 2560 || width === 320) await page.locator('.fixture-panel').screenshot({ path: `output/playwright/nurse-safe-inset-${wallboard ? 'wallboard' : 'work'}-${width}.png` });
    }
  }
  return { passed: true, modes: ['work', 'wallboard'], widths: [2560,1920,1440,1024,768,320] };
}
