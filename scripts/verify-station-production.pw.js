async page => {
  const errors=[];
  const onError=error=>errors.push(error.message);
  const onConsole=message=>{
    if(/GL_INVALID_OPERATION|GL_INVALID_VALUE|WebGL context lost/i.test(message.text()))errors.push(message.text());
  };
  page.on('pageerror',onError);
  page.on('console',onConsole);
  try {
    await page.reload();
    await page.waitForFunction(()=>window.fixture?.ready);
    await page.setViewportSize({width:1440,height:900});
    const initial=await page.evaluate(()=>{
      const scene=fixture.scene;
      fixture.modelId=scene.nurseStationModel.uuid;
      fixture.hash=texture=>{
        const c=document.createElement('canvas');c.width=96;c.height=64;
        const ctx=c.getContext('2d');ctx.drawImage(texture.image,0,0,96,64);
        const pixels=ctx.getImageData(0,0,96,64).data;
        let hash=2166136261;for(const value of pixels)hash=Math.imul(hash^value,16777619);
        return hash;
      };
      fixture.before=scene.nurseStationBoardDisplays.map(d=>({kind:d.kind,hash:fixture.hash(d.texture),flipY:d.texture.flipY}));
      return {scale:scene.nurseStationModel.scale.toArray(),bindings:fixture.before.map(({kind,flipY})=>({kind,flipY})),calling:scene.nurseStationViewModel.metrics.callingCount};
    });
    if(JSON.stringify(initial.scale)!=='[1,1,1]'||initial.bindings.length!==6)throw new Error(JSON.stringify(initial));
    await page.getByRole('button',{name:'触发测试呼叫',exact:true}).click();
    const changed=await page.evaluate(()=>{
      const scene=fixture.scene;
      return {calling:scene.nurseStationViewModel.metrics.callingCount,
        displays:scene.nurseStationBoardDisplays.map(d=>({kind:d.kind,changed:fixture.hash(d.texture)!==fixture.before.find(b=>b.kind===d.kind).hash,flipY:d.texture.flipY})),
        modelRetained:scene.nurseStationModel.uuid===fixture.modelId};
    });
    if(changed.calling!==1||!changed.modelRetained||!changed.displays.find(d=>d.kind==='dashboard').changed)throw new Error(JSON.stringify(changed));
    if(changed.displays.some(d=>d.kind!=='clock'&&d.flipY))throw new Error('screen flipped after refresh');
    await page.waitForFunction(()=>{
      const clock=fixture.scene.nurseStationBoardDisplays.find(d=>d.kind==='clock');
      return fixture.hash(clock.texture)!==fixture.before.find(d=>d.kind==='clock').hash;
    });
    for(const [label,key] of [['恢复初始视角','front'],['工作侧检查','workstation'],['大屏检查','screen']]) {
      await page.getByRole('button',{name:label,exact:true}).click();
      await page.screenshot({path:`output/playwright/station-production-${key}.png`});
    }
    await page.getByRole('button',{name:'暂停/恢复场景',exact:true}).click();
    const paused=await page.evaluate(()=>fixture.scene.renderer.info.render.frame);
    await page.waitForTimeout(350);
    if(await page.evaluate(()=>fixture.scene.renderer.info.render.frame)!==paused)throw new Error('inactive scene keeps rendering');
    await page.getByRole('button',{name:'暂停/恢复场景',exact:true}).click();
    await page.waitForFunction(frame=>fixture.scene.renderer.info.render.frame>frame,paused);
    await page.getByRole('button',{name:'恢复初始视角',exact:true}).click();
    const layouts=[];
    for(const [width,height] of [[320,640],[768,1024],[1024,768],[1440,900]]) {
      await page.setViewportSize({width,height});
      await page.waitForFunction(()=>Math.abs(fixture.scene.camera.aspect-document.querySelector('#scene').clientWidth/document.querySelector('#scene').clientHeight)<.01);
      layouts.push(await page.evaluate(()=>({width:innerWidth,fov:fixture.scene.camera.fov,aspect:fixture.scene.camera.aspect,modelId:fixture.scene.nurseStationModel.uuid===fixture.modelId})));
      if(width===320)await page.screenshot({path:'output/playwright/station-production-mobile.png'});
    }
    await page.getByRole('button',{name:'恢复初始视角',exact:true}).click();
    await page.screenshot({path:'output/playwright/station-production-front.png'});
    const perf=await page.evaluate(async()=>{
      const scene=fixture.scene;const start=performance.now();const frame=scene.renderer.info.render.frame;
      await new Promise(resolve=>setTimeout(resolve,2000));
      return {sampleFps:Math.round((scene.renderer.info.render.frame-frame)*1000/(performance.now()-start)),drawCalls:scene.renderer.info.render.calls,triangles:scene.renderer.info.render.triangles,textures:scene.renderer.info.memory.textures};
    });
    const failedPage=await page.context().newPage();
    try {
      await failedPage.route('**/nurse-station-design-v2.glb?*',route=>route.abort());
      await failedPage.goto(page.url());
      await failedPage.waitForFunction(()=>document.querySelector('#state')?.textContent==='fallback');
      const model=await failedPage.evaluate(()=>fixture.scene.nurseStationModel);
      if(model!==null)throw new Error('failed model not cleared');
    } finally {await failedPage.close();}
    if(errors.length)throw new Error(errors.join('\n'));
    return {initial,changed,clockRefresh:'passed',pauseResume:'passed',modelFailure:'passed',layouts,perf,pageErrors:errors};
  }finally{page.off('pageerror',onError);page.off('console',onConsole);}
}
