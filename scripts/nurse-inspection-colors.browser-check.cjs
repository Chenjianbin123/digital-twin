async page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const color = (selector, property = 'color') => page.locator(selector).first().evaluate((el, prop) => getComputedStyle(el)[prop], property);
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?inspection');
  await page.setViewportSize({ width: 600, height: 1200 });
  const tabs = page.getByRole('tablist', { name: '护士站工作区' });
  await tabs.getByRole('tab', { name: '巡视' }).click();
  assert(await page.locator('.focus-room').count() === 3, 'Representative room cards missing');
  assert(await color('.focus-room', 'backgroundColor') === 'rgb(237, 248, 255)', 'Room still inherits gray background');
  assert(await color('.focus-room__main strong') === 'rgb(6, 51, 101)', 'Room heading still inherits green');
  assert(await color('.inspection-metric', 'backgroundColor') === 'rgb(255, 255, 255)', 'Metric surface is not white');
  assert(await color('.inspection-metric--normal strong') === 'rgb(19, 133, 104)', 'Normal status color lost');
  assert(await color('.inspection-metric--due strong') === 'rgb(149, 98, 10)', 'Due status color lost');
  assert(await color('.inspection-metric--overdue strong') === 'rgb(194, 47, 80)', 'Overdue status color lost');
  await tabs.getByRole('tab', { name: '概览' }).hover();
  assert(await color('.workspace-tabs button[aria-selected="false"]:hover', 'backgroundColor') === 'rgb(228, 245, 255)', 'Inactive tab hover still gray');
  await page.mouse.move(1, 1);
  await page.locator('.focus-room').first().focus();
  await page.keyboard.press('Enter');
  assert(await page.evaluate(() => window.commandFixture.events.some(([type, index]) => type === 'focus-room' && index === 0)), 'Room navigation emit changed');
  await page.locator('.focus-room').first().evaluate(el => el.blur());
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1200 });
    const overflow = await page.locator('.inspection-workspace').evaluate(root => {
      const bounds = root.getBoundingClientRect();
      return [...root.querySelectorAll('button, article')].some(el => {
        const rect = el.getBoundingClientRect();
        return rect.left < bounds.left - 1 || rect.right > bounds.right + 1 || el.scrollWidth > el.clientWidth + 1;
      });
    });
    assert(!overflow, `Inspection overflow at ${width}`);
    if (width === 320) await page.screenshot({ path: 'output/playwright/nurse-inspection-colors-320.png' });
  }
  await page.setViewportSize({ width: 600, height: 1200 });
  const tabBounds = await tabs.boundingBox();
  const roomsBounds = await page.locator('.surface-panel--focus').boundingBox();
  await page.screenshot({ path: 'output/playwright/nurse-inspection-colors.png', clip: {
    x: 16, y: tabBounds.y - 8, width: 576, height: roomsBounds.y + roomsBounds.height - tabBounds.y + 20,
  } });
  await page.evaluate(() => window.commandFixture.setInspectionStates(['normal', 'due', 'overdue']));
  assert((await page.locator('.inspection-metric strong').allTextContents()).join(',') === '1,1,1', 'Inspection counts changed');
  assert(await color('.inspection-overview__rooms em.is-due') === 'rgb(149, 98, 10)', 'Due badge color lost');
  assert(await color('.inspection-overview__rooms em.is-overdue') === 'rgb(181, 38, 72)', 'Overdue badge color lost');
  await page.evaluate(() => window.commandFixture.setTheme('dark'));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.focus-room')).backgroundColor === 'rgba(12, 34, 46, 0.62)');
  assert(await color('.focus-room', 'backgroundColor') !== 'rgb(237, 248, 255)', 'Light room background leaked into dark theme');
  assert(await color('.focus-room__main strong') !== 'rgb(6, 51, 101)', 'Light text leaked into dark theme');
  assert(!errors.length, `Browser errors: ${errors.join('; ')}`);
  await page.evaluate(() => window.commandFixture.setTheme('light'));
  console.log('PASS: inspection colors, tab hover, semantic states, keyboard room navigation, 4 viewport widths, dark isolation; no page errors.');
}
