'use strict';
const DriveArt=(()=>{
 const palette={'#505c57':'#303b40','#727d75':'#687c78','#839180':'#287d7e','#dce2d5':'#e5ddbd','#9b977d':'#96a48b','#293b38':'#294948'};
 function carDetails(x,z,angle,color='#d2fa60',base=0){
  const c=Math.cos(angle),s=Math.sin(angle),faces=[];
  const part=(forward,right,width,depth,height,colors,y)=>faces.push(...cuboidMesh(x+forward*c-right*s,z+forward*s+right*c,width,depth,height,colors,angle,base+y));
  const rubber=['#283337','#131d23','#202b31'],metal=['#66818a','#283b44','#435d65'];
  for(const forward of[-13,12])for(const right of[-12,12]){
   part(forward,right,9,4,8,rubber,1);
   part(forward,right*1.035,4,4.2,4,metal,3);
  }
  part(0,0,43,22,3,rubber,.5);
  part(-3,0,10,18,1,[color,color,color],20);
  for(const right of[-8,8]){
   part(-21.2,right,1.3,5,2.5,['#ff8366','#ed5d53','#ff9270'],8);
   part(21.2,right,1.3,5,2,['#fff4c6','#d8e5b9','#fff4c6'],8);
   part(-17,right,2,1.5,5,metal,12);
  }
  part(-18,0,4,28,2,rubber,17);
  part(-22,0,1.2,13,3,metal,2);
  part(21.8,0,1.2,15,2,metal,2);
  return faces;
 }
 function circuit(){
  const faces=[];
  const box=(x,z,a,b,c,colors,angle=0,base=0)=>faces.push(...cuboidMesh(x,z,a,b,c,colors,angle,base));
  for(let i=6;i<N;i+=12){
   const p=edgePoint(i,150),q=track[(i+1)%N],t=track[i],angle=Math.atan2(q.y-t.y,q.x-t.x);
   box(p[0],p[2],3,22,32,['#e7e3be','#246d70','#358e8a'],angle);
   const c=Math.cos(angle),s=Math.sin(angle),v=(f,r,y)=>[p[0]+f*c-r*s,y,p[2]+f*s+r*c];
   faces.push({vertices:[v(2,-8,7),v(2,0,17),v(2,-8,27),v(2,-3,27),v(2,5,17),v(2,-3,7)],color:'#eddfaa'});
   const inner=edgePoint(i,-160);
   box(inner[0],inner[2],6,6,19,['#8a7860','#665940','#746149']);
   for(let tier=0;tier<3;tier++){
    const size=36-tier*8,base=12+tier*14,tip=base+24;
    const verts=[[inner[0]-size/2,base,inner[2]-size/2],[inner[0]+size/2,base,inner[2]-size/2],[inner[0]+size/2,base,inner[2]+size/2],[inner[0]-size/2,base,inner[2]+size/2]],peak=[inner[0],tip,inner[2]];
    for(let k=0;k<4;k++)faces.push({vertices:[verts[k],verts[(k+1)%4],peak],color:['#397b72','#24594f','#307568','#4a8d78'][k]});
   }
  }
  for(const center of[510,1020]){
   for(let row=0;row<4;row++){
    box(center,32+row*14,180,14,8+row*10,['#c7c9b7','#718b85','#90a39a']);
    for(let col=-3;col<=3;col++)box(center+col*23,32+row*14,15,7,5,[row%2?'#f0dba7':'#53aaa0','#316d70','#408e86'],0,8+row*10);
   }
   for(const side of[-1,1])box(center+side*95,55,4,4,95,['#bbc4af','#526a65','#819991']);
   box(center,55,202,100,5,['#d9d7bd','#667f79','#91a99e'],0,95);
  }
  return faces;
 }
 function backdrop(pose){
  const skyline=pose.horizon+Math.tan(pose.pitch)*pose.focal;
  const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#ddab90');sky.addColorStop(.48,'#f1d6ae');sky.addColorStop(1,'#92b1a2');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const sunX=((.75-car.angle/TAU)%1+1)%1*w;
  ctx.fillStyle='#fff1bb';ctx.beginPath();ctx.arc(sunX,Math.max(25,skyline-h*.19),Math.max(12,h*.035),0,TAU);ctx.fill();
  for(let layer=0;layer<3;layer++){
   const step=w*.23,shift=car.angle/TAU*w*(layer+1)*.16;
   ctx.fillStyle=['#90aaa4','#6d9490','#4e7975'][layer];ctx.beginPath();ctx.moveTo(-step,h);
   for(let i=-2;i<9;i++){const x=i*step-(shift%step);ctx.lineTo(x,skyline-h*.025);ctx.lineTo(x+step*.48,skyline-h*(.09+layer*.04)-Math.sin(i*2.2+layer)*h*.035);ctx.lineTo(x+step,skyline+h*.03)}
   ctx.lineTo(w+step,h);ctx.closePath();ctx.fill();
  }
 }
 return {palette,carDetails,circuit,backdrop};
})();
