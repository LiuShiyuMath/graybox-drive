'use strict';

const DriveCourses = (() => {
  const materials = Object.freeze({
    asphalt: Object.freeze({label:'柏油路面',color:'#46545a',friction:.35,maxSpeed:420,grip:1}),
    grass: Object.freeze({label:'草地',color:'#7a9470',friction:1.35,maxSpeed:180,grip:.72}),
    gravel: Object.freeze({label:'碎石路面',color:'#b49e77',friction:.65,maxSpeed:300,grip:.78}),
    mud: Object.freeze({label:'泥地',color:'#80664e',friction:1.45,maxSpeed:170,grip:.54})
  });
  const definitions = {
    proving: {
      number:'03',title:'Proving Ground',name:'驾驶测试场',theme:'proving',roadHalf:82,
      description:'直线加速、连续 S 弯、起伏坡道和三种路面。完成三圈测试。',
      instructions:'入弯前刹车。草地与泥地会降低抓地力；护栏会阻挡车辆。',
      mission:'在测试场完成 3 圈',sky:'#97b7bd',ground:'#84997d',
      controls:[[0,1000,0],[-480,1000,0],[-760,760,35],[-760,320,100],[-460,60,170],[-200,-250,110],[180,-210,30],[480,-400,0],[920,-200,0],[1050,300,80],[850,760,70],[470,1000,0]],
      sections:[{from:0,to:.36,material:'asphalt',width:172},{from:.36,to:.56,material:'grass',width:152},{from:.56,to:.76,material:'mud',width:166},{from:.76,to:1,material:'asphalt',width:184}]
    },
    city: {
      number:'04',title:'City Blocks',name:'城市街区',theme:'city',roadHalf:84,
      description:'沿路标穿过城市街区。路口有红绿灯和横向车流，完成三圈。',
      instructions:'红灯前停在白线后。绿灯再通过；注意横向车辆。',
      mission:'遵守路口信号，完成 3 圈',sky:'#a8bdc5',ground:'#9da9a7',
      controls:[[0,1000,0],[0,720,0],[0,400,0],[0,50,0],[220,-180,0],[600,-180,0],[1030,-180,0],[1300,50,0],[1300,400,0],[1300,720,0],[1300,1000,0],[1050,1240,0],[600,1240,0],[240,1240,0]],
      sections:[{from:0,to:1,material:'asphalt',width:168}]
    },
    offroad: {
      number:'05',title:'Wild Trail',name:'越野探险',theme:'offroad',roadHalf:79,
      description:'穿越碎石、泥地和土坡。绕开岩石，尝试跳跃和探索捷径。',
      instructions:'泥地与碎石容易侧滑。速度足够时冲上跳台；金色标记可收集。',
      mission:'完成 3 圈，可额外收集 6 个探索标记',sky:'#c1bda5',ground:'#9d9d71',
      controls:[[0,1100,0],[-470,960,30],[-720,580,100],[-630,110,180],[-200,-120,80],[150,-420,20],[630,-410,80],[990,-140,150],[1050,340,20],[800,680,0],[470,1050,0]],
      sections:[{from:0,to:.23,material:'gravel',width:166},{from:.23,to:.43,material:'mud',width:146},{from:.43,to:.68,material:'gravel',width:158},{from:.68,to:.83,material:'grass',width:184},{from:.83,to:1,material:'gravel',width:170}]
    }
  };
  const ids = Object.freeze(Object.keys(definitions));

  function sampleLoop(controls,count) {
    const points=controls.map(([x,y,z])=>({x,y,z})),dense=[];
    const interpolate=(a,b,c,d,t)=>.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    for(let i=0;i<points.length;i++) {
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],d=points[(i+2)%points.length];
      for(let k=0;k<48;k++) {
        const t=k/48;
        dense.push({x:interpolate(a.x,b.x,c.x,d.x,t),y:interpolate(a.y,b.y,c.y,d.y,t),z:interpolate(a.z,b.z,c.z,d.z,t)});
      }
    }
    dense.push({...dense[0]});
    const cumulative=[0];
    for(let i=1;i<dense.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const length=cumulative.at(-1),track=[];
    let cursor=1;
    for(let i=0;i<count;i++) {
      const distance=i/count*length;
      while(cumulative[cursor]<distance)cursor++;
      const t=(distance-cumulative[cursor-1])/(cumulative[cursor]-cumulative[cursor-1]),a=dense[cursor-1],b=dense[cursor];
      track.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    }
    return {track,length};
  }

  function at(track,index,offset=0) {
    const count=track.length,i=((index%count)+count)%count,p=track[i],a=track[(i+count-1)%count],b=track[(i+1)%count];
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
    return {x:p.x-dy/length*offset,y:p.y+dx/length*offset,z:p.z,angle:Math.atan2(dy,dx)};
  }

  function closestIndex(track,x,y) {
    let index=0,distance=Infinity;
    for(let i=0;i<track.length;i++) {
      const d=(track[i].x-x)**2+(track[i].y-y)**2;
      if(d<distance){distance=d;index=i;}
    }
    return index;
  }

  function guardrails(map) {
    const rails=[];
    for(let i=0;i<map.track.length;i+=3) {
      const center=map.track[i];
      if(map.intersections.some(junction=>Math.hypot(center.x-junction.x,center.y-junction.y)<junction.halfWidth+80))continue;
      for(const side of[-1,1]) {
        const p=at(map.track,i,side*(center.width/2+22));
        rails.push({kind:'guardrail',index:i,...p,w:38,d:6,h:15,side,color:'#c4d0c5'});
      }
    }
    return rails;
  }

  function cityContent(map) {
    const streetY=560;
    map.crossRoads=[{id:'cross-street',points:[{x:-520,y:streetY,z:0},{x:1820,y:streetY,z:0}],width:150,material:'asphalt'}];
    map.intersections=[0,1300].map((x,i)=>{
      const index=closestIndex(map.track,x,streetY),p=map.track[index],previous=at(map.track,index-4);
      return {id:'junction-'+i,x,y:streetY,z:p.z,axis:'y',halfWidth:90,period:12,green:6,offset:i*3,stopIndex:(index-4+map.track.length)%map.track.length,stopLine:{...previous,w:p.width,d:5},index};
    });
    map.traffic=[
      {id:'taxi',points:[{x:-480,y:streetY-27,z:0},{x:1780,y:streetY-27,z:0}],speed:90,offset:0,w:40,d:21,h:16,color:'#e6c869',pingPong:true},
      {id:'van',points:[{x:1780,y:streetY+27,z:0},{x:-480,y:streetY+27,z:0}],speed:75,offset:900,w:46,d:24,h:22,color:'#b0c4cb',pingPong:true}
    ];
    const buildings=[[-290,40,210,230,140],[-290,970,220,210,210],[270,180,180,220,175],[580,180,240,210,230],[1030,180,200,190,130],[290,930,180,220,120],[600,930,240,240,260],[1020,930,180,220,190],[1580,100,180,250,220],[1580,980,190,220,160]];
    map.objects.push(...buildings.map(([x,y,w,d,h],i)=>({kind:'building',x,y,z:0,w,d,h,angle:0,color:['#adb7b6','#c0b8a4','#91a8ab'][i%3]})));
    for(const junction of map.intersections) {
      const p=at(map.track,junction.stopIndex,102);
      map.objects.push({kind:'traffic-light',...p,w:8,d:8,h:72,junction:junction.id,color:'#586a67'});
    }
  }

  function offroadContent(map) {
    for(const [index,offset,size] of[[18,-40,22],[43,48,24],[70,-35,27],[102,43,23],[138,-48,26],[174,36,25],[213,-43,21]]) {
      const p=at(map.track,Math.round(index*map.track.length/240),offset);
      map.objects.push({kind:'rock',...p,w:size*1.35,d:size,h:size*.8,color:'#877f68'});
    }
    for(const index of[31,145]) {
      const i=Math.round(index*map.track.length/240),p=at(map.track,i);
      map.ramps.push({kind:'ramp',index:i,...p,w:92,d:52,h:14,launchSpeed:130,span:110,color:'#c5a975'});
    }
    map.objects.push(...map.ramps);
    for(const [id,index,offset] of[['trail-1',15,0],['trail-2',57,15],['trail-3',95,-10],['trail-4',134,0],['trail-5',180,10],['trail-6',219,0]]) {
      const i=Math.round(index*map.track.length/240),p=at(map.track,i,offset);
      map.collectibles.push({id,index:i,...p,radius:28});
    }
    const from=Math.round(map.track.length*.68),to=Math.round(map.track.length*.82),a=at(map.track,from),b=at(map.track,to);
    map.shortcuts=[{id:'meadow-cut',from,to,width:80,material:'grass',points:[a,{x:(a.x+b.x)/2-75,y:(a.y+b.y)/2-55,z:(a.z+b.z)/2},b],label:'草地捷径'}];
  }

  function create(id,count=240) {
    if(!Object.hasOwn(definitions,id))return null;
    if(!Number.isInteger(count)||count<24)throw new RangeError('Course sample count must be an integer of at least 24');
    const definition=definitions[id],sampled=sampleLoop(definition.controls,count),track=sampled.track;
    for(let i=0;i<count;i++) {
      const section=definition.sections.find(s=>i/count>=s.from&&i/count<s.to);
      track[i].width=section.width;
      track[i].material=section.material;
      track[i].bank=id==='proving'?Math.sin(i/count*Math.PI*4)*.025:0;
    }
    const map={id,number:definition.number,title:definition.title,name:definition.name,theme:definition.theme,
      description:definition.description,instructions:definition.instructions,mission:definition.mission,
      sky:definition.sky,ground:definition.ground,mountain:false,generic:true,closed:true,laps:3,
      track,length:sampled.length,roadHalf:definition.roadHalf,curb:definition.roadHalf+20,edge:definition.roadHalf+120,fall:Infinity,
      bounds:{minX:Math.min(...track.map(p=>p.x)),maxX:Math.max(...track.map(p=>p.x)),minY:Math.min(...track.map(p=>p.y)),maxY:Math.max(...track.map(p=>p.y))},
      bestKey:'graybox-drive-best-'+id,materials,checkpoints:[1,2,3,4,5].map(n=>Math.round(count*n/6)),checkpointCount:5,
      objects:[],guardrails:[],crossRoads:[],intersections:[],traffic:[],ramps:[],collectibles:[],shortcuts:[]};
    if(id==='city')cityContent(map);
    if(id==='offroad')offroadContent(map);
    if(id!=='offroad') {
      map.guardrails=guardrails(map);
      map.objects.push(...map.guardrails);
    }
    if(id==='proving') {
      for(const index of[9,69,129,189]) {
        const i=Math.round(index*count/240),p=at(track,i,-(track[i].width/2-20));
        map.objects.push({kind:'cone',index:i,...p,w:11,d:11,h:18,color:'#dc9261'});
      }
    }
    return map;
  }

  return {ids,materials,create};
})();

if(typeof module!=='undefined'&&module.exports)module.exports=DriveCourses;
