'use strict';
const DrivePresentation=(()=>{
 let quality='full',sound=false;
 try{quality=localStorage.getItem('graybox-drive-effects')==='low'?'low':'full';sound=localStorage.getItem('graybox-drive-sound')==='on'}catch{}
 const reducedMotion=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 let last=null,particles=[],message='',messageUntil=0,celebration=0,serial=0,audio=null;
 const events={impact:0,checkpoint:0,landing:0,finish:0,skid:0};
 const settings=document.querySelector('#presentation-settings'),qualityButton=document.querySelector('#effects-toggle'),soundButton=document.querySelector('#sound-toggle');
 const read=()=>({time:elapsed,state,map:activeMap.id,progress,lap,checkpoint:checkpointIndex,impact:hazard.impact,fall:hazard.fall,
  speed:car.speed,steer:car.steer,x:car.x,y:car.y,z:car.z||0,angle:car.angle,brake:input.brake,
  jump:activeMap.generic?courseState.jump.height:0,slip:activeMap.generic?courseState.slip:0});
 function reset(){last=null;particles=[];message='';messageUntil=0;celebration=0;for(const name of Object.keys(events))events[name]=0;mute()}
 function mute(){if(audio)audio.master.gain.setTargetAtTime(0,audio.context.currentTime,.015)}
 function unlock(){
  if(!sound)return;
  try{
   if(!audio){
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    const context=new Context(),master=context.createGain(),engine=context.createOscillator(),filter=context.createBiquadFilter(),analyser=context.createAnalyser();
    master.gain.value=0;filter.type='lowpass';filter.frequency.value=420;engine.type='sawtooth';engine.frequency.value=45;
    engine.connect(filter);filter.connect(master);master.connect(analyser);analyser.connect(context.destination);engine.start();
    audio={context,master,engine,filter,analyser};
   }
   if(audio.context.state==='suspended')audio.context.resume().catch(()=>{});
  }catch{sound=false;syncSettings()}
 }
 function tone(frequency,duration=.12){
  if(!sound||!audio||audio.context.state!=='running'||state!=='running'&&state!=='finished')return;
  const {context}=audio,time=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
  osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(.035,time);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(gain);gain.connect(context.destination);osc.start(time);osc.stop(time+duration);osc.onended=()=>{osc.disconnect();gain.disconnect()};
 }
 function emit(kind,s,count){
  if(quality==='low'||reducedMotion)return;
  for(let i=0;i<count&&particles.length<48;i++){
   const angle=serial++*2.399963,side=i%2?1:-1;
   particles.push({kind,x:s.x-Math.cos(s.angle)*16-Math.sin(s.angle)*side*10,y:s.y-Math.sin(s.angle)*16+Math.cos(s.angle)*side*10,z:s.z+5,
    vx:Math.cos(angle)*22,vy:Math.sin(angle)*22,vz:kind==='spark'?30+i%4*8:9,life:kind==='spark'?.45:.65,max:kind==='spark'?.45:.65});
  }
 }
 function notify(text,s,frequency){message=text;messageUntil=s.time+1.4;tone(frequency)}
 function update(){
  const s=read();
  if(last&&(s.map!==last.map||s.time<last.time||s.state==='ready'&&last.state!=='ready'))reset();
  const dt=last?Math.max(0,Math.min(.12,s.time-last.time)):0;
  if(s.state==='running'){
   for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=p.kind==='spark'?90*dt:0}
   particles=particles.filter(p=>p.life>0&&p.z>=0);
   if(last&&s.impact>last.impact+.1){events.impact++;emit('spark',s,18);notify('车辆接触 · 稳住方向',s,95)}
   if(last&&(s.checkpoint>last.checkpoint||s.lap>last.lap)){events.checkpoint++;notify(s.lap>last.lap?`第 ${s.lap} 圈 · 继续冲刺`:'检查点通过',s,660)}
   if(last&&last.jump>.1&&s.jump===0&&!s.fall){events.landing++;emit('dust',s,12);notify('稳稳落地',s,125)}
   const skid=!s.fall&&s.jump===0&&(Math.abs(s.slip)>8||s.brake&&s.speed>140);
   if(skid&&dt>0){events.skid++;emit('smoke',s,2)}
   if(audio&&sound){audio.engine.frequency.setTargetAtTime(45+Math.abs(s.speed)*.48,audio.context.currentTime,.08);audio.filter.frequency.setTargetAtTime(skid?1100:420+Math.abs(s.speed),audio.context.currentTime,.08);audio.master.gain.setTargetAtTime(.018+Math.min(.02,Math.abs(s.speed)*.00005),audio.context.currentTime,.03)}
  }else mute();
  if(last&&last.state==='running'&&s.state==='finished'){events.finish++;celebration=performance.now();notify('三圈完成 · 成绩已保存',s,880);setTimeout(()=>{if(state==='finished')tone(1174,.2)},120)}
  last=s;
  const ratio=Math.max(0,Math.min(1,activeMap.closed?progress/(N*(activeMap.laps||3)):progress/(N-3)));
  const bar=document.querySelector('#race-progress');if(bar){bar.style.setProperty('--progress',`${ratio*100}%`);bar.setAttribute('aria-valuenow',String(Math.round(ratio*100)));}
  const note=document.querySelector('#race-event');if(note){note.textContent=message&&s.time<=messageUntil&&s.state!=='ready'?message:'';note.hidden=!note.textContent;}
 }
 function worldMesh(){
  if(quality==='low'||!last||last.state!=='running')return [];
  const faces=[];
  for(const p of particles){const size=(p.kind==='spark'?1.5:3+(1-p.life/p.max)*5)*p.life/p.max,color=p.kind==='spark'?'#ffe2a0':p.kind==='smoke'?'#acbdb4':'#c3b99b';faces.push(...cuboidMesh(p.x,p.y,size,size,size,[color,color,color],0,p.z));}
  return faces;
 }
 function draw(){
  update();
  if(quality==='low'||reducedMotion)return;
  if(state==='running'&&Math.abs(car.speed)>260&&!hazard.fall){
   const strength=Math.min(1,(Math.abs(car.speed)-260)/160);ctx.strokeStyle=`rgba(230,248,236,${strength*.26})`;ctx.lineWidth=1;
   for(let i=0;i<14;i++){const a=i/14*TAU,r=.48+((elapsed*.6+i*.618)%1)*.3,x=w/2+Math.cos(a)*w*r,y=h*.46+Math.sin(a)*h*r;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*w*.035,y+Math.sin(a)*h*.035);ctx.stroke()}
  }
  if(state==='finished'&&celebration){
   const t=(performance.now()-celebration)/1000;
   if(t<2.5)for(let i=0;i<48;i++){const x=(i*.618%1)*w,y=((t*(.25+i%3*.04)+i*.137)%1)*h;ctx.fillStyle=['#d2fa60','#76d7cb','#ffd896'][i%3];ctx.fillRect(x,y,4,8)}
  }
 }
 function syncSettings(){
  if(qualityButton){qualityButton.textContent=quality==='full'?'特效 开':'特效 低';qualityButton.setAttribute('aria-pressed',String(quality==='full'))}
  if(soundButton){soundButton.textContent=sound?'声音 开':'声音 关';soundButton.setAttribute('aria-pressed',String(sound))}
  if(settings)settings.dataset.quality=quality;
 }
 if(qualityButton)qualityButton.onclick=()=>{quality=quality==='full'?'low':'full';if(quality==='low')particles=[];try{localStorage.setItem('graybox-drive-effects',quality)}catch{}syncSettings()};
 if(soundButton)soundButton.onclick=()=>{sound=!sound;if(sound)unlock();else mute();try{localStorage.setItem('graybox-drive-sound',sound?'on':'off')}catch{}syncSettings()};
 document.querySelector('#start').addEventListener('click',unlock);
 window.addEventListener('blur',mute);document.addEventListener('visibilitychange',()=>{if(document.hidden)mute()});
 syncSettings();rebuildRoadMesh();
 function audioState(){if(!audio)return null;const samples=new Float32Array(audio.analyser.fftSize);audio.analyser.getFloatTimeDomainData(samples);return {state:audio.context.state,gain:audio.master.gain.value,frequency:audio.engine.frequency.value,rms:Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length)}}
 return {reset,draw,worldMesh,snapshot:()=>({quality,sound,reducedMotion,particles:particles.length,events:{...events},audio:audioState()})};
})();
window.presentationSnapshot=()=>DrivePresentation.snapshot();
