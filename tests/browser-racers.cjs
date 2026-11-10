const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'..');
const base=process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href;
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','racers-browser');
const maps=['circuit','mountain','proving','city','offroad'];
const views=['first','chase','top'];
const checks=[],screenshots=[],videos=[],errors=[];
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
fs.mkdirSync(out,{recursive:true});

function url(map){const target=new URL(base);target.searchParams.set('map',map);return target.href;}
const snapshot=page=>page.evaluate(()=>gameSnapshot());
const moved=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function roster(state,map){
 assert.equal(state.racers.mapId,map);
 assert.deepEqual(state.racers.actors.map(a=>a.id).sort(),['ally','rival-1','rival-2']);
 assert.equal(state.racers.actors.filter(a=>a.team==='blue').length,1);
 assert.equal(state.racers.actors.filter(a=>a.team==='red').length,2);
 assert.equal(new Set(state.racers.standings.map(a=>a.id)).size,4);
 assert.deepEqual(state.racers.standings.map(a=>a.rank).sort(),[1,2,3,4]);
 assert.equal(state.racers.teamScores.blue+state.racers.teamScores.red,10);
 for(const actor of state.racers.actors){
  for(const key of ['x','y','z','angle','speed','progress'])assert(Number.isFinite(actor[key]),`${actor.id}.${key}`);
 }
}
function record(name,scope,details={}){checks.push({id:name,name,scope,passed:true,...details});console.log('PASS',name);}
function observe(page){
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('favicon'))errors.push(message.text());});
}
async function frames(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function capture(page,name){const filename=name+'.png';await page.screenshot({path:path.join(out,filename)});screenshots.push(filename);}
async function waitForMovement(page,before,minimum=8){
 await page.waitForFunction(({before,minimum})=>gameSnapshot().racers.actors.every(actor=>{
  const old=before.find(item=>item.id===actor.id);
  return Math.hypot(actor.x-old.x,actor.y-old.y)>minimum;
 }),{before:before.racers.actors,minimum},{timeout:15000});
}
async function sustainedDrive(page,initial,seconds=10){
 const observations=[initial];
 for(let second=1;second<=seconds;second++){
  await page.waitForFunction(target=>gameSnapshot().racers.simulationTime>=target,
   initial.racers.simulationTime+second,{timeout:15000});
  observations.push(await snapshot(page));
 }
 return observations;
}
async function controlsReachable(page,viewport){
 for(const selector of ['[data-key=left]','[data-key=right]','[data-key=gas]','[data-key=brake]','#recover','#map-menu']){
  const element=page.locator(selector),box=await element.boundingBox();
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+.5&&box.y+box.height<=viewport.height+.5,selector);
  assert(await element.evaluate(element=>{
   const box=element.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);
   return element===hit||element.contains(hit);
  }),`${selector} is covered by the team HUD`);
 }
}

