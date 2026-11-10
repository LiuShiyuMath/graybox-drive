const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.resolve(__dirname,'..');
const url=process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href;
const output=path.resolve(process.env.DRIVE_EVIDENCE_DIR||path.join(root,'verification/state-machines'));
const captureEnabled=process.env.DRIVE_CAPTURE!=='0';
const views=['first','chase','top'];
const sizes=[{id:'landscape',width:844,height:390},{id:'portrait',width:390,height:844}];
const records=[],checks=[];
fs.mkdirSync(output,{recursive:true});
const launch={headless:true,args:['--no-sandbox','--disable-dev-shm-usage']};
if(process.env.DRIVE_CHROMIUM_PATH)launch.executablePath=process.env.DRIVE_CHROMIUM_PATH;
if(process.env.DRIVE_SINGLE_PROCESS==='1')launch.args.push('--single-process','--no-zygote');

const cases=[
 {id:'ready',group:'race',title:'准备开始',setup:"state='ready';$('#overlay').hidden=false",test:s=>assert.equal(s.state,'ready')},
 {id:'idle',group:'motion',title:'赛道静止',setup:'',test:s=>assert.equal(s.speed,0)},
 {id:'accelerating',group:'motion',title:'踩油门加速',setup:'input.gas=true;advance(1.5)',test:s=>assert(s.speed>200)},
 {id:'coasting',group:'motion',title:'松油门滑行',setup:'car.speed=200;advance(.8)',test:s=>assert(s.speed>0&&s.speed<200)},
 {id:'braking',group:'motion',title:'前进刹车',setup:'car.speed=200;input.brake=true;advance(.3)',test:s=>assert(s.speed>0&&s.speed<100)},
 {id:'reverse',group:'motion',title:'倒车',setup:'input.brake=true;advance(1.2)',test:s=>assert(s.speed< -50)},
 {id:'reverse-to-forward',group:'motion',title:'倒车后踩油门前进',setup:'car.speed=-80;input.gas=true;advance(.7)',test:s=>assert(s.speed>0)},
 {id:'reverse-left',group:'motion',title:'倒车时向左打方向',setup:'car.speed=-80;input.left=true;advance(.3)',test:s=>assert(s.angle>Math.PI)},
 {id:'reverse-right',group:'motion',title:'倒车时向右打方向',setup:'car.speed=-80;input.right=true;advance(.3)',test:s=>assert(s.angle<Math.PI)},
 {id:'left',group:'input',title:'向左转向',setup:'car.speed=150;input.left=true;advance(.3)',test:s=>assert(s.angle<Math.PI)},
 {id:'right',group:'input',title:'向右转向',setup:'car.speed=150;input.right=true;advance(.3)',test:s=>assert(s.angle>Math.PI)},
 {id:'opposed',group:'input',title:'左右同时按住',setup:'car.speed=150;input.left=true;input.right=true;advance(.3)',test:s=>assert.equal(s.angle,Math.PI)},
 {id:'both-pedals',group:'input',title:'油门和刹车同时按住',setup:'input.gas=true;input.brake=true;advance(.5)',test:s=>assert(Math.abs(s.speed)<15)},
 {id:'curb',group:'surface',title:'压路肩',setup:'car.y=907;car.speed=100;advance(.02)',test:s=>assert.equal(s.hazard.kind,'curb')},
 {id:'runoff',group:'surface',title:'驶入缓冲区',setup:'const p=edgePoint(5,130);car.x=p[0];car.y=p[2];car.angle=Math.atan2(track[6].y-track[5].y,track[6].x-track[5].x);car.speed=200;advance(.2)',test:s=>{assert.equal(s.hazard.kind,'runoff');assert(s.speed<155);assert(s.hazard.dust>0);assert.equal(s.hazard.impact,0);assert.equal(s.feedback,'runoff')}},
 {id:'edge',group:'surface',title:'接近落差边缘',setup:'car.y=1005;advance(.02)',test:s=>{assert.equal(s.hazard.kind,'edge');assert.equal(s.hazard.fall,0)}},
 {id:'impact',group:'collision',title:'正向撞击反弹',setup:'car.x=510;car.y=550;car.angle=0;car.speed=200;advance(.02)',test:s=>{assert(s.speed<0);assert(s.hazard.impact>.5);assert(s.x<=505.5)}},
 {id:'reverse-impact',group:'collision',title:'倒车撞击反弹',setup:'car.x=510;car.y=550;car.angle=Math.PI;car.speed=-160;advance(.02)',test:s=>{assert(s.speed>0);assert(s.hazard.impact>.5)}},
 {id:'low-contact',group:'collision',title:'低速接触分离',setup:'car.x=510;car.y=550;car.angle=0;car.speed=10;advance(.02)',test:s=>{assert.equal(s.hazard.impact,0);assert(s.x<=505.5)}},
 {id:'fall-early',group:'recovery',title:'掉落开始',setup:'car.y=1030;car.speed=100;input.gas=true;advance(.2)',test:s=>{assert(s.hazard.fall>0);assert.equal(s.input.gas,false)}},
 {id:'fall-late',group:'recovery',title:'掉落渐暗',setup:'car.y=1030;car.speed=100;advance(1.2)',test:s=>assert(s.hazard.fall>1)},
 {id:'fall-paused',group:'recovery',title:'掉落时暂停',setup:'car.y=1030;advance(.3);pause();advance(1)',test:s=>{assert.equal(s.state,'paused');assert(s.hazard.fall>0&&s.hazard.fall<.4)}},
 {id:'auto-recovery',group:'recovery',title:'自动回赛道加5秒',setup:'car.y=1030;car.speed=100;advance(1.8)',test:s=>{assert.equal(s.hazard.fall,0);assert.equal(s.speed,0);assert(Math.abs(s.elapsed-6.8)<.001);assert.equal(s.hazard.kind,'road')}},
 {id:'manual-recovery',group:'recovery',title:'手动回赛道加3秒',setup:'car.y=950;elapsed=10;recover()',test:s=>{assert.equal(s.elapsed,13);assert.equal(s.speed,0);assert.equal(s.hazard.kind,'road')}},
 {id:'fall-manual',group:'recovery',title:'掉落中手动恢复',setup:'car.y=1030;advance(.3);recover();advance(2)',test:s=>{assert.equal(s.hazard.fall,0);assert(Math.abs(s.elapsed-5.3)<.001)}},
 {id:'paused',group:'race',title:'暂停并冻结计时',setup:'car.speed=100;advance(.5);pause();advance(1)',test:s=>{assert.equal(s.state,'paused');assert(Math.abs(s.elapsed-.5)<.001)}},
 {id:'resumed',group:'race',title:'暂停后继续',setup:'advance(.5);pause();start();advance(.2)',test:s=>{assert.equal(s.state,'running');assert(Math.abs(s.elapsed-.7)<.001)}},
 {id:'lap-two',group:'race',title:'进入第2圈',setup:'progress=N-1;lastIndex=N-1;car.x=track[0].x;car.y=track[0].y;advance(.02)',test:s=>assert.equal(s.lap,2)},
 {id:'lap-three',group:'race',title:'进入第3圈',setup:'lap=2;progress=2*N-1;lastIndex=N-1;car.x=track[0].x;car.y=track[0].y;advance(.02)',test:s=>assert.equal(s.lap,3)},
 {id:'reverse-lap',group:'race',title:'反向行驶不计圈',setup:'for(let k=N-1;k>=0;k--){car.x=track[k].x;car.y=track[k].y;update(1/60)}',test:s=>{assert.equal(s.lap,1);assert(s.progress<0)}},
 {id:'finished',group:'race',title:'第3圈结束',setup:'elapsed=80;lap=3;progress=3*N-1;lastIndex=N-1;car.x=track[0].x;car.y=track[0].y;advance(.02)',test:s=>{assert.equal(s.state,'finished');assert.equal(s.lap,3)}},
 {id:'restart',group:'race',title:'重开并清空本局',setup:'car.y=1030;advance(.3);reset();state="running"',test:s=>{assert.equal(s.elapsed,0);assert.equal(s.lap,1);assert.equal(s.progress,0);assert.equal(s.hazard.fall,0);assert.equal(s.speed,0)}}
];

