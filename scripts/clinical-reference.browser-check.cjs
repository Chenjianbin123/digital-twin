async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const origin = await page.evaluate(() => location.origin);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/scripts/fixtures/nurse-light-command.html?clinical&reference`);
  await page.locator('.clinical-overview').waitFor();
  await page.setViewportSize({width:2560,height:1900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('.fixture-panel').evaluate(el => el.style.width='548px');
  await page.evaluate(() => {
    window.commandFixture.setChartHealth('warning');
    window.commandFixture.setChartMetrics({deviceOnline:2,deviceTotal:21,deviceHealthRate:10});
  });
  const sections = [
    ['action','.station-charts__open'], ['handoff','.handoff-card'], ['health','.data-health'],
    ['operations','.nurse-panel__details-body > .surface-panel:not([class*="surface-panel--"])'],
    ['environment','.surface-panel--env'], ['response','.surface-panel--response'],
    ['staff','.surface-panel--staff'], ['feed','.surface-panel--feed'],
  ];
  const sizes = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(theme => window.commandFixture.setTheme(theme), theme);
    assert(await page.locator('.handoff-card li').count()===2,'Reference handoff must have two metrics');
    assert((await page.locator('.handoff-card').innerText()).match(/200/g)?.length===2,'Reference counts missing');
    assert(await page.locator('.handoff-card__sync').isVisible(),'Sync note missing');
    const layout = await page.locator('.clinical-overview').evaluate(root => {
      const health = root.querySelector('.data-health li');
      const operation = root.querySelector('.ops-row');
      const env = root.querySelector('.env-card');
      return {
        gap:getComputedStyle(root).gap,
        barRatio:operation.querySelector('.ops-row__track i').getBoundingClientRect().width/operation.querySelector('.ops-row__track').getBoundingClientRect().width,
        healthHeight:health.getBoundingClientRect().height,
        operationHeight:operation.getBoundingClientRect().height,
        envHeight:env.getBoundingClientRect().height,
        healthInline:Math.abs(health.querySelector('span').getBoundingClientRect().y-health.querySelector('small').getBoundingClientRect().y)<5,
        iconSideBySide:env.querySelector('svg').getBoundingClientRect().right<env.querySelector('span').getBoundingClientRect().left,
      };
    });
    assert(layout.healthInline && layout.healthHeight<38,`${theme}: health rows expanded ${JSON.stringify(layout)}`);
    assert(layout.iconSideBySide && layout.envHeight<64,`${theme}: metric tile expanded ${JSON.stringify(layout)}`);
    assert(layout.operationHeight<38,`${theme}: operations not compact ${JSON.stringify(layout)}`);
    assert(layout.gap==='10px',`${theme}: inconsistent section spacing`);
    assert(Math.abs(layout.barRatio-.75)<.01,`${theme}: percentage bar does not match 75% ${JSON.stringify(layout)}`);
    for (const [name,selector] of sections) {
      const section = page.locator(selector);
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({path:`output/playwright/reference-${theme}-${name}.png`});
      sizes.push({theme,name,...await section.boundingBox()});
    }
    const action=page.locator('.station-charts__open');
    await action.hover();
    await action.screenshot({path:`output/playwright/reference-${theme}-hover.png`});
    await page.mouse.move(0,0);
    await action.screenshot({path:`output/playwright/reference-${theme}-mouseout.png`});
  }
  // Theme changes must not change card geometry when the business state is identical.
  for (const [name] of sections) {
    const light=sizes.find(item=>item.name===name && item.theme==='light');
    const dark=sizes.find(item=>item.name===name && item.theme==='dark');
    assert(Math.abs(light.height-dark.height)<2 && Math.abs(light.width-dark.width)<2,`${name}: theme geometry differs ${JSON.stringify({light,dark})}`);
  }
  assert(!errors.length,errors.join(';'));
  await page.goto(`${origin}/scripts/fixtures/clinical-actual-comparison.html`);
  await page.setViewportSize({width:1120,height:1600});
  await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({path:'output/playwright/clinical-actual-comparison.png',fullPage:true});
  return {passed:true,sizes,errors};
}
