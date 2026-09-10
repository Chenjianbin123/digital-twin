async (page) => {
  const sizes = [[320,640],[768,1024],[1024,768],[1280,720],[1366,768],[1440,900],[1536,864],[1920,1080],[2560,1440],[3840,2160]];
  const results = [];
  for (const scene of ["护士站", "病房走廊", "病房内"]) {
    await page.setViewportSize({width:1280,height:720});
    await page.getByRole("navigation", {name:"场景切换"}).getByRole("button", {name:scene,exact:true}).click();
    await page.waitForFunction(() => !document.querySelector(".digital-twin__main--scene-switching"));
    for (const [width,height] of sizes) {
      await page.setViewportSize({width,height});
      // App animates panel positioning; measuring mid-transition produces false overlaps.
      await page.waitForTimeout(900);
      const sample = await page.evaluate(() => {
        const get = selector => {
          const element = document.querySelector(selector);
          const r = element.getBoundingClientRect();
          return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,scroll:element.scrollWidth,client:element.clientWidth};
        };
        const panel = get(".digital-twin__panel");
        const nav = get(".dash-bottom");
        const toggle = get(".digital-twin__panel-toggle");
        const failures = [];
        const body = document.querySelector('.digital-twin__panel-body');
        if (body && body.getBoundingClientRect().height < 80) failures.push('panel content squeezed away');
        const badge = document.querySelector('.station-hero__badge');
        if (badge && badge.getBoundingClientRect().height > 50) failures.push('status badge wraps vertically');
        for (const [name,r] of Object.entries({panel,nav,toggle})) {
          if (r.x < -1 || r.y < -1 || r.right > innerWidth+1 || r.bottom > innerHeight+1) failures.push(name+" outside viewport");
          if (r.scroll > r.client+2) failures.push(name+" horizontal overflow");
        }
        const overlap = (a,b) => Math.min(a.right,b.right)-Math.max(a.x,b.x)>1 && Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;
        if (overlap(nav,panel)) failures.push("nav overlaps panel");
        if (overlap(toggle,panel)) failures.push("toggle overlaps panel");
        if (overlap(nav,toggle)) failures.push("nav overlaps toggle");
        for (const el of document.querySelectorAll(".dash-bottom button")) {
          if (el.getBoundingClientRect().height < 39) failures.push("navigation hit target below 40px");
        }
        const font = parseFloat(getComputedStyle(document.querySelector(".dash-bottom__label")).fontSize);
        if (font < 12) failures.push("navigation font below 12px");
        return {width:innerWidth,height:innerHeight,panel,nav,toggle,font,failures};
      });
      results.push({scene,...sample});
      await page.evaluate(value => { window.responsiveAudit = value; }, results);
      if ([320,1280,1920].includes(width)) {
        const key = {"护士站":"station","病房走廊":"corridor","病房内":"interior"}[scene];
        await page.screenshot({path:"output/playwright/responsive-"+key+"-"+width+".jpg",type:"jpeg",quality:45});
      }
    }
  }
  const failures = results.filter(row => row.failures.length);
  if (failures.length) throw new Error(JSON.stringify(failures));
}
