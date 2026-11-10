const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=new URL(process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href);
base.searchParams.set('map','mountain');
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','camera');
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
const checks=[],pictures=[],errors=[];fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(options);let failure;
 try{
  for(const backend of ['webgl','software'])for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:740}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});
   await context.addInitScript(backend=>{
    window.requestAnimationFrame=()=>0;
    if(backend==='software'){
     const original=HTMLCanvasElement.prototype.getContext;
     HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};
    }
   },backend);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base.href);
   const result=await page.evaluate(()=>{
    start();selectView('chase');const original=playerCarMesh,frames=[];let capture;
    setInputSource('camera-regression','gas',true);
    for(let step=0;step<75;step++){
     update(.02);drawPerspective();const actual=ctx.getImageData(0,0,w,h).data;
     try{playerCarMesh=()=>[];drawPerspective();}
     finally{playerCarMesh=original;}
     const blank=ctx.getImageData(0,0,w,h).data;let pixels=0;
     for(let i=0;i<actual.length;i+=4)if(Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])>20)pixels++;
     const pose=typeof perspectivePose==='function'?perspectivePose():null;
     drawPerspective();
     if(step===59)capture=canvas.toDataURL().split(',')[1];
     frames.push({step,pixels,distance:pose?.distance,obstructed:pose?.obstructed,snapshot:gameSnapshot()});
    }
    clearInput();
    return {frames,capture,sceneFaces:roadMesh.length,actualBackend:mountainRenderer?'webgl':'software'};
   });
   const name=`${backend}-${viewport.width}`;
   fs.writeFileSync(path.join(out,name+'-beam.png'),Buffer.from(result.capture,'base64'));delete result.capture;pictures.push(name+'-beam.png');
   fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2)+'\n');
   assert.equal(result.actualBackend,backend,'requested real renderer must execute');
   for(const row of result.frames)assert(row.pixels>100,`${name}/step-${row.step}: vehicle hidden by near-camera beam (${row.pixels} pixels)`);
   assert(result.frames.some(row=>row.obstructed&&row.distance<150),'camera must actually retract');
   assert(result.frames.every(row=>row.distance>=29&&row.distance<=150),'camera stays outside chassis and inside nominal boom');
   for(let i=1;i<result.frames.length;i++)assert(Math.abs(result.frames[i].distance-result.frames[i-1].distance)<20,'camera geometry easing must bound adjacent 20ms steps on this route');
   checks.push({id:name,passed:true,frames:result.frames,sceneFaces:result.sceneFaces});
   console.log('PASS',name,'75 actual physics steps; beam retained; car visible; camera transition bounded');
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){failure=error;console.error(error);}
 finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:!failure,browser:browser.version(),target:base.href,checks,pictures,error:failure?.message,consoleErrors:errors,
   fixtureFrames:checks.reduce((n,row)=>n+row.frames.length,0),scope:'Exact start-to-beam reproduction with unmodified game physics and real Canvas pixels. Native animation is held to make the 20ms sequence deterministic. WebGL and software keep all original beam geometry. Separate browser-flicker.cjs exercises native animation.'},null,2)+'\n');
  await browser.close();
 }
 if(failure)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
