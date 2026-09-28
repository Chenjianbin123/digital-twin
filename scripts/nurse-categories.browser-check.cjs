async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const origin = 'http://127.0.0.1:5173';
  const stylesheet = await page.request.get(`${origin}/src/styles/dashboard-theme.scss`);
  const css = await stylesheet.text();
  assert(stylesheet.ok() && !css.includes("Can't find stylesheet to import") && css.includes('--category-surface'), 'Original dev server failed to compile category theme');
  await page.goto(`${origin}/scripts/fixtures/nurse-light-command.html?charts`);
  await page.getByRole('tablist', { name: '护士站工作区' }).getByRole('tab', { name: /^待办/ }).click();
  const cards = page.locator('.queue-categories button');
  await cards.first().waitFor();
  assert(JSON.stringify(await cards.locator('strong').allTextContents()) === '["6","4","2"]', 'Wrong initial counts');
  const results = [];
  const luminance = color => {
    const channels = color.match(/\d+/g).slice(0, 3).map(Number).map(value => {
      const c = value / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    for (const width of [1440, 1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.waitForFunction(value => document.querySelector('main').dataset.theme === value, theme);
      await page.waitForFunction(value => getComputedStyle(document.querySelector('.queue-categories button')).backgroundColor === value, theme === 'dark' ? 'rgb(16, 43, 64)' : 'rgb(241, 249, 255)');
      const style = await page.locator('.queue-categories').evaluate(root => {
        const outer = root.getBoundingClientRect();
        const button = root.querySelector('button');
        const label = button.querySelector('span:not(.nurse-workspace-icon)');
        const number = button.querySelector('strong');
        const bad = [...root.querySelectorAll('button,span,strong,svg')].filter(el => {
          const rect = el.getBoundingClientRect();
          return rect.left < outer.left - 1 || rect.right > outer.right + 1 || el.scrollWidth > el.clientWidth + 1;
        }).map(el => el.tagName);
        return { bad, background: getComputedStyle(button).backgroundColor, label: getComputedStyle(label).color, number: getComputedStyle(number).color };
      });
      assert(!style.bad.length, `${theme} ${width} overflow: ${style.bad}`);
      assert(style.background === (theme === 'dark' ? 'rgb(16, 43, 64)' : 'rgb(241, 249, 255)'), `Wrong background: ${JSON.stringify(style)}`);
      assert(style.number === (theme === 'dark' ? 'rgb(237, 247, 255)' : 'rgb(10, 53, 101)'), `Wrong number: ${JSON.stringify(style)}`);
      assert(contrast(style.label, style.background) >= 4.5 && contrast(style.number, style.background) >= 4.5, `${theme} text contrast failed`);
      await page.locator('.queue-categories').screenshot({ path: `output/playwright/nurse-categories-${theme}-${width}.png` });
      results.push({ theme, width, ...style });
    }
    await page.setViewportSize({ width: 1440, height: 1080 });
    await cards.nth(1).click();
    assert(await cards.nth(1).getAttribute('aria-pressed') === 'true', 'Selection missing');
    await page.waitForFunction(value => getComputedStyle(document.querySelectorAll('.queue-categories button')[1]).backgroundColor === value, theme === 'dark' ? 'rgb(25, 70, 95)' : 'rgb(223, 242, 255)');
    assert(await page.locator('.alert-task-panel--command-queue .alert-task').count() === 4, 'Infusion filter broken');
    const selected = await cards.nth(1).evaluate(el => ({ background: getComputedStyle(el).backgroundColor, shadow: getComputedStyle(el).boxShadow }));
    assert(selected.background === (theme === 'dark' ? 'rgb(25, 70, 95)' : 'rgb(223, 242, 255)'), `Wrong selected background: ${JSON.stringify(selected)}`);
    assert(selected.shadow.includes('inset'), 'Selected underline missing');
    await cards.nth(1).focus();
    await page.keyboard.press('Enter');
    assert(await cards.nth(1).getAttribute('aria-pressed') === 'false', 'Keyboard toggle broken');
    await page.mouse.move(0, 0);
    await cards.nth(1).evaluate(el => el.blur());
    await page.locator('.nurse-panel').screenshot({ path: `output/playwright/nurse-categories-panel-${theme}.png` });
  }
  await page.evaluate(() => window.commandFixture.setHandled(true));
  await page.waitForFunction(() => document.querySelector('.queue-categories strong').textContent === '5');
  await page.evaluate(() => window.commandFixture.setEmpty(true));
  await page.waitForFunction(() => [...document.querySelectorAll('.queue-categories strong')].every(el => el.textContent === '0'));
  await cards.first().click();
  assert(await page.locator('.alert-task-panel__empty').isVisible(), 'Empty filter state missing');
  await page.evaluate(() => { window.commandFixture.setEmpty(false); window.commandFixture.setHandled(false); window.commandFixture.setTheme('dark'); });
  await cards.first().click();
  assert(!errors.length, `Page errors: ${errors}`);
  return { passed: true, results, checks: 'theme colors, responsive bounds, selected state, filter, keyboard toggle, handling count, zero counts' };
}
