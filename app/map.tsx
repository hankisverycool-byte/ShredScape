"use client";
import {useEffect,useRef,useState} from 'react';
import {BOUNDS,LOCATIONS,ZONES,TRAILS,MOUNTAINS,LIFTS,PARK_FEATURES,groundHeight,trailX} from './world';
import {COURSE} from './race';
import {railShape,kickerClass} from './park';

// Top-down map of the whole valley, drawn from the same terrain, trails, parks and lifts the game uses.
// The shaded base is built a slice at a time so opening the game never stalls; labels and pins are vector overlays.
// The mountain is long and narrow, so the map lies on its side: downhill runs left to right.
// The course is long and narrow, so the map lies on its side (downhill runs left to right) and is stretched across so the width is readable.
const PX=.06,XS=3.2,W=Math.round((BOUNDS.maxY-BOUNDS.minY)*PX),H=Math.round((BOUNDS.maxX-BOUNDS.minX)*PX*XS);
const toMap=(x:number,y:number)=>[(y-BOUNDS.minY)*PX,(x-BOUNDS.minX)*PX*XS] as [number,number];
const LEVEL={green:'#3fae5a',blue:'#3a74d6',black:'#1d2326'};
let cache:HTMLCanvasElement|null=null,cacheUrl='',building=false;const waiting:(()=>void)[]=[];
const sm=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
function ensureMap(cb:()=>void){
 if(cache){cb();return;}waiting.push(cb);if(building)return;building=true;
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d')!,img=ctx.createImageData(W,H),hs=new Float32Array((W+1)*(H+1));
 let row=0;const hAt=(px:number,py:number)=>groundHeight(BOUNDS.minX+py/(PX*XS),BOUNDS.minY+px/PX);
 // pass 1 (sliced): heights. pass 2: shade from neighbours.
 function slice(){const t0=performance.now();
  while(row<=H&&performance.now()-t0<8){for(let px=0;px<=W;px++)hs[row*(W+1)+px]=hAt(px,row);row++;}
  if(row<=H){setTimeout(slice,0);return;}
  for(let py=0;py<H;py++)for(let px=0;px<W;px++){
   const i=py*(W+1)+px,h=hs[i],shade=Math.max(-.25,Math.min(.25,((h-hs[i+1])+(h-hs[i+W+1]))*.22)),x=BOUNDS.minX+py/(PX*XS),y=BOUNDS.minY+px/PX;
   // forest tint (same rule as the game's treeline) and bare rock on the steeps
   const forest=0,steep=Math.hypot(h-hs[i+1],h-hs[i+W+1])/(1/PX)>.055;
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
   if(f.kind==='ramp'){const c=kickerClass(f);ctx.fillStyle='#e8762c';ctx.strokeStyle='#10201a';ctx.lineWidth=1;const w=Math.max(2.5,c.half*PX*XS*.9),h=Math.max(2.5,c.run*PX*.5);ctx.beginPath();ctx.ellipse(mx,my,h,w,0,0,7);ctx.fill();ctx.stroke();}
   else if(f.kind==='rail'){const r=railShape(f);ctx.strokeStyle=r.box?'#d6453b':'#e0a63c';ctx.lineWidth=r.box?3:2;ctx.beginPath();ctx.moveTo(mx-r.len*PX/2,my);ctx.lineTo(mx+r.len*PX/2,my);ctx.stroke();}}
  // timed course gates
  for(const g of [COURSE.start,...COURSE.gates]){const [gx,gy]=toMap(g.x,g.y),hw=g.w*PX*XS/2;ctx.lineWidth=g.kind==='gate'?3:4;ctx.strokeStyle=g.kind==='gate'?(g.n%2?'#d6453b':'#2f6fd1'):'#13261e';ctx.beginPath();ctx.moveTo(gx,gy-hw);ctx.lineTo(gx,gy+hw);ctx.stroke();}
  cache=c;cacheUrl=c.toDataURL();building=false;waiting.splice(0).forEach(f=>f());}
 slice();
}
function useMap(){const [,set]=useState(0);useEffect(()=>{ensureMap(()=>set(n=>n+1));},[]);return cache;}
const arrow=(angle:number)=>`rotate(${90+angle*180/Math.PI})`;

