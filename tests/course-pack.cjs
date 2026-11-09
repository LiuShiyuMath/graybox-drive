const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const DriveCourses=require('../dist/course-pack.js');

function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function cross(a,b,c){return(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)}
function intersects(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0}

assert.deepEqual(DriveCourses.ids,['proving','city','offroad']);
assert.equal(DriveCourses.create('mountain'),null);
assert.throws(()=>DriveCourses.create('city',1),RangeError);
const storageKeys=new Set();
for(const id of DriveCourses.ids) {
 const map=DriveCourses.create(id);
 assert.equal(map.track.length,240);
 assert.equal(map.laps,3);
 assert.equal(map.closed,true);
 assert.equal(map.mountain,false);
 assert.equal(map.generic,true);
 assert(map.length>3000);
 assert.equal(map.checkpoints.length,map.checkpointCount);
 assert(map.checkpoints.every((n,i)=>n>0&&n<240&&(!i||n>map.checkpoints[i-1])));
 assert(map.track.every(p=>[p.x,p.y,p.z,p.width,p.bank].every(Number.isFinite)&&p.width>=120&&Object.hasOwn(DriveCourses.materials,p.material)));
 const distances=map.track.map((p,i)=>distance(p,map.track[(i+1)%240]));
 assert(Math.max(...distances)/Math.min(...distances)<1.15,'even samples support stable checkpoint and nearest-road calculations');
 assert(distances.at(-1)<map.length/240*1.1,'closed loop has no finish/start gap');
 for(let i=0;i<240;i++)for(let j=i+2;j<240;j++) {
  if(i===0&&j===239)continue;
  assert(!intersects(map.track[i],map.track[(i+1)%240],map.track[j],map.track[(j+1)%240]),id+' has no accidental self-intersection');
 }
 const grade=map.track.map((p,i)=>Math.abs(map.track[(i+1)%240].z-p.z)/distances[i]);
 assert(Math.max(...grade)<.75,'slopes are physically driveable');
 assert.equal(storageKeys.has(map.bestKey),false);
 storageKeys.add(map.bestKey);
 assert(map.objects.every(o=>[o.x,o.y,o.z,o.w,o.d,o.h,o.angle].every(Number.isFinite)));
 const second=DriveCourses.create(id);
 map.track[0].x+=1;
 assert.notEqual(map.track[0].x,second.track[0].x,'new runs do not share mutable track state');
 console.log('PASS',id,'closed geometry, stable sampling, widths, materials, checkpoints and independent records');
}

const proving=DriveCourses.create('proving');
assert(new Set(proving.track.map(p=>p.material)).size===3);
assert(Math.max(...proving.track.map(p=>p.z))-Math.min(...proving.track.map(p=>p.z))>140);
assert(proving.guardrails.some(o=>o.side===1)&&proving.guardrails.some(o=>o.side===-1));
assert(proving.objects.some(o=>o.kind==='cone'));
console.log('PASS proving straight/turn/slope course with asphalt, grass, mud and both guardrails');

const city=DriveCourses.create('city');
assert.equal(city.intersections.length,2);
assert(city.crossRoads.every(r=>r.points.length>=2&&r.width>=120));
assert(city.intersections.every(j=>j.green>0&&j.green<j.period&&j.stopIndex>=0&&j.stopIndex<240));
for(const junction of city.intersections) {
 const sample=city.track[junction.index];
 assert(Math.hypot(sample.x-junction.x,sample.y-junction.y)<20,'cross street intersects the actual driving route');
 assert(city.guardrails.every(o=>Math.hypot(o.x-junction.x,o.y-junction.y)>junction.halfWidth),'junction has an open passage');
 const stops=Array.from({length:24},(_,time)=>(time+junction.offset)%junction.period<junction.green);
 assert(stops.some(Boolean)&&stops.some(v=>!v),'each signal has green and red phases');
}
assert(city.traffic.every(t=>t.points.length>=2&&t.speed>0&&t.pingPong));
assert(city.objects.filter(o=>o.kind==='building').length>=8);
console.log('PASS city roads connect to both intersections, signals alternate, junctions stay open and traffic routes are explicit');

const offroad=DriveCourses.create('offroad');
assert(new Set(offroad.track.map(p=>p.material)).size===3);
assert(offroad.objects.some(o=>o.kind==='rock'));
assert.equal(offroad.ramps.length,2);
assert(offroad.ramps.every(r=>r.launchSpeed>0&&r.span>0&&distance(r,offroad.track[r.index])<1));
assert.equal(offroad.collectibles.length,6);
assert(new Set(offroad.collectibles.map(c=>c.id)).size===6);
assert(offroad.collectibles.every(c=>distance(c,offroad.track[c.index])<c.radius));
assert(offroad.shortcuts.every(s=>s.to>s.from&&s.points.length>=3&&distance(s.points[0],offroad.track[s.from])<1&&distance(s.points.at(-1),offroad.track[s.to])<1));
console.log('PASS offroad rocks, terrain materials, usable ramp approaches, six reachable tokens and connected shortcut');

const context={};
vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../dist/course-pack.js'),'utf8'),context);
assert.equal(vm.runInContext('DriveCourses.create("city",120).track.length',context),120);
assert.equal(vm.runInContext('DriveCourses.ids.length',context),3);
console.log('PASS standalone browser global works without CommonJS or runtime dependencies');
