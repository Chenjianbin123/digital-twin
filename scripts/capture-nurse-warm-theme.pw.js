async (page) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://127.0.0.1:5194/scripts/fixtures/nurse-warm-preview.html?model=v3&presentation=1');
  await page.waitForFunction(() => window.nurseWarmPreview?.ready && document.querySelector('.warm-sidebar'));
  await page.waitForFunction(() => !document.querySelector('#theme-sidebar').hidden);
  await page.locator('#theme-sidebar .nurse-panel').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'output/playwright/nurse-warm-theme-light.png', animations: 'disabled' });
  await page.getByRole('button', { name: '深色模式', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.warm-sidebar')?.dataset.theme === 'dark');
  await page.screenshot({ path: 'output/playwright/nurse-warm-theme-dark.png', animations: 'disabled' });
  return { title: await page.title(), sidebar: await page.locator('.warm-sidebar').count() };
}
