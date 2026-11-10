const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),storage=new Map();
const node=s=>{
 if(!nodes.has(s))nodes.set(s,{textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({width:844,height:390}),getContext:()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||((...args)=>args.forEach(v=>{if(typeof v==='number')assert(Number.isFinite(v),'finite Canvas coordinates')}))})});
 return nodes.get(s);
};
const env={document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle(){}}}},window:{addEventListener(){},location:{search:''}},URLSearchParams,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},devicePixelRatio:1,console};
vm.createContext(env);
for(const file of['maps','course-pack','course-world','racers','game','perspective'])vm.runInContext(fs.readFileSync(`dist/${file}.js`,'utf8'),env);
const run=s=>vm.runInContext(`{${s}}`,env);
function check(name,fn){fn();console.log('PASS',name)}

for(const id of['proving','city','offroad']){
 check(`${id}: sequential checkpoints, three laps, own best and clean restart`,()=>{
  run(`selectMap('${id}');start();for(let j=0;j<3;j++)for(let i=1;i<=N;i++){const p=track[i%N];car.x=p.x;car.y=p.y;car.speed=0;update(.02)}`);
  assert.equal(run('state'),'finished');assert.equal(run('lap'),3);assert(storage.has(`graybox-drive-best-${id}`));
  run('start()');assert.equal(run('elapsed'),0);assert.equal(run('courseState.collected.size'),0);assert.equal(run('courseState.jump.height'),0);
 });
 check(`${id}: reverse and teleport cannot earn laps`,()=>{
  run(`selectMap('${id}');start();for(let i=N-1;i>=0;i--){car.x=track[i].x;car.y=track[i].y;update(.02)}`);
  assert.equal(run('lap'),1);assert.equal(run('state'),'running');
  run('start();car.x=track[239].x;car.y=track[239].y;update(.02)');assert.equal(run('state'),'running');assert.equal(run('courseState.nextCheckpoint'),0);
 });
 check(`${id}: camera changes preserve race and all viewpoints render`,()=>{
  run(`selectMap('${id}');start();elapsed=12`);
  const before=run('JSON.stringify(window.gameSnapshot())');
  for(const view of['first','chase','top']){
   run(`selectView('${view}');draw()`);
   assert.equal(run('elapsed'),12);
   for(const index of[0,40,80,120,160,200])run(`car.x=track[${index}].x;car.y=track[${index}].y;car.z=track[${index}].z;draw()`);
  }
  assert.equal(JSON.parse(before).map,id);
 });
}

check('surface material affects speed and produces recoverable slip',()=>{
 run('selectMap("proving");start();car.speed=160;update(.2)');const asphalt=run('car.speed');
 run('start();const i=150;car.x=track[i].x;car.y=track[i].y;car.angle=Math.atan2(track[i+1].y-track[i].y,track[i+1].x-track[i].x);car.speed=160;input.right=true;update(.2)');
 assert(run('car.speed')<asphalt);assert.notEqual(run('courseState.slip'),0);
 run('recover()');assert.equal(run('courseState.slip'),0);
});
check('traffic signals alternate; AI stops on main-road green and freezes while paused',()=>{
 run('selectMap("city");start()');assert.equal(run('courseSignal(activeMap.intersections[0],0)'),'green');assert.equal(run('courseSignal(activeMap.intersections[0],8)'),'red');
 run('const v=courseState.traffic[0],s=activeMap.intersections[0];v.distance=s.x-v.route.points[0].x-s.halfWidth-60;updateCourseTraffic(.02)');assert.equal(run('courseState.traffic[0].speed'),0);
 run('elapsed=8;updateCourseTraffic(.02)');assert(run('courseState.traffic[0].speed')>0);
 run('pause()');const frozen=run('JSON.stringify([elapsed,courseState.traffic])');run('update(2)');assert.equal(run('JSON.stringify([elapsed,courseState.traffic])'),frozen);
});
check('red-light crossing penalizes once, green crossing does not',()=>{
 run('selectMap("city");start();elapsed=8;const s=activeMap.intersections[0],l=s.stopLine;car.x=l.x-Math.cos(l.angle);car.y=l.y-Math.sin(l.angle);car.angle=l.angle;car.speed=120;update(.01)');
 assert.equal(run('courseState.violations'),1);assert(Math.abs(run('elapsed')-11.01)<.001);
 run('update(.01)');assert.equal(run('courseState.violations'),1);
 run('start();const s=activeMap.intersections[0],l=s.stopLine;car.x=l.x-Math.cos(l.angle);car.y=l.y-Math.sin(l.angle);car.angle=l.angle;car.speed=120;update(.01)');assert.equal(run('courseState.violations'),0);
});
check('red-light penalty uses the same exact plane and width as both renderers',()=>{
 run('selectMap("city");start();elapsed=8;const line=activeMap.intersections[0].stopLine;car.x=line.x-Math.cos(line.angle);car.y=line.y-Math.sin(line.angle);car.angle=line.angle;car.speed=0;update(.001)');assert.equal(run('courseState.violations'),0);
 run('car.speed=120;update(.02)');assert.equal(run('courseState.violations'),1);
 run('update(.02)');assert.equal(run('courseState.violations'),1);
 run('start();elapsed=8;const l=activeMap.intersections[0].stopLine,c=Math.cos(l.angle),s=Math.sin(l.angle);car.x=l.x-c-s*200;car.y=l.y-s+c*200;car.angle=l.angle;car.speed=120;update(.02)');assert.equal(run('courseState.violations'),0);
 assert.equal(run('activeMap.intersections[0].stopLine.w'),run('track[activeMap.intersections[0].stopIndex].width'));
});
check('AI vehicle collision separates and rebounds the player',()=>{
 run('selectMap("city");start();const v=courseState.traffic[0],p=sampleTraffic(v.route,v.distance);car.x=p.x-v.route.w/2-10;car.y=p.y;car.angle=0;car.speed=150;resolveCourseCollisions()');
 assert(run('car.speed')<0);assert(run('hazard.impact')>.5);
});
check('offroad collection is idempotent; jump pauses and recovery clears it',()=>{
 run('selectMap("offroad");start();const token=activeMap.collectibles[0];car.x=token.x;car.y=token.y;update(.01);update(.01)');assert.equal(run('courseState.collected.size'),1);
 run('const r=activeMap.ramps[0];car.x=r.x;car.y=r.y;car.angle=r.angle;car.speed=160;update(.01)');assert(run('courseState.jump.velocity')>0);
 run('pause()');const frozen=run('JSON.stringify(courseState.jump)');run('update(.5)');assert.equal(run('JSON.stringify(courseState.jump)'),frozen);
 run('start();recover()');assert.equal(run('courseState.jump.height'),0);assert.equal(run('courseState.jump.velocity'),0);
});
check('marked shortcut permits route progress while terrain keeps grass friction',()=>{
 run('selectMap("offroad");start();const p=activeMap.shortcuts[0].points[1];car.x=p.x;car.y=p.y');
 assert.equal(run('courseSurface(nearest(car.x,car.y)).shortcut'),true);assert.equal(run('courseSurface(nearest(car.x,car.y)).onRoute'),true);run('update(.001)');assert.equal(run('hazard.kind'),'road');assert.equal(nodes.get('#surface').textContent,'草地');
});
check('map switch clears run-specific states and retains independent saved records',()=>{
 run('selectMap("offroad");start();courseState.collected.add("trail-1");courseState.jump.height=20;selectMap("city")');assert.equal(run('state'),'ready');assert.equal(run('courseState.collected.size'),0);assert.equal(run('courseState.jump.height'),0);assert.equal(run('elapsed'),0);
 assert.equal(run('best'),Number(storage.get('graybox-drive-best-city')));
});

