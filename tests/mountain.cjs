const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map();
const get=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{remove(){},add(){},toggle(){}},addEventListener(){},setAttribute(){},getBoundingClientRect:()=>({width:844,height:332}),getContext:()=>new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||((...args)=>{for(const value of args)if(typeof value==='number')assert(Number.isFinite(value),'finite rendering coordinates')})})});return elements.get(s)};
const env={document:{body:{classList:{toggle(){}}},querySelector:get,querySelectorAll:()=>[],addEventListener(){}},window:{addEventListener(){},location:{search:'?map=mountain'}},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value))},URLSearchParams,devicePixelRatio:1,requestAnimationFrame(){},setTimeout(){},clearTimeout(){},console};
vm.createContext(env);for(const name of['maps','game','perspective'])vm.runInContext(fs.readFileSync(`dist/${name}.js`,'utf8'),env);
const run=s=>vm.runInContext(`{${s}}`,env);
assert.equal(run('activeMap.id'),'mountain');assert.equal(run('activeMap.closed'),false);assert.equal(run('track.length'),240);assert(run('activeMap.length')>7000);assert.equal(run('track.at(-1).z'),1020);
assert(run('track.every((p,i)=>!i||p.z>=track[i-1].z)'));
assert(run(`(()=>{let left=0,right=0;for(let i=1;i<N-1;i++){const a=track[i-1],b=track[i],c=track[i+1],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);if(cross>1)left++;if(cross< -1)right++}return left>50&&right>50})()`));
console.log('PASS: open 716 m mountain road, 102 m actual climb, both directions of S turns, monotonic elevation');
run('start();input.gas=true;for(let i=0;i<100;i++)update(.02)');assert(run('car.z')>0);assert(run('car.speed')>150);assert.equal(run('hazard.fall'),0);
run('reset();state="running";car.x=track[N-1].x;car.y=track[N-1].y;update(.02)');assert.equal(run('state'),'running');assert.equal(run('checkpointIndex'),0);
run('reset();state="running";for(let k=1;k<N;k++){car.x=track[k].x;car.y=track[k].y;car.speed=0;update(.02)}');assert.equal(run('state'),'finished');assert.equal(run('checkpointIndex'),200);assert(run('best')>0);assert(storage.has('graybox-drive-best-mountain'));assert.equal(storage.has('graybox-drive-best'),false);
console.log('PASS: slope driving, shortcut cannot finish, five checkpoints, summit finish, per-map best scores');
run('reset();state="running";for(let k=1;k<=125;k++){car.x=track[k].x;car.y=track[k].y;car.speed=0;update(.02)}');assert.equal(run('checkpointIndex'),120);
run('const edge=edgePoint(130,86);car.x=edge[0];car.y=edge[2];update(.01)');assert.equal(run('hazard.kind'),'edge');assert.equal(run('hazard.fall'),0);
run('const fallPoint=edgePoint(130,108);car.x=fallPoint[0];car.y=fallPoint[2];input.gas=true;update(.01)');assert(run('hazard.fall')>0);assert.equal(run('input.gas'),false);
const before=run('elapsed');run('pause();update(.5)');const frozen=run('hazard.fall');run('update(.5)');assert.equal(run('hazard.fall'),frozen);
run('start();for(let i=0;i<90;i++)update(.02)');assert.equal(run('hazard.fall'),0);assert.equal(run('progress'),120);assert(run('nearest(car.x,car.y).distance')<1);assert(Math.abs(run('elapsed')-before-6.8)<.001);
const after=run('elapsed');run('recover();for(let i=0;i<100;i++)update(.02)');assert(Math.abs(run('elapsed')-after-5)<.001);assert.equal(run('progress'),120);
console.log('PASS: cliff warning, fall clears input, pause freezes falling, recovery to earned checkpoint, penalties applied once');
run('reset();state="running";const wallPoint=edgePoint(24,-81);car.x=wallPoint[0];car.y=wallPoint[2];const n=nearest(car.x,car.y);car.angle=Math.atan2(-n.ny,-n.nx);car.speed=150;update(.01)');assert(run('nearest(car.x,car.y).signed')>= -72.1);assert(run('car.speed')<0);assert(run('hazard.impact')>.5);
run('reset();state="running";const p=track[30],q=track[31];car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(q.y-p.y,q.x-p.x);car.speed=120;input.gas=true;update(.02)');const uphill=run('car.speed');
run('reset();state="running";const p=track[30],q=track[31];car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(p.y-q.y,p.x-q.x);car.speed=120;input.gas=true;update(.02)');assert(run('car.speed')>uphill);
console.log('PASS: continuous mountain wall collision and slower uphill acceleration than downhill');
for(const view of['first','chase','top'])for(const index of[0,20,60,100,140,180,220,239])run(`reset();state='running';selectView('${view}');car.x=track[${index}].x;car.y=track[${index}].y;car.z=track[${index}].z;draw()`);
run('selectMap("circuit");start();for(let j=0;j<3;j++)for(let k=1;k<=N;k++){car.x=track[k%N].x;car.y=track[k%N].y;car.speed=0;update(.02)}');assert.equal(run('state'),'finished');assert(storage.has('graybox-drive-best'));
run('selectMap("mountain")');assert.equal(run('state'),'ready');assert.equal(run('elapsed'),0);assert.equal(run('checkpointIndex'),0);assert.equal(run('activeMap.id'),'mountain');assert.equal(run('best'),Number(storage.get('graybox-drive-best-mountain')));
console.log('PASS: three views across the route, finite Canvas fallback, original circuit regression, map switch clears race and restores its own best');

run('selectMap("mountain");start()');
const trip=run(`(()=>{
 let maxOff=0,falls=0,impacts=0,previousFall=0;
 for(let step=0;step<12000&&state==='running';step++){
  const n=nearest(car.x,car.y),target=track[Math.min(N-1,n.index+3)];
  let angle=Math.atan2(target.y-car.y,target.x-car.x)-car.angle;
  angle=Math.atan2(Math.sin(angle),Math.cos(angle));
  input.left=angle<-.03;input.right=angle>.03;input.gas=car.speed<155;
  input.brake=car.speed>180||(Math.abs(angle)>.65&&car.speed>70);
  update(.02);maxOff=Math.max(maxOff,n.distance);
  if(hazard.fall>0&&!previousFall)falls++;previousFall=hazard.fall;
  if(hazard.impact>.7)impacts++;
 }
 return{state,elapsed,progress,checkpointIndex,maxOff,falls,impacts};
})()`);
assert.equal(trip.state,'finished');assert.equal(trip.falls,0);assert.equal(trip.impacts,0);assert(trip.maxOff<activeRoadHalf());
function activeRoadHalf(){return run('activeMap.roadHalf')}
console.log(`PASS: continuous physics-only summit drive: ${trip.elapsed.toFixed(2)} s, all checkpoints, zero impacts/falls, max centre offset ${trip.maxOff.toFixed(2)} units`);