export type Waypoint={x:number;y:number;name:string};
export function WorldMap({x,y,angle,selected,onSelect,waypoint,onPick}:{x:number;y:number;angle:number;selected?:string;onSelect:(id:string)=>void;waypoint?:Waypoint|null;onPick:(x:number,y:number)=>void}){
 useMap();const [px,py]=toMap(x,y),wp=waypoint?toMap(waypoint.x,waypoint.y):null;
 // Tap anywhere on the map to drop a waypoint there.
 function click(e:React.MouseEvent<SVGSVGElement>){const r=e.currentTarget.getBoundingClientRect(),vx=-40+(e.clientX-r.left)/r.width*(W+80),vy=-24+(e.clientY-r.top)/r.height*(H+48);
  const wx=BOUNDS.minX+vy/(PX*XS),wy=BOUNDS.minY+vx/PX;if(wx>=BOUNDS.minX&&wx<=BOUNDS.maxX&&wy>=BOUNDS.minY&&wy<=BOUNDS.maxY)onPick(Math.round(wx),Math.round(wy));}
 return <div className="world-map2">
  <svg viewBox={`-40 -24 ${W+80} ${H+48}`} role="img" aria-label="Aspen mountain map. Tap the map to set a waypoint." onClick={click}>
   {cacheUrl?<image href={cacheUrl} width={W} height={H}/>:<rect width={W} height={H} fill="#dfe9e4"/>}
   {MOUNTAINS.map(m=>{const [mx,my]=toMap(m.x,-560);return <text key={m.id} className="map-mtn" x={mx} y={my} textAnchor="middle">{m.name.toUpperCase()}</text>;})}
   {ZONES.map(z=>{const [ax,ay]=toMap(z.x0,z.y0),[bx,by]=toMap(z.x1,z.y1),x0=Math.min(ax,bx),y0=Math.min(ay,by);return <g key={z.id}><rect className={'map-zone '+z.kind} x={x0} y={y0} width={Math.abs(bx-ax)} height={Math.abs(by-ay)} stroke={z.color} fill={z.color}/>{!LOCATIONS.some(l=>l.name===z.name)&&<text className="map-zone-label" x={x0+Math.abs(bx-ax)/2} y={y0-4} textAnchor="middle">{z.name}</text>}</g>;})}
   {TRAILS.map(t=>{const ym=(t.pts[0][0]+t.pts[t.pts.length-1][0])/2,xm=trailX(t,ym)!,[tx,ty]=toMap(xm,ym);return <text key={t.id} className={'map-trail '+t.level} x={tx} y={ty+(t.id==='spar-gulch'?-6:-5)} textAnchor="middle">{t.name}</text>;})}
   {wp&&<g><line x1={px} y1={py} x2={wp[0]} y2={wp[1]} stroke="#ff4a1c" strokeWidth="3" strokeDasharray="8 6"/><g transform={`translate(${wp[0]},${wp[1]})`}><path d="M0,0 L0,-26" stroke="#13261e" strokeWidth="3"/><path d="M0,-26 L18,-20 L0,-14 Z" fill="#ff4a1c" stroke="#fff" strokeWidth="1.5"/><circle r="4" fill="#13261e"/></g><text className="map-wp-label" x={wp[0]+22} y={wp[1]-30}>{waypoint!.name}</text></g>}
   {LOCATIONS.map(l=>{const [lx,ly]=toMap(l.x,l.y),sel=selected===l.id;return <g key={l.id} className={'map-pin'+(sel?' sel':'')} transform={`translate(${lx},${ly})`} onClick={e=>{e.stopPropagation();onSelect(l.id);}} role="button" aria-label={'Select '+l.name}><circle r="20" fill="transparent"/>{sel&&<circle r="15" fill="none" stroke="#ff4a1c" strokeWidth="3"/>}<circle r="9" fill={l.color} stroke="#13261e" strokeWidth="3"/><text className="map-pin-label" y="-16" textAnchor="middle">{l.name}</text></g>;})}
   <g transform={`translate(${px},${py})`}><g transform={arrow(angle)}><path d="M0,-15 L10,10 L0,5 L-10,10 Z" fill="#ee7f4a" stroke="#fff" strokeWidth="3"/></g><text className="map-you" y="30" textAnchor="middle">YOU</text></g>
  </svg>
  <span className="map-north">Downhill <small>→</small></span>
 </div>;
}