async function snapshot(page){return page.evaluate(()=>({...window.gameSnapshot(),angle:car.angle,steer:car.steer,feedback:document.querySelector('#feedback').dataset.kind,feedbackHidden:document.querySelector('#feedback').hidden,overlay:!document.querySelector('#overlay').hidden}))}
async function picture(page,name){if(!captureEnabled)return null;const file=name+'.jpg';await page.screenshot({path:path.join(output,file),type:'jpeg',quality:82});return file}
async function check(id,fn){try{await fn();checks.push({id,passed:true});console.log('PASS',id)}catch(e){checks.push({id,passed:false,error:e.message});console.error('FAIL',id,e.message)}}
async function fixture(page,view,setup){
 await page.evaluate(`(()=>{reset();state='running';$('#overlay').hidden=true;selectView(${JSON.stringify(view)});const advance=t=>{while(t>1e-9){let dt=Math.min(t,.02);update(dt);t-=dt}};${setup};camera={x:car.x,y:car.y};if(state!=='ready')updateFeedback();draw()})()`);
 return snapshot(page);
}
async function scene(page,view,size,scenario){
 let s,error;
 try{s=await fixture(page,view,scenario.setup);scenario.test(s)}catch(e){error=e.message}
 records.push({id:scenario.id,title:scenario.title,group:scenario.group,view,viewport:size.id,passed:!error,error,snapshot:s,screenshot:await picture(page,`${size.id}-${view}-${scenario.id}`)});
}

