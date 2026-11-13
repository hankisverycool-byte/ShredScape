export type TrickState={spin:number;flip:number;grabTime:number;grab:string;grinding:boolean;names:string[]};
export const JUMP={gravity:440,pop:185,ramp:235};
export const AIR_CONTROL={spinRate:Math.PI*2.5,flipRate:Math.PI*3};
export function emptyTrick():TrickState{return{spin:0,flip:0,grabTime:0,grab:'Indy',grinding:false,names:[]};}
// Continuous, signed input: releasing stops immediately; opposite keys cancel.
export function advanceAirTrick(t:TrickState,spinInput:number,flipInput:number,dt:number){
 return {...t,spin:t.spin+Math.max(-1,Math.min(1,spinInput))*AIR_CONTROL.spinRate*dt,flip:t.flip+Math.max(-1,Math.min(1,flipInput))*AIR_CONTROL.flipRate*dt};
}
export function landingResult(t:TrickState){
 const spin=Math.abs(t.spin),flip=Math.abs(t.flip),turn=Math.PI*2;
 const spinTurns=Math.round(spin/Math.PI),flipTurns=Math.round(flip/turn);
 const spinError=Math.abs(spin-spinTurns*Math.PI),flipError=Math.abs(flip-flipTurns*turn);
 // Forgiving: land within ~57° of straight/switch and ~63° of a full flip.
 const clean=spinError<1&&flipError<1.1;
 const names:string[]=[];let base=0;
 if(spinTurns){names.push((spinTurns*180)+'°');base+=spinTurns*180;}
 if(flipTurns){const direction=t.flip<0?'Frontflip':'Backflip';names.push((flipTurns>1?flipTurns+'× ':'')+direction);base+=flipTurns*500;}
 if(t.grabTime>.12){names.push(t.grab);base+=Math.round(120+Math.min(t.grabTime,2)*160);}
 if(t.grinding){names.push('50–50');base+=350;}
 const multiplier=Math.min(8,1+names.length);
 return{clean,names,base,multiplier,points:clean?base*multiplier:0};
}
export function advanceHeading(angle:number,steering:number,dt:number,sensitivity=1){return angle+steering*1.7*sensitivity*dt;}
export function travel(x:number,y:number,angle:number,speed:number,dt:number){return{x:x+Math.sin(angle)*speed*dt,y:y+Math.cos(angle)*speed*dt};}
