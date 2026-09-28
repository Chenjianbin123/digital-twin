async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1920,height:1080});
  await page.goto('http://127.0.0.1:5173/scripts/fixtures/ward-sidebar-light.html?integrated');
  await page.locator('.dash-header').waitFor();
  const results=[];
  for(const scene of ['corridor','room','station']) {
    await page.evaluate(s=>window.wardSidebarFixture.setScene(s),scene);
    await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
    for(const theme of ['light','dark']) {
      await page.evaluate(t=>window.wardSidebarFixture.setTheme(t),theme);
      for(const width of [1920,1024,768,320]) {
        await page.setViewportSize({width,height:1080});
        const info=await page.evaluate(()=>{
          const header=document.querySelector('.dash-header').getBoundingClientRect();
          const panel=document.querySelector('.digital-twin__panel').getBoundingClientRect();
          const content=document.querySelector('.digital-twin__panel > *')?.getBoundingClientRect();
          const overview=document.querySelector('.ward-overview')?.getBoundingClientRect();
          const floating=[...document.querySelectorAll('.nurse-station-visual__info,.dash-left,.corridor-tools')].filter(el=>el.checkVisibility()).map(el=>el.getBoundingClientRect().top);
          return {header:header.bottom,panel:panel.top,content:content?.top,overview:overview?.top,padding:getComputedStyle(document.querySelector('.digital-twin__panel')).paddingTop,floating};
        });
        assert(info.panel>=info.header-1, `${scene}/${theme}/${width} panel under header: ${JSON.stringify(info)}`);
        if(info.overview!==undefined) assert(info.overview>=info.header-1, 'Overview under header');
        assert(info.floating.every(top=>top>=info.header-1),'Floating scene controls under header');
        if(width>=1024) assert(info.padding==='0px','Duplicate header padding');
        if(width===1920) await page.screenshot({path:`output/playwright/header-integrated-${scene}-${theme}.png`});
        results.push({scene,theme,width,...info});
      }
    }
  }
  return {passed:true,results};
}
