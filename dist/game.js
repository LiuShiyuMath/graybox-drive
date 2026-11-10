'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
const $=s=>document.querySelector(s),TAU=Math.PI*2,N=240;
let activeMap=DriveMaps.create('circuit',N),track=activeMap.track,obstacles=[];
let checkpointIndex=0,racers=DriveRacers.create(activeMap);
function edgeAt(index,offset,height=0){
 const i=activeMap.closed?((index%N)+N)%N:Math.max(0,Math.min(N-1,index)),p=track[i];
 if(activeMap.id==='circuit'){const a=Math.PI/2+i/N*TAU,nx=310*Math.cos(a),ny=560*Math.sin(a),len=Math.hypot(nx,ny);return[p.x+nx/len*offset,height,p.y+ny/len*offset]}
 const a=track[activeMap.closed?(i+N-1)%N:Math.max(0,i-1)],b=track[activeMap.closed?(i+1)%N:Math.min(N-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 return[p.x-dy/len*offset,p.z+height+(p.bank||0)*offset,p.y+dx/len*offset];
}
function makeObstacles(){
 if(activeMap.generic){obstacles=[];return}
 obstacles=activeMap.mountain?[]:[{x:575,y:550,w:110,d:70,h:60},{x:735,y:530,w:140,d:90,h:110},{x:900,y:550,w:130,d:70,h:45}];
 for(let i=activeMap.mountain?8:0;i<N;i+=activeMap.mountain?9:10){const p=edgeAt(i,activeMap.mountain?83:145);obstacles.push({x:p[0],y:p[2],z:p[1],w:7,d:7,h:activeMap.mountain?17:25})}
}
makeObstacles();
let hazard={kind:'road',impact:0,cooldown:0,fall:0,dust:0};
const input={left:false,right:false,gas:false,brake:false};
const inputSources=new Map();
let car,state='ready',elapsed=0,lap=1,progress=0,lastIndex=0,best=null,previous=0,w=0,h=0,zoom=1,camera={x:750,y:500},skids=[],particles=[],toastTimer;
try{best=Number(localStorage.getItem('graybox-drive-best'))||null}catch{}
function format(t){return `${String(Math.floor(t/60)).padStart(2,'0')}:${(t%60).toFixed(2).padStart(5,'0')}`}
if(best)$('#best').textContent=format(best);
function setInputSource(source,action,pressed){if(pressed){if(state!=='running'||hazard.fall)return;inputSources.set(source,action)}else inputSources.delete(source);Object.keys(input).forEach(k=>input[k]=false);for(const key of inputSources.values())input[key]=true;for(const b of document.querySelectorAll('[data-key]'))b.classList.toggle('pressed',input[b.dataset.key])}
function clearInput(){inputSources.clear();Object.keys(input).forEach(k=>input[k]=false);document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'))}
function reset(){racers=DriveRacers.create(activeMap);if(typeof resetCourseWorld==='function')resetCourseWorld();hazard={kind:'road',impact:0,cooldown:0,fall:0,dust:0};clearTimeout(toastTimer);$('#toast').style.display='none';const spawn=track[0],next=track[1];car={x:spawn.x,y:spawn.y,z:spawn.z,angle:Math.atan2(next.y-spawn.y,next.x-spawn.x),speed:0,steer:0};if(activeMap.id==='circuit')car.angle=Math.PI;checkpointIndex=0;elapsed=0;lap=1;progress=0;lastIndex=0;skids=[];particles=[];clearInput();camera={x:car.x,y:car.y};$('#lap').innerHTML='1 <em>/ 3</em>';$('#time').textContent=format(0);$('#pause').textContent='Ⅱ';updateRaceHUD();updateFeedback();}
function show(title,body,button){if(state==='ready')body+='<br><span class="team-note">2 对 2 · 你与蓝队友，对抗两辆红色对手。</span>';if(state==='finished'){const score=DriveRacers.standings(racers,{progress}).teamScores;body+=`<br><span class="team-note">玩家完赛时积分 · 蓝队 ${score.blue} : ${score.red} 红队</span>`;}$('#overlay h1').innerHTML=title;$('#overlay p').innerHTML=body;$('#start').innerHTML=button+' <span>↗</span>';$('#overlay').hidden=false}
function start(){if(state==='paused'){state='running'}else{reset();state='running'}$('#overlay').hidden=true;$('#pause').textContent='Ⅱ';}
function pause(){if(state==='running'){state='paused';clearInput();show('先歇一会儿。','计时已暂停。准备好后继续这圈。','继续驾驶');$('#pause').textContent='▶'}else if(state==='paused')start()}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').style.display='none',2000)}
function nearest(x,y){
 if(activeMap.id==='circuit'){let best=Infinity,index=0;for(let i=0;i<N;i++){const p=track[i],d=(p.x-x)**2+(p.y-y)**2;if(d<best){best=d;index=i}}return{index,distance:Math.sqrt(best),elevation:0,grade:0}}
 let best=Infinity,result;
 for(let i=0;i<(activeMap.closed?N:N-1);i++){
  const p=track[i],q=track[(i+1)%N],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((x-p.x)*dx+(y-p.y)*dy)/(len*len)));
  const px=p.x+dx*t,py=p.y+dy*t,d=(x-px)**2+(y-py)**2;
  if(d<best){best=d;result={index:activeMap.closed?Math.round(i+t)%N:Math.round(i+t),segment:i,t,x:px,y:py,distance:Math.sqrt(d),signed:((x-px)*-dy+(y-py)*dx)/len,nx:-dy/len,ny:dx/len,elevation:p.z+(q.z-p.z)*t,grade:(q.z-p.z)/len,tx:dx/len,ty:dy/len}}
 }
 if(activeMap.generic){result.elevation+=result.signed*(track[result.index].bank||0);result.terrain=courseTerrain(x,y,result);if(result.terrain){const {elevation,grade,tx,ty}=result.terrain;Object.assign(result,{elevation,grade,tx,ty})}}
 return result;
}
function updateRaceHUD(){
 updateTeamHUD();
 $('#race-label').textContent=activeMap.mountain?'路程 ROUTE':'圈数 LAP';
 $('#lap').innerHTML=activeMap.mountain?`${Math.min(100,Math.floor(Math.max(0,progress)/(N-3)*100))}<em>%</em>`:`${Math.min(lap,3)} <em>/ 3</em>`;
 if(activeMap.mountain){const n=nearest(car.x,car.y);$('#route-hud').textContent=`爬升 ${Math.round((car.z||0)*.1)} m · 坡度 ${Math.round(n.grade*100)}% · CP ${Math.floor(checkpointIndex/40)} / 5`}
 else $('#route-hud').textContent=activeMap.generic?courseDetails():'3 圈计时 · 黄黑边缘外可掉落';
}
function recover(penalty=3){
 if(state!=='running')return;
 const n=nearest(car.x,car.y),index=activeMap.mountain||activeMap.generic?checkpointIndex:n.index,p=track[index],q=track[activeMap.closed?(index+1)%N:Math.min(index+1,N-1)];
 car.x=p.x;car.y=p.y;car.z=p.z;car.angle=Math.atan2(q.y-p.y,q.x-p.x);car.speed=0;car.steer=0;lastIndex=index;
 if(activeMap.mountain)progress=index;
 if(activeMap.generic){progress=(lap-1)*N+index;courseState.jump={height:0,velocity:0};courseState.slip=0}
 elapsed+=penalty;hazard.fall=0;hazard.impact=0;hazard.kind='road';hazard.dust=0;clearInput();$('#time').textContent=format(elapsed);updateRaceHUD();updateFeedback();toast(`已回到${activeMap.mountain?'检查点':'赛道'} · 用时 +${penalty} 秒`);
}
function finish(){DriveRacers.finishPlayer(racers);state='finished';clearInput();if(!best||elapsed<best){best=elapsed;try{localStorage.setItem(activeMap.bestKey,best)}catch{}$('#best').textContent=format(best)}show(activeMap.generic?`${activeMap.name}完成。<br>再挑战一次？`:activeMap.mountain?'抵达山顶。<br>这条路，你征服了。':'三圈完成。<br>再快一点？',`本次用时 <b style="color:#d2fa60">${format(elapsed)}</b><br>最佳成绩 ${format(best)}。${activeMap.generic?(activeMap.id==='city'?`红灯越线 ${courseState.violations} 次。挑战遵守信号完成。`:activeMap.id==='offroad'?`收集 ${courseState.collected.size} / ${activeMap.collectibles.length}。再探索另一条路线。`:'三种路面与坡道测试完成。'):activeMap.mountain?'爬升 102 m · 再挑战一次无掉落登顶。':'试试入弯前刹车，出弯再加速。'}`,'再跑一次')}
$('#start').onclick=start;$('#pause').onclick=pause;$('#reset').onclick=()=>{reset();state='running';$('#overlay').hidden=true};$('#recover').onclick=()=>recover();
const codeMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'gas',KeyW:'gas',ArrowDown:'brake',KeyS:'brake',Space:'brake'};
window.addEventListener('keydown',e=>{if(codeMap[e.code]){e.preventDefault();setInputSource(`key:${e.code}`,codeMap[e.code],true)}if(e.code==='Escape'&&!e.repeat)pause();if(e.code==='KeyR'&&!e.repeat)recover()});window.addEventListener('keyup',e=>{if(codeMap[e.code])setInputSource(`key:${e.code}`,codeMap[e.code],false)});
for(const b of document.querySelectorAll('[data-key]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(state!=='running'||hazard.fall)return;b.setPointerCapture(e.pointerId);setInputSource(`pointer:${e.pointerId}`,b.dataset.key,true)});const release=e=>setInputSource(`pointer:${e.pointerId}`,b.dataset.key,false);b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release)}
window.addEventListener('blur',()=>{clearInput();if(state==='running')pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(state==='running')pause()}});
function resize(){const r=canvas.getBoundingClientRect();w=r.width;h=r.height;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);zoom=Math.max(.7,Math.min(1.1,w/950));}window.addEventListener('resize',resize);
function update(dt){if(state!=='running')return;elapsed+=dt;updateRacers(dt);hazard.impact=Math.max(0,hazard.impact-dt*.55);hazard.cooldown=Math.max(0,hazard.cooldown-dt);if(hazard.fall>0){hazard.fall+=dt;car.speed*=Math.exp(-dt*2);car.x+=Math.cos(car.angle)*car.speed*dt;car.y+=Math.sin(car.angle)*car.speed*dt;if(hazard.fall>1.5)recover(5);updateFeedback();$('#time').textContent=format(elapsed);return;}let n=nearest(car.x,car.y),off=n.distance>activeMap.roadHalf;let steer=(+input.right)-(+input.left);car.steer+=(steer-car.steer)*Math.min(1,dt*9);if(input.gas)car.speed+=200*dt;if((activeMap.mountain||activeMap.generic)&&Math.abs(car.speed)>1)car.speed-=n.grade*(Math.cos(car.angle)*n.tx+Math.sin(car.angle)*n.ty)*280*dt;if(input.brake)car.speed-=car.speed>8?350*dt:95*dt;const material=activeMap.generic?courseSurface(n):null;if(material)off=n.distance>material.width;car.speed*=Math.exp(-(material?material.friction:off?2.2:.35)*dt);car.speed=Math.max(-100,Math.min(material?material.maxSpeed:off?155:activeMap.mountain?340:420,car.speed));car.angle+=car.steer*car.speed/155*dt/(1+Math.abs(car.speed)/650);let ox=car.x,oy=car.y;car.x+=Math.cos(car.angle)*car.speed*dt;car.y+=Math.sin(car.angle)*car.speed*dt;
if(activeMap.id==='circuit'){car.x=Math.max(-600,Math.min(2100,car.x));car.y=Math.max(-500,Math.min(1500,car.y))}if(Math.abs(car.speed)>140&&(Math.abs(car.steer)>.5||input.brake)){skids.push({x:ox,y:oy,a:car.angle});if(skids.length>650)skids.shift()}
if(activeMap.generic)updateCoursePhysics(dt,n);resolveCollisions();if(activeMap.generic)resolveCourseCollisions();n=nearest(car.x,car.y);
if(activeMap.mountain&&n.signed < -72){
 car.x=n.x+n.nx*-72;car.y=n.y+n.ny*-72;
 const incoming=(Math.cos(car.angle)*n.nx+Math.sin(car.angle)*n.ny)*car.speed;
 if(incoming<0){const impactSpeed=Math.abs(car.speed);car.speed*=-.24;if(impactSpeed>20&&hazard.cooldown<=0){hazard.impact=.8;hazard.cooldown=.8;toast('撞到山壁 · 减速调整方向')}}
 n=nearest(car.x,car.y);
}
car.z=n.elevation+(activeMap.generic?courseState.jump.height:0);
const outer=activeMap.generic?false:activeMap.mountain?n.signed>0:((car.x-750)/560)**2+((car.y-500)/310)**2>1;
const physical=activeMap.generic?courseSurface(n):null,roadWidth=physical?physical.width:activeMap.roadHalf;
hazard.kind=physical&&n.terrain?'road':n.distance>activeMap.edge&&outer?'edge':n.distance>(activeMap.generic?roadWidth+20:activeMap.curb)?'runoff':n.distance>roadWidth?'curb':'road';
hazard.dust+=((physical?Number(['mud','gravel'].includes(physical.name)||hazard.kind==='runoff'):Number(n.distance>activeMap.curb))*Math.min(Math.abs(car.speed)/80,1)-hazard.dust)*Math.min(1,dt*4);
if(n.distance>activeMap.fall&&outer){hazard.fall=.001;hazard.kind='fall';clearInput();toast('车辆掉落 · 即将回赛道 +5 秒')}
const previousIndex=lastIndex;let delta=n.index-lastIndex;if(activeMap.closed){if(delta>N/2)delta-=N;if(delta<-N/2)delta+=N}
if(Math.abs(delta)<15&&(activeMap.generic?courseSurface(n).onRoute:n.distance<=(activeMap.mountain?67:110))&&!hazard.fall)progress+=delta;
lastIndex=n.index;
if(activeMap.generic)updateCourseRace(n,delta,previousIndex,{x:ox,y:oy});
else if(activeMap.mountain){
 const checkpoint=Math.min(200,Math.floor(Math.max(0,progress)/40)*40);
 if(checkpoint>checkpointIndex&&n.distance<=67){checkpointIndex=checkpoint;toast(`检查点 ${checkpointIndex/40} / 5 · 继续登顶`)}
 if(progress>=N-3&&n.index>=N-3&&checkpointIndex===200&&!hazard.fall&&n.distance<=67)finish();
}else if(progress>=N*lap){if(lap===3)finish();else{lap++;toast(`第 ${lap} 圈 · 保持节奏`)}}
updateRaceHUD();
$('#time').textContent=format(elapsed);$('#speed').textContent=Math.round(Math.abs(car.speed)*.36);updateFeedback();
}
function path(){ctx.beginPath();track.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(activeMap.closed)ctx.closePath()}
function line(color,width,dash=[]){path();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([])}
function box(x,y,bw,bh,height){ctx.fillStyle='#626e70';ctx.fillRect(x+6,y+10,bw,bh);ctx.fillStyle='#8c9798';ctx.fillRect(x,y-height,bw,bh);ctx.fillStyle='#6d787a';ctx.fillRect(x,y-height+bh,bw,height);ctx.strokeStyle='#c0c7c5';ctx.lineWidth=1;ctx.strokeRect(x,y-height,bw,bh)}
function drawCar(x,y,a,scale=1,color='#d2fa60'){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.scale(scale,scale);ctx.fillStyle='#25342b55';ctx.fillRect(-19,-9,44,23);ctx.fillStyle='#25312d';for(const xx of[-12,11])for(const yy of[-12,8])ctx.fillRect(xx,yy,9,5);ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(-22,-11,44,22,5);ctx.fill();ctx.fillStyle='#586d53';ctx.fillRect(-6,-8,13,16);ctx.fillStyle='#314a42';ctx.fillRect(6,-8,5,16);ctx.fillStyle='#f4ffd4';ctx.fillRect(17,-10,3,5);ctx.fillRect(17,5,3,5);ctx.fillStyle='#e66c56';ctx.fillRect(-22,-9,2,5);ctx.fillRect(-22,4,2,5);ctx.restore()}
function drawTop(){if(activeMap.generic){drawCourseTop();return}if(activeMap.mountain){drawMountainTop();return}ctx.clearRect(0,0,w,h);ctx.fillStyle='#a4adaa';ctx.fillRect(0,0,w,h);let target=state==='ready'?{x:750,y:500}:car;camera.x+=(target.x-camera.x)*.08;camera.y+=(target.y-camera.y)*.08;let z=state==='ready'?Math.min(w/1550,h/1000):zoom;ctx.save();ctx.translate(w/2,h*.49);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);
ctx.strokeStyle='#929f9955';ctx.lineWidth=1;for(let x=-200;x<1800;x+=60){ctx.beginPath();ctx.moveTo(x,-300);ctx.lineTo(x,1300);ctx.stroke()}for(let y=-300;y<1300;y+=60){ctx.beginPath();ctx.moveTo(-200,y);ctx.lineTo(1800,y);ctx.stroke()}
line('#293b38',620);line('#a4adaa',420);line('#cfad59',424,[8,12]);line('#a4adaa',416);line('#64716b',216);line('#c5cbc6',204);line('#596360',184);line('#d9dfd4',3,[20,22]);
for(let i=0;i<N;i+=3){const p=track[i],a=Math.PI/2+i/N*TAU;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(310*Math.cos(a),-560*Math.sin(a)));ctx.fillStyle=(i/3)%2?'#dbdfd8':'#738078';ctx.fillRect(-9,-103,18,10);ctx.fillRect(-9,93,18,10);ctx.restore()}
ctx.fillStyle='#809088';ctx.fillRect(470,390,560,200);ctx.strokeStyle='#bdc8bd';ctx.strokeRect(480,400,540,180);ctx.fillStyle='#a4b0a7';ctx.font='bold 58px monospace';ctx.fillText('GRAYBOX',500,470);ctx.font='16px monospace';ctx.fillText('PROVING GROUND / 001',503,505);for(const o of obstacles)box(o.x-o.w/2,o.y-o.d/2,o.w,o.d,o.h*.35);
for(let i=0;i<12;i++){ctx.fillStyle=i%2?'#e5e9df':'#303c35';ctx.fillRect(740+(i%2)*10,710+Math.floor(i/2)*33,10,33)}ctx.fillStyle='#d2fa60';ctx.font='bold 15px monospace';ctx.fillText('← START / FINISH',780,905);
ctx.fillStyle='#d4dbcd';for(const [x,y,a] of [[450,792,Math.PI],[190,430,-Math.PI/2],[1000,220,0],[1305,550,Math.PI/2]]){ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-10,-10);ctx.lineTo(-6,0);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();ctx.restore()}
ctx.fillStyle='#24332b33';for(const s of skids){ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a);ctx.fillRect(-3,-10,6,2);ctx.fillRect(-3,8,6,2);ctx.restore()}drawRacersTop();drawCar(car.x,car.y,car.angle);ctx.restore();
if(state!=='ready'){const mw=Math.min(150,w*.22),mh=mw*2/3,mx=18,my=48;ctx.save();ctx.translate(mx,my);ctx.fillStyle='#1c2b25c9';ctx.beginPath();ctx.roundRect(0,0,mw,mh,7);ctx.fill();ctx.scale(mw/1500,mh/1000);line('#abb8a2',45);drawRacerMarkers(26);ctx.fillStyle='#d2fa60';ctx.beginPath();ctx.arc(car.x,car.y,30,0,TAU);ctx.fill();ctx.restore()}}
function draw(){ctx.save();const bump=hazard.impact*9+(hazard.kind==='curb'?Math.min(Math.abs(car.speed)/90,2):0)+(hazard.kind==='runoff'?Math.min(Math.abs(car.speed)/150,1.5):0);ctx.translate(Math.sin(elapsed*62)*bump,Math.cos(elapsed*83)*bump*.6);if(typeof viewMode==='undefined'||viewMode==='top'||(state==='ready'&&activeMap.id==='circuit'))drawTop();else{drawPerspective();drawMinimap()}ctx.restore();drawHazardEffects()}
function frame(t){let remaining=previous?Math.min((t-previous)/1000,1):0;previous=t;while(remaining>0){const step=Math.min(remaining,.02);update(step);remaining-=step}draw();requestAnimationFrame(frame)}reset();resize();
// Drawing depends on perspective.js, the next ordinary script in index.html.
// A frame may run while that script is still downloading. Start once all scripts are ready.
document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(frame),{once:true});
// Read-only state for checking the running game without altering race results.
window.gameSnapshot=()=>({hazard:{...hazard},view:typeof viewMode==='undefined'?'top':viewMode,state,lap,elapsed,progress,speed:car.speed,x:car.x,y:car.y,elevation:car.z,map:activeMap.id,checkpoint:checkpointIndex,racers:DriveRacers.snapshot(racers,{progress,state}),input:{...input},course:activeMap.generic?{checkpoint:courseState.nextCheckpoint,collected:courseState.collected.size,jump:{...courseState.jump},slip:courseState.slip,violations:courseState.violations,traffic:courseState.traffic.map(v=>({...sampleTraffic(v.route,v.distance),speed:v.speed}))}:null});
function resolveCollisions(){
for(const o of obstacles){const px=Math.max(o.x-o.w/2,Math.min(o.x+o.w/2,car.x)),py=Math.max(o.y-o.d/2,Math.min(o.y+o.d/2,car.y));let dx=car.x-px,dy=car.y-py,d=Math.hypot(dx,dy);if(d>=15)continue;
if(d<.001){const sides=[{v:Math.abs(car.x-(o.x-o.w/2)),x:-1,y:0},{v:Math.abs(car.x-(o.x+o.w/2)),x:1,y:0},{v:Math.abs(car.y-(o.y-o.d/2)),x:0,y:-1},{v:Math.abs(car.y-(o.y+o.d/2)),x:0,y:1}].sort((a,b)=>a.v-b.v);dx=sides[0].x;dy=sides[0].y;car.x+=dx*(sides[0].v+15);car.y+=dy*(sides[0].v+15);d=1}else{car.x+=dx/d*(15-d+.5);car.y+=dy/d*(15-d+.5)}
const incoming=(Math.cos(car.angle)*dx+Math.sin(car.angle)*dy)*car.speed;if(incoming<0){const impactSpeed=Math.abs(car.speed);car.speed=-car.speed*.24;if(hazard.cooldown<=0&&impactSpeed>20){hazard.impact=Math.max(.65,Math.min(1,impactSpeed/180));hazard.cooldown=.8;toast('撞击！车辆反弹 · 松油调整方向')}}
}}
function updateFeedback(){const kind=hazard.fall?'fall':hazard.impact>.1?'impact':hazard.kind;const labels={road:['柏油路面',''],curb:['压到路肩','轮胎颠簸 · 向赛道内侧修正'],runoff:['驶出赛道','抓地力下降 · 正在减速'],edge:[activeMap.mountain?'悬崖边缘 · 危险':'前方是落差区','立即刹车，向赛道内侧转向'],impact:['发生撞击','车辆已反弹 · 松油调整方向'],fall:['车辆掉落','自动回赛道 · 加时 5 秒']};const [title,detail]=labels[kind]||labels.road;$('#surface').textContent=kind==='road'&&activeMap.generic?(courseState.jump.height?'车辆腾空':courseSurface(nearest(car.x,car.y)).label):title;$('#feedback').hidden=kind==='road';$('#feedback').dataset.kind=kind;$('#feedback-title').textContent=title;$('#feedback-detail').textContent=detail;$('#speed').textContent=Math.round(Math.abs(car.speed)*.36)}
function drawHazardEffects(){
if(hazard.dust>.05&&!hazard.fall){ctx.fillStyle=`rgba(163,133,80,${hazard.dust*.13})`;ctx.fillRect(0,0,w,h);ctx.fillStyle=`rgba(219,195,143,${hazard.dust*.28})`;for(let i=0;i<15;i++){const x=(i*173+elapsed*(30+i*3))%w,y=h*.5+((i*79+elapsed*70)%(h*.5));ctx.beginPath();ctx.arc(x,y,2+i%4,0,TAU);ctx.fill()}}
if(hazard.impact>.05){ctx.fillStyle=`rgba(244,98,57,${hazard.impact*.25})`;ctx.fillRect(0,0,w,h)}
if(hazard.kind==='edge'){ctx.strokeStyle=`rgba(255,177,57,${.5+.3*Math.sin(elapsed*9)})`;ctx.lineWidth=14;ctx.strokeRect(7,7,w-14,h-14)}
if(hazard.fall){ctx.fillStyle=`rgba(12,22,20,${Math.min(.9,hazard.fall*.65)})`;ctx.fillRect(0,0,w,h)}
}

