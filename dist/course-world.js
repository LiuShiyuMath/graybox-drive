'use strict';

let courseState;

function createMap(id) {
 return (typeof DriveCourses!=='undefined'&&DriveCourses.create(id,N))||DriveMaps.create(id,N);
}

function resetCourseWorld() {
 courseState={nextCheckpoint:0,collected:new Set(),jump:{height:0,velocity:0},ramp:null,
  violations:0,traffic:[],slip:0};
 if(!activeMap.generic)return;
 for(const route of activeMap.traffic||[])courseState.traffic.push({route,distance:route.offset||0,speed:route.speed});
}

function nearestCoursePath(x,y,path) {
 let result=null;
 for(let i=0;i<path.points.length-1;i++){
  const a=path.points[i],b=path.points[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(len*len)));
  const distance=Math.hypot(x-a.x-dx*t,y-a.y-dy*t);
  if(!result||distance<result.distance)result={distance,elevation:(a.z||0)+((b.z||0)-(a.z||0))*t,grade:((b.z||0)-(a.z||0))/len,tx:dx/len,ty:dy/len,path};
 }
 return result;
}

function courseTerrain(x,y,sample) {
 let nearest=null;
 for(const path of[...(activeMap.shortcuts||[]),...(activeMap.crossRoads||[])]){
  const candidate=nearestCoursePath(x,y,path);
  if(candidate.distance<=path.width/2&&candidate.distance<sample.distance&&(!nearest||candidate.distance<nearest.distance))nearest=candidate;
 }
 return nearest;
}

function courseSurface(sample) {
 const width=(track[sample.index].width||activeMap.roadHalf*2)/2;
 const path=sample.terrain&&sample.terrain.path;
 const shortcut=!!path&&(activeMap.shortcuts||[]).includes(path);
 const name=path?path.material:sample.distance>width?'grass':track[sample.index].material||'asphalt';
 return {...DriveCourses.materials[name],name,width,onRoute:sample.distance<=width+5||shortcut,shortcut};
}

function courseSignal(signal,time=elapsed) {
 const phase=((time+signal.offset)%signal.period+signal.period)%signal.period;
 return phase<signal.green?'green':phase<signal.green+1?'amber':'red';
}

function sampleTraffic(route,distance) {
 const segments=route.points.slice(1).map((p,i)=>Math.hypot(p.x-route.points[i].x,p.y-route.points[i].y));
 const length=segments.reduce((a,b)=>a+b,0);
 let d=((distance%(length*2))+length*2)%(length*2),reverse=d>length;
 if(reverse)d=2*length-d;
 let i=0;
 while(i<segments.length-1&&d>segments[i])d-=segments[i++];
 const a=route.points[i],b=route.points[i+1],t=Math.min(1,d/segments[i]);
 return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:(a.z||0)+((b.z||0)-(a.z||0))*t,
  angle:Math.atan2(b.y-a.y,b.x-a.x)+(reverse?Math.PI:0)};
}

function updateCourseTraffic(dt) {
 for(const vehicle of courseState.traffic){
  const pose=sampleTraffic(vehicle.route,vehicle.distance);
  let stop=false;
  for(const signal of activeMap.intersections||[]){
   const forward=(signal.x-pose.x)*Math.cos(pose.angle)+(signal.y-pose.y)*Math.sin(pose.angle);
   const lateral=Math.abs((signal.x-pose.x)*-Math.sin(pose.angle)+(signal.y-pose.y)*Math.cos(pose.angle));
   if(lateral<signal.halfWidth&&forward>signal.halfWidth+25&&forward<signal.halfWidth+90&&courseSignal(signal)!=='red')stop=true;
  }
  vehicle.speed=stop?0:vehicle.route.speed;
  vehicle.distance+=vehicle.speed*dt;
 }
}

