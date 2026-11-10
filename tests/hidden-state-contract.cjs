const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');

function runtime(){
 const nodes=new Map(),storage=new Map(),timers=new Map(),windowEvents=new Map(),documentEvents=new Map();
 let wallTime=0,nextTimer=0;
 const on=(events,name,handler)=>events.set(name,[...(events.get(name)||[]),handler]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},
   classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(){},
   getBoundingClientRect:()=>({width:844,height:390}),getContext:()=>({setTransform(){}})});
  return nodes.get(selector);
 };
 const env={document:{querySelector:node,querySelectorAll:()=>[],hidden:false,
  addEventListener:(name,handler)=>on(documentEvents,name,handler),body:{classList:{toggle(){}}}},
  window:{location:{search:''},addEventListener:(name,handler)=>on(windowEvents,name,handler)},
  URLSearchParams,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},
  requestAnimationFrame(){},devicePixelRatio:1,
  setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,due:wallTime+delay});return id;},
  clearTimeout:id=>timers.delete(id)};
 vm.createContext(env);
 for(const name of['maps','course-pack','course-world','racers','game','perspective'])
  vm.runInContext(fs.readFileSync(`dist/${name}.js`,'utf8'),env,{filename:`dist/${name}.js`});
 const run=source=>vm.runInContext(`{${source}}`,env);
 return{run,node,storage,env,timers,
  fireWindow:(name,event={})=>(windowEvents.get(name)||[]).forEach(handler=>handler(event)),
  fireDocument:(name,event={})=>(documentEvents.get(name)||[]).forEach(handler=>handler(event)),
  advanceWall(milliseconds){
   wallTime+=milliseconds;
   for(const [id,timer]of[...timers].sort((a,b)=>a[1].due-b[1].due))
    if(timer.due<=wallTime&&timers.has(id)){timers.delete(id);timer.callback();}
  }};
}

let checks=0;
function check(name,fn){fn(runtime());checks++;console.log('PASS',name);}
const physics='JSON.stringify([car,elapsed,lap,progress,lastIndex,checkpointIndex,hazard,courseState&&{...courseState,collected:[...courseState.collected]},skids])';

