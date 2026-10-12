async page => {
  await page.unrouteAll({behavior:'ignoreErrors'});
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [], queries = [];
  page.on('pageerror', error => errors.push(error.message));
  let failSecond = true, slowOld = false;
  await page.route('**/querySwp*', async route => {
    const query = route.request().postDataJSON();
    queries.push(query);
    assert(query.eventStatus === '0' && query.pageSize === 200, 'wrong pending query');
    if (slowOld && query.areaId === 999999) await page.waitForTimeout(700);
    if (query.pageNum === 2 && failSecond) {
      failSecond = false;
      return route.fulfill({json:{code:500,message:'合成分页失败'}});
    }
    const records = Array.from({length:query.pageNum === 1 ? 200 : 3}, (_,i) => ({
      id:`${query.areaId}-${query.pageNum}-${i}`, areaId:query.areaId, eventStatus:'0',
      alarmType:'304', callModeName:'合成呼叫', callStartTime:'2026-09-30 10:00:00', alarmStartTime:'2026-09-30 10:00:00',
      callMessage:`合成病区 ${query.areaId} 分页记录`,
    }));
    return route.fulfill({json:{code:200,data:{records,total:203,current:query.pageNum,size:200,pages:2}}});
  });
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?inspection');
  await page.getByRole('tab', {name:'待办',exact:true}).click();
  const panel = page.locator('.event-records');
  await panel.waitFor();
  assert(queries.length === 0, 'queried before opening');
  await panel.getByRole('button', {name:'查看更多记录'}).click();
  await panel.locator('.event-records__list li').nth(199).waitFor();
  assert((await panel.innerText()).includes('本页 200 条'), 'current-page count missing');
  await panel.getByRole('button', {name:'下一页',exact:true}).click();
  await panel.getByRole('alert').waitFor();
  assert(await panel.locator('.event-records__list li').count() === 200, 'failure cleared old page');
  await panel.getByRole('button', {name:'重试',exact:true}).click();
  await page.waitForFunction(() => document.querySelectorAll('.event-records__list li').length === 3);
  assert(await panel.getByRole('button', {name:'下一页',exact:true}).isDisabled(), 'end page has next');
  await panel.getByRole('button', {name:'上一页',exact:true}).click();
  await panel.locator('.event-records__list li').nth(199).waitFor();
  await panel.locator('select').selectOption('alarm');
  await panel.getByText('异常离线报警', {exact:true}).first().waitFor();
  const cases = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    for (const width of [1440,768,375,320]) {
      await page.setViewportSize({width,height:1100});
      await panel.scrollIntoViewIfNeeded();
      const layout = await panel.evaluate(el => ({overflow:el.scrollWidth > el.clientWidth + 1,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
      assert(!layout.overflow, `${theme}/${width} overflow`);
      await panel.getByRole('button', {name:'刷新第一页'}).focus();
      if ([1440,320].includes(width)) {
        await page.setViewportSize({width,height:2600});
        await panel.screenshot({path:`output/playwright/nurse-records-${theme}-${width}.png`});
      }
      cases.push({theme,width,...layout});
    }
  }
  assert(cases[0].color !== cases[4].color, 'light and dark text tokens are identical');
  await panel.locator('select').selectOption('call');
  await panel.getByText('合成呼叫', {exact:true}).first().waitFor();
  slowOld = true;
  await panel.getByRole('button', {name:'刷新第一页'}).click();
  await page.evaluate(() => window.commandFixture.setAreaId(999998));
  await panel.getByText(/合成病区 999998/).first().waitFor();
  await page.waitForTimeout(800);
  assert(!(await panel.locator('.event-records__list').innerText()).includes('999999'), 'stale ward contaminated records');
  await page.evaluate(() => window.commandFixture.setInspectionAssociation({received:73,matched:70,unmatched:3,issues:[{roomName:'同名病房',bedName:'',reason:'病房信息不唯一'}]}));
  await page.getByRole('tab', {name:'巡视',exact:true}).click();
  await page.getByText('查看房床核对清单', {exact:true}).click();
  assert((await page.locator('.inspection-association').innerText()).includes('3 条巡视记录未对应到房床'), 'unmatched summary missing');
  assert((await page.locator('.inspection-association').innerText()).includes('病房信息不唯一'), 'reason missing');
  await page.locator('.inspection-overview').screenshot({path:'output/playwright/nurse-inspection-association-320.png'});
  assert(!errors.length, errors.join(';'));
  await page.unroute('**/querySwp*');
  return {passed:true,cases,requests:queries.length,scopeIsolation:true,retry:true,inspectionDiagnostics:true};
}
