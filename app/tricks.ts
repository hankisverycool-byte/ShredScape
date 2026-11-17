// Freestyle trick model. The rider's body in the air is a rotating rigid body: an orientation quaternion, an angular velocity in the BODY frame
// (so a spin after a flip really is about the new body axis: off-axis rotations fall out of the maths), and a moment of inertia that changes
// as you tuck or extend (angular momentum is conserved, so tucking spins you faster and spreading out slows you down).
// Everything the game names (corks, misty flips, rodeos, double and triple corks, lincoln loops...) is read from that real rotation.
export type Quat={x:number;y:number;z:number;w:number};
export type V3={x:number;y:number;z:number};
export type TrickState={
 q:Quat;wx:number;wy:number;wz:number; // orientation, and angular velocity about body x (flip/pitch), y (spin/yaw), z (roll)
 spin:number;flip:number;roll:number; // total rotation accumulated about each body axis (rad)
 tilt:number;peakTilt:number; // how far the body is from upright now, and at its worst
 inertia:number;tuck:number;ext:number;
 spinMax:number;flipMax:number;
 takeoffSwitch:boolean;peak:number;airTime:number;corrections:number;lastIn:number;
 grab:string;grabTime:number;grabQuality:number;grabs:string[];
 grinding:boolean;names:string[];grind?:string;grindDist?:number;grinds?:string[];switchups?:number;link?:number;railSpin?:number;railEntry?:string;press?:string;pressTime?:number;transfers?:number;
 crossTime?:number;scissorTime?:number;board?:boolean;bike?:boolean;ollie?:string;
 butter?:string;butterSpin?:number;butterTime?:number;manualTime?:number;
};
export const JUMP={gravity:440,fall:1.22,pop:260,ramp:300};
// Rotation is momentum: keys add torque, letting go keeps you turning, and how hard you can rotate depends on how hard you left the ground.
export const AIR_CONTROL={spinAccel:19,flipAccel:15,rollAccel:13,spinBase:4.6,flipBase:4.2,spinGain:11,flipGain:11.5,damp:.1,vzRef:[240,700] as [number,number],tuckI:.38,extI:.45};
export const rotationCaps=(vz0:number)=>{const q=Math.max(0,Math.min(1,(vz0-AIR_CONTROL.vzRef[0])/(AIR_CONTROL.vzRef[1]-AIR_CONTROL.vzRef[0])));return{spinMax:AIR_CONTROL.spinBase+AIR_CONTROL.spinGain*q,flipMax:AIR_CONTROL.flipBase+AIR_CONTROL.flipGain*q};};
const Q0=():Quat=>({x:0,y:0,z:0,w:1});
export function emptyTrick(vz0=0):TrickState{return{q:Q0(),wx:0,wy:0,wz:0,spin:0,flip:0,roll:0,tilt:0,peakTilt:0,inertia:1,tuck:0,ext:0,takeoffSwitch:false,peak:0,airTime:0,corrections:0,lastIn:0,grab:'Safety',grabTime:0,grabQuality:0,grabs:[],grinding:false,names:[],...rotationCaps(vz0)};}
// ---- quaternion helpers (body-frame rotations) ----
export const qmul=(a:Quat,b:Quat):Quat=>({w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z,x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w});
export const qnorm=(q:Quat):Quat=>{const n=Math.hypot(q.x,q.y,q.z,q.w)||1;return{x:q.x/n,y:q.y/n,z:q.z/n,w:q.w/n};};
export const qaxis=(x:number,y:number,z:number,ang:number):Quat=>{const l=Math.hypot(x,y,z)||1,s=Math.sin(ang/2)/l;return{x:x*s,y:y*s,z:z*s,w:Math.cos(ang/2)};};
export const qrot=(q:Quat,v:V3):V3=>{const t={x:2*(q.y*v.z-q.z*v.y),y:2*(q.z*v.x-q.x*v.z),z:2*(q.x*v.y-q.y*v.x)};return{x:v.x+q.w*t.x+(q.y*t.z-q.z*t.y),y:v.y+q.w*t.y+(q.z*t.x-q.x*t.z),z:v.z+q.w*t.z+(q.x*t.y-q.y*t.x)};};
export const qslerp=(a:Quat,b:Quat,t:number):Quat=>{let d=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;const s=d<0?-1:1;d*=s;if(d>.9995)return qnorm({x:a.x+(s*b.x-a.x)*t,y:a.y+(s*b.y-a.y)*t,z:a.z+(s*b.z-a.z)*t,w:a.w+(s*b.w-a.w)*t});
 const th=Math.acos(Math.min(1,d)),st=Math.sin(th),wa=Math.sin((1-t)*th)/st,wb=Math.sin(t*th)/st*s;return{x:a.x*wa+b.x*wb,y:a.y*wa+b.y*wb,z:a.z*wa+b.z*wb,w:a.w*wa+b.w*wb};};
