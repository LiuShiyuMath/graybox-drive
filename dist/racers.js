'use strict';

const DriveRacers = (() => {
 const roster = [
  {id:'ally',name:'蓝队友',team:'blue',role:'teammate',grid:66,lane:24,pace:210},
  {id:'rival-1',name:'红对手 1',team:'red',role:'rival',grid:132,lane:-24,pace:225},
  {id:'rival-2',name:'红对手 2',team:'red',role:'rival',grid:198,lane:24,pace:235}
 ];
 const palettes={blue:['#55baf2','#287da8','#399ac8'],red:['#ef7068','#a23f3d','#c85750']};
 const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
 const angleDifference=a=>Math.atan2(Math.sin(a),Math.cos(a));

 function sample(world,distance,offset=0){
  const r=world.route,track=r.track;
  let d=r.closed?((distance%r.total)+r.total)%r.total:clamp(distance,0,r.total);
  let i=0;
  while(i<r.lengths.length-2&&r.lengths[i+1]<d)i++;
  const a=track[i],b=track[(i+1)%track.length],length=r.lengths[i+1]-r.lengths[i];
  const t=clamp((d-r.lengths[i])/length,0,1),dx=b.x-a.x,dy=b.y-a.y;
  return {x:a.x+dx*t-dy/length*offset,y:a.y+dy*t+dx/length*offset,
   z:(a.z||0)+((b.z||0)-(a.z||0))*t+(a.bank||0)*offset,
   angle:Math.atan2(dy,dx),index:i+t,grade:((b.z||0)-(a.z||0))/length,
   width:(a.width||r.map.roadHalf*2)/2,material:a.material||'asphalt'};
 }

 function nearest(world,x,y){
  const r=world.route,track=r.track;
  let result=null;
  for(let i=0;i<r.lengths.length-1;i++){
   const a=track[i],b=track[(i+1)%track.length],dx=b.x-a.x,dy=b.y-a.y;
   const length=r.lengths[i+1]-r.lengths[i],t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(length*length),0,1);
   const px=a.x+dx*t,py=a.y+dy*t,distance=Math.hypot(x-px,y-py);
   if(!result||distance<result.distance)result={x:px,y:py,distance,signed:((x-px)*-dy+(y-py)*dx)/length,
    arc:r.lengths[i]+t*length,index:(i+t)%track.length,
    z:(a.z||0)+((b.z||0)-(a.z||0))*t,grade:((b.z||0)-(a.z||0))/length,
    angle:Math.atan2(dy,dx),width:(a.width||r.map.roadHalf*2)/2,material:a.material||'asphalt'};
  }
  return result;
 }

 function create(map){
  const lengths=[0],track=map.track;
  for(let i=0;i<(map.closed?track.length:track.length-1);i++){
   const a=track[i],b=track[(i+1)%track.length];lengths.push(lengths.at(-1)+Math.hypot(b.x-a.x,b.y-a.y));
  }
  const world={mapId:map.id,simulationTime:0,actors:[],finishOrder:[],playerFinished:false,
   playerCooldown:0,playerContacts:0,lastImpact:0,enabled:true,
   route:{map,track,lengths,total:lengths.at(-1),closed:map.closed},
   checkpoints:map.checkpoints||[40,80,120,160,200]};
  world.route.blockers=(map.objects||[]).filter(o=>!['ramp','marker','tree'].includes(o.kind))
   .map(object=>({object,sample:nearest(world,object.x,object.y)}));
  world.actors=roster.map(config=>{
   const pose=sample(world,config.grid,config.lane);
   return {...config,...pose,speed:0,steer:0,progress:pose.index,lastIndex:pose.index,
    nextCheckpoint:0,lap:1,checkpointProgress:0,finishTime:null,recovery:0,
    collisionCooldown:0,contacts:0,stuck:0,targetLane:config.lane,
    phase:'racing',intent:'race'};
  });
  return world;
 }

 function finishPlayer(world){
  if(world.playerFinished)return;
  world.playerFinished=true;
  if(!world.finishOrder.includes('player'))world.finishOrder.push('player');
 }

 function recover(world,actor){
  if(actor.phase!=='racing')return;
  actor.phase='recovering';actor.recovery=1;actor.speed=0;actor.intent='brake';
 }

 function completeRecovery(world,actor){
  const count=world.route.track.length,index=((actor.checkpointProgress%count)+count)%count;
  const distance=world.route.lengths[Math.floor(index)];
  const pose=sample(world,distance,actor.role==='teammate'?24:-24);
  Object.assign(actor,pose,{progress:Math.min(actor.progress,actor.checkpointProgress),lastIndex:index,
   lane:actor.role==='teammate'?24:-24,targetLane:actor.role==='teammate'?24:-24,
   speed:0,steer:0,stuck:0,recovery:0,collisionCooldown:0,phase:'racing',intent:'race'});
 }

 function gap(actor,other){
  const dx=other.x-actor.x,dy=other.y-actor.y,c=Math.cos(actor.angle),s=Math.sin(actor.angle);
  return {forward:dx*c+dy*s,lateral:dx*-s+dy*c,height:Math.abs((actor.z||0)-(other.z||0))};
 }

 function decide(world,actor,context){
  const n=nearest(world,actor.x,actor.y),limit=Math.max(12,n.width-27);
  const far=sample(world,n.arc+190);
  const bend=Math.abs(angleDifference(far.angle-n.angle));
  let speed=actor.pace/(1+bend*2.8),lane=clamp(actor.lane,-limit,limit),intent='race';
  if(world.route.map.mountain)speed=Math.min(speed,205);
  if(n.material==='gravel')speed=Math.min(speed,175);
  if(n.material==='mud')speed=Math.min(speed,135);
  if(n.distance>n.width-10)speed=Math.min(speed,105);
  speed=Math.max(75,speed);
  const player=context.player;
  const others=world.actors.filter(a=>a!==actor&&a.phase==='racing');
  if(player&&!context.playerFalling)others.push({...player,id:'player',phase:'racing'});
  const g=player?gap(actor,player):null;
  const playerApproach=player?player.speed*Math.cos(player.angle-actor.angle)-actor.speed:0;
  if(actor.role==='teammate'&&g&&g.height<24&&g.forward>-155&&g.forward<0&&Math.abs(g.lateral)<58&&playerApproach>10){
   lane=clamp(n.signed+(g.lateral<=0?32:-32),-limit,limit);
   speed=Math.min(speed,Math.max(35,Math.abs(player.speed)*.65));intent='yield';
  }
  for(const other of others){
   const near=gap(actor,other);
   if(near.height>=24||near.forward<=0||near.forward>145||Math.abs(near.lateral)>32)continue;
   const alternatives=[-limit,0,limit].filter(candidateLane=>others.every(candidate=>{
    const at=nearest(world,candidate.x,candidate.y),d=gap(actor,candidate);
    return d.height>=24||d.forward<-45||d.forward>170||Math.abs(at.signed-candidateLane)>44;
   })).sort((a,b)=>Math.abs(a-lane)-Math.abs(b-lane));
   if(alternatives.length&&(actor.role==='rival'||Math.abs(other.speed)<actor.pace*.7)){
    lane=alternatives[0];if(intent!=='yield')intent='pass';
   }else if(intent!=='yield'){
    speed=Math.min(speed,Math.max(0,other.speed*(near.forward<65?.35:.8)));
    intent='brake';
   }
  }
  for(const traffic of context.traffic||[]){
   const at=gap(actor,traffic);
   if(at.height<24&&at.forward>0&&at.forward<120&&Math.abs(at.lateral)<48){speed=0;intent='brake'}
  }
  for(const signal of world.route.map.intersections||[]){
   const line=signal.stopLine,c=Math.cos(line.angle),s=Math.sin(line.angle);
   const forward=(line.x-actor.x)*c+(line.y-actor.y)*s;
   const lateral=Math.abs((actor.x-line.x)*-s+(actor.y-line.y)*c);
   const phase=((context.signalTime+signal.offset)%signal.period+signal.period)%signal.period;
   if(forward>0&&forward<130&&lateral<line.w/2+20&&Math.cos(actor.angle-line.angle)>.5&&phase>=signal.green){
    speed=Math.min(speed,Math.max(0,(forward-26)*1.9));intent='brake';
   }
  }
  for(const blocker of world.route.blockers){
   const o=blocker.object,at=blocker.sample;
   let distance=at.arc-n.arc;
   if(world.route.closed&&distance<-20)distance+=world.route.total;
   if(distance<-20||distance>240||Math.abs(at.signed)>at.width+25)continue;
   const relative=(o.angle||0)-at.angle;
   const clearance=24+Math.abs(Math.sin(relative))*o.w/2+Math.abs(Math.cos(relative))*o.d/2;
   if(Math.abs(lane-at.signed)<clearance){
    lane=at.signed>0?-limit:limit;
    speed=Math.min(speed,125);
    if(intent==='race')intent='pass';
   }
  }
  const lookahead=clamp(65+actor.speed*.32,65,140),target=sample(world,n.arc+lookahead,lane);
  const error=angleDifference(Math.atan2(target.y-actor.y,target.x-actor.x)-actor.angle);
  if(Math.abs(error)>.75)speed=Math.min(speed,90);
  return {speed,lane,intent,steer:clamp(2*Math.sin(error)*85/lookahead,-1,1),sample:n,target};
 }

 function contact(world,a,b){
  if(a.phase!=='racing'||b.phase!=='racing'||Math.abs((a.z||0)-(b.z||0))>=24)return 0;
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>=42)return 0;
  if(d<.001){dx=Math.cos(a.angle+Math.PI/2);dy=Math.sin(a.angle+Math.PI/2);d=1}
  const nx=dx/d,ny=dy/d,shift=(42-d+.05)/2;
  a.x-=nx*shift;a.y-=ny*shift;b.x+=nx*shift;b.y+=ny*shift;
  if(a.id!=='player')a.lastIndex=nearest(world,a.x,a.y).index;
  if(b.id!=='player')b.lastIndex=nearest(world,b.x,b.y).index;
  const avx=Math.cos(a.angle)*a.speed,avy=Math.sin(a.angle)*a.speed;
  const bvx=Math.cos(b.angle)*b.speed,bvy=Math.sin(b.angle)*b.speed;
  const closing=(avx-bvx)*nx+(avy-bvy)*ny;
  if(closing<=0||a.collisionCooldown>0||b.collisionCooldown>0)return 0;
  const impulse=closing*.65;
  a.speed=clamp(a.speed-impulse*(Math.cos(a.angle)*nx+Math.sin(a.angle)*ny),-75,350);
  b.speed=clamp(b.speed+impulse*(Math.cos(b.angle)*nx+Math.sin(b.angle)*ny),-75,350);
  a.collisionCooldown=b.collisionCooldown=.7;a.contacts++;b.contacts++;
  return closing;
 }

 function obstacleContact(actor,o){
  if(['ramp','marker','tree'].includes(o.kind)||Math.abs(actor.z-(o.z||0))>(o.h||40)+18)return;
  const c=Math.cos(o.angle||0),s=Math.sin(o.angle||0),dx=actor.x-o.x,dy=actor.y-o.y;
  const x=dx*c+dy*s,y=-dx*s+dy*c,px=clamp(x,-o.w/2,o.w/2),py=clamp(y,-o.d/2,o.d/2);
  let nx=x-px,ny=y-py,d=Math.hypot(nx,ny),penetration=21-d;
  if(d>=21)return;
  if(d<.001){const sides=[{v:x+o.w/2,x:-1,y:0},{v:o.w/2-x,x:1,y:0},{v:y+o.d/2,x:0,y:-1},{v:o.d/2-y,x:0,y:1}].sort((a,b)=>a.v-b.v);nx=sides[0].x;ny=sides[0].y;d=1;penetration=21+sides[0].v}
  const wx=(nx*c-ny*s)/d,wy=(nx*s+ny*c)/d;
  actor.x+=wx*(penetration+.05);actor.y+=wy*(penetration+.05);
  if((Math.cos(actor.angle)*wx+Math.sin(actor.angle)*wy)*actor.speed<0)actor.speed*=.25;
 }

 function advanceRace(world,actor,n){
  const count=world.route.track.length;
  let delta=n.index-actor.lastIndex;
  if(world.route.closed){if(delta>count/2)delta-=count;if(delta<-count/2)delta+=count}
  const before=actor.lastIndex;
  if(Math.abs(delta)<15&&n.distance<=n.width+5){
   actor.progress=Math.max(0,actor.progress+delta);
   const cp=world.checkpoints[actor.nextCheckpoint];
   if(cp!==undefined&&delta>0&&before<cp&&n.index>=cp){
    actor.nextCheckpoint++;actor.checkpointProgress=(actor.lap-1)*count+cp;
   }
   const crossed=world.route.closed&&delta>0&&before>count-15&&n.index<15;
   const summit=!world.route.closed&&n.index>=count-3;
   if((crossed||summit)&&actor.nextCheckpoint===world.checkpoints.length){
    if(!world.route.closed||actor.lap===(world.route.map.laps||3)){
     actor.phase='finished';actor.finishTime=world.simulationTime;actor.speed=0;
     if(!world.finishOrder.includes(actor.id))world.finishOrder.push(actor.id);
    }else{actor.lap++;actor.nextCheckpoint=0;actor.checkpointProgress=(actor.lap-1)*count}
   }
  }
  actor.lastIndex=n.index;
 }

 function step(world,dt,context){
  if(!world.enabled||context.state!=='running'||!(dt>0))return;
  let remaining=dt;
  while(remaining>1e-9){
   const slice=Math.min(remaining,.02);remaining-=slice;world.simulationTime+=slice;
   world.lastImpact=0;world.playerCooldown=Math.max(0,world.playerCooldown-slice);
   for(const actor of world.actors){
    if(actor.phase==='finished')continue;
    actor.collisionCooldown=Math.max(0,actor.collisionCooldown-slice);
    if(actor.phase==='recovering'){
     actor.recovery=Math.max(0,actor.recovery-slice);
     if(actor.recovery===0)completeRecovery(world,actor);
     continue;
    }
    const command=decide(world,actor,context),n=command.sample;
    actor.intent=command.intent;actor.targetLane=command.lane;
    actor.lane+=(command.lane-actor.lane)*Math.min(1,slice*3);
    actor.steer+=(command.steer-actor.steer)*Math.min(1,slice*9);
    const acceleration=actor.speed<command.speed?190:-330;
    actor.speed+=clamp(command.speed-actor.speed,Math.min(0,acceleration*slice),Math.max(0,acceleration*slice));
    actor.speed-=n.grade*Math.cos(actor.angle-n.angle)*70*slice;
    actor.speed=Math.max(0,actor.speed);
    actor.angle+=actor.steer*actor.speed/85*slice;
    const ox=actor.x,oy=actor.y;
    actor.x+=Math.cos(actor.angle)*actor.speed*slice;actor.y+=Math.sin(actor.angle)*actor.speed*slice;
    for(const o of context.obstacles||[])obstacleContact(actor,o);
    for(const o of context.traffic||[])obstacleContact(actor,{...o,w:42,d:23,h:20});
    const at=nearest(world,actor.x,actor.y);actor.z=at.z+(world.route.track[Math.round(at.index)%world.route.track.length].bank||0)*at.signed;
    actor.stuck=Math.hypot(actor.x-ox,actor.y-oy)<slice*8&&command.intent==='race'?actor.stuck+slice:0;
    if(at.distance>at.width+65||actor.stuck>4){recover(world,actor);continue}
    advanceRace(world,actor,at);
   }
   for(let i=0;i<world.actors.length;i++)for(let j=i+1;j<world.actors.length;j++)contact(world,world.actors[i],world.actors[j]);
   if(context.player&&!context.playerFalling){
    const player={...context.player,id:'player',phase:'racing',collisionCooldown:world.playerCooldown,contacts:world.playerContacts};
    for(const actor of world.actors)world.lastImpact=Math.max(world.lastImpact,contact(world,player,actor));
    Object.assign(context.player,{x:player.x,y:player.y,speed:player.speed});
    world.playerCooldown=player.collisionCooldown;world.playerContacts=player.contacts;
   }
  }
 }

 function standings(world,player={progress:0,state:'ready'}){
  const rows=[{id:'player',name:'你 · 蓝队',team:'blue',progress:player.progress||0,phase:world.playerFinished?'finished':'racing'},
   ...world.actors.map(a=>({id:a.id,name:a.name,team:a.team,progress:a.progress,phase:a.phase}))];
  rows.sort((a,b)=>{
   const ai=world.finishOrder.indexOf(a.id),bi=world.finishOrder.indexOf(b.id);
   if(ai>=0||bi>=0)return ai<0?1:bi<0?-1:ai-bi;
   return b.progress-a.progress||a.id.localeCompare(b.id);
  });
  const teamScores={blue:0,red:0};
  rows.forEach((row,i)=>{row.rank=i+1;row.points=4-i;teamScores[row.team]+=row.points});
  return {rows,teamScores,playerRank:rows.find(r=>r.id==='player').rank};
 }

 function snapshot(world,player){
  const order=standings(world,player);
  return {mapId:world.mapId,enabled:world.enabled,simulationTime:world.simulationTime,
   actors:world.actors.map(a=>({...a})),finishOrder:[...world.finishOrder],
   playerCooldown:world.playerCooldown,playerContacts:world.playerContacts,
   standings:order.rows,teamScores:order.teamScores,playerRank:order.playerRank};
 }
 return {create,step,standings,snapshot,sample,nearest,recover,contact,decide,finishPlayer,palettes};
})();
if(typeof module!=='undefined')module.exports=DriveRacers;
