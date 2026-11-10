const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const baseline=process.env.DRIVE_BASELINE_URL;
assert(baseline,'DRIVE_BASELINE_URL must identify the frozen original runtime');
const candidate=process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href;
const out=path.resolve(process.env.DRIVE_PROFILE_DIR||'verification/latest-profile');fs.mkdirSync(out,{recursive:true});
const quantile=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor((s.length-1)*p)]};
(async()=>{
 const browser=await chromium.launch({headless:true}),runs=[],errors=[];
 try{
  for(let repeat=0;repeat<5;repeat++)for(const [side,target] of[['baseline',baseline],['candidate',candidate]]){
   const page=await browser.newPage({viewport:{width:1000,height:600},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
   const url=new URL(target);url.searchParams.set('map','circuit');await page.goto(url.href);await page.click('#start');await page.click('[data-view=chase]');await page.keyboard.down('w');
   await page.evaluate(()=>new Promise(resolve=>{
    const original=draw;window.profileRenderTimes=[];draw=()=>{const start=performance.now();original();profileRenderTimes.push(performance.now()-start)};
    let previous,skip=25,count=0;window.profileFrameTimes=[];
    const observe=t=>{if(previous!==undefined&&skip--<=0){profileFrameTimes.push(t-previous);count++}previous=t;if(count<120)requestAnimationFrame(observe);else{draw=original;resolve()}};requestAnimationFrame(observe);
   }));
   await page.keyboard.up('w');const result=await page.evaluate(()=>({frames:profileFrameTimes,render:profileRenderTimes.slice(25),game:gameSnapshot(),faces:roadMesh.length}));
   assert(result.frames.length===120&&result.render.length>=100&&result.game.elapsed>1);assert.equal(result.game.state,'running');
   runs.push({side,repeat,frameP50:quantile(result.frames,.5),frameP95:quantile(result.frames,.95),drawP50:quantile(result.render,.5),drawP95:quantile(result.render,.95),frames:result.frames.length,faces:result.faces,elapsed:result.game.elapsed,rawFrameMs:result.frames,rawDrawMs:result.render});
   if(repeat===0)await page.screenshot({path:path.join(out,side+'.jpg'),type:'jpeg',quality:75});await page.close();
  }
  assert.deepEqual(errors,[]);
  const groups=Object.fromEntries(['baseline','candidate'].map(side=>{const rows=runs.filter(r=>r.side===side);return[side,Object.fromEntries(['frameP50','frameP95','drawP50','drawP95'].map(field=>[field,{median:quantile(rows.map(r=>r[field]),.5),min:Math.min(...rows.map(r=>r[field])),max:Math.max(...rows.map(r=>r[field]))}]))]}));
  const result={passed:true,browser:browser.version(),baseline,candidate,viewport:{width:1000,height:600},method:'Five alternating baseline/candidate trials. Normal animation, real throttle input. 25 warmup frames then 120 rAF intervals per trial. Draw wall time includes JavaScript and synchronous Canvas calls, excludes asynchronous raster and GPU work. No recording during measurement.',limitations:'Shared Mac host; background load is not controlled. Descriptive desktop headless observations only; no phone, Safari, Firefox or general speedup claim.',groups,runs,errors};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(groups));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
