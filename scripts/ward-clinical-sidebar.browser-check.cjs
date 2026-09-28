async page => {
  const assert = (ok,message) => { if (!ok) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({reducedMotion:'reduce'});
  const baseURL = await page.evaluate(() => location.origin);
  await page.goto(`${baseURL}/scripts/fixtures/ward-sidebar-light.html?room-cards`);
  await page.locator('.ward-clinical').waitFor();
  const results=[];
  for (const scene of ['corridor','room']) {
    await page.evaluate(s=>window.wardSidebarFixture.setScene(s),scene);
    for (const theme of ['light','dark']) {
      await page.evaluate(t=>window.wardSidebarFixture.setTheme(t),theme);
      for (const width of [1920,1440,1024,768,375,320]) {
        await page.setViewportSize({width,height:1100});
        await page.locator('.fixture-panel').evaluate((el,width)=>el.style.width=width>=1024?`${Math.min(600,Math.max(400,width*.28))}px`:'100%',width);
        const info=await page.locator('.ward-clinical').evaluate(root=>{
          const selectors='.hospital-intro,.dash-section,.room-card,.bed-chip,.ward-info-panel>section,.ward-bed-nav,.patient-info,.env-item,.staff-role-card,.alert-task,.ward-command-hero';
          const bad=[...root.querySelectorAll(selectors)].filter(el=>el.checkVisibility() && el.scrollWidth>el.clientWidth+2).map(el=>el.className);
          const el=root.querySelector('.dash-section,.ward-info-panel__bed');
          const cs=getComputedStyle(el);
          return {bad,radius:cs.borderRadius,surface:cs.backgroundColor,title:getComputedStyle(root.querySelector('.dash-head__title,.bed-detail-identity h3')).fontSize,scroll:root.querySelector('.ward-command-content').scrollHeight};
        });
        assert(!info.bad.length,`${scene}/${theme}/${width}: overflow ${info.bad}`);
        assert(info.radius==='12px',`${scene}/${theme}: card radius overridden`);
        assert(info.surface===(theme==='light'?'rgb(246, 251, 255)':'rgb(13, 34, 53)'),`${scene}/${theme}: wrong surface`);
        results.push({scene,theme,width,...info});
        if (width===1920 || width===320) {
          await page.setViewportSize({width,height:1900});
          const targets=scene==='corridor'?[['rooms','.dash-section--rooms'],['alerts','.corridor-alerts'],['monitor','.monitor-list']]:[['patient','.ward-info-panel__bed'],['team','.ward-info-panel > .door-staff-cards'],['environment','.ward-info-panel__env']];
          for (const [name,selector] of targets) {
            const section=page.locator(selector); await section.scrollIntoViewIfNeeded();
            await section.screenshot({path:`output/playwright/ward-clinical-${theme}-${width}-${name}.png`});
          }
        }
      }
      await page.setViewportSize({width:1920,height:1100});
      await page.locator('.fixture-panel').evaluate(el=>el.style.width='537.6px');
      if (scene==='corridor') {
        const enter=page.locator('.room-card__enter').first();
        await enter.scrollIntoViewIfNeeded(); await page.mouse.move(0,0);
        const normal=await enter.evaluate(el=>getComputedStyle(el).backgroundImage);
        assert(normal.includes('gradient'),'Primary button lost its surface');
        await enter.hover();
        assert(await enter.evaluate(el=>getComputedStyle(el).backgroundImage)!==normal,'No hover state');
        await page.mouse.move(0,0);
        assert(await enter.evaluate(el=>getComputedStyle(el).backgroundImage)===normal,'Mouseout did not restore');
        await enter.focus();
        assert(await enter.evaluate(el=>getComputedStyle(el).outlineStyle)==='solid','No keyboard focus');
        await page.keyboard.press('Enter');
        assert(await page.evaluate(()=>window.wardSidebarFixture.events.some(e=>e[0]==='enter')),'Enter-room action lost');
        const roomName=page.locator('.room-card__name').first(); await roomName.focus(); await page.keyboard.press('Enter');
        assert(await roomName.getAttribute('aria-pressed')==='true','Room focus action lost');
        const team=page.locator('.room-card__team').first(); await team.locator('summary').focus(); await page.keyboard.press('Enter');
        assert(await team.getAttribute('open')!==null,'Team disclosure inaccessible');
        await page.keyboard.press('Enter');
        const more=page.locator('.alert-task-panel__more button');
        assert(await more.innerText().then(t=>t.includes('查看全部任务')),'Task expansion label hidden');
        await more.click(); assert(await page.locator('.alert-task').count()===6,'Full task list not shown'); await more.click();
        await page.locator('.alert-task__ghost--handling').first().click();
        assert(await page.evaluate(()=>window.wardSidebarFixture.events.some(e=>e[0]==='ack')),'Acknowledgement event lost');
        await page.getByRole('tab',{name:/未处理/}).focus(); await page.keyboard.press('ArrowRight');
        assert(await page.locator('.alert-task-panel__empty').innerText().then(t=>t.includes('暂无处理中')),'Keyboard filter switch broken');
        await page.keyboard.press('Home');
        await page.evaluate(()=>window.wardSidebarFixture.setEmpty(true));
        assert(await page.locator('.alert-task-panel__empty').isVisible(),'Empty state missing');
        await page.evaluate(()=>window.wardSidebarFixture.setEmpty(false));
      } else {
        await page.locator('#ward-bed-picker').selectOption('TEST-0-2');
        assert(await page.locator('.empty-bed-tip').innerText().then(t=>t.includes('当前为空床')),'Empty bed displayed patient data');
        assert(await page.locator('.ward-care-summary').count()===0,'Stale patient summary remained');
        await page.locator('#ward-bed-picker').selectOption('TEST-0-0');
        const details=page.locator('.bed-detail-section--patient'); await details.locator('summary').focus(); await page.keyboard.press('Enter');
        assert(await details.getAttribute('open')!==null,'Patient record cannot expand'); await page.keyboard.press('Enter');
        await page.evaluate(()=>window.wardSidebarFixture.setStale(true));
        assert(await page.locator('.ward-care-notice').isVisible(),'Stale data warning missing');
        await page.evaluate(()=>window.wardSidebarFixture.setStale(false));
        await page.locator('.ward-call-list button:not(:disabled)').first().click();
        assert(await page.evaluate(()=>window.wardSidebarFixture.events.some(e=>e[0]==='locate')),'Call location event lost');
        await page.locator('.managed-care-card').first().click();
        assert(await page.getByRole('dialog').isVisible(),'Staff introduction missing');
        await page.getByRole('button',{name:'关闭简介',exact:true}).click();
        assert(await page.getByRole('dialog').count()===0,'Staff introduction cannot close');
      }
    }
  }
  assert(errors.length===0,`Browser errors: ${errors}`);
  return {passed:true,results,errors};
}
