async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 600, height: 1550 });
  const more = page.getByRole('button', { name: '查看更多事件' });
  await more.waitFor();
  const style = await more.evaluate(el => {
    const button = getComputedStyle(el), wrapper = getComputedStyle(el.parentElement);
    return { bg: button.backgroundColor, color: button.color, wrapperBg: wrapper.backgroundColor };
  });
  assert(style.bg === 'rgb(234, 246, 255)' && style.color === 'rgb(8, 110, 157)', `Legacy footer colors: ${JSON.stringify(style)}`);
  assert(style.wrapperBg === 'rgb(245, 251, 255)', 'Legacy footer wrapper background');
  await more.hover();
  assert(await more.evaluate(el => getComputedStyle(el).backgroundColor) === 'rgb(217, 239, 252)', 'Footer hover reverted to dark green');
  await page.mouse.move(1, 1);
  for (const width of [320, 580]) {
    await page.setViewportSize({ width, height: 1550 });
    const timeStyle = await page.locator('.task-timeline-time').first().evaluate(el => {
      const clock = el.querySelector('.task-timeline-time__clock'), date = el.querySelector('.task-timeline-time__date');
      const style = getComputedStyle(clock), bounds = el.getBoundingClientRect();
      return { font: style.fontFamily, size: style.fontSize, digits: getComputedStyle(el).fontVariantNumeric,
        contained: [clock, date].every(child => { const box = child.getBoundingClientRect(); return box.left >= bounds.left - 1 && box.right <= bounds.right + 1; }) };
    });
    assert(timeStyle.font.includes('Consolas') && timeStyle.digits === 'tabular-nums', 'Timeline numeral styling missing');
    assert(timeStyle.size === (width === 320 ? '13px' : '18px') && timeStyle.contained, `Timeline text squeezed: ${JSON.stringify(timeStyle)}`);
    const good = await page.locator('.alert-task').first().evaluate(el => {
      const main = el.querySelector('.alert-task__main'), meta = el.querySelector('.alert-task__meta'), detail = el.querySelector('.alert-task__details');
      const a = meta.getBoundingClientRect(), b = detail.getBoundingClientRect();
      return getComputedStyle(main).backgroundColor === 'rgb(255, 255, 255)' && a.right <= b.left + 1;
    });
    assert(good, `Card styling or status/details overlap at ${width}`);
    const filters = page.getByRole('tablist', { name: '告警任务筛选' });
    assert(await filters.getByRole('tab').evaluateAll(tabs => tabs.every(el => el.getBoundingClientRect().height >= 40 && el.scrollWidth <= el.clientWidth)), `Filter targets/overflow at ${width}`);
    const section = await page.locator('.tasks-workspace').boundingBox();
    await page.screenshot({ path: `output/playwright/nurse-queue-polish-${width}.png`, clip: {
      x: Math.max(0, section.x - 8), y: section.y - 8, width: section.width + 16, height: section.height + 16,
    } });
  }
  return { passed: true, checks: ['footer-base-hover-colors', 'white-event-cards', 'status-details-separation', 'filter-hit-targets', 'mobile-and-desktop-screenshots'] };
}
