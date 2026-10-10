async page => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [], cases = [];
  const technical = /HTTP|接口|后端|后台|业务码|全量|退避|数据源|synthetic-api/;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/querySwp*', route => route.abort());
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&inspection');
  await page.locator('.nurse-status-console').waitFor();
  await page.evaluate(() => {
    window.commandFixture.setClinicalError('HTTP 502 synthetic-api 接口失败');
    window.commandFixture.setWarnings(['HTTP 502 synthetic-api 病区接口失败']);
    window.commandFixture.setChartHealth('warning');
    window.commandFixture.setTask(0, {retained:true});
  });
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440,1024,768,320]) {
      await page.setViewportSize({width,height:1100});
      for (const phase of ['partial','error']) {
        await page.evaluate(phase => window.commandFixture.setClinicalSync(phase), phase);
        for (const tab of ['概览','待办','巡视']) {
          await page.getByRole('tab',{name:tab,exact:true}).click();
          const text = await page.locator('main').innerText();
          assert(!technical.test(text), `${theme}/${width}/${phase}/${tab}: technical copy ${text.match(technical)?.[0]}`);
          if (tab === '待办') {
            assert(text.includes('状态待确认'), 'retained uncertainty missing');
            assert(text.includes('确认关注不代表已到场或已处理'), 'acknowledgement safety missing');
          }
        }
      }
      const source = page.locator('.nsc-disclosure').first();
      assert(await source.locator('.nsc-heading strong').evaluate(el => el.getBoundingClientRect().height <= parseFloat(getComputedStyle(el).lineHeight) * 2 + 1), `${theme}/${width} status heading wraps excessively`);
      await source.locator(':scope > summary').click();
      assert((await source.innerText()).includes('当前显示上次记录'), 'previous-record notice missing');
      assert(!technical.test(await source.innerText()), 'technical detail leaked into nursing update details');
      assert(await source.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} source overflow`);
      const diagnostics = page.locator('.api-diagnostics');
      assert(await diagnostics.getAttribute('open') === null, 'diagnostics must be closed by default');
      await diagnostics.locator(':scope > summary').focus();
      await page.keyboard.press('Enter');
      await diagnostics.getByText('HTTP 502 synthetic-api 接口失败',{exact:true}).first().waitFor();
      assert(await diagnostics.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} diagnostic overflow`);
      await diagnostics.locator(':scope > summary').click();
      await source.locator(':scope > summary').click();
      await page.getByRole('tab',{name:'待办',exact:true}).click();
      if ([1440,320].includes(width)) await page.screenshot({path:`output/playwright/nursing-copy-${theme}-${width}.png`});
      assert(await page.locator('.fixture-panel').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} sidebar overflow`);
      cases.push({scene:'nurse',theme,width,states:['partial','error'],tabs:3});
    }
  }
  await page.evaluate(() => { window.commandFixture.setSyncTimestamp(null); window.commandFixture.setClinicalSync('error'); });
  const source = page.locator('.nsc-disclosure').first();
  await source.locator(':scope > summary').click();
  const events = source.locator('li').filter({hasText:'呼叫报警'});
  assert((await events.innerText()).includes('暂未获取信息'), 'initial failure pretended to have old information');
  assert(!(await events.innerText()).includes('上次记录'), 'initial failure invented history');
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html');
  await page.locator('.fixture-panel').waitFor();
  for (const scene of ['corridor','room']) {
    await page.evaluate(scene => { window.wardSidebarFixture.setScene(scene); window.wardSidebarFixture.setStale(true); }, scene);
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => window.wardSidebarFixture.setTheme(theme), theme);
      for (const width of [1440,1024,768,320]) {
        await page.setViewportSize({width,height:1100});
        const text = await page.locator('main').innerText();
        assert(!technical.test(text), `${scene}/${theme}/${width} technical copy: ${text.match(technical)?.[0]}`);
        const panel = page.locator('.fixture-panel');
        assert(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${scene}/${theme}/${width} overflow`);
        if (width === 320) await page.screenshot({path:`output/playwright/nursing-copy-${scene}-${theme}-${width}.png`});
        cases.push({scene,theme,width});
      }
    }
  }
  assert(errors.length === 0, errors.join(';'));
  return {passed:true,cases,realBackendRequests:0,errors};
}
