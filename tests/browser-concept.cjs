const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href;
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','concept');fs.mkdirSync(out,{recursive:true});
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
(async()=>{
 const browser=await chromium.launch(options),checks=[],pictures=[],errors=[];let failure;
 const capture=async(page,name)=>{await page.screenshot({path:path.join(out,name+'.png')});pictures.push(name+'.png')};
 try{
  for(const viewport of[{width:1280,height:720},{width:844,height:390},{width:390,height:844},{width:320,height:740}]){
   const context=await browser.newContext({viewport});await context.addInitScript(()=>{window.requestAnimationFrame=()=>0});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.waitForLoadState('networkidle');await page.click('#start');await page.click('[data-view=chase]');
   await page.evaluate(()=>{selectMap('circuit');start();selectView('chase');draw()});
   const controls=await page.evaluate(()=>[...document.querySelectorAll('header button,.views button,.controls button,.presentation-settings button,.map-menu')].map(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {name:el.id||el.textContent,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,reachable:hit===el||el.contains(hit)}}));
   assert(controls.every(c=>c.inside&&c.reachable),JSON.stringify({viewport,controls}));
   const ranks=await page.locator('#team-rank').innerText();assert(ranks.includes('/ 4'));
   const geometry=await page.evaluate(()=>({car:playerCarMesh().length,city:DriveArt.circuit().length,pose:perspectivePose()}));assert(geometry.car>150);assert(geometry.city>600);assert.equal(geometry.pose.distance,105);
   await capture(page,'circuit-'+viewport.width);checks.push({id:'hud-'+viewport.width,passed:true,controls,geometry});
   if(viewport.width===1280){
    const drift=await page.evaluate(()=>{start();selectView('chase');DrivePresentation.draw();for(let i=0;i<45;i++){car.speed=180;car.steer=.8;car.x-=1;elapsed+=.02;DrivePresentation.draw()}draw();return presentationSnapshot()});
    assert(drift.driftSeconds>.8);assert(drift.trails>0&&drift.trails<=96);assert(drift.particles<=48);assert(await page.locator('#drive-moment').isVisible());await capture(page,'drift');
    const paused=await page.evaluate(()=>{pause();DrivePresentation.draw();const before=presentationSnapshot();for(let i=0;i<10;i++)DrivePresentation.draw();return {before,after:presentationSnapshot()}});assert.deepEqual(paused.before,paused.after);assert(!await page.locator('.stats').isVisible());assert(!await page.locator('.views').isVisible());assert(await page.locator('#reset').isVisible());await capture(page,'paused');
    const cleared=await page.evaluate(()=>{reset();return presentationSnapshot()});assert.equal(cleared.trails,0);assert.equal(cleared.driftSeconds,0);
    const jump=await page.evaluate(()=>{selectMap('offroad');start();selectView('chase');const ramp=activeMap.ramps[0];car.x=ramp.x;car.y=ramp.y;car.angle=ramp.angle;car.speed=160;DrivePresentation.draw();for(let i=0;i<12;i++){update(.02);DrivePresentation.draw()}draw();return {game:gameSnapshot(),effects:presentationSnapshot()}});
    assert(jump.game.course.jump.height>0);assert(jump.effects.airSeconds>.1);assert(await page.locator('#drive-moment').innerText().then(t=>t.includes('AIR')));await capture(page,'air');
    await page.evaluate(()=>{for(let i=0;i<120;i++){update(.02);DrivePresentation.draw()}draw()});const landed=await page.evaluate(()=>presentationSnapshot());assert.equal(landed.airSeconds,0);assert(landed.longestAir>0);
    const gate=await page.evaluate(()=>{selectMap('circuit');start();const p=edgeAt(0,116);car.x=p[0]-9;car.y=p[2];car.angle=0;car.speed=160;resolveCollisions();return gameSnapshot()});assert(gate.speed<0&&gate.hazard.impact>.1,'cyan gate pillars must have physical collisions');
    checks.push({id:'physical-state-feedback',passed:true,drift,jump,landed,gate});
    for(const index of[55,115,175]){await page.evaluate(index=>{selectMap('circuit');start();const p=track[index],q=track[(index+1)%N];car.x=p.x;car.y=p.y;car.angle=Math.atan2(q.y-p.y,q.x-p.x);selectView('chase');draw()},index);await capture(page,'city-pose-'+index)}
    await page.evaluate(()=>{selectMap('circuit');start();selectView('chase');for(let l=0;l<3;l++)for(let i=1;i<=N;i++){const p=track[i%N];car.x=p.x;car.y=p.y;update(.02)}draw()});assert.equal(await page.evaluate(()=>gameSnapshot().state),'finished');assert(!await page.locator('.stats').isVisible());assert(!await page.locator('.speed').isVisible());assert(!await page.locator('.views').isVisible());assert(await page.locator('#start').isVisible());await capture(page,'finish-fixture');
   }
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(e){failure=e;console.error(e)}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:!failure,checks,pictures,errors,error:failure?.message,scope:'Real Chromium rendering. Deterministic entry fixtures cover art, HUD and state feedback; the separate browser-slice test proves a natural keyboard race.'},null,2)+'\n');await browser.close()}
 if(failure)throw failure;
})().catch(e=>{console.error(e);process.exitCode=1});
