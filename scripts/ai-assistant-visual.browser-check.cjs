async page => {
  await page.goto('http://127.0.0.1:5199/scripts/fixtures/ai-assistant-preview.html');
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: 'AI 助手', exact: true }).click();
  const panel = page.locator('#ai-assistant-panel');
  const cases = [];
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.assistantFixture.setTheme(value), theme);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const typography = await panel.evaluate(root => {
      const size = selector => getComputedStyle(root.querySelector(selector)).fontSize;
      return { body: getComputedStyle(root).fontSize, input: size('textarea'), action: size('.ai-assistant__shortcuts button'),
        caption: size('.ai-assistant__demo'), title: size('h2'), motion: getComputedStyle(root.querySelector('.ai-assistant__orbit-motion')).animationName };
    });
    if (parseFloat(typography.body) < 16 || typography.input !== typography.body || typography.action !== typography.body
      || parseFloat(typography.caption) < 14 || typography.title !== '18px' || typography.motion === 'none') throw Error(JSON.stringify(typography));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await panel.locator('.ai-assistant__orbit-motion').evaluate(el => getComputedStyle(el).animationName);
    if (reduced !== 'none') throw Error('reduced-motion animation remains active');
    await panel.screenshot({ path: `output/playwright/ai-assistant-font-motion-${theme}.png` });
    cases.push({ theme, ...typography, reduced });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  const layout = await panel.evaluate(root => {
    const input = root.querySelector('textarea').getBoundingClientRect();
    return { overflow: root.scrollWidth > root.clientWidth + 1, inputBottom: input.bottom };
  });
  if (layout.overflow || layout.inputBottom > 568) throw Error(JSON.stringify(layout));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  return { passed: true, cases, shortScreen: layout };
}
