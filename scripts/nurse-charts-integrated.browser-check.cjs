async page => {
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('http://127.0.0.1:5174/scripts/fixtures/nurse-light-command.html?charts&integrated');
  const tabs = page.getByRole('tablist', {name:'护士站工作区'});
  await tabs.waitFor();
  await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
  page.on('request', request => { if (/\/swp\//.test(request.url())) requests.push(request.url()); });
  for (const theme of ['light','dark']) {
    await page.evaluate(value => window.commandFixture.setTheme(value), theme);
    await tabs.getByRole('tab', {name:'概览',exact:true}).click();
    await page.getByRole('meter',{name:'床位使用率',exact:true}).waitFor();
    const stats = await page.locator('.usage-gauge').getAttribute('aria-valuenow');
    if (stats !== '75') throw new Error(`Integrated data mismatch: ${stats}`);
    await page.locator('.workspace-scroll').evaluate(el => el.scrollTop = 0);
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.overview-workspace')).opacity === '1');
    await page.screenshot({path:`output/playwright/nurse-charts-integrated-${theme}.png`});
    const panel = await page.locator('.digital-twin__panel').evaluate(el => ({width:el.clientWidth, scroll:el.scrollWidth}));
    if (panel.scroll > panel.width + 1) throw new Error(`Integrated overflow ${theme}`);
    await tabs.getByRole('tab', {name:/^待办/}).click();
    if (await page.locator('.station-charts').count()) throw new Error('Charts remain mounted in tasks');
  }
  if (errors.length || requests.length) throw new Error(JSON.stringify({errors,requests}));
  return {passed:true, realWorkspace:true, syntheticData:true, errors, addedSwpRequests:requests.length};
}
