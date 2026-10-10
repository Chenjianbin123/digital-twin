async page => {
  const model = '**/models/smart-ward-interior/ward-graphite-room-v1.glb';
  await page.route(model, route => route.abort('failed'));
  try {
    await page.goto('http://localhost:5173/scripts/fixtures/ward-graphite-preview.html');
    await page.waitForFunction(() => Boolean(window.wardGraphitePreview?.error));
    if (!(await page.getByRole('button', { name: '重新加载', exact: true }).isVisible())) throw new Error('Missing model retry');
    const state = await page.evaluate(() => ({ ready: window.wardGraphitePreview.ready, text: document.querySelector('#status').textContent, busy: document.querySelector('#scene').getAttribute('aria-busy'), disabled: [...document.querySelectorAll('.actions button:not(#retry)')].every(b => b.disabled) }));
    if (state.ready || state.busy !== 'false' || !state.disabled || !state.text.includes('模型加载失败')) throw new Error('Incorrect model failure state');
    await page.screenshot({ path: 'output/playwright/ward-graphite-load-failure.png' });
    await page.unroute(model);
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.waitForFunction(() => window.wardGraphitePreview?.ready, null, { timeout: 60000 });
    return { failureShown: true, controlsDisabledDuringFailure: state.disabled, retryRecovered: true };
  } finally {
    await page.unroute(model);
  }
}
