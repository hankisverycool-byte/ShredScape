export type TrickState={spin:number;flip:number;grabTime:number;grab:string;grinding:boolean;names:string[]};
export function emptyTrick():TrickState{return{spin:0,flip:0,grabTime:0,grab:'Indy',grinding:false,names:[]};}
export function landingResult(t:TrickState){
 const spin=Math.abs(t.spin),flip=Math.abs(t.flip),turn=Math.PI*2;
 const spinTurns=Math.round(spin/Math.PI),flipTurns=Math.round(flip/turn);
 const spinError=Math.abs(spin-spinTurns*Math.PI),flipError=Math.abs(flip-flipTurns*turn);
 const clean=(spin<.2||spinError<.48)&&(flip<.2||flipError<.55);
 const names:string[]=[];let base=0;
 if(spinTurns){names.push((spinTurns*180)+'°');base+=spinTurns*180;}
 if(flipTurns){names.push(flipTurns>1?'Double backflip':'Backflip');base+=flipTurns*500;}
 if(t.grabTime>.12){names.push(t.grab);base+=Math.round(120+Math.min(t.grabTime,2)*160);}
 if(t.grinding){names.push('50–50');base+=350;}
 const multiplier=Math.min(8,1+names.length);
 return{clean,names,base,multiplier,points:clean?base*multiplier:0};
}
export function advanceHeading(angle:number,steering:number,dt:number,sensitivity=1){return angle+steering*1.7*sensitivity*dt;}
export function travel(x:number,y:number,angle:number,speed:number,dt:number){return{x:x+Math.sin(angle)*speed*dt,y:y+Math.cos(angle)*speed*dt};}
