async page => {
  await page.route('**/__ward-first-frame__',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>病房首帧回归 · 合成场景</title><div id="scene" style="width:100vw;height:100vh"></div>'}));
  await page.goto('http://localhost:5173/__ward-first-frame__');
  await page.evaluate(async()=>{
    const {WardScene}=await import('/src/core/ward-scene.ts');
    const original=WardScene.prototype.warmGpu;
    window.audit={states:[],gpuEntered:false,gpuFinished:false,framesAtReady:null,framesAtGpuFinish:null};
    const gate=new Promise(resolve=>audit.release=resolve);
    WardScene.prototype.warmGpu=async function(){audit.gpuEntered=true;await gate;await original.call(this);audit.gpuFinished=true;audit.framesAtGpuFinish=this.renderer.info.render.frame;};
    audit.restore=()=>{WardScene.prototype.warmGpu=original;};
    audit.scene=new WardScene({container:document.getElementById('scene'),onModelState:state=>{
      audit.states.push(state);
      if(state==='ready')audit.framesAtReady=audit.scene.renderer.info.render.frame;
    }});
  });
  try {
    await page.waitForFunction(()=>audit.gpuEntered||audit.states.includes('fallback'),null,{timeout:60000});
    const held=await page.evaluate(()=>({gpuEntered:audit.gpuEntered,states:[...audit.states]}));
    if(!held.gpuEntered||held.states.includes('ready'))throw Error('premature ready: '+JSON.stringify(held));
    await page.evaluate(()=>audit.release());
    await page.waitForFunction(()=>audit.states.includes('ready')||audit.states.includes('fallback'),null,{timeout:30000});
    const result=await page.evaluate(()=>({heldUntilGpu:!audit.states.slice(0,-1).includes('ready'),states:audit.states,gpuFinished:audit.gpuFinished,renderedAfterGpu:audit.framesAtReady>audit.framesAtGpuFinish}));
    if(!result.gpuFinished||!result.renderedAfterGpu||result.states.at(-1)!=='ready')throw Error(JSON.stringify(result));
    return result;
  }finally{await page.evaluate(()=>{audit.release();audit.scene.dispose();audit.restore();});}
}
