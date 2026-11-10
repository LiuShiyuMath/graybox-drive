const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),base=new URL(process.env.DRIVE_URL||pathToFileURL(path.join(root,'dist/index.html')).href);
base.searchParams.set('map','circuit');
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','effects');
fs.mkdirSync(out,{recursive:true});
const sizes=[{width:844,height:390},{width:390,height:844}],checks=[],videos=[],pictures=[],errors=[];
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;

(async()=>{
 const browser=await chromium.launch(options);
 try{
  for(const viewport of sizes){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});
   await context.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
   const page=await context.newPage();await page.goto(base.href);
   const rows=await page.evaluate(()=>{
    reset();state='running';$('#overlay').hidden=true;selectView('chase');
    const original=playerCarMesh,results=[];
    const region=()=>{
     const x=Math.floor(w*.3),y=Math.floor(h*.25),width=Math.floor(w*.4),height=Math.floor(h*.67);
     drawPerspective();const withCar=ctx.getImageData(x,y,width,height).data;
     try{playerCarMesh=()=>[];drawPerspective();}
     finally{playerCarMesh=original;}
     const withoutCar=ctx.getImageData(x,y,width,height).data;
     let pixels=0,minX=width,minY=height,maxX=0,maxY=0;
     for(let i=0;i<withCar.length;i+=4)if(Math.abs(withCar[i]-withoutCar[i])+Math.abs(withCar[i+1]-withoutCar[i+1])+Math.abs(withCar[i+2]-withoutCar[i+2])>20){
      const px=(i/4)%width,py=Math.floor(i/4/width);pixels++;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
     }
     drawPerspective();return{pixels,width:maxX-minX+1,height:maxY-minY+1};
    };
    for(let index=0;index<N;index++){
     const p=track[index],q=track[(index+1)%N];car.x=p.x;car.y=p.y;car.angle=Math.atan2(q.y-p.y,q.x-p.x);hazard.fall=0;
     results.push({index,...region()});
    }
    car.y=1030;
    for(const fall of[.2,.7,1.2]){hazard.fall=fall;results.push({fall,...region()});}
    return results;
   });
   for(const row of rows)assert(row.pixels>100&&row.width>15&&row.height>10,JSON.stringify({viewport,...row}));
   checks.push({viewport,vehicleRegions:rows.length,minPixels:Math.min(...rows.map(r=>r.pixels)),passed:true});
   console.log('PASS',viewport.width,'whole vehicle regions across 240 headings and three falling stages');
   await context.close();
  }
  for(const viewport of sizes)for(const view of['first','chase','top']){
   const name=`${viewport.width}-${view}`,context=await browser.newContext({viewport,deviceScaleFactor:1,recordVideo:{dir:out,size:viewport}}),page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base.href);await page.locator('#start').click();await page.locator(`[data-view=${view}]`).click();
   await page.evaluate(()=>{car.x=510;car.y=550;car.angle=0;car.speed=190;});
   await page.keyboard.down('w');const rebound=await (await page.waitForFunction(()=>{const s=gameSnapshot();return s.hazard.impact>.5&&s.speed<0?{speed:s.speed,impact:s.hazard.impact,elapsed:s.elapsed}:false})).jsonValue();await page.keyboard.up('w');
   assert(rebound.speed<0&&rebound.impact>.5);
   await page.screenshot({path:path.join(out,name+'-impact.png')});pictures.push(name+'-impact.png');
   await page.waitForTimeout(350);
   const before=await page.evaluate(()=>{const p=edgePoint(5,208),q=edgePoint(5,230);hazard.impact=0;hazard.cooldown=0;car.x=p[0];car.y=p[2];car.angle=Math.atan2(q[2]-p[2],q[0]-p[0]);car.speed=120;return elapsed;});
   await page.keyboard.down('w');await page.waitForFunction(()=>gameSnapshot().hazard.fall>.15);await page.keyboard.up('w');
   assert.equal((await page.evaluate(()=>gameSnapshot())).input.gas,false);
   await page.screenshot({path:path.join(out,name+'-fall.png')});pictures.push(name+'-fall.png');
   await page.waitForFunction(()=>gameSnapshot().hazard.fall===0);
   const recovered=await page.evaluate(()=>gameSnapshot());assert(recovered.elapsed-before>=6.4);assert.equal(recovered.speed,0);
   await page.waitForTimeout(150);
   const video=page.video();await context.close();const source=await video.path(),destination=path.join(out,name+'-impact-fall-recovery.webm');fs.renameSync(source,destination);videos.push(path.basename(destination));
   checks.push({viewport,view,realAnimation:true,impact:true,rebound,fall:true,recovered:true,passed:true});
   console.log('PASS',name,'recorded actual collision, falling, and automatic recovery');
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,browser:browser.version(),target:base.href,checks,videos,pictures,consoleErrors:errors,fixtures:'Initial vehicle poses are fixtures. Videos use normal requestAnimationFrame, real keyboard input and real collision/fall/recovery transitions. Vehicle-region comparison removes only the car mesh between two real Canvas renders.',physicalPhone:false},null,2)+'\n');
  console.log('PASS: 486 vehicle regions, six real-animation recordings and twelve hazard screenshots');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
