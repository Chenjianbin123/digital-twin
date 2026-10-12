async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => window.assistantFixture.setScene('nurse-station'));
  const panel = page.locator('#ai-assistant-panel');
  if (!await panel.isVisible()) await page.getByRole('button', { name: 'AI 助手', exact: true }).click();
  if (!await panel.getByRole('button', { name: '清空对话', exact: true }).isVisible()) await panel.locator('summary').click();
  await panel.getByRole('button', { name: '清空对话', exact: true }).click();
  await panel.locator('summary').click();
  await panel.getByRole('button', { name: '查看未处理呼叫', exact: true }).click();
  await panel.locator('.ai-assistant__card').first().waitFor();
  for (const theme of ['dark', 'light']) {
    await page.evaluate(value => window.assistantFixture.setTheme(value), theme);
    await page.screenshot({ path: `output/playwright/ai-assistant-final-${theme}.png` });
  }
  return { passed: true, screenshots: ['ai-assistant-final-dark.png', 'ai-assistant-final-light.png'] };
}
