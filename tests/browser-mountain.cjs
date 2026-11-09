const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const url=process.env.DRIVE_MOUNTAIN_URL||pathToFileURL(path.join(root,'dist/index.html')).href+'?map=mountain';
const out=path.resolve(process.env.DRIVE_MOUNTAIN_EVIDENCE||path.join(root,'verification/mountain'));
const capture=process.env.DRIVE_CAPTURE!=='0',checks=[],pictures=[];
fs.mkdirSync(out,{recursive:true});
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
if(process.env.DRIVE_SINGLE_PROCESS==='1')options.args.push('--single-process','--no-zygote');
const scenarios=[
 {id:'start',setup:'place(0)',test:s=>{assert.equal(s.state,'running');assert.equal(s.elevation,0)}},
 {id:'s-bend',setup:'place(48)',test:s=>assert(s.elevation>100)},
 {id:'climb',setup:'place(104)',test:s=>assert(s.elevation>400)},
 {id:'cliff-warning',setup:'place(130,86);advance(.02)',test:s=>{assert.equal(s.hazard.kind,'edge');assert.equal(s.hazard.fall,0)}},
 {id:'fall',setup:'place(130,108);advance(.65)',test:s=>{assert(s.hazard.fall>.6);assert.equal(s.input.gas,false)}},
 {id:'checkpoint-recovery',setup:'for(let k=1;k<=125;k++){place(k);update(.02)}place(130,108);advance(1.8)',test:s=>{assert.equal(s.checkpoint,120);assert.equal(s.hazard.fall,0);assert.equal(s.progress,120);assert(Math.abs(s.elapsed-9.3)<.001)}},
 {id:'summit',setup:'for(let k=1;k<N;k++){place(k);update(.02)}',test:s=>{assert.equal(s.state,'finished');assert.equal(s.checkpoint,200)}}
];
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS',name)}catch(error){checks.push({name,passed:false,error:error.message});console.error('FAIL',name,error.message)}}
async function fixture(page,view,setup){return page.evaluate(({view,setup})=>{
 selectMap('mountain');start();selectView(view);
 const place=(i,offset=0)=>{const p=edgePoint(i,offset),a=track[Math.max(0,i-1)],b=track[Math.min(N-1,i+1)];car.x=p[0];car.y=p[2];car.z=p[1];car.angle=Math.atan2(b.y-a.y,b.x-a.x);car.speed=0};
 const advance=time=>{for(let t=0;t<time-1e-9;t+=.02)update(Math.min(.02,time-t))};
 eval(setup);camera={x:car.x,y:car.y};updateRaceHUD();updateFeedback();draw();return gameSnapshot();
 },{view,setup})}