/** How far the body's up axis is from world up (rad), its sideways and fore/aft lean (+z lean = head back), and its yaw (rotation of the facing direction about world up). */
export function bodyAttitude(q:Quat){const up=qrot(q,{x:0,y:1,z:0}),f=qrot(q,{x:0,y:0,z:-1});return{tilt:Math.acos(Math.max(-1,Math.min(1,up.y))),lean:up.z,side:up.x,yaw:Math.atan2(-f.x,-f.z)};}
const clampN=(v:number,m:number)=>Math.max(-m,Math.min(m,v));
export type AirInput={spin:number;flip:number;roll:number;tuck:number;ext:number};
/** One physics step of the body in the air. Inputs are -1..1 torques; tuck/ext 0..1 change the moment of inertia (angular momentum is conserved). */
export function advanceAirTrick(t:TrickState,inp:Partial<AirInput>,dt:number):TrickState{
 const tuckIn=clampN(inp.tuck??0,1),extIn=clampN(inp.ext??0,1);
 const tuck=t.tuck+(Math.max(0,tuckIn)-t.tuck)*Math.min(1,dt*9),ext=t.ext+(Math.max(0,extIn)-t.ext)*Math.min(1,dt*9);
 const target=1-AIR_CONTROL.tuckI*tuck+AIR_CONTROL.extI*ext,inertia=t.inertia+(target-t.inertia)*Math.min(1,dt*10),k=t.inertia/inertia;
 let wx=t.wx*k,wy=t.wy*k,wz=t.wz*k;
 const ix=clampN(inp.flip??0,1),iy=clampN(inp.spin??0,1),iz=clampN(inp.roll??0,1);
 wx+=ix*AIR_CONTROL.flipAccel*dt/inertia;wy+=iy*AIR_CONTROL.spinAccel*dt/inertia;wz+=iz*AIR_CONTROL.rollAccel*dt/inertia;
 const drag=Math.exp(-AIR_CONTROL.damp*dt);wx*=drag;wy*=drag;wz*=drag;
 const cs=1/Math.pow(inertia,.8); // a tucked body can turn faster than a stretched one
 wx=clampN(wx,t.flipMax*cs);wy=clampN(wy,t.spinMax*cs);wz=clampN(wz,t.flipMax*.8*cs);
 // Counter-torque (pushing against the spin you already have) counts as a correction, for style scoring.
 const sig=(iy?Math.sign(iy)*Math.sign(wy)<0?1:0:0)+(ix?Math.sign(ix)*Math.sign(wx)<0?1:0:0);
 const q=qnorm(qmul(qmul(qmul(t.q,qaxis(1,0,0,wx*dt)),qaxis(0,1,0,wy*dt)),qaxis(0,0,1,wz*dt)));
 const a=bodyAttitude(q);
 return {...t,q,wx,wy,wz,spin:t.spin+wy*dt,flip:t.flip+wx*dt,roll:t.roll+wz*dt,tilt:a.tilt,peakTilt:Math.max(t.peakTilt,a.tilt),inertia,tuck,ext,corrections:t.corrections+(sig&&!t.lastIn?1:0),lastIn:sig,airTime:t.airTime+dt};
}

