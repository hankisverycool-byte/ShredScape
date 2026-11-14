// Ski/board physics: where the skis point (heading) and where the rider moves (velocity) are separate.
// Edges convert sideways motion into the new direction up to a grip limit (carving, lossless);
// beyond that the skis are sideways to travel and edges scrape speed away (skidding).
export type Snow='groomed'|'powder'|'ice';
export const SNOW:Record<Snow,{grip:number;scrape:number;drag:number;label:string}>={
 groomed:{grip:900,scrape:850,drag:10,label:'Groomed'},
 powder:{grip:700,scrape:1100,drag:26,label:'Powder'},
 ice:{grip:380,scrape:280,drag:5,label:'Ice'},
};
// drag = snow friction (constant); air drag grows with speed squared.
export const GRAVITY=2800,AIR=.0008,PUSH=145,TURN_RATE=1.7;
export const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export type SkiInput={steer:number;push:boolean;brake:boolean;boost:boolean;sensitivity:number;gradX:number;gradY:number;snow:Snow;pivot?:boolean;pushScale?:number;tuck?:number;rand?:()=>number};
export function stepSki(s:{vx:number;vy:number;angle:number},inp:SkiInput,dt:number){
 const S=SNOW[inp.snow],rand=inp.rand||Math.random;
 let {vx,vy,angle}=s;
 const sp0=Math.hypot(vx,vy),course0=sp0>1?Math.atan2(vx,vy):angle;
 // Hockey stop: swing the skis across the direction of travel and brace on the edges.
 const stopping=inp.brake&&sp0>25;
 if(stopping){const side=Math.sign(Math.sin(angle-course0))||1;angle+=wrap(course0+side*Math.PI/2-angle)*Math.min(1,dt*7);}
 else{
  // Flat pivot: holding a turn while the skis are near sideways releases the edges and spins the skis
  // through quickly, so regular <-> switch keeps momentum instead of scrubbing it.
  const across=Math.abs(Math.sin(angle-course0)),pivot=inp.pivot?1.6:inp.steer&&sp0>15&&across>.7?.8:0;
  angle+=inp.steer*TURN_RATE*inp.sensitivity*dt*(1+pivot);
 }
 if(stopping){
  // Skis braced across the slide: momentum keeps its direction, edges scrape speed off as skis come across.
  const cx=Math.sin(course0),cy=Math.cos(course0),across=Math.abs(Math.sin(angle-course0));
  const sp=Math.max(0,sp0+(-inp.gradX*cx-inp.gradY*cy)*GRAVITY*dt-(S.drag+(S.grip+S.scrape)*1.3*across)*dt);
  return{vx:cx*sp,vy:cy*sp,angle,speed:sp,course:course0,carve:0,skid:Math.min(1,sp/120)*across,slip:Math.asin(across),latX:cx*sp*.6,latY:cy*sp*.6,stopping,fakie:Math.cos(angle-course0)<0};
 }
 let dx=Math.sin(angle),dy=Math.cos(angle);
 if(vx*dx+vy*dy<0){dx=-dx;dy=-dy;} // riding switch: skis run tail-first
 const px=dy,py=-dx,gx=-inp.gradX*GRAVITY,gy=-inp.gradY*GRAVITY,gAlong=gx*dx+gy*dy;
 let u=vx*dx+vy*dy,w=vx*px+vy*py;
 // Along the skis: gravity and push accelerate, snow friction and air drag slow.
 u+=(gAlong+(inp.push?PUSH*(inp.pushScale??1):0))*dt;
 // A tuck cuts air drag by up to 50%, so holding the push key at speed still pays off.
 const drag=S.drag+AIR*sp0*sp0*(1-.5*(inp.tuck||0))+(inp.brake?240:0);
 u-=Math.sign(u)*Math.min(Math.abs(u),drag*dt);
 // Across the skis: gravity pushes sideways, edges resist up to their grip.
 w+=(gx*px+gy*py)*dt;
  const aw=Math.abs(w),slip=Math.atan2(aw,Math.abs(u)+1e-6),carve=Math.max(0,Math.min(1,1-(slip-.12)/.3));
 // Edges released: an unweighted pivot (J + turn), or holding a turn while sideways.
 const flat=inp.pivot?.06:inp.steer&&!inp.brake&&slip>.8?.12:1;
 let w1=aw-Math.min(aw,S.grip*flat*dt);
 // Carving bends the motion into the new direction without losing speed.
 const uCarve=(Math.sign(u)||1)*Math.sqrt(Math.max(0,u*u+aw*aw-w1*w1));
 u+=(uCarve-u)*carve*(inp.pivot?0:1);
 // Skidding scrapes the remaining sideways speed away.
 w1=Math.max(0,w1-S.scrape*flat*dt*(1-carve));
 if(inp.snow==='ice'&&carve<.8)w1+=(rand()-.5)*90*dt*(1-carve); // edge chatter
 w=Math.sign(w)*w1;
 vx=u*dx+w*px;vy=u*dy+w*py;
 let sp=Math.hypot(vx,vy);const max=inp.boost?700:520; // cap: ~94 km/h, or ~126 km/h boosting
if(sp>max){vx*=max/sp;vy*=max/sp;sp=max;}
 if(sp<3&&!inp.push&&Math.abs(gAlong)<S.drag){vx=0;vy=0;sp=0;}
 return{vx,vy,angle,speed:sp,course:sp>1?Math.atan2(vx,vy):angle,carve,skid:(1-carve)*flat*Math.min(1,sp/120),slip,latX:w*px,latY:w*py,stopping,fakie:vx*Math.sin(angle)+vy*Math.cos(angle)<0};
}
