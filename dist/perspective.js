'use strict';
let viewMode='first';
const viewButtons=Array.from(document.querySelectorAll('[data-view]'));
function selectView(mode){viewMode=mode;document.body.classList.toggle('perspective',mode!=='top');for(const b of viewButtons)b.setAttribute('aria-pressed',String(b.dataset.view===mode));try{localStorage.setItem('graybox-drive-view',mode)}catch{}}
try{const saved=localStorage.getItem('graybox-drive-view');if(['first','chase','top'].includes(saved))viewMode=saved}catch{}
for(const b of viewButtons)b.onclick=()=>selectView(b.dataset.view);
window.addEventListener('keydown',e=>{if(e.code==='KeyV'&&!e.repeat){selectView(['first','chase','top'][(['first','chase','top'].indexOf(viewMode)+1)%3])}});selectView(viewMode);
const roadMesh=[];
let roadMeshVersion=0;
function quad(vertices,color){roadMesh.push({vertices,color,ground:true})}
function edgePoint(i,offset,height=0){return edgeAt(i,offset,height)}
function buildCircuitMesh(){
for(let i=0;i<N;i+=3){
quad([edgePoint(i,211,-300),edgePoint(i+3,211,-300),edgePoint(i+3,600,-300),edgePoint(i,600,-300)],'#293b38');
quad([edgePoint(i,110),edgePoint(i+3,110),edgePoint(i+3,210),edgePoint(i,210)],'#9b977d');
quad([edgePoint(i,202,.5),edgePoint(i+3,202,.5),edgePoint(i+3,211,.5),edgePoint(i,211,.5)],i%2?'#d3b45f':'#323e35');
quad([edgePoint(i,211,0),edgePoint(i+3,211,0),edgePoint(i+3,211,-300),edgePoint(i,211,-300)],'#536258');
quad([edgePoint(i,-110),edgePoint(i+3,-110),edgePoint(i+3,110),edgePoint(i,110)],'#727d75');
quad([edgePoint(i,-93,.3),edgePoint(i+3,-93,.3),edgePoint(i+3,93,.3),edgePoint(i,93,.3)],'#505c57');
for(const side of[-1,1])quad([edgePoint(i,side*94,.7),edgePoint(i+3,side*94,.7),edgePoint(i+3,side*106,.7),edgePoint(i,side*106,.7)],Math.floor(i/3)%2?'#dce2d5':'#839180');
if(i%5<3)quad([edgePoint(i,-1.4,.9),edgePoint(i+3,-1.4,.9),edgePoint(i+3,1.4,.9),edgePoint(i,1.4,.9)],'#cbd3c1');
}
for(let i=0;i<20;i++)quad([[740,.95,710+i*10],[750,.95,710+i*10],[750,.95,720+i*10],[740,.95,720+i*10]],i%2?'#e9eddf':'#293930');
 }
