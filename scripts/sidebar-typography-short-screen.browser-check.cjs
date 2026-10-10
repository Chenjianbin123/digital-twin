async page => {
  // Run after sidebar-typography.browser-check.cjs in the same isolated fixture session.
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const results=[];
  for(const scene of ['nurse-station','ward','ward-interior']) {
    await page.evaluate(async scene=>{const {useTwinStore}=await import('/src/stores/twin-store.ts'); const store=useTwinStore(); if(scene==='ward-interior')store.enterRoom(0);else store.setSceneType(scene);},scene);
    const root=page.locator(scene==='nurse-station'?'.nurse-workspace':'.ward-command-workspace');
    await root.waitFor();
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>window.commandFixture.setTheme(theme),theme);
      for(const width of [1440,320]) {
        await page.setViewportSize({width,height:720});
        const info=await root.evaluate(root=>{
          const scroll=root.querySelector('.workspace-scroll,.ward-command-content');
          scroll.scrollTop=scroll.scrollHeight;
          const info={height:scroll.clientHeight,scrollable:scroll.scrollHeight<=scroll.clientHeight||scroll.scrollTop>0,overflow:root.scrollWidth>root.clientWidth+2};
          scroll.scrollTop=0;return info;
        });
        assert(info.height>=50&&info.scrollable&&!info.overflow,`${scene}/${theme}/${width}: ${JSON.stringify(info)}`);
        if(scene==='nurse-station') {
          const tab=page.getByRole('tab',{name:'概览',exact:true});
          await tab.focus();await page.keyboard.press('ArrowRight');
          assert(await page.getByRole('tab',{name:/待办/}).getAttribute('aria-selected')==='true','keyboard tabs failed');
          await page.keyboard.press('Home');
        }
        results.push({scene,theme,width,...info});
      }
    }
  }
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(async()=>{const {useTwinStore}=await import('/src/stores/twin-store.ts');useTwinStore().setSceneType('nurse-station');});
  await page.getByRole('button',{name:'进入护士站大屏模式'}).click();
  const exit=page.getByRole('button',{name:'退出护士站大屏模式'});
  await exit.waitFor();
  assert(await page.locator('.nurse-workspace').evaluate(el=>el.scrollWidth<=el.clientWidth+2),'wallboard overflow');
  await exit.click();
  return {passed:true,shortScreenCases:results.length,keyboardTabs:true,wallboard:true,results};
}
