const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=new URL(process.env.DRIVE_URL||pathToFileURL(path.resolve('dist/index.html')).href);
const out=path.resolve(process.env.DRIVE_VERIFY_DIR||'verification/latest','body-camera');
const options={headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']};
if(process.env.DRIVE_CHROMIUM_PATH)options.executablePath=process.env.DRIVE_CHROMIUM_PATH;
const checks=[],pictures=[],errors=[];fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch(options);let failure;
 try{
  for(const backend of['webgl','software'])for(const viewport of[{width:844,height:390},{width:390,height:844}]){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});
   await context.addInitScript(backend=>{
    window.requestAnimationFrame=()=>0;
    if(backend==='software'){
     const original=HTMLCanvasElement.prototype.getContext;
     HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args)};
    }
   },backend);
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(base.href);
   const rows=await page.evaluate(()=>{
    const rows=[],mesh=playerCarMesh,topCar=drawCar,cockpit=drawCockpit,effects=drawHazardEffects;
    const pixels=()=>ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const difference=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>12)count++;return count};
    try{
     drawHazardEffects=()=>{};
     for(const map of['circuit','mountain','proving','city','offroad'])for(const view of['first','chase','top']){
      selectMap(map);start();selectView(view);car.speed=140;elapsed=.031;hazard.dust=0;camera.x=car.x;camera.y=car.y;
      playerCarMesh=()=>[];
      drawCar=()=>{};drawCockpit=()=>{};
      hazard.impact=0;hazard.kind='road';
      // Repeated readback can switch Chromium's 2D Canvas raster backend.
      for(let i=0;i<4;i++){draw();pixels()}
      draw();const road=pixels();
      for(const kind of['impact','curb','runoff']){
       hazard.impact=kind==='impact'?.8:0;hazard.kind=kind==='impact'?'road':kind;draw();
       rows.push({id:`${map}/${view}/${kind}-world`,changedPixels:difference(road,pixels()),distance:typeof perspectivePose==='function'?perspectivePose().distance:null});
      }
      playerCarMesh=mesh;drawCar=topCar;drawCockpit=cockpit;
      if(view!=='top'){
       hazard.kind='road';hazard.impact=0;draw();const still=pixels();
       hazard.impact=.8;draw();rows.push({id:`${map}/${view}/body-pixels`,bodyPixels:difference(still,pixels())});
      }
     }
     selectMap('offroad');start();selectView('chase');drawHazardEffects=effects;
     const ground=perspectivePose();courseState.jump.height=30;courseState.jump.velocity=50;car.z+=30;
     rows.push({id:'jump-isolation',heightDelta:perspectivePose().camera[1]-ground.camera[1]});
     courseState.jump.height=0;courseState.jump.velocity=0;car.z=nearest(car.x,car.y).elevation;
     if(typeof vehicleBodyPose==='function'){
      car.speed=140;elapsed=.031;clearInput();hazard.impact=0;hazard.kind='road';const neutral=vehicleBodyPose();
      hazard.impact=.8;const impact=vehicleBodyPose();hazard.impact=0;hazard.kind='curb';const curb=vehicleBodyPose();
      hazard.kind='road';car.steer=1;const corner=vehicleBodyPose();car.steer=0;input.brake=true;const brake=vehicleBodyPose();
      rows.push({id:'readable-body',neutral,impact,curb,corner,brake});clearInput();
      hazard.impact=.8;hazard.kind='curb';recover();rows.push({id:'recovery-body',pose:vehicleBodyPose()});
     }else rows.push({id:'readable-body',missing:true});
     selectMap('mountain');start();selectView('chase');car.speed=140;hazard.impact=.8;elapsed=.031;draw();
     return rows;
    }finally{playerCarMesh=mesh;drawCar=topCar;drawCockpit=cockpit;drawHazardEffects=effects}
   });
   const name=`${backend}-${viewport.width}`;
   await page.screenshot({path:path.join(out,name+'-impact.png')});pictures.push(name+'-impact.png');
   fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(rows,null,2)+'\n');
   for(const row of rows){
    if(row.changedPixels!==undefined)assert.equal(row.changedPixels,0,`${name}/${row.id}: feedback moved the world or minimap`);
    if(row.bodyPixels!==undefined)assert(row.bodyPixels>10,`${name}/${row.id}: body feedback must change visible vehicle pixels`);
    if(row.id==='jump-isolation')assert(Math.abs(row.heightDelta)<.000001,`${name}: jump moved camera ${row.heightDelta}`);
    if(row.id==='readable-body'){
     assert(!row.missing,'vehicle feedback must have an independent body pose');
     for(const kind of['impact','curb','corner','brake'])assert.notDeepEqual(row[kind],row.neutral,`${kind} needs readable body feedback`);
     assert(row.brake.pitch<row.neutral.pitch,'forward braking pitches the nose down');
     assert(row.corner.roll>row.neutral.roll,'a right turn lowers the outside of the body');
     for(const pose of[row.neutral,row.impact,row.curb,row.corner,row.brake])assert(Object.values(pose).every(Number.isFinite),'body pose must remain finite');
    }
    if(row.id==='recovery-body')assert(Object.values(row.pose).every(value=>Math.abs(value)<.000001),'recovery must clear body motion');
   }
   checks.push({id:name,passed:true,rows});console.log('PASS',name,'full draw: five maps, three views, three hazards, stable world/minimap, independent jump and body');
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){failure=error;console.error(error)}
 finally{
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:!failure,browser:browser.version(),target:base.href,checks,pictures,consoleErrors:errors,error:failure?.message,
   scope:'Real renderers, full draw() path. Only player mesh/cockpit and intentional color overlays are removed for world-image comparison; race state, all track geometry and minimap remain. Held native animation supplies deterministic hazard phases. Existing separate native-animation suites still run.'},null,2)+'\n');
  await browser.close();
 }
 if(failure)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1});
