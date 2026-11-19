import {createMountain3D} from './renderer3d';
import {featuresNear,groundHeight,regionAt,snowAt,LOCATIONS,BOUNDS,START,PARK_FEATURES} from './world';
import {stepSki,wrap,SNOW,GRAVITY,type Snow} from './ski-physics';
import {pushWeight,tuckWeight} from './rig-pose';
import {kickerLift,kickerSurface,kickerShape,kickerExitVz,kickerJumpVz,kickerClass,chargeMul,CHARGE,railShape,onRail,grindName} from './park';
import {stepRun,idleRun,COURSE,type Run,type Best} from './race';
import type {Feature} from './world';
import {emptyTrick,landingResult,advanceAirTrick,judgeLanding,bodyAttitude,qaxis,qslerp,GRABS,grabNames,varietyFactor,JUMP,type Landing,type TrickState} from './tricks';
export type Outfit={jacket:string;pants:string;hat:string;gear:'snowboard'|'skis'|'skibike';avatar?:'explorer'|'classic';kit?:string;poles?:'none'|'carbon'|'kit';helmet?:string};
export type RiderMotion={spin:number;flip:number;pushPhase:number;pushPower:number;grab:number};
export type Peer={id:string;name:string;x:number;y:number;z:number;angle:number;outfit:Outfit;score:number;motion?:RiderMotion};
export type ReplayView={on:boolean;t:number;dur:number;cutId:number;cuts:number;cam:string;rate:number;user:number|null;paused:boolean;trick:string;landing:string;bailed:boolean;score:number;peak:number;kmh:number;air:number};
export type Feat={type:string;value:number};
export type GameSnapshot={popup?:{text:string;points:number;age:number};comboChain?:number;grabName?:string;stance?:string;groundTrick?:string;balance?:number;stumble?:number;tuckAmt?:number;inertia?:number;bailTarget?:string;bailLeft?:number;course?:number;feats?:Feat[];respawn?:number;respawnName?:string;replay?:ReplayView;replayReady?:boolean;hour?:number;soft?:number;charge?:number;score:number;best:number;combo:number;multiplier:number;trick:string;speed:number;airborne:boolean;distance:number;bailed:boolean;playing:boolean;x:number;y:number;z:number;angle:number;region?:string;creditsEarned?:number;landing?:string;spin?:number;flip?:number;landingReady?:boolean;grab?:number;pushPhase?:number;pushPower?:number;snow?:string;skid?:number;fakie?:boolean;run?:RunView};
export type RunView={state:Run['state'];time:number;gate:number;gates:number;last:Run['last'];lastAge:number;best:number|null;newBest:boolean;missed:number;course:string};
export type GameSettings={timeMode?:'cycle'|'morning'|'midday'|'afternoon';replayKey?:string;quality:'low'|'high';fov:number;sensitivity:number;cameraDistance:number;debugYaw?:number;debugCam?:{yaw:number;dist:number;height:number;look?:number}};
// Wipeout length in seconds. Space gets you up early after the first 0.6s.
export const BAIL=1.8;
// World features plus the timed-run gates near the rider.
function nearby(x:number,y:number):Feature[]{const out=featuresNear(x,y);for(const g of [COURSE.start,...COURSE.gates])if(Math.abs(g.y-y)<1500)out.push({kind:g.kind,x:g.x,y:g.y,size:g.w,seed:g.n,id:'race'+g.n});return out;}
export function createGame(canvas:HTMLCanvasElement,onUpdate:(s:GameSnapshot)=>void){
 const mountain=createMountain3D(canvas);let outfit:Outfit={jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear:'snowboard'};
 let x=START.x,y=START.y,z=0,vz=0,vx=0,vy=0,course=0,fakie=false,lift=0,rail:Feature|null=null,kicker:Feature|null=null,edge=0,skid=0,absorb=0,backseat=0,snow:Snow='groomed',speed=0,angle=0,score=0,best=0,combo=0,multiplier=1,clock=0,bail=0,grace=1,totalDistance=0,creditsEarned=0;
 const STEP=1/120;let barrierHit=false,acc=0,grabReach=.1,freezeAir=false;
 let respawns=0,respawnName='',peakAir=0,crossAmt=0,scissorAmt=0,lastSpeedFeat=-9,hour=9,swivel=0,lastRailEnd=-99,chain=0,charge=0,charging=false,back=false,playing=false,destroyed=false,raf=0,last=performance.now(),pub=0,featureTime=0,jumpCooldown=0,bankTime=0,pushPhase=0,pushPower=0,tuck=0;
 let trick='Choose your own line.',landing='',view='start',settings:GameSettings={quality:'high',fov:65,sensitivity:1,cameraDistance:10};
 // Time of day: one game hour per real minute from 7:00 to 19:00, then it wraps (dusk and dawn light match, so the loop is seamless). Snow warms up and goes soft from about 11:00 to 16:00.
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const FIXED={morning:8.5,midday:12.5,afternoon:16};
 function softness(){return smooth(11,16,hour);}
 let run:Run=idleRun(),runBest:Best|null=null;try{runBest=JSON.parse(localStorage.getItem('shredscape-run-best')||'null');}catch{}
 let tricks=emptyTrick(),features=nearby(x,y),peers:Peer[]=[],visualPeers:Peer[]=[];
 // Freestyle state: stance, scoring history, ground tricks, landing stability and crash details.
 const NATURAL=1; // natural spin direction is A (left); D is the unnatural way
 let intendedSwitch=false,recent:string[]=[],comboChain=0,popup:{text:string;points:number;at:number}|null=null,grabIdx=0,edgeAngle=0,balance=0,pivotSpin=0,pivotOn=false,revertT=0,revertTarget=0,stumble=0,railX=0,lastGroundName='';
 const gt={kind:'' as ''|'nose'|'tail'|'manual',amt:0,spin:0,time:0};
 let crash:{kind:string;fx:number;fy:number;power:number;lean:number;side:number;tilt:number}|null=null;
 const newAir=(vz:number)=>{const t=emptyTrick(vz);t.takeoffSwitch=fakie;t.board=outfit.gear==='snowboard';t.bike=outfit.gear==='skibike';t.grab=GRABS[grabIdx].name;return t;};
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
 const emit=()=>{const q=feats.splice(0);onUpdate({popup:popup&&clock-popup.at<2.4?{text:popup.text,points:popup.points,age:clock-popup.at}:undefined,comboChain,grabName:tricks.bike?'No-hander':GRABS[grabIdx].name,stance:intendedSwitch?'switch':'regular',groundTrick:gt.kind,balance,stumble,tuckAmt:tricks.tuck,inertia:tricks.inertia,bailTarget:bail>0?nearestSpawn().name:undefined,bailLeft:bail,course,feats:q,respawn:respawns,respawnName,replay:replayInfo(),replayReady:!rp&&hist.length>30&&clock<hintUntil,score,best,combo,multiplier,trick,speed:Math.round(speed*.18),airborne:z>0,distance:Math.round(totalDistance/10),bailed:bail>0,playing,x,y,z:z+lift,angle,region:regionAt(x,y),creditsEarned,landing,hour,soft:softness(),charge:charging?charge:0,spin:tricks.spin,flip:tricks.flip,landingReady:(()=>{const g=judgeLanding(tricks).grade;return g==='perfect'||g==='clean';})(),grab:pressed.has('grab')&&z>0?1:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,snow:SNOW[snow].label,skid,fakie,run:{state:run.state,time:run.state==='running'?clock-run.t0+run.penalty:run.total,gate:run.next,gates:COURSE.gates.length,last:run.last,lastAge:clock-run.lastAt,best:runBest?.total??null,newBest:run.newBest,missed:run.missed,course:COURSE.name}});};
 function puff(p:{x:number;y:number;z:number;vx:number;vy:number;vz:number;size:number;life:number}){particles.push(p);if(particles.length>220)particles.splice(0,particles.length-220);}
 function spray(n:number){for(let i=0;i<n;i++)puff({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*20,z:Math.random()*12,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,vz:20+Math.random()*25,size:2+Math.random()*4,life:.3+Math.random()*.5});}
 // Snow thrown by the skis: skids push a sideways sheet, powder lifts a soft plume, clean carves throw almost nothing.
 function snowSpray(dt:number,latX:number,latY:number){const lat=Math.hypot(latX,latY)||1,ox=latX/lat,oy=latY/lat;
  const sheet=skid*speed*dt*.5;for(let i=0;i<Math.floor(sheet)+(Math.random()<sheet%1?1:0);i++)puff({x:x+(Math.random()-.5)*12,y:y+(Math.random()-.5)*12,z:2,vx:ox*(50+Math.random()*60)+vx*.3,vy:oy*(50+Math.random()*60)+vy*.3,vz:25+Math.random()*35,size:2+Math.random()*3+skid*2,life:.35+Math.random()*.4});
  // Carving throws a fine rooster tail off the loaded edge, thicker in powder; it grows with edge angle and speed.
  if(edgeAngle>.4&&speed>60&&z===0){const side=Math.sign(pressed.has('right')?1:pressed.has('left')?-1:0)||1,n2=edgeAngle*speed*dt*.045*(snow==='powder'?2.4:snow==='ice'?.5:1),px=Math.cos(course)*side,py=-Math.sin(course)*side;
   for(let i=0;i<Math.floor(n2)+(Math.random()<n2%1?1:0);i++)puff({x:x+px*6+(Math.random()-.5)*8,y:y+py*6+(Math.random()-.5)*8,z:1.5,vx:px*(35+Math.random()*35)-vx*.1,vy:py*(35+Math.random()*35)-vy*.1,vz:14+Math.random()*22,size:1.6+Math.random()*2.2,life:.3+Math.random()*.3});}
  if(snow==='powder'&&speed>40){const plume=speed*dt*.12;for(let i=0;i<Math.floor(plume)+(Math.random()<plume%1?1:0);i++)puff({x:x+(Math.random()-.5)*16,y:y+(Math.random()-.5)*16,z:1,vx:-vx*.15+(Math.random()-.5)*20,vy:-vy*.15+(Math.random()-.5)*20,vz:18+Math.random()*25,size:4+Math.random()*5,life:.6+Math.random()*.6});}}
 function jump(c=1){if(!playing||z>0||bail||jumpCooldown)return;
  const ollie=pressed.has('crossR')?'Ollie':pressed.has('crossL')?'Nollie':'';
  if(rail){lastRailEnd=clock;railX=rail.x;swivel=0;z=Math.max(1,lift);lift=0;rail=null;vz=JUMP.pop*.85*chargeMul(c);absorb=-.4;spray(4);return;} // pop off the rail, keeping the grind in the combo
  if(kicker){ // jump off the kicker face: you keep the surface's upward speed and add a pop that is strongest at the lip
   z=lift+1;vz=kickerJumpVz(kicker,y,vy,c);lift=0;kicker=null;absorb=-.4;tricks=newAir(vz);if(bankTime<=0){combo=0;multiplier=1;}landing='';trick='AIR TIME';spray(8);return;}
  // flat pop. Ollie (E held): load the tail, nose comes up; Nollie (Q held): the reverse. Both pop a little higher.
  z=1;absorb=-.4;vz=JUMP.pop*chargeMul(c)*(ollie?1.08:1);tricks=newAir(vz);if(ollie){tricks.ollie=ollie;tricks.wx=(ollie==='Ollie'?1:-1)*1.5;}if(bankTime<=0){combo=0;multiplier=1;}landing='';trick=ollie||'AIR TIME';spray(8);}
 // Tumble keeps most momentum (the rider slides); hitting a tree stops you harder.
 // Stepping onto a rail soon after leaving another one links them: the chain grows and pays a bonus when banked.
 function linkIn(){chain=clock-lastRailEnd<1.8?chain+1:0;tricks.link=chain;}
 function wipeout(hard=false,kind='tumble'){const a=bodyAttitude(tricks.q),sp=Math.hypot(vx,vy)||1;crash={kind,fx:vx/sp,fy:vy/sp,power:Math.min(1,sp/320),lean:a.lean,side:a.side,tilt:a.tilt};
  bail=BAIL;lift=0;rail=null;kicker=null;back=false;swivel=0;chain=0;comboChain=0;charging=false;charge=0;gt.kind='';gt.amt=0;revertT=0;stumble=0;const k=hard?.25:kind==='edge'?.55:kind==='nose'?.6:.8;vx*=k;vy*=k;speed*=k;z=0;vz=0;combo=0;multiplier=1;trick='Wipeout · unbanked combo lost';landing=kind==='nose'?'Nose-heavy landing':kind==='edge'?'Caught an edge':kind==='backseat'?'Backseat landing':'Missed landing';tricks=emptyTrick();spray(24);}
 // On a rail: locked to its line, sliding with low friction. Turn to swing between 50-50 and a sideways slide (spins on the rail count);
 // Q / E press the nose / tail; J is a switch-up.
 function grind(dt:number,steer:number){const r=railShape(rail!),dir=vy<0?-1:1,gy=(groundHeight(x,y+4)-groundHeight(x,y-4))/8;
  speed=Math.max(0,speed+(-gy*GRAVITY*dir-8)*dt);angle+=steer*2.4*dt;tricks.railSpin=(tricks.railSpin||0)+steer*2.4*dt;vx=(rail!.x-x)*10;vy=dir*speed;course=dir>0?0:Math.PI;fakie=Math.cos(angle-course)<0;
  skid=0;edge*=Math.exp(-6*dt);absorb+=(.2-absorb)*Math.min(1,dt*6);lift+=(r.height-lift)*Math.min(1,dt*16);
  if(swivel){const d=Math.sign(swivel)*Math.min(Math.abs(swivel),9*dt);angle+=d;swivel-=d;}
  const nose=pressed.has('crossL'),tail=pressed.has('crossR');gt.kind=nose&&!tail?'nose':tail&&!nose?'tail':'';gt.amt+=((gt.kind?1:0)-gt.amt)*Math.min(1,dt*9);
  if(gt.kind){const nm=gt.kind==='nose'?'Nose press':'Tail press';if(tricks.press!==nm){tricks.press=nm;tricks.pressTime=0;}tricks.pressTime=(tricks.pressTime||0)+dt;}
  tricks.grinding=true;tricks.grind=grindName(angle,outfit.gear==='snowboard',fakie,outfit.gear==='skibike');if(!tricks.grinds)tricks.grinds=[];if(!tricks.grinds.includes(tricks.grind))tricks.grinds.push(tricks.grind);tricks.grindDist=(tricks.grindDist||0)+speed*dt;
  const pv=landingResult(tricks,{naturalSign:NATURAL,landing:CLEAN,recent});combo=pv.base;multiplier=pv.multiplier;trick=pv.names.join(' + ');bankTime=1;
  if(y<r.start-2||y>r.end+2||speed<20){ // off the end: step down to the snow, bank the grind, keep your heading (a sideways slide skids out)
   lift=0;z=0;vz=0;lastRailEnd=clock;railX=rail?.x??railX;swivel=0;gt.kind='';rail=null;land(true);}
 }
 const CLEAN:Landing={grade:'clean',kind:'ok',tilt:0,yawErr:0,lean:0,side:0,yaw:0};
 // Bank a score: chain it onto the running combo, apply the variety penalty, queue a popup.
 function bank(res:ReturnType<typeof landingResult>,sketchy=false){
  comboChain=bankTime>0&&!sketchy?comboChain+1:0;const chainMult=1+.5*Math.min(8,comboChain),pts=Math.round(res.points*chainMult);
  if(res.key){recent.push(res.key);if(recent.length>10)recent.shift();}
  score+=pts;creditsEarned+=Math.floor(pts/100);best=Math.max(best,score);try{localStorage.setItem('shredscape-best',String(best));}catch{}
  combo=res.base;multiplier=Math.round(res.multiplier*chainMult*10)/10;trick=res.names.join(' + ')||'Clean landing';popup={text:trick,points:pts,at:clock};landing=(sketchy?'SKETCHY · ':'BANKED ')+'+'+pts+(comboChain?' · COMBO ×'+chainMult.toFixed(1):'');bankTime=sketchy?1.2:2.5;}
 // Ground tricks blend straight into skiing: they bank like landings (and chain with them) without interrupting movement.
 function bankGround(name:string,pts:number){comboChain=bankTime>0?comboChain+1:0;const chainMult=1+.5*Math.min(8,comboChain),p=Math.round(pts*varietyFactor(name,recent)*chainMult);recent.push(name);if(recent.length>10)recent.shift();
  score+=p;creditsEarned+=Math.floor(p/100);best=Math.max(best,score);combo=Math.round(pts);multiplier=Math.round(chainMult*10)/10;trick=name;popup={text:name,points:p,at:clock};landing='BANKED +'+p+(comboChain?' · COMBO ×'+chainMult.toFixed(1):'');bankTime=2.5;feat('ground',1);lastGroundName=name;}
 function endGround(){const spinH=Math.round(Math.abs(gt.spin)/Math.PI);
  if(gt.kind==='nose'||gt.kind==='tail'){if(gt.time>.25||spinH>=1)bankGround((gt.kind==='nose'?'Nose Butter':'Tail Butter')+(spinH?' '+spinH*180:''),70+gt.time*80+spinH*170);}
  else if(gt.kind==='manual'&&gt.time>.6)bankGround('Manual · '+gt.time.toFixed(1)+'s',60+gt.time*170);
  gt.kind='';gt.spin=0;gt.time=0;}
 // Things worth counting toward challenges, queued for the page.
 function bankFeats(res:ReturnType<typeof landingResult>){const t=tricks,sd=Math.round(Math.abs(t.spin)/Math.PI)*180,fl=Math.round(Math.abs(t.flip)/(Math.PI*2));if(sd)feat('spin',sd);if(fl)feat('flip',fl);if(res.points)feat('combo',res.points);if((t.crossTime||0)>.15)feat('cross',1);if((t.scissorTime||0)>.15)feat('scissor',1);if(t.switchups)feat('switchup',t.switchups);if(t.grinding)feat('grind',1);if(t.link)feat('link',t.link+1);if(t.grabTime>.12)feat('grab',1);}
 // How fast the ground falls away along the direction of travel (>0 when you land on a downhill transition).
 function slopeAlong(){const c=speed>20?course:angle,sd=8;return (groundHeight(x-Math.sin(c)*sd,y-Math.cos(c)*sd)-groundHeight(x+Math.sin(c)*sd,y+Math.cos(c)*sd))/(2*sd);}
 // Touchdown. The body's real orientation decides the outcome; a steep downhill landing soaks up the impact, a flat landing does not.
 function land(fromRail=false){const t=tricks,L=fromRail?CLEAN:judgeLanding(t),res=landingResult(t,{naturalSign:NATURAL,landing:L,recent});
  const sl=slopeAlong(),impact=Math.max(0,-vz-speed*Math.max(0,sl)),steep=Math.max(0,Math.min(1,sl*5));
  absorb=Math.max(absorb,Math.min(1,impact/(230+300*steep))); // knee compression: more impact, deeper squat; steeper transitions need less
  if(res.clean||res.sketchy){feat('land',1);if(!fromRail)feat('air',peakAir);}
  if(!fromRail)angle-=L.grade==='crash'?L.yaw:Math.round(L.yaw/Math.PI)*Math.PI;
  z=0;vz=0;jumpCooldown=.25;gt.kind='';
  if(!fromRail&&L.grade!=='crash'){intendedSwitch=Math.cos(angle-course)<-.3;}
  const danger=impact/260+speed/520;
  if(L.grade==='crash'){peakAir=0;wipeout(false,L.kind==='ok'?'tumble':L.kind);return;}
  if(!fromRail&&L.grade!=='perfect'){
   if(L.kind==='nose'&&danger>1.1){peakAir=0;wipeout(false,'nose');return;} // nose-heavy at speed: pitch over the front
   if(L.kind==='edge'&&speed>170){peakAir=0;wipeout(false,'edge');return;} // landed sideways: caught an edge
  }
  const loss=L.grade==='perfect'?0:L.grade==='clean'?.05:.28;vx*=1-loss;vy*=1-loss;speed*=1-loss;
  if(!fromRail&&L.kind==='backseat'){backseat=1;vx+=Math.sin(angle)*35;vy+=Math.cos(angle)*35;} // tail-heavy: the skis shoot out in front
  stumble=fromRail?0:L.grade==='perfect'?0:L.grade==='clean'?.35+impact/900:.9+impact/700;
  if(res.sketchy){bank(res,true);combo=0;multiplier=1;grace=.45;spray(14);tricks=emptyTrick();peakAir=0;return;}
  bankFeats(res);peakAir=0;bank(res);grace=.45;spray(12);tricks=emptyTrick();}
 const keys:Record<string,string>={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',KeyJ:'grab',KeyQ:'crossL',KeyE:'crossR',KeyZ:'rollL',KeyC:'rollR',KeyX:'revert',KeyH:'grabtype',KeyR:'restart',ShiftLeft:'boost'};
 function reset(){run=idleRun();lift=0;rail=null;kicker=null;back=false;charging=false;charge=0;x=START.x;y=START.y;z=0;angle=0;speed=0;vx=0;vy=0;fakie=false;score=0;combo=0;multiplier=1;tricks=emptyTrick();bail=0;grace=1;features=nearby(x,y);pressed.clear();landing='';emit();}
 function input(action:string,down:boolean){action=keys[action]||action;const already=pressed.has(action);if(down)pressed.add(action);else pressed.delete(action);if(action==='jump'&&!down&&charging){charging=false;const c=charge;charge=0;jump(c);return;}if(!down||already)return;if(action==='restart'){reset();return;}if(action==='jump'){if(bail>.35&&bail<BAIL-.6)bail=.35;else if(z===0&&!bail&&!jumpCooldown){charging=true;charge=0;}}if(action==='grab'&&rail&&!swivel){swivel=Math.PI*(Math.sin(angle)>=0?-1:1);tricks.switchups=(tricks.switchups||0)+1;}if(action==='grabtype'&&outfit.gear!=='skibike'){grabIdx=(grabIdx+1)%GRABS.length;tricks.grab=GRABS[grabIdx].name;}
  if(action==='revert'&&z===0&&!rail&&!bail&&speed>25&&!revertT){revertTarget=angle+Math.PI;revertT=1;spray(6);}}
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.matches('input,select,textarea'))return;if(playing&&rp&&e.code!=='Escape'){replayKey(e);return;}if(playing&&e.code===(settings.replayKey||'KeyB')&&!e.repeat){e.preventDefault();startReplay();return;}const a=keys[e.code];if(a&&playing){e.preventDefault();input(a,true);}}
 function keyup(e:KeyboardEvent){if(keys[e.code])input(keys[e.code],false);}
 function blur(){pressed.clear();charging=false;charge=0;}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
 // Shuttle to a spawn point. A wipeout sends you to the nearest one once the tumble is over.
 function travelTo(dest:{x:number;y:number}){run=idleRun();lift=0;rail=null;kicker=null;back=false;swivel=0;chain=0;x=dest.x;y=dest.y;z=0;vz=0;speed=0;vx=0;vy=0;angle=0;bail=0;grace=1;combo=0;multiplier=1;tricks=emptyTrick();features=nearby(x,y);emit();}
 function nearestSpawn(){let best=LOCATIONS[0],bd=1e18;for(const l of LOCATIONS){const d=(l.x-x)**2+(l.y-y)**2;if(d<bd){bd=d;best=l;}}return best;}
 function respawn(){const best=nearestSpawn();respawns++;respawnName=best.name;travelTo(best);}
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
  // Ground tricks: Q = nose butter, E = tail butter, Q + E = manual (balance with A/D). Turning while buttering spins you on the nose or tail.
  const wantNose=pressed.has('crossL'),wantTail=pressed.has('crossR'),gk=!charging&&!stumble&&!revertT&&speed<190?(wantNose&&wantTail?'manual':wantNose?'nose':wantTail?'tail':''):'';
  if(gk!==gt.kind){endGround();gt.kind=gk;if(gk==='manual')balance=0;}
  gt.amt+=((gt.kind?1:0)-gt.amt)*Math.min(1,dt*9);if(gt.kind)gt.time+=dt;
  const butter=gt.kind==='nose'||gt.kind==='tail';
  if(gt.kind==='manual'){balance+=((Math.sin(clock*1.9)+Math.sin(clock*3.7)*.5)*.28*(.5+speed/260)-steer*1.5)*dt;if(Math.abs(balance)>1.05){endGround();stumble=.7;speed*=.8;vx*=.8;vy*=.8;balance=0;}}else balance*=Math.exp(-4*dt);
  const steerEff=steer*(stumble>0?.55:1),pivotNow=pressed.has('grab')&&!!steer,a0=angle,fixing=!intendedSwitch&&speed>30&&!pivotNow&&!butter&&Math.cos(angle-course)<-.15; // fixing: skis found themselves backward by accident
  // Edge angle builds while you hold a turn: a fresh turn is lazy, a loaded edge bites hard. Turning rate also falls as speed rises (bigger radius).
  edgeAngle+=(Math.min(1,Math.abs(steerEff))-edgeAngle)*Math.min(1,dt*(steerEff?2.6:5));
  const r=stepSki({vx,vy,angle},{steer:steerEff,edgeAngle,butter,push:pushing,pushScale:pressed.has('boost')?.7:.1+.9*pw,soft:softness(),bike:outfit.gear==='skibike',tuck,brake:pressed.has('down'),boost:pressed.has('boost'),pivot:pivotNow||fixing||revertT>0,sensitivity:settings.sensitivity,gradX:(groundHeight(x+4,y)-groundHeight(x-4,y))/8,gradY:(groundHeight(x,y+4)-groundHeight(x,y-4))/8,snow},dt);
  // Edge angle follows how hard the motion is actually turning (lateral load vs grip); a hockey stop braces against the slide.
  const turn=dt>0?wrap(r.course-course)/dt:0,load=-(r.speed*turn)/SNOW[snow].grip+(r.stopping?Math.sign(Math.sin(r.angle-r.course))*-.8*r.skid:0);
  edge+=(Math.max(-1,Math.min(1,r.speed>8?load:0))-edge)*Math.min(1,dt*8);
  if(r.speed>12&&Math.abs(Math.cos(r.angle-r.course))>.5)fakie=r.fakie;vx=r.vx;vy=r.vy;angle=r.angle;speed=r.speed;course=r.course;skid=r.skid;latX=r.latX;latY=r.latY;
  if(butter)gt.spin+=wrap(r.angle-a0);
  if(pivotNow){pivotSpin+=wrap(r.angle-a0);pivotOn=true;}else if(pivotOn){pivotOn=false;if(Math.abs(pivotSpin)>=1.4){const h=Math.round(Math.abs(pivotSpin)/Math.PI);bankGround('Pivot '+h*180,50+h*60);if(Math.cos(angle-course)<-.3&&speed>25)intendedSwitch=true;}pivotSpin=0;}
  // Reverts swing the skis round on purpose. Otherwise, if the skis end up pointing backward without you meaning to, they come back round to the direction of travel (they never snap there).
  if(revertT){angle+=wrap(revertTarget-angle)*Math.min(1,dt*9);if(Math.abs(wrap(revertTarget-angle))<.06){angle=revertTarget;revertT=0;intendedSwitch=Math.cos(angle-course)<-.3;bankGround(intendedSwitch?'Revert to Switch':'Revert',60);}}
  else if(fixing&&!r.stopping)angle+=wrap(course-angle)*Math.min(1,dt*3.2);
  stumble=Math.max(0,stumble-dt);
  // Knees soak up terrain: compress where the slope curves up into you, extend into dips.
  const c=course,h0=groundHeight(x,y),curv=(groundHeight(x+Math.sin(c)*20,y+Math.cos(c)*20)+groundHeight(x-Math.sin(c)*20,y-Math.cos(c)*20)-2*h0)/400;
  absorb+=(Math.max(-.5,Math.min(1,curv*speed*speed*.4))-absorb)*Math.min(1,dt*6);
 }else{const f=Math.exp(-.15*dt);vx*=f;vy*=f;speed=Math.hypot(vx,vy);skid=0;edge*=Math.exp(-4*dt);absorb*=Math.exp(-4*dt);}
 backseat*=Math.exp(-2.5*dt);
 crossAmt+=((z>0?Math.max(pressed.has('crossL')?1:0,pressed.has('grab')?GRABS[grabIdx].cross:0):0)-crossAmt)*Math.min(1,dt*14);scissorAmt+=((z>0&&pressed.has('crossR')?1:0)-scissorAmt)*Math.min(1,dt*14);
 if(charging){if(z>0||bail)charging=false;else charge=Math.min(1,charge+dt/CHARGE.time);absorb=Math.max(absorb,.25+.65*charge);}else charge=0;
 const before={x,y};const next={x:x+vx*dt,y:y+vy*dt};x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,next.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,next.y));totalDistance+=Math.hypot(x-before.x,y-before.y);
 if(x!==next.x){ // the padded barrier: you bounce off it and scrub speed
  vx=-vx*.3;vy*=.82;speed=Math.hypot(vx,vy);absorb=Math.max(absorb,.6);if(!barrierHit){barrierHit=true;spray(8);if(z===0)trick='Barrier · the crowd gasps';}}else barrierHit=false;
 if(y!==next.y){vx=0;vy=0;speed=0;trick='End of the course · turn around or open the map';}
 if(z===0&&!rail){
  // Kicker: ride up the snow face, launch off the lip with speed.
  if(back&&kicker){const l=kickerSurface(kicker,x,y);if(l>0)lift=l;else{lift=0;kicker=null;back=false;}} // riding down the back of a mound you landed on
  else{
  const k=vy>0?features.find(f=>f.kind==='ramp'&&kickerLift(f,x,y)>0):undefined;
  if(k){kicker=k;lift=kickerLift(k,x,y);absorb+=(.35-absorb)*Math.min(1,dt*8);}
  else if(kicker){const sh=kickerShape(kicker);
   // Rolled off the lip without jumping: you leave along the surface, so a slow rider just drops off the end and a fast one still gets some air.
   if(y>=sh.lip&&Math.abs(x-kicker.x)<=sh.half+6){z=Math.max(1,kickerLift(kicker,x,sh.lip));vz=kickerExitVz(kicker,vy);if(vz>8){tricks=newAir(vz);if(bankTime<=0){combo=0;multiplier=1;}landing='';trick='AIR TIME';absorb=-.4;spray(8);}}
   lift=0;kicker=null;}
  // Rail: ride onto it along its line.
  else if(speed>45&&Math.abs(Math.cos(course))>.5){const pad=Math.max(5,speed*dt*1.3),r=features.find(f=>f.kind==='rail'&&onRail(f,x,y,pad));if(r){rail=r;tricks=emptyTrick();combo=0;multiplier=1;landing='';grace=1;linkIn();}}
  }
 }
 if(z>0){if(!freezeAir)vz-=JUMP.gravity*(vz<0?JUMP.fall:1)*dt; // a little heavier on the way down than up, so jumps arc and drop naturally
 if(!freezeAir)z+=vz*dt;
  const flipIn=Number(pressed.has('down'))-Number(pressed.has('up')),rollIn=Number(pressed.has('rollL'))-Number(pressed.has('rollR')),grabbing=pressed.has('grab'),anyInput=!!(steer||flipIn||rollIn);
  // The body is a rigid body: keys apply torque about the body's own axes, J tucks (smaller moment of inertia, so you spin faster), Space spreads out (bigger, so you slow down).
  tricks=advanceAirTrick(tricks,{spin:-steer,flip:flipIn,roll:rollIn,tuck:grabbing?1:0,ext:pressed.has('jump')?1:0},dt);
  // Landing assist: on the way down with no rotation key held, the body settles toward the nearest clean landing, harder the closer you are.
  if(vz<0&&z<70&&!anyInput){const at=bodyAttitude(tricks.q),ty=Math.round(at.yaw/Math.PI)*Math.PI,err=Math.hypot(at.tilt,at.yaw-ty);if(err<1.5){const k=Math.min(1,dt*6.5*(1.25-err/1.5));tricks.q=qslerp(tricks.q,qaxis(0,1,0,ty),k);const dm=Math.exp(-6*dt);tricks.wx*=dm;tricks.wy*=dm;tricks.wz*=dm;}}
  tricks.board=outfit.gear==='snowboard';tricks.bike=outfit.gear==='skibike';tricks.grab=tricks.bike?'No-hander':GRABS[grabIdx].name;
  if(grabbing){tricks.grabTime+=dt;// quality: how tucked you are AND how close the hand really is to that part of the ski (the renderer reports the reach error)
   tricks.grabQuality=Math.min(1,tricks.tuck*1.25)*Math.max(0,Math.min(1,1-(grabReach-.12)/.4));}
  if(pressed.has('crossL')||(grabbing&&GRABS[grabIdx].cross>=.6&&!tricks.bike))tricks.crossTime=(tricks.crossTime||0)+dt;if(pressed.has('crossR'))tricks.scissorTime=(tricks.scissorTime||0)+dt;
  peakAir=Math.max(peakAir,(z+lift)*.05);tricks.peak=Math.max(tricks.peak,(z+lift)*.05);
  const preview=landingResult(tricks,{naturalSign:NATURAL,landing:CLEAN,recent});combo=preview.base;multiplier=Math.round(preview.multiplier*(1+.5*Math.min(8,bankTime>0?comboChain+1:0))*10)/10;trick=preview.names.join(' + ')||(tricks.ollie||'AIR TIME');
  // Coming down onto a rail: lock on. The spin so far becomes your stance on the rail; an unfinished flip still wipes out.
  const r=vz<0?features.find(f=>f.kind==='rail'&&onRail(f,x,y,4)&&z<=railShape(f).height+3):undefined;
  if(r){const L=judgeLanding(tricks);
   if(L.tilt>.95)wipeout(false,'edge');else{const deg=Math.round(Math.abs(tricks.spin)/(Math.PI/2))*90;tricks={...tricks,q:{x:0,y:0,z:0,w:1},grinding:true,railEntry:deg>=270?(Math.sign(tricks.spin)*NATURAL>0?'Frontside ':'Backside ')+deg+' on':undefined};angle-=L.yaw;rail=r;linkIn();if(clock-lastRailEnd<1.2&&Math.abs(r.x-railX)>10)tricks.transfers=(tricks.transfers||0)+1;lift=railShape(r).height;z=0;vz=0;grace=1;spray(6);}}
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
 // Physics runs on a fixed 120 Hz timestep whatever the frame rate, so tricks, collisions and landings behave the same at 20 fps and at 240.
 function frame(now:number){if(destroyed)return;const dt=Math.min(.1,(now-last)/1000);last=now;acc+=dt;let steps=0;while(acc>=STEP&&steps<8){update(STEP);acc-=STEP;steps++;}if(steps===8)acc=0;{const air=z>0;if(air&&!wasAir)lastEvent=clock;if(!air&&wasAir)hintUntil=clock+8;if(bail>0&&!wasBailed){lastEvent=clock;hintUntil=clock+8;}wasAir=air;wasBailed=bail>0;}
 const fr={x,y,z,lift,rail:!!rail,angle,speed,clock,bail,course,fakie,edge,skid,absorb,backseat,snow,tuck:playing&&z===0&&!bail?tuck:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,spin:tricks.spin,flip:tricks.flip,grab:pressed.has('grab')&&z>0?1:0,playing,outfit,features,peers:visualPeers,particles,view,settings,hour,soft:softness(),cross:crossAmt,scissor:scissorAmt,grabStyle:grabIdx,tuckAmt:tricks.tuck,extAmt:pressed.has('jump')&&z>0?1:0,qx:tricks.q.x,qy:tricks.q.y,qz:tricks.q.z,qw:tricks.q.w,roll:tricks.roll,gtKind:gt.kind,gtAmt:gt.amt,balance,stumble,edgeAngle,crash:bail>0?crash:null,stance:intendedSwitch?1:0};
 if(rp)mountain.draw({...sampleAt(rp.clip,rp.rt),settings,view,outfit,cam:{mode:CAMS[rp.cut%CAMS.length],id:rp.cutId,t:rp.rt}} as never);else{
  if(playing&&clock-lastRec>=1/30){lastRec=clock;hist.push({t:clock,f:{...fr,particles:particles.slice(0,80).map(p=>({x:p.x,y:p.y,z:p.z,size:p.size,life:p.life}))},m:{trick,landing,combo,mult:multiplier,bail:bail>0,score}});while(hist.length&&hist[0].t<clock-22)hist.shift();}
  const out=mountain.draw(fr) as {grabErr:number}|undefined;if(out&&out.grabErr>=0)grabReach+=(out.grabErr-grabReach)*.3;else grabReach=.1;}
 ;raf=requestAnimationFrame(frame);}
 raf=requestAnimationFrame(frame);emit();
 return{startReplay,stopReplay,replaying:()=>!!rp,start(){playing=true;view='game';emit();},pause(){playing=false;rp=null;pushPower=0;tuck=0;pressed.clear();emit();},reset,input,setOutfit(o:Outfit){outfit={...o};},setPeers(p:Peer[]){peers=p;},setView(v:string){view=v;},setSettings(s:GameSettings){settings=s;},// Dev/test only: place the rider at an exact spot, heading and velocity.
 debugPlace(px:number,py:number,a:number,dvx=0,dvy=0){lift=0;rail=null;kicker=null;back=false;tricks=emptyTrick();x=px;y=py;z=0;angle=a;vx=dvx;vy=dvy;speed=Math.hypot(vx,vy);course=speed>1?Math.atan2(vx,vy):a;fakie=vx*Math.sin(a)+vy*Math.cos(a)<0;bail=0;grace=1;features=nearby(x,y);},
 debugCourse(){return COURSE;},
 debugKickers(){return PARK_FEATURES.filter(f=>f.kind==='ramp').map(f=>({id:f.id,x:f.x,y:f.y,size:f.size,cls:kickerClass(f).name,lip:kickerShape(f).lip,start:kickerShape(f).start,height:kickerShape(f).height}));},
 debugSetHour(h:number){hour=h;},debugFreeze(on:boolean){freezeAir=on;if(on){vx=0;vy=0;speed=0;}},debugAir(h:number){z=h;vz=0;tricks=newAir(400);},debugGrab(){return{reach:grabReach,idx:grabIdx,quality:tricks.grabQuality,tuck:tricks.tuck};},debugSetGrab(i:number){grabIdx=i%GRABS.length;},debugTrick(){return{spin:tricks.spin,flip:tricks.flip,roll:tricks.roll,peakTilt:tricks.peakTilt,inertia:tricks.inertia,name:trick};},debugOutfit(){return outfit;},debugState(){return{hour,swivel,chain,x,y,z,angle,speed,course,fakie,run:run.state,next:run.next,clock,spin:tricks.spin,bailed:bail>0,lift,rail:!!rail,score,trick,pushPower,tuck,pushPhase};},
 travel(id:string){const dest=LOCATIONS.find(p=>p.id===id);if(dest)travelTo(dest);},destroy(){destroyed=true;cancelAnimationFrame(raf);mountain.destroy();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}};
}
