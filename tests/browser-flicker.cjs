const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),base=new URL(process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href);
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','flicker');
const sizes=[{width:844,height:390},{width:390,height:844},{width:320,height:740}];
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
const checks=[],pictures=[],videos=[],errors=[];
fs.mkdirSync(out,{recursive:true});

async function installProbe(page){
 await page.evaluate(()=>{
  window.vehicleRegion=()=>{
   const original=cuboidMesh;
   drawPerspective();const actual=ctx.getImageData(0,0,w,h).data;
   try{cuboidMesh=(...args)=>args[2]===42&&args[3]===23||args[2]===19&&args[3]===20?[]:original(...args);drawPerspective();}
   finally{cuboidMesh=original;}
   const blank=ctx.getImageData(0,0,w,h).data;
   let pixels=0,minX=w,minY=h,maxX=0,maxY=0,hash=2166136261;
   for(let i=0;i<actual.length;i+=4){
    if(Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])>20){
     const x=(i/4)%canvas.width/(canvas.width/w),y=Math.floor(i/4/canvas.width)/(canvas.height/h);
     pixels++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    hash=Math.imul(hash^actual[i],16777619);hash=Math.imul(hash^actual[i+1],16777619);hash=Math.imul(hash^actual[i+2],16777619);
   }
   drawPerspective();
   return {pixels,width:maxX-minX+1,height:maxY-minY+1,hash:hash>>>0};
  };
 });
}
async function picture(page,name){
 await page.screenshot({path:path.join(out,name+'.png')});pictures.push(name+'.png');
 const png=await page.evaluate(()=>canvas.toDataURL().split(',')[1]);
 fs.writeFileSync(path.join(out,name+'-canvas.png'),Buffer.from(png,'base64'));pictures.push(name+'-canvas.png');
}
function visible(row,label){assert(row.pixels>100&&row.width>15&&row.height>10,label+': '+JSON.stringify(row));}
async function imageDifference(page,actual,expected){
 return page.evaluate(async([a,b])=>{
  const read=async source=>{const image=new Image();image.src=source;await image.decode();const surface=document.createElement('canvas');surface.width=image.width;surface.height=image.height;const context=surface.getContext('2d');context.drawImage(image,0,0);return{width:image.width,height:image.height,pixels:context.getImageData(0,0,image.width,image.height).data};};
  const first=await read(a),second=await read(b);
  if(first.width!==second.width||first.height!==second.height)return {sameSize:false};
  let total=0,changed=0;
  for(let i=0;i<first.pixels.length;i+=4){let max=0;for(let c=0;c<3;c++){const delta=Math.abs(first.pixels[i+c]-second.pixels[i+c]);total+=delta;max=Math.max(max,delta);}if(max>12)changed++;}
  const count=first.width*first.height;return{sameSize:true,mean:total/(count*3),fractionOver12:changed/count};
 },[actual,expected]);
}
function matchesFresh(difference){return difference.sameSize&&difference.mean<1&&difference.fractionOver12<.002;}

