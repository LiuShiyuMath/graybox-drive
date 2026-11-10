const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=new URL(process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href);
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','presentation');fs.mkdirSync(out,{recursive:true});
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
(async()=>{
 const browser=await chromium.launch(options),checks=[],pictures=[],errors=[];let failure;
 const check=(id,details)=>{checks.push({id,passed:true,...details});console.log('PASS',id)};
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1});
  await context.addInitScript(()=>{window.requestAnimationFrame=()=>0});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base.href);
  const histories=[];
  for(const quality of['full','low']){
   if(await page.evaluate(()=>presentationSnapshot().quality)!==quality)await page.click('#effects-toggle',{force:true});
   histories.push(await page.evaluate(()=>{
    const history=[];
    for(const map of['circuit','mountain','proving','city','offroad']){
     selectMap(map);start();draw();
     for(let i=0;i<500;i++){
      setInputSource('equivalence-gas','gas',i%60<40);setInputSource('equivalence-right','right',i%90<10);setInputSource('equivalence-brake','brake',i%80>65);
      update(.02);DrivePresentation.draw();
      if(i%25===0)history.push(gameSnapshot());
     }
    }
    return history;
   }));
  }
  assert.deepEqual(histories[0],histories[1]);check('full and low effects preserve 100 exact gameplay snapshots across five maps',{snapshots:histories[0].length});
  await page.click('#effects-toggle',{force:true});
  const eventFixture=await page.evaluate(()=>{
   selectMap('proving');start();DrivePresentation.draw();const idle=presentationSnapshot();
   hazard.impact=.9;DrivePresentation.draw();const impact=presentationSnapshot();
   hazard.impact=0;courseState.jump.height=5;DrivePresentation.draw();courseState.jump.height=0;DrivePresentation.draw();const landing=presentationSnapshot();
   for(let i=0;i<100;i++){hazard.impact=0;DrivePresentation.draw();hazard.impact=.9;DrivePresentation.draw()}
   const bounded=presentationSnapshot();reset();const resetState=presentationSnapshot();return{idle,impact,landing,bounded,resetState};
  });
  assert.equal(eventFixture.idle.particles,0);assert.equal(eventFixture.idle.events.impact,0);assert.equal(eventFixture.impact.events.impact,1);assert(eventFixture.impact.particles>0);assert.equal(eventFixture.landing.events.landing,1);assert(eventFixture.bounded.particles<=48);assert.equal(eventFixture.resetState.particles,0);assert.equal(eventFixture.resetState.events.impact,0);
  check('fixture events reflect impact and landing, particles are bounded, reset clears effects',{fixture:eventFixture});
  for(const size of[{width:844,height:390},{width:390,height:844},{width:320,height:740}]){
   await page.setViewportSize(size);await page.evaluate(()=>{selectMap('circuit');start();selectView('chase');draw()});
   const hit=await page.evaluate(()=>['effects-toggle','sound-toggle','recover'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect();return{id,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.id}}));
   for(const row of hit){assert(row.inside);assert.equal(row.hit,row.id)}
   const name=`circuit-${size.width}.jpg`;await page.screenshot({path:path.join(out,name),type:'jpeg',quality:80});pictures.push(name);check('settings and recover stay reachable at '+size.width,{hit});
  }
  const before=await page.evaluate(()=>gameSnapshot());await page.click('#effects-toggle');assert.deepEqual(await page.evaluate(()=>gameSnapshot()),before);check('effects toggle does not advance or reset gameplay');
  const chosen=await page.evaluate(()=>presentationSnapshot().quality);await page.reload();assert.equal(await page.evaluate(()=>presentationSnapshot().quality),chosen);check('effects preference persists after reload');
  await context.close();
  const audioContext=await browser.newContext({viewport:{width:844,height:390}}),audioPage=await audioContext.newPage();audioPage.on('pageerror',e=>errors.push(e.message));await audioPage.goto(base.href);await audioPage.click('#start');await audioPage.click('#sound-toggle');await audioPage.keyboard.down('w');await audioPage.waitForTimeout(800);await audioPage.keyboard.up('w');
  const audible=await audioPage.evaluate(()=>presentationSnapshot());assert(audible.sound);assert.equal(audible.audio.state,'running');assert(audible.audio.gain>.01);assert(audible.audio.frequency>55);assert(audible.audio.rms>.0001,'actual analyser must contain audible engine waveform');check('user gesture starts real Web Audio and speed changes engine frequency',{audio:audible.audio});
  await audioPage.click('#pause');await audioPage.waitForTimeout(350);const silent=await audioPage.evaluate(()=>presentationSnapshot());assert(silent.audio.gain<.00001);assert(silent.audio.rms<.00001);check('pause mutes engine',{gain:silent.audio.gain});
  await audioPage.click('#start');await audioPage.click('#sound-toggle');await audioPage.waitForTimeout(350);const off=await audioPage.evaluate(()=>presentationSnapshot());assert(!off.sound);assert(off.audio.gain<.00001);assert(off.audio.rms<.00001);check('sound toggle mutes audio',{gain:off.audio.gain});await audioContext.close();
  const reduced=await browser.newContext({reducedMotion:'reduce'}),rp=await reduced.newPage();await rp.goto(base.href);await rp.click('#start');const reducedState=await rp.evaluate(()=>{DrivePresentation.draw();hazard.impact=.9;DrivePresentation.draw();return presentationSnapshot()});assert(reducedState.reducedMotion);assert.equal(reducedState.events.impact,1);assert.equal(reducedState.particles,0);check('reduced motion suppresses particles for an observed impact');await reduced.close();
  assert.deepEqual(errors,[]);
 }catch(e){failure=e;console.error(e)}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:!failure,checks,pictures,errors,error:failure?.message},null,2)+'\n');await browser.close()}
 if(failure)throw failure;
})().catch(e=>{console.error(e);process.exitCode=1});