async function normalCase(browser,map,viewport,video=false){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:true,
  ...(video?{recordVideo:{dir:path.join(out,'raw-video'),size:viewport}}:{})});
 const page=await context.newPage();observe(page);
 const videoHandle=video?page.video():null;
 try{
  await page.goto(url(map));
  await page.waitForFunction(()=>typeof gameSnapshot==='function'&&gameSnapshot().racers);
  const ready=await snapshot(page);roster(ready,map);
  assert.equal(ready.state,'ready');assert.equal(ready.racers.simulationTime,0);
  assert.equal(await page.locator('#team-hud').isVisible(),true);
  assert.match(await page.locator('#team-hud').innerText(),/蓝|队友/);
  await page.waitForTimeout(100);
  assert.deepEqual((await snapshot(page)).racers,ready.racers);
  await page.locator('#start').click();
  const initial=await snapshot(page);
  const observations=await sustainedDrive(page,initial);
  const driven=observations.at(-1),simulationSeconds=driven.racers.simulationTime-initial.racers.simulationTime;
  assert(simulationSeconds>=10,'ordinary animation must run for ten simulation seconds');
  for(const observed of observations){
   roster(observed,map);assert.equal(observed.state,'running');
   assert(Object.values(observed.input).every(value=>value===false),'sustained AI drive must keep player input idle');
  }
  const movements=driven.racers.actors.map(actor=>{
   const before=initial.racers.actors.find(item=>item.id===actor.id);
   const samples=observations.map(item=>item.racers.actors.find(item=>item.id===actor.id));
   const travelled=samples.slice(1).reduce((total,item,index)=>total+moved(item,samples[index]),0);
   const progress=actor.progress-before.progress,recoveringSamples=samples.filter(item=>item.phase==='recovering').length;
   assert(progress>=10,`${map}/${viewport.width}: ${actor.id} failed to advance ten route samples in ten seconds (${progress})`);
   assert(travelled>=100,`${map}/${viewport.width}: ${actor.id} failed to drive 100 world units (${travelled})`);
   assert(recoveringSamples<samples.length/2,`${map}/${viewport.width}: ${actor.id} spent most observations recovering`);
   return{id:actor.id,distance:moved(actor,before),travelled,progress,recoveringSamples};
  });
  record(`${map}/${viewport.width}: all three computer cars drive while player is idle`,'normal animation',
   {simulationSeconds,movements,initial,driven,observations});

  await page.locator('#pause').click();
  const paused=await snapshot(page);assert.equal(paused.state,'paused');
  await page.waitForTimeout(180);
  assert.deepEqual(await snapshot(page),paused);
  await page.locator('#start').click();
  await waitForMovement(page,paused,4);
  record(`${map}/${viewport.width}: pause freezes the full world and resume restarts actual movement`,'normal animation');

  for(const view of views){
   await page.locator('#reset').click();
   await page.locator(`[data-view=${view}]`).click();
   await frames(page);
   assert.equal((await snapshot(page)).view,view);
   await capture(page,`normal-${viewport.width}-${map}-${view}`);
  }
  await controlsReachable(page,viewport);
  record(`${map}/${viewport.width}: three cameras render and team HUD does not cover driving controls`,'normal animation');

  await page.locator('#reset').click();
  const start=await snapshot(page);
  await page.keyboard.down('w');
  await page.waitForFunction(()=>gameSnapshot().speed>80,null,{timeout:15000});
  const angle=await page.evaluate(()=>car.angle);
  await page.keyboard.down('a');
  await page.waitForFunction(angle=>Math.abs(car.angle-angle)>.005,angle,{timeout:5000});
  await page.keyboard.up('a');await page.keyboard.up('w');
  const steered=await snapshot(page);
  assert(moved(steered,start)>5);
  assert.equal(steered.input.left,false);assert.equal(steered.input.gas,false);
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>Math.abs(gameSnapshot().speed)<15,null,{timeout:5000});
  await page.keyboard.up('Space');
  record(`${map}/${viewport.width}: real keyboard throttle, steering and braking change player motion`,'normal animation');

  const beforeRecovery=await snapshot(page);
  await page.locator('#recover').click();
  const recovered=await snapshot(page);
  const simDelta=recovered.racers.simulationTime-beforeRecovery.racers.simulationTime;
  assert(Math.abs((recovered.elapsed-beforeRecovery.elapsed)-simDelta-3)<.12,'player recovery must add exactly three seconds independently of AI simulation');
  for(const actor of recovered.racers.actors){
   const before=beforeRecovery.racers.actors.find(item=>item.id===actor.id);
   assert(moved(actor,before)<=600*(simDelta+.04)+2,`${actor.id} teleported when player received a time penalty`);
  }
  record(`${map}/${viewport.width}: player recovery penalty does not advance or teleport AI`,'normal animation',{simulationDelta:simDelta});

  await page.locator('#pause').click();
  await page.locator('#reset').click();
  const reset=await snapshot(page);roster(reset,map);
  assert.equal(reset.racers.finishOrder.length,0);
  assert(reset.racers.simulationTime<.75);
  assert(reset.racers.actors.every(actor=>actor.nextCheckpoint===0&&actor.finishTime===null&&actor.phase==='racing'));
  await page.locator('#map-menu').click();
  const next=maps[(maps.indexOf(map)+1)%maps.length];
  await page.locator(`[data-map=${next}]`).click();
  const switched=await snapshot(page);roster(switched,next);
  assert.equal(switched.state,'ready');assert.equal(switched.racers.simulationTime,0);
  assert.equal(switched.racers.finishOrder.length,0);
  assert(switched.racers.actors.every(actor=>actor.nextCheckpoint===0&&actor.finishTime===null&&actor.phase==='racing'));
  record(`${map}/${viewport.width}: restart and map switch remove the previous race`,'normal animation');
 }catch(error){
  fs.writeFileSync(path.join(out,`failure-${viewport.width}-${map}.json`),JSON.stringify({snapshot:await snapshot(page).catch(()=>null),errors,error:error.message},null,2)+'\n');
  await capture(page,`failure-${viewport.width}-${map}`).catch(()=>{});
  throw error;
 }finally{
  await context.close();
  if(videoHandle){
   const source=await videoHandle.path(),name=`normal-${map}-${viewport.width}.webm`;
   fs.copyFileSync(source,path.join(out,name));videos.push(name);
  }
 }
}