// ---------------- grabs: every grab names the hand(s) and the exact part of the ski it has to reach ----------------
export type GrabHand={hand:'L'|'R';ski:'L'|'R';edge:'in'|'out';t:number}; // t: -1 = ski tip, 0 = binding area, +1 = tail
export type GrabDef={name:string;hands:GrabHand[];cross:number;difficulty:number;desc:string};
export const GRABS:GrabDef[]=[
 {name:'Safety',difficulty:1,cross:0,desc:'Right hand to the outside edge of the right ski, between the bindings.',hands:[{hand:'R',ski:'R',edge:'out',t:-.05}]},
 {name:'Mute',difficulty:1.15,cross:.2,desc:'Left hand across to the inside edge of the right ski, between the bindings.',hands:[{hand:'L',ski:'R',edge:'in',t:-.1}]},
 {name:'Japan',difficulty:1.35,cross:0,desc:'Right hand to the inside edge of the right ski, just ahead of the binding.',hands:[{hand:'R',ski:'R',edge:'in',t:-.38}]},
 {name:'Tail',difficulty:1.25,cross:0,desc:'Left hand back to the tail of the left ski.',hands:[{hand:'L',ski:'L',edge:'out',t:.78}]},
 {name:'Nose',difficulty:1.25,cross:0,desc:'Right hand forward to the tip of the right ski.',hands:[{hand:'R',ski:'R',edge:'out',t:-.78}]},
 {name:'Blunt',difficulty:1.5,cross:.6,desc:'Left hand to the tail of the right ski, with the skis crossed behind you.',hands:[{hand:'L',ski:'R',edge:'out',t:.72}]},
 {name:'Truck Driver',difficulty:1.6,cross:0,desc:'Both hands to the outside edges of both skis, like a steering wheel.',hands:[{hand:'L',ski:'L',edge:'out',t:-.1},{hand:'R',ski:'R',edge:'out',t:-.1}]},
 {name:'Double Safety',difficulty:1.7,cross:.15,desc:'Both hands on the outside edge of the right ski, one in front of the other.',hands:[{hand:'R',ski:'R',edge:'out',t:-.3},{hand:'L',ski:'R',edge:'out',t:.1}]},
 {name:'Critical',difficulty:2,cross:1,desc:'Skis crossed, each hand grabbing the opposite ski near its tip.',hands:[{hand:'L',ski:'R',edge:'out',t:-.72},{hand:'R',ski:'L',edge:'out',t:-.72}]},
];
export const grabNames=GRABS.map(g=>g.name);
export const grabByName=(n:string)=>GRABS.find(g=>g.name===n)||GRABS[0];

