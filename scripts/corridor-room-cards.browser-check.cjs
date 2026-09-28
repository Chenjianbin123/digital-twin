async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html?room-cards');
  await page.locator('.room-card').first().waitFor();
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => window.wardSidebarFixture.setTheme(theme), theme);
    for (const width of [2560,1440,1024,768,400,320]) {
      await page.setViewportSize({width,height:1500});
      const info = await page.locator('.room-card').first().evaluate(root => {
        const outer = root.getBoundingClientRect();
        const elements = [...root.querySelectorAll('.room-card__name,.room-card__inspection small,.staff-role-card,.staff-role-card__name,.bed-chip,.bed-chip span,.room-card__enter')];
        const overflow = elements.filter(el => el.checkVisibility()).filter(el => {const rect=el.getBoundingClientRect();return el.scrollWidth>el.clientWidth+1 || rect.left<outer.left-1 || rect.right>outer.right+1;}).map(el=>el.className);
        const size = s => parseFloat(getComputedStyle(root.querySelector(s)).fontSize);
        return {overflow,name:size('.room-card__name'),bed:size('.bed-chip__no'),patient:size('.bed-chip__patient'),inspection:size('.room-card__inspection small'),staff:size('.staff-role-card__name'),gap:getComputedStyle(root.querySelector('.room-card__beds')).rowGap};
      });
      assert(!info.overflow.length, `${theme}/${width} overflow ${info.overflow}`);
      assert(info.name>=20 && info.bed>=16 && info.patient>=16 && info.inspection>=14 && info.staff>=16, `Small text: ${JSON.stringify(info)}`);
      assert(parseFloat(info.gap)>=8, 'Bed rows are touching');
      const card = page.locator('.room-card').first();
      const columns = await card.locator('.room-card__beds').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      const cardWidth = await card.evaluate(el => el.clientWidth);
      assert(columns === (cardWidth <= 340 ? 1 : 2), `Unexpected bed columns ${theme}/${width}: ${columns}`);
      assert(await card.locator('.bed-chip').count() === 5, 'Bed identity/count changed');
      assert(await card.locator('.room-card__capacity-track i').evaluate(el => el.style.width) === '80%', 'Occupancy bar incorrect');
      assert(await page.locator('.room-card').last().locator('.room-card__capacity').count() === 0, 'Zero-bed occupancy bar must be absent');
      assert(await page.locator('.room-card').last().getByText('暂无床位数据').isVisible(), 'Empty room state missing');
      assert(await card.locator('.room-card__team').getAttribute('open') === null, 'Team should start collapsed');
      assert(await card.locator('.room-card__inspection--overdue').isVisible(), 'Inspection warning hidden');
      assert(await card.locator('.bed-chip--calling').isVisible(), 'Calling bed hidden');
      assert(!(await card.locator('.bed-chip__patient').allTextContents()).includes('测试患者'), 'Patient name masking lost');
      await page.evaluate(() => document.activeElement?.blur());
      if ([1440,320].includes(width)) await card.screenshot({path:`output/playwright/corridor-room-command-${theme}-${width}.png`});
      const before = await page.evaluate(() => window.wardSidebarFixture.events.length);
      await card.locator('.room-card__team summary').focus();
      await page.keyboard.press('Enter');
      assert(await card.locator('.staff-role-card').first().isVisible(), 'Keyboard team expansion failed');
      assert(await page.evaluate(() => window.wardSidebarFixture.events.length) === before, 'Team expansion unexpectedly focused room');
      const teamOverflow = await card.locator('.staff-role-card').evaluateAll(els => els.some(el => el.scrollWidth > el.clientWidth + 1));
      assert(!teamOverflow, 'Expanded staff overflow');
      await card.locator('.room-card__team summary').focus();
      await page.keyboard.press('Enter');
      results.push({theme,width,...info});
    }
  }
  await page.locator('.room-card__enter').first().focus();
  await page.keyboard.press('Enter');
  assert(await page.evaluate(()=>window.wardSidebarFixture.events.some(([name,index])=>name==='enter'&&index===0)), 'Enter room keyboard action failed');
  return {passed:true,results};
}