async function rendererCase(browser,backend){
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
 await context.addInitScript(backend=>{
  window.requestAnimationFrame=()=>0;
  if(backend==='software'){
   const original=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};
  }
 },backend);
 const page=await context.newPage();observe(page);
 try{
  for(const map of maps){
   await page.goto(url(map));
   for(const view of views){
    const rendered=await page.evaluate(({view})=>{
     start();const p=track[20],q=track[21],angle=Math.atan2(q.y-p.y,q.x-p.x),fx=Math.cos(angle),fy=Math.sin(angle);
     car.x=p.x;car.y=p.y;car.z=p.z;car.angle=angle;car.speed=0;camera={x:p.x,y:p.y};
     const layout=[[85,-35],[110,33],[165,-5]],slope=(q.z-p.z)/Math.hypot(q.x-p.x,q.y-p.y);
     racers.actors.forEach((actor,index)=>{
      const[forward,lateral]=layout[index];
      actor.x=p.x+fx*forward-fy*lateral;actor.y=p.y+fy*forward+fx*lateral;actor.z=p.z+slope*forward;
      actor.angle=angle;actor.phase='racing';actor.speed=0;
     });
     selectView(view);draw();
     const actual=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     const actors=racers.actors;racers.actors=[];draw();const blank=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     racers.actors=actors;draw();let blue=0,red=0,changed=0;
     for(let i=0;i<actual.length;i+=4){
      if(Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])<30)continue;
      changed++;const r=actual[i],g=actual[i+1],b=actual[i+2];
      if(b>130&&b>r*1.2&&b>g*1.06)blue++;
      if(r>130&&r>g*1.25&&r>b*1.25)red++;
     }
     const perActor=[];
     for(const actor of actors){
      racers.actors=actors.filter(item=>item!==actor);draw();const removed=ctx.getImageData(0,0,canvas.width,canvas.height).data;
      let pixels=0;for(let i=0;i<actual.length;i+=4)if(Math.abs(actual[i]-removed[i])+Math.abs(actual[i+1]-removed[i+1])+Math.abs(actual[i+2]-removed[i+2])>30)pixels++;
      perActor.push({id:actor.id,pixels});
     }
     racers.actors=actors;draw();
     return{blue,red,changed,perActor,actualBackend:activeMap.mountain||activeMap.generic?(mountainRenderer?'webgl':'software'):'canvas',snapshot:gameSnapshot()};
    },{view});
    roster(rendered.snapshot,map);
    assert(rendered.blue>50,`${backend}/${map}/${view}: blue ally body is missing (${rendered.blue})`);
    assert(rendered.red>80,`${backend}/${map}/${view}: red rival bodies are missing (${rendered.red})`);
    for(const actor of rendered.perActor)assert(actor.pixels>60,`${backend}/${map}/${view}: ${actor.id} has no visible vehicle body (${actor.pixels})`);
    if(map!=='circuit'&&view!=='top')assert.equal(rendered.actualBackend,backend);
    await capture(page,`fixture-${backend}-${map}-${view}`);
    record(`${backend}/${map}/${view}: real Canvas contains all three colored vehicle bodies`,'deterministic renderer fixture',{bluePixels:rendered.blue,redPixels:rendered.red,vehicles:rendered.perActor});
   }
  }
 }finally{await context.close();}
}

