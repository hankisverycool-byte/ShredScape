import {createMountain3D} from './renderer3d';
import {featuresNear,groundHeight,regionAt,snowAt,LOCATIONS,BOUNDS,START,PARK_FEATURES} from './world';
import {stepSki,wrap,SNOW,GRAVITY,type Snow} from './ski-physics';
import {pushWeight,tuckWeight} from './rig-pose';
import {kickerLift,kickerSurface,kickerShape,kickerExitVz,kickerJumpVz,kickerClass,chargeMul,CHARGE,railShape,onRail,grindName} from './park';
import {stepRun,idleRun,COURSE,type Run,type Best} from './race';
import type {Feature} from './world';
import {emptyTrick,landingResult,advanceAirTrick,JUMP} from './tricks';
export type Outfit={jacket:string;pants:string;hat:string;gear:'snowboard'|'skis';avatar?:'explorer'|'classic';kit?:string;poles?:'none'|'carbon'|'kit';helmet?:string};
export type RiderMotion={spin:number;flip:number;pushPhase:number;pushPower:number;grab:number};
export type Peer={id:string;name:string;x:number;y:number;z:number;angle:number;outfit:Outfit;score:number;motion?:RiderMotion};
export type ReplayView={on:boolean;t:number;dur:number;cutId:number;cuts:number;cam:string;rate:number;user:number|null;paused:boolean;trick:string;landing:string;bailed:boolean;score:number;peak:number;kmh:number;air:number};
export type Feat={type:string;value:number};
export type GameSnapshot={feats?:Feat[];respawn?:number;respawnName?:string;replay?:ReplayView;replayReady?:boolean;hour?:number;soft?:number;charge?:number;score:number;best:number;combo:number;multiplier:number;trick:string;speed:number;airborne:boolean;distance:number;bailed:boolean;playing:boolean;x:number;y:number;z:number;angle:number;region?:string;creditsEarned?:number;landing?:string;spin?:number;flip?:number;landingReady?:boolean;grab?:number;pushPhase?:number;pushPower?:number;snow?:string;skid?:number;fakie?:boolean;run?:RunView};
export type RunView={state:Run['state'];time:number;gate:number;gates:number;last:Run['last'];lastAge:number;best:number|null;newBest:boolean;missed:number;course:string};
export type GameSettings={timeMode?:'cycle'|'morning'|'midday'|'afternoon';replayKey?:string;quality:'low'|'high';fov:number;sensitivity:number;cameraDistance:number;debugYaw?:number;debugCam?:{yaw:number;dist:number;height:number;look?:number}};
// Wipeout length in seconds. Space gets you up early after the first 0.6s.
export const BAIL=1.8;
// World features plus the timed-run gates near the rider.
function nearby(x:number,y:number):Feature[]{const out=featuresNear(x,y);for(const g of [COURSE.start,...COURSE.gates])if(Math.abs(g.y-y)<1500)out.push({kind:g.kind,x:g.x,y:g.y,size:g.w,seed:g.n,id:'race'+g.n});return out;}
export function createGame(canvas:HTMLCanvasElement,onUpdate:(s:GameSnapshot)=>void){
 const mountain=createMountain3D(canvas);let outfit:Outfit={jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear:'snowboard'};
 let x=START.x,y=START.y,z=0,vz=0,vx=0,vy=0,course=0,fakie=false,lift=0,rail:Feature|null=null,kicker:Feature|null=null,edge=0,skid=0,absorb=0,backseat=0,snow:Snow='groomed',speed=0,angle=0,score=0,best=0,combo=0,multiplier=1,clock=0,bail=0,grace=1,totalDistance=0,creditsEarned=0;
 let respawns=0,respawnName='',peakAir=0,crossAmt=0,scissorAmt=0,lastSpeedFeat=-9,hour=9,swivel=0,lastRailEnd=-99,chain=0,charge=0,charging=false,back=false,playing=false,destroyed=false,raf=0,last=performance.now(),pub=0,featureTime=0,jumpCooldown=0,bankTime=0,pushPhase=0,pushPower=0,tuck=0;
 let trick='Choose your own line.',landing='',view='start',settings:GameSettings={quality:'high',fov:65,sensitivity:1,cameraDistance:10};
 // Time of day: one game hour per real minute from 7:00 to 19:00, then it wraps (dusk and dawn light match, so the loop is seamless). Snow warms up and goes soft from about 11:00 to 16:00.
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const FIXED={morning:8.5,midday:12.5,afternoon:16};
 function softness(){return smooth(11,16,hour);}
 let run:Run=idleRun(),runBest:Best|null=null;try{runBest=JSON.parse(localStorage.getItem('shredscape-run-best')||'null');}catch{}
 let tricks=emptyTrick(),features=nearby(x,y),peers:Peer[]=[],visualPeers:Peer[]=[];
 const pressed=new Set<string>(),particles:{x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;life:number}[]=[];
 try{best=Number(localStorage.getItem('shredscape-best'))||0;}catch{}
  // ---- Instant replay: a rolling buffer of the last ~22 s of what was drawn, played back with broadcast-style cuts and slow-mo in the air. ----
 type Sample={t:number;f:Record<string,any>;m:{trick:string;landing:string;combo:number;mult:number;bail:boolean;score:number}};
 const CUT=3.2,CAMS=['chase','side','low','orbit','side','wide'],USER:(number|null)[]=[null,.25,.5,1,2];
 let hist:Sample[]=[],lastRec=-1,lastEvent=-99,hintUntil=-1,wasAir=false,wasBailed=false;
 let rp:{clip:Sample[];dur:number;rt:number;rate:number;user:number|null;paused:boolean;cut:number;cutId:number;peak:number}|null=null;
 const ANGLES=['angle','course'];
 function sampleAt(clip:Sample[],rt:number){const t=clip[0].t+Math.max(0,Math.min(rt,clip[clip.length-1].t-clip[0].t));let i=0;while(i<clip.length-2&&clip[i+1].t<t)i++;const a=clip[i],b=clip[Math.min(i+1,clip.length-1)],u=b.t>a.t?Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t))):0,o:Record<string,any>={...a.f};
  for(const k in a.f){const p=a.f[k],q=b.f[k];if(typeof p==='number'&&typeof q==='number')o[k]=ANGLES.includes(k)?p+wrap(q-p)*u:p+(q-p)*u;}o.clock=t;return o;}
 function startReplay(){if(rp||!playing||hist.length<30)return false;const end=hist[hist.length-1].t;let start=lastEvent>0&&end-lastEvent<18?lastEvent-2.5:end-8;start=Math.max(start,end-20,hist[0].t);if(end-start<3)start=Math.max(hist[0].t,end-5);
  const clip=hist.filter(s=>s.t>=start);if(clip.length<10)return false;
  rp={clip,dur:clip[clip.length-1].t-clip[0].t,rt:0,rate:1,user:null,paused:false,cut:0,cutId:1,peak:Math.max(...clip.map(s=>(s.f.z+(s.f.lift||0))*.05))};pressed.clear();charging=false;charge=0;emit();return true;}
 function stopReplay(){if(!rp)return;rp=null;pressed.clear();emit();}
 function stepReplay(dt:number){const r=rp!;const cur=sampleAt(r.clip,r.rt),want=cur.z>8||cur.bail>0?.35:1;r.rate+=((r.user??want)-r.rate)*Math.min(1,dt*7);
  if(!r.paused){r.rt+=dt*r.rate;if(r.rt>=r.dur){r.rt=0;r.cutId++;}}const cut=Math.floor(r.rt/CUT);if(cut!==r.cut){r.cut=cut;r.cutId++;}}
 function replayKey(e:KeyboardEvent){const r=rp!,k=e.code;e.preventDefault();
  if(k===(settings.replayKey||'KeyB'))stopReplay();else if(k==='Space')r.paused=!r.paused;else if(k==='ArrowLeft')r.rt=Math.max(0,r.rt-1);else if(k==='ArrowRight')r.rt=Math.min(r.dur-.01,r.rt+1);
  else if(k==='ArrowUp'||k==='ArrowDown'){const i=USER.indexOf(r.user),n=(i+(k==='ArrowUp'?1:USER.length-1))%USER.length;r.user=USER[n];}
  const cut=Math.floor(r.rt/CUT);if(cut!==r.cut){r.cut=cut;r.cutId++;}emit();}
 function replayInfo(){if(!rp)return undefined;const r=rp,cur=sampleAt(r.clip,r.rt),m=r.clip[r.clip.length-1].m;return{on:true,t:r.rt,dur:r.dur,cutId:r.cutId,cuts:Math.ceil(r.dur/CUT),cam:CAMS[r.cut%CAMS.length],rate:r.rate,user:r.user,paused:r.paused,trick:m.trick,landing:m.landing,bailed:m.bail,score:m.score,peak:r.peak,kmh:Math.round(cur.speed*.18),air:Math.max(0,(cur.z+(cur.lift||0))*.05)};}
 const feats:{type:string;value:number}[]=[];const feat=(type:string,value:number)=>{feats.push({type,value});};
 const emit=()=>{const q=feats.splice(0);onUpdate({feats:q,respawn:respawns,respawnName,replay:replayInfo(),replayReady:!rp&&hist.length>30&&clock<hintUntil,score,best,combo,multiplier,trick,speed:Math.round(speed*.18),airborne:z>0,distance:Math.round(totalDistance/10),bailed:bail>0,playing,x,y,z:z+lift,angle,region:regionAt(x,y),creditsEarned,landing,hour,soft:softness(),charge:charging?charge:0,spin:tricks.spin,flip:tricks.flip,landingReady:landingResult(tricks).clean,grab:pressed.has('grab')&&z>0?1:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,snow:SNOW[snow].label,skid,fakie,run:{state:run.state,time:run.state==='running'?clock-run.t0+run.penalty:run.total,gate:run.next,gates:COURSE.gates.length,last:run.last,lastAge:clock-run.lastAt,best:runBest?.total??null,newBest:run.newBest,missed:run.missed,course:COURSE.name}});};
 function puff(p:{x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;life:number}){particles.push(p);if(particles.length>220)particles.splice(0,particles.length-220);}
 function spray(n:number){for(let i=0;i<n;i++)puff({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*20,z:Math.random()*12,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,vz:20+Math.random()*25,size:2+Math.random()*4,life:.3+Math.random()*.5});}
 // Snow thrown by the skis: skids push a sideways sheet, powder lifts a soft plume, clean carves throw almost nothing.
 function snowSpray(dt:number,latX:number,latY:number){const lat=Math.hypot(latX,latY)||1,ox=latX/lat,oy=latY/lat;
  const sheet=skid*speed*dt*.5;for(let i=0;i<Math.floor(sheet)+(Math.random()<sheet%1?1:0);i++)puff({x:x+(Math.random()-.5)*12,y:y+(Math.random()-.5)*12,z:2,vx:ox*(50+Math.random()*60)+vx*.3,vy:oy*(50+Math.random()*60)+vy*.3,vz:25+Math.random()*35,size:2+Math.random()*3+skid*2,life:.35+Math.random()*.4});
  if(snow==='powder'&&speed>40){const plume=speed*dt*.12;for(let i=0;i<Math.floor(plume)+(Math.random()<plume%1?1:0);i++)puff({x:x+(Math.random()-.5)*16,y:y+(Math.random()-.5)*16,z:1,vx:-vx*.15+(Math.random()-.5)*20,vy:-vy*.15+(Math.random()-.5)*20,vz:18+Math.random()*25,size:4+Math.random()*5,life:.6+Math.random()*.6});}}
 function jump(c=1){if(!playing||z>0||bail||jumpCooldown)return;
  if(rail){lastRailEnd=clock;swivel=0;z=Math.max(1,lift);lift=0;rail=null;vz=JUMP.pop*.85*chargeMul(c);absorb=-.4;spray(4);return;} // pop off the rail, keeping the grind in the combo
  if(kicker){ // jump off the kicker face: you keep the surface's upward speed and add a pop that is strongest at the lip
   z=lift+1;vz=kickerJumpVz(kicker,y,vy,c);lift=0;kicker=null;absorb=-.4;tricks=emptyTrick(vz);combo=0;multiplier=1;bankTime=0;landing='';trick='AIR TIME';spray(8);return;}
  z=1;absorb=-.4;vz=JUMP.pop*chargeMul(c);tricks=emptyTrick(vz);combo=0;multiplier=1;bankTime=0;landing='';trick='AIR TIME';spray(8);}
 // Tumble keeps most momentum (the rider slides); hitting a tree stops you harder.
 // Stepping onto a rail soon after leaving another one links them: the chain grows and pays a bonus when banked.
 function linkIn(){chain=clock-lastRailEnd<1.8?chain+1:0;tricks.link=chain;}
 function wipeout(hard=false){bail=BAIL;lift=0;rail=null;kicker=null;back=false;swivel=0;chain=0;charging=false;charge=0;const k=hard?.25:.8;vx*=k;vy*=k;speed*=k;z=0;vz=0;combo=0;multiplier=1;trick='Wipeout · unbanked combo lost';landing='Missed landing';tricks=emptyTrick();spray(24);}
 // On a rail: locked to its line, sliding with low friction. Turn to swing between 50-50 and a sideways slide.
 function grind(dt:number,steer:number){const r=railShape(rail!),dir=vy<0?-1:1,gy=(groundHeight(x,y+4)-groundHeight(x,y-4))/8;
  speed=Math.max(0,speed+(-gy*GRAVITY*dir-8)*dt);angle+=steer*2.4*dt;vx=(rail!.x-x)*10;vy=dir*speed;course=dir>0?0:Math.PI;fakie=Math.cos(angle-course)<0;
  skid=0;edge*=Math.exp(-6*dt);absorb+=(.2-absorb)*Math.min(1,dt*6);lift+=(r.height-lift)*Math.min(1,dt*16);
  if(swivel){const d=Math.sign(swivel)*Math.min(Math.abs(swivel),9*dt);angle+=d;swivel-=d;}
  tricks.grinding=true;tricks.grind=grindName(angle,outfit.gear==='snowboard',fakie);if(!tricks.grinds)tricks.grinds=[];if(!tricks.grinds.includes(tricks.grind))tricks.grinds.push(tricks.grind);tricks.grindDist=(tricks.grindDist||0)+speed*dt;
  const pv=landingResult(tricks);combo=pv.base;multiplier=pv.multiplier;trick=pv.names.join(' + ');bankTime=1;
  if(y<r.start-2||y>r.end+2||speed<20){ // off the end: step down to the snow, bank the grind, keep your heading (a sideways slide skids out)
   rail=null;lift=0;z=0;vz=0;tricks.flip=0;lastRailEnd=clock;swivel=0;land(true);}
 }
 // Things worth counting toward challenges, queued for the page.
 function bankFeats(res:ReturnType<typeof landingResult>){const t=tricks,sd=Math.round(Math.abs(t.spin)/Math.PI)*180,fl=Math.round(Math.abs(t.flip)/(Math.PI*2));if(sd)feat('spin',sd);if(fl)feat('flip',fl);if(res.points)feat('combo',res.points);if((t.crossTime||0)>.15)feat('cross',1);if((t.scissorTime||0)>.15)feat('scissor',1);if(t.switchups)feat('switchup',t.switchups);if(t.grinding)feat('grind',1);if(t.link)feat('link',t.link+1);if(t.grabTime>.12)feat('grab',1);}
 function land(fromRail=false){const result=landingResult(tricks);if(result.clean||result.sketchy){feat('land',1);if(!fromRail)feat('air',peakAir);}absorb=Math.max(absorb,Math.min(1,-vz/240));
 // Landing tilted back on a flip: the skis shoot forward ("backseat"). Rideable, but costs balance.
 const lean=tricks.flip-Math.round(tricks.flip/(Math.PI*2))*Math.PI*2;if(result.clean&&lean>.5){backseat=1;vx+=Math.sin(angle)*35;vy+=Math.cos(angle)*35;}
 // The air spin becomes the new heading: a 180 lands switch, with no snap back to forward.
 if(!fromRail)angle-=(result.clean||result.sketchy)?Math.round(tricks.spin/Math.PI)*Math.PI:tricks.spin;z=0;vz=0;jumpCooldown=.25;
 if(result.sketchy){ // close, but not clean: keep riding at a cost in speed instead of wiping out
  vx*=.55;vy*=.55;speed*=.55;absorb=1;const pts=Math.round(result.base*Math.max(1,result.multiplier-1)*.5);score+=pts;creditsEarned+=Math.floor(pts/100);best=Math.max(best,score);trick=(result.names.join(' + ')||'Landing')+' · sketchy';landing='SKETCHY · SPEED LOST'+(pts?' · +'+pts:'');combo=0;multiplier=1;bankTime=1.2;grace=.45;spray(14);tricks=emptyTrick();return;}
 if(!result.clean){peakAir=0;wipeout();return;}
 bankFeats(result);peakAir=0;combo=result.base;multiplier=result.multiplier;score+=result.points;creditsEarned+=Math.floor(result.points/100);best=Math.max(best,score);try{localStorage.setItem('shredscape-best',String(best));}catch{}trick=result.names.join(' + ')||'Clean landing';landing=result.points?'BANKED +'+result.points:'Clean landing';bankTime=2.5;grace=.45;spray(12);tricks=emptyTrick();}
 const keys:Record<string,string>={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',KeyJ:'grab',KeyQ:'crossL',KeyE:'crossR',KeyH:'grabtype',KeyR:'restart',ShiftLeft:'boost'};
 function reset(){run=idleRun();lift=0;rail=null;kicker=null;back=false;charging=false;charge=0;x=START.x;y=START.y;z=0;angle=0;speed=0;vx=0;vy=0;fakie=false;score=0;combo=0;multiplier=1;tricks=emptyTrick();bail=0;grace=1;features=nearby(x,y);pressed.clear();landing='';emit();}
 function input(action:string,down:boolean){action=keys[action]||action;const already=pressed.has(action);if(down)pressed.add(action);else pressed.delete(action);if(action==='jump'&&!down&&charging){charging=false;const c=charge;charge=0;jump(c);return;}if(!down||already)return;if(action==='restart'){reset();return;}if(action==='jump'){if(bail>.35&&bail<BAIL-.6)bail=.35;else if(z===0&&!bail&&!jumpCooldown){charging=true;charge=0;}}if(action==='grab'&&rail&&!swivel){swivel=Math.PI*(Math.sin(angle)>=0?-1:1);tricks.switchups=(tricks.switchups||0)+1;}if(z>0){if(action==='grabtype'){const names=['Indy','Mute','Tail grab','Nose grab'];tricks.grab=names[(names.indexOf(tricks.grab)+1)%names.length];}}}
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.matches('input,select,textarea'))return;if(playing&&rp&&e.code!=='Escape'){replayKey(e);return;}if(playing&&e.code===(settings.replayKey||'KeyB')&&!e.repeat){e.preventDefault();startReplay();return;}const a=keys[e.code];if(a&&playing){e.preventDefault();input(a,true);}}
 function keyup(e:KeyboardEvent){if(keys[e.code])input(keys[e.code],false);}
 function blur(){pressed.clear();charging=false;charge=0;}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
 // Shuttle to a spawn point. A wipeout sends you to the nearest one once the tumble is over.
 function travelTo(dest:{x:number;y:number}){run=idleRun();lift=0;rail=null;kicker=null;back=false;swivel=0;chain=0;x=dest.x;y=dest.y;z=0;vz=0;speed=0;vx=0;vy=0;angle=0;bail=0;grace=1;combo=0;multiplier=1;tricks=emptyTrick();features=nearby(x,y);emit();}
 function respawn(){let best=LOCATIONS[0],bd=1e18;for(const l of LOCATIONS){const d=(l.x-x)**2+(l.y-y)**2;if(d<bd){bd=d;best=l;}}respawns++;respawnName=best.name;travelTo(best);}
 function update(dt:number){if(rp){stepReplay(dt);pub+=dt;if(pub>.05){pub=0;emit();}return;}clock+=dt;{const m=settings.timeMode||'cycle';if(m==='cycle'){hour+=dt/60;if(hour>=19)hour=7;}else hour=FIXED[m];}if(playing){const rx=x,ry=y;jumpCooldown=Math.max(0,jumpCooldown-dt);grace=Math.max(0,grace-dt);bankTime=Math.max(0,bankTime-dt);if(bankTime===0&&z===0){combo=0;multiplier=1;}
 if(bail>0){bail=Math.max(0,bail-dt);if(!bail){grace=1.8;respawn();}const f=Math.exp(-2.4*dt);vx*=f;vy*=f;speed=Math.hypot(vx,vy);const n={x:x+vx*dt,y:y+vy*dt};x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,n.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,n.y));}else{
 const steer=Number(pressed.has('right'))-Number(pressed.has('left'));const wasAirborne=z>0;
 const pushing=!wasAirborne&&pressed.has('up'),pw=pushWeight(speed);
 // The poling/skating ANIMATION is a low-speed thing (fades out by ~20 km/h); the key keeps accelerating you either way (a tuck at speed),
 // so the speed you can reach does not change - only what it looks like.
 pushPower+=((pushing?pw:0)-pushPower)*Math.min(1,dt*12);tuck+=((pushing?tuckWeight(speed,true):0)-tuck)*Math.min(1,dt*5);if(pushPower>.01)pushPhase+=dt*(outfit.gear==='skis'?4.5:6);
 snow=snowAt(x,y);let latX=0,latY=0;
 if(rail)grind(dt,steer);
 else if(!wasAirborne){
  const r=stepSki({vx,vy,angle},{steer,push:pushing,pushScale:pressed.has('boost')?.7:.1+.9*pw,soft:softness(),tuck,brake:pressed.has('down'),boost:pressed.has('boost'),pivot:pressed.has('grab')&&!!steer,sensitivity:settings.sensitivity,gradX:(groundHeight(x+4,y)-groundHeight(x-4,y))/8,gradY:(groundHeight(x,y+4)-groundHeight(x,y-4))/8,snow},dt);
  // Edge angle follows how hard the motion is actually turning (lateral load vs grip); a hockey stop braces against the slide.
  const turn=dt>0?wrap(r.course-course)/dt:0,load=-(r.speed*turn)/SNOW[snow].grip+(r.stopping?Math.sign(Math.sin(r.angle-r.course))*-.8*r.skid:0);
  edge+=(Math.max(-1,Math.min(1,r.speed>8?load:0))-edge)*Math.min(1,dt*8);
  if(r.speed>12&&Math.abs(Math.cos(r.angle-r.course))>.5)fakie=r.fakie;vx=r.vx;vy=r.vy;angle=r.angle;speed=r.speed;course=r.course;skid=r.skid;latX=r.latX;latY=r.latY;
  // Knees soak up terrain: compress where the slope curves up into you, extend into dips.
  const c=course,h0=groundHeight(x,y),curv=(groundHeight(x+Math.sin(c)*20,y+Math.cos(c)*20)+groundHeight(x-Math.sin(c)*20,y-Math.cos(c)*20)-2*h0)/400;
  absorb+=(Math.max(-.5,Math.min(1,curv*speed*speed*.4))-absorb)*Math.min(1,dt*6);
 }else{const f=Math.exp(-.15*dt);vx*=f;vy*=f;speed=Math.hypot(vx,vy);skid=0;edge*=Math.exp(-4*dt);absorb*=Math.exp(-4*dt);}
 backseat*=Math.exp(-2.5*dt);
 crossAmt+=((z>0&&pressed.has('crossL')?1:0)-crossAmt)*Math.min(1,dt*14);scissorAmt+=((z>0&&pressed.has('crossR')?1:0)-scissorAmt)*Math.min(1,dt*14);
 if(charging){if(z>0||bail)charging=false;else charge=Math.min(1,charge+dt/CHARGE.time);absorb=Math.max(absorb,.25+.65*charge);}else charge=0;
 const before={x,y};const next={x:x+vx*dt,y:y+vy*dt};x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,next.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,next.y));totalDistance+=Math.hypot(x-before.x,y-before.y);
 if(x!==next.x||y!==next.y){vx=0;vy=0;speed=0;trick='Mountain boundary · turn around or open the map';}
 if(z===0&&!rail){
  // Kicker: ride up the snow face, launch off the lip with speed.
  if(back&&kicker){const l=kickerSurface(kicker,x,y);if(l>0)lift=l;else{lift=0;kicker=null;back=false;}} // riding down the back of a mound you landed on
  else{
  const k=vy>0?features.find(f=>f.kind==='ramp'&&kickerLift(f,x,y)>0):undefined;
  if(k){kicker=k;lift=kickerLift(k,x,y);absorb+=(.35-absorb)*Math.min(1,dt*8);}
  else if(kicker){const sh=kickerShape(kicker);
   // Rolled off the lip without jumping: you leave along the surface, so a slow rider just drops off the end and a fast one still gets some air.
   if(y>=sh.lip&&Math.abs(x-kicker.x)<=sh.half+6){z=Math.max(1,kickerLift(kicker,x,sh.lip));vz=kickerExitVz(kicker,vy);if(vz>8){tricks=emptyTrick(vz);combo=0;multiplier=1;bankTime=0;landing='';trick='AIR TIME';absorb=-.4;spray(8);}}
   lift=0;kicker=null;}
  // Rail: ride onto it along its line.
  else if(speed>45&&Math.abs(Math.cos(course))>.5){const pad=Math.max(5,speed*dt*1.3),r=features.find(f=>f.kind==='rail'&&onRail(f,x,y,pad));if(r){rail=r;tricks=emptyTrick();combo=0;multiplier=1;landing='';grace=1;linkIn();}}
  }
 }
 if(z>0){vz-=JUMP.gravity*dt;z+=vz*dt;const flipIn=Number(pressed.has('down'))-Number(pressed.has('up'));tricks=advanceAirTrick(tricks,-steer,flipIn,dt);
  // Landing assist: on the way down, with no key held, the rotation settles toward the nearest clean landing, harder the closer you are.
  if(vz<0&&z<60){const k=Math.min(1,dt*7),sT=Math.round(tricks.spin/Math.PI)*Math.PI,fT=Math.round(tricks.flip/(Math.PI*2))*Math.PI*2,sE=Math.abs(tricks.spin-sT),fE=Math.abs(tricks.flip-fT);
   if(!steer&&sE<1.5){tricks.spin+=(sT-tricks.spin)*k*(1.2-sE/1.5);tricks.spinV=(tricks.spinV||0)*Math.exp(-6*dt);}
   if(!flipIn&&fE<1.7){tricks.flip+=(fT-tricks.flip)*k*(1.2-fE/1.7);tricks.flipV=(tricks.flipV||0)*Math.exp(-6*dt);}}if(pressed.has('grab'))tricks.grabTime+=dt;
  tricks.board=outfit.gear==='snowboard';if(pressed.has('crossL'))tricks.crossTime=(tricks.crossTime||0)+dt;if(pressed.has('crossR'))tricks.scissorTime=(tricks.scissorTime||0)+dt;peakAir=Math.max(peakAir,(z+lift)*.05);const preview=landingResult(tricks);combo=preview.base;multiplier=preview.multiplier;trick=preview.names.join(' + ')||'AIR TIME';
  // Coming down onto a rail: lock on. The spin so far becomes your stance on the rail; an unfinished flip still wipes out.
  const r=vz<0?features.find(f=>f.kind==='rail'&&onRail(f,x,y,4)&&z<=railShape(f).height+3):undefined;
  if(r){const flipErr=Math.abs(tricks.flip-Math.round(tricks.flip/(Math.PI*2))*Math.PI*2);
   if(flipErr>1.1)wipeout();else{angle-=tricks.spin;tricks={...tricks,spin:Math.round(tricks.spin/Math.PI)*Math.PI,grinding:true};rail=r;linkIn();lift=railShape(r).height;z=0;vz=0;grace=1;spray(6);}}
 else{
   // The kicker face is the floor while airborne: jump off it early and you come down on it again.
   let fl=0,ff:Feature|null=null;for(const f of features)if(f.kind==='ramp'){const l=kickerSurface(f,x,y);if(l>fl){fl=l;ff=f;}}
   if(z<=fl&&vz<=0){land();if(fl>0&&!bail){lift=fl;kicker=ff;back=y>kickerShape(ff!).lip;}}}}
 else snowSpray(dt,latX,latY);
 featureTime+=dt;if(featureTime>.5){featureTime=0;features=nearby(x,y);}
 for(const f of features){if(f.kind!=='tree'&&f.kind!=='rock')continue;if(z+lift>=12||grace)continue;
  // Swept test: at 90 km/h a single step is longer than a tree is wide, so check the whole segment travelled this step.
  const sx=x-rx,sy=y-ry,l2=sx*sx+sy*sy,tt=l2>0?Math.max(0,Math.min(1,((f.x-rx)*sx+(f.y-ry)*sy)/l2)):1;
  if(Math.hypot(rx+sx*tt-f.x,ry+sy*tt-f.y)<10*f.size){wipeout(true);break;}}
 }
 {const prevState=run.state,r=stepRun(run,runBest,rx,ry,x,y,clock);run=r.run;if(prevState!=='finished'&&run.state==='finished')feat('race',run.total);if(r.best!==runBest){runBest=r.best;try{localStorage.setItem('shredscape-run-best',JSON.stringify(runBest));}catch{}}}
 }
 for(let i=particles.length-1;i>=0;i--){const q=particles[i];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.z=Math.max(0,q.z+q.vz*dt);q.vz-=70*dt;q.vx*=Math.exp(-2*dt);q.vy*=Math.exp(-2*dt);if(q.life<0)particles.splice(i,1);}
 visualPeers=peers.map(p=>{const old=visualPeers.find(v=>v.id===p.id);if(!old||Math.hypot(old.x-p.x,old.y-p.y)>400)return p;return{...p,x:old.x+(p.x-old.x)*Math.min(1,dt*9),y:old.y+(p.y-old.y)*Math.min(1,dt*9),z:old.z+(p.z-old.z)*Math.min(1,dt*9)};});
 if(playing&&speed*.18>=80&&clock-lastSpeedFeat>1){lastSpeedFeat=clock;feat('speed',Math.round(speed*.18));}
 pub+=dt;if(pub>.1){pub=0;emit();}
 }
 function frame(now:number){if(destroyed)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);{const air=z>0;if(air&&!wasAir)lastEvent=clock;if(!air&&wasAir)hintUntil=clock+8;if(bail>0&&!wasBailed){lastEvent=clock;hintUntil=clock+8;}wasAir=air;wasBailed=bail>0;}
 const fr={x,y,z,lift,rail:!!rail,angle,speed,clock,bail,course,fakie,edge,skid,absorb,backseat,snow,tuck:playing&&z===0&&!bail?tuck:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,spin:tricks.spin,flip:tricks.flip,grab:pressed.has('grab')&&z>0?1:0,playing,outfit,features,peers:visualPeers,particles,view,settings,hour,soft:softness(),cross:crossAmt,scissor:scissorAmt,grabStyle:Math.max(0,['Indy','Mute','Tail grab','Nose grab'].indexOf(tricks.grab))};
 if(rp)mountain.draw({...sampleAt(rp.clip,rp.rt),settings,view,outfit,cam:{mode:CAMS[rp.cut%CAMS.length],id:rp.cutId,t:rp.rt}} as never);else{
  if(playing&&clock-lastRec>=1/30){lastRec=clock;hist.push({t:clock,f:{...fr,particles:particles.slice(0,80).map(p=>({x:p.x,y:p.y,z:p.z,size:p.size,life:p.life}))},m:{trick,landing,combo,mult:multiplier,bail:bail>0,score}});while(hist.length&&hist[0].t<clock-22)hist.shift();}
  mountain.draw(fr);}
 ;raf=requestAnimationFrame(frame);}
 raf=requestAnimationFrame(frame);emit();
 return{startReplay,stopReplay,replaying:()=>!!rp,start(){playing=true;view='game';emit();},pause(){playing=false;rp=null;pushPower=0;tuck=0;pressed.clear();emit();},reset,input,setOutfit(o:Outfit){outfit={...o};},setPeers(p:Peer[]){peers=p;},setView(v:string){view=v;},setSettings(s:GameSettings){settings=s;},// Dev/test only: place the rider at an exact spot, heading and velocity.
 debugPlace(px:number,py:number,a:number,dvx=0,dvy=0){lift=0;rail=null;kicker=null;back=false;tricks=emptyTrick();x=px;y=py;z=0;angle=a;vx=dvx;vy=dvy;speed=Math.hypot(vx,vy);course=speed>1?Math.atan2(vx,vy):a;fakie=vx*Math.sin(a)+vy*Math.cos(a)<0;bail=0;grace=1;features=nearby(x,y);},
 debugCourse(){return COURSE;},
 debugKickers(){return PARK_FEATURES.filter(f=>f.kind==='ramp').map(f=>({id:f.id,x:f.x,y:f.y,size:f.size,cls:kickerClass(f).name,lip:kickerShape(f).lip,start:kickerShape(f).start,height:kickerShape(f).height}));},
 debugSetHour(h:number){hour=h;},debugOutfit(){return outfit;},debugState(){return{hour,swivel,chain,x,y,z,angle,speed,course,fakie,run:run.state,next:run.next,clock,spin:tricks.spin,bailed:bail>0,lift,rail:!!rail,score,trick,pushPower,tuck,pushPhase};},
 travel(id:string){const dest=LOCATIONS.find(p=>p.id===id);if(dest)travelTo(dest);},destroy(){destroyed=true;cancelAnimationFrame(raf);mountain.destroy();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}};
}
