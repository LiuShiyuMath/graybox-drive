'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const checks=[];
function check(name,fn){fn();checks.push(name);console.log('PASS',name)}
function plain(value){return JSON.parse(JSON.stringify(value))}
const env=vm.createContext({console});
for(const name of ['maps','course-pack','racers'])vm.runInContext(fs.readFileSync(path.join(root,'dist',name+'.js'),'utf8'),env);
const racers=vm.runInContext('DriveRacers',env);
const map=id=>vm.runInContext(`DriveCourses.create(${JSON.stringify(id)},240)||DriveMaps.create(${JSON.stringify(id)},240)`,env);
const ids=['circuit','mountain','proving','city','offroad'];
function context(world,state='running'){
 return {state,player:{x:-100000,y:-100000,z:0,angle:0,speed:0},playerProgress:0,
  playerLap:1,playerFalling:false,signalTime:world.simulationTime,traffic:[],obstacles:world.route.map.objects||[]};
}
function tick(world,dt=.02,state='running'){
 const ctx=context(world,state);racers.step(world,dt,ctx);return ctx;
}

for(const id of ids){
 check(`${id}: fixed 2v2 roster, independent run, unique ranks and conserved team points`,()=>{
  const world=racers.create(map(id)),other=racers.create(map(id));
  assert.equal(world.mapId,id);assert.equal(world.simulationTime,0);assert.equal(world.actors.length,3);
  assert.deepEqual(plain(world.actors.map(a=>[a.id,a.team,a.role])),[
   ['ally','blue','teammate'],['rival-1','red','rival'],['rival-2','red','rival']]);
  tick(world);assert.equal(other.simulationTime,0);
  for(const a of world.actors)a.progress=0;
  const order=racers.standings(world,{progress:0,state:'running'});
  assert.deepEqual(plain(order.rows.map(r=>r.id)),['ally','player','rival-1','rival-2']);
  assert.deepEqual(plain(order.rows.map(r=>r.rank)),[1,2,3,4]);
  assert.deepEqual(plain(order.rows.map(r=>r.points)),[4,3,2,1]);
  assert.deepEqual(plain(order.teamScores),{blue:7,red:3});
 });
 check(`${id}: ready, paused and player-finished freeze every AI field`,()=>{
  const world=racers.create(map(id));tick(world,.4);
  for(const phase of ['ready','paused','finished']){
   const before=JSON.stringify(racers.snapshot(world,{progress:0,state:phase}));
   tick(world,2,phase);
   assert.equal(JSON.stringify(racers.snapshot(world,{progress:0,state:phase})),before);
  }
 });
 check(`${id}: ordinary physical steps drive all three computers to legal completion`,()=>{
  const world=racers.create(map(id)),initial=world.actors.map(a=>({x:a.x,y:a.y}));
  let moved=false;
  for(let frame=0;frame<15000&&!world.actors.every(a=>a.phase==='finished');frame++){
   const before=world.actors.map(a=>({x:a.x,y:a.y,phase:a.phase}));
   tick(world);
   for(let i=0;i<world.actors.length;i++){
    const a=world.actors[i],delta=Math.hypot(a.x-before[i].x,a.y-before[i].y);
    assert([a.x,a.y,a.z,a.angle,a.speed,a.progress].every(Number.isFinite));
    if(frame<20&&delta>0)moved=true;
    if(before[i].phase==='racing'&&a.phase==='racing')assert(delta<=15,'a normal physical step must not snap to its route');
   }
  }
  assert(moved,'AI must move without player input');
  assert(world.actors.every((a,i)=>Math.hypot(a.x-initial[i].x,a.y-initial[i].y)>30));
  assert(world.actors.every(a=>a.phase==='finished'),JSON.stringify(world.actors.map(a=>({id:a.id,phase:a.phase,progress:a.progress,cp:a.nextCheckpoint,lap:a.lap,recovery:a.recovery,stuck:a.stuck}))));
  for(const a of world.actors){
   assert.equal(a.nextCheckpoint,world.checkpoints.length);
   assert.equal(a.lap,world.route.closed?3:1);
   assert(Number.isFinite(a.finishTime)&&a.finishTime>0);
  }
  assert.equal(new Set(world.finishOrder).size,3);assert.equal(world.finishOrder.length,3);
  const frozen=JSON.stringify(world.actors),order=JSON.stringify(world.finishOrder);
  tick(world,2);assert.equal(JSON.stringify(world.actors),frozen);assert.equal(JSON.stringify(world.finishOrder),order);
 });
}

check('player recovery penalties do not teleport AI or advance its independent clock',()=>{
 const a=racers.create(map('mountain')),b=racers.create(map('mountain'));
 const ca=context(a),cb=context(b);ca.signalTime=0;cb.signalTime=300;
 for(let i=0;i<10;i++){racers.step(a,.02,ca);racers.step(b,.02,cb)}
 assert(Math.abs(a.simulationTime-.2)<1e-9);
 assert.equal(JSON.stringify(a.actors),JSON.stringify(b.actors));
});

