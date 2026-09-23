async (page) => {
  const url = 'http://127.0.0.1:5173/scripts/fixtures/startup-scene-handoff.html';
  const workspacePattern = '**/src/components/workspace/DigitalTwinWorkspace.vue*';
  const rendererPattern = '**/src/components/AreaScene3D.vue*';
  await page.unroute(workspacePattern);
  await page.unroute(rendererPattern);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(rendererPattern, route => route.fulfill({ contentType: 'text/javascript', body: 'export { default } from "/scripts/fixtures/startup-scene-stub.js";' }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.waitForFunction(() => !!window.startupFixture);
  await page.evaluate(() => {
    window.handoffSceneLoaderSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('.scene-switch-loader')) window.handoffSceneLoaderSeen = true;
    }).observe(document.body, { subtree: true, childList: true });
    window.startupFixture.finishData();
  });
  await page.waitForFunction(() => !!window.startupSceneStub?.active);
  await page.waitForTimeout(500);
  if (await page.locator('.startup-loader').count() !== 1 || await page.locator('.scene-switch-loader').count()) throw new Error('Initial handoff has duplicate/missing loader');
  if (await page.locator('progress').getAttribute('value') !== '86') throw new Error('Scene wait reports premature completion');
  if (!(await page.locator('.digital-twin').evaluate(el => el.inert))) throw new Error('Covered workspace remains keyboard interactive');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `output/playwright/startup-unified-${width}.png` });
    const box = await page.locator('.startup-loader__panel').boundingBox();
    if (!box || box.x < 0 || box.x + box.width > width + 1) throw new Error(`Startup panel overflow at ${width}`);
  }
  await page.evaluate(() => window.startupSceneStub.active('fallback'));
  await page.getByRole('button', { name: '重试加载', exact: true }).waitFor();
  await page.screenshot({ path: 'output/playwright/startup-unified-failure.png' });
  await page.getByRole('button', { name: '重试加载', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.startupSceneStub.mounts.length === 2);
  await page.evaluate(() => window.startupSceneStub.mounts[0]('ready'));
  if ((await page.evaluate(() => window.startupFixture.getState())).progress === 100) throw new Error('Old model attempt completed current startup');
  await page.evaluate(() => window.startupSceneStub.active('ready'));
  await page.locator('.startup-loader').waitFor({ state: 'detached' });
  if (await page.evaluate(() => window.handoffSceneLoaderSeen)) throw new Error('Second loader appeared during startup');
  if (await page.locator('.digital-twin').evaluate(el => el.inert)) throw new Error('Workspace remains inert after readiness');
  await page.evaluate(() => window.startupFixture.switchScene('ward'));
  await page.locator('.scene-switch-loader').waitFor();
  await page.waitForFunction(() => window.startupSceneStub.mounts.length === 3);
  await page.evaluate(() => window.startupSceneStub.active('ready'));
  await page.locator('.scene-switch-loader').waitFor({ state: 'detached' });
  await page.evaluate(() => window.startupFixture.switchScene('nurse-station'));
  await page.locator('.scene-switch-loader[data-phase="switching"]').waitFor();
  await page.locator('.scene-switch-loader').waitFor({ state: 'detached' });

  // Non-startup entry must retain the wrapper's default recovery panel.
  await page.route(workspacePattern, route => route.abort('failed'));
  await page.goto(url);
  await page.waitForFunction(() => !!window.startupFixture);
  await page.evaluate(() => window.startupFixture.finishData(false));
  await page.locator('.startup-loader').waitFor({ state: 'detached' });
  await page.getByTestId('area-selection').waitFor();
  await page.evaluate(() => window.startupFixture.enterArea());
  await page.locator('.async-load-error').waitFor();
  await page.getByRole('button', { name: '刷新页面', exact: true }).waitFor();

  // Initial workspace download failure remains on the unified startup screen.
  await page.goto(url);
  await page.waitForFunction(() => !!window.startupFixture);
  await page.evaluate(() => window.startupFixture.finishData());
  await page.locator('.startup-loader').getByRole('button', { name: '刷新页面', exact: true }).waitFor();
  if (await page.locator('.scene-switch-loader').count()) throw new Error('Component failure leaked second loader');
  await page.unroute(workspacePattern);

  // The nurse-station wrapper must forward nested renderer-code failures too.
  await page.unroute(rendererPattern);
  await page.route(rendererPattern, route => route.abort('failed'));
  await page.goto(url);
  await page.waitForFunction(() => !!window.startupFixture);
  await page.evaluate(() => window.startupFixture.finishData());
  await page.locator('.startup-loader').getByRole('button', { name: '刷新页面', exact: true }).waitFor();
  await page.locator('.startup-loader').getByRole('button', { name: '退出登录', exact: true }).click();
  await page.locator('.startup-loader').waitFor({ state: 'detached' });
  if ((await page.evaluate(() => window.startupFixture.getState())).loggedIn) throw new Error('Logout did not cancel startup');
  await page.unroute(rendererPattern);
  if (errors.length) throw new Error(errors.join('\n'));
  return { passed: true, pageErrors: errors, viewports: [320, 768, 1024, 1440], checks: ['single-startup-loader', 'true-ready', 'model-retry', 'stale-attempt', 'later-cached-switch', 'manual-entry-code-failure', 'startup-code-failure', 'nested-code-failure', 'logout', 'keyboard-retry'] };
}
