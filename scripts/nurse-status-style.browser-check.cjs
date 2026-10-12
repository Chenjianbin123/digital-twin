async page => {
  try {
    const check = (ok, message) => { if (!ok) throw Error(message); };
    const errors = [], cases = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/scripts/fixtures/nurse-light-command.html?clinical');
    const root = page.locator('.nurse-status-console');
    await root.waitFor();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => {
      window.commandFixture.setChartHealth('warning');
      window.commandFixture.setClinicalSync('partial');
      window.commandFixture.setWarnings(['合成床位 A：未关联床头设备', '合成床位 B：名称与入住记录不一致，请核对床位资料；当前保留入住记录。']);
      window.commandFixture.setSyncTimestamp('2026-10-08T06:00:00Z');
    });
    const overflow = async label => {
      const items = await root.evaluate(el => [el, ...el.querySelectorAll('.nsc-toolbar,.nsc-title,.nsc-event,.nsc-disclosure,.nsc-details,.nsc-sources li,.api-diagnostics,.nsc-setting')]
        .filter(item => item.getClientRects().length && item.scrollWidth > item.clientWidth + 1).map(item => item.className));
      check(!items.length, `${label}: horizontal overflow ${items.join(',')}`);
    };
    const capture = async name => {
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
      await page.mouse.move(0, 0);
      await page.locator('.station-hero').evaluate(el => { el.scrollTop = 0; });
      await root.evaluate(el => { el.scrollTop = 0; });
      await root.screenshot({ path: `output/playwright/nurse-status-${name}.png` });
    };
    for (const theme of ['dark', 'light']) {
      await page.evaluate(value => window.commandFixture.setTheme(value), theme);
      for (const width of [1440, 1024, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 1100 });
        const collapse = root.getByRole('button', { name: '收起病区状态与提醒', exact: true });
        const before = await root.innerText();
        check(before.includes('有患者呼叫，待处理'), 'event label missing');
        const title = root.getByRole('heading', { name: '病区状态', exact: true });
        check(await title.isVisible(), 'module heading missing');
        check(await title.evaluate(el => {
          const style = getComputedStyle(el), caption = getComputedStyle(el.closest('.nurse-status-console').querySelector('.nsc-disclosure .nsc-caption'));
          const button = el.parentElement.querySelector('.nsc-collapse');
          const primary = getComputedStyle(el.closest('.nurse-status-console').querySelector('.nsc-event strong'));
          return style.color === primary.color && Number(style.fontWeight) >= 700 && parseFloat(style.fontSize) > parseFloat(caption.fontSize)
            && el.getBoundingClientRect().right <= button.getBoundingClientRect().left;
        }), 'module title hierarchy or button spacing regressed');
        const contrast = await root.evaluate(el => {
          const style = getComputedStyle(el);
          const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
          canvas.width = canvas.height = 1;
          const luminance = color => {
            ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
            const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => {
              const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
            });
            return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
          };
          const backgrounds = ['--nsc-bg', '--nsc-top', '--nsc-inset'].map(key => luminance(style.getPropertyValue(key).trim()));
          return ['--nsc-text', '--nsc-muted', '--nsc-accent', '--nsc-warn'].map(key => {
            const fg = luminance(style.getPropertyValue(key).trim());
            return { key, ratio: Math.min(...backgrounds.map(bg => (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05))) };
          });
        });
        check(contrast.every(item => item.ratio >= 4.5), `theme text contrast: ${JSON.stringify(contrast)}`);
        await overflow(`${theme}/${width}/default`);
        if ([1440, 320].includes(width)) {
          await capture(`${theme}-${width}-default`);
          await root.locator('.nsc-toolbar').screenshot({ path: `output/playwright/nurse-status-${theme}-${width}-title.png` });
        }
        const source = root.locator('.nsc-disclosure').first();
        const sourceToggle = source.locator(':scope > summary');
        await sourceToggle.focus();
        await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        check(await sourceToggle.evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== 'none'), 'keyboard focus indicator missing');
        await page.keyboard.press('Enter');
        await source.locator('.nsc-details').waitFor();
        check(await source.locator('.nsc-sources li').count() === 4, 'source count changed');
        check((await source.innerText()).includes('最近更新'), 'last update missing');
        await overflow(`${theme}/${width}/sources`);
        if (width === 1440) await capture(`${theme}-${width}-sources`);
        await sourceToggle.click();
        const reminder = root.locator('.nsc-disclosure').nth(1);
        await reminder.locator(':scope > summary').click();
        const toggle = reminder.locator('.nsc-toggle');
        await toggle.focus(); await page.keyboard.press('Enter');
        await reminder.locator('.nsc-toggle[aria-pressed="true"]').waitFor();
        check((await reminder.innerText()).includes('关闭不影响呼叫接收和列表展示'), 'reminder safety copy missing');
        await overflow(`${theme}/${width}/settings`);
        if (width === 1440) await capture(`${theme}-${width}-settings`);
        await toggle.click();
        await reminder.locator('.nsc-toggle[aria-pressed="false"]').waitFor();
        const retry = reminder.getByRole('button', { name: '重试失败提醒', exact: true });
        check(await retry.isDisabled(), 'disabled retry state changed');
        if (width === 1440) {
          await page.mouse.move(0, 0);
          const normal = await toggle.evaluate(el => getComputedStyle(el).backgroundColor);
          await toggle.hover();
          check(await toggle.evaluate(el => getComputedStyle(el).backgroundColor) !== normal, 'button hover feedback missing');
          await root.screenshot({ path: `output/playwright/nurse-status-${theme}-button-hover.png` });
        }
        await reminder.locator(':scope > summary').click();
        const diagnostics = root.locator('.api-diagnostics');
        await diagnostics.locator(':scope > summary').focus(); await page.keyboard.press('Enter');
        check((await diagnostics.innerText()).includes('合成床位 A'), 'diagnostic detail missing');
        await overflow(`${theme}/${width}/diagnostics`);
        if ([1440, 320].includes(width)) await capture(`${theme}-${width}-diagnostics`);
        await diagnostics.locator(':scope > summary').click();
        await collapse.click();
        await root.locator('.nsc-compact-status').waitFor();
        check(!await source.isVisible(), 'collapsed source visible');
        check((await root.innerText()).includes('信息：'), 'compact information missing');
        await overflow(`${theme}/${width}/collapsed`);
        if (width === 1440) await capture(`${theme}-${width}-collapsed`);
        await root.locator('.nsc-collapse').focus(); await page.keyboard.press('Enter');
        await root.locator('.nsc-body').waitFor();
        cases.push({ theme, width, contrast, states: ['default', 'sources', 'settings', 'diagnostics', 'collapsed'] });
      }
    }
    check(!errors.length, errors.join(';'));
    await page.emulateMedia({ reducedMotion: null });
    return { passed: true, cases, realBackendRequests: false };
  } catch (error) {
    await page.evaluate(message => console.error('Status style check: ' + message), error.message);
    throw error;
  }
}
