async (page) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/scene-switch-loading.html');
  await page.getByRole('button', { name: '病房走廊', exact: true }).click();
  const loader = page.locator('.scene-switch-loader');
  await page.waitForTimeout(1000);
  if (await loader.getAttribute('data-phase') !== 'loading') throw new Error('Slow loading closed too early');
  await page.getByRole('button', { name: '模型就绪', exact: true }).click();
  await loader.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '护士站', exact: true }).click();
  if (await loader.getAttribute('data-phase') !== 'switching') throw new Error('Cached scene has no transition');
  if (!(await loader.innerText()).includes('场景资源已就绪')) throw new Error('Cached transition uses incorrect copy');
  await loader.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '病房内', exact: true }).click();
  await page.getByRole('button', { name: '模拟失败', exact: true }).click();
  await page.waitForTimeout(1000);
  if (await loader.getAttribute('data-state') !== 'fallback') throw new Error('Failure feedback dismissed by timer');
  await page.getByRole('button', { name: '重试加载', exact: false }).click();
  if (await loader.getAttribute('data-state') !== 'loading') throw new Error('Retry did not restart loading');
  await page.getByRole('button', { name: '模型就绪', exact: true }).click();
  await loader.waitFor({ state: 'detached' });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: '病房走廊', exact: true }).click();
    await page.waitForFunction(() => {
      const el = document.querySelector('.scene-switch-loader');
      return el && getComputedStyle(el).opacity === '1';
    });
    await page.screenshot({ path: `output/playwright/scene-switch-loading-${width}.png` });
    const bounds = await page.locator('.scene-switch-loader__card').boundingBox();
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width + 1) throw new Error(`Overflow at ${width}`);
    await loader.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: '护士站', exact: true }).click();
    await loader.waitFor({ state: 'detached' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '病房走廊', exact: true }).click();
  const animation = await page.locator('.scene-switch-loader__progress > span').evaluate(el => getComputedStyle(el).animationName);
  if (animation !== 'none') throw new Error('Reduced motion not respected');
  await loader.waitFor({ state: 'detached' });
  if (errors.length) throw new Error(errors.join('\n'));
  return { passed: true, viewports: [320, 768, 1024, 1440], checks: ['slow-loading', 'cached-switch', 'failure', 'retry', 'fade-out', 'reduced-motion'], pageErrors: errors };
}