(async()=>{
 const browser=await chromium.launch(options);
 let failure;
 try{
  for(const viewport of sizes){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   for(const map of ['circuit','mountain','proving','city','offroad']){
    const url=new URL(base);url.searchParams.set('map',map);await page.goto(url.href);
    await installProbe(page);await page.locator('#start').click();await page.locator('[data-view=chase]').click();
    await page.keyboard.down('w');
    const frames=await page.evaluate(async()=>{
     const rows=[];
     for(let i=0;i<36;i++){
      await new Promise(requestAnimationFrame);
      rows.push({frame:i,...vehicleRegion(),snapshot:gameSnapshot()});
     }
     return rows;
    });
    await page.keyboard.up('w');
    for(const row of frames)visible(row,`${map}/${viewport.width}/frame-${row.frame}`);
    assert(frames.at(-1).snapshot.elapsed>frames[0].snapshot.elapsed);
    assert(frames.some(row=>row.snapshot.speed>5),'normal animation must actually drive');
    checks.push({id:`${map}/${viewport.width}/continuous-driving`,passed:true,frames});
    console.log('PASS',map,viewport.width,'36 native animation frames; zero missing car frames');
   }
   for(const map of ['mountain','proving','city','offroad']){
    const url=new URL(base);url.searchParams.set('map',map);await page.goto(url.href);await installProbe(page);
    await page.locator('#start').click();await page.locator('[data-view=chase]').click();
    await page.locator('#pause').click();await page.evaluate(()=>$('#overlay').hidden=true);
    const name=`${map}-${viewport.width}`;
    const before=await page.evaluate(()=>vehicleRegion());visible(before,name+'/before');
    await picture(page,name+'-before');
    const immediate=await page.evaluate(()=>{
     const surface=mountainRenderer.surface,gl=surface.getContext('webgl'),extension=gl.getExtension('WEBGL_lose_context');
     if(!extension)throw new Error('WEBGL_lose_context required for this regression');
     window.flickerContext={surface,gl,extension,restored:0,lost:0};
     surface.addEventListener('webglcontextlost',()=>flickerContext.lost++);
     surface.addEventListener('webglcontextrestored',()=>flickerContext.restored++);
     extension.loseContext();
     const claimsSuccess=drawMountainPerspective(),region=vehicleRegion();
     return {lost:gl.isContextLost(),claimsSuccess,...region,canvas:canvas.toDataURL().split(',')[1]};
    });
    fs.writeFileSync(path.join(out,name+'-immediate-loss-canvas.png'),Buffer.from(immediate.canvas,'base64'));
    pictures.push(name+'-immediate-loss-canvas.png');delete immediate.canvas;
    await page.waitForFunction(()=>flickerContext.lost===1);
    const lost=await page.evaluate(()=>vehicleRegion());
    await picture(page,name+'-lost');
    fs.writeFileSync(path.join(out,name+'-loss.json'),JSON.stringify({before,immediate,lost},null,2)+'\n');
    assert.equal(immediate.lost,true);assert.equal(immediate.claimsSuccess,false,'lost WebGL must yield to software before event delivery');
    visible(immediate,name+'/immediate-loss');visible(lost,name+'/lost');
    const stable=await page.evaluate(async()=>{
     const rows=[];for(let i=0;i<6;i++){await new Promise(requestAnimationFrame);rows.push(vehicleRegion());}return rows;
    });
    assert(stable.every(row=>row.hash===stable[0].hash),'paused fallback frame must be pixel-stable');
    for(const view of ['first','top','chase']){
     const pose=await page.evaluate(()=>JSON.stringify(gameSnapshot()));
     await page.locator(`[data-view=${view}]`).click();
     const after=await page.evaluate(()=>gameSnapshot());assert.equal(after.view,view);
     const expected=JSON.parse(pose);expected.view=view;assert.deepEqual(after,expected);
    }
    const other=map==='mountain'?'proving':'mountain';
    await page.evaluate(other=>{selectMap(other);state='paused';$('#overlay').hidden=true;},other);
    const otherLost=await page.evaluate(()=>vehicleRegion());visible(otherLost,name+'/map-during-loss');
    await page.setViewportSize({width:viewport.height,height:viewport.width});
    await page.waitForFunction(size=>{
     const box=canvas.getBoundingClientRect();
     return innerWidth===size.width&&innerHeight===size.height&&Math.abs(w-box.width)<.5&&Math.abs(h-box.height)<.5;
    },{width:viewport.height,height:viewport.width});
    visible(await page.evaluate(()=>vehicleRegion()),name+'/resize-during-loss');
    await page.evaluate(()=>flickerContext.extension.restoreContext());
    await page.waitForFunction(()=>flickerContext.restored===1);
    const restored=await page.evaluate(()=>({success:drawMountainPerspective(),sameCanvas:mountainRenderer.surface===flickerContext.surface,glError:flickerContext.gl.getError(),...vehicleRegion(),png:canvas.toDataURL(),snapshot:gameSnapshot(),pose:perspectivePose()}));
    const restoredCanvas=restored.png;delete restored.png;
    assert(restored.success&&restored.sameCanvas);assert.equal(restored.glError,0);visible(restored,name+'/restored');
    const reference=await context.newPage();await reference.setViewportSize({width:viewport.height,height:viewport.width});
    const referenceUrl=new URL(base);referenceUrl.searchParams.set('map',other);await reference.goto(referenceUrl.href);await installProbe(reference);
    const expected=await reference.evaluate(()=>{state='paused';$('#overlay').hidden=true;selectView('chase');const region=vehicleRegion();return{region,png:canvas.toDataURL(),snapshot:gameSnapshot(),pose:perspectivePose()};});
    assert.deepEqual(restored.snapshot,expected.snapshot);assert.deepEqual(restored.pose,expected.pose);
    const comparison=await imageDifference(reference,restoredCanvas,expected.png);
    assert(matchesFresh(comparison),'restored current-map pixels differ from a fresh renderer: '+JSON.stringify(comparison));
    let wrongMapControl;
    if(map==='mountain'){
     const wrong=await reference.evaluate(map=>{selectMap(map);state='paused';$('#overlay').hidden=true;drawPerspective();return canvas.toDataURL();},map);
     wrongMapControl=await imageDifference(reference,restoredCanvas,wrong);
     assert(!matchesFresh(wrongMapControl),'fresh-frame comparison must reject stale pixels from the wrong map');
    }
    await reference.close();
    await picture(page,name+'-restored');
    const midComposite=await page.evaluate(()=>{
     const original=ctx.drawImage;let injected=false;
     try{
      ctx.drawImage=function(surface,...args){if(surface===flickerContext.surface&&!injected){injected=true;flickerContext.extension.loseContext();}return original.call(this,surface,...args);};
      return{claimsSuccess:drawMountainPerspective(),lost:flickerContext.gl.isContextLost()};
     }finally{ctx.drawImage=original;}
    });
    assert(midComposite.lost);assert.equal(midComposite.claimsSuccess,false,'loss during compositing must yield to software');
    await page.waitForFunction(()=>flickerContext.lost===2);
    visible(await page.evaluate(()=>vehicleRegion()),name+'/second-loss');
    await page.evaluate(()=>flickerContext.extension.restoreContext());await page.waitForFunction(()=>flickerContext.restored===2);
    const second=await page.evaluate(()=>({...vehicleRegion(),png:canvas.toDataURL()}));visible(second,name+'/second-restore');
    const secondComparison=await imageDifference(page,second.png,expected.png);assert(matchesFresh(secondComparison),JSON.stringify(secondComparison));
    assert.equal(await page.evaluate(()=>mountainRenderer.surface===flickerContext.surface),true);
    checks.push({id:name+'/loss-restore-map-resize',passed:true,before,immediate,lost,restored,comparison,secondComparison,wrongMapControl,midComposite,pausedPixelStable:true,repeatedLosses:2});
    await page.setViewportSize(viewport);
    console.log('PASS',name,'pre-event loss, software frames, camera/map/resize, two restores');
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){failure=error;console.error(error);}
 finally{
  const summary={passed:!failure,browser:browser.version(),target:base.href,checks,pictures,videos,
   temporalFrames:checks.reduce((n,row)=>n+(row.frames?.length||0),0),consoleErrors:errors,error:failure?.message,
   scope:'Native animation and real keyboard drive all five maps. Context loss uses the official WebGL extension. Paused render fixtures permit per-frame car-only differential pixels without covering the image with the pause overlay. Geometry/physics are never replaced. Physical phones are not tested.'};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(summary,null,2)+'\n');
  await browser.close();
 }
 if(failure)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
