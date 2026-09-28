async page => {
  const origin=await page.evaluate(()=>location.origin);
  await page.setViewportSize({width:1440,height:1100});
  await page.emulateMedia({reducedMotion:'reduce'});
  const results=[];
  const sample=el=>{
    const s=getComputedStyle(el),canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d');
    const rgb=c=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
    const over=(a,b)=>a.slice(0,3).map((c,i)=>c*a[3]/255+b[i]*(1-a[3]/255));
    let base=[255,255,255];const ancestors=[];for(let p=el.parentElement;p;p=p.parentElement)ancestors.unshift(p);
    for(const p of ancestors)base=over(rgb(getComputedStyle(p).backgroundColor),base);
    base=over(rgb(s.backgroundColor),base);
    const colors=s.backgroundImage.match(/rgba?\([^)]+\)|color\([^)]+\)/g);
    const backgrounds=colors?colors.map(c=>over(rgb(c),base)):[base];
    const lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const text=[el,...el.querySelectorAll('span,svg')].filter(e=>e===el||e.textContent.trim()||e.tagName.toLowerCase()==='svg');
    return {label:el.textContent.trim().slice(0,30),color:s.color,bg:s.backgroundImage==='none'?s.backgroundColor:s.backgroundImage,
      contrast:Math.min(...text.flatMap(e=>backgrounds.map(bg=>ratio(rgb(getComputedStyle(e).color),bg)))),
      transform:s.transform,shadow:s.boxShadow,outline:s.outlineStyle};
  };
  for(const scene of ['station','corridor','room']) {
    await page.goto(`${origin}/scripts/fixtures/${scene==='station'?'nurse-light-command.html?clinical':'ward-sidebar-light.html'}`);
    if(scene!=='station')await page.evaluate(scene=>window.wardSidebarFixture.setScene(scene),scene);
    await page.locator(scene==='station'?'.nurse-workspace':'.ward-clinical').waitFor();
    await page.locator('.scene-switch-loader').waitFor({state:'hidden',timeout:60000});
    for(const theme of ['light','dark']) {
      await page.evaluate(({scene,theme})=>(scene==='station'?window.commandFixture:window.wardSidebarFixture).setTheme(theme),{scene,theme});
      const selectors=scene==='station'?['.station-charts__open','.station-hero__wallboard-toggle','.workspace-tabs button']:
        scene==='corridor'?['.room-card__enter','.alert-task__actions button:not(:disabled)','.alert-task-panel__filters button','.alert-task-panel__more button']:
        ['.ward-bed-nav button:not(:disabled)','.ward-call-list button:not(:disabled)','.task-card__actions button:not(:disabled)'];
      for(const selector of selectors) {
        const button=page.locator(selector).first();if(!await button.count())continue;
        await button.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
        await page.waitForTimeout(220);
        const normal=await button.evaluate(sample);
        await button.hover();await page.waitForTimeout(220);const hover=await button.evaluate(sample);
        await page.mouse.move(0,0);await page.waitForTimeout(220);const restored=await button.evaluate(sample);
        if(restored.bg!==normal.bg || restored.color!==normal.color)throw new Error(`Mouseout failed ${scene}/${theme}/${selector}`);
        results.push({scene,theme,selector,normal,hover});
      }
      const disabled=page.locator('.digital-twin button:disabled').first();
      if(await disabled.count()) {
        await disabled.scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.waitForTimeout(220);
        const before=await disabled.evaluate(sample);await disabled.hover({force:true});await page.waitForTimeout(220);
        const after=await disabled.evaluate(sample);
        if(before.bg!==after.bg || before.color!==after.color || after.transform!=='none')throw new Error(`Disabled hover changed ${scene}/${theme}`);
      }
    }
  }
  const failures=results.filter(r=>r.hover.contrast<4.5);
  if(failures.length)throw new Error(JSON.stringify(failures));
  return {passed:!failures.length,cases:results.length,failures,results};
}
