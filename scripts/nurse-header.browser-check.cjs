async page => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [], failures = [], cases = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html');
  const head = page.locator('.station-hero__overview-head');
  await head.waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    for (const width of [320, 375, 440, 441, 456, 457, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1100 });
      for (const wallboard of [false, true]) {
        const toggle = head.getByRole('button', { name: wallboard ? '退出护士站大屏模式' : '进入护士站大屏模式', exact: true });
        await toggle.waitFor();
        const layout = await head.evaluate(root => {
          const title = root.querySelector('.station-hero__eyebrow');
          const wordmark = root.querySelector('.station-hero__wordmark');
          const button = root.querySelector('.station-hero__wallboard-toggle');
          const range = document.createRange(); range.selectNodeContents(title);
          const text = range.getBoundingClientRect(), box = wordmark.getBoundingClientRect();
          const action = button.getBoundingClientRect(), heading = root.getBoundingClientRect();
          const panel = root.closest('.nurse-panel'), panelStyle = getComputedStyle(panel);
          const containerWidth = panel.getBoundingClientRect().width
            - ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth'].reduce((sum, key) => sum + parseFloat(panelStyle[key]), 0);
          const within = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
          return {
            complete: within(text, box) && within(text, heading),
            overlap: text.left < action.right && text.right > action.left && text.top < action.bottom && text.bottom > action.top,
            buttonFits: within(action, heading) && button.scrollWidth <= button.clientWidth + 1,
            containerWidth,
            titleFont: getComputedStyle(title).fontSize,
            stacked: action.top >= box.bottom - 1,
            textWidth: Math.round(text.width), availableWidth: Math.round(box.width),
          };
        });
        const result = { theme, width, wallboard, ...layout };
        cases.push(result);
        if (!layout.complete || layout.overlap || !layout.buttonFits || parseFloat(layout.titleFont) < 22
          || (layout.containerWidth <= 440 && !layout.stacked)
          || (layout.containerWidth > 440 && layout.stacked)) failures.push(result);
        if ([320, 1440].includes(width)) {
          await head.screenshot({ path: `output/playwright/nurse-header-${theme}-${width}-${wallboard ? 'display' : 'work'}.png` });
          if (width === 320 && !wallboard) {
            await page.locator('.station-hero').evaluate(el => { el.scrollTop = 0; });
            await page.screenshot({ path: `output/playwright/nurse-sidebar-${theme}-320.png` });
          }
        }
        await toggle.focus();
        assert(await toggle.evaluate(el => el === document.activeElement), 'header toggle cannot receive keyboard focus');
        await page.keyboard.press('Enter');
        await head.locator(`.station-hero__wallboard-toggle[aria-pressed="${!wallboard}"]`).waitFor();
      }
    }
  }
  assert(errors.length === 0, errors.join(';'));
  if (failures.length) await page.evaluate(items => console.error('Header layout failures: ' + JSON.stringify(items)), failures);
  assert(failures.length === 0, `header layout regression: ${JSON.stringify(failures)}`);
  await page.emulateMedia({ reducedMotion: null });
  return { passed: true, cases, keyboardToggle: true, errors };
}
