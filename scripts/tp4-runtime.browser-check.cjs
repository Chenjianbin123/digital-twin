async page => {
  await page.setContent('<canvas id="fixture-image" width="100" height="100"></canvas>');
  await page.evaluate(() => {
    const ctx = document.querySelector('#fixture-image').getContext('2d');
    ctx.fillStyle = '#dbeafe'; ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = '#123456'; ctx.font = '13px sans-serif'; ctx.fillText('TEST IMAGE', 8, 52);
  });
  const testImage = await page.locator('#fixture-image').screenshot();
  // 存量模板引用终端图片目录；验证时使用明确标识的合成图，不访问医院文件服务器。
  await page.context().route('**/swp_upload/**', route => route.fulfill({
    status: 200, contentType: 'image/png', body: testImage,
  }));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/tp4-runtime-preview.html');
  await page.waitForFunction(() => !!window.tp4Result);
  const result = await page.evaluate(() => window.tp4Result);
  await page.screenshot({ path: 'output/playwright/tp4-runtime-preview.png', fullPage: true });
  if (!result.passed) throw new Error(JSON.stringify(result));
  return result;
}
