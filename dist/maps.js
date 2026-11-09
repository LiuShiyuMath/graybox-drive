'use strict';

// Distances are world units: 10 units = 1 metre, as in the original car physics.
const DriveMaps = (() => {
  function mountainTrack(count) {
    const points = [
      [900, 3400, 0], [900, 3100, 24], [650, 2750, 82],
      [820, 2390, 150], [1180, 2220, 212], [1370, 1900, 270],
      [1050, 1670, 335], [600, 1570, 405], [340, 1290, 470],
      [560, 1010, 532], [1120, 900, 598], [1400, 650, 660],
      [1200, 300, 727], [750, 180, 790], [500, -120, 852],
      [850, -450, 914], [1280, -520, 974], [1500, -850, 1020]
    ].map(([x, y, z]) => ({x, y, z}));
    const dense = [];
    const interpolate = (a, b, c, d, t) => .5 * (
      2*b + (-a+c)*t + (2*a-5*b+4*c-d)*t*t + (-a+3*b-3*c+d)*t*t*t
    );
    for (let i = 0; i < points.length - 1; i++) {
      const a=points[Math.max(0,i-1)], b=points[i], c=points[i+1], d=points[Math.min(points.length-1,i+2)];
      for (let k = 0; k < 48; k++) {
        const t=k/48;
        dense.push({x:interpolate(a.x,b.x,c.x,d.x,t), y:interpolate(a.y,b.y,c.y,d.y,t), z:b.z+(c.z-b.z)*t});
      }
    }
    dense.push(points.at(-1));
    const lengths=[0];
    for(let i=1;i<dense.length;i++) lengths.push(lengths.at(-1)+Math.hypot(dense[i].x-dense[i-1].x,dense[i].y-dense[i-1].y));
    const total=lengths.at(-1), result=[];
    let j=1;
    for(let i=0;i<count;i++) {
      const distance=i/(count-1)*total;
      while(j<lengths.length-1&&lengths[j]<distance)j++;
      const t=(distance-lengths[j-1])/(lengths[j]-lengths[j-1]);
      const a=dense[j-1],b=dense[j];
      result.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    }
    return result;
  }

  function create(id, count) {
    const mountain=id==='mountain';
    const track=mountain?mountainTrack(count):Array.from({length:count},(_,i)=>{
      const a=Math.PI/2+i/count*Math.PI*2;
      return{x:750+560*Math.cos(a),y:500+310*Math.sin(a),z:0};
    });
    const bounds={minX:Math.min(...track.map(p=>p.x)),maxX:Math.max(...track.map(p=>p.x)),minY:Math.min(...track.map(p=>p.y)),maxY:Math.max(...track.map(p=>p.y))};
    let length=0;
    for(let i=1;i<track.length;i++) length+=Math.hypot(track[i].x-track[i-1].x,track[i].y-track[i-1].y);
    if(!mountain)length+=Math.hypot(track[0].x-track.at(-1).x,track[0].y-track.at(-1).y);
    return {id:mountain?'mountain':'circuit',mountain,closed:!mountain,track,bounds,length,
      roadHalf:mountain?57:87,curb:mountain?65:106,edge:mountain?77:160,fall:mountain?96:210,
      title:mountain?'Mountain Road':'Concrete Loop',number:mountain?'02':'01',
      bestKey:mountain?'graybox-drive-best-mountain':'graybox-drive-best'};
  }
  return {create};
})();