function updateCoursePhysics(dt,sample) {
 const surface=courseSurface(sample);
 const desired=Math.abs(car.speed)>110?car.steer*car.speed*(1-surface.grip)*.22:0;
 courseState.slip+=(desired-courseState.slip)*Math.min(1,dt*4);
 car.x-=Math.sin(car.angle)*courseState.slip*dt;
 car.y+=Math.cos(car.angle)*courseState.slip*dt;
 const jump=courseState.jump;
 if(jump.height>0||jump.velocity>0){
  jump.velocity-=190*dt;
  jump.height+=jump.velocity*dt;
  if(jump.height<=0){jump.height=0;jump.velocity=0;toast('落地 · 稳住方向')}
 }
 if(!jump.height){
  for(const ramp of activeMap.ramps||[]){
   const d=Math.hypot(car.x-ramp.x,car.y-ramp.y);
   const aligned=Math.cos(car.angle-ramp.angle)>.7;
   if(d<ramp.span*.5&&car.speed>=ramp.launchSpeed&&aligned&&courseState.ramp!==ramp.index){
    jump.height=.1;jump.velocity=110;courseState.ramp=ramp.index;toast('飞跃！落地前保持方向');break;
   }
  }
  if(!(activeMap.ramps||[]).some(r=>Math.hypot(car.x-r.x,car.y-r.y)<r.span))courseState.ramp=null;
 }
 for(const item of activeMap.collectibles||[]){
  if(!courseState.collected.has(item.id)&&Math.hypot(car.x-item.x,car.y-item.y)<item.radius+15){
   courseState.collected.add(item.id);toast(`收集 ${courseState.collected.size} / ${activeMap.collectibles.length} · 探索越野路线`);
  }
 }
 updateCourseTraffic(dt);
}

function collideCourseObject(o) {
 if(courseState.jump.height>(o.h||0)+10)return;
 const angle=o.angle||0,c=Math.cos(angle),s=Math.sin(angle),dx=car.x-o.x,dy=car.y-o.y;
 const x=dx*c+dy*s,y=-dx*s+dy*c;
 const px=Math.max(-o.w/2,Math.min(o.w/2,x)),py=Math.max(-o.d/2,Math.min(o.d/2,y));
 let nx=x-px,ny=y-py,d=Math.hypot(nx,ny),penetration=15-d;
 if(d>=15)return;
 if(d<.001){
  const sides=[{v:x+o.w/2,x:-1,y:0},{v:o.w/2-x,x:1,y:0},{v:y+o.d/2,x:0,y:-1},{v:o.d/2-y,x:0,y:1}].sort((a,b)=>a.v-b.v);
  nx=sides[0].x;ny=sides[0].y;d=1;penetration=15+sides[0].v;
 }
 const wx=(nx*c-ny*s)/d,wy=(nx*s+ny*c)/d;
 car.x+=wx*(penetration+.5);car.y+=wy*(penetration+.5);
 if((Math.cos(car.angle)*wx+Math.sin(car.angle)*wy)*car.speed<0){
  const speed=Math.abs(car.speed);car.speed*=-.24;
  if(speed>20&&hazard.cooldown<=0){hazard.impact=Math.max(.65,Math.min(1,speed/180));hazard.cooldown=.8;toast(o.kind==='traffic'?'撞到车辆 · 松油调整方向':'撞到障碍 · 松油调整方向')}
 }
}

function resolveCourseCollisions() {
 for(const o of activeMap.objects||[])if(!['ramp','marker','tree'].includes(o.kind))collideCourseObject(o);
 for(const vehicle of courseState.traffic){
  const r=vehicle.route;collideCourseObject({...sampleTraffic(r,vehicle.distance),w:r.w,d:r.d,h:r.h,kind:'traffic'});
 }
}

function updateCourseRace(sample,delta,previousIndex,before) {
 const checkpoints=activeMap.checkpoints;
 const cp=checkpoints[courseState.nextCheckpoint];
 if(cp!==undefined&&delta>0&&delta<15&&previousIndex<cp&&sample.index>=cp&&sample.distance<=courseSurface(sample).width+5){
  checkpointIndex=cp;courseState.nextCheckpoint++;toast(`检查点 ${courseState.nextCheckpoint} / ${checkpoints.length}`);
 }
 for(const signal of activeMap.intersections||[]){
  const line=signal.stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);
  const prior=(before.x-line.x)*c+(before.y-line.y)*s,current=(car.x-line.x)*c+(car.y-line.y)*s;
  const lateral=Math.abs((car.x-line.x)*-s+(car.y-line.y)*c);
  if(prior<0&&current>=0&&lateral<=line.w/2&&courseSignal(signal)!=='green'){
   courseState.violations++;elapsed+=3;toast('红灯越线 · 用时 +3 秒');
  }
 }
 if(delta>0&&delta<15&&previousIndex>N-15&&sample.index<15&&sample.distance<=courseSurface(sample).width+5&&courseState.nextCheckpoint===checkpoints.length){
  if(lap===(activeMap.laps||3))finish();
  else{lap++;checkpointIndex=0;courseState.nextCheckpoint=0;toast(`第 ${lap} 圈 · 保持节奏`)}
 }
}

