const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const http=require('node:http');
const root=path.resolve(__dirname,'..'),base=process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href;
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','courses');
fs.mkdirSync(out,{recursive:true});
const checks=[],screenshots=[],errors=[];
const ids=['circuit','mountain','proving','city','offroad'];
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
const url=id=>{const u=new URL(base);u.searchParams.set('map',id);return u.href;};
const snap=p=>p.evaluate(()=>gameSnapshot());
async function capture(page,name){await page.screenshot({path:path.join(out,name+'.png')});screenshots.push(name+'.png');}
async function check(name,fn){await fn();checks.push(name);console.log('PASS',name);}
function trackErrors(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error'&&!e.text().includes('favicon'))errors.push(e.text());});}

(async()=>{
 const browser=await chromium.launch(options);
 try{
  for(const id of['proving','city','offroad']){
   await check(`${id}: delayed perspective script cannot freeze startup`,async()=>{
    let releaseScript;
    const gate=new Promise(resolve=>{releaseScript=resolve;});
    const server=http.createServer(async(request,response)=>{
     const name=new URL(request.url,'http://localhost').pathname.slice(1)||'index.html';
     if(!fs.readdirSync(path.join(root,'dist')).includes(name)){response.writeHead(404);response.end();return;}
     if(name==='perspective.js')await gate;
     response.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');
     response.end(fs.readFileSync(path.join(root,'dist',name)));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const context=await browser.newContext({viewport:{width:844,height:390}}),page=await context.newPage(),startupErrors=[];
    page.on('pageerror',error=>startupErrors.push(error.message));
    try{
     await page.goto(`http://127.0.0.1:${server.address().port}/?map=${id}`,{waitUntil:'commit'});
     await page.waitForFunction(id=>typeof gameSnapshot==='function'&&gameSnapshot().map===id,id,{timeout:10000});
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     assert.equal(await page.evaluate(()=>typeof selectView),'undefined');
     releaseScript();await page.waitForLoadState('load');
     assert.deepEqual(startupErrors,[]);
     await page.locator('#start').click();await page.keyboard.down('w');
     await page.waitForFunction(()=>gameSnapshot().speed>70,null,{timeout:10000});
     await page.keyboard.up('w');assert((await snap(page)).elapsed>0);
    }finally{releaseScript();await context.close();await new Promise(resolve=>server.close(resolve));}
   });
  }
  for(const size of[{width:844,height:390},{width:390,height:844},{width:320,height:740}]){
   const context=await browser.newContext({viewport:size,hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage();trackErrors(page);
   for(const id of ids){
    await page.goto(url(id));
    await check(`${size.width}/${id}: picker starts selected map and real throttle accelerates`,async()=>{
     assert.equal((await snap(page)).map,id);
     await page.locator('#start').click();
     await page.keyboard.down('w');
     try{await page.waitForFunction(()=>gameSnapshot().speed>70,null,{timeout:10000});}
     catch(error){
      const diagnostic=await page.evaluate(()=>({snapshot:gameSnapshot(),focused:document.hasFocus(),visibility:document.visibilityState,overlay:!document.querySelector('#overlay').hidden,ready:document.readyState,userAgent:navigator.userAgent}));
      fs.writeFileSync(path.join(out,`${size.width}-${id}-acceleration-failure.json`),JSON.stringify({diagnostic,errors},null,2));
      await capture(page,`${size.width}-${id}-acceleration-failure`);console.error('ACCELERATION FAILURE',JSON.stringify(diagnostic));throw error;
     }finally{await page.keyboard.up('w');}
     assert((await snap(page)).elapsed>0);
    });
    await page.locator('#reset').click();
    for(const view of['first','chase','top']){
     await page.locator(`[data-view=${view}]`).click();
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     assert.equal((await snap(page)).view,view);
     assert(!/undefined|NaN/.test(await page.locator('#route-hud').innerText()));
     await capture(page,`${size.width}-${id}-${view}`);
    }
    await check(`${size.width}/${id}: pedals, steering and map menu remain reachable`,async()=>{
     for(const selector of['[data-key=left]','[data-key=right]','[data-key=gas]','[data-key=brake]','#recover','#map-menu']){
      const element=page.locator(selector),b=await element.boundingBox();
      assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+.5&&b.y+b.height<=size.height+.5,selector);
      assert(await element.evaluate(el=>{const b=el.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return el===hit||el.contains(hit);}),`${selector} is not covered`);
     }
    });
    await check(`${size.width}/${id}: multitouch release, pause, map switch and persistence`,async()=>{
     const cdp=await context.newCDPSession(page),point=async key=>{const b=await page.locator(`[data-key=${key}]`).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};};
     const gas={...await point('gas'),id:1},left={...await point('left'),id:2};
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[gas,left]});
     assert((await snap(page)).input.gas&&(await snap(page)).input.left);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[left]});assert((await snap(page)).input.gas&&!(await snap(page)).input.left);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert(!(await snap(page)).input.gas);
     await page.locator('#map-menu').click();const paused=await snap(page);assert.equal(paused.state,'paused');
     await page.waitForTimeout(120);assert.deepEqual(await snap(page),paused);
     await page.locator(`[data-map=${id}]`).click();assert.equal((await snap(page)).state,'ready');assert.equal((await snap(page)).elapsed,0);
     await page.goto(base);assert.equal((await snap(page)).map,id);
     await cdp.detach();
    });
   }
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:844,height:390}}),page=await context.newPage();trackErrors(page);
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.goto(url('city'));
  await check('city: real Canvas shows red, green, AI vehicles and collision feedback',async()=>{
   const signalPixels={};
   for(const [time,color] of[[0,'green'],[8,'red']]){
    await page.evaluate(time=>{selectMap('city');start();elapsed=time;const i=Math.max(0,activeMap.intersections[0].stopIndex-18);car.x=track[i].x;car.y=track[i].y;car.angle=Math.atan2(track[i+1].y-track[i].y,track[i+1].x-track[i].x);selectView('first');draw();},time);
    assert.equal(await page.evaluate(()=>courseSignal(activeMap.intersections[0])),color);
    signalPixels[color]=await page.evaluate(()=>{const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let red=0,green=0;for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2];if(r>g*1.3&&r>b*1.4)red++;if(g>r*1.15&&g>b*1.15)green++;}return{red,green};});await capture(page,`city-${color}`);
   }
   assert(signalPixels.red.red>signalPixels.green.red+10,JSON.stringify(signalPixels));
   assert(signalPixels.green.green>signalPixels.red.green+10,JSON.stringify(signalPixels));
   await page.evaluate(()=>{start();const vehicle=courseState.traffic[0],p=sampleTraffic(vehicle.route,vehicle.distance);car.x=p.x-vehicle.route.w/2-16;car.y=p.y;car.angle=0;car.speed=150;update(.02);draw();});assert((await snap(page)).speed<0);assert((await snap(page)).hazard.impact>.5);assert.equal(await page.locator('#feedback').getAttribute('data-kind'),'impact');await capture(page,'city-impact');
  });
  await check('offroad: actual jump state, collection and three viewpoints',async()=>{
   await page.evaluate(()=>{selectMap('offroad');start();const r=activeMap.ramps[0];car.x=r.x;car.y=r.y;car.angle=r.angle;car.speed=160;update(.01);for(let i=0;i<12;i++)update(.02);});
   assert((await snap(page)).course.jump.height>0);
   for(const view of['first','chase','top']){await page.evaluate(view=>{selectView(view);draw();},view);await capture(page,`offroad-jump-${view}`);}
   await page.evaluate(()=>{for(let i=0;i<90;i++)update(.02);draw();});assert.equal((await snap(page)).course.jump.height,0);assert.equal((await snap(page)).course.jump.velocity,0);await capture(page,'offroad-landed');
   await page.evaluate(()=>{recover();const p=activeMap.collectibles[0];car.x=p.x;car.y=p.y;update(.02);draw();});assert.equal((await snap(page)).course.collected,1);await capture(page,'offroad-collected');
  });
  for(const id of['proving','city','offroad']){
   await check(`${id}: ordered checkpoints finish three laps in the real page`,async()=>{
    await page.evaluate(id=>{selectMap(id);start();for(let lapIndex=0;lapIndex<3;lapIndex++)for(let i=1;i<=N;i++){const p=track[i%N];car.x=p.x;car.y=p.y;car.speed=0;update(.02)}draw();},id);
    assert.equal((await snap(page)).state,'finished');assert.equal((await snap(page)).lap,3);assert(await page.locator('#overlay').isVisible());assert.notEqual(await page.locator('#best').innerText(),'—');await capture(page,`${id}-finished`);
   });
  }
  await context.close();
  const fallback=await browser.newContext({viewport:{width:844,height:390}});
  await fallback.addInitScript(()=>{window.requestAnimationFrame=()=>0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
  const fallbackPage=await fallback.newPage();trackErrors(fallbackPage);
  for(const id of['proving','city','offroad'])for(const index of[40,60]){
   await fallbackPage.goto(url(id));
   for(const view of['first','chase','top']){
    await fallbackPage.evaluate(({index,view})=>{start();const p=track[index],q=track[index+1];car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(q.y-p.y,q.x-p.x);selectView(view);camera={x:car.x,y:car.y};draw();},{index,view});
    assert.equal((await snap(fallbackPage)).map,id);await capture(fallbackPage,`fallback-${id}-${index}-${view}`);
   }
  }
  await check('Canvas 2D and top view show the physical city stop lines',async()=>{
   await fallbackPage.goto(url('city'));
   for(const view of['first','top']){
    const pixels=await fallbackPage.evaluate(view=>{
     start();const i=activeMap.intersections[0].stopIndex-7,p=track[i],q=track[i+1];car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(q.y-p.y,q.x-p.x);camera={x:car.x,y:car.y};selectView(view);draw();
     const before=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     const mesh=roadMesh.slice(),signals=activeMap.intersections;
     if(view==='top')activeMap.intersections=[];
     else{const keep=roadMesh.filter(face=>face.marking!=='stop-line');roadMesh.splice(0,roadMesh.length,...keep);}
     draw();const after=ctx.getImageData(0,0,canvas.width,canvas.height).data;
     activeMap.intersections=signals;roadMesh.splice(0,roadMesh.length,...mesh);draw();
     let visible=0;for(let i=0;i<before.length;i+=4)if(before[i]>185&&before[i+1]>185&&before[i+2]>155&&Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>30)visible++;
     return visible;
    },view);
    assert(pixels>20,`Stop line invisible in ${view}: ${pixels}`);await capture(fallbackPage,`fallback-city-stop-${view}`);
   }
  });
  await check('software depth resolves overlapping triangles independently of draw order',async()=>{
   const rows=await fallbackPage.evaluate(()=>{
    const make=(depths,color)=>({pts:[[-.2*depths[0],-.2*depths[0],depths[0]],[.2*depths[1],-.2*depths[1],depths[1]],[0,.2*depths[2],depths[2]]],color});
    const red=make([60,180,120],'#ff0000'),blue=make([180,60,120],'#0000ff'),focal=Math.min(w*.82,h*1.35);
    return [[red,blue],[blue,red]].map(faces=>{ctx.clearRect(0,0,w,h);drawSoftwareDepth(faces,focal,h*.42);return [-1,1].map(side=>Array.from(ctx.getImageData(Math.round(w/2+side*focal*.06),Math.round(h*.42+focal*.04),2,2).data));});
   });
   for(const row of rows)for(let side=0;side<2;side++)for(let i=0;i<row[side].length;i+=4){const rgba=row[side].slice(i,i+4);assert(side===0?rgba[0]>245&&rgba[2]<10:rgba[2]>245&&rgba[0]<10,JSON.stringify({side,rgba}));}
  });
  checks.push('Canvas 2D fallback renders all new courses, cameras and climbing bends');
  await fallback.close();
  assert.deepEqual(errors,[]);
  const result={passed:true,browser:browser.version(),target:base,checks,screenshots,consoleErrors:errors,physicalPhone:false};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2)+'\n');
  console.log(`PASS: ${checks.length} cross-map browser checks, ${screenshots.length} screenshots`);
 }finally{await browser.close();}
})().catch(error=>{fs.writeFileSync(path.join(out,'failure.txt'),error.stack);console.error(error);process.exitCode=1;});
