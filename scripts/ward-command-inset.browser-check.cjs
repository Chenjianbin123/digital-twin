async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const results = [];
  for (const scene of ['corridor', 'room']) {
    await page.evaluate(scene => window.wardSidebarFixture.setScene(scene), scene);
    for (const [width, height, panelWidth] of [[2560,1300,760],[1920,1080,576],[1440,768,432],[1024,768,400],[768,1024,768],[320,640,320]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.fixture-panel').evaluate((el, size) => el.style.width = `${size}px`, panelWidth);
      await page.locator('.ward-command-workspace').evaluate(el => { el.scrollTop = 0; });
      const measured = await page.locator('.ward-command-workspace').evaluate(root => {
        const frame = root.querySelector('.command-frame').getBoundingClientRect();
        // Inner SVG rails are x=70/960, top=34 and bottom=1560 in its 1000x1600 viewBox.
        const safe = { left: frame.left + frame.width * .07 + 8, right: frame.left + frame.width * .96 - 8, top: frame.top + frame.height * 34 / 1600 + 8, bottom: frame.top + frame.height * 1560 / 1600 - 8 };
        const hero = root.querySelector('.ward-command-hero').getBoundingClientRect();
        const content = root.querySelector('.ward-command-content').getBoundingClientRect();
        const eyebrow = root.querySelector('.ward-command-eyebrow').getBoundingClientRect();
        return { safe, left: Math.min(hero.left,content.left), right: Math.max(hero.right,content.right), top: eyebrow.top, bottom: content.bottom, scrollable: getComputedStyle(root).overflowY === 'auto' };
      });
      assert(measured.left >= measured.safe.left && measured.right <= measured.safe.right && measured.top >= measured.safe.top, `${scene} content crosses inner frame at ${width}: ${JSON.stringify(measured)}`);
      if (!measured.scrollable) assert(measured.bottom <= measured.safe.bottom, `${scene} content touches bottom frame`);
      results.push({ scene, width, height });
      if (width === 2560 || width === 320) await page.locator('.fixture-panel').screenshot({ path: `output/playwright/${scene}-safe-inset-${width}.png` });
    }
  }
  return { passed: true, results };
}
