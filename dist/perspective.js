'use strict';
let viewMode='first';
const viewButtons=Array.from(document.querySelectorAll('[data-view]'));
function selectView(mode){viewMode=mode;document.body.classList.toggle('perspective',mode!=='top');for(const b of viewButtons)b.setAttribute('aria-pressed',String(b.dataset.view===mode));try{localStorage.setItem('graybox-drive-view',mode)}catch{}}
try{const saved=localStorage.getItem('graybox-drive-view');if(['first','chase','top'].includes(saved))viewMode=saved}catch{}
for(const b of viewButtons)b.onclick=()=>selectView(b.dataset.view);
window.addEventListener('keydown',e=>{if(e.code==='KeyV'&&!e.repeat){selectView(['first','chase','top'][(['first','chase','top'].indexOf(viewMode)+1)%3])}});selectView(viewMode);
const roadMesh=[];
function quad(vertices,color){roadMesh.push({vertices,color})}
function edgePoint(i,offset,height=0){let a=Math.PI/2+(i%N)/N*TAU,p=track[i%N],nx=310*Math.cos(a),nz=560*Math.sin(a),len=Math.hypot(nx,nz);return[p.x+nx/len*offset,height,p.y+nz/len*offset]}
for(let i=0;i<N;i+=3){
quad([edgePoint(i,211,-2),edgePoint(i+3,211,-2),edgePoint(i+3,600,-2),edgePoint(i,600,-2)],'#293b38');
quad([edgePoint(i,110),edgePoint(i+3,110),edgePoint(i+3,210),edgePoint(i,210)],'#9b977d');
quad([edgePoint(i,202,.5),edgePoint(i+3,202,.5),edgePoint(i+3,211,.5),edgePoint(i,211,.5)],i%2?'#d3b45f':'#323e35');
quad([edgePoint(i,211,0),edgePoint(i+3,211,0),edgePoint(i+3,211,-90),edgePoint(i,211,-90)],'#536258');
quad([edgePoint(i,-110),edgePoint(i+3,-110),edgePoint(i+3,110),edgePoint(i,110)],'#727d75');
quad([edgePoint(i,-93,.3),edgePoint(i+3,-93,.3),edgePoint(i+3,93,.3),edgePoint(i,93,.3)],'#505c57');
for(const side of[-1,1])quad([edgePoint(i,side*94,.7),edgePoint(i+3,side*94,.7),edgePoint(i+3,side*106,.7),edgePoint(i,side*106,.7)],Math.floor(i/3)%2?'#dce2d5':'#839180');
if(i%5<3)quad([edgePoint(i,-1.4,.9),edgePoint(i+3,-1.4,.9),edgePoint(i+3,1.4,.9),edgePoint(i,1.4,.9)],'#cbd3c1');
}
for(let i=0;i<20;i++)quad([[740,.95,710+i*10],[750,.95,710+i*10],[750,.95,720+i*10],[740,.95,720+i*10]],i%2?'#e9eddf':'#293930');
function cuboidMesh(x,z,ww,dd,hh,colors=['#93a19a','#65746e','#7b8c80'],angle=0){const c=Math.cos(angle),s=Math.sin(angle);const v=(dx,y,dz)=>[x+dx*c-dz*s,y,z+dx*s+dz*c];const a=v(-ww/2,0,-dd/2),b=v(ww/2,0,-dd/2),c1=v(ww/2,0,dd/2),d=v(-ww/2,0,dd/2),A=v(-ww/2,hh,-dd/2),B=v(ww/2,hh,-dd/2),C=v(ww/2,hh,dd/2),D=v(-ww/2,hh,dd/2);return[{vertices:[A,B,C,D],color:colors[0]},{vertices:[a,b,B,A],color:colors[1]},{vertices:[b,c1,C,B],color:colors[2]},{vertices:[c1,d,D,C],color:colors[1]},{vertices:[d,a,A,D],color:colors[2]}]}
for(const o of obstacles)roadMesh.push(...cuboidMesh(o.x,o.y,o.w,o.d,o.h,o.w===7?['#d4dfbc','#7c8d74','#9bab8e']:undefined));
function clipNear(points){const out=[],near=4;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],inside=a[2]>=near,next=b[2]>=near;if(inside)out.push(a);if(inside!==next){const t=(near-a[2])/(b[2]-a[2]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near])}}return out}
function drawPerspective(){
const chase=viewMode==='chase',fx=Math.cos(car.angle),fz=Math.sin(car.angle),rx=-fz,rz=fx;
const cx=car.x-fx*(chase?150:6),cz=car.y-fz*(chase?150:6),cy=(chase?92:19)-hazard.fall*hazard.fall*80,pitch=(chase?.36:.055)+Math.min(.65,hazard.fall*.5),cp=Math.cos(pitch),sp=Math.sin(pitch),focal=Math.min(w*.82,h*1.35),horizon=h*.42;
const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#8baba6');sky.addColorStop(.48,'#c1cbb8');sky.addColorStop(.49,'#9baa94');sky.addColorStop(1,'#74856e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
const transform=v=>{const dx=v[0]-cx,dy=v[1]-cy,dz=v[2]-cz,forward=dx*fx+dz*fz;return[dx*rx+dz*rz,dy*cp+forward*sp,forward*cp-dy*sp]};
const faces=[];const add=face=>{let pts=clipNear(face.vertices.map(transform));if(pts.length<3)return;const depth=pts.reduce((s,p)=>s+p[2],0)/pts.length;if(depth>2200)return;faces.push({pts,depth,color:face.color})};
for(const face of roadMesh)add(face);
if(chase){for(const face of cuboidMesh(car.x,car.y,42,23,12,['#d2fa60','#869e3d','#aec64e'],car.angle))add(face);for(const face of cuboidMesh(car.x-fx*3,car.y-fz*3,19,20,20,['#526c60','#314e44','#486359'],car.angle))add(face)}
faces.sort((a,b)=>b.depth-a.depth);
for(const face of faces){ctx.beginPath();face.pts.forEach((p,i)=>{const x=w/2+p[0]*focal/p[2],y=horizon-p[1]*focal/p[2];if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle=face.color;ctx.fill();ctx.strokeStyle=face.color;ctx.lineWidth=.6;ctx.stroke()}
if(!chase)drawCockpit();
}
function drawCockpit(){
// Fixed cockpit geometry gives the moving world a stable reference.
ctx.fillStyle='#bed75e';ctx.beginPath();ctx.moveTo(w*.2,h*.9);ctx.lineTo(w*.35,h*.75);ctx.lineTo(w*.65,h*.75);ctx.lineTo(w*.8,h*.9);ctx.closePath();ctx.fill();ctx.strokeStyle='#829d44';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.42,h*.77);ctx.lineTo(w*.38,h*.9);ctx.moveTo(w*.58,h*.77);ctx.lineTo(w*.62,h*.9);ctx.stroke();
ctx.fillStyle='#24332d';ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,h*.88);ctx.quadraticCurveTo(w*.5,h*.78,w,h*.88);ctx.lineTo(w,h);ctx.fill();
ctx.save();ctx.translate(w*.5,h*1.03);ctx.rotate(car.steer*.55);ctx.strokeStyle='#102019';ctx.lineWidth=Math.max(10,h*.035);ctx.beginPath();ctx.arc(0,0,h*.17,0,TAU);ctx.stroke();ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-h*.15,-h*.06);ctx.lineTo(0,0);ctx.lineTo(h*.15,-h*.06);ctx.stroke();ctx.restore();
ctx.strokeStyle='#273c32';ctx.lineWidth=Math.max(5,w*.008);ctx.beginPath();ctx.moveTo(0,h*.88);ctx.lineTo(w*.08,0);ctx.moveTo(w,h*.88);ctx.lineTo(w*.92,0);ctx.stroke();
}
function drawMinimap(){const mw=Math.min(150,w*.2),mh=mw*2/3;ctx.save();ctx.translate(18,52);ctx.fillStyle='#1c2b25c9';ctx.beginPath();ctx.roundRect(0,0,mw,mh,7);ctx.fill();ctx.scale(mw/1500,mh/1000);line('#abb8a2',45);ctx.translate(car.x,car.y);ctx.rotate(car.angle);ctx.fillStyle='#d2fa60';ctx.beginPath();ctx.moveTo(40,0);ctx.lineTo(-25,-23);ctx.lineTo(-25,23);ctx.closePath();ctx.fill();ctx.restore()}