// ---------------- naming: read the trick from the actual rotation ----------------
const DEG=(r:number)=>Math.round(r/Math.PI)*180;
export type Trick={name:string;key:string;difficulty:number;rotations:number;inversions:number;kind:string};
export function classifyRotation(t:Pick<TrickState,'spin'|'flip'|'roll'|'peakTilt'|'takeoffSwitch'>,naturalSign=1):Trick{
 const spinA=Math.abs(t.spin),h=Math.min(8,Math.round(spinA/Math.PI)),deg=h*180,F=Math.round(Math.abs(t.flip)/(Math.PI*2)),R=Math.round(Math.abs(t.roll)/(Math.PI*2)),inv=F+R;
 const unnatural=h>0&&Math.sign(t.spin)*naturalSign<0,pre=(t.takeoffSwitch?'Switch ':'')+(unnatural&&inv===0&&t.peakTilt<.9?'Unnatural ':''),dir=t.flip>0?'Backflip':'Frontflip',lean=t.peakTilt;
 const dS=140*Math.pow(Math.max(h,0),1.5);
 let name='',kind='air',diff=0;
 if(inv>=3){kind='triple';name=h>=7?'Triple Cork 1440':h>=5?'Triple Cork '+deg:'Triple '+(R>F?'Sideflip':dir);diff=dS+1900+700*(inv-3);}
 else if(inv===2){kind='double';name=h>=6?'Double Cork '+(h>=7?1260:1080):h>=4?'Double Cork '+Math.max(720,deg):'Double '+(R>F?'Sideflip':dir);diff=dS+1100;}
 else if(inv===1){
  if(R>=1&&F===0){kind='side';name=h>=2?'Cork '+Math.max(360,deg):'Sideflip';diff=dS+600;}
  else if(h===0){kind='flip';name=dir;diff=620;}
  else if(h===1){kind='lincoln';name='Lincoln Loop';diff=dS+760;}
  else{kind='misty';name=(t.flip>0?'Misty ':'Rodeo ')+Math.max(360,deg);diff=dS+820;}
 }else if(lean>=.9&&h>=1){ // off-axis spin with a real tilt, but never fully inverted
  const rollDom=Math.abs(t.roll)>=Math.abs(t.flip);
  if(rollDom){kind='cork';name='Cork '+Math.max(360,deg);diff=dS+520;}else{kind=t.flip>0?'bio':'rodeo';name=(t.flip>0?'Bio ':'Rodeo ')+Math.max(360,deg);diff=dS+560;}
 }else if(lean>=1.1&&h===0){kind='offaxis';name='Off-axis flip';diff=300;}
 else if(h>0){kind='spin';name=String(deg)+'°';diff=dS;}
 const full=(name?pre+name:'');
 return{name:full,key:name.replace(/\d+/g,m=>m),difficulty:diff,rotations:h,inversions:inv,kind};
}

export type LandingGrade='perfect'|'clean'|'sketchy'|'crash';
export type Landing={grade:LandingGrade;kind:'ok'|'backseat'|'nose'|'edge'|'under'|'over';tilt:number;yawErr:number;lean:number;side:number;yaw:number};
/** Judge the touchdown from the body's real orientation. yaw is the facing change; landing facing forward or exactly switch (a multiple of 180°) is fine. */
export function judgeLanding(t:Pick<TrickState,'q'>,opts:{speed?:number}={}):Landing{
 const a=bodyAttitude(t.q),yawErr=Math.abs(a.yaw-Math.round(a.yaw/Math.PI)*Math.PI),tilt=a.tilt;
 const perfect=tilt<.28&&yawErr<.5,clean=tilt<.62&&yawErr<1.0,sketchy=tilt<.95&&yawErr<1.3;
 const grade:LandingGrade=perfect?'perfect':clean?'clean':sketchy?'sketchy':'crash';
 let kind:Landing['kind']='ok';
 if(grade!=='perfect'){if(yawErr>=tilt&&yawErr>.6)kind='edge';else if(a.lean>.25)kind='backseat';else if(a.lean<-.25)kind='nose';else if(tilt>.6)kind=a.lean>=0?'under':'over';}
 return{grade,kind,tilt,yawErr,lean:a.lean,side:a.side,yaw:a.yaw};
}

