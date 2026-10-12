async page => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [], queries = [];
  let failQueries = false;
  page.on('pageerror', error => errors.push(error.message));
  const reply = async route => {
    const query = route.request().postDataJSON();
    queries.push({ path: route.request().url().split('?')[0], query });
    assert(query.areaId === 999999, 'unexpected ward request');
    if (failQueries) return route.fulfill({ json: { code: 500, message: '合成同步失败' } });
    return route.fulfill({ json: { code: 200, data: { records: [], total: 0, current: query.pageNum, size: 200, pages: 0 } } });
  };
  await page.route('**/querySwp*', reply);
  await page.route('**/queryCallEventResponseTimeliness', reply);
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&inspection');
  await page.locator('.nurse-status-console').waitFor();
  await page.evaluate(() => {
    window.commandFixture.setTask(0, {roomName:'11房', bedName:'208床', roomCode:'R11', bedCode:'B208'});
    window.commandFixture.setTask(1, {roomName:'12房', bedName:'09床'});
    window.commandFixture.setTask(2, {roomName:'11房', bedName:'209床', retained:true});
    for (let i = 6; i < 12; i++) window.commandFixture.setTask(i, {source:i < 10 ? 'swp-alarm' : undefined});
    window.commandFixture.setInspectionAssociation({received:73,matched:12,unmatched:61,omittedIssueCount:2,
      issues:[{roomName:'11房',bedName:'208床',count:59,reason:'房床信息不一致',currentBeds:['007床','206'],otherRooms:['其他合成病房'],sickName:'不可导出的合成姓名',carNo:'不可导出的合成卡号'}]});
  });
  const collapse = page.getByRole('button',{name:'收起病区状态与提醒',exact:true});
  await collapse.click();
  const results = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440,1024,768,320]) {
      await page.setViewportSize({width,height:1100});
      await page.getByRole('tab',{name:'待办',exact:true}).click();
      const filters = page.locator('.nurse-task-filters');
      await filters.getByLabel('房床搜索').fill('11房 208');
      assert(await page.locator('.alert-task:visible').count() === 1, 'room/bed search did not intersect');
      await filters.getByLabel('记录状态').selectOption('retained');
      assert(await page.locator('.alert-task:visible').count() === 0, 'retained search mismatch');
      await filters.getByLabel('房床搜索').fill('11房');
      assert(await page.locator('.alert-task:visible').count() === 1, 'retained event missing');
      assert((await page.locator('.alert-task:visible').innerText()).includes('状态待确认'), 'retained label missing');
      await filters.getByRole('button',{name:'清除房床与依据筛选'}).click();
      await filters.getByLabel('记录状态').selectOption('pending');
      assert((await filters.innerText()).includes('当前筛选 9 项'), 'pending included retained or other source');
      await filters.getByLabel('房床搜索').focus();
      await page.keyboard.press('Tab');
      assert(await filters.getByLabel('记录状态').evaluate(el => el === document.activeElement), 'keyboard order');
      const overflow = await filters.evaluate(root => root.scrollWidth > root.clientWidth + 1 || [...root.querySelectorAll('input,select,button')].some(el => el.getBoundingClientRect().right > root.getBoundingClientRect().right + 1));
      assert(!overflow, `${theme}/${width} filter overflow`);
      if ([1440,320].includes(width)) await page.locator('.alert-task-panel').screenshot({path:`output/playwright/nurse-tools-queue-${theme}-${width}.png`});
      await filters.getByRole('button',{name:'清除房床与依据筛选'}).click();
      await page.getByRole('tab',{name:'巡视',exact:true}).click();
      const disclosure = page.locator('.inspection-association details');
      if (await disclosure.getAttribute('open') === null) await disclosure.locator('summary').click();
      const downloadPanel = page.locator('.inspection-download');
      await downloadPanel.scrollIntoViewIfNeeded();
      assert((await downloadPanel.innerText()).includes('另有 2 条未列出'), 'incomplete export scope hidden');
      assert(await downloadPanel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${theme}/${width} export overflow`);
      if ([1440,320].includes(width)) await page.locator('.inspection-association').screenshot({path:`output/playwright/nurse-tools-inspection-${theme}-${width}.png`});
      results.push({theme,width,passed:true});
    }
  }
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button',{name:'导出房床核对清单'}).click(),
  ]);
  assert(download.suggestedFilename().endsWith('.csv'), 'missing CSV download');
  await download.saveAs('output/playwright/nurse-tools-checklist.csv');
  await page.getByRole('button',{name:'展开病区状态与提醒',exact:true}).click();
  const sourceDetails = page.locator('.nsc-disclosure').first();
  if (await sourceDetails.getAttribute('open') === null) await sourceDetails.locator(':scope > summary').click();
  await page.evaluate(() => window.commandFixture.startEventPolling());
  const before = queries.length;
  const refresh = page.getByRole('button',{name:'重新获取呼叫与输液记录',exact:true});
  await refresh.click();
  await page.getByText('记录已更新，请结合现场情况确认。',{exact:true}).waitFor();
  assert(queries.length === before + 4, 'manual refresh did not make exactly four bounded query requests');
  assert(await page.getByRole('button',{name:/秒后可重试/}).isDisabled(), 'manual refresh not throttled');
  await page.locator('.event-sync-actions').screenshot({path:'output/playwright/nurse-tools-refresh-dark-320.png'});
  const diagnostic = page.locator('.api-diagnostics');
  await diagnostic.locator('summary').click();
  await diagnostic.locator('li').first().waitFor();
  const beforeDiagnostic = queries.length;
  await diagnostic.getByRole('button',{name:'更新诊断列表'}).click();
  assert(queries.length === beforeDiagnostic, 'diagnostics must not initiate a backend request');
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    assert(await diagnostic.evaluate((el, expected) => getComputedStyle(el).backgroundColor === expected
      && el.scrollWidth <= el.clientWidth + 1, theme === 'light' ? 'rgb(247, 251, 255)' : 'rgb(16, 40, 55)'),
      `${theme}/320 nurse diagnostics theme or overflow mismatch`);
  }
  await diagnostic.locator('summary').click();
  await page.waitForTimeout(10100);
  failQueries = true;
  await page.getByRole('button',{name:'重新获取呼叫与输液记录',exact:true}).click();
  await page.getByText('信息暂未更新，请稍后重试并核对现场情况。',{exact:true}).waitFor();
  assert(queries.length === before + 8, 'failure query was not bounded');
  await page.evaluate(() => { window.commandFixture.stopEventPolling(); window.commandFixture.setAreaId(999998); });
  assert((await page.locator('.event-sync-actions').innerText()).includes('重新获取'), 'ward switch lost controls');
  assert(!(await page.locator('.event-sync-actions').innerText()).includes('信息暂未更新，请稍后重试'), 'old ward feedback leaked');
  assert(errors.length === 0, errors.join(';'));
  return {passed:true,cases:results,readOnlyQueries:queries.length,download:download.suggestedFilename(),errors};
}
