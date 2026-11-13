import {createMountain3D} from './renderer3d';
import {featuresNear,groundHeight,regionAt,snowAt,LOCATIONS,BOUNDS} from './world';
import {stepSki,wrap,SNOW,GRAVITY,type Snow} from './ski-physics';
import {kickerLift,kickerShape,kickerLaunch,railShape,onRail,grindName} from './park';
import {stepRun,idleRun,COURSE,type Run,type Best} from './race';
import type {Feature} from './world';
import {emptyTrick,landingResult,advanceAirTrick,JUMP} from './tricks';
export type Outfit={jacket:string;pants:string;hat:string;gear:'snowboard'|'skis';avatar?:'explorer'|'classic';kit?:string};
export type RiderMotion={spin:number;flip:number;pushPhase:number;pushPower:number;grab:number};
export type Peer={id:string;name:string;x:number;y:number;z:number;angle:number;outfit:Outfit;score:number;motion?:RiderMotion};
export type GameSnapshot={score:number;best:number;combo:number;multiplier:number;trick:string;speed:number;airborne:boolean;distance:number;bailed:boolean;playing:boolean;x:number;y:number;z:number;angle:number;region?:string;creditsEarned?:number;landing?:string;spin?:number;flip?:number;landingReady?:boolean;grab?:number;pushPhase?:number;pushPower?:number;snow?:string;skid?:number;fakie?:boolean;run?:RunView};
export type RunView={state:Run['state'];time:number;gate:number;gates:number;last:Run['last'];lastAge:number;best:number|null;newBest:boolean;missed:number;course:string};
export type GameSettings={quality:'low'|'high';fov:number;sensitivity:number;cameraDistance:number;debugYaw?:number;debugCam?:{yaw:number;dist:number;height:number}};
// Wipeout length in seconds. Space gets you up early after the first 0.6s.
export const BAIL=1.8;
// World features plus the timed-run gates near the rider.
function nearby(x:number,y:number):Feature[]{const out=featuresNear(x,y);for(const g of [COURSE.start,...COURSE.gates])if(Math.abs(g.y-y)<1500)out.push({kind:g.kind,x:g.x,y:g.y,size:g.w,seed:g.n,id:'race'+g.n});return out;}
export function createGame(canvas:HTMLCanvasElement,onUpdate:(s:GameSnapshot)=>void){
 const mountain=createMountain3D(canvas);let outfit:Outfit={jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear:'snowboard'};
 let x=0,y=0,z=0,vz=0,vx=0,vy=0,course=0,fakie=false,lift=0,rail:Feature|null=null,kicker:Feature|null=null,edge=0,skid=0,absorb=0,backseat=0,snow:Snow='groomed',speed=0,angle=0,score=0,best=0,combo=0,multiplier=1,clock=0,bail=0,grace=1,totalDistance=0,creditsEarned=0;
 let playing=false,destroyed=false,raf=0,last=performance.now(),pub=0,featureTime=0,jumpCooldown=0,bankTime=0,pushPhase=0,pushPower=0;
 let trick='Choose your own line.',landing='',view='start',settings:GameSettings={quality:'high',fov:65,sensitivity:1,cameraDistance:10};
 let run:Run=idleRun(),runBest:Best|null=null;try{runBest=JSON.parse(localStorage.getItem('shredscape-run-best')||'null');}catch{}
 let tricks=emptyTrick(),features=nearby(x,y),peers:Peer[]=[],visualPeers:Peer[]=[];
 const pressed=new Set<string>(),particles:{x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;life:number}[]=[];
 try{best=Number(localStorage.getItem('shredscape-best'))||0;}catch{}
 const emit=()=>onUpdate({score,best,combo,multiplier,trick,speed:Math.round(speed*.18),airborne:z>0,distance:Math.round(totalDistance/10),bailed:bail>0,playing,x,y,z:z+lift,angle,region:regionAt(x,y),creditsEarned,landing,spin:tricks.spin,flip:tricks.flip,landingReady:landingResult(tricks).clean,grab:pressed.has('grab')&&z>0?1:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,snow:SNOW[snow].label,skid,fakie,run:{state:run.state,time:run.state==='running'?clock-run.t0+run.penalty:run.total,gate:run.next,gates:COURSE.gates.length,last:run.last,lastAge:clock-run.lastAt,best:runBest?.total??null,newBest:run.newBest,missed:run.missed,course:COURSE.name}});
 function puff(p:{x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;life:number}){particles.push(p);if(particles.length>220)particles.splice(0,particles.length-220);}
 function spray(n:number){for(let i=0;i<n;i++)puff({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*20,z:Math.random()*12,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,vz:20+Math.random()*25,size:2+Math.random()*4,life:.3+Math.random()*.5});}
 // Snow thrown by the skis: skids push a sideways sheet, powder lifts a soft plume, clean carves throw almost nothing.
 function snowSpray(dt:number,latX:number,latY:number){const lat=Math.hypot(latX,latY)||1,ox=latX/lat,oy=latY/lat;
  const sheet=skid*speed*dt*.5;for(let i=0;i<Math.floor(sheet)+(Math.random()<sheet%1?1:0);i++)puff({x:x+(Math.random()-.5)*12,y:y+(Math.random()-.5)*12,z:2,vx:ox*(50+Math.random()*60)+vx*.3,vy:oy*(50+Math.random()*60)+vy*.3,vz:25+Math.random()*35,size:2+Math.random()*3+skid*2,life:.35+Math.random()*.4});
  if(snow==='powder'&&speed>40){const plume=speed*dt*.12;for(let i=0;i<Math.floor(plume)+(Math.random()<plume%1?1:0);i++)puff({x:x+(Math.random()-.5)*16,y:y+(Math.random()-.5)*16,z:1,vx:-vx*.15+(Math.random()-.5)*20,vy:-vy*.15+(Math.random()-.5)*20,vz:18+Math.random()*25,size:4+Math.random()*5,life:.6+Math.random()*.6});}}
 function jump(ramp=false){if(!playing||z>0||bail||jumpCooldown)return;
  if(rail){z=Math.max(1,lift);lift=0;rail=null;vz=JUMP.pop*.85;absorb=-.4;spray(4);return;} // pop off the rail, keeping the grind in the combo
  z=lift+1;lift=0;kicker=null;absorb=-.4;vz=ramp?JUMP.ramp:JUMP.pop;tricks=emptyTrick();combo=0;multiplier=1;bankTime=0;landing='';trick=ramp?'BIG AIR':'AIR TIME';spray(8);}
 // Tumble keeps most momentum (the rider slides); hitting a tree stops you harder.
 function wipeout(hard=false){bail=BAIL;lift=0;rail=null;kicker=null;const k=hard?.25:.8;vx*=k;vy*=k;speed*=k;z=0;vz=0;combo=0;multiplier=1;trick='Wipeout · unbanked combo lost';landing='Missed landing';tricks=emptyTrick();spray(24);}
 // On a rail: locked to its line, sliding with low friction. Turn to swing between 50-50 and a sideways slide.
 function grind(dt:number,steer:number){const r=railShape(rail!),dir=vy<0?-1:1,gy=(groundHeight(x,y+4)-groundHeight(x,y-4))/8;
  speed=Math.max(0,speed+(-gy*GRAVITY*dir-8)*dt);angle+=steer*2.4*dt;vx=(rail!.x-x)*10;vy=dir*speed;course=dir>0?0:Math.PI;fakie=Math.cos(angle-course)<0;
  skid=0;edge*=Math.exp(-6*dt);absorb+=(.2-absorb)*Math.min(1,dt*6);lift+=(r.height-lift)*Math.min(1,dt*16);
  tricks.grinding=true;tricks.grind=grindName(angle,outfit.gear==='snowboard',fakie);tricks.grindDist=(tricks.grindDist||0)+speed*dt;
  const pv=landingResult(tricks);combo=pv.base;multiplier=pv.multiplier;trick=pv.names.join(' + ');bankTime=1;
  if(y<r.start-2||y>r.end+2||speed<20){z=Math.max(1,lift);lift=0;vz=0;rail=null;} // off the end: drop to the snow
 }
 function land(){const result=landingResult(tricks);absorb=Math.max(absorb,Math.min(1,-vz/240));
 // Landing tilted back on a flip: the skis shoot forward ("backseat"). Rideable, but costs balance.
 const lean=tricks.flip-Math.round(tricks.flip/(Math.PI*2))*Math.PI*2;if(result.clean&&lean>.5){backseat=1;vx+=Math.sin(angle)*35;vy+=Math.cos(angle)*35;}
 // The air spin becomes the new heading: a 180 lands switch, with no snap back to forward.
 angle-=tricks.spin;z=0;vz=0;jumpCooldown=.25;if(!result.clean){wipeout();return;}combo=result.base;multiplier=result.multiplier;score+=result.points;creditsEarned+=Math.floor(result.points/100);best=Math.max(best,score);try{localStorage.setItem('shredscape-best',String(best));}catch{}trick=result.names.join(' + ')||'Clean landing';landing=result.points?'BANKED +'+result.points:'Clean landing';bankTime=2.5;grace=.45;spray(12);tricks=emptyTrick();}
 const keys:Record<string,string>={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',KeyJ:'grab',KeyH:'grabtype',KeyR:'restart',ShiftLeft:'boost'};
 function reset(){run=idleRun();lift=0;rail=null;kicker=null;x=0;y=0;z=0;angle=0;speed=0;vx=0;vy=0;fakie=false;score=0;combo=0;multiplier=1;tricks=emptyTrick();bail=0;grace=1;features=nearby(x,y);pressed.clear();landing='';emit();}
 function input(action:string,down:boolean){action=keys[action]||action;const already=pressed.has(action);if(down)pressed.add(action);else pressed.delete(action);if(!down||already)return;if(action==='restart'){reset();return;}if(action==='jump'){if(bail>.35&&bail<BAIL-.6)bail=.35;else jump();}if(z>0){if(action==='grabtype'){const names=['Indy','Mute','Tail grab','Nose grab'];tricks.grab=names[(names.indexOf(tricks.grab)+1)%names.length];}}}
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.matches('input,select,textarea'))return;const a=keys[e.code];if(a&&playing){e.preventDefault();input(a,true);}}
 function keyup(e:KeyboardEvent){if(keys[e.code])input(keys[e.code],false);}
 function blur(){pressed.clear();}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
 function update(dt:number){clock+=dt;if(playing){const rx=x,ry=y;jumpCooldown=Math.max(0,jumpCooldown-dt);grace=Math.max(0,grace-dt);bankTime=Math.max(0,bankTime-dt);if(bankTime===0&&z===0){combo=0;multiplier=1;}
 if(bail>0){bail=Math.max(0,bail-dt);if(!bail)grace=1.8;const f=Math.exp(-2.4*dt);vx*=f;vy*=f;speed=Math.hypot(vx,vy);const n={x:x+vx*dt,y:y+vy*dt};x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,n.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,n.y));}else{
 const steer=Number(pressed.has('right'))-Number(pressed.has('left'));const wasAirborne=z>0;
 const pushing=!wasAirborne&&pressed.has('up');pushPower+=((pushing?1:0)-pushPower)*Math.min(1,dt*12);if(pushPower>.01)pushPhase+=dt*(outfit.gear==='skis'?4.5:6);
 snow=snowAt(x,y);let latX=0,latY=0;
 if(rail)grind(dt,steer);
 else if(!wasAirborne){
  const r=stepSki({vx,vy,angle},{steer,push:pushing,brake:pressed.has('down'),boost:pressed.has('boost'),pivot:pressed.has('grab')&&!!steer,sensitivity:settings.sensitivity,gradX:(groundHeight(x+4,y)-groundHeight(x-4,y))/8,gradY:(groundHeight(x,y+4)-groundHeight(x,y-4))/8,snow},dt);
  // Edge angle follows how hard the motion is actually turning (lateral load vs grip); a hockey stop braces against the slide.
  const turn=dt>0?wrap(r.course-course)/dt:0,load=-(r.speed*turn)/SNOW[snow].grip+(r.stopping?Math.sign(Math.sin(r.angle-r.course))*-.8*r.skid:0);
  edge+=(Math.max(-1,Math.min(1,r.speed>8?load:0))-edge)*Math.min(1,dt*8);
  if(r.speed>12&&Math.abs(Math.cos(r.angle-r.course))>.5)fakie=r.fakie;vx=r.vx;vy=r.vy;angle=r.angle;speed=r.speed;course=r.course;skid=r.skid;latX=r.latX;latY=r.latY;
  // Knees soak up terrain: compress where the slope curves up into you, extend into dips.
  const c=course,h0=groundHeight(x,y),curv=(groundHeight(x+Math.sin(c)*20,y+Math.cos(c)*20)+groundHeight(x-Math.sin(c)*20,y-Math.cos(c)*20)-2*h0)/400;
  absorb+=(Math.max(-.5,Math.min(1,curv*speed*speed*.4))-absorb)*Math.min(1,dt*6);
 }else{const f=Math.exp(-.15*dt);vx*=f;vy*=f;speed=Math.hypot(vx,vy);skid=0;edge*=Math.exp(-4*dt);absorb*=Math.exp(-4*dt);}
 backseat*=Math.exp(-2.5*dt);
 const before={x,y};const next={x:x+vx*dt,y:y+vy*dt};x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,next.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,next.y));totalDistance+=Math.hypot(x-before.x,y-before.y);
 if(x!==next.x||y!==next.y){vx=0;vy=0;speed=0;trick='Mountain boundary · turn around or open the map';}
 if(z===0&&!rail){
  // Kicker: ride up the snow face, launch off the lip with speed.
  const k=vy>0?features.find(f=>f.kind==='ramp'&&kickerLift(f,x,y)>0):undefined;
  if(k){kicker=k;lift=kickerLift(k,x,y);absorb+=(.35-absorb)*Math.min(1,dt*8);}
  else if(kicker){const sh=kickerShape(kicker);
   if(y>=sh.lip&&Math.abs(x-kicker.x)<=sh.half+6){z=Math.max(1,sh.height);vz=kickerLaunch(kicker,speed);if(vz>0){tricks=emptyTrick();combo=0;multiplier=1;bankTime=0;landing='';trick='BIG AIR';absorb=-.4;spray(8);}}
   lift=0;kicker=null;}
  // Rail: ride onto it along its line.
  else if(speed>45&&Math.abs(Math.cos(course))>.5){const r=features.find(f=>f.kind==='rail'&&onRail(f,x,y,5));if(r){rail=r;tricks=emptyTrick();combo=0;multiplier=1;landing='';grace=1;}}
 }
 if(z>0){vz-=JUMP.gravity*dt;z+=vz*dt;tricks=advanceAirTrick(tricks,steer,Number(pressed.has('down'))-Number(pressed.has('up')),dt);if(pressed.has('grab'))tricks.grabTime+=dt;const preview=landingResult(tricks);combo=preview.base;multiplier=preview.multiplier;trick=preview.names.join(' + ')||'AIR TIME';
  // Coming down onto a rail: lock on. The spin so far becomes your stance on the rail; an unfinished flip still wipes out.
  const r=vz<0?features.find(f=>f.kind==='rail'&&onRail(f,x,y,4)&&z<=railShape(f).height+3):undefined;
  if(r){const flipErr=Math.abs(tricks.flip-Math.round(tricks.flip/(Math.PI*2))*Math.PI*2);
   if(flipErr>1.1)wipeout();else{angle-=tricks.spin;tricks={...tricks,spin:Math.round(tricks.spin/Math.PI)*Math.PI,grinding:true};rail=r;lift=railShape(r).height;z=0;vz=0;grace=1;spray(6);}}
  else if(z<=0)land();}
 else snowSpray(dt,latX,latY);
 featureTime+=dt;if(featureTime>.5){featureTime=0;features=nearby(x,y);}
 for(const f of features){const d=Math.hypot(x-f.x,y-f.y);if((f.kind==='tree'||f.kind==='rock')&&d<10*f.size&&z+lift<12&&!grace){wipeout(true);break;}}
 }
 {const r=stepRun(run,runBest,rx,ry,x,y,clock);run=r.run;if(r.best!==runBest){runBest=r.best;try{localStorage.setItem('shredscape-run-best',JSON.stringify(runBest));}catch{}}}
 }
 for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z=Math.max(0,q.z+q.vz*dt);q.vz-=70*dt;q.vx*=Math.exp(-2*dt);q.vy*=Math.exp(-2*dt);if(q.life<0)particles.splice(i,1);}
 visualPeers=peers.map(p=>{const old=visualPeers.find(v=>v.id===p.id);if(!old||Math.hypot(old.x-p.x,old.y-p.y)>400)return p;return{...p,x:old.x+(p.x-old.x)*Math.min(1,dt*9),y:old.y+(p.y-old.y)*Math.min(1,dt*9),z:old.z+(p.z-old.z)*Math.min(1,dt*9)};});
 pub+=dt;if(pub>.1){pub=0;emit();}
 }
 function frame(now:number){if(destroyed)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);mountain.draw({x,y,z,lift,rail:!!rail,angle,speed,clock,bail,course,fakie,edge,skid,absorb,backseat,snow,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,spin:tricks.spin,flip:tricks.flip,grab:pressed.has('grab')&&z>0?1:0,playing,outfit,features,peers:visualPeers,particles,view,settings});raf=requestAnimationFrame(frame);}
 raf=requestAnimationFrame(frame);emit();
 return{start(){playing=true;view='game';emit();},pause(){playing=false;pushPower=0;pressed.clear();emit();},reset,input,setOutfit(o:Outfit){outfit={...o};},setPeers(p:Peer[]){peers=p;},setView(v:string){view=v;},setSettings(s:GameSettings){settings=s;},// Dev/test only: place the rider at an exact spot, heading and velocity.
 debugPlace(px:number,py:number,a:number,dvx=0,dvy=0){lift=0;rail=null;kicker=null;tricks=emptyTrick();x=px;y=py;z=0;angle=a;vx=dvx;vy=dvy;speed=Math.hypot(vx,vy);course=speed>1?Math.atan2(vx,vy):a;fakie=vx*Math.sin(a)+vy*Math.cos(a)<0;bail=0;grace=1;features=nearby(x,y);},
 debugState(){return{x,y,z,angle,speed,course,fakie,run:run.state,next:run.next,clock,spin:tricks.spin,bailed:bail>0,lift,rail:!!rail,score,trick};},
 travel(id:string){const dest=LOCATIONS.find(p=>p.id===id);if(!dest)return;run=idleRun();lift=0;rail=null;kicker=null;x=dest.x;y=dest.y;z=0;speed=0;vx=0;vy=0;angle=0;bail=0;grace=1;combo=0;tricks=emptyTrick();features=nearby(x,y);emit();},destroy(){destroyed=true;cancelAnimationFrame(raf);mountain.destroy();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}};
}