function courseDetails() {
 if(!activeMap.generic)return '';
 const cp=`CP ${courseState.nextCheckpoint} / ${activeMap.checkpoints.length}`;
 if(activeMap.id==='city'){
  const n=nearest(car.x,car.y),signals=activeMap.intersections||[];
  const next=signals.find(s=>s.stopIndex>=n.index)||signals[0];
  const color=next?{green:'绿灯',amber:'黄灯',red:'红灯'}[courseSignal(next)]:'';
  return `${cp} · 下一路口 ${color} · 越线 ${courseState.violations} 次`;
 }
 if(activeMap.id==='offroad')return `${cp} · 收集 ${courseState.collected.size} / ${activeMap.collectibles.length}${courseState.jump.height?' · 腾空':''}`;
 return `${cp} · 海拔 ${Math.round(car.z*.1)} m · ${DriveCourses.materials[track[nearest(car.x,car.y).index].material].label}`;
}

function buildCourseMesh() {
 const materials=DriveCourses.materials;
 for(let i=0;i<N;i+=2){
  const j=(i+2)%N,a=(track[i].width||activeMap.roadHalf*2)/2,b=(track[j].width||activeMap.roadHalf*2)/2;
  const ribbon=(x1,x2,y1,y2,color,height=0)=>{quad([edgeAt(i,x1,height),edgeAt(j,x2,height),edgeAt(j,y2,height),edgeAt(i,y1,height)],color);roadMesh.at(-1).layer=height>=1.1?3:height>=.6?2:height>=.1?1:0;};
  const material=materials[track[i].material];
  for(const side of[-1,1]){
   ribbon(side*(a+22),side*(b+22),side*(a+500),side*(b+500),activeMap.id==='city'?'#8eaaa0':'#6e8d66',-5);
   ribbon(side*a,side*b,side*(a+22),side*(b+22),activeMap.id==='offroad'?'#a19872':'#bec7b5',.1);
   ribbon(0,0,side*a,side*b,material.color,.6);
  }
  if(activeMap.id!=='offroad'){
   for(const side of[-1,1])ribbon(side*(a-4),side*(b-4),side*a,side*b,'#e4e3ca',1.1);
   if(i%6<2)ribbon(-1.4,-1.4,1.4,1.4,'#e6dbac',1.3);
  }
 }
 for(const cross of[...(activeMap.crossRoads||[]),...(activeMap.shortcuts||[])]){
  for(let i=0;i<cross.points.length-1;i++){
   const p=cross.points[i],q=cross.points[i+1],a=Math.atan2(q.y-p.y,q.x-p.x),nx=-Math.sin(a)*cross.width/2,ny=Math.cos(a)*cross.width/2;
   quad([[p.x+nx,(p.z||0)+.7,p.y+ny],[q.x+nx,(q.z||0)+.7,q.y+ny],[q.x-nx,(q.z||0)+.7,q.y-ny],[p.x-nx,(p.z||0)+.7,p.y-ny]],cross.material==='grass'?'#9daa73':'#56635f');roadMesh.at(-1).layer=2;
  }
 }
 for(const index of[0,...activeMap.checkpoints]){
  const a=(track[index].width||activeMap.roadHalf*2)/2;
  quad([edgeAt(index,-a,1.5),edgeAt((index+1)%N,-a,1.5),edgeAt((index+1)%N,a,1.5),edgeAt(index,a,1.5)],index?'#d7d3a4':'#d2fa60');roadMesh.at(-1).layer=3;
  for(const side of[-1,1]){const v=edgeAt(index,side*(a+12));roadMesh.push(...cuboidMesh(v[0],v[2],6,6,40,['#d2fa60','#84965b','#b8ca82'],0,v[1]))}
 }
 for(const o of activeMap.objects||[]){
  const palette=o.kind==='guardrail'?['#d4dacc','#879a8d','#a1b2a5']:o.kind==='rock'?['#999b84','#606c5a','#7d856d']:o.kind==='tree'?['#5c8156','#3e624b','#496f4a']:['#bdc9b5','#6d8c83','#87a69a'];
  if(o.kind!=='ramp')roadMesh.push(...cuboidMesh(o.x,o.y,o.w,o.d,o.h,palette,o.angle||0,o.z||0));
 }
 for(const r of activeMap.ramps||[]){
  const c=Math.cos(r.angle),s=Math.sin(r.angle),v=(x,y,z)=>[r.x+x*c-z*s,(r.z||0)+y,r.y+x*s+z*c];
  roadMesh.push({vertices:[v(-r.span/2,1,-r.w/2),v(r.span/2,r.h,-r.w/2),v(r.span/2,r.h,r.w/2),v(-r.span/2,1,r.w/2)],color:'#c49c5d',ground:false});
 }
 for(const signal of activeMap.intersections||[]){
  const p=track[signal.stopIndex],width=p.width/2;
  for(const side of[-1,1]){const v=edgeAt(signal.stopIndex,side*(width+16));roadMesh.push(...cuboidMesh(v[0],v[2],6,6,68,['#becab6','#526d61','#728a79'],0,v[1]));}
  const line=signal.stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle),v=(forward,lateral)=>[line.x+forward*c-lateral*s,line.z+1.6,line.y+forward*s+lateral*c];
  quad([v(-line.d/2,-line.w/2),v(line.d/2,-line.w/2),v(line.d/2,line.w/2),v(-line.d/2,line.w/2)],'#e9e5cf');roadMesh.at(-1).layer=3;roadMesh.at(-1).marking='stop-line';
 }
}

