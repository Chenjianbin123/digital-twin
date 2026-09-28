async page => {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const origin=await page.evaluate(()=>location.origin);
  await page.goto(`${origin}/scripts/fixtures/ward-sidebar-light.html?integrated`);
  await page.locator('.dash-bottom').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.wardSidebarFixture.setTheme(theme),theme);
    for(const scene of ['station','corridor','room']) {
      await page.evaluate(scene=>window.wardSidebarFixture.setScene(scene),scene);
      for(const width of [1440,768,320]) {
        await page.setViewportSize({width,height:1000});
        const info=await page.locator('.dash-bottom').evaluate(nav=>{
          const rect=nav.getBoundingClientRect();
          const active=nav.querySelector('.dash-bottom__item--active');
          const title=document.querySelector('.scene-switch-loader h2');
          return {scene:nav.dataset.scene,color:getComputedStyle(active.querySelector('.dash-bottom__label')).color,
            loadingColor:title?getComputedStyle(title).color:null,center:rect.x+rect.width/2,left:rect.left,right:rect.right,
            overflow:[nav,...nav.querySelectorAll('button')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className)};
        });
        assert(!info.overflow.length,`${theme}/${scene}/${width}: overflow ${info.overflow}`);
        assert(info.left>=0 && info.right<=width+1 && Math.abs(info.center-width/2)<1,`${theme}/${scene}/${width}: geometry ${JSON.stringify(info)}`);
        if(info.loadingColor) assert(info.loadingColor===info.color,`${theme}/${scene}: loading color differs`);
        if(width===1440) await page.locator('.dash-bottom').screenshot({path:`output/playwright/scene-nav-integrated-${theme}-${scene}.png`});
        results.push({theme,scene,width,...info});
      }
    }
  }
  return {passed:true,cases:results.length,results};
}
