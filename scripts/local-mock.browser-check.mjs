import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

// 可通过环境变量指定已安装的 Playwright；不下载浏览器或依赖。
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOCAL_MOCK_PLAYWRIGHT || 'playwright');
const origin = process.env.LOCAL_MOCK_ORIGIN || 'http://127.0.0.1:5180';
const directory = 'output/playwright/local-mock';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.LOCAL_MOCK_BROWSER_CHANNEL || 'msedge' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
const forbidden = [], errors = [], failures = [];
await context.route('**/*', async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== origin || request.method() !== 'GET'
    || /^\/(swp(?:\/|$)|swp_upload(?:\/|$)|db-adapter(?:\/|$)|config\.json)/.test(url.pathname)) {
    forbidden.push({ path: url.pathname, method: request.method() });
    await route.abort();
  } else await route.continue();
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) failures.push({ path: new URL(response.url()).pathname, status: response.status() }); });
try {
  await page.goto(origin);
  await page.locator('.dash-header').waitFor({ timeout: 45_000 });
  await page.locator('.startup-loader').waitFor({ state: 'hidden', timeout: 45_000 });
  assert.equal(await page.locator('.swp-login').count(), 0);
  assert.equal(await page.getByRole('button', { name: '退出登录' }).count(), 0);
  const data = await page.evaluate(async () => {
    const { useTwinStore } = await import('/src/stores/twin-store.ts');
    const store = useTwinStore();
    return { source: store.dataSource, rooms: store.area.rooms.length, beds: store.area.rooms.reduce((sum, room) => sum + room.beds.length, 0),
      events: store.swpEvents.length, locatedEvents: store.swpEvents.filter(event => event.locationStatus === 'matched').length,
      inspections: store.inspectionRecords.length, simulating: store.isSimulating, warnings: store.dataWarnings };
  });
  assert.equal(data.source, 'mock');
  assert.ok(data.rooms > 0 && data.beds > 0 && data.events > 0 && data.inspections > 0 && data.simulating);
  assert.equal(data.locatedEvents, data.events);
  const transportsBlocked = await page.evaluate(async () => {
    const { postJson } = await import('/src/api/http-client.ts');
    const { fetchDatabaseAreas } = await import('/src/api/database-twin.ts');
    const { loginSwpUser } = await import('/src/api/auth.ts');
    const attempts = await Promise.allSettled([
      postJson('/swp/should-never-request', {}), fetchDatabaseAreas(),
      loginSwpUser({ userName: 'demo', password: 'demo' }),
    ]);
    return attempts.every(result => result.status === 'rejected' && /已禁用后台接口请求/.test(result.reason.message));
  });
  assert.equal(transportsBlocked, true);
  await page.screenshot({ path: `${directory}/nurse-station.png` });
  for (const [label, scene] of [['病房走廊', 'ward'], ['病房内', 'ward-interior']]) {
    await page.locator('.dash-bottom__main').getByRole('button', { name: label, exact: false }).click();
    await page.locator(`.dash-bottom[data-scene="${scene}"]`).waitFor();
    await page.locator('.scene-switch-loader').waitFor({ state: 'hidden', timeout: 60_000 });
    await page.screenshot({ path: `${directory}/${scene}.png` });
  }
  await page.getByRole('button', { name: '入住平面图', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await page.waitForTimeout(4500);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: `${directory}/mobile.png` });
  await page.reload();
  await page.locator('.startup-loader').waitFor({ state: 'hidden', timeout: 45_000 });
  await page.locator('.dash-header').waitFor();
  const report = { data, transportsBlocked, forbidden, errors, failures };
  await writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  assert.deepEqual(forbidden, [], '存在业务接口或外部请求');
  assert.deepEqual(errors, [], '存在浏览器运行错误');
  assert.deepEqual(failures, [], '存在失败的静态资源');
} finally { await context.close(); await browser.close(); }
