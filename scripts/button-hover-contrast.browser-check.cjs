async page => {
  const origin=await page.evaluate(()=>location.origin);
  await page.goto(`${origin}/scripts/fixtures/nurse-light-command.html?clinical`);
  await page.setViewportSize({width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  await page.locator('.station-charts__open').waitFor();
  await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
  // Vite lazy loading/HMR can append component CSS after the global theme.
  await page.evaluate(()=>{
    for(const style of document.querySelectorAll('style[data-vite-dev-id]')) {
      if(style.dataset.viteDevId.includes('nurse-station-overview-charts')) document.head.append(style);
    }
  });
  for(const theme of ['light','dark']) {
    await page.evaluate(theme=>window.commandFixture.setTheme(theme),theme);
    const button=page.locator('.station-charts__open');
    await button.hover();
    const info=await button.evaluate(el=>{
      const s=getComputedStyle(el);
      const rgb=str=>(str.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
      const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
      const colors=s.backgroundImage.match(/rgba?\([^)]+\)/g)||[s.backgroundColor];
      const ink=lum(rgb(s.color));
      return {color:s.color,arrow:getComputedStyle(el.querySelector('span')).color,background:s.backgroundImage,
        contrast:Math.min(...colors.map(c=>{const bg=lum(rgb(c));return (Math.max(bg,ink)+.05)/(Math.min(bg,ink)+.05);}))};
    });
    await button.screenshot({path:`output/playwright/button-hover-${theme}.png`});
    if(info.contrast<4.5 || info.arrow!==info.color) throw new Error(`${theme}: hover text/icon contrast ${JSON.stringify(info)}`);
    await page.mouse.down();
    const pressed=await button.evaluate(el=>({color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundImage}));
    await page.mouse.move(0,0);await page.mouse.up();
    if(pressed.color!=='rgb(255, 255, 255)' || pressed.bg!=='none')throw new Error('Pressed state lost');
    await button.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
    if(!await button.evaluate(el=>el===document.activeElement && getComputedStyle(el).outlineStyle==='solid'))throw new Error('Keyboard focus missing');
    results.push({theme,...info});
  }
  if(results[0].background===results[1].background)throw new Error('Dark and light states must differ');
  return {passed:true,results};
}