check('finish requires a forward crossing on the actual road, not re-entry after bypass',()=>{
 run('selectMap("offroad");start();for(let i=1;i<=239;i++){car.x=track[i].x;car.y=track[i].y;car.speed=0;update(.01)}');
 run('for(let i=239;i<=245;i++){const p=edgeAt(i,140);car.x=p[0];car.y=p[2];update(.01)}car.x=track[6].x;car.y=track[6].y;update(.01)');assert.equal(run('lap'),1);
});
check('a legal terrain detour still finishes the lap after all ordered checkpoints',()=>{
 run('selectMap("proving");start();for(let i=1;i<=N;i++){const p=edgeAt(i,i>=5&&i<=12?140:0);car.x=p[0];car.y=p[2];car.speed=0;update(.01)}');assert.equal(run('lap'),2);
});
check('city road physics and penalties follow visible road and stop-line width',()=>{
 run('selectMap("city");start();car.x=650;car.y=560');assert.equal(run('courseSurface(nearest(car.x,car.y)).name'),'asphalt');run('update(.001)');assert.equal(run('hazard.kind'),'road');assert.equal(nodes.get('#surface').textContent,'柏油路面');
 run('elapsed=8;const i=activeMap.intersections[0].stopIndex;lastIndex=i-1;const p=edgeAt(i,500);car.x=p[0];car.y=p[2];update(.01)');assert.equal(run('courseState.violations'),0);
});
check('shortcut elevation and physics match its complete 3D path',()=>{
 run('selectMap("offroad");start()');
 const samples=run(`(()=>{const path=activeMap.shortcuts[0],result=[];for(let i=0;i<path.points.length-1;i++)for(let k=1;k<10;k++){const t=k/10,a=path.points[i],b=path.points[i+1];car.x=a.x+(b.x-a.x)*t;car.y=a.y+(b.y-a.y)*t;const n=nearest(car.x,car.y);result.push([n.elevation,a.z+(b.z-a.z)*t,courseSurface(n).shortcut])}return result})()`);
 for(const [actual,expected,onShortcut] of samples){assert(onShortcut);assert(Math.abs(actual-expected)<.001);}
});
check('a ramp flight rises, falls, naturally lands and stays grounded',()=>{
 run('selectMap("offroad");start();const r=activeMap.ramps[0];car.x=r.x;car.y=r.y;car.angle=r.angle;car.speed=160;update(.01)');
 assert(run('courseState.jump.velocity')>0);
 run('for(let i=0;i<15;i++)update(.02)');assert(run('courseState.jump.height')>0);
 run('for(let i=0;i<80;i++)update(.02)');assert.equal(run('courseState.jump.height'),0);assert.equal(run('courseState.jump.velocity'),0);
 run('update(.1)');assert.equal(run('courseState.jump.height'),0);
});

for(const id of['proving','city','offroad']){
 const trip=run(`selectMap('${id}');start();(()=>{
  let maxOff=0,impacts=0;
  for(let step=0;step<45000&&state==='running';step++){
   const n=nearest(car.x,car.y),target=track[(n.index+3)%N];
   let angle=Math.atan2(target.y-car.y,target.x-car.x)-car.angle;angle=Math.atan2(Math.sin(angle),Math.cos(angle));
   input.left=angle<-.03;input.right=angle>.03;input.gas=car.speed<145;
   input.brake=car.speed>170||(Math.abs(angle)>.65&&car.speed>70);
   update(.02);maxOff=Math.max(maxOff,n.distance);if(hazard.impact>.7)impacts++;
  }
  return {state,lap,progress,elapsed,maxOff,impacts};
 })()`);
 console.log('CONTINUOUS',id,JSON.stringify(trip));assert.equal(trip.state,'finished',`${id} continuous physics drive reaches the finish`);
}
