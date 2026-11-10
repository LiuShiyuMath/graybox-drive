// Bounded implementation checks for the operations abstracted in specs/*.tla.
// This uses the real runtime in a DOM stub; browser tests supply visual evidence.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const nodes=new Map(),storage=new Map();
function node(s){if(!nodes.has(s))nodes.set(s,{textContent:'',innerHTML:'',hidden:false,style:{},dataset:{},classList:{toggle(){},remove(){}},setAttribute(){},addEventListener(){},getBoundingClientRect:()=>({width:844,height:390}),getContext:()=>({setTransform(){}})});return nodes.get(s)}
const env={document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle(){}}}},window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},devicePixelRatio:1};
vm.createContext(env);
for(const file of ['maps.js','course-pack.js','course-world.js','racers.js','game.js','perspective.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),env);
const run=s=>vm.runInContext(s,env);
const sources=[['key:KeyW','gas'],['key:ArrowUp','gas'],['pointer:1','gas'],['pointer:2','gas'],['key:KeyA','left'],['key:ArrowLeft','left'],['key:KeyS','brake'],['key:KeyD','right']];
let transitions=0;
function check(held){const expected=new Set(held.map(([,action])=>action));for(const action of ['gas','left','brake','right'])assert.equal(run(`input.${action}`),expected.has(action));}
for(let mask=0;mask<1<<sources.length;mask++){
 const held=sources.filter((_,i)=>mask&(1<<i));
 for(const source of sources)for(const pressed of [true,false]){
  run('start();');for(const [id,action] of held)run(`setInputSource(${JSON.stringify(id)},${JSON.stringify(action)},true)`);
  run(`setInputSource(${JSON.stringify(source[0])},${JSON.stringify(source[1])},${pressed})`);
  check(pressed?[...held.filter(s=>s[0]!==source[0]),source]:held.filter(s=>s[0]!==source[0]));transitions++;
 }
}
for(const action of ['pause()','finish()','car.y=1030;update(.01)']){
 run('start();setInputSource("key:KeyW","gas",true);'+action);check([]);
 run('setInputSource("pointer:1","gas",true)');check([]);
}
run('start();car.y=1030;update(.01);pause()');let before=run('JSON.stringify([car.x,car.y,elapsed,hazard.fall,lap])');run('update(2)');assert.equal(run('JSON.stringify([car.x,car.y,elapsed,hazard.fall,lap])'),before);
run('start();recover()');assert.equal(run('hazard.fall'),0);const penaltyStart=run('elapsed');run('update(2)');assert.equal(run('elapsed'),penaltyStart+2);
for(const target of ['ready','running','paused','finished']){
 run(`reset();state=${JSON.stringify(target)};car.speed=77;elapsed=12`);before=run('JSON.stringify([car.x,car.y,car.speed,elapsed,lap,hazard])');
 for(const view of ['first','chase','top']){run(`selectView(${JSON.stringify(view)})`);assert.equal(run('JSON.stringify([car.x,car.y,car.speed,elapsed,lap,hazard])'),before)}
}
for(const time of [30,50,20]){run(`start();elapsed=${time};finish()`);assert.equal(run('best'),time===20?20:30)}
assert.equal(storage.get('graybox-drive-best'),'20');run('start()');assert.equal(run('best'),20);
console.log(`PASS: ${transitions} input-source transitions and race/hazard/view/storage model contracts`);