function selectMap(id){
 activeMap=typeof createMap==='function'?createMap(id):DriveMaps.create(id,N);track=activeMap.track;makeObstacles();
 try{best=Number(localStorage.getItem(activeMap.bestKey))||null;localStorage.setItem('graybox-drive-map',activeMap.id)}catch{best=null}
 $('#best').textContent=best?format(best):'—';
 reset();state='ready';
 const mountain=activeMap.mountain;
 show(mountain?'沿着弯道，<br>向山顶出发。':'给简单的方块，<br>一点速度。',mountain?`连续 S 弯 · ${Math.round(activeMap.length*.1)} m 山路 · 爬升 102 m。<br>入弯前刹车。右侧临崖，越过边缘会掉落。<br>通过检查点后，掉落可回到该处 +5 秒。`:'一辆车，一条赛道。完成 3 圈计时挑战。<br>驶出路面会减速，碰撞会反弹。<br>外侧黄黑边缘是落差区，掉落后自动回赛道 +5 秒。','开始驾驶');
 if(activeMap.generic)show(`${activeMap.name}，<br>出发。`,`${activeMap.description}<br>${activeMap.instructions}`,'开始驾驶');
 $('#map-title').textContent=`MAP ${activeMap.number} · ${activeMap.title}`;
 $('#map-label').textContent=`${activeMap.number} / ${activeMap.title.toUpperCase()}`;
 $('#map-eyebrow').textContent=activeMap.generic?activeMap.mission:mountain?'FROM THE VALLEY TO THE SUMMIT':'YOUR FIRST GRAYBOX LAP';
 for(const button of document.querySelectorAll('[data-map]'))button.setAttribute('aria-pressed',String(button.dataset.map===activeMap.id));
 if(typeof rebuildRoadMesh==='function')rebuildRoadMesh();
}
for(const b of document.querySelectorAll('[data-map]'))b.onclick=()=>selectMap(b.dataset.map);
$('#map-menu').onclick=()=>{if(state==='running')pause();else if(state==='ready')$('#overlay').hidden=false;else if(state==='finished')selectMap(activeMap.id)};
let initialMap='circuit';
try{const requested=new URLSearchParams(window.location.search).get('map');initialMap=requested==='mountain'||requested==='02'?'mountain':requested==='circuit'||requested==='01'?'circuit':typeof DriveCourses!=='undefined'&&DriveCourses.ids.includes(requested)?requested:localStorage.getItem('graybox-drive-map')||'circuit'}catch{}
selectMap(initialMap);
function drawMountainTop(){
 ctx.fillStyle='#718b80';ctx.fillRect(0,0,w,h);
 const overview=state==='ready',b=activeMap.bounds,target=overview?{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}:car;
 camera.x+=(target.x-camera.x)*.15;camera.y+=(target.y-camera.y)*.15;
 const z=overview?Math.min(w/(b.maxX-b.minX+700),h/(b.maxY-b.minY+500)):zoom*.9;
 ctx.save();ctx.translate(w/2,h*.47);ctx.scale(z,z);ctx.translate(-camera.x,-camera.y);
 line('#506e65',900);line('#a0a291',350);line('#b8b7a4',160);
 for(let i=0;i<N-1;i+=2){const j=Math.min(i+2,N-1),a=edgeAt(i,96),b=edgeAt(j,96),c=edgeAt(j,400),d=edgeAt(i,400);ctx.fillStyle=i%4?'#3d625d':'#456d64';ctx.beginPath();[a,b,c,d].forEach((p,k)=>k?ctx.lineTo(p[0],p[2]):ctx.moveTo(p[0],p[2]));ctx.fill();const l=edgeAt(i,-120);ctx.fillStyle='#8c9183';ctx.beginPath();ctx.arc(l[0],l[2],60+i%25,0,TAU);ctx.fill()}
 line('#c9bb91',144);line('#e9ddbc',128);line('#53645e',114);line('#ecd190',2.5,[14,16]);
 for(let i=0;i<N;i+=6){const p=edgeAt(i,91);ctx.fillStyle='#efbd55';ctx.beginPath();ctx.arc(p[0],p[2],3,0,TAU);ctx.fill()}
 for(const index of[0,40,80,120,160,200,N-1]){const p=track[index],q=track[Math.min(N-1,index+1)];ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(q.y-p.y,q.x-p.x));ctx.fillStyle=index===N-1?'#f4d98a':'#d2fa60';ctx.fillRect(-4,-57,8,114);ctx.font='bold 15px monospace';ctx.fillText(index===0?'START':index===N-1?'SUMMIT':`CP ${index/40}`,15,-76);ctx.restore()}
 for(const o of obstacles){ctx.fillStyle='#e8c66a';ctx.fillRect(o.x-4,o.y-4,8,8)}
 drawRacersTop();drawCar(car.x,car.y,car.angle,Math.max(.15,1-hazard.fall*.4));ctx.restore();if(!overview)drawMinimap();
}