export function MiniMap({x,y,angle,peers=[],waypoint,gate=-1}:{x:number;y:number;angle:number;peers?:{x:number;y:number;outfit:{jacket:string}}[];waypoint?:Waypoint|null;gate?:number}){
 // A route view of the slope ahead: shaded relief (cool = flatter, deep blue = steep), barriers, gates and park features. Downhill is down the screen.
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!,size=c.width,halfW=760,back=350,ahead=1650,kx=size/(2*halfW),ky=size/(back+ahead),cxm=BOUNDS?0:0;void cxm;
  const sx=(wx:number)=>size/2+(wx-courseX(y))*kx,sy=(wy:number)=>(wy-(y-back))*ky;
  ctx.fillStyle='#e8f1f7';ctx.fillRect(0,0,size,size);
  const N=30,cw=size/N;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const wx=courseX(y)-halfW+(i+.5)/N*2*halfW,wy=y-back+(j+.5)/N*(back+ahead),sl=(groundHeight(wx,wy+40)-groundHeight(wx,wy-40))/80,rel=(groundHeight(wx+30,wy)-groundHeight(wx-30,wy))/60,v=Math.max(0,Math.min(1,Math.abs(sl)*7+Math.abs(rel)*3)),out=Math.abs(wx)>640;
   ctx.fillStyle=out?`rgb(${150-v*40|0},${178-v*40|0},${170-v*30|0})`:`rgb(${238-v*120|0},${246-v*95|0},${255-v*50|0})`;ctx.fillRect(i*cw,j*cw,cw+1,cw+1);}
  ctx.lineWidth=3;for(const bx of [-640,640]){ctx.strokeStyle='#ff6a2a';ctx.beginPath();ctx.moveTo(sx(bx),0);ctx.lineTo(sx(bx),size);ctx.stroke();}
  for(const f of PARK_FEATURES){if(f.y<y-back||f.y>y+ahead)continue;ctx.fillStyle=f.kind==='rail'?'#1c2a33':'#ff8a3a';ctx.fillRect(sx(f.x)-3,sy(f.y)-2,6,4);}
  const g=COURSE.gates;ctx.lineWidth=4;g.forEach((q,i)=>{if(q.y<y-back||q.y>y+ahead)return;const next=i===gate,done=gate>=0&&i<gate;ctx.strokeStyle=done?'#7a8791':next?'#ffffff':i%2?'#e5322d':'#2a6bd6';ctx.beginPath();ctx.moveTo(sx(q.x-q.w/2),sy(q.y));ctx.lineTo(sx(q.x+q.w/2),sy(q.y));ctx.stroke();if(next){ctx.fillStyle='#fff';ctx.fillRect(sx(q.x)-5,sy(q.y)-5,10,10);}});
  for(const p of peers){ctx.fillStyle=p.outfit.jacket;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(p.x),sy(p.y),5,0,7);ctx.fill();ctx.stroke();}
  if(waypoint){ctx.fillStyle='#ff4a1c';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(Math.max(8,Math.min(size-8,sx(waypoint.x))),Math.max(8,Math.min(size-8,sy(waypoint.y))),6,0,7);ctx.fill();ctx.stroke();}
  ctx.save();ctx.translate(sx(x),sy(y));ctx.rotate(Math.PI-angle);ctx.fillStyle='#ee7f4a';ctx.strokeStyle='#13261e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 },[x,y,angle,peers,waypoint,gate]);
 return <canvas ref={ref} className="minimap" width={180} height={180} aria-label="Route minimap"/>;
}
const courseX=(_y:number)=>0;
