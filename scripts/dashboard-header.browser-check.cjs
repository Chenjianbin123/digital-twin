async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  await page.emulateMedia({reducedMotion:'reduce'});
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/dashboard-header.html');
  await page.locator('.dash-header').waitFor();
  const results = [];
  for (const theme of ['light', 'dark']) {
    await page.evaluate(t => window.headerFixture.setTheme(t), theme);
    for (const width of [2560,1920,1774,1440,1280,1100,1024,768,600,375,320]) {
      await page.setViewportSize({width, height:900});
      for (const long of [false,true]) {
        await page.evaluate(v => window.headerFixture.setLong(v), long);
        const info = await page.locator('.dash-header').evaluate(root => {
          const outer = root.getBoundingClientRect();
          const bounds = el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; };
          const center = bounds(root.querySelector('.dash-header__center'));
          const left = bounds(root.querySelector('.dash-header__side--left'));
          const right = bounds(root.querySelector('.dash-header__side--right'));
          const icon = bounds(root.querySelector('.dash-header__brand-icon'));
          const title = bounds(root.querySelector('h1'));
          const titleStyle = getComputedStyle(root.querySelector('h1'));
          const controlStyle = getComputedStyle(root.querySelector('.dash-header__refresh'));
          const statusStyle = getComputedStyle(root.querySelector('.dash-header__data-status'));
          const overflow = [...root.querySelectorAll('button,.dash-header__dept,.dash-header__operator,.dash-header__tag,.dash-header__data-status,.dash-header__title')].filter(el=>el.checkVisibility()).filter(el=>{const r=bounds(el);return r.left<outer.left-1||r.right>outer.right+1||r.bottom>outer.bottom+1;}).map(el=>el.className);
          const controlsOverlap = innerWidth>=1100 && [...root.querySelectorAll('.dash-header__side button,.dash-header__dept,.dash-header__operator,.dash-header__tag,.dash-header__data-status')].filter(el=>el.checkVisibility()).some(el=>{const r=bounds(el);return el.closest('.dash-header__side--left')?r.right>center.left+1:r.left<center.right-1;});
          return {overflow,controlsOverlap,center,left,right,icon,title,controlSize:parseFloat(controlStyle.fontSize),controlWeight:controlStyle.fontWeight,controlHeight:parseFloat(controlStyle.height),statusSize:parseFloat(statusStyle.fontSize),titleSize:parseFloat(titleStyle.fontSize),titleShadow:titleStyle.textShadow,titleColor:titleStyle.color,headerBottom:outer.bottom};
        });
        assert(!info.overflow.length, `${theme}/${width}/${long}: overflow ${info.overflow}`);
        assert(!info.controlsOverlap, `${theme}/${width}/${long}: controls overlap title`);
        assert(info.controlSize >= 13 && info.controlSize <= 14 && info.controlWeight === '500', `${theme}/${width}: control typography overridden`);
        assert(info.controlHeight >= 40 && info.statusSize >= 12, `${theme}/${width}: controls or status too small`);
        assert(info.icon.right < info.title.left, `${theme}/${width}: brand icon overlaps title`);
        assert(Math.abs(info.icon.right-info.icon.left-(width>1099?40:width>400?28:24))<1, `${theme}/${width}: brand icon size overridden`);
        assert(info.icon.left >= info.center.left && info.title.right <= info.center.right, `${theme}/${width}: brand exceeds plate`);
        assert(info.titleSize >= 18 && info.titleSize <= 30, `${theme}/${width}: title size out of range`);
        assert(info.titleShadow !== 'none', `${theme}/${width}: missing title depth`);
        assert(Math.abs((info.center.left+info.center.right)/2-width/2)<1, 'Title must remain viewport centered');
        if(width>=1100) assert(info.left.right<=info.center.left && info.center.right<=info.right.left, `Header overlap ${width}`);
        if (!long && [1920,320].includes(width)) await page.screenshot({path:`output/playwright/dashboard-header-${theme}-${width}.png`,clip:{x:0,y:0,width,height:Math.ceil(info.headerBottom+12)}});
        results.push({theme,width,long,titleColor:info.titleColor});
      }
    }
  }
  await page.evaluate(()=>window.headerFixture.setLong(false));
  for (const [selector,event] of [['.dash-header__area-trigger','area'],['.dash-header__refresh','refresh'],['.dash-header__theme','theme'],['.dash-header__logout','logout']]) {
    await page.locator(selector).focus(); await page.keyboard.press('Enter');
    assert(await page.evaluate(e=>window.headerFixture.events.includes(e),event), `Missing keyboard action ${event}`);
  }
  await page.evaluate(()=>window.headerFixture.setBusy(true));
  assert(await page.locator('.dash-header__refresh').isDisabled(), 'Refresh busy guard');
  assert(await page.locator('.dash-header__area-trigger').isDisabled(), 'Area switching guard');
  for (const state of ['loading','ready','warning','stale','error']) {
    await page.evaluate(s=>window.headerFixture.setStatus(s),state);
    assert(await page.locator(`.dash-header__data-status--${state}`).isVisible(), `Status missing ${state}`);
  }
  assert(!errors.length, errors.join(';'));
  const cdp = await page.context().newCDPSession(page);
  let renderedFonts;
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const {root} = await cdp.send('DOM.getDocument');
    const {nodeId} = await cdp.send('DOM.querySelector', {nodeId:root.nodeId, selector:'.dash-header__area-name'});
    renderedFonts = (await cdp.send('CSS.getPlatformFontsForNode', {nodeId})).fonts;
  } finally {
    await cdp.detach();
  }
  return {passed:true,cases:results.length,renderedFonts,results};
}