check('ally yields to an approaching player while a rival uses a free passing lane',()=>{
 const world=racers.create(map('circuit'));
 for(let i=0;i<world.actors.length;i++)Object.assign(world.actors[i],racers.sample(world,600+i*500));
 const ally=world.actors[0],pose=racers.sample(world,600,0);
 Object.assign(ally,pose,{lane:0,speed:60});
 const player={x:ally.x-Math.cos(ally.angle)*55,y:ally.y-Math.sin(ally.angle)*55,z:ally.z,angle:ally.angle,speed:150};
 let command=racers.decide(world,ally,{...context(world),player});
 assert.equal(command.intent,'yield');assert(command.speed<ally.pace);assert(Math.abs(command.lane)>15);
 const rival=world.actors[1];Object.assign(rival,pose,{lane:0,speed:150});
 Object.assign(ally,racers.sample(world,1500));
 const slower={x:rival.x+Math.cos(rival.angle)*85,y:rival.y+Math.sin(rival.angle)*85,z:rival.z,angle:rival.angle,speed:30};
 command=racers.decide(world,rival,{...context(world),player:slower});
 assert.equal(command.intent,'pass');assert(Math.abs(command.lane)>35);
});

check('real contacts separate cars, alter velocity once, and respect height and finished status',()=>{
 const world=racers.create(map('circuit')),[a,b]=world.actors;
 Object.assign(a,{x:0,y:0,z:0,angle:0,speed:150,progress:33,phase:'racing',collisionCooldown:0,contacts:0});
 Object.assign(b,{x:20,y:0,z:0,angle:0,speed:0,progress:44,phase:'racing',collisionCooldown:0,contacts:0});
 assert(racers.contact(world,a,b)>0);assert(Math.hypot(b.x-a.x,b.y-a.y)>=42);
 assert(a.speed<150);assert(b.speed>0);assert.equal(a.contacts,1);assert.equal(b.contacts,1);
 assert.equal(a.progress,33);assert.equal(b.progress,44);
 b.x=a.x+20;b.y=a.y;racers.contact(world,a,b);assert.equal(a.contacts,1);assert.equal(b.contacts,1);
 Object.assign(a,{x:0,y:0,z:30,speed:150,collisionCooldown:0});
 Object.assign(b,{x:20,y:0,z:0,speed:0,collisionCooldown:0});
 const separated=JSON.stringify([a,b]);assert.equal(racers.contact(world,a,b),0);assert.equal(JSON.stringify([a,b]),separated);
 a.z=0;b.phase='finished';const finished=JSON.stringify([a,b]);
 assert.equal(racers.contact(world,a,b),0);assert.equal(JSON.stringify([a,b]),finished);
});

check('computer brakes for blocking traffic and resumes after that traffic leaves',()=>{
 const world=racers.create(map('circuit')),a=world.actors[0],pose=racers.sample(world,600,0);
 Object.assign(a,pose,{speed:70,lane:0,lastIndex:pose.index,progress:pose.index});
 for(const other of world.actors.slice(1))other.phase='finished';
 const traffic={x:a.x+Math.cos(a.angle)*60,y:a.y+Math.sin(a.angle)*60,z:a.z,angle:a.angle,speed:0};
 const blocked={...context(world),traffic:[traffic]};
 for(let i=0;i<30;i++)racers.step(world,.02,blocked);
 assert.equal(a.intent,'brake');assert.equal(a.speed,0);
 const stopped=a.progress;
 for(let i=0;i<40;i++)tick(world);
 assert(a.speed>60);assert(a.progress>stopped+.5);
});

check('computer recovery counts down only while running and returns to an earned checkpoint',()=>{
 const world=racers.create(map('mountain')),a=world.actors[0];
 Object.assign(a,racers.sample(world,world.route.lengths[90]),{progress:90,lastIndex:90,nextCheckpoint:1,checkpointProgress:40,speed:120});
 racers.recover(world,a);assert.equal(a.phase,'recovering');assert.equal(a.speed,0);
 const pending=JSON.stringify(a);tick(world,.8,'paused');assert.equal(JSON.stringify(a),pending);
 tick(world,.5);assert.equal(a.phase,'recovering');assert(a.recovery>0);
 tick(world,.52);assert.equal(a.phase,'racing');assert(a.progress<=40.2);assert.equal(a.nextCheckpoint,1);
 assert(Math.abs(racers.nearest(world,a.x,a.y).index-40)<.2);
 Object.assign(a,{progress:39,checkpointProgress:40});racers.recover(world,a);
 tick(world,.999);assert.equal(a.phase,'recovering');tick(world,.002);assert.equal(a.phase,'racing');
 assert.equal(a.progress,39,'recovery cannot award progress lost while reversing');
});

check('skipped checkpoints cannot produce a mountain finish or circuit lap',()=>{
 for(const id of ['mountain','circuit']){
  const world=racers.create(map(id)),a=world.actors[0],count=world.route.track.length;
  Object.assign(a,racers.sample(world,world.route.lengths[count-3]),{
   progress:count-3,lastIndex:count-3,nextCheckpoint:0,checkpointProgress:0,lap:1,speed:120});
  for(let i=0;i<60;i++)tick(world);
  assert.equal(a.phase,'racing');assert.equal(a.lap,1);assert(!world.finishOrder.includes(a.id));
 }
});

