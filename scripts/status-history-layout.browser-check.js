// 在正式组件预览页，将此只读表达式传给 cua 的 tab.playwright.evaluate。
// 同时识别旧字段类与新字段标记，以捕获类别和描述占用同一网格位置的回归。
(() => {
  const rows = [...document.querySelectorAll('.status-history li')];
  const issues = [];
  let visibleRows = 0;
  for (const [index, row] of rows.entries()) {
    if (!row.getClientRects().length) continue;
    visibleRows++;
    const fields = [...row.querySelectorAll('[data-history-field], .time, .category, .room, .bed, .label')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).display !== 'none');
    if (fields.length < 4) issues.push(`row ${index}: missing history fields`);
    if (new Set(fields.map(node => getComputedStyle(node).fontSize)).size > 1)
      issues.push(`row ${index}: inconsistent field font sizes`);
    for (let i = 0; i < fields.length; i++) {
      const a = fields[i].getBoundingClientRect();
      if (fields[i].scrollWidth > fields[i].clientWidth + 1)
        issues.push(`row ${index}: ${fields[i].className} overflows`);
      for (let j = i + 1; j < fields.length; j++) {
        const b = fields[j].getBoundingClientRect();
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1
          && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
          issues.push(`row ${index}: ${fields[i].className} overlaps ${fields[j].className}`);
      }
    }
  }
  if (!visibleRows) throw new Error('No visible history records: expand the fixture first');
  if (issues.length) throw new Error(issues.join('; '));
  return { pass: true, visibleRows };
})()
