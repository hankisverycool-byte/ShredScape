"use client";
import {useEffect,useRef,useState} from 'react';
import {BOUNDS,LOCATIONS,ZONES,TRAILS,MOUNTAINS,LIFTS,PARK_FEATURES,groundHeight,trailX} from './world';
import {COURSE} from './race';
import {railShape,kickerClass} from './park';

// Top-down map of the whole valley, drawn from the same terrain, trails, parks and lifts the game uses.
// The shaded base is built a slice at a time so opening the game never stalls; labels and pins are vector overlays.
const PX=.06,W=Math.round((BOUNDS.maxX-BOUNDS.minX)*PX),H=Math.round((BOUNDS.maxY-BOUNDS.minY)*PX);
const toMap=(x:number,y:number)=>[(x-BOUNDS.minX)*PX,(y-BOUNDS.minY)*PX] as [number,number];
const LEVEL={green:'#3fae5a',blue:'#3a74d6',black:'#1d2326'};
let cache:HTMLCanvasElement|null=null,cacheUrl='',building=false;const waiting:(()=>void)[]=[];
const sm=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function ensureMap(cb:()=>void){
 if(cache){cb();return;}waiting.push(cb);if(building)return;building=true;
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d')!,img=ctx.createImageData(W,H),hs=new Float32Array((W+1)*(H+1));
 let row=0;const hAt=(px:number,py:number)=>groundHeight(BOUNDS.minX+px/PX,BOUNDS.minY+py/PX);
 // pass 1 (sliced): heights. pass 2: shade from neighbours.
 function slice(){const t0=performance.now();
  while(row<=H&&performance.now()-t0<8){for(let px=0;px<=W;px++)hs[row*(W+1)+px]=hAt(px,row);row++;}
  if(row<=H){setTimeout(slice,0);return;}
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){
   const i=py*(W+1)+px,h=hs[i],shade=Math.max(-.25,Math.min(.25,((h-hs[i+1])+(h-hs[i+W+1]))*.22)),x=BOUNDS.minX+px/PX,y=BOUNDS.minY+py/PX;
   // forest tint (same rule as the game's treeline) and bare rock on the steeps
   const forest=sm(2300,3500,y)*(.3+.7*(.5+.5*Math.sin(x*.0017+y*.0009)*Math.sin(x*.0011-y*.0014+2)))*(1-sm(9000,9400,y)),steep=Math.hypot(h-hs[i+1],h-hs[i+W+1])/(1/PX)>.055;
   let r=232,g=240,b=236;r-=forest*70;g-=forest*38;b-=forest*58;if(steep){r-=40;g-=34;b-=26;}
   const k=1+shade,o=(py*W+px)*4;img.data[o]=r*k;img.data[o+1]=g*k;img.data[o+2]=b*k;img.data[o+3]=255;}
  ctx.putImageData(img,0,0);
  // trails, coloured by difficulty
  ctx.lineCap='round';for(const t of TRAILS){ctx.strokeStyle='#ffffffcc';ctx.lineWidth=t.w*PX+2;ctx.beginPath();let first=true;for(let y=t.pts[0][0];y<=t.pts[t.pts.length-1][0];y+=60){const xx=trailX(t,y)!,[mx,my]=toMap(xx,y);if(first){ctx.moveTo(mx,my);first=false;}else ctx.lineTo(mx,my);}ctx.stroke();
   ctx.strokeStyle=LEVEL[t.level]+'bb';ctx.lineWidth=Math.max(2,t.w*PX*.28);ctx.stroke();}
  // lifts
  ctx.strokeStyle='#27322d';ctx.lineWidth=1.2;ctx.setLineDash([5,3]);for(const L of LIFTS){ctx.beginPath();ctx.moveTo(...toMap(L.x0,L.y0));ctx.lineTo(...toMap(L.x1,L.y1));ctx.stroke();}ctx.setLineDash([]);
  // park features: kickers in their size colour, rails/boxes as bars
  for(const f of PARK_FEATURES){const [mx,my]=toMap(f.x,f.y);
   if(f.kind==='ramp'){const c=kickerClass(f);ctx.fillStyle='#e8762c';ctx.strokeStyle='#10201a';ctx.lineWidth=1;const w=Math.max(2.5,c.half*PX*.9),h=Math.max(2.5,c.run*PX*.5);ctx.beginPath();ctx.ellipse(mx,my,w,h,0,0,7);ctx.fill();ctx.stroke();}
   else if(f.kind==='rail'){const r=railShape(f);ctx.strokeStyle=r.box?'#d6453b':'#e0a63c';ctx.lineWidth=r.box?3:2;ctx.beginPath();ctx.moveTo(mx,my-r.len*PX/2);ctx.lineTo(mx,my+r.len*PX/2);ctx.stroke();}}
  // timed course gates
  for(const g of [COURSE.start,...COURSE.gates]){const [gx,gy]=toMap(g.x,g.y),hw=g.w*PX/2;ctx.lineWidth=g.kind==='gate'?3:4;ctx.strokeStyle=g.kind==='gate'?(g.n%2?'#d6453b':'#2f6fd1'):'#13261e';ctx.beginPath();ctx.moveTo(gx-hw,gy);ctx.lineTo(gx+hw,gy);ctx.stroke();}
  cache=c;cacheUrl=c.toDataURL();building=false;waiting.splice(0).forEach(f=>f());}
 slice();
}
function useMap(){const [,set]=useState(0);useEffect(()=>{ensureMap(()=>set(n=>n+1));},[]);return cache;}
const arrow=(angle:number)=>`rotate(${180-angle*180/Math.PI})`;

