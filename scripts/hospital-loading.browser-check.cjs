const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.LOCAL_MOCK_PLAYWRIGHT || 'playwright');
const origin = process.env.HOSPITAL_NAV_ORIGIN || 'http://127.0.0.1:5197';
const out = 'output/playwright/hospital-loading';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const report = { checks: [], errors: [] };
  const cardStyle = loader => loader.locator('.scene-switch-loader__card').evaluate(el => {
    const style = getComputedStyle(el), title = getComputedStyle(el.querySelector('h2'));
    return { background: style.background, borderRadius: style.borderRadius, padding: style.padding,
      color: title.color, fontFamily: title.fontFamily, fontSize: title.fontSize };
  });
  try {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
      await context.addInitScript(theme => localStorage.setItem('ward-digital-twin:dashboard-theme', theme), theme);
      await context.route('**/*', route => new URL(route.request().url()).origin === origin && route.request().method() === 'GET'
        ? route.continue() : route.abort());
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push(error.message));
      await page.goto(origin);
      await page.locator('.hospital-overview[data-view="exterior"][data-state="ready"]').waitFor({ timeout: 90000 });
      await page.locator('.startup-loader').waitFor({ state: 'hidden' });
      let release, failed = false;
      await page.route('**/hospital-floor-v4.glb', async route => {
        if (!failed) { await new Promise(resolve => { release = resolve; }); failed = true; return route.abort(); }
        return route.continue();
      });
      const enter = async () => {
        await page.locator('.hospital-overview[data-view="exterior"] .hospital-overview__viewport').focus();
        await page.keyboard.press('Enter');
      };
      await enter();
      const loader = page.locator('.hospital-overview[data-view="floor"] .scene-switch-loader');
      await loader.waitFor();
      assert.equal(await page.locator('.hospital-workspace').getAttribute('data-theme'), theme);
      assert.equal(await loader.getByRole('progressbar').getAttribute('aria-valuenow'), '0');
      assert.equal(await loader.getByRole('button', { name: '返回护士站' }).count(), 0);
      assert.equal(await page.locator('.hospital-overview__status').count(), 0);
      const reference = await context.newPage();
      await reference.goto(`${origin}/scripts/fixtures/scene-switch-loading.html`);
      await reference.getByRole('button', { name: '病房走廊', exact: true }).click();
      await reference.waitForTimeout(250);
      assert.deepEqual(await cardStyle(loader), await cardStyle(reference.locator('.scene-switch-loader')));
      await reference.screenshot({ path: `${out}/clinical-reference-${theme}.png` });
      await reference.close();
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(250);
        const layer = await loader.boundingBox(), card = await loader.locator('.scene-switch-loader__card').boundingBox();
        assert.equal(layer.x, 0); assert.equal(layer.y, 0); assert.equal(layer.height, 900);
        assert.ok(card.x >= 0 && card.x + card.width <= width + 1);
        assert.ok(Math.abs(card.x + card.width / 2 - width / 2) < 1);
        assert.ok(Math.abs(card.y + card.height / 2 - 450) < 1);
        await page.screenshot({ path: `${out}/floor-loading-${theme}-${width}.png` });
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      assert.equal(await loader.locator('.scene-switch-loader__progress span').evaluate(el => getComputedStyle(el).animationName), 'none');
      await loader.getByRole('button', { name: '返回医院外部' }).click();
      await page.locator('.hospital-workspace[data-hospital-view="exterior"]').waitFor();
      await loader.waitFor({ state: 'detached' });
      assert.equal(await loader.count(), 0);
      await enter(); await loader.waitFor();
      await page.waitForFunction(() => document.querySelector('.hospital-overview[data-view="floor"]').dataset.state === 'loading');
      assert.ok(release); release();
      await page.locator('.hospital-overview[data-view="floor"] .scene-switch-loader[data-state="fallback"]').waitFor();
      await page.screenshot({ path: `${out}/floor-failure-${theme}.png` });
      await loader.getByRole('button', { name: /重试加载/ }).click();
      await page.locator('.hospital-overview[data-view="floor"][data-state="ready"]').waitFor({ timeout: 90000 });
      await loader.waitFor({ state: 'hidden' });
      report.checks.push(`${theme}: same clinical loader style; 320/768/1440 centered; real progress; back; failure/retry; reduced motion`);
      await context.close();
    }
    assert.deepEqual(report.errors, []); report.passed = true;
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