check('motion crosses forward, stopped and reverse through actual pedals',({run})=>{
 run('start();input.gas=true;for(let i=0;i<30;i++)update(.02)');assert(run('car.speed')>0);
 run('clearInput();car.speed=0;update(.02)');assert.equal(run('car.speed'),0);
 run('input.brake=true;for(let i=0;i<30;i++)update(.02)');assert(run('car.speed')<0);
 run('clearInput();input.gas=true;for(let i=0;i<40;i++)update(.02)');assert(run('car.speed')>0);
});
check('opposing steering cancels and releasing one source retains the other',({run})=>{
 run('start();car.speed=100;setInputSource("left","left",true);setInputSource("right","right",true);update(.02)');
 assert.equal(run('car.steer'),0);
 run('setInputSource("left","left",false);update(.02)');assert(run('car.steer')>0);
 run('clearInput();update(.02)');assert(run('car.steer')>0&&run('car.steer')<.18);
});
check('all four materials produce grip-dependent slip and asphalt creates none',({run})=>{
 const slip={};
 for(const material of['asphalt','grass','gravel','mud']){
  slip[material]=run(`selectMap('${material==='gravel'?'offroad':'proving'}');start();
   const index=track.findIndex(p=>p.material==='${material}'),p=track[index];
   car.x=p.x;car.y=p.y;car.speed=200;car.steer=1;
   updateCoursePhysics(.05,nearest(car.x,car.y));courseState.slip`);
 }
 assert.equal(slip.asphalt,0);assert(slip.mud>slip.grass&&slip.grass>slip.gravel&&slip.gravel>0);
 run('courseState.slip=0;car.speed=100;updateCoursePhysics(.05,nearest(car.x,car.y))');assert.equal(run('courseState.slip'),0);
 run('selectMap("city");start();courseState.slip=20;updateCoursePhysics(.05,nearest(car.x,car.y))');
 assert(run('courseState.slip')>0&&run('courseState.slip')<20);
});
check('recovery clears slip and flight without clearing earned collections',({run})=>{
 run('selectMap("offroad");start();courseState.collected.add("trail-1");courseState.jump={height:25,velocity:45};courseState.slip=18;recover()');
 assert.equal(run('courseState.jump.height'),0);assert.equal(run('courseState.jump.velocity'),0);
 assert.equal(run('courseState.slip'),0);assert.equal(run('courseState.collected.size'),1);
});
check('jump requires adequate forward speed and alignment',({run})=>{
 for(const [speed,rotation,launched]of[[129,0,false],[160,Math.PI,false],[160,0,true]]){
  run(`selectMap('offroad');start();const ramp=activeMap.ramps[0];car.x=ramp.x;car.y=ramp.y;
   car.angle=ramp.angle+${rotation};car.speed=${speed};update(.001)`);
  assert.equal(run('courseState.jump.velocity>0'),launched);
 }
});
check('natural landing retains a ramp lock until the car leaves its zone',({run})=>{
 run('selectMap("offroad");start();const ramp=activeMap.ramps[0];car.x=ramp.x;car.y=ramp.y;car.angle=ramp.angle;car.speed=160;update(.001);car.speed=0;for(let i=0;i<100;i++)update(.02)');
 assert.equal(run('courseState.jump.height'),0);assert.equal(run('courseState.jump.velocity'),0);
 assert.equal(run('courseState.ramp'),run('activeMap.ramps[0].index'));
 run('car.speed=160;update(.001)');assert.equal(run('courseState.jump.height'),0);
 run('car.x=track[0].x;car.y=track[0].y;car.speed=0;update(.001)');assert.equal(run('courseState.ramp'),null);
 run('const ramp=activeMap.ramps[0];car.x=ramp.x;car.y=ramp.y;car.angle=ramp.angle;car.speed=160;update(.001)');
 assert(run('courseState.jump.velocity')>0);
});
check('recovery retains the launch lock and the next outside-zone tick releases it',({run})=>{
 run('selectMap("offroad");start();const ramp=activeMap.ramps[0];car.x=ramp.x;car.y=ramp.y;car.angle=ramp.angle;car.speed=160;update(.001);recover()');
 assert.equal(run('courseState.ramp'),run('activeMap.ramps[0].index'));
 assert.equal(run('courseState.jump.height'),0);
 run('update(.001)');assert.equal(run('courseState.ramp'),null);
});
check('green amber and red have exact boundaries, offsets and periodicity',({run})=>{
 run('selectMap("city");start()');
 for(const [time,color]of[[0,'green'],[5.999,'green'],[6,'amber'],[6.999,'amber'],[7,'red'],[11.999,'red'],[12,'green']])
  assert.equal(run(`courseSignal(activeMap.intersections[0],${time})`),color);
 for(let signal=0;signal<2;signal++)for(let time=-12;time<24;time++)
  assert.equal(run(`courseSignal(activeMap.intersections[${signal}],${time})`),run(`courseSignal(activeMap.intersections[${signal}],${time+12})`));
});
check('approaching AI cross traffic waits on green and amber and moves on red',({run})=>{
 for(const [time,stopped]of[[0,true],[6,true],[8,false]]){
  run(`selectMap('city');start();elapsed=${time};const vehicle=courseState.traffic[0],signal=activeMap.intersections[0];
   vehicle.distance=signal.x-vehicle.route.points[0].x-signal.halfWidth-60;updateCourseTraffic(.02)`);
  assert.equal(run('courseState.traffic[0].speed===0'),stopped);
 }
});
check('AI route endpoints turn around without discontinuous positions',({run})=>{
 run('selectMap("city");start()');
 for(let index=0;index<2;index++){
  const values=JSON.parse(run(`const route=courseState.traffic[${index}].route,length=Math.hypot(route.points[1].x-route.points[0].x,route.points[1].y-route.points[0].y);
   JSON.stringify([sampleTraffic(route,0),sampleTraffic(route,length),sampleTraffic(route,length+.001),sampleTraffic(route,length*2)])`));
  assert(Math.hypot(values[1].x-values[2].x,values[1].y-values[2].y)<.002);
  assert(Math.hypot(values[0].x-values[3].x,values[0].y-values[3].y)<.001);
  assert(Math.abs(Math.cos(values[1].angle-values[2].angle)+1)<.0001);
 }
});
check('stop-line crossings charge amber and red but not green',({run})=>{
 for(const [time,charges]of[[0,0],[6,1],[8,1]]){
  run(`selectMap('city');start();elapsed=${time};const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);
   car.x=line.x+c;car.y=line.y+s;updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x-c,y:line.y-s})`);
  assert.equal(run('courseState.violations'),charges);assert.equal(run('elapsed'),time+3*charges);
 }
});
check('remaining beyond a stop line does not recharge and reverse crossing rearms',({run})=>{
 run('selectMap("city");start();elapsed=8;const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);car.x=line.x+c;car.y=line.y+s;updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x-c,y:line.y-s})');
 assert.equal(run('courseState.violations'),1);
 run('const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);car.x=line.x+2*c;car.y=line.y+2*s;updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x+c,y:line.y+s})');
 assert.equal(run('courseState.violations'),1);
 run('const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);car.x=line.x-c;car.y=line.y-s;updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x+c,y:line.y+s})');
 assert.equal(run('courseState.violations'),1);
 run('const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);car.x=line.x+c;car.y=line.y+s;updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x-c,y:line.y-s})');
 assert.equal(run('courseState.violations'),2);assert.equal(run('elapsed'),14);
});
check('out-of-width and backwards crossings do not charge',({run})=>{
 for(const [lateral,direction]of[[300,1],[0,-1]]){
  run(`selectMap('city');start();elapsed=8;const line=activeMap.intersections[0].stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle),side=${lateral},d=${direction};
   car.x=line.x+d*c-side*s;car.y=line.y+d*s+side*c;
   updateCourseRace(nearest(car.x,car.y),0,0,{x:line.x-d*c-side*s,y:line.y-d*s+side*c})`);
  assert.equal(run('courseState.violations'),0);assert.equal(run('elapsed'),8);
 }
});
check('all six collectibles are idempotent and recovery preserves membership',({run})=>{
 run('selectMap("offroad");start();for(const item of activeMap.collectibles){car.x=item.x;car.y=item.y;car.speed=0;update(.001);update(.001)}');
 assert.equal(run('courseState.collected.size'),6);run('recover()');assert.equal(run('courseState.collected.size'),6);
 run('selectMap("offroad")');assert.equal(run('courseState.collected.size'),0);
});
check('fall overrides impact and recovery clears raw hazards and feedback together',({run,node})=>{
 run('start();hazard.kind="edge";hazard.impact=.8;updateFeedback()');assert.equal(node('#feedback').dataset.kind,'impact');
 run('hazard.fall=.2;updateFeedback()');assert.equal(node('#feedback').dataset.kind,'fall');
 run('recover()');assert.equal(node('#feedback').hidden,true);
 assert.equal(run('hazard.fall'),0);assert.equal(run('hazard.impact'),0);assert.equal(run('hazard.dust'),0);
});
check('dust rises on loose ground, decays at rest and remains bounded',({run})=>{
 run('selectMap("offroad");start();car.speed=200;update(.02)');const before=run('hazard.dust');assert(before>0&&before<=1);
 run('car.speed=0;for(let i=0;i<25;i++)update(.02)');assert(run('hazard.dust')>=0&&run('hazard.dust')<before);
});
check('new toast cancels the prior wall-clock expiry',({run,node,timers,advanceWall})=>{
 run('start();toast("first")');advanceWall(500);run('toast("second")');assert.equal(timers.size,1);
 advanceWall(1500);assert.equal(node('#toast').textContent,'second');assert.equal(node('#toast').style.display,'block');
 advanceWall(500);assert.equal(node('#toast').style.display,'none');assert.equal(timers.size,0);
});
check('toast may expire while paused without advancing simulation',({run,node,advanceWall})=>{
 run('selectMap("offroad");start();toast("notice");pause()');const before=run(physics);
 advanceWall(2000);assert.equal(node('#toast').style.display,'none');assert.equal(run(physics),before);assert.equal(run('state'),'paused');
});
check('reset and map switch cancel pending toast timers',({run,node,timers,advanceWall})=>{
 for(const action of['reset()','selectMap("mountain")']){
  run(`start();toast('old');${action}`);assert.equal(timers.size,0);advanceWall(2000);assert.equal(node('#toast').style.display,'none');
 }
});
for(const map of['circuit','mountain','proving','city','offroad'])
 check(`${map}: pause freezes motion, hazards, traffic, jump, route and effects`,({run})=>{
  run(`selectMap('${map}');start();car.speed=150;setInputSource('gas','gas',true);update(.02);pause()`);
  const before=run(physics);run('for(let i=0;i<10;i++)update(.2)');assert.equal(run(physics),before);
  assert.equal(run('input.gas'),false);run('start()');assert.equal(run('input.gas'),false);
 });