(async()=>{
const browser=await chromium.launch(launch);
try{
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const page=await context.newPage();
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0});
 for(const size of sizes)for(const view of views){
  await page.setViewportSize({width:size.width,height:size.height});
  if(page.url()!=='about:blank')await page.evaluate(()=>localStorage.clear());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  for(const scenario of cases)await scene(page,view,size,scenario);
  await check(`${size.id}/${view}/no-browser-errors`,async()=>assert.deepEqual(errors,[]));
  console.log('CAPTURED',size.id,view,cases.length);
 }
 await page.setViewportSize({width:844,height:390});await page.goto(url);
 await check('UI start button enters running',async()=>{assert.equal((await snapshot(page)).state,'ready');await page.locator('#start').click();assert.equal((await snapshot(page)).state,'running')});
 await check('keyboard aliases retain gas until final release',async()=>{
  await fixture(page,'first','');await page.keyboard.down('w');await page.keyboard.down('ArrowUp');await page.keyboard.up('w');
  assert.equal((await snapshot(page)).input.gas,true);await page.evaluate(()=>{update(.02);draw()});
  records.push({id:'keyboard-alias',title:'松开W，方向键上仍提供油门',group:'input',view:'first',viewport:'landscape',passed:true,snapshot:await snapshot(page),screenshot:await picture(page,'input-keyboard-alias')});
  await page.keyboard.up('ArrowUp');assert.equal((await snapshot(page)).input.gas,false);
 });
 await check('keyboard and pointer sources remain independent',async()=>{
  await fixture(page,'chase','');await page.keyboard.down('w');await page.locator('[data-key=gas]').click();assert.equal((await snapshot(page)).input.gas,true);assert.equal(await page.locator('[data-key=gas]').evaluate(e=>e.classList.contains('pressed')),true);await page.keyboard.up('w');assert.equal((await snapshot(page)).input.gas,false);
 });
 const cdp=await context.newCDPSession(page);
 const point=async(key,id)=>{const b=await page.locator(`[data-key=${key}]`).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2,id}};
 await check('two touches on same pedal retain the remaining touch',async()=>{
  await fixture(page,'first','');const p1=await point('gas',1),p2={...p1,x:p1.x+8,id:2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});assert.equal((await snapshot(page)).input.gas,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p2]});assert.equal((await snapshot(page)).input.gas,true);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal((await snapshot(page)).input.gas,false);
 });
 await check('simultaneous steering and throttle, then touch cancellation',async()=>{
  await fixture(page,'chase','');const left=await point('left',3),gas=await point('gas',4);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,gas]});let s=await snapshot(page);assert(s.input.left&&s.input.gas);
  await page.evaluate(()=>{for(let i=0;i<20;i++)update(.02);draw()});
  records.push({id:'multi-touch',title:'双指同时转向和加速',group:'input',view:'chase',viewport:'landscape',passed:true,snapshot:await snapshot(page),screenshot:await picture(page,'input-multitouch')});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});s=await snapshot(page);assert(Object.values(s.input).every(v=>!v));
 });
 await check('all 16 keyboard action combinations release cleanly',async()=>{
  const actions=['left','right','gas','brake'],keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  for(let mask=0;mask<16;mask++){
   await fixture(page,'top','');for(let bit=0;bit<4;bit++)if(mask&(1<<bit))await page.keyboard.down(keys[bit]);
   const s=await snapshot(page);for(let bit=0;bit<4;bit++)assert.equal(s.input[actions[bit]],!!(mask&(1<<bit)));
   await page.evaluate(()=>{update(.02);draw()});
   records.push({id:`input-mask-${mask}`,title:actions.filter((a,i)=>mask&(1<<i)).join(' + ')||'无驾驶输入',group:'input',view:'top',viewport:'landscape',passed:true,snapshot:await snapshot(page),screenshot:await picture(page,`input-mask-${mask}`)});
   for(let bit=0;bit<4;bit++)if(mask&(1<<bit))await page.keyboard.up(keys[bit]);assert(Object.values((await snapshot(page)).input).every(v=>!v));
  }
 });
 await check('pause blocks fresh and repeated driving input',async()=>{
  await fixture(page,'first','');await page.keyboard.down('w');await page.locator('#pause').click();assert(Object.values((await snapshot(page)).input).every(v=>!v));await page.keyboard.down('w');await page.keyboard.down('ArrowUp');assert.equal((await snapshot(page)).input.gas,false);await page.locator('#start').click();assert.equal((await snapshot(page)).input.gas,false);await page.keyboard.up('w');await page.keyboard.up('ArrowUp');
 });
 await check('opposing steering cancels, releasing one retains the other',async()=>{
  await fixture(page,'top','car.speed=100');await page.keyboard.down('ArrowLeft');await page.keyboard.down('ArrowRight');await page.evaluate(()=>update(.02));assert.equal((await snapshot(page)).steer,0);await page.keyboard.up('ArrowLeft');assert.equal((await snapshot(page)).input.right,true);await page.keyboard.up('ArrowRight');
 });
 await check('blur and hidden document pause and clear controls',async()=>{
  await fixture(page,'first','');await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await snapshot(page)).state,'paused');assert.equal((await snapshot(page)).input.gas,false);await page.keyboard.up('w');
  await fixture(page,'first','');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});assert.equal((await snapshot(page)).state,'paused');await page.evaluate(()=>delete document.hidden);
 });
 await check('camera buttons preserve active race, pose and hazard',async()=>{
  await fixture(page,'first','car.y=950;car.speed=100;update(.02)');const before=await snapshot(page);
  for(const mode of views){await page.locator(`[data-view=${mode}]`).click();const after=await snapshot(page);assert.equal(after.view,mode);for(const k of ['x','y','speed','elapsed','progress','lap'])assert.equal(after[k],before[k]);assert.deepEqual(after.hazard,before.hazard)}
 });
 await check('V cycles cameras and repeated V does not double-toggle',async()=>{
  await fixture(page,'first','');await page.keyboard.down('v');assert.equal((await snapshot(page)).view,'chase');await page.keyboard.down('v');assert.equal((await snapshot(page)).view,'chase');await page.keyboard.up('v');await page.keyboard.press('v');assert.equal((await snapshot(page)).view,'top');
 });
 await check('hazard priority and safe-road return clear feedback',async()=>{
  await fixture(page,'first','hazard.kind="edge";hazard.impact=.8;updateFeedback()');assert.equal((await snapshot(page)).feedback,'impact');await page.evaluate(()=>{hazard.fall=.2;updateFeedback()});assert.equal((await snapshot(page)).feedback,'fall');await fixture(page,'first','car.y=950;update(.02);car.y=810;car.x=750;update(.02)');assert.equal((await snapshot(page)).feedbackHidden,true);
 });
 await check('impact ends and cooldown prevents a duplicate impulse',async()=>{
  await fixture(page,'first','car.x=510;car.y=550;car.angle=0;car.speed=200;update(.01)');const before=await snapshot(page);await page.evaluate(()=>update(.01));assert((await snapshot(page)).speed<0);await page.evaluate(()=>{car.x=750;car.y=810;car.speed=0;for(let i=0;i<200;i++)update(.02);updateFeedback()});assert.equal((await snapshot(page)).hazard.impact,0);assert.equal((await snapshot(page)).feedbackHidden,true);assert(before.hazard.cooldown>0);
 });
 await check('manual recovery button and R add only one penalty each',async()=>{
  await fixture(page,'first','elapsed=10;car.y=950');await page.locator('#recover').click();assert.equal((await snapshot(page)).elapsed,13);await page.keyboard.down('r');assert.equal((await snapshot(page)).elapsed,16);await page.keyboard.down('r');assert.equal((await snapshot(page)).elapsed,16);await page.keyboard.up('r');
 });
 await check('restart button clears all race and hazard state',async()=>{
  await fixture(page,'chase','car.y=1030;update(.02)');await page.locator('#reset').click();const s=await snapshot(page);assert.equal(s.state,'running');assert.equal(s.elapsed,0);assert.equal(s.hazard.fall,0);assert.equal(s.speed,0);assert.equal(s.lap,1);
 });
 await check('recovery and restart synchronize visible feedback in the same event',async()=>{
  await fixture(page,'first','car.speed=150;elapsed=9;hazard.kind="runoff";hazard.impact=.8');await page.locator('#recover').click();assert.equal(await page.locator('#time').textContent(),'00:12.00');assert.equal(await page.locator('#speed').textContent(),'0');assert.equal((await snapshot(page)).feedbackHidden,true);
  await fixture(page,'chase','car.y=1030;update(.02)');await page.locator('#reset').click();assert.equal((await snapshot(page)).feedbackHidden,true);assert.equal(await page.locator('#speed').textContent(),'0');assert.equal(await page.locator('#time').textContent(),'00:00.00');
 });
 await check('paused and finished races restart; falling input stays neutral',async()=>{
  for(const target of ['paused','finished']){await fixture(page,'top',target==='paused'?'pause()':'finish()');await page.locator('#reset').click();const s=await snapshot(page);assert.equal(s.state,'running');assert.equal(s.elapsed,0);assert.equal(s.lap,1);assert.equal(s.overlay,false)}
  await fixture(page,'chase','car.y=1030;update(.02)');await page.keyboard.down('w');assert.equal((await snapshot(page)).input.gas,false);await page.keyboard.up('w');await page.locator('[data-key=gas]').click();assert.equal((await snapshot(page)).input.gas,false);
 });
 await check('three forward laps finish and freeze further updates',async()=>{
  await fixture(page,'chase','for(let j=0;j<3;j++)for(let k=1;k<=N;k++){const p=track[k%N];car.x=p.x;car.y=p.y;update(1/60)}');const s=await snapshot(page);assert.equal(s.state,'finished');assert.equal(s.lap,3);await page.evaluate(()=>update(2));assert.equal((await snapshot(page)).elapsed,s.elapsed);assert.equal(s.overlay,true);await page.keyboard.down('w');assert.equal((await snapshot(page)).input.gas,false);await page.keyboard.up('w');
 });
 await check('best score and camera survive reload; replay clears current race',async()=>{
  await page.locator('#start').click();assert.equal((await snapshot(page)).elapsed,0);await page.locator('[data-view=chase]').click();const best=await page.locator('#best').textContent();assert.notEqual(best,'—');await page.reload();assert.equal((await snapshot(page)).view,'chase');assert.equal(await page.locator('#best').textContent(),best);assert.equal((await snapshot(page)).state,'ready');
 });
 await check('chase car stays visible above road paint at all 240 headings',async()=>{
  const result=await page.evaluate(()=>{
   window.vehicleVisibility=()=>{
    const mesh=playerCarMesh;drawPerspective();const actual=ctx.getImageData(0,0,w,h).data;
    try{playerCarMesh=()=>[];drawPerspective();const blank=ctx.getImageData(0,0,w,h).data;let pixels=0,minX=w,minY=h,maxX=0,maxY=0;
     for(let i=0;i<actual.length;i+=4)if(Math.abs(actual[i]-blank[i])+Math.abs(actual[i+1]-blank[i+1])+Math.abs(actual[i+2]-blank[i+2])>20){const x=(i/4)%w,y=Math.floor(i/4/w);pixels++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
     return {pixels,width:maxX-minX+1,height:maxY-minY+1,minY,maxY};
    }finally{playerCarMesh=mesh;drawPerspective()}
   };
   reset();state='running';selectView('chase');const failures=[];
   for(let i=0;i<N;i++){const p=track[i],q=track[(i+1)%N];car.x=p.x;car.y=p.y;car.angle=Math.atan2(q.y-p.y,q.x-p.x);const region=vehicleVisibility();if(region.pixels<=100||region.width<=15||region.height<=10)failures.push({i,region})}return failures;
  });assert.deepEqual(result,[]);
 });
 await check('falling chase camera keeps the complete car region in frame',async()=>{
  const regions=await page.evaluate(()=>{reset();state='running';selectView('chase');car.y=1030;return[.2,.7,1.2].map(t=>{hazard.fall=t;return vehicleVisibility()})});
  for(const region of regions){assert(region.pixels>100&&region.width>15&&region.height>10);assert(region.minY>0&&region.maxY<await page.locator('#game').evaluate(e=>e.height)-1)}
 });
 await check('surface thresholds and returns use the intended boundaries',async()=>{
  const result=await page.evaluate(()=>{reset();state='running';return[86,88,105,107,159,161,209,211].map(distance=>{const p=edgePoint(5,distance);car.x=p[0];car.y=p[2];car.speed=0;hazard.fall=0;update(.001);return hazard.fall?'fall':hazard.kind})});assert.deepEqual(result,['road','curb','curb','runoff','runoff','edge','edge','fall']);
 });
 await check('solid buildings occlude the car and a no-building control reveals it',async()=>{
  const result=await page.evaluate(()=>{
   reset();state='running';selectView('chase');car.x=650;car.y=550;car.angle=0;
   const hidden=vehicleVisibility(),saved=roadMesh.slice();
   try{roadMesh.splice(0,roadMesh.length,...saved.filter(face=>face.ground));roadMeshVersion++;return {hidden,exposed:vehicleVisibility()}}
   finally{roadMesh.splice(0,roadMesh.length,...saved);roadMeshVersion++;drawPerspective()}
  });assert(result.hidden.pixels<=100,JSON.stringify(result));assert(result.exposed.pixels>100,JSON.stringify(result));
 });
 await check('invalid saved camera falls back and slower finishes keep best time',async()=>{
  await page.evaluate(()=>{localStorage.setItem('graybox-drive-view','invalid');localStorage.setItem('graybox-drive-best','30')});await page.reload();assert.equal((await snapshot(page)).view,'first');await fixture(page,'first','elapsed=50;finish()');assert.equal(await page.locator('#best').textContent(),'00:30.00');await fixture(page,'first','elapsed=20;finish()');assert.equal(await page.locator('#best').textContent(),'00:20.00');
 });
}finally{await browser.close()}
const result={createdAt:new Date().toISOString(),source:url.startsWith('file:')?'dist/index.html':url,fixtures:'Scenario entry positions, race progress and clock are set in the test. Transitions execute real update(), rendering uses real Chromium canvas. UI checks use Playwright keyboard, pointer and CDP touch input. No physical phone is used.',viewports:sizes,cases:records,checks};
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2));
const failures=records.filter(r=>!r.passed).concat(checks.filter(r=>!r.passed));console.log(`RESULT ${records.length} screenshot scenarios, ${checks.length} transition checks, ${failures.length} failures`);for(const failure of failures)console.error(failure.id,failure.error);if(failures.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
