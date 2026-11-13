"use client";
import {useEffect,useRef,useState} from 'react';
import {BOUNDS,LOCATIONS,groundHeight,featuresNear,onTrail,type Feature} from './world';

// Top-down map drawn from the same terrain, trails and features the game uses. Rendered once, then cached.
const PX=.12,W=Math.round((BOUNDS.maxX-BOUNDS.minX)*PX),H=Math.round((BOUNDS.maxY-BOUNDS.minY)*PX);
const toMap=(x:number,y:number)=>[(x-BOUNDS.minX)*PX,(y-BOUNDS.minY)*PX];
let cache:HTMLCanvasElement|null=null;
function mapImage(){
 if(cache)return cache;
 const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d')!,img=ctx.createImageData(W,H);
 for(let py=0;py<H;py++)for(let px=0;px<W;px++){
  const x=BOUNDS.minX+px/PX,y=BOUNDS.minY+py/PX,h=groundHeight(x,y);
  // Hillshade lit from the north-west.
  const shade=Math.max(-.25,Math.min(.25,((h-groundHeight(x+12,y))+(h-groundHeight(x,y+12)))*.35));
  const lake=Math.hypot(x+1100,y-2100)<290;
  const [r,g,b]=lake?[132,190,206]:onTrail(x,y)?[246,244,233]:[214,228,222];
  // Contour line every 4 height units.
  const contour=Math.floor(h/4)!==Math.floor(groundHeight(x,y+1/PX)/4)||Math.floor(h/4)!==Math.floor(groundHeight(x+1/PX,y)/4);
  const k=(1+shade)*(contour&&!lake?.86:1),i=(py*W+px)*4;img.data[i]=r*k;img.data[i+1]=g*k;img.data[i+2]=b*k;img.data[i+3]=255;
 }
 ctx.putImageData(img,0,0);
 // Lift line.
 ctx.strokeStyle='#4d5f57';ctx.lineWidth=1.5;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(...toMap(480,BOUNDS.minY) as [number,number]);ctx.lineTo(...toMap(480,BOUNDS.maxY) as [number,number]);ctx.stroke();ctx.setLineDash([]);
 const seen=new Map<string,Feature>();for(let y=BOUNDS.minY;y<=BOUNDS.maxY+1500;y+=2500)for(const x of [-1500,0,1500])for(const f of featuresNear(x,y))seen.set(f.id,f);
 for(const f of seen.values()){const [mx,my]=toMap(f.x,f.y);
  if(f.kind==='tree'){ctx.fillStyle='#2f5446';ctx.beginPath();ctx.moveTo(mx,my-4*f.size);ctx.lineTo(mx+3*f.size,my+2.5*f.size);ctx.lineTo(mx-3*f.size,my+2.5*f.size);ctx.fill();}
  else if(f.kind==='rock'){ctx.fillStyle='#7c918a';ctx.beginPath();ctx.arc(mx,my,2.4*f.size,0,7);ctx.fill();}
  else if(f.kind==='ramp'){ctx.fillStyle='#c98a4f';ctx.fillRect(mx-4,my-2,8,4);}
  else if(f.kind==='rail'){ctx.strokeStyle='#e0a63c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(mx,my-6);ctx.lineTo(mx,my+6);ctx.stroke();}}
 return cache=c;
}
const arrow=(angle:number)=>`rotate(${180-angle*180/Math.PI})`;

export function WorldMap({x,y,angle,onTravel}:{x:number;y:number;angle:number;onTravel:(id:string)=>void}){
 // Only rendered after the player opens the map, so document exists.
 const [src]=useState(()=>typeof document==='undefined'?'':mapImage().toDataURL());
 const [px,py]=toMap(x,y);
 return <div className="world-map2">
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frostpeak map">
   {src&&<image href={src} width={W} height={H}/>}
   {LOCATIONS.map(l=>{const [lx,ly]=toMap(l.x,l.y);return <g key={l.id} className="map-pin" transform={`translate(${lx},${ly})`} onClick={()=>onTravel(l.id)} role="button" aria-label={'Travel to '+l.name}>
    <circle r="11" fill={l.color} stroke="#13261e" strokeWidth="3"/><text y="-18" textAnchor="middle">{l.name}</text></g>;})}
   <g transform={`translate(${px},${py}) ${arrow(angle)}`}><path d="M0,-13 L9,9 L0,4 L-9,9 Z" fill="#ee7f4a" stroke="#fff" strokeWidth="2.5"/></g>
  </svg>
  <span className="map-north">N ↑ <small>Downhill ↓</small></span>
 </div>;
}

export function MiniMap({x,y,angle,peers=[]}:{x:number;y:number;angle:number;peers?:{x:number;y:number;outfit:{jacket:string}}[]}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=ref.current;if(!c)return;const ctx=c.getContext('2d')!,size=c.width,span=1400*PX,[px,py]=toMap(x,y),k=size/span;
  ctx.clearRect(0,0,size,size);ctx.drawImage(mapImage(),px-span/2,py-span/2,span,span,0,0,size,size);
  for(const p of peers){const [qx,qy]=toMap(p.x,p.y);ctx.fillStyle=p.outfit.jacket;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(size/2+(qx-px)*k,size/2+(qy-py)*k,5,0,7);ctx.fill();ctx.stroke();}
  ctx.save();ctx.translate(size/2,size/2);ctx.rotate(Math.PI-angle);ctx.fillStyle='#ee7f4a';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
 },[x,y,angle,peers]);
 return <canvas ref={ref} className="minimap" width={180} height={180} aria-label="Minimap"/>;
}
