async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?charts');
  const tabs = page.getByRole('tablist', {name:'护士站工作区'});
  await tabs.waitFor();
  const results = [];
  for (const theme of ['light','dark']) {
    await page.evaluate(value => { window.commandFixture.setTheme(value); window.commandFixture.setChartHealth('warning'); }, theme);
    for (const width of [1440,1024,768,320]) {
      await page.setViewportSize({width,height:1800});
      await tabs.getByRole('tab', {name:'概览',exact:true}).click();
      await page.waitForFunction(() => document.querySelectorAll('.station-chart__notice[data-tone="warning"]').length === 2);
      const chart = await page.locator('.station-charts').evaluate(root => {
        const style = selector => getComputedStyle(root.querySelector(selector));
        const luminance = value => {
          const c = value.match(/\d+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; });
          return c[0]*.2126+c[1]*.7152+c[2]*.0722;
        };
        const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
        const notice = style('.station-chart__notice');
        const numbers = [...root.querySelectorAll('.event-meter__count')].map(el => getComputedStyle(el).color);
        const bad = [...root.querySelectorAll('h3,p,dt,dd,.event-meter,.station-chart__total')].filter(el => el.scrollWidth>el.clientWidth+1).map(el=>el.className);
        return {bad, numbers, occupied:style('[data-kind="occupied"] dd').color,empty:style('[data-kind="empty"] dd').color,title:style('h3').fontSize,label:style('.event-meter__label').fontSize,noticeContrast:contrast(notice.color,notice.backgroundColor),numberContrasts:numbers.map(c=>contrast(c,style('.station-chart--events').backgroundColor))};
      });
      assert(!chart.bad.length, `${theme}/${width} overflow: ${chart.bad}`);
      assert(chart.occupied !== chart.empty && new Set(chart.numbers).size===3, 'Semantic color hierarchy missing');
      assert(chart.noticeContrast>=4.5 && chart.numberContrasts.every(c=>c>=4.5), `Contrast failed: ${JSON.stringify(chart)}`);
      assert(parseFloat(chart.title)>=19 && parseFloat(chart.label)>=13, 'Typography regressed');
      if (width===1440 || width===320) await page.locator('.station-charts').screenshot({path:`output/playwright/nurse-charts-emphasis-${theme}-${width}.png`});
      await tabs.getByRole('tab', {name:/^待办/}).click();
      const fonts = await page.locator('.nurse-panel').evaluate(root => {
        const size = selector => parseFloat(getComputedStyle(root.querySelector(selector)).fontSize);
        return {title:size('.alert-task__head strong'),body:size('.alert-task__subtitle'),meta:size('.alert-task__meta span'),category:size('.queue-categories button > span:not(.nurse-workspace-icon)')};
      });
      assert(fonts.title>=16 && fonts.body>=14 && fonts.meta>=13 && fonts.category>=13, `Sidebar font mismatch: ${JSON.stringify(fonts)}`);
      results.push({theme,width,chart,fonts});
    }
  }
  await tabs.getByRole('tab',{name:'概览',exact:true}).click();
  await page.evaluate(() => { window.commandFixture.setChartHealth('ready'); window.commandFixture.setChartMetrics({occupied:0,totalBeds:0,empty:0}); window.commandFixture.setEmpty(true); });
  await page.waitForFunction(() => document.querySelectorAll('.station-chart__notice[data-tone="neutral"]').length === 2);
  assert(await page.locator('.station-chart__notice[data-tone="warning"]').count() === 0, 'Empty data incorrectly styled as warning');
  return {passed:true,results};
}