async function edgeCases(browser){
 const context=await browser.newContext({viewport:{width:844,height:390}});
 await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 const page=await context.newPage();observe(page);
 try{
  await page.goto(url('circuit'));
  const result=await page.evaluate(()=>{
   start();const actor=racers.actors[0],before={x:actor.x,y:actor.y};
   actor.x=car.x-8;actor.y=car.y;actor.z=car.z;actor.angle=car.angle;actor.speed=80;car.speed=140;
   const overlap=Math.hypot(actor.x-car.x,actor.y-car.y);
   update(.02);
   return{before,overlap,afterDistance:Math.hypot(actor.x-car.x,actor.y-car.y),speed:car.speed,snapshot:gameSnapshot()};
  });
  assert(result.afterDistance>result.overlap+5,'player and AI remain interpenetrated');
  assert(result.snapshot.racers.actors[0].contacts>0,'physical contact was not recorded');
  record('physical player-AI contact separates real vehicles','deterministic physics fixture',{separation:result.afterDistance});

  const policies=await page.evaluate(()=>{
   start();const ally=racers.actors[0];
   for(const actor of racers.actors)if(actor!==ally)actor.phase='finished';
   Object.assign(ally,DriveRacers.sample(racers,380,0),{speed:80,lane:0});
   Object.assign(car,DriveRacers.sample(racers,300,0),{speed:110});
   const allyBefore={x:ally.x,y:ally.y,speed:ally.speed};
   DriveRacers.step(racers,.1,{state:'running',player:car,playerFalling:false,signalTime:0,traffic:[],obstacles:[]});
   const yielded={intent:ally.intent,lane:ally.targetLane,speed:ally.speed,distance:Math.hypot(ally.x-allyBefore.x,ally.y-allyBefore.y),beforeSpeed:allyBefore.speed};
   start();const rival=racers.actors[1];
   for(const actor of racers.actors)if(actor!==rival)actor.phase='finished';
   Object.assign(rival,DriveRacers.sample(racers,300,0),{speed:80,lane:0});
   Object.assign(car,DriveRacers.sample(racers,375,0),{speed:0});
   const rivalBefore={x:rival.x,y:rival.y};
   DriveRacers.step(racers,.1,{state:'running',player:car,playerFalling:false,signalTime:0,traffic:[],obstacles:[]});
   return{yielded,passed:{intent:rival.intent,lane:rival.targetLane,distance:Math.hypot(rival.x-rivalBefore.x,rival.y-rivalBefore.y)}};
  });
  assert.equal(policies.yielded.intent,'yield');
  assert(Math.abs(policies.yielded.lane)>15,'ally did not make room for the player');
  assert(policies.yielded.speed<policies.yielded.beforeSpeed,'ally did not reduce speed');
  assert(policies.yielded.distance>.1,'ally policy never reached actual movement');
  assert.equal(policies.passed.intent,'pass');
  assert(Math.abs(policies.passed.lane)>40,'rival did not choose the free overtaking lane');
  assert(policies.passed.distance>.1,'rival policy never reached actual movement');
  record('ally yields and rival uses an open passing lane with actual movement','deterministic policy fixture',policies);

  await page.evaluate(()=>{start();finish();draw();});
  const finished=await snapshot(page);assert.equal(finished.state,'finished');
  await page.evaluate(()=>{for(let i=0;i<100;i++)update(.02);draw();});
  assert.deepEqual(await snapshot(page),finished);
  assert.match(await page.locator('#overlay').innerText(),/玩家完赛时积分/);
  await capture(page,'fixture-player-finished');
  record('player finish freezes all AI and labels scores at the player finish time','deterministic lifecycle fixture');
 }finally{await context.close();}
}

(async()=>{
 let browser,failure;
 try{
  browser=await chromium.launch(options);
  for(const viewport of [{width:1280,height:720},{width:390,height:844}])for(const map of maps)await normalCase(browser,map,viewport,map==='circuit'&&viewport.width===1280);
  await rendererCase(browser,'webgl');
  await rendererCase(browser,'software');
  await edgeCases(browser);
  assert.deepEqual(errors,[],'game emitted browser errors');
 }catch(error){failure=error;console.error(error.stack);}
 finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:!failure,source:base,target:base,browser:browser?.version(),
   normalAnimation:checks.filter(item=>item.scope==='normal animation'&&item.name.includes('player is idle')).length===10,
   normalAnimationCases:checks.filter(item=>item.scope==='normal animation'&&item.name.includes('player is idle')).length,
   animation:'Each normal case observes at least ten simulation seconds of ordinary requestAnimationFrame with idle player input before real keyboard/UI checks. Only explicitly labelled deterministic fixtures hold requestAnimationFrame.',
   checks,screenshots,videos,consoleErrors:errors,error:failure?.stack,physicalPhone:false},null,2)+'\n');
  if(browser)await browser.close();
 }
 if(failure)process.exitCode=1;
 else console.log(`PASS: ${checks.length} team-race browser checks, ${screenshots.length} screenshots, ${videos.length} real-animation video`);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
