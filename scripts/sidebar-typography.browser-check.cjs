async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&integrated');
  await page.locator('.nurse-workspace').waitFor();
  const results = [];
  const selectors = {
    title: '.station-hero__eyebrow,.ward-command-identity h2',
    label: '.env-card > span,.hospital-intro__metric-label,.stat-chip__label',
    metric: '.env-card > strong,.hospital-intro__metric-value,.stat-chip__val',
    role: '.clinical-staff span,.staff-role-card__badge',
    name: '.clinical-staff strong,.staff-role-card__name',
    event: '.alert-task__head strong',
    body: '.alert-task__subtitle,.alert-task__main > p',
    caption: '.alert-task__time,.ward-call-list p',
  };
  for (const scene of ['nurse-station', 'ward', 'ward-interior']) {
    await page.evaluate(async scene => {
      const { useTwinStore } = await import('/src/stores/twin-store.ts');
      const store = useTwinStore();
      for (const room of store.area.rooms) for (const bed of room.beds) bed.deviceCode ??= '';
      if (scene === 'ward-interior') store.enterRoom(0); else store.setSceneType(scene);
    }, scene);
    const root = page.locator(scene === 'nurse-station' ? '.nurse-workspace' : '.ward-command-workspace');
    await root.waitFor();
    if (scene === 'ward') {
      await page.locator('.hospital-intro__metric-label').first().waitFor();
      await page.locator('.room-card').first().waitFor();
    }
    if (scene === 'ward-interior') await page.locator('.ward-info-panel').waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
      for (const width of [1920, 1440, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 1080 });
        const info = await root.evaluate((root, selectors) => {
          const styles = {};
          for (const [key, selector] of Object.entries(selectors)) {
            const el = root.querySelector(selector);
            if (!el) continue;
            const s = getComputedStyle(el);
            styles[key] = { size: parseFloat(s.fontSize), weight: s.fontWeight, line: s.lineHeight };
          }
          const boxes = [...root.querySelectorAll('.env-card,.stat-chip,.staff-role-card,.clinical-staff li,.alert-task,.room-card,.ward-bed-nav')];
          const overflow = boxes.filter(el => el.checkVisibility() && el.scrollWidth > el.clientWidth + 2).map(el => el.className);
          const scroll = root.querySelector('.workspace-scroll,.ward-command-content');
          scroll.scrollTop = scroll.scrollHeight;
          const scrollable = scroll.scrollHeight <= scroll.clientHeight || scroll.scrollTop > 0;
          scroll.scrollTop = 0;
          return { styles, overflow, contentHeight: scroll.clientHeight, panelHeight: root.clientHeight, scrollable, rootOverflow: root.scrollWidth > root.clientWidth + 2 };
        }, selectors);
        const expected = { title: width < 1024 ? 24 : Math.max(22, Math.min(34, 4 + width * .0125)), label: 14,
          metric: width >= 1600 ? 28 : 26, role: 15, name: width >= 1600 ? 20 : 18,
          event: Math.max(18, Math.min(20, 14 + width * .0025)), body: Math.max(16, Math.min(18, 12 + width * .0025)),
          caption: Math.max(14, Math.min(16, 10 + width * .0025)) };
        for (const [key, actual] of Object.entries(info.styles)) assert(Math.abs(actual.size - expected[key]) < .02, `${scene}/${theme}/${width} ${key}: ${JSON.stringify(actual)} expected ${expected[key]}`);
        for (const key of ['title', 'label', 'metric', 'role', 'name']) assert(info.styles[key], `${scene}: missing ${key} test coverage`);
        assert(!info.rootOverflow && !info.overflow.length, `${scene}/${theme}/${width} overflow: ${info.overflow}`);
        assert(info.contentHeight >= 100 && info.contentHeight < info.panelHeight && info.scrollable, `${scene}/${theme}/${width}: content inaccessible ${JSON.stringify(info)}`);
        const light = results.find(r => r.scene === scene && r.width === width && r.theme === 'light');
        if (theme === 'dark') assert(JSON.stringify(info.styles) === JSON.stringify(light.styles), `${scene}/${width}: theme changes typography ${JSON.stringify(info.styles)} vs ${JSON.stringify(light.styles)}`);
        if ([1920, 320].includes(width)) {
          await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
          await page.locator('.digital-twin__panel').screenshot({ path: `output/playwright/shared-type-${scene}-${theme}-${width}.png` });
        }
        results.push({ scene, theme, width, ...info });
      }
      // Global configuration must reach each scene, not just look equal by coincidence.
      await page.evaluate(() => document.querySelector('.digital-twin').style.setProperty('--sidebar-font-name', '23px'));
      assert(await root.locator(selectors.name).first().evaluate(el => getComputedStyle(el).fontSize === '23px'), `${scene}: global token overridden`);
      await page.evaluate(() => document.querySelector('.digital-twin').style.removeProperty('--sidebar-font-name'));
    }
  }
  assert(!errors.length, errors.join(';'));
  return { passed: true, cases: results.length, results };
}
