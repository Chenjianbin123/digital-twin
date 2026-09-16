async page => {
  const check = (value, message) => { if (!value) throw Error(message); };
  await page.getByRole('button', { name: '病房走廊', exact: true }).click();
  await page.locator('.corridor-tools').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.scene-switch-loader'), null, { timeout: 60000 });
  const nav = page.getByRole('navigation', { name: '定位病房', exact: true });
  check(await nav.locator('button').count() === 10, 'ten room navigation entries');
  check(await page.locator('.area-scene-3d__node-debug').count() === 0, 'no production node debug');
  const data = await page.evaluate(async () => {
    const { useTwinStore } = await import('/src/stores/twin-store.ts');
    const store = useTwinStore();
    const { stopStatusPusher } = await import('/src/services/status-pusher.ts');
    stopStatusPusher();
    window.corridorAuditStore = store;
    window.corridorAuditArea = JSON.parse(JSON.stringify(store.area));
    return store.area.rooms.map(room => room.sickroomName);
  });
  const report = { roomCount: data.length, roomNavigation: [], viewports: [] };
  for (let index = 0; index < data.length; index++) {
    await nav.locator('button').nth(index).click();
    check(await nav.locator('button').nth(index).getAttribute('aria-pressed') === 'true', 'room selected ' + index);
    check(await page.locator('.corridor-tools__selected').innerText().then(text => text.includes(data[index])), 'selected label');
    report.roomNavigation.push(data[index]);
  }
  await page.locator('.corridor-tools__selected button').click();
  await page.waitForFunction(() => window.corridorAuditStore.sceneType === 'ward-interior');
  await page.getByRole('button', { name: '病房走廊', exact: true }).click();
  check(await nav.locator('button').last().getAttribute('aria-pressed') === 'true', 'return preserves room');
  await page.getByRole('button', { name: '恢复总览', exact: true }).click();
  check(await nav.locator('[aria-pressed="true"]').count() === 0, 'overview clears selection');
  await nav.locator('button').first().focus();
  await page.keyboard.press('ArrowRight');
  check(await nav.locator('button').nth(1).getAttribute('aria-pressed') === 'true', 'keyboard selects next');
  await page.keyboard.press('Escape');
  check(await nav.locator('[aria-pressed="true"]').count() === 0, 'escape resets');
  await page.evaluate(() => {
    const store = window.corridorAuditStore;
    store.area.rooms.reverse();
  });
  await page.waitForFunction(() => document.querySelector('.corridor-tools nav button strong')?.textContent === '301房');
  check(await nav.locator('button strong').allTextContents().then(names => JSON.stringify(names) === JSON.stringify(data)), 'reorder preserves slots');
  await page.evaluate(() => {
    const room = JSON.parse(JSON.stringify(window.corridorAuditArea.rooms[0]));
    Object.assign(room, { sickroomCode: 'AUDIT-11', sickroomId: 'AUDIT-11', sickroomName: '测试扩展房', deviceCode: 'AUDIT-11', beds: [] });
    window.corridorAuditStore.area.rooms.push(room);
  });
  await page.getByRole('button', { name: '下一组', exact: true }).click();
  check(await nav.innerText().then(text => text.includes('测试扩展房')), 'overflow room reachable');
  await page.getByRole('button', { name: '上一组', exact: true }).click();
  await page.evaluate(() => { window.corridorAuditStore.area.rooms = []; });
  await page.getByText('当前病区暂无病房数据', { exact: true }).waitFor();
  check(await page.locator('.corridor-tools nav button').count() === 0, 'empty data clears stale navigation');
  await page.evaluate(() => { window.corridorAuditStore.area = JSON.parse(JSON.stringify(window.corridorAuditArea)); });
  for (const [width, height] of [[320, 640], [768, 1024], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '恢复总览', exact: true }).click();
    const box = await page.locator('.corridor-tools').boundingBox();
    check(box && box.x >= 0 && box.x + box.width <= width + 1, 'toolbar fits ' + width);
    await page.getByRole('button', { name: '收起房号', exact: true }).click();
    const collapsed = await page.locator('.corridor-tools').boundingBox();
    check(collapsed && collapsed.height < box.height, 'collapse frees scene space ' + width);
    check(!await nav.isVisible(), 'collapsed navigation is hidden ' + width);
    await page.getByRole('button', { name: '展开房号', exact: true }).click();
    check(await nav.isVisible(), 'navigation restored ' + width);
    const button = page.getByRole('button', { name: '恢复总览', exact: true });
    check(await button.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'reset not occluded ' + width);
    await page.screenshot({ path: 'output/playwright/ward-upgrade-' + width + '.jpg' });
    report.viewports.push({ width, height, toolbar: box });
  }
  const theme = page.getByRole('button', { name: '切换深色主题' });
  if (await theme.count()) await theme.click();
  check(await page.locator('.corridor-tools').evaluate(el => getComputedStyle(el).backgroundColor === 'rgb(16, 39, 53)'), 'dark navigation surface');
  await page.screenshot({ path: 'output/playwright/ward-upgrade-dark.jpg' });
  await page.evaluate(report => { window.wardCorridorAudit = report; }, report);
  return report;
}