export function WorldMap({x,y,angle,onTravel}:{x:number;y:number;angle:number;onTravel:(id:string)=>void}){
 useMap();const [px,py]=toMap(x,y);
 return <div className="world-map2">
  <svg viewBox={`-40 -24 ${W+80} ${H+48}`} role="img" aria-label="Aspen valley map">
   {cacheUrl?<image href={cacheUrl} width={W} height={H}/>:<rect width={W} height={H} fill="#dfe9e4"/>}
   {MOUNTAINS.map(m=>{const [mx,my]=toMap(m.x,-560);return <text key={m.id} className="map-mtn" x={mx} y={my} textAnchor="middle">{({snowmass:'SNOWMASS',buttermilk:'BUTTERMILK',highlands:'HIGHLANDS',aspen:'ASPEN MTN'} as Record<string,string>)[m.id]}</text>;})}
   {ZONES.map(z=>{const [x0,y0]=toMap(z.x0,z.y0),[x1,y1]=toMap(z.x1,z.y1);return <g key={z.id}><rect className={'map-zone '+z.kind} x={x0} y={y0} width={x1-x0} height={y1-y0} stroke={z.color} fill={z.color}/><text className="map-zone-label" x={(x0+x1)/2} y={y0-4} textAnchor="middle">{z.name}</text></g>;})}
   {LOCATIONS.map(l=>{const [lx,ly]=toMap(l.x,l.y);return <g key={l.id} className="map-pin" transform={`translate(${lx},${ly})`} onClick={()=>onTravel(l.id)} role="button" aria-label={'Travel to '+l.name}><circle r="7" fill={l.color} stroke="#13261e" strokeWidth="2.5"/></g>;})}
   <g transform={`translate(${px},${py}) ${arrow(angle)}`}><path d="M0,-13 L9,9 L0,4 L-9,9 Z" fill="#ee7f4a" stroke="#fff" strokeWidth="2.5"/></g>
  </svg>
  <span className="map-north">N ↑ <small>Downhill ↓</small></span>
 </div>;
}

export function MiniMap({x,y,angle,peers=[]}:{x:number;y:number;angle:number;peers?:{x:number;y:number;outfit:{jacket:string}}[]}){
 const ref=useRef<HTMLCanvasElement>(null),ready=useMap();
 useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!,size=c.width,span=1500*PX,[px,py]=toMap(x,y),k=size/span;
  ctx.clearRect(0,0,size,size);ctx.fillStyle='#dfe9e4';ctx.fillRect(0,0,size,size);if(ready)ctx.drawImage(ready,px-span/2,py-span/2,span,span,0,0,size,size);
  for(const p of peers){const [qx,qy]=toMap(p.x,p.y);ctx.fillStyle=p.outfit.jacket;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(size/2+(qx-px)*k,size/2+(qy-py)*k,5,0,7);ctx.fill();ctx.stroke();}
  ctx.save();ctx.translate(size/2,size/2);ctx.rotate(Math.PI-angle);ctx.fillStyle='#ee7f4a';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 },[x,y,angle,peers,ready]);
 return <canvas ref={ref} className="minimap" width={180} height={180} aria-label="Minimap"/>;
}
