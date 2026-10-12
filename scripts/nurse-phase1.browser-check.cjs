async page => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical&reference');
  await page.locator('.nurse-status-console').waitFor();
  await page.evaluate(() => {
    window.commandFixture.setClinicalSync('partial');
    window.commandFixture.setPageCoverage([{label:'输液报警',received:200,total:1333,current:1,size:200,pages:7,complete:false}]);
    window.commandFixture.setTask(0, {status:'handling'});
    window.commandFixture.setTask(2, {retained:true});
  });
  const results = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440,768,375,320]) {
      await page.setViewportSize({width,height:1200});
      const collapse = page.getByRole('button', {name:'收起病区状态与提醒',exact:true});
      if (await collapse.count()) await collapse.click();
      await page.getByRole('tab', {name:'待办',exact:true}).click();
      const filters = page.getByRole('tablist', {name:'告警任务筛选'});
      assert(await filters.getByRole('tab').count() === 4, 'expected four distinct progress filters');
      await filters.getByRole('tab', {name:/本机确认/}).click();
      assert(await page.locator('.alert-task:visible').count() === 1, 'local acknowledgement was not separated');
      assert((await page.locator('.alert-task:visible').innerText()).includes('本机已确认'), 'wrong acknowledgement label');
      await filters.getByRole('tab', {name:/已提交/}).click();
      assert(await page.locator('.alert-task:visible').count() === 0, 'local acknowledgement appeared as submitted');
      await filters.getByRole('tab', {name:/未处理/}).click();
      assert((await page.locator('.alert-task:visible').first().innerText()).includes('当前状态待复核'), 'retained event not labelled');
      await page.evaluate(() => window.commandFixture.setTask(0, {status:'pending'}));
      const callLabel = await page.locator('.alert-task--swp-call:visible').first().innerText();
      assert(callLabel.includes('未处理') && !callLabel.includes('呼叫中'), 'unprocessed call was presented as a live ringing signal');
      await page.evaluate(() => window.commandFixture.setTask(0, {status:'handling'}));
      const overflow = await filters.evaluate(root => ({
        root:root.scrollWidth > root.clientWidth+1,
        buttons:[...root.querySelectorAll('button')].some(el => el.scrollWidth > el.clientWidth+1),
      }));
      assert(!overflow.root && !overflow.buttons, `${theme}/${width} filters overflow ${JSON.stringify(overflow)}`);
      await filters.getByRole('tab', {name:/未处理/}).focus();
      await page.keyboard.press('ArrowRight');
      assert(await filters.getByRole('tab', {name:/本机确认/}).getAttribute('aria-selected') === 'true', 'keyboard filter failed');
      if ([1440,320].includes(width)) await page.screenshot({path:`output/playwright/phase1-queue-${theme}-${width}.png`});
      await page.getByRole('button', {name:'展开病区状态与提醒',exact:true}).click();
      const sourceDetails = page.locator('.nsc-disclosure').first();
      if (await sourceDetails.getAttribute('open') === null) await sourceDetails.locator('summary').click();
      assert((await sourceDetails.innerText()).includes('本次获取 200 / 1333 条（未确认完整）'), 'coverage is missing');
      const reminder = page.locator('.nsc-disclosure').nth(1);
      if (await reminder.getAttribute('open') === null) await reminder.locator('summary').click();
      assert(await reminder.getByRole('button',{name:'重试失败提醒'}).isDisabled(), 'disabled reminders allowed retry');
      await reminder.scrollIntoViewIfNeeded();
      assert(await reminder.evaluate(el => el.scrollWidth <= el.clientWidth+1), `${theme}/${width} reminder overflow`);
      if ([1440,320].includes(width)) await page.locator('.nurse-status-console').screenshot({path:`output/playwright/phase1-status-${theme}-${width}.png`});
      results.push({theme,width,passed:true});
    }
  }
  assert(!errors.length, errors.join(';'));
  return {passed:true,cases:results.length,results};
}
