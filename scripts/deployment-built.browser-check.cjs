async page => {
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const waitVisible = async (locator, stage) => {
    try { await locator.waitFor({ state: 'visible' }); }
    catch { throw Error(`production check failed at: ${stage}; matchedLogins=${loginCount}; blockedRequests=${unexpected.length}; pageErrors=${errors.length}`); }
  };
  const origin = 'http://127.0.0.1:5173';
  const expectedApiOrigin = '__EXPECTED_API_ORIGIN__';
  const errors = [], unexpected = [];
  let mode = 'gateway', loginCount = 0, configMode = 'missing', configCount = 0;
  let currentApiOrigin = expectedApiOrigin;
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (url === origin + '/config.json' && request.method() === 'GET') {
      configCount++;
      if (configMode === 'missing') return route.fulfill({ status: 404, body: '' });
      if (configMode === 'invalid-json') return route.fulfill({ status: 200, body: '<html>fallback</html>' });
      if (configMode === 'invalid-host') return route.fulfill({ json: { deviceHost: '/swp' } });
      if (configMode === 'second-hospital') return route.fulfill({ json: { deviceHost: currentApiOrigin } });
      return route.continue();
    }
    if (url.startsWith(origin + '/') && request.method() === 'GET') return route.continue();
    if (url === currentApiOrigin + '/swp/system/sysUser/login' && request.method() === 'POST') {
      loginCount++;
      if (mode === 'network') return route.abort('failed');
      return route.fulfill({ status: 502, body: 'synthetic-build-check-only' });
    }
    unexpected.push(`${request.method()} ${url.split(/[?#]/)[0]}`);
    await route.abort();
  });
  await page.goto(origin);
  await page.getByRole('heading', { name: '平台启动失败' }).waitFor({ state: 'visible' });
  assert(await page.locator('.startup-error').innerText().then(text => text.includes('config.json')), 'missing configuration must be explained');
  assert(await page.getByPlaceholder('请输入账号').count() === 0 && loginCount === 0, 'business must not start before configuration');
  await page.setViewportSize({ width: 320, height: 640 });
  assert(await page.locator('.startup-error').evaluate(element => element.scrollWidth <= element.clientWidth), 'configuration error overflows narrow screen');
  await page.screenshot({ path: 'output/playwright/production-config-error.png' });
  for (const state of ['invalid-json', 'invalid-host']) {
    configMode = state;
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('heading', { name: '平台启动失败' }).waitFor({ state: 'visible' });
    assert(loginCount === 0, 'invalid configuration must not issue login requests');
  }
  configMode = 'deployed';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  const skip = page.getByRole('button', { name: '跳过动画', exact: true });
  const account = page.getByPlaceholder('请输入账号');
  // Vue mounts after navigation; a one-shot visibility check can miss the intro gate.
  await waitVisible(skip.or(account).first(), 'intro or login mount');
  if (await skip.isVisible()) await skip.click();
  await waitVisible(account, 'login form');
  await account.fill('synthetic-build-check');
  await page.getByPlaceholder('请输入密码').fill('synthetic-build-check-only');
  await page.getByRole('button', { name: '登录并继续', exact: true }).click();
  await waitVisible(page.locator('.swp-login__message').filter({ hasText: '登录服务暂不可用' }), 'gateway response');
  assert(loginCount === 1, 'production login did not use the configured 9700/swp target');
  mode = 'network';
  await page.getByRole('button', { name: '重试本次操作', exact: true }).click();
  await waitVisible(page.locator('.swp-login__message').filter({ hasText: '连接未成功' }), 'network response');
  mode = 'gateway';
  await page.getByRole('button', { name: '重试本次操作', exact: true }).click();
  await waitVisible(page.locator('.swp-login__message').filter({ hasText: '登录服务暂不可用' }), 'retry response');
  assert(loginCount === 3, 'retry did not issue exactly one request per click');
  await page.getByPlaceholder('请输入密码').fill('');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'output/playwright/production-login.png' });
  // Same production bundle and URL; only the public configuration changes.
  await page.evaluate(() => {
    sessionStorage.setItem('TokenKey', 'synthetic-old-hospital-session');
    sessionStorage.setItem('DIGITAL_TWIN_AUTH_USER', '{}');
    sessionStorage.setItem('DIGITAL_TWIN_AUTH_ROLE', '{}');
  });
  currentApiOrigin = expectedApiOrigin === 'http://192.0.2.22:9700' ? 'http://192.0.2.23:9700' : 'http://192.0.2.22:9700';
  configMode = 'second-hospital';
  await page.reload();
  await waitVisible(skip.or(account).first(), 'second hospital mount');
  if (await skip.isVisible()) await skip.click();
  await waitVisible(account, 'second hospital login');
  assert(await page.evaluate(() => sessionStorage.getItem('TokenKey')) === null, 'old hospital session was retained');
  await account.fill('synthetic-build-check');
  await page.getByPlaceholder('请输入密码').fill('synthetic-build-check-only');
  await page.getByRole('button', { name: '登录并继续', exact: true }).click();
  await waitVisible(page.locator('.swp-login__message').filter({ hasText: '登录服务暂不可用' }), 'second hospital target');
  assert(loginCount === 4 && configCount === 5, 'configuration was not reread on every reload');
  assert(errors.length === 0, errors.join(';'));
  assert(unexpected.length === 0, 'unexpected unmocked request');
  return { passed: true, productionBundle: true, configuredApiTarget: true, runtimeConfigReload: true, configCount, loginCount, realBackendRequests: 0 };
}