(async()=>{
 const browser=await chromium.launch(options);
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  await page.goto(url);
  for(const size of[{name:'landscape',width:844,height:390},{name:'portrait',width:390,height:844}]){
   await page.setViewportSize(size);
   for(const view of['first','chase','top'])for(const scenario of scenarios){
    await check(`${size.name}/${view}/${scenario.id}`,async()=>{
     const snapshot=await fixture(page,view,scenario.setup);scenario.test(snapshot);
     const filename=`${size.name}-${view}-${scenario.id}.jpg`;
     if(capture)await page.screenshot({path:path.join(out,filename),type:'jpeg',quality:85});
     pictures.push({scenario:scenario.id,view,size:size.name,snapshot,file:capture?filename:null});
    });
   }
   await check(`${size.name}/map picker and driving controls fit viewport`,async()=>{
    if(!await page.locator('#overlay').isVisible())await page.locator('#map-menu').click();await page.locator('[data-map=mountain]').click();
    for(const selector of['#start','[data-map=circuit]','[data-map=mountain]']){const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,selector)}
    await page.locator('#start').click();
    const selectors=['#map-menu','[data-view=first]','[data-view=chase]','[data-view=top]','[data-key=left]','[data-key=right]','[data-key=gas]','[data-key=brake]','#recover'];
    const boxes=[];for(const selector of selectors){const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,selector);boxes.push({selector,...b})}
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y),`${a.selector} overlaps ${b.selector}`)}
   });
  }
  await page.setViewportSize({width:844,height:390});
  await check('all 240 mountain chase headings keep rear deck visible above road',async()=>{
   await fixture(page,'chase','');
   const failures=await page.evaluate(()=>{
    const failures=[];for(let i=0;i<N;i++){
     const p=track[i],a=track[Math.max(0,i-1)],b=track[Math.min(N-1,i+1)];car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(b.y-a.y,b.x-a.x);
     const pose=perspectivePose(),[fx,fz]=pose.forward,{grade,pitch,focal,horizon}=pose;
     const forward=pose.distance-17,dy=car.z+13.5-17*grade-pose.camera[1];
     drawPerspective();const x=Math.round(w/2),y=Math.round(horizon-(dy*Math.cos(pitch)+forward*Math.sin(pitch))*focal/(forward*Math.cos(pitch)-dy*Math.sin(pitch)));
     const rgb=Array.from(ctx.getImageData(x,y,1,1).data).slice(0,3);
     if(rgb.some((v,k)=>Math.abs(v-[210,250,96][k])>3))failures.push({index:i,rgb,x,y});
    }return failures;
   });assert.deepEqual(failures,[]);
  });
  await check('new UI starts and actual keyboard gas moves uphill',async()=>{
   await page.reload();await page.locator('#start').click();const before=await page.evaluate(()=>gameSnapshot());
   await page.keyboard.down('ArrowUp');await page.evaluate(()=>{for(let i=0;i<100;i++)update(.02);draw()});await page.keyboard.up('ArrowUp');
   const after=await page.evaluate(()=>gameSnapshot());assert(after.speed>150);assert(after.elevation>before.elevation);assert.notEqual(after.y,before.y);
  });
  await check('actual two-finger steering and gas release independently on mountain',async()=>{
   await fixture(page,'first','');const cdp=await context.newCDPSession(page);
   const point=async(selector,id)=>{const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2,id}};
   const left=await point('[data-key=left]',1),gas=await point('[data-key=gas]',2);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,gas]});assert((await page.evaluate(()=>gameSnapshot())).input.left);assert((await page.evaluate(()=>gameSnapshot())).input.gas);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[left]});const s=await page.evaluate(()=>gameSnapshot());assert.equal(s.input.left,false,'left release: '+JSON.stringify(s.input));assert.equal(s.input.gas,true,'gas stays held: '+JSON.stringify(s.input));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(Object.values((await page.evaluate(()=>gameSnapshot())).input).every(v=>!v));
  });
  await check('map buttons reset the current run and separate best times',async()=>{
   await fixture(page,'first','elapsed=30;finish()');const mountainBest=await page.locator('#best').textContent();await page.locator('[data-map=circuit]').click();assert.equal((await page.evaluate(()=>gameSnapshot())).map,'circuit');assert.equal(await page.locator('#best').textContent(),'—');
   await page.locator('#start').click();await page.evaluate(()=>{elapsed=20;finish()});await page.locator('[data-map=mountain]').click();assert.equal(await page.locator('#best').textContent(),mountainBest);assert.equal((await page.evaluate(()=>gameSnapshot())).elapsed,0);
  });
  await check('mountain selection and camera persist on clean reload',async()=>{await page.locator('#start').click();await page.locator('[data-view=chase]').click();await page.reload();const s=await page.evaluate(()=>gameSnapshot());assert.equal(s.map,'mountain');assert.equal(s.view,'chase');assert.equal(s.state,'ready')});
  await check('Canvas fallback stays usable when WebGL is unavailable',async()=>{await fixture(page,'first','mountainRenderer=null;place(50);draw()');const s=await page.evaluate(()=>gameSnapshot());assert.equal(s.state,'running');if(capture)await page.screenshot({path:path.join(out,'canvas-fallback.jpg'),type:'jpeg',quality:85})});
  await check('no game browser errors',async()=>assert.deepEqual(errors,[]));
 }finally{await browser.close()}
 const failures=checks.filter(c=>!c.passed);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({source:url.startsWith('file:')?'dist/index.html?map=mountain':url,createdAt:new Date().toISOString(),checks,pictures,limitations:'Scenario positions and race progress are fixtures. Real update() and Chromium rendering execute. Keyboard and CDP touch input are separate checks. This does not replace physical Android/iPhone testing.'},null,2));
 console.log(`RESULT: ${pictures.length} mountain scenarios, ${checks.length} checks, ${failures.length} failures`);if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