check('blur and hidden visibility each clear input and pause the complete world',({run,fireWindow,fireDocument,env})=>{
 for(const hidden of[false,true]){
  run('selectMap("city");start();setInputSource("held","gas",true)');
  if(hidden){env.document.hidden=true;fireDocument('visibilitychange');env.document.hidden=false;}else fireWindow('blur');
  assert.equal(run('state'),'paused');assert.equal(run('inputSources.size'),0);
  const before=run(physics);run('update(1)');assert.equal(run(physics),before);
 }
});
check('all five map switches clear hidden run state and restore independent records',({run,storage})=>{
 for(const map of['circuit','mountain','proving','city','offroad']){
  const key=map==='circuit'?'graybox-drive-best':`graybox-drive-best-${map}`;storage.set(key,'25');
  run(`selectMap('offroad');start();courseState.jump={height:20,velocity:20};courseState.ramp=31;
   courseState.slip=12;courseState.collected.add('trail-1');hazard.impact=.8;hazard.dust=.6;
   setInputSource('held','gas',true);selectMap('${map}')`);
  assert.equal(run('state'),'ready');assert.equal(run('elapsed'),0);assert.equal(run('best'),25);
  assert.equal(run('courseState.ramp'),null);assert.equal(run('courseState.jump.height'),0);
  assert.equal(run('courseState.slip'),0);assert.equal(run('courseState.collected.size'),0);
  assert.equal(run('inputSources.size'),0);assert.equal(run('hazard.impact'),0);assert.equal(run('hazard.dust'),0);
 }
});

console.log(`PASS: ${checks} actual-runtime hidden-state contracts; DOM and wall clock are stubs, rendering is not asserted`);
