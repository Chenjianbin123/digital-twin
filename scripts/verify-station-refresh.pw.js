async page => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:5173/scripts/fixtures/station-refresh.html');
  await page.waitForFunction(()=>window.fixture?.ready,null,{timeout:60000});
  await page.setViewportSize({width:1440,height:900});
  const checks=await page.evaluate(async()=>{
    const s=fixture.scene;
    const assert=(value,message)=>{if(!value)throw Error(message);};
    const snapshot=()=>s.nurseStationBoardDisplays.map(d=>({kind:d.kind,texture:d.texture.uuid,canvas:d.texture.image,version:d.texture.version,signature:d.signature,flipY:d.texture.flipY,materialVersion:d.screen.material.version}));
    const stable=(before)=>snapshot().every((d,i)=>d.texture===before[i].texture&&d.canvas===before[i].canvas&&d.flipY===before[i].flipY&&d.materialVersion===before[i].materialVersion);
    const hash=kind=>{const c=s.nurseStationBoardDisplays.find(d=>d.kind===kind).texture.image;const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let hash=2166136261;for(const p of pixels)hash=Math.imul(hash^p,16777619);return hash;};
    s.setActive(false);
    // Fix time for deterministic content signatures, without changing the browser clock elsewhere.
    const realNow=Date.now;const anchor=Math.floor(realNow()/60000)*60000+10000;
    Date.now=()=>anchor;
    try {
      s.setActive(true);
      const initial=snapshot();
      fixture.update();fixture.update();
      assert(snapshot().every((d,i)=>d.version===initial[i].version),'identical data caused texture upload');
      const mainBefore=hash('dashboard');
      fixture.area.rooms[0].beds[0].isCalling=true;fixture.update();
      const called=snapshot();
      const changed=called.filter((d,i)=>d.version!==initial[i].version).map(d=>d.kind);
      assert(JSON.stringify(changed)===JSON.stringify(['dashboard','taskQueue','wardStatus']),'call repaint set: '+JSON.stringify(changed));
      const callingPixels=hash('dashboard');
      assert(mainBefore!==callingPixels,'main display pixels did not update');
      assert(stable(initial),'texture, canvas, UV or material replaced');
      s.setActive(false);fixture.area.rooms[0].beds[0].isCalling=false;fixture.update();
      assert(snapshot().every((d,i)=>d.version===called[i].version),'hidden station repainted');
      s.setActive(true);
      const returned=snapshot().find(d=>d.kind==='dashboard');
      assert(returned.signature===initial.find(d=>d.kind==='dashboard').signature&&hash('dashboard')!==callingPixels,'return did not catch up to latest data');
      const beforeSecond=snapshot();Date.now=()=>anchor+1000;s.refreshNurseStationBoardDisplays();
      const secondChanged=snapshot().filter((d,i)=>d.version!==beforeSecond[i].version).map(d=>d.kind);
      assert(JSON.stringify(secondChanged)==='["clock"]','second tick repainted data screens');
      const beforeMinute=snapshot();Date.now=()=>anchor+60000;s.refreshNurseStationBoardDisplays();
      const minuteChanged=snapshot().filter((d,i)=>d.version!==beforeMinute[i].version).map(d=>d.kind);
      assert(!minuteChanged.includes('dashboard')&&minuteChanged.length===5,'minute headings not refreshed');
      const light=hash('dashboard');s.setTheme('dark');assert(light!==hash('dashboard'),'theme did not repaint');s.setTheme('light');
      assert(stable(initial),'theme or time replaced texture resources');
      return {sameDataSkipped:true,callBoards:changed,mainPixelsUpdated:true,hiddenDeferred:true,returnCaughtUp:true,secondChanged,minuteChanged,textureAndCanvasRetained:true,themeUpdated:true};
    }finally{Date.now=realNow;}
  });
  const perf=await page.evaluate(async()=>{
    const s=fixture.scene;const optimized=s.refreshNurseStationBoardDisplays;
    const legacy=function(){for(const d of this.nurseStationBoardDisplays){if(d.video)continue;const flip=d.texture.flipY;d.texture.dispose();d.texture=this.createNurseStationBoardTexture(d.kind);d.texture.flipY=flip;d.screen.material.map=d.texture;d.screen.material.needsUpdate=true;d.texture.needsUpdate=true;}};
    const results=[];
    try {
      for(const mode of ['previous-refresh','optimized','optimized','previous-refresh']){
        s.refreshNurseStationBoardDisplays=mode==='optimized'?optimized:legacy;
        for(const d of s.nurseStationBoardDisplays)d.signature=undefined;
        s.refreshNurseStationBoardDisplays();
        const factory=s.createNurseStationBoardTexture;let allocations=0;let paints=0;
        s.createNurseStationBoardTexture=function(kind,target){paints++;if(!target)allocations++;return factory.call(this,kind,target);};
        const start=performance.now(),frame=s.renderer.info.render.frame;
        await new Promise(resolve=>setTimeout(resolve,3500));
        s.createNurseStationBoardTexture=factory;
        results.push({mode,fps:(s.renderer.info.render.frame-frame)*1000/(performance.now()-start),paints,allocations,drawCalls:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles});
      }
    }finally{s.refreshNurseStationBoardDisplays=optimized;for(const d of s.nurseStationBoardDisplays)d.signature=undefined;s.refreshNurseStationBoardDisplays();}
    return results;
  });
  const layouts=[];
  for(const [width,height] of [[320,640],[768,1024],[1024,768],[1440,900]]){
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>Math.abs(fixture.scene.camera.aspect-document.getElementById('scene').clientWidth/document.getElementById('scene').clientHeight)<.01);
    layouts.push(await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,aspect:fixture.scene.camera.aspect})));
    await page.screenshot({path:`output/playwright/station-refresh-${width}.png`});
  }
  await page.evaluate(()=>fixture.scene.setActive(false));
  if(errors.length)throw Error(errors.join('\n'));
  return {checks,perf,layouts,pageErrors:errors};
}
