async page => {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const origin=await page.evaluate(()=>location.origin);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${origin}/scripts/fixtures/ward-sidebar-light.html?integrated`);
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  for(const scene of ['station','corridor','room']) {
    await page.evaluate(scene=>window.wardSidebarFixture.setScene(scene),scene);
    await page.locator(scene==='station'?'.nurse-workspace':'.ward-clinical').waitFor();
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>window.wardSidebarFixture.setTheme(theme),theme);
      for(const width of [1440,1024,768,320]) {
        const height=width===320?800:1000;
        await page.setViewportSize({width,height});
        const info=await page.locator('.digital-twin__panel').evaluate(panel=>{
          const s=getComputedStyle(panel),r=panel.getBoundingClientRect();
          const child=panel.firstElementChild,inner=getComputedStyle(child);
          let scroll=panel.querySelector('.workspace-scroll,.ward-command-content');
          // Light mobile station intentionally scrolls the whole workspace, including its hero.
          while(scroll!==panel && !['auto','scroll'].includes(getComputedStyle(scroll).overflowY)) scroll=scroll.parentElement;
          const old=scroll.scrollTop;scroll.scrollTop=scroll.scrollHeight;
          const scrollWorks=scroll.scrollHeight<=scroll.clientHeight+1||scroll.scrollTop>0;scroll.scrollTop=old;
          return {width:r.width,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
            shadow:s.boxShadow,radius:s.borderTopLeftRadius,bottomRadius:s.borderBottomLeftRadius,
            border:s.borderTopColor,overflow:s.overflow,animation:s.animationName,blur:s.backdropFilter,
            innerRadius:inner.borderTopLeftRadius,innerShadow:inner.boxShadow,innerBorder:inner.borderTopWidth,
            scrollWorks,scrollHeight:scroll.clientHeight,scrollContained:scroll.getBoundingClientRect().bottom<=r.bottom+1,
            horizontalOverflow:panel.scrollWidth>panel.clientWidth+1,
            headerBottom:document.querySelector('.dash-header').getBoundingClientRect().bottom};
        });
        assert(info.shadow!=='none' && info.innerShadow==='none','Single shell elevation missing');
        assert(info.innerRadius===info.radius && info.innerBorder==='0px','Inner corners diverged');
        assert(info.overflow==='hidden' && info.animation==='none' && info.blur==='none','Shell clipping/material mismatch');
        assert(!info.horizontalOverflow && info.scrollWorks && info.scrollHeight>80 && info.scrollContained,'Content overflow or scrolling regression');
        assert(info.left>=0 && info.right<=width+1 && info.bottom<=height+1 && info.top>=info.headerBottom-1,'Shell outside viewport/header');
        assert(info.radius===(width>=1024?'20px':'16px'),'Corner radius mismatch');
        if(width>=1024) {
          assert(Math.abs(info.width-Math.max(400,Math.min(600,width*.28)))<2,'Sidebar width changed');
          assert(Math.abs(width-info.right-16)<1 && Math.abs(height-info.bottom-16)<1,'Floating gutter missing');
        } else assert(info.bottomRadius==='0px','Bottom sheet corners incorrect');
        results.push({scene,theme,viewport:width,...info});
        if(width===1440) {
          await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
          await page.screenshot({path:`output/playwright/sidebar-elevation-${theme}-${scene}.png`,clip:{x:info.left-48,y:info.top-16,width:width-info.left+48,height:height-info.top+16}});
        }
      }
    }
  }
  for(const theme of ['light','dark']) {
    const shadows=results.filter(r=>r.theme===theme).map(r=>r.shadow);
    assert(new Set(shadows).size===1,`${theme}: scene shadows differ`);
  }
  assert(results[0].shadow!==results[4].shadow,'Theme shadows are identical');
  await page.setViewportSize({width:1440,height:1000});
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>{window.wardSidebarFixture.setTheme(theme);window.wardSidebarFixture.setScene('station');},theme);
    await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
    await page.getByRole('button',{name:'进入护士站大屏模式'}).click();
    await page.locator('.digital-twin__main--wallboard').waitFor();
    assert(await page.locator('.digital-twin__panel').evaluate(el=>getComputedStyle(el).borderTopLeftRadius)==='20px','Wallboard radius lost');
    await page.getByRole('button',{name:'退出护士站大屏模式'}).click();
    await page.locator('.digital-twin__panel-toggle').click();
    await page.locator('.digital-twin__panel').waitFor({state:'hidden'});
    await page.locator('.digital-twin__panel-toggle').click();
    await page.locator('.digital-twin__panel').waitFor({state:'visible'});
  }
  assert(!errors.length,errors.join(';'));
  return {passed:true,cases:results.length,results};
}
