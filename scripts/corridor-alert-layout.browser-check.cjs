async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html');
  await page.locator('.corridor-alerts').waitFor();
  await page.evaluate(() => window.wardSidebarFixture.setTheme('dark'));
  const results = [];
  for (const panelWidth of [600,538,400,320]) {
    await page.setViewportSize({width:panelWidth===600 ? 2560 : panelWidth===538 ? 1920 : 1024,height:1800});
    await page.locator('.fixture-panel').evaluate((el,width) => {el.style.width=`${width}px`;},panelWidth);
    const geometry = await page.locator('.corridor-alerts').evaluate(root => {
      const cards = [...root.querySelectorAll('.alert-task')];
      const overflow = cards.flatMap(card => {
        const bound=card.getBoundingClientRect();
        return [...card.querySelectorAll('.alert-task__main,.alert-task__actions,button,.alert-task__unlocated,.alert-task__recovery-tip')].filter(el=>{
          const r=el.getBoundingClientRect();
          return r.left<bound.left-1 || r.right>bound.right+1 || el.scrollWidth>el.clientWidth+1;
        }).map(el=>el.className);
      });
      const main=cards[0].querySelector('.alert-task__main').getBoundingClientRect();
      const actions=cards[0].querySelector('.alert-task__actions').getBoundingClientRect();
      return {overflow,sideBySide:actions.left>=main.right,stacked:actions.top>=main.bottom,height:cards[0].getBoundingClientRect().height};
    });
    assert(!geometry.overflow.length, `${panelWidth} overflow ${geometry.overflow}`);
    if(panelWidth===600) assert(geometry.sideBySide,'Wide card actions must occupy the right side');
    if(panelWidth===320) assert(geometry.stacked,'Narrow card actions must move below the information');
    await page.locator('.corridor-alerts').screenshot({path:`output/playwright/corridor-alert-layout-${panelWidth}.png`});
    results.push({panelWidth,...geometry});
  }
  await page.locator('.alert-task').first().getByRole('button',{name:'确认响应'}).focus();
  await page.keyboard.press('Enter');
  await page.locator('.alert-task').first().getByRole('button',{name:'定位床位'}).click();
  assert(await page.locator('.alert-task__unlocated').count()>0,'Unavailable location text missing');
  assert(await page.evaluate(()=>['ack','locate'].every(name=>window.wardSidebarFixture.events.some(event=>event[0]===name))),'Actions no longer emit');
  await page.getByRole('tablist',{name:'告警任务筛选'}).getByRole('tab').first().focus();
  await page.keyboard.press('ArrowRight');
  assert(await page.locator('.alert-task-panel__empty').isVisible(),'Handling filter failed');
  return {passed:true,results};
}
