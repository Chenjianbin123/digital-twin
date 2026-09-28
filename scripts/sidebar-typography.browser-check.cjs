async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const results = [];
  for (const scene of ['station', 'corridor', 'room']) {
    await page.goto(`http://127.0.0.1:5173/scripts/fixtures/${scene === 'station' ? 'nurse-light-command.html?charts' : 'ward-sidebar-light.html'}`);
    await page.waitForFunction(() => window.commandFixture || window.wardSidebarFixture);
    if (scene === 'station') {
      await page.evaluate(() => { window.commandFixture.setPartial(true); window.commandFixture.setChartHealth('warning'); });
      await page.locator('.data-health > p').waitFor();
    }
    if (scene !== 'station') await page.evaluate(value => window.wardSidebarFixture.setScene(value), scene);
    await page.locator(scene === 'station' ? '.data-health' : scene === 'corridor' ? '.area-dashboard' : '.ward-info-panel').waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => (window.commandFixture || window.wardSidebarFixture).setTheme(value), theme);
      for (const width of [2560, 1440, 1024, 768, 320]) {
        await page.setViewportSize({width, height:1600});
        const measurements = await page.locator('.fixture-panel').evaluate((root, scene) => {
          const selectors = scene === 'station' ? {
            '.handoff-card li':16, '.data-health li > span':16,
            '.data-health li > strong':14, '.data-health li > small':14,
            '.data-health__freshness-item > span':16, '.data-health__freshness-item > small':14,
            '.data-health .station-section-title':18, '.data-health > p':14,
          } : scene === 'corridor' ? { '.hospital-intro__note':16, '.alert-task__main > p':16, '.alert-task__head strong':18, '.room-card__status':16 }
            : { '.patient-info dt':14, '.patient-info dd':16, '.vitals-card__note':14, '.ward-bed-nav select':16 };
          const fonts = Object.entries(selectors).map(([selector, min]) => {
            const el = root.querySelector(selector);
            return {selector, min, actual:el ? parseFloat(getComputedStyle(el).fontSize) : null};
          });
          const bounds = root.getBoundingClientRect();
          const selector = scene === 'station' ? '.handoff-card,.data-health,.data-health li,.data-health__freshness-item,.data-health li > span,.data-health li > strong,.data-health li > small,.data-health__freshness-item > span,.data-health__freshness-item > strong,.data-health__freshness-item > small' : 'button,select,.room-card,.alert-task,.patient-info,.env-item,.vitals-card,.ward-call-list,.staff-role-card,.status-history';
          const overflow = [...root.querySelectorAll(selector)].filter(el => el.getClientRects().length).filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.left < bounds.left-1 || rect.right > bounds.right+1 || el.scrollWidth>el.clientWidth+1;
          }).map(el => el.className || el.tagName);
          return {fonts,overflow};
        }, scene);
        assert(measurements.fonts.every(item => item.actual >= item.min), `${scene}/${theme}/${width} fonts: ${JSON.stringify(measurements.fonts)}`);
        assert(!measurements.overflow.length, `${scene}/${theme}/${width} overflow: ${measurements.overflow}`);
        if (scene === 'station' && [1440,320].includes(width)) {
          await page.locator('.data-health').screenshot({path:`output/playwright/sidebar-type-health-${theme}-${width}.png`});
          await page.locator('.handoff-card').screenshot({path:`output/playwright/sidebar-type-handoff-${theme}-${width}.png`});
        }
        results.push({scene,theme,width,...measurements});
      }
    }
  }
  assert(!errors.length, `Browser errors: ${errors}`);
  return {passed:true,results};
}