// ---------------- scoring ----------------
export type Score={clean:boolean;sketchy:boolean;grade:LandingGrade|'rail'|'ground';trick:string;names:string[];base:number;multiplier:number;points:number;parts:Record<string,number>;key:string};
const GRIND_BONUS=150;
/** Variety: repeating the same trick again and again is worth less. `recent` is the list of recent trick keys, newest last. */
export const varietyFactor=(key:string,recent:string[])=>{if(!key)return 1;const n=recent.slice(-6).filter(k=>k===key).length;return Math.max(.35,1-.22*n);};
export function landingResult(t:TrickState,opts:{naturalSign?:number;landing?:Landing;recent?:string[]}={}):Score{
 const land=opts.landing||judgeLanding(t),trick=classifyRotation(t,opts.naturalSign??1),names:string[]=[],parts:Record<string,number>={};
 const clean=land.grade==='perfect'||land.grade==='clean',sketchy=land.grade==='sketchy';
 if(trick.name){names.push(trick.name);parts.rotation=Math.round(trick.difficulty);}
 // grabs: pay for hold time and for how many different grabs; the harder the grab the more it is worth
 const gt=t.grabTime;if(gt>.12){const g=grabByName(t.grab);names.push(t.bike?'No-hander':g.name);parts.grab=Math.round((90+260*Math.min(1,gt/1.1))*g.difficulty*(.6+.4*Math.min(1,t.grabQuality||1)));}
 const crossName=t.board?'Method':t.bike?'Tabletop':'Cross',scissorName=t.board?'Stalefish':t.bike?'Whip':'Scissor';
 if((t.crossTime||0)>.15&&!(t.grabTime>.12&&grabByName(t.grab).cross>=.6)){names.push(crossName);parts.cross=100+Math.round(Math.min(t.crossTime||0,2)*150);}
 if((t.scissorTime||0)>.15){names.push(scissorName);parts.scissor=100+Math.round(Math.min(t.scissorTime||0,2)*150);}
 if(t.ollie){names.push(t.ollie);parts.ollie=90;}
 // rails and jibs
 if(t.grinding){const g=t.grinds&&t.grinds.length?t.grinds:[t.grind||'50–50'];names.push((t.railEntry?t.railEntry+' → ':'')+g.join(' → '));parts.rail=GRIND_BONUS+Math.round((t.grindDist||0)*2)+(g.length-1)*90+(t.railEntry?160:0);}
 if(t.railSpin)parts.railSpin=Math.round(Math.abs(t.railSpin)/Math.PI)*120,names.push('Rail '+Math.round(Math.abs(t.railSpin)/Math.PI)*180);
 if(t.pressTime&&t.pressTime>.2&&t.press){names.push(t.press);parts.press=Math.round(80+Math.min(t.pressTime,2.5)*110);}
 if(t.switchups){names.push((t.switchups>1?t.switchups+'× ':'')+'Switch-up');parts.switchup=t.switchups*150;}
 if(t.transfers){names.push('Transfer');parts.transfer=t.transfers*260;}
 if(t.link){names.push('Link ×'+(t.link+1));parts.link=t.link*200;}
 // amplitude, style, landing cleanliness
 if(!t.grinding&&t.airTime>0){parts.air=Math.round(Math.min(900,t.peak*55));}
 const style=Math.max(.7,1-.08*t.corrections)+(gt>.7&&clean?.12:0)+(land.grade==='perfect'?.1:0);
 let base=Object.values(parts).reduce((a,b)=>a+b,0);
 const variety=varietyFactor(trick.name||names[0]||'',opts.recent||[]);
 const landF=land.grade==='perfect'?1.15:clean?1:sketchy?.5:0;
 const comboWords=Math.min(8,1+Math.max(0,names.filter(n=>!/^Link/.test(n)).length-1)*.6+0); // more different things in one trick, bigger multiplier
 const multiplier=Math.round(comboWords*10)/10;
 base=Math.round(base*style*variety);
 return{clean,sketchy,grade:land.grade,trick:trick.name,names,base,multiplier,points:Math.round(base*multiplier*landF),parts,key:trick.name||names[0]||''};
}
export function advanceHeading(angle:number,steering:number,dt:number,sensitivity=1){return angle+steering*1.7*sensitivity*dt;}
export function travel(x:number,y:number,angle:number,speed:number,dt:number){return{x:x+Math.sin(angle)*speed*dt,y:y+Math.cos(angle)*speed*dt};}
