async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&integrated');
  await page.locator('.nurse-workspace').waitFor();
  const results = [];
  for (const scene of ['nurse-station', 'ward', 'ward-interior']) {
    await page.evaluate(async scene => {
      const { useTwinStore } = await import('/src/stores/twin-store.ts');
      const store = useTwinStore();
      // The original chart fixture omits device bindings; model explicitly unbound beds.
      for (const room of store.area.rooms) for (const bed of room.beds) bed.deviceCode ??= '';
      if (scene === 'ward-interior') store.enterRoom(0); else store.setSceneType(scene);
    }, scene);
    const workspace = page.locator(scene === 'nurse-station' ? '.nurse-workspace' : '.ward-command-workspace');
    await workspace.waitFor();
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
      for (const width of [1920, 1024, 768, 320]) {
        await page.setViewportSize({ width, height: 1080 });
        const info = await workspace.evaluate(el => {
          const frame = el.querySelector('.command-frame');
          const f = frame.getBoundingClientRect(), r = el.getBoundingClientRect();
          const scroll = el.querySelector('.workspace-scroll,.ward-command-content');
          scroll.scrollTop = scroll.scrollHeight;
          return { visible: getComputedStyle(frame).display === 'block', aligned: Math.abs(f.width-r.width)<2 && Math.abs(f.height-r.height)<2,
            overflow: el.scrollWidth>el.clientWidth+1, scrollable: scroll.scrollHeight<=scroll.clientHeight || scroll.scrollTop>0,
            panelWidth:r.width, pointer:getComputedStyle(frame).pointerEvents };
        });
        assert(info.visible && info.aligned && !info.overflow && info.scrollable && info.pointer==='none', `${scene}/${theme}/${width}: ${JSON.stringify(info)}`);
        await workspace.locator('.workspace-scroll,.ward-command-content').evaluate(el => el.scrollTop = 0);
        if (width===1920) await page.locator('.digital-twin__panel').screenshot({ path:`output/playwright/tech-frame-integrated-${scene}-${theme}.png` });
        results.push({ scene, theme, width, ...info });
      }
    }
  }
  assert(!errors.length, errors.join(';'));
  return { passed:true, cases:results.length, results };
}