function courseDynamicMesh() {
 const faces=[];
 for(const signal of activeMap.intersections||[]){
  const color={green:'#9bdf72',amber:'#f7cd58',red:'#f16a4b'}[courseSignal(signal)],p=track[signal.stopIndex];
  for(const side of[-1,1]){const v=edgeAt(signal.stopIndex,side*(p.width/2+16));faces.push(...cuboidMesh(v[0],v[2],14,14,18,[color,color,color],0,v[1]+65))}
 }
 for(const vehicle of courseState.traffic){const r=vehicle.route,p=sampleTraffic(r,vehicle.distance);faces.push(...cuboidMesh(p.x,p.y,r.w,r.d,r.h,[r.color,'#4c6f73','#668b8a'],p.angle,p.z));}
 for(const item of activeMap.collectibles||[]){
  if(!courseState.collected.has(item.id))faces.push(...cuboidMesh(item.x,item.y,14,14,25,['#ffe894','#bd8e45','#e7c167'],elapsed*.7,item.z+12));
 }
 return faces;
}

function drawCourseTop() {
 ctx.fillStyle=activeMap.id==='city'?'#91a79b':'#78966e';ctx.fillRect(0,0,w,h);
 const b=activeMap.bounds,overview=state==='ready',target=overview?{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2}:car;
 camera.x+=(target.x-camera.x)*.15;camera.y+=(target.y-camera.y)*.15;
 const scale=overview?Math.min(w/(b.maxX-b.minX+400),h/(b.maxY-b.minY+400)):zoom;
 ctx.save();ctx.translate(w/2,h*.47);ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);
 for(const cross of[...(activeMap.crossRoads||[]),...(activeMap.shortcuts||[])]){ctx.beginPath();cross.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineWidth=cross.width;ctx.strokeStyle=cross.material==='grass'?'#9daa73':'#53645b';ctx.stroke();}
 ctx.lineCap='round';
 for(let i=0;i<N;i++){
  const j=(i+1)%N;ctx.beginPath();ctx.moveTo(track[i].x,track[i].y);ctx.lineTo(track[j].x,track[j].y);
  ctx.lineWidth=track[i].width;ctx.strokeStyle=DriveCourses.materials[track[i].material].color;ctx.stroke();
 }
 for(const o of activeMap.objects||[]){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle||0);ctx.fillStyle=o.kind==='rock'?'#747f67':o.kind==='guardrail'?'#dde2ce':'#aac2b3';ctx.fillRect(-o.w/2,-o.d/2,o.w,o.d);ctx.restore();}
 for(const r of activeMap.ramps||[]){ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.angle);ctx.fillStyle='#d0b078';ctx.fillRect(-r.span/2,-r.w/2,r.span,r.w);ctx.restore();}
 for(const signal of activeMap.intersections||[]){const p=signal.stopLine;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle='#e9e5cf';ctx.fillRect(-p.d/2,-p.w/2,p.d,p.w);ctx.restore();}
 for(const index of[0,...activeMap.checkpoints]){const p=track[index];ctx.fillStyle=index&&index>checkpointIndex?'#ddc48d':'#d2fa60';ctx.beginPath();ctx.arc(p.x,p.y,9,0,TAU);ctx.fill();}
 for(const item of activeMap.collectibles||[])if(!courseState.collected.has(item.id)){ctx.fillStyle='#ffe894';ctx.beginPath();ctx.arc(item.x,item.y,13,0,TAU);ctx.fill();}
 for(const signal of activeMap.intersections||[]){const p=track[signal.stopIndex];ctx.fillStyle={red:'#f16a4b',green:'#9bdf72',amber:'#f7cd58'}[courseSignal(signal)];ctx.beginPath();ctx.arc(p.x,p.y,14,0,TAU);ctx.fill();}
 for(const vehicle of courseState.traffic){const p=sampleTraffic(vehicle.route,vehicle.distance);drawCar(p.x,p.y,p.angle,.85);}
 drawCar(car.x,car.y,car.angle);ctx.restore();
 drawMinimap();
}
