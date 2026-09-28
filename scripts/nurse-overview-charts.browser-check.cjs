async page => {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?charts');
  const tabs = page.getByRole('tablist', { name: '护士站工作区' });
  await tabs.getByRole('tab', { name: '概览', exact: true }).click();
  await page.getByRole('meter', { name: '床位使用率', exact: true }).waitFor();
  assert(await page.getByRole('meter').first().getAttribute('aria-valuenow') === '75', 'Occupancy must use 15/20');
  assert(JSON.stringify(await page.locator('.event-meter__count').allTextContents()) === JSON.stringify(['6项', '4项', '2项']), 'Category counts mismatch');
  const colors = {};
  for (const theme of ['light', 'dark']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    for (const width of [1440, 1024, 768, 320]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.waitForFunction(value => document.querySelector('main').dataset.theme === value, theme);
      const layout = await page.locator('.station-charts').evaluate(root => {
        const outer = root.getBoundingClientRect();
        const bad = [...root.querySelectorAll('h2,h3,dt,dd,button,.event-meter,.event-meter__label,.event-meter__count,.usage-gauge')].filter(el => {
          const r = el.getBoundingClientRect();
          return r.left < outer.left - 1 || r.right > outer.right + 1 || el.scrollWidth > el.clientWidth + 1;
        }).map(el => el.className || el.tagName);
        return { bad, ink: getComputedStyle(root).color, surface: getComputedStyle(root.querySelector('.station-chart')).backgroundColor };
      });
      assert(!layout.bad.length, `${theme} ${width} overflow: ${layout.bad}`);
      const chartStyle = await page.locator('.station-chart--beds').evaluate(el => ({
        background: getComputedStyle(el).backgroundImage,
        titleSize: parseFloat(getComputedStyle(el.querySelector('h3')).fontSize),
        stroke: getComputedStyle(el.querySelector('.usage-gauge__fill')).strokeWidth,
      }));
      assert(!chartStyle.background.includes('linear-gradient'), 'Full-card grid returned');
      assert(chartStyle.titleSize >= 19 && chartStyle.stroke === '12px', 'Reference typography or gauge weight regressed');
      colors[theme] = layout;
      const buttonColors = await page.locator('.station-charts__open').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, expected: getComputedStyle(el).getPropertyValue('--chart-inset').trim() }));
      assert(buttonColors.background === (theme === 'light' ? 'rgb(237, 247, 255)' : 'rgb(16, 45, 69)'), `Wrong ${theme} CTA background: ${JSON.stringify(buttonColors)}`);
      await page.setViewportSize({ width, height: 1800 });
      await page.locator('.station-charts').screenshot({ path: `output/playwright/nurse-charts-${theme}-${width}.png` });
    }
  }
  assert(colors.light.ink !== colors.dark.ink && colors.light.surface !== colors.dark.surface, 'Theme did not change computed chart colors');
  await page.evaluate(() => window.commandFixture.setHandled(true));
  await page.waitForFunction(() => document.querySelector('.station-chart__total strong').textContent === '11');
  assert((await page.locator('.event-meter__count').allTextContents())[0] === '5项', 'Handling items still counted');
  for (const [occupied, total, value] of [[0,20,'0'], [20,20,'100']]) {
    await page.evaluate(({occupied,total}) => window.commandFixture.setChartMetrics({ occupied, totalBeds: total, empty: total - occupied }), { occupied, total });
    await page.waitForFunction(value => document.querySelector('.usage-gauge').getAttribute('aria-valuenow') === value, value);
  }
  await page.evaluate(() => { window.commandFixture.setChartMetrics({occupied:0,totalBeds:0,empty:0}); window.commandFixture.setEmpty(true); });
  await page.getByText('暂无床位数据，暂不计算使用率', { exact: true }).waitFor();
  assert(await page.locator('.usage-gauge__fill').count() === 0, 'Empty gauge must not imply a value');
  assert(await page.locator('.event-meter__marker').count() === 0, 'Zero event bars must not show active markers');
  await page.getByText('当前暂无待处理事件', { exact: true }).waitFor();
  for (const status of ['loading','warning','stale','error']) {
    await page.evaluate(value => window.commandFixture.setChartHealth(value), status);
    await page.getByText('数据未完全同步，仅统计当前已获取的待处理事项', {exact:true}).waitFor();
    assert(await page.getByText('当前暂无待处理事件', {exact:true}).count() === 0, 'Unknown data presented as no pending items');
  }
  await page.evaluate(() => { window.commandFixture.setChartMetrics({}); window.commandFixture.setEmpty(false); window.commandFixture.setHandled(false); window.commandFixture.setChartHealth('ready'); });
  await page.setViewportSize({width:1440,height:1080});
  await page.getByRole('button', {name:'查看事件队列'}).focus();
  await page.keyboard.press('Enter');
  assert(await page.locator('.station-charts').count() === 0, 'Hidden overview charts were not unmounted');
  assert(await tabs.getByRole('tab', {name:/^待办/}).evaluate(el => el === document.activeElement), 'Focus lost after opening tasks');
  await tabs.getByRole('tab', {name:'概览',exact:true}).click();
  await page.getByText('运行详情',{exact:true}).click();
  assert(await page.locator('.metric-item').count() === 6, 'Original six KPIs removed');
  for (const theme of ['light','dark']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    await page.getByRole('button', {name:'进入护士站大屏模式'}).click();
    assert(await page.locator('.station-charts').count() === 1, 'Wallboard overview missing');
    assert(await page.getByRole('button', {name:'查看事件队列'}).count() === 0, 'Wallboard has unusable task CTA');
    await page.getByRole('button', {name:'退出护士站大屏模式'}).click();
  }
  assert(errors.length === 0, `Page errors: ${errors}`);
  return {passed:true, widths:[1440,1024,768,320], themes:colors, checks:'ratios, counts, pending scope, empty, loading/warning/stale/error, keyboard, unmount, original KPIs, wallboard'};
}
