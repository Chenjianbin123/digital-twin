async page => {
  const assert=(value,message)=>{if(!value)throw new Error(message);};
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const origin=await page.evaluate(()=>location.origin);
  await page.goto(`${origin}/scripts/fixtures/scene-navigation.html`);
  await page.locator('.dash-bottom').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.navFixture.setTheme(theme),theme);
    for(const width of [1440,1024,768,320]) {
      await page.setViewportSize({width,height:1000});
      for(const [scene,label] of [['nurse-station','护士站'],['ward','病房走廊'],['ward-interior','病房内']]) {
        await page.getByRole('button',{name:label,exact:true}).click();
        const info=await page.locator('.dash-bottom').evaluate(nav=>{
          const active=nav.querySelector('.dash-bottom__item--active');
          const color=getComputedStyle(active.querySelector('.dash-bottom__label')).color;
          const title=getComputedStyle(document.querySelector('.scene-switch-loader h2')).color;
          const icon=getComputedStyle(active.querySelector('svg')).color;
          const rect=nav.getBoundingClientRect();
          return{color,title,icon,center:rect.x+rect.width/2,width:rect.width,overflow:[nav,...nav.querySelectorAll('button')].some(el=>el.scrollWidth>el.clientWidth+1)};
        });
        assert(info.color===info.title && info.icon===info.title,`${theme}/${scene}: loader/nav colors differ ${JSON.stringify(info)}`);
        assert(!info.overflow && info.width<=width,`${theme}/${width}: overflow`);
        assert(Math.abs(info.center-width/2)<1,`${theme}/${width}: navigation is not centered`);
        if(scene==='ward-interior') {
          await page.getByRole('button',{name:'入住平面图',exact:true}).focus();await page.keyboard.press('Enter');
          assert(await page.getByRole('button',{name:'入住平面图',exact:true}).getAttribute('aria-pressed')==='true','Plan switch lost');
          const subColor=await page.locator('.dash-bottom__sub-item--active').evaluate(el=>getComputedStyle(el).color);
          assert(subColor===info.title,'Secondary view color differs');
          await page.getByRole('button',{name:'3D',exact:true}).click();
        }
        results.push({theme,scene,width,...info});
        if(width===1440) await page.locator('.dash-bottom').screenshot({path:`output/playwright/scene-nav-${theme}-${scene}.png`});
      }
    }
    await page.setViewportSize({width:809,height:907});
    const active=page.locator('.dash-bottom__item--active');await page.mouse.move(0,0);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert(await active.evaluate(el=>getComputedStyle(el).transitionDuration)==='0s','Reduced motion ignored');
    const normal=await active.evaluate(el=>getComputedStyle(el).boxShadow);
    await active.hover();await page.waitForFunction(normal=>getComputedStyle(document.querySelector('.dash-bottom__item--active')).boxShadow!==normal,normal);
    await page.mouse.move(0,0);await page.waitForFunction(normal=>getComputedStyle(document.querySelector('.dash-bottom__item--active')).boxShadow===normal,normal);
    await active.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    assert(await active.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle==='solid'),'Keyboard focus missing');
    await page.keyboard.press('Tab');
    await page.locator('.dash-bottom').evaluate(el=>document.activeElement?.blur());
    await page.screenshot({path:`output/playwright/scene-nav-loading-${theme}.png`});
  }
  assert(!errors.length,errors.join(';'));
  return{passed:true,cases:results.length,results};
}
