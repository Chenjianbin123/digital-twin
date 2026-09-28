async page => {
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:1920,height:1080});
  const baseURL = await page.evaluate(() => location.origin);
  await page.goto(`${baseURL}/scripts/fixtures/ward-sidebar-light.html?integrated`);
  await page.locator('.dash-header').waitFor();
  const results=[];
  for(const scene of ['corridor','room']) {
    await page.evaluate(s=>window.wardSidebarFixture.setScene(s),scene);
    await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
    for(const theme of ['light','dark']) {
      await page.evaluate(t=>window.wardSidebarFixture.setTheme(t),theme);
      for(const width of [1920,1024,768,320]) {
        const height=width===320?640:1080;
        await page.setViewportSize({width,height});
        const info=await page.locator('.ward-clinical').evaluate(root=>{
          const panel=root.closest('.digital-twin__panel'); const content=root.querySelector('.ward-command-content');
          const r=root.getBoundingClientRect(); const header=document.querySelector('.dash-header').getBoundingClientRect();
          const targets=[root,...root.querySelectorAll('.ward-command-hero,.dash-section,.room-card,.ward-info-panel>section,.ward-bed-nav,.alert-task')];
          return {width:panel.getBoundingClientRect().width,top:r.top,headerBottom:header.bottom,bottom:r.bottom,overflow:targets.filter(el=>el.checkVisibility()&&el.scrollWidth>el.clientWidth+2).map(el=>el.className),contentHeight:content.clientHeight,contentOverflow:getComputedStyle(content).overflowY};
        });
        assert(info.top>=info.headerBottom-1,`${scene}/${theme}/${width}: under header`);
        assert(info.bottom<=height+1,`${scene}/${theme}/${width}: panel below viewport`);
        assert(info.contentHeight>100,`${scene}/${theme}/${width}: content collapsed`);
        assert(info.contentOverflow==='auto',`${scene}/${theme}/${width}: scroll lost`);
        assert(!info.overflow.length,`${scene}/${theme}/${width}: overflow ${info.overflow}`);
        if(width>=1024) assert(Math.abs(info.width-Math.max(400,Math.min(600,width*.28)))<2,'Sidebar width diverged from station');
        if(width===1920) {
          await page.locator('.ward-command-content').evaluate(el=>el.scrollTop=0);
          await page.locator('.ward-clinical').screenshot({path:`output/playwright/ward-clinical-integrated-${scene}-${theme}.png`});
        }
        results.push({scene,theme,viewport:width,...info});
      }
    }
  }
  assert(!errors.length,`Browser errors: ${errors}`);
  return {passed:true,results,errors};
}