check('finish order is unique, stable and takes precedence over later route positions',()=>{
 const world=racers.create(map('circuit'));
 world.finishOrder.push('rival-2','ally');
 world.actors.find(a=>a.id==='rival-2').phase='finished';
 world.actors.find(a=>a.id==='ally').phase='finished';
 world.actors.find(a=>a.id==='rival-1').progress=1000;
 racers.finishPlayer(world);racers.finishPlayer(world);
 assert.deepEqual(plain(world.finishOrder),['rival-2','ally','player']);
 const order=racers.standings(world,{progress:900,state:'finished'});
 assert.deepEqual(plain(order.rows.map(a=>a.id)),['rival-2','ally','player','rival-1']);
 assert.deepEqual(plain(order.teamScores),{blue:5,red:5});
 const snapshot=racers.snapshot(world,{progress:900,state:'finished'});
 snapshot.actors[0].x+=100;snapshot.finishOrder.push('bogus');
 assert.notEqual(snapshot.actors[0].x,world.actors[0].x);assert.equal(world.finishOrder.length,3);
});

const nodes=new Map(),storage=new Map();
function node(selector){
 if(!nodes.has(selector))nodes.set(selector,{textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},
  classList:{toggle(){},remove(){},add(){}},setAttribute(){},addEventListener(){},
  getBoundingClientRect:()=>({width:844,height:390}),
  getContext:()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},
   {get:(o,k)=>o[k]||((...args)=>args.forEach(n=>{if(typeof n==='number')assert(Number.isFinite(n))}))})});
 return nodes.get(selector);
}
const game=vm.createContext({console,document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle(){}}}},
 window:{addEventListener(){},location:{search:''}},URLSearchParams,devicePixelRatio:1,requestAnimationFrame(){},
 setTimeout(){},clearTimeout(){},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))}});
for(const name of ['maps','course-pack','course-world','racers','game','perspective'])vm.runInContext(fs.readFileSync(path.join(root,'dist',name+'.js'),'utf8'),game);
const run=code=>vm.runInContext(`{${code}}`,game);
check('game lifecycle really drives, pauses, restarts, switches and finishes the computer world',()=>{
 for(const id of ids){
  run(`selectMap(${JSON.stringify(id)});start();for(let i=0;i<30;i++)update(.02)`);
  let actual=plain(run('window.gameSnapshot().racers'));
  assert.equal(actual.mapId,id);assert(actual.enabled);assert(actual.simulationTime>.5);
  assert(actual.actors.some(a=>a.speed>0));assert.equal(actual.standings.length,4);
  run('pause()');const frozen=run('JSON.stringify(window.gameSnapshot().racers)');run('update(2)');assert.equal(run('JSON.stringify(window.gameSnapshot().racers)'),frozen);
  run('start();update(.02)');assert(run('racers.simulationTime')>actual.simulationTime);
  run('reset()');actual=plain(run('window.gameSnapshot().racers'));
  assert.equal(actual.simulationTime,0);assert.equal(actual.finishOrder.length,0);assert(actual.actors.every(a=>a.phase==='racing'&&a.nextCheckpoint===0&&a.contacts===0));
  run('state="running";finish()');assert.equal(run('state'),'finished');
  assert.equal(run('racers.finishOrder.filter(id=>id==="player").length'),1);
  const finished=run('JSON.stringify(window.gameSnapshot().racers)');run('update(2)');assert.equal(run('JSON.stringify(window.gameSnapshot().racers)'),finished);
 }
 run('selectMap("mountain")');assert.equal(run('state'),'ready');assert.equal(run('racers.finishOrder.length'),0);assert.equal(run('racers.simulationTime'),0);
});
for(const id of ['city','offroad'])check(`${id}: full game with idle player and live traffic does not leave computers blocked indefinitely`,()=>{
 run(`selectMap(${JSON.stringify(id)});start();let frames=0;while(frames<20000&&!racers.actors.every(a=>a.phase==='finished')){update(.02);frames++}`);
 const actual=plain(run('window.gameSnapshot()'));
 assert.equal(actual.state,'running');
 assert(actual.racers.actors.every(a=>a.phase==='finished'),JSON.stringify(actual.racers.actors.map(a=>({id:a.id,phase:a.phase,intent:a.intent,progress:a.progress,cp:a.nextCheckpoint,lap:a.lap}))));
 assert.equal(actual.racers.finishOrder.length,3);
 if(id==='city')assert(actual.course.traffic.length>0,'full-game test must retain actual city traffic');
});
const output={passed:true,checks,scope:'actual DriveRacers and game runtime in DOM fixture; real animation/rendering is a separate browser check'};
if(process.env.DRIVE_VERIFY_DIR){const dir=path.join(process.env.DRIVE_VERIFY_DIR,'racers');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'runtime-results.json'),JSON.stringify(output,null,2)+'\n')}
console.log(`PASS ${checks.length} computer-racer implementation contracts`);
