export type TrickState={spin:number;flip:number;grabTime:number;grab:string;grinding:boolean;names:string[];grind?:string;grindDist?:number;spinV?:number;flipV?:number;spinMax?:number;flipMax?:number;grinds?:string[];switchups?:number;link?:number};
export const JUMP={gravity:440,pop:215,ramp:250};
// Rotation is momentum: keys add spin acceleration, letting go keeps you turning, and how fast you can turn depends on how hard you left the ground.
// A flat pop only gives about a half turn; a 1080 or a double needs real air off a big kicker.
export const AIR_CONTROL={spinAccel:12,flipAccel:13,spinBase:3.8,flipBase:4,spinGain:9.5,flipGain:11,damp:.12,vzRef:[200,620] as [number,number]};
export const rotationCaps=(vz0:number)=>{const q=Math.max(0,Math.min(1,(vz0-AIR_CONTROL.vzRef[0])/(AIR_CONTROL.vzRef[1]-AIR_CONTROL.vzRef[0])));return{spinMax:AIR_CONTROL.spinBase+AIR_CONTROL.spinGain*q,flipMax:AIR_CONTROL.flipBase+AIR_CONTROL.flipGain*q};};
export function emptyTrick(vz0=0):TrickState{return{spin:0,flip:0,grabTime:0,grab:'Indy',grinding:false,names:[],spinV:0,flipV:0,...rotationCaps(vz0)};}
// Signed input accelerates the rotation; no input just lets it coast (with a little drag), so you can't snap-spin out of nowhere.
export function advanceAirTrick(t:TrickState,spinInput:number,flipInput:number,dt:number){
 const c=rotationCaps(0),sm=t.spinMax??c.spinMax,fm=t.flipMax??c.flipMax,drag=Math.exp(-AIR_CONTROL.damp*dt),clamp=(v:number,m:number)=>Math.max(-m,Math.min(m,v));
 const sv=clamp(((t.spinV??0)+Math.max(-1,Math.min(1,spinInput))*AIR_CONTROL.spinAccel*dt)*drag,sm),fv=clamp(((t.flipV??0)+Math.max(-1,Math.min(1,flipInput))*AIR_CONTROL.flipAccel*dt)*drag,fm);
 return {...t,spinV:sv,flipV:fv,spin:t.spin+sv*dt,flip:t.flip+fv*dt};
}
export function landingResult(t:TrickState){
 const spin=Math.abs(t.spin),flip=Math.abs(t.flip),turn=Math.PI*2;
 const spinTurns=Math.round(spin/Math.PI),flipTurns=Math.round(flip/turn);
 const spinError=Math.abs(spin-spinTurns*Math.PI),flipError=Math.abs(flip-flipTurns*turn);
 // Forgiving: land within ~66° of straight/switch and ~74° of a full flip. A bit further out is a sketchy landing (you keep riding but lose speed), not a wipeout.
 const clean=spinError<1.15&&flipError<1.3,sketchy=!clean&&spinError<1.35&&flipError<1.55;
 const names:string[]=[];let base=0;
 if(spinTurns){names.push((spinTurns*180)+'°');base+=spinTurns*180;}
 if(flipTurns){const direction=t.flip<0?'Frontflip':'Backflip';names.push((flipTurns>1?flipTurns+'× ':'')+direction);base+=flipTurns*500;}
 if(t.grabTime>.12){names.push(t.grab);base+=Math.round(120+Math.min(t.grabTime,2)*160);}
 // Grinds pay for the lock-on plus distance slid.
 if(t.grinding){const g=t.grinds&&t.grinds.length?t.grinds:[t.grind||'50–50'];names.push(g.join(' → '));base+=150+Math.round((t.grindDist||0)*2)+(g.length-1)*90;}
 if(t.switchups){names.push((t.switchups>1?t.switchups+'× ':'')+'Switch-up');base+=t.switchups*150;}
 // Linking: dropping straight from one rail onto the next keeps the run going and pays more each time.
 if(t.link){names.push('Link ×'+(t.link+1));base+=t.link*200;}
 const multiplier=Math.min(8,1+names.length);
 return{clean,sketchy,names,base,multiplier,points:clean?base*multiplier:0};
}
export function advanceHeading(angle:number,steering:number,dt:number,sensitivity=1){return angle+steering*1.7*sensitivity*dt;}
export function travel(x:number,y:number,angle:number,speed:number,dt:number){return{x:x+Math.sin(angle)*speed*dt,y:y+Math.cos(angle)*speed*dt};}
