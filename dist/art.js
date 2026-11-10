'use strict';
const DriveArt=(()=>{
 const palette={'#505c57':'#292b39','#727d75':'#454658','#839180':'#21bfe2','#dce2d5':'#d3f6ff','#9b977d':'#55515e','#293b38':'#383645'};
 // The original concept supplies sky texture only. Cars, roads and city remain live geometry.
 const dusk=new Image();dusk.src=new URL('dusk-sky.webp',document.currentScript.src).href;
 const playerColors=['#e2333f','#881c32','#b52d43'];
 function carMesh(x,z,angle,colors=playerColors,base=0){
  const c=Math.cos(angle),s=Math.sin(angle),faces=[];
  const v=(f,r,y)=>[x+f*c-r*s,base+y,z+f*s+r*c];
  const face=(points,color)=>faces.push({vertices:points.map(p=>v(...p)),color});
  const box=(f,r,l,w,h,shade,y)=>faces.push(...cuboidMesh(x+f*c-r*s,z+f*s+r*c,l,w,h,shade,angle,base+y));
  const rubber=['#25212b','#11131d','#302c38'],metal=['#9c8492','#302a39','#625867'];
  face([[-21,-9,4],[-19,-11.5,12],[12,-11.5,11],[21,-9,6]],colors[1]);
  face([[-21,9,4],[21,9,6],[12,11.5,11],[-19,11.5,12]],colors[2]);
  face([[-19,-11.5,12],[-19,11.5,12],[-9,10,12],[-9,-10,12]],colors[0]);
  face([[8,-10,12],[8,10,12],[21,9,6],[21,-9,6]],colors[0]);
  face([[-21,-9,4],[-21,9,4],[-19,11.5,12],[-19,-11.5,12]],colors[1]);
  face([[21,-9,6],[21,9,6],[21,9,2],[21,-9,2]],colors[1]);
  face([[-9,-10,12],[-5,-8,20],[3,-8,20],[8,-10,12]],'#343145');
  face([[-9,10,12],[8,10,12],[3,8,20],[-5,8,20]],'#292c3d');
  face([[-5,-8,20],[-5,8,20],[3,8,20],[3,-8,20]],colors[0]);
  face([[3,-8,20],[3,8,20],[8,10,12],[8,-10,12]],'#6b627d');
  face([[-9,-10,12],[-9,10,12],[-5,8,20],[-5,-8,20]],'#252638');
  for(const f of[-13,12])for(const side of[-1,1]){
   const wheel=(radius,inner,outer,shade)=>{
    const points=[];
    for(let k=0;k<12;k++){
     const a=k/12*TAU,b=(k+1)/12*TAU;
     const at=(t,r)=>[f+Math.cos(t)*radius,side*r,5.5+Math.sin(t)*radius];
     face([at(a,inner),at(b,inner),at(b,outer),at(a,outer)],shade[k%shade.length]);points.push(at(a,outer));
    }
    face(points,shade[0]);
   };
   wheel(5,10.5,13.4,rubber);wheel(3.2,13.4,13.7,metal);
   for(let spoke=0;spoke<5;spoke++){
    const a=spoke/5*TAU,b=a+.17;
    face([[f,side*13.8,5.5],[f+Math.cos(a)*3,side*13.8,5.5+Math.sin(a)*3],[f+Math.cos(b)*3,side*13.8,5.5+Math.sin(b)*3]],'#c9a49c');
   }
  }
  box(0,0,43,22,2,rubber,.5);
  box(-20.8,0,1.1,18,1.5,['#ffcfbf','#fa5b62','#ff9e93'],10);
  for(const r of[-8,8]){box(20.6,r,1.3,5,1.6,['#fff3d3','#c6ebff','#fff5e6'],7);box(-18,r,2,1.2,5,metal,12)}
  box(-18,0,5,29,1.5,[colors[0],'#261c2d',colors[1]],17);
  box(-21.5,0,1.2,13,3,rubber,2);
  for(const r of[-5,5])box(-22,r,1,3,2,['#8ddfff','#3e5268','#acddff'],3);
  if(colors===playerColors)box(-3,0,9,2.5,.35,['#60ddff','#60ddff','#60ddff'],20.1);
  return faces;
 }
 function circuit(){
  const faces=[];
  const box=(x,z,a,b,c,colors,angle=0,base=0)=>faces.push(...cuboidMesh(x,z,a,b,c,colors,angle,base));
  const ribbon=(i,j,a,b,color,height=.8)=>faces.push({vertices:[edgePoint(i,a,height),edgePoint(j,a,height),edgePoint(j,b,height),edgePoint(i,b,height)],color,ground:true,layer:3});
  for(let i=0;i<N;i+=3){
   const j=i+3;
   for(const side of[-1,1]){ribbon(i,j,side*108,side*110,'#ff9c52');ribbon(i,j,side*87,side*88.5,'#69d5eb')}
   if(i%9===0)ribbon(i,i+1,-65,-64,'#484451',1);
  }
  for(let i=5;i<N;i+=10){
   const p=edgePoint(i,128),q=track[(i+1)%N],t=track[i],angle=Math.atan2(q.y-t.y,q.x-t.x);
   box(p[0],p[2],3,33,20,['#646070','#393541','#4a4253'],angle);
   const c=Math.cos(angle),s=Math.sin(angle),v=(f,r,y)=>[p[0]+f*c-r*s,y,p[2]+f*s+r*c];
   for(const shift of[-7,7])faces.push({vertices:[[2,shift-7,5],[2,shift,10],[2,shift-7,15],[2,shift-3,15],[2,shift+4,10],[2,shift-3,5]].map(p=>v(...p)),color:'#ffbc60'});
    if(i%20===5){
    const a=edgePoint(i,0,1.1),v=(f,r)=>[a[0]+f*c-r*s,1.1,a[2]+f*s+r*c];
    for(const f of[-8,3])faces.push({vertices:[[f-5,-9],[f+1,-9],[f+8,0],[f+1,9],[f-5,9],[f+2,0]].map(p=>v(...p)),color:'#32c9ec',ground:true,layer:4});
   }
  }
  for(let i=0;i<N;i+=9)for(const side of[-1,1]){
   const p=edgePoint(i,side*(340+(i%4)*30)),height=135+(i*43%235);
   box(p[0],p[2],50+(i%3)*14,48,height+300,['#9c8495','#555063','#706174'],0,-300);
   if(i%3===0)box(p[0],p[2],52+(i%3)*14,50,2,['#e0b89d','#93778a','#b19296'],0,height);
  }
  const center=[-900,160,500],radius=140,thickness=15;
  for(let k=0;k<32;k++){
   const a=k/32*TAU,b=(k+1)/32*TAU,v=(theta,r,x)=>[center[0]+x,center[1]+Math.cos(theta)*r,center[2]+Math.sin(theta)*r];
   faces.push({vertices:[v(a,radius,-9),v(b,radius,-9),v(b,radius-thickness,-9),v(a,radius-thickness,-9)],color:'#8d7d93'});
   faces.push({vertices:[v(a,radius,9),v(b,radius,9),v(b,radius,-9),v(a,radius,-9)],color:'#b6a0ac'});
   faces.push({vertices:[v(a,radius-thickness,-9),v(b,radius-thickness,-9),v(b,radius-thickness,9),v(a,radius-thickness,9)],color:'#554f66'});
  }
  box(730,490,720,34,12,['#7b7287','#4a465b','#645a72'],0,108);
  for(const x of[440,730,1020])box(x,490,22,22,108,['#8f8092','#4e495e','#706175']);
  for(const z of[471,509])box(730,z,720,2,9,['#c3a6a5','#6e5b72','#8c7385'],0,120);
  for(const i of[0,60,120,180]){
   const p=track[i],q=track[(i+1)%N],angle=Math.atan2(q.y-p.y,q.x-p.x),colors=['#a2f0ff','#247b9b','#38c8f1'];
   for(const side of[-1,1]){const a=edgePoint(i,side*116);box(a[0],a[2],6,6,86,colors,angle)}
   box(p.x,p.y,6,238,6,colors,angle,82);
   if(i===0)for(let k=0;k<24;k++)for(let row=0;row<2;row++){
    const a=edgePoint(0,-110+k*9.2,1.1),c=Math.cos(angle),s=Math.sin(angle);
    box(a[0]+row*5*c,a[2]+row*5*s,5,9.2,.25,[k%2===row?'#d9f5ff':'#24394c','#24394c','#24394c'],angle,1.05);
   }
  }
  return faces;
 }
 function backdrop(pose){
  const skyline=pose.horizon-Math.tan(pose.pitch)*pose.focal;
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#565272');sky.addColorStop(.48,'#dda4a3');sky.addColorStop(1,'#6f627e');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  if(dusk.complete&&dusk.naturalWidth){
   const height=Math.max(h*.52,skyline),scale=Math.max(w/dusk.naturalWidth,height/dusk.naturalHeight);
   const sourceWidth=w/scale,sourceHeight=height/scale;
   ctx.save();ctx.globalAlpha=.92;ctx.drawImage(dusk,(dusk.naturalWidth-sourceWidth)/2,(dusk.naturalHeight-sourceHeight)/2,sourceWidth,sourceHeight,0,0,w,height);ctx.restore();
  }
  const sunX=((.75-car.angle/TAU)%1+1)%1*w,sunY=Math.max(25,skyline-h*.16);
  const glow=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,h*.3);glow.addColorStop(0,'#ffe8b775');glow.addColorStop(1,'#ffe8b700');ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#fff1ce';ctx.beginPath();ctx.arc(sunX,sunY,Math.max(9,h*.022),0,TAU);ctx.fill();
  ctx.fillStyle='#51475f';ctx.fillRect(0,Math.max(skyline,h*.65),w,h);
 }
 function labels(pose){
  if(activeMap.id!=='circuit')return;
  const cp=Math.cos(pose.pitch),sp=Math.sin(pose.pitch);
  for(const i of[0,60,120,180]){
   const p=track[i],dx=p.x-pose.camera[0],dy=103-pose.camera[1],dz=p.y-pose.camera[2],f=dx*pose.forward[0]+dz*pose.forward[1],right=dx*pose.right[0]+dz*pose.right[1],depth=f*cp-dy*sp;
   if(depth<65||depth>1250)continue;
   const x=w/2+right*pose.focal/depth,y=pose.horizon-(dy*cp+f*sp)*pose.focal/depth,size=Math.max(8,Math.min(22,pose.focal/depth*9));
   if(x<0||x>w||y<(w<600?250:110)||y>h*.7||x>w-280&&y<220)continue;
   ctx.save();ctx.textAlign='center';ctx.font='italic 800 '+size+'px sans-serif';ctx.lineWidth=4;ctx.strokeStyle='#29283e';ctx.fillStyle='#98efff';
   const text=i===0?(lap===3?'FINISH':'START / LAP'):'CHECKPOINT';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();
  }
 }
 return {palette,playerColors,carMesh,circuit,backdrop,labels};
})();