function mountainStrip(i,j,from,to,color){
 quad([edgePoint(i,from[0],from[1]),edgePoint(j,from[0],from[1]),edgePoint(j,to[0],to[1]),edgePoint(i,to[0],to[1])],color);
 const face=roadMesh.at(-1);face.layer=from[1]>=.9?3:from[1]>=.5?2:from[1]>=.2?1:0;
}
function buildMountainMesh(){
 for(const [index,direction,length] of[[0,-1,260],[N-1,1,180]]){
  const p=track[index],q=track[index===0?1:N-2],dx=index===0?q.x-p.x:p.x-q.x,dy=index===0?q.y-p.y:p.y-q.y,len=Math.hypot(dx,dy),grade=index===0?(q.z-p.z)/len:(p.z-q.z)/len;
  const extend=(offset,height=0)=>{const a=edgePoint(index,offset,height);return[a[0]+dx/len*length*direction,a[1]+grade*length*direction,a[2]+dy/len*length*direction]};
  for(const [from,to,color] of[[-72,96,'#aeaa8c'],[-66,66,'#ddd6b6'],[-57,57,'#4d605a']]){
   const height=from===-57?.6:from===-66?.3:0;
   quad([edgePoint(index,from,height),extend(from,height),extend(to,height),edgePoint(index,to,height)],color);roadMesh.at(-1).layer=from===-57?2:from===-66?1:0;
  }
 }
 for(let i=0;i<N-1;i+=2){
  const j=Math.min(N-1,i+2);
  mountainStrip(i,j,[-900,600],[-360,250],i%4?'#879589':'#93a092');
  mountainStrip(i,j,[-360,250],[-95,52],i%6?'#a2a795':'#919b8c');
  mountainStrip(i,j,[-95,52],[-72,0],i%4?'#adb29e':'#9aa18e');
  // Adjacent ribbons share edges. Overlapping twisted quads would intersect
  // on climbing bends even with correct depth testing.
  mountainStrip(i,j,[-72,.6],[-60,.6],'#ddd6b6');
  mountainStrip(i,j,[-60,.6],[-57,.6],'#f0e6c3');
  mountainStrip(i,j,[-57,.6],[0,.6],'#4d605a');
  mountainStrip(i,j,[0,.6],[57,.6],'#4d605a');
  mountainStrip(i,j,[57,.6],[60,.6],'#f0e6c3');
  mountainStrip(i,j,[60,.6],[96,.6],'#b6b294');
  mountainStrip(i,j,[76,2.4],[81,2.4],i%4?'#d4af4c':'#394b41');
  if(i%6<2)mountainStrip(i,j,[-1.2,2.6],[1.2,2.6],'#efce76');
  mountainStrip(i,j,[96,0],[96,-680],i%4?'#657d6f':'#748776');
  mountainStrip(i,j,[96,-680],[1200,-680],i%4?'#3f6860':'#477368');
 }
 for(const index of[0,40,80,120,160,200,N-1]){
  const p=track[index],q=track[Math.min(index+1,N-1)],prev=track[Math.max(0,index-1)],angle=Math.atan2(q.y-prev.y,q.x-prev.x);
  const color=index===N-1?'#f1d17c':'#d2fa60';
  if(index<N-2)mountainStrip(index,Math.min(index+1,N-1),[-57,1.2],[57,1.2],color);
  for(const side of[-1,1]){const v=edgePoint(index,side*72);roadMesh.push(...cuboidMesh(v[0],v[2],7,7,70,[color,'#64755a','#8a9b6a'],0,p.z))}
  roadMesh.push(...cuboidMesh(p.x,p.y,7,150,7,[color,'#6d8054','#b2c45f'],angle,p.z+66));
 }
}
function rebuildRoadMesh(){
 roadMesh.length=0;roadMeshVersion++;
 if(activeMap.generic)buildCourseMesh();else if(activeMap.mountain)buildMountainMesh();else buildCircuitMesh();
 if(typeof DriveArt!=='undefined'&&activeMap.id==='circuit'){for(const face of roadMesh)face.color=DriveArt.palette[face.color]||face.color;roadMesh.push(...DriveArt.circuit())}
 for(const o of obstacles)if(!o.artGate)roadMesh.push(...cuboidMesh(o.x,o.y,o.w,o.d,o.h,o.w===7?['#d4dfbc','#7c8d74','#9bab8e']:undefined,0,o.z||0));
}
function cuboidMesh(x,z,ww,dd,hh,colors=['#93a19a','#65746e','#7b8c80'],angle=0,base=0){const c=Math.cos(angle),s=Math.sin(angle);const v=(dx,y,dz)=>[x+dx*c-dz*s,y+base,z+dx*s+dz*c];const a=v(-ww/2,0,-dd/2),b=v(ww/2,0,-dd/2),c1=v(ww/2,0,dd/2),d=v(-ww/2,0,dd/2),A=v(-ww/2,hh,-dd/2),B=v(ww/2,hh,-dd/2),C=v(ww/2,hh,dd/2),D=v(-ww/2,hh,dd/2);return[{vertices:[A,B,C,D],color:colors[0]},{vertices:[a,b,B,A],color:colors[1]},{vertices:[b,c1,C,B],color:colors[2]},{vertices:[c1,d,D,C],color:colors[1]},{vertices:[d,a,A,D],color:colors[2]}]}
rebuildRoadMesh();
function clipNear(points){const out=[],near=4;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=a[2]>=near,next=b[2]>=near;if(inside)out.push(a);if(inside!==next){const t=(near-a[2])/(b[2]-a[2]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near])}}return out}
let softwareDepthRenderer;
function drawSoftwareDepth(faces,focal,horizon){
 if(typeof document.createElement!=='function')return false;
 if(!softwareDepthRenderer){const surface=document.createElement('canvas'),context=surface.getContext('2d');if(!context)return false;softwareDepthRenderer={surface,context};}
 const {surface,context}=softwareDepthRenderer,scale=Math.min(1,420/w,320/h),width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));
 if(surface.width!==width||surface.height!==height||!softwareDepthRenderer.image){surface.width=width;surface.height=height;softwareDepthRenderer.image=context.createImageData(width,height);softwareDepthRenderer.depth=new Float32Array(width*height);}
 const image=softwareDepthRenderer.image,depth=softwareDepthRenderer.depth,data=image.data;
 data.fill(0);depth.fill(0);
 for(const face of faces){
  const points=face.pts.map(p=>[(w/2+p[0]*focal/p[2])*scale,(horizon-p[1]*focal/p[2])*scale,1/p[2]]),hex=face.color.slice(1),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
  for(let k=1;k<points.length-1;k++){
   const a=points[0],b=points[k],c=points[k+1],area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
   if(Math.abs(area)<.00001)continue;
   const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0]))),minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
   for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
    const px=x+.5,py=y+.5,u=((b[1]-c[1])*(px-c[0])+(c[0]-b[0])*(py-c[1]))/area,v=((c[1]-a[1])*(px-c[0])+(a[0]-c[0])*(py-c[1]))/area,t=1-u-v;
    if(u<-.00001||v<-.00001||t<-.00001)continue;
    const inv=u*a[2]+v*b[2]+t*c[2],index=y*width+x;
    if(inv<=depth[index])continue;
    depth[index]=inv;const fog=Math.max(0,Math.min(.68,(1/inv-450)/2450*.68)),i=index*4;
    data[i]=rgb[0]*(1-fog)+173*fog;data[i+1]=rgb[1]*(1-fog)+196*fog;data[i+2]=rgb[2]*(1-fog)+173*fog;data[i+3]=255;
   }
  }
 }
 context.putImageData(image,0,0);ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(surface,0,0,w,h);ctx.restore();return true;
}
function chaseCameraFraction(focus,target,faces){
 const direction=target.map((v,i)=>v-focus[i]),length=Math.hypot(...direction),clearance=8,softness=16;
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0),subtract=(a,b)=>a.map((v,i)=>v-b[i]);
 let fraction=1;
 for(const face of faces){
  if(face.ground)continue;
  for(let i=1;i<face.vertices.length-1;i++){
   const triangle=[face.vertices[0],face.vertices[i],face.vertices[i+1]],normal=cross(subtract(triangle[1],triangle[0]),subtract(triangle[2],triangle[0])),normalLength=Math.hypot(...normal),denominator=dot(direction,normal);
   if(Math.abs(denominator)<.00001||normalLength<.00001)continue;
   const t=dot(subtract(triangle[0],focus),normal)/denominator;
   if(t<=0||t>=1)continue;
   const point=focus.map((v,j)=>v+direction[j]*t);
   let outside=0;
   for(let j=0;j<3;j++){
    const edge=subtract(triangle[(j+1)%3],triangle[j]);
    outside=Math.max(outside,-dot(cross(edge,subtract(point,triangle[j])),normal)/(Math.hypot(...edge)*normalLength));
   }
   if(outside>=softness)continue;
   const u=Math.max(0,outside/softness),influence=1-u*u*(3-2*u),safe=Math.max((21+clearance)/150,t-clearance/length);
   fraction=Math.min(fraction,1-(1-safe)*influence);
  }
 }
 return fraction;
}
function perspectivePose(){
 const chase=viewMode==='chase',fx=Math.cos(car.angle),fz=Math.sin(car.angle),sample=activeMap.mountain||activeMap.generic?nearest(car.x,car.y):null;
 const grade=sample?sample.grade*(fx*sample.tx+fz*sample.ty):0,drop=-hazard.fall*hazard.fall*80;
 const elevation=sample?sample.elevation:0;
 const cameraGrade=sample?(nearest(car.x+fx*24,car.y+fz*24).elevation-nearest(car.x-fx*24,car.y-fz*24).elevation)/48:0;
 const circuitRig=chase&&activeMap.id==='circuit'?Math.max(0,Math.min(1,(activeMap.fall-nearest(car.x,car.y).distance)/50)):0;
 const boom=chase?(activeMap.id==='circuit'?105:150):6,height=chase?(activeMap.id==='circuit'?48:92):19;
 const target=[car.x-fx*boom,elevation+height+drop-cameraGrade*boom,car.y-fz*boom];
 if(circuitRig){target[0]-=fz*32*circuitRig;target[2]+=fx*32*circuitRig;}
 const focus=[car.x,elevation+12+drop,car.y];
 const fraction=chase&&(activeMap.mountain||activeMap.generic)?chaseCameraFraction(focus,target,roadMesh):1;
 return {camera:focus.map((v,i)=>v+(target[i]-v)*fraction),forward:[Math.cos(car.angle-circuitRig*.15),Math.sin(car.angle-circuitRig*.15)],right:[-Math.sin(car.angle-circuitRig*.15),Math.cos(car.angle-circuitRig*.15)],chase,grade,cameraGrade,drop,pitch:(chase?(activeMap.id==='circuit'?.16:.36):.055+Math.min(.65,hazard.fall*.5))-Math.atan(cameraGrade),focal:Math.min(w*.82,h*1.35),horizon:h*.42,distance:boom*fraction,obstructed:fraction<1};
}
function playerCarMesh(){
 const fx=Math.cos(car.angle),fz=Math.sin(car.angle),sample=nearest(car.x,car.y),body=vehicleBodyPose();
 const tx=sample.tx||0,ty=sample.ty||0,bank=activeMap.generic&&!sample.terrain?track[sample.index].bank||0:0;
 const gx=sample.grade*tx-bank*ty,gz=sample.grade*ty+bank*tx;
 const grade=gx*fx+gz*fz,crossGrade=-gx*fz+gz*fx;
 const base=(car.z||0)-hazard.fall*hazard.fall*80+(activeMap.mountain||activeMap.generic?1.5:0);
 const faces=typeof DriveArt!=='undefined'?DriveArt.carMesh(car.x,car.y,car.angle):[...cuboidMesh(car.x,car.y,42,23,12,['#d2fa60','#869e3d','#aec64e'],car.angle),...cuboidMesh(car.x-fx*3,car.y-fz*3,19,20,8,['#526c60','#314e44','#486359'],car.angle,12)];
 for(const face of faces)face.vertices=face.vertices.map(([x,y,z])=>{
  const forward=(x-car.x)*fx+(z-car.y)*fz,right=-(x-car.x)*fz+(z-car.y)*fx;
  return[x,y+base+body.heave+forward*(grade+body.pitch)+right*(crossGrade+body.roll),z];
 });
 return faces;
}
function drawPerspective(){
if(drawMountainPerspective())return;
const pose=perspectivePose(),{chase,pitch,focal,horizon}=pose,[fx,fz]=pose.forward,[rx,rz]=pose.right,[cx,cy,cz]=pose.camera,cp=Math.cos(pitch),sp=Math.sin(pitch);
const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#8baba6');sky.addColorStop(.48,'#c1cbb8');sky.addColorStop(.49,'#9baa94');sky.addColorStop(1,'#74856e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);if(activeMap.mountain||activeMap.generic)drawMountainBackdrop(horizon,focal,pitch);else if(typeof DriveArt!=='undefined')DriveArt.backdrop(pose);
const transform=v=>{const dx=v[0]-cx,dy=v[1]-cy,dz=v[2]-cz,forward=dx*fx+dz*fz;return[dx*rx+dz*rz,dy*cp+forward*sp,forward*cp-dy*sp]};
const faces=[];const add=face=>{let pts=clipNear(face.vertices.map(transform));if(pts.length<3)return;const depth=pts.reduce((s,p)=>s+p[2],0)/pts.length;if(depth>2200)return;faces.push({pts,depth,color:face.color,ground:!!face.ground,layer:face.layer||0})};
for(const face of roadMesh)add(face);
for(const face of racerMesh())add(face);
if(typeof DrivePresentation!=='undefined')for(const face of DrivePresentation.worldMesh())add(face);
if(activeMap.generic)for(const face of courseDynamicMesh())add(face);
if(chase)for(const face of playerCarMesh())add(face);
if(drawSoftwareDepth(faces,focal,horizon)){if(!chase)drawCockpit();return;}
// Ground spans under raised objects; its centroid cannot decide their occlusion.
faces.sort((a,b)=>Number(b.ground)-Number(a.ground)||((activeMap.mountain||activeMap.generic)&&a.ground&&b.ground?a.layer-b.layer:0)||b.depth-a.depth);
for(const face of faces){ctx.beginPath();face.pts.forEach((p,i)=>{const x=w/2+p[0]*focal/p[2],y=horizon-p[1]*focal/p[2];if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle=face.color;ctx.fill();ctx.strokeStyle=face.color;ctx.lineWidth=.6;ctx.stroke()}
if(!chase)drawCockpit();
}
function drawCockpit(){
const body=vehicleBodyPose();
ctx.save();ctx.translate(w*.5,h*.9);ctx.rotate(-body.roll*.35);ctx.translate(-w*.5,-h*.9-body.heave*h*.004-body.pitch*h*.12);
ctx.fillStyle='#cc3549';ctx.beginPath();ctx.moveTo(w*.2,h*.9);ctx.lineTo(w*.35,h*.75);ctx.lineTo(w*.65,h*.75);ctx.lineTo(w*.8,h*.9);ctx.closePath();ctx.fill();ctx.strokeStyle='#ff8b8c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.42,h*.77);ctx.lineTo(w*.38,h*.9);ctx.moveTo(w*.58,h*.77);ctx.lineTo(w*.62,h*.9);ctx.stroke();
ctx.fillStyle='#24332d';ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*.88);ctx.quadraticCurveTo(w*.5,h*.78,w,h*.88);ctx.lineTo(w,h);ctx.fill();
ctx.save();ctx.translate(w*.5,h*1.03);ctx.rotate(car.steer*.55);ctx.strokeStyle='#102019';ctx.lineWidth=Math.max(10,h*.035);ctx.beginPath();ctx.arc(0,0,h*.17,0,TAU);ctx.stroke();ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-h*.15,-h*.06);ctx.lineTo(0,0);ctx.lineTo(h*.15,-h*.06);ctx.stroke();ctx.restore();
ctx.strokeStyle='#273c32';ctx.lineWidth=Math.max(5,w*.008);ctx.beginPath();ctx.moveTo(0,h*.88);ctx.lineTo(w*.08,0);ctx.moveTo(w,h*.88);ctx.lineTo(w*.92,0);ctx.stroke();
ctx.restore();
}
function drawMinimap(){
 const mw=Math.min(150,w*.25),mh=activeMap.mountain?mw*1.2:mw*2/3,top=Math.max(230,h-125-mh);
 ctx.save();ctx.translate(18,top);ctx.fillStyle='#172b27cf';ctx.beginPath();ctx.roundRect(0,0,mw,mh,7);ctx.fill();
 if(activeMap.mountain||activeMap.generic){
  const b=activeMap.bounds,pad=14,scale=Math.min((mw-pad*2)/(b.maxX-b.minX),(mh-pad*2)/(b.maxY-b.minY));
  ctx.translate(mw/2,mh/2);ctx.scale(scale,scale);ctx.translate(-(b.minX+b.maxX)/2,-(b.minY+b.maxY)/2);line('#dce4b7',Math.max(20,2/scale));
  for(const index of(activeMap.generic?activeMap.checkpoints:[40,80,120,160,200,N-1])){const p=track[index];ctx.fillStyle=index<=checkpointIndex?'#d2fa60':'#d5b86c';ctx.beginPath();ctx.arc(p.x,p.y,3/scale,0,TAU);ctx.fill()}
  drawRacerMarkers(3/scale);ctx.translate(car.x,car.y);ctx.rotate(car.angle);ctx.fillStyle='#d2fa60';ctx.beginPath();ctx.moveTo(6/scale,0);ctx.lineTo(-4/scale,-3/scale);ctx.lineTo(-4/scale,3/scale);ctx.closePath();ctx.fill();
 }else{
  ctx.scale(mw/1500,mh/1000);line('#abb8a2',45);drawRacerMarkers(26);ctx.translate(car.x,car.y);ctx.rotate(car.angle);ctx.fillStyle='#d2fa60';ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(-25,-23);ctx.lineTo(-25,23);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function drawMountainBackdrop(horizon,focal,pitch){
 const skyline=horizon+Math.tan(pitch)*focal;
 const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,activeMap.sky||'#70999c');sky.addColorStop(.55,'#d2dbc3');sky.addColorStop(1,'#90a48e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
 if(activeMap.id==='city'){ctx.fillStyle='#6e9395';for(let i=0;i<18;i++){const x=(i*w/12-car.angle/TAU*w)%(w*1.5);ctx.fillRect(x,skyline-h*(.08+(i%4)*.025),w/16,h*.25)}return}
 const shift=car.angle/TAU*w;
 for(let layer=0;layer<3;layer++){
  const color=['#91ada7','#77998e','#5e8479'][layer],step=w*.22;
  ctx.beginPath();ctx.moveTo(-step,h);
  for(let i=-2;i<9;i++){const x=i*step-((shift*(layer+1)*.16)%step),peak=skyline-h*(.15+.04*layer)-Math.sin(i*2.2+layer)*h*.075;ctx.lineTo(x,skyline-h*.035);ctx.lineTo(x+step*.5,peak);ctx.lineTo(x+step,skyline+h*.02)}
  ctx.lineTo(w+step,h);ctx.closePath();ctx.fillStyle=color;ctx.fill();
 }
 const fog=ctx.createLinearGradient(0,Math.max(0,skyline-h*.1),0,h);fog.addColorStop(0,'#d2dbc300');fog.addColorStop(1,'#94af8a33');ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
}

// The mountain needs a depth buffer: a painter's average depth cannot order an
// uphill road, its markings and the cliff reliably. The circuit keeps its renderer.
let mountainRenderer;
function createMountainRenderer(){
 if(typeof document.createElement!=='function')return null;
 const surface=document.createElement('canvas');
 const gl=surface.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false});
 if(!gl)return null;
 let resources;
 surface.addEventListener('webglcontextlost',event=>{event.preventDefault();resources=undefined});
 surface.addEventListener('webglcontextrestored',()=>{resources=undefined});
 const vertex=`attribute vec3 aPosition;attribute vec3 aColor;
 uniform vec3 uCamera;uniform vec2 uForward;uniform vec2 uRight;uniform vec2 uPitch;uniform vec3 uProjection;
 varying vec3 vColor;varying float vDepth;
 void main(){vec3 d=aPosition-uCamera;float forward=dot(d.xz,uForward);float right=dot(d.xz,uRight);
 float up=d.y*uPitch.x+forward*uPitch.y;float depth=forward*uPitch.x-d.y*uPitch.y;
 gl_Position=vec4(right*uProjection.x,up*uProjection.y+depth*uProjection.z,1.00267*depth-8.01068,depth);
 vColor=aColor;vDepth=depth;}`;
 const fragment=`precision mediump float;varying vec3 vColor;varying float vDepth;
 void main(){float fog=smoothstep(450.0,2900.0,vDepth)*0.68;gl_FragColor=vec4(mix(vColor,vec3(0.68,0.77,0.68),fog),1.0);}`;
 const createResources=()=>{
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));return shader};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  const position=gl.getAttribLocation(program,'aPosition'),color=gl.getAttribLocation(program,'aColor');
  const uniforms=Object.fromEntries(['uCamera','uForward','uRight','uPitch','uProjection'].map(name=>[name,gl.getUniformLocation(program,name)]));
  return {program,position,color,uniforms,staticBuffer:gl.createBuffer(),carBuffer:gl.createBuffer(),version:-1,count:0};
 };
 const toVertices=faces=>{
  const data=[];
  for(const face of faces){const hex=face.color.replace('#',''),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)/255),v=face.vertices;for(let k=1;k<v.length-1;k++)for(const point of[v[0],v[k],v[k+1]])data.push(...point,...rgb)}
  return new Float32Array(data);
 };
 return {surface,draw(camera,forward,right,pitch,focal,horizon,carFaces){
  if(gl.isContextLost()){resources=undefined;return false}
  if(resources===undefined){try{resources=createResources()}catch{resources=null}}
  if(!resources)return false;
  const {program,position,color,uniforms,staticBuffer,carBuffer}=resources;
  const width=Math.round(w*Math.min(devicePixelRatio||1,2)),height=Math.round(h*Math.min(devicePixelRatio||1,2));
  if(surface.width!==width||surface.height!==height){surface.width=width;surface.height=height}
  gl.viewport(0,0,width,height);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
  gl.uniform3fv(uniforms.uCamera,camera);gl.uniform2fv(uniforms.uForward,forward);gl.uniform2fv(uniforms.uRight,right);gl.uniform2fv(uniforms.uPitch,[Math.cos(pitch),Math.sin(pitch)]);gl.uniform3fv(uniforms.uProjection,[focal*2/w,focal*2/h,1-2*horizon/h]);
  const bind=buffer=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(position);gl.enableVertexAttribArray(color);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(color,3,gl.FLOAT,false,24,12)};
  bind(staticBuffer);
  if(resources.version!==roadMeshVersion){const data=toVertices(roadMesh);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);resources.count=data.length/6;resources.version=roadMeshVersion}
  gl.drawArrays(gl.TRIANGLES,0,resources.count);
  if(carFaces.length){bind(carBuffer);const data=toVertices(carFaces);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.drawArrays(gl.TRIANGLES,0,data.length/6)}
  if(gl.isContextLost()){resources=undefined;return false}
  ctx.drawImage(surface,0,0,w,h);
  if(gl.isContextLost()){resources=undefined;return false}
  return true;
 }};
}
function drawMountainPerspective(){
 if(mountainRenderer===undefined){try{mountainRenderer=createMountainRenderer()}catch{mountainRenderer=null}}
 if(!mountainRenderer)return false;
 const pose=perspectivePose(),{chase,pitch,focal,horizon}=pose;
 if(activeMap.id==='circuit'&&typeof DriveArt!=='undefined')DriveArt.backdrop(pose);else drawMountainBackdrop(horizon,focal,pitch);
 const faces=chase?playerCarMesh():[];
 faces.push(...racerMesh());
 if(typeof DrivePresentation!=='undefined')faces.push(...DrivePresentation.worldMesh());
 if(activeMap.generic)faces.push(...courseDynamicMesh());
 if(!mountainRenderer.draw(pose.camera,pose.forward,pose.right,pitch,focal,horizon,faces))return false;
 if(!chase)drawCockpit();
 return true;
}