function updateRacers(dt){
 const traffic=activeMap.generic?courseState.traffic.map(v=>({...sampleTraffic(v.route,v.distance),speed:v.speed})):[];
 DriveRacers.step(racers,dt,{state,player:car,playerProgress:progress,playerLap:lap,
  playerFalling:!!hazard.fall,signalTime:elapsed,traffic,
  obstacles:[...obstacles,...(activeMap.objects||[])]});
 if(racers.lastImpact>20&&hazard.cooldown<=0){
  hazard.impact=Math.max(.65,Math.min(1,racers.lastImpact/180));hazard.cooldown=.8;
  toast('车辆接触 · 减速调整方向');
 }
}
function updateTeamHUD(){
 const result=DriveRacers.standings(racers,{progress,state});
 $('#team-rank').textContent=`你 ${result.playerRank} / 4`;
 $('#team-score').textContent=`当前队伍积分 · 蓝 ${result.teamScores.blue} : ${result.teamScores.red} 红`;
 const names={player:'你',ally:'蓝队友','rival-1':'红 1','rival-2':'红 2'};
 $('#team-order').textContent=result.rows.map(row=>`${row.rank}.${names[row.id]}`).join('  ');
 const ally=racers.actors[0],labels={race:'跟随路线',yield:'为你让行',pass:'超车',brake:'减速避让'};
 $('#team-intent').textContent=`蓝队友 · ${ally.phase==='recovering'?'恢复中':ally.phase==='finished'?'已完赛':labels[ally.intent]}`;
}
function drawRacersTop(){
 for(const actor of racers.actors){
  drawRacerCar(actor);
  ctx.fillStyle='#f2f5ee';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
  ctx.fillText(actor.role==='teammate'?'友':actor.id==='rival-1'?'1':'2',actor.x,actor.y-21);ctx.textAlign='start';
 }
}
function drawRacerCar(actor){
 ctx.save();ctx.translate(actor.x,actor.y);ctx.rotate(actor.angle);
 const scale=actor.phase==='recovering'?.7:1;ctx.scale(scale,scale);
 ctx.fillStyle='#24352e';for(const x of[-13,10])for(const y of[-13,9])ctx.fillRect(x,y,9,5);
 ctx.fillStyle=DriveRacers.palettes[actor.team][0];ctx.beginPath();ctx.roundRect(-20,-11,40,22,4);ctx.fill();
 ctx.fillStyle='#314e58';ctx.fillRect(-7,-8,18,16);ctx.fillStyle='#e8f5ed';ctx.fillRect(17,-8,2,5);ctx.fillRect(17,3,2,5);ctx.restore();
}
function drawRacerMarkers(radius){
 for(const actor of racers.actors){ctx.fillStyle=DriveRacers.palettes[actor.team][0];ctx.beginPath();ctx.arc(actor.x,actor.y,radius,0,TAU);ctx.fill()}
}
function racerMesh(){
 const faces=[];
 for(const actor of racers.actors){
  const palette=DriveRacers.palettes[actor.team],fx=Math.cos(actor.angle),fy=Math.sin(actor.angle);
  const n=DriveRacers.nearest(racers,actor.x,actor.y),grade=n.grade*Math.cos(actor.angle-n.angle);
  const mesh=[...cuboidMesh(actor.x,actor.y,40,22,12,palette,actor.angle,actor.z+1.5),
   ...cuboidMesh(actor.x-fx*3,actor.y-fy*3,18,18,8,['#526c74','#314e58','#48636c'],actor.angle,actor.z+13.5)];
  for(const face of mesh)face.vertices=face.vertices.map(([x,y,z])=>[x,y+((x-actor.x)*fx+(z-actor.y)*fy)*grade,z]);
  faces.push(...mesh);
 }
 return faces;
}
