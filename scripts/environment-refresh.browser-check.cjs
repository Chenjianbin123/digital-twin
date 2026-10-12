async page => {
  const assert = (value, message) => { if (!value) throw Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/environment-refresh.html');
  const ward = page.locator('.ward-info-panel__env');
  const station = page.locator('.surface-panel--env');
  await station.waitFor();
  assert((await station.innerText()).includes('2/3 间'), 'fresh coverage must exclude the stale room');
  assert((await station.innerText()).includes('25℃'), 'mean temperature must exclude stale 32℃');
  assert((await station.innerText()).includes('异常待核实 1 间'), 'old anomaly must remain visible');
  assert((await ward.innerText()).includes('最近接收'), 'current room should show receipt time');
  const results = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.environmentFixture.setTheme(theme), theme);
    for (const width of [1440,768,390,320]) {
      await page.setViewportSize({width,height:1100});
      await station.scrollIntoViewIfNeeded();
      const overflow = await station.evaluate(root => root.scrollWidth > root.clientWidth + 1);
      assert(!overflow, `${theme}/${width}: environment card overflow`);
      assert(!await ward.evaluate(root => root.scrollWidth > root.clientWidth + 1), `${theme}/${width}: room environment overflow`);
      const icon = await ward.locator('.clinical-icon').first().boundingBox();
      assert(icon && icon.width <= 32 && icon.height <= 32, 'room preview must use production sidebar styling');
      const line = station.locator('.device-line--environment');
      assert(await line.isVisible(), 'freshness detail must be visible');
      if ([1440,320].includes(width)) {
        await station.screenshot({path:`output/playwright/environment-station-${theme}-${width}.png`});
        await ward.screenshot({path:`output/playwright/environment-ward-${theme}-${width}.png`});
      }
      results.push({theme,width});
    }
  }
  for (const state of ['failed','stale','unknown']) {
    await page.evaluate(state => window.environmentFixture.setState(state), state);
    await page.waitForFunction(() => document.querySelector('.surface-panel--env').textContent.includes('0/3 间'));
    assert((await station.innerText()).includes('待更新 3 间'), `${state}: pending coverage`);
    assert((await station.locator('.env-card').first().innerText()).includes('--'), `${state}: mean must be unknown`);
    assert((await ward.innerText()).includes('24℃'), `${state}: last reading must remain visible`);
    const expected = {failed:'更新失败',stale:'数据已过期',unknown:'更新时间未知'}[state];
    await page.waitForFunction(expected => document.querySelector('.ward-info-panel__env').textContent.includes(expected), expected);
    assert((await ward.innerText()).includes(expected), `${state}: room status`);
  }
  for (const source of ['mock','database']) {
    await page.evaluate(source => window.environmentFixture.setSource(source), source);
    await page.waitForFunction(() => document.querySelector('.surface-panel--env').textContent.includes('3/3 间'));
    await page.waitForFunction(expected => document.querySelector('.ward-info-panel__env').textContent.includes(expected), source==='mock'?'演示数据':'数据库快照');
    assert((await station.innerText()).includes(source==='mock'?'演示数据':'数据库快照'), 'static source must be explicit');
    assert((await ward.innerText()).includes(source==='mock'?'演示数据':'数据库快照'), 'room source must be explicit');
  }
  await page.evaluate(() => {window.environmentFixture.setSource('remote');window.environmentFixture.setState('fresh');});
  await page.waitForFunction(() => document.querySelector('.ward-info-panel__env').textContent.includes('最近接收'));
  assert((await station.innerText()).includes('3/3 间'), 'recovery restores current coverage');
  assert(errors.length===0, `browser errors: ${errors.join('; ')}`);
  return {passed:true,results,states:['mixed','failed','stale','unknown','mock','database','recovered']};
}
