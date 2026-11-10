const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const url=new URL(process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href);url.searchParams.set('map','circuit');
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','slice');fs.mkdirSync(out,{recursive:true});
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
(async()=>{
 const browser=await chromium.launch(options),context=await browser.newContext({viewport:{width:1000,height:600},deviceScaleFactor:1,recordVideo:{dir:out,size:{width:1000,height:600}}});
 const page=await context.newPage(),errors=[],samples=[],laps=[],keys=new Set(),pictures=[];let failure,result;
 page.on('pageerror',e=>errors.push(e.message));
 const key=async(name,down)=>{if(down&&!keys.has(name)){await page.keyboard.down(name);keys.add(name)}else if(!down&&keys.has(name)){await page.keyboard.up(name);keys.delete(name)}};
 try{
  await page.goto(url.href);await page.click('#start');await page.click('[data-view=chase]');
  await page.evaluate(()=>{window.sliceFrameTimes=[];let previous;const observe=t=>{if(previous!==undefined)sliceFrameTimes.push(t-previous);previous=t;if(gameSnapshot().state==='running')requestAnimationFrame(observe)};requestAnimationFrame(observe)});
  const start=Date.now();let integral=0,lastLap=0,contactPicture=false,steeringSign=0;
  await page.screenshot({path:path.join(out,'01-start.jpg'),type:'jpeg',quality:80});pictures.push('01-start.jpg');
  while(Date.now()-start<100000){
   const s=await page.evaluate(()=>{
    const n=nearest(car.x,car.y);let remaining=55,index=n.index;
    while(remaining>0){const a=track[index],b=track[(index+1)%N];remaining-=Math.hypot(b.x-a.x,b.y-a.y);index=(index+1)%N;}
    const target=track[index],angle=Math.atan2(target.y-car.y,target.x-car.x);
    let error=angle-car.angle;while(error>Math.PI)error-=TAU;while(error< -Math.PI)error+=TAU;
    return{snapshot:gameSnapshot(),angle:car.angle,steer:car.steer,error,distance:Math.hypot(target.x-car.x,target.y-car.y),surfaceDistance:n.distance,presentation:presentationSnapshot()};
   });
   const g=s.snapshot;
   if(g.lap!==lastLap){lastLap=g.lap;laps.push(g.lap);const name=`0${g.lap+1}-lap-${g.lap}.jpg`;await page.screenshot({path:path.join(out,name),type:'jpeg',quality:80});pictures.push(name)}
   if(g.racers.playerContacts>0&&!contactPicture){const name='04-real-contact.jpg';await page.screenshot({path:path.join(out,name),type:'jpeg',quality:80});pictures.push(name);contactPicture=true;}
   if(!samples.length||g.elapsed-samples.at(-1).game.elapsed>=.25)samples.push({wallMs:Date.now()-start,game:g,controller:{error:s.error,surfaceDistance:s.surfaceDistance},presentation:s.presentation});
   if(g.state==='finished')break;
   assert.equal(g.state,'running');assert.equal(g.hazard.fall,0,'driver must stay on the real circuit');
   const desired=Math.max(-1,Math.min(1,2*Math.sin(s.error)*155*(1+Math.abs(g.speed)/650)/Math.max(20,s.distance)));
   const sign=Math.sign(desired);if(sign!==steeringSign){integral=0;steeringSign=sign}
   integral+=Math.abs(desired);const steering=integral>=1;if(steering)integral-=1;
   await key('a',steering&&desired<0);await key('d',steering&&desired>0);
   const target=g.elapsed<4?220:122;
   await key('w',g.speed<target);await key('Space',g.speed>target+18);
   await page.waitForTimeout(32);
  }
  for(const name of [...keys])await key(name,false);
  const final=await page.evaluate(()=>({game:gameSnapshot(),presentation:presentationSnapshot(),best:Number(localStorage.getItem(activeMap.bestKey)),frames:sliceFrameTimes}));
  samples.push({wallMs:samples.at(-1)?.wallMs,game:final.game,presentation:final.presentation});
  assert.equal(final.game.state,'finished','natural three-lap finish required');assert.deepEqual(laps,[1,2,3]);
  assert(final.game.elapsed>=60&&final.game.elapsed<=90,`actual race time ${final.game.elapsed} outside 60–90 seconds`);
  assert(final.game.racers.playerContacts>0,'actual physical AI contact required');assert(final.presentation.events.impact>0,'real collision feedback required');
  assert(final.presentation.events.finish===1,'one observed finish celebration');assert(final.best>0&&final.best<=final.game.elapsed);
  assert(samples.some(s=>s.game.racers.actors.some(a=>a.progress>240)),'competitors must actually race');
  const frozen=await page.evaluate(()=>gameSnapshot());await page.waitForTimeout(250);assert.deepEqual(await page.evaluate(()=>gameSnapshot()),frozen,'finish must freeze gameplay and ranking');
  assert.deepEqual(errors,[]);assert(final.frames.length>500,'native animation must run throughout');
  await page.screenshot({path:path.join(out,'05-natural-finish.jpg'),type:'jpeg',quality:80});pictures.push('05-natural-finish.jpg');
  const sorted=final.frames.filter(t=>t>0).sort((a,b)=>a-b),quantile=p=>sorted[Math.floor((sorted.length-1)*p)];
  result={passed:true,browser:browser.version(),source:url.href,animation:'native requestAnimationFrame; normal keyboard input; read-only route observations; no teleports, finish calls or clock overrides',raceSeconds:final.game.elapsed,wallSeconds:(Date.now()-start)/1000,laps,contacts:final.game.racers.playerContacts,events:final.presentation.events,frames:final.frames.length,frameMs:{p50:quantile(.5),p95:quantile(.95),max:sorted.at(-1)},final:final.game,pictures,errors,physicalPhone:false};
  console.log('PASS',result.raceSeconds.toFixed(2),'seconds, three natural laps, AI contacts',result.contacts,'frames',result.frames);
 }catch(e){failure=e;result={passed:false,error:e.message,samples:samples.length,errors};try{await page.screenshot({path:path.join(out,'failure.jpg'),type:'jpeg',quality:80})}catch{}}
 finally{
  fs.writeFileSync(path.join(out,'samples.json'),JSON.stringify(samples,null,2)+'\n');const video=page.video();await context.close();const source=await video.path(),name='full-race.webm';fs.renameSync(source,path.join(out,name));result.video=name;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');await browser.close();
 }
 if(failure)throw failure;
})().catch(e=>{console.error(e);process.exitCode=1});
