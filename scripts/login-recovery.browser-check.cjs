async page => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const assert = (condition, message) => { if (!condition) throw Error(message); };
  const errors = [];
  let mode = 'gateway', loginCount = 0, roleCount = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/system/sysUser/login', async route => {
    loginCount++;
    if (mode === 'network') return route.abort('failed');
    if (mode === 'gateway') return route.fulfill({status:502,body:'synthetic-secret-response'});
    if (mode === 'invalid') return route.fulfill({status:200,body:'<html>synthetic-secret-response</html>'});
    if (mode === 'business') return route.fulfill({json:{code:500,message:'synthetic-secret-response'}});
    if (mode === 'auth') return route.fulfill({status:401,body:''});
    return route.fulfill({json:{code:200,data:{token:'synthetic-test-only',userName:'合成账号',roleList:[{id:1,roleName:'合成角色'}]}}});
  });
  await page.route('**/system/sysUser/roleConfirm', route => {
    roleCount++;
    return mode === 'rolefail' ? route.fulfill({status:502,body:''}) : route.fulfill({json:{code:200}});
  });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/login-recovery.html');
  await page.getByPlaceholder('请输入账号').fill('合成验收账号');
  await page.getByPlaceholder('请输入密码').fill('synthetic-only-password');
  await page.getByRole('button',{name:'登录并继续'}).click();
  await page.locator('.swp-login__message').filter({hasText:'登录服务暂不可用'}).waitFor();
  const diagnostic = page.locator('.api-diagnostics');
  await diagnostic.locator('summary').click();
  await diagnostic.getByText('HTTP 502', {exact:true}).waitFor();
  assert((await diagnostic.innerText()).includes('HTTP 502'), 'HTTP status missing');
  assert(!(await diagnostic.innerText()).includes('synthetic-secret'), 'raw response exposed');
  const before = loginCount;
  await diagnostic.getByRole('button',{name:'更新诊断列表'}).click();
  assert(loginCount === before, 'diagnostic refresh sent request');
  const [download] = await Promise.all([page.waitForEvent('download'), diagnostic.getByRole('button',{name:'导出脱敏诊断'}).click()]);
  await download.saveAs('output/playwright/login-recovery-diagnostics.json');
  const cases = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.recoveryFixture.setTheme(theme), theme);
    for (const width of [1440,1024,768,320]) {
      await page.setViewportSize({width,height:1000});
      await diagnostic.scrollIntoViewIfNeeded();
      assert(await diagnostic.evaluate((el, expected) => getComputedStyle(el).backgroundColor === expected,
        theme === 'light' ? 'rgb(241, 249, 252)' : 'rgb(16, 39, 53)'), `${theme}/${width} diagnostic theme mismatch`);
      if (width > 768) {
        assert(await page.locator('.swp-login__card').evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight + 1 && getComputedStyle(el).overflowY === 'auto';
        }), `${theme}/${width} expanded diagnostics escaped login card`);
      }
      assert(await diagnostic.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} diagnostic overflow`);
      assert(await page.locator('.swp-login__message').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} message overflow`);
      await diagnostic.locator('summary').focus();
      await page.keyboard.press('Tab');
      assert(await diagnostic.getByRole('button',{name:'更新诊断列表'}).evaluate(el => el === document.activeElement), 'diagnostic keyboard order');
      if ([1440,320].includes(width)) await page.screenshot({path:`output/playwright/login-recovery-${theme}-${width}.png`});
      cases.push({theme,width,passed:true});
    }
  }
  for (const [nextMode, label] of [['network','连接未成功'],['invalid','登录服务暂不可用'],['business','暂时无法完成登录'],['auth','登录验证未通过']]) {
    mode = nextMode;
    await page.getByRole('button',{name: mode === 'auth' ? '核对后重试' : '重试本次操作',exact:true}).click();
    await page.locator('.swp-login__message').filter({hasText:label}).waitFor();
  }
  await page.getByRole('button',{name:'重新登录',exact:true}).click();
  assert(await page.locator('.swp-login__message').count() === 0, 'login restart did not clear error');
  mode = 'rolefail';
  await page.getByPlaceholder('请输入密码').fill('synthetic-only-password');
  await page.getByRole('button',{name:'登录并继续'}).click();
  await page.locator('.swp-login__message').filter({hasText:'登录服务暂不可用'}).waitFor();
  const loginBeforeRoleRetry = loginCount;
  mode = 'success';
  await page.getByRole('button',{name:'重试本次操作',exact:true}).click();
  await page.waitForFunction(() => !document.querySelector('.swp-login__message'));
  assert(loginCount === loginBeforeRoleRetry && roleCount === 2, 'role retry repeated login or failed');
  assert(errors.length === 0, errors.join(';'));
  await page.evaluate(() => sessionStorage.clear());
  return {passed:true,cases,loginCount,roleCount,realBackendRequests:0,errors};
}
