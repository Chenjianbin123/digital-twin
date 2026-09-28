async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  const baseURL = await page.evaluate(() => location.origin);
  await page.goto(`${baseURL}/scripts/fixtures/nurse-light-command.html?clinical`);
  await page.locator('.handoff-card').waitFor();
  const results = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => { window.commandFixture.setTheme(theme); window.commandFixture.setChartHealth('warning'); window.commandFixture.setChartMetrics({deviceOnline:2,deviceTotal:21,deviceHealthRate:10}); document.activeElement?.blur(); }, theme);
    for (const width of [1920,1440,1024,768,375,320]) {
      await page.setViewportSize({width,height:1100});
      await page.locator('.fixture-panel').evaluate((el,width)=>el.style.width=width>=1024?`${Math.min(600,Math.max(400,width*.28))}px`:'100%',width);
      await page.locator('.handoff-card').scrollIntoViewIfNeeded();
      const info = await page.locator('.clinical-overview').evaluate(root => {
        const selectors = '.handoff-card,.data-health,.surface-panel,.clinical-staff li,.env-card,.data-health li,.handoff-card li,.feed__item';
        const bad = [...root.querySelectorAll(selectors)].filter(el => el.checkVisibility() && el.scrollWidth > el.clientWidth + 2).map(el=>el.className);
        const card = getComputedStyle(root.querySelector('.handoff-card'));
        const title = getComputedStyle(root.querySelector('.station-section-title'));
        return {bad,background:card.backgroundColor,radius:card.borderRadius,titleSize:title.fontSize};
      });
      assert(!info.bad.length, `${theme}/${width}: horizontal overflow ${info.bad}`);
      assert(info.radius === '12px', `${theme}/${width}: card theme overridden ${JSON.stringify(info)}`);
      assert(info.titleSize === '18px', `${theme}/${width}: heading overridden ${info.titleSize}`);
      const health = await page.locator('.data-health li').first().evaluate(el => ({
        height:el.getBoundingClientRect().height, label:getComputedStyle(el.querySelector('span')).fontSize,
        detail:getComputedStyle(el.querySelector('small')).fontSize, lineHeight:getComputedStyle(el).lineHeight,
      }));
      assert(health.height >= 72 && health.label === '16px' && health.detail === '14px', `${theme}/${width}: health row density regressed ${JSON.stringify(health)}`);
      assert(await page.locator('.handoff-card li:not([data-tone="note"])').first().evaluate(el=>el.getBoundingClientRect().height >= 92), `${theme}/${width}: handoff card too short`);
      await page.locator('.clinical-sync > summary').click();
      const syncOverflow = await page.locator('.data-health__freshness').evaluate(root=>[root,...root.querySelectorAll('div,span,strong,small')].some(el=>el.scrollWidth>el.clientWidth+2));
      assert(!syncOverflow, `${theme}/${width}: expanded sync details overflow`);
      await page.locator('.clinical-sync > summary').click();
      const typography = await page.locator('.nurse-panel__details-body').evaluate(root => {
        const style = selector => getComputedStyle(root.querySelector(selector));
        return { heading:style('.dash-head__title').fontSize, metric:style('.env-card > strong').fontSize,
          label:style('.env-card > span').fontSize, feed:style('.feed__text').fontSize,
          lineHeight:style('.feed__text').lineHeight, rowHeight:root.querySelector('.feed__item').getBoundingClientRect().height,
          status:style('.device-line[data-state="ready"] > strong').color,
          ink:style('.feed__text').color };
      });
      assert(typography.heading === '18px' && parseFloat(typography.metric) >= 26, `${theme}/${width}: heading/metric size regressed ${JSON.stringify(typography)}`);
      assert(typography.label === '14px' && typography.feed === '16px' && parseFloat(typography.lineHeight) >= 27 && typography.rowHeight >= 48, `${theme}/${width}: reading density regressed ${JSON.stringify(typography)}`);
      assert(typography.status !== typography.ink, `${theme}/${width}: important status lost semantic color`);
      assert(await page.locator('.ops-row--count .ops-row__track').count() === 0, 'Event counts must not be rendered as percentages');
      assert(await page.locator('.surface-panel--env .env-card').first().innerText().then(t=>t.includes('--')), 'Missing temperature must remain unknown');
      assert(await page.locator('.clinical-staff li').count() === 2, 'Staff roster missing');
      assert(await page.locator('.feed__item').count() === 3, 'History missing');
      results.push({theme,width,...info});
      if (width===1920 || width===320) {
        for(const [name,selector] of [['handoff','.handoff-card'],['health','.data-health'],['operations','.nurse-panel__details-body > .surface-panel:not([class*="surface-panel--"])'],['environment','.surface-panel--env'],['response','.surface-panel--response'],['staff','.surface-panel--staff'],['feed','.surface-panel--feed']]) {
          const section = page.locator(selector);
          await section.scrollIntoViewIfNeeded();
          await section.screenshot({path:`output/playwright/clinical-${theme}-${width}-${name}.png`});
        }
      }
    }
    await page.setViewportSize({width:1440,height:1100});
    const button = page.locator('.station-charts__open');
    await button.scrollIntoViewIfNeeded();
    await page.mouse.move(0,0);
    const before = await button.evaluate(el=>getComputedStyle(el).backgroundImage);
    await button.hover();
    const hover = await button.evaluate(el=>getComputedStyle(el).backgroundImage);
    assert(before !== hover, `${theme}: hover state missing`);
    await page.mouse.move(0,0);
    assert(await button.evaluate(el=>getComputedStyle(el).backgroundImage) === before, `${theme}: mouseout did not restore`);
    await page.keyboard.press('Tab');
    await button.focus();
    assert(await button.evaluate(el=>getComputedStyle(el).outlineStyle) !== 'none', `${theme}: keyboard focus missing`);
    await page.keyboard.press('Enter');
    assert(await page.getByRole('tab',{name:/待办/}).getAttribute('aria-selected') === 'true', 'Queue action broken');
    await page.getByRole('tab',{name:'概览',exact:true}).click();
    const summary = page.locator('.clinical-sync > summary');
    await summary.scrollIntoViewIfNeeded(); await summary.focus(); await page.keyboard.press('Enter');
    assert(await page.locator('.data-health__freshness').isVisible(), 'Sync details cannot be opened');
    assert(await page.locator('.data-health__freshness').evaluate(el=>el.scrollWidth <= el.clientWidth + 2), `${theme}: expanded sync details overflow`);
    await page.keyboard.press('Enter');
    for(const state of ['ready','loading','error','stale']) {
      await page.evaluate(state=>window.commandFixture.setChartHealth(state),state);
      assert(await page.locator(`.data-health--${state}`).count()===1, `Missing ${state} health`);
      assert(await page.locator('.data-health > p').count()===(state==='ready'?0:1), 'Incomplete-data safety note lost');
    }
    await page.evaluate(()=>{window.commandFixture.setChartMetrics({deviceHealthRate:null}); window.commandFixture.setClinicalSync('error');});
    assert(!(await page.locator('.ops-list').innerText()).includes('null%'), 'Unknown online rate rendered as null percentage');
    assert((await page.locator('.handoff-card').innerText()).includes('同步异常'), 'Handoff error hidden');
    await page.evaluate(()=>window.commandFixture.setEmpty(true));
    assert((await page.locator('.handoff-card').innerText()).includes('暂不能确认'), 'Incomplete data must not declare no handoff');
    assert(await page.locator('.empty-feed').isVisible(), 'Empty feed missing');
    await page.evaluate(()=>window.commandFixture.setClinicalSource('mock'));
    assert(await page.locator('.surface-panel--response .env-card').count()===0, 'Unsupported source invents zero metrics');
    assert((await page.locator('.surface-panel--response').innerText()).includes('未用零值代替真实数据'), 'Source note missing');
    await page.evaluate(()=>{window.commandFixture.setEmpty(false);window.commandFixture.setClinicalSync('ready');window.commandFixture.setClinicalSource('remote');});
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(`${baseURL}/scripts/fixtures/nurse-light-command.html?clinical&integrated`);
  await page.locator('.clinical-overview').waitFor();
  await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.commandFixture.setTheme(theme),theme);
    for(const width of [1920,1024]) {
      await page.setViewportSize({width,height:1080});
      const overflow = await page.locator('.clinical-overview').evaluate(root=>[...root.querySelectorAll('.handoff-card,.data-health,.surface-panel,.env-card,.clinical-staff li')].filter(el=>el.checkVisibility()&&el.scrollWidth>el.clientWidth+2).map(el=>el.className));
      assert(!overflow.length, `Integrated ${theme}/${width} overflow: ${overflow}`);
      if(width===1920) {
        await page.locator('.handoff-card').scrollIntoViewIfNeeded();
        await page.locator('.digital-twin__panel').screenshot({path:`output/playwright/clinical-integrated-${theme}.png`});
      }
    }
  }
  assert(!errors.length, errors.join(';'));
  return {passed:true,cases:results.length,integratedCases:4,results};
}
