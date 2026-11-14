// Pure pose logic for the rider rig (no three.js): turns motion state into joint targets.
// Conventions (rider frame, rider faces -Z): arm `pitch` > 0 swings the arm FORWARD and `elbow` > 0 flexes the forearm forward
// (both measured from a straight, hanging arm); `out` is how far the arm is raised outward from hanging straight down.
// Torso pitch is the opposite way round (the torso pivots at the waist): torsoPitch < 0 folds forward.
export type Arm={pitch:number;out:number;elbow:number;twist:number};
export type PoseIn={speed:number;push:number;phase:number;tuck:number;air:boolean;airT:number;land:number;grab:boolean;grabStyle?:number;edge:number;skid:number;fakie:boolean;board:boolean;rail:boolean;absorb:number;release:number;breath:number};
export type PoseOut={
 flex:number;hipBack:number;hipSide:number;
 torsoPitch:number;torsoYaw:number;torsoRoll:number;
 armL:Arm;armR:Arm;
 poleTilt:number;poleOut:number;polePlant:number;
 stance:number;footYaw:[number,number];insideLift:number;insideLead:number;
 /** snowboard skate push: how far the rear foot is off the board and where in its stride (0..1) */
 skate:number;skateU:number;
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const mixArm=(a:Arm,b:Arm,t:number):Arm=>({pitch:lerp(a.pitch,b.pitch,t),out:lerp(a.out,b.out,t),elbow:lerp(a.elbow,b.elbow,t),twist:lerp(a.twist,b.twist,t)});

/** Pole/skate pushing only makes sense when going slowly: full strength under ~10 km/h, gone by ~20 km/h (engine units; km/h = units*.18). */
export const PUSH_FULL=55,PUSH_NONE=110;
export const pushWeight=(speed:number)=>clamp((PUSH_NONE-speed)/(PUSH_NONE-PUSH_FULL),0,1);
/** Holding the push key at speed tucks instead: smoothly takes over as pushing fades out. */
export const tuckWeight=(speed:number,held:boolean)=>held?clamp((speed-PUSH_FULL-15)/(PUSH_NONE-PUSH_FULL),0,1):0;
// Hard limits the apply layer relies on so the skinned shoulders never fold past what the mesh can take.
export const ARM_LIMITS={pitch:[-.4,1.25],out:[-1.0,.7],elbow:[0,1.7]} as const;
export const clampArm=(a:Arm):Arm=>({pitch:clamp(a.pitch,ARM_LIMITS.pitch[0],ARM_LIMITS.pitch[1]),out:clamp(a.out,ARM_LIMITS.out[0],ARM_LIMITS.out[1]),elbow:clamp(a.elbow,ARM_LIMITS.elbow[0],ARM_LIMITS.elbow[1]),twist:clamp(a.twist,-.5,.5)});

export function computePose(i:PoseIn):PoseOut{
 const glide=clamp((i.speed-10)/50,0,1),airT=i.air?clamp(i.airT/.25,0,1):0,u=(1+Math.cos(i.phase))/2; // u: 1 = poles forward/planted, 0 = driven back
 const skis=!i.board;
 // --- legs: how much the knees are bent
 let flex=(i.board?lerp(.14,.4,glide):lerp(.12,.34,glide))+i.absorb*.5+i.land*.7+i.release*.25+i.skid*.25+i.push*(.1+.14*(1-u));
 flex=Math.max(flex,i.tuck*.92);
 if(i.rail)flex=Math.max(flex,.42);
 if(i.air)flex=.12+airT*(i.grab?.62:.3);
 flex=clamp(flex,0,1);
 // --- torso (negative pitch = folded forward)
 let tp=(i.board?.02+.08*glide+.3*flex:.04+.16*glide+.45*flex)+i.push*(.08+.26*(1-u));
 tp=lerp(tp,.95,i.tuck);
 if(i.air)tp=.1+airT*(i.grab?.5:.25);
 const torsoPitch=-clamp(tp,0,1.05);
 const torsoYaw=i.fakie&&skis&&!i.air?.55:-i.edge*(skis?.12:.05);
 const torsoRoll=-i.edge*(skis?.19:.14);
 // --- arms
 const idle:Arm={pitch:.42,out:.12,elbow:.75,twist:0},run:Arm={pitch:.55,out:.12,elbow:.95,twist:0};
 let A=mixArm(idle,run,glide);
 if(skis){
  A=mixArm(A,{pitch:lerp(-.18,.88,u),out:.22,elbow:lerp(.22,.75,u),twist:0},i.push);   // double-poling: drive back, swing forward
  A=mixArm(A,{pitch:1.0,out:.1,elbow:1.55,twist:0},i.tuck);                               // aero tuck: hands in front of the chin
 }else{
  A={pitch:.22+.1*glide,out:.12+.25*glide,elbow:.5+.2*glide,twist:0};                       // snowboard: relaxed, arms out for balance
  A=mixArm(A,{pitch:.55,out:.2,elbow:1.1,twist:0},i.tuck);
 }
 if(i.air)A=mixArm(A,{pitch:.35,out:-.35,elbow:.5,twist:0},airT);
 if(i.rail)A={pitch:.2,out:-.8,elbow:.35,twist:0};
 let armL:Arm={...A,out:A.out-i.edge*.12},armR:Arm={...A,out:A.out+i.edge*.12}; // inside arm lifts a little in a carve
 if(i.grab&&i.air){const g=i.grabStyle||0;
  // Indy: front hand to the toe edge between the feet. Mute: front hand across to the other edge. Tail: rear hand reaching back. Nose: front hand reaching forward.
  if(g===1)armL={pitch:1.12,out:-.1,elbow:.3,twist:0};else if(g===2)armL={pitch:.9,out:.45,elbow:.4,twist:0};else if(g===3)armL={pitch:1.3,out:.1,elbow:.2,twist:0};else armL={pitch:1.0,out:.25,elbow:.35,twist:0};
  armR={pitch:.15,out:-.7,elbow:.3,twist:0};} // one hand to the gear, the other out for balance
 // --- poles (skis only): tilt > 0 puts the tips behind the hand
 let poleTilt=lerp(-.05,1.0,glide),polePlant=1-glide,poleOut=lerp(.22,.12,glide);
 poleTilt=lerp(poleTilt,lerp(.7,-.45,u),i.push);polePlant=lerp(polePlant,1,i.push);poleOut=lerp(poleOut,.15,i.push);
 poleTilt=lerp(poleTilt,1.45,i.tuck);polePlant=lerp(polePlant,0,i.tuck);
 if(i.air){poleTilt=lerp(poleTilt,1.25,airT);polePlant=lerp(polePlant,0,airT);poleOut=lerp(poleOut,.2,airT);}
 if(i.rail){poleTilt=1;polePlant=0;}
 // --- stance
 const stance=skis?.2-.03*glide+i.skid*.04:.38,footYaw:[number,number]=skis?[0,0]:[.15,-.3];
 const e=Math.abs(i.edge);
 return{flex,hipBack:(skis?.22*flex+.12*i.tuck:.12*flex),hipSide:-i.edge*.14,
  torsoPitch,torsoYaw,torsoRoll,armL:clampArm(armL),armR:clampArm(armR),
  poleTilt,poleOut,polePlant:clamp(polePlant,0,1),stance,footYaw,insideLift:skis&&!i.air?.03*e:0,insideLead:skis&&!i.air?.12*e:0,
  skate:i.board&&!i.air?i.push:0,skateU:u};
}

/** Ease one pose toward another (every number, including the arm and array members). */
export function blendPose(a:PoseOut,b:PoseOut,k:number):PoseOut{
 const m=(x:unknown,y:unknown):unknown=>typeof x==='number'?x+((y as number)-x)*k:Array.isArray(x)?x.map((v,i)=>m(v,(y as unknown[])[i])):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).map(key=>[key,m((x as Record<string,unknown>)[key],(y as Record<string,unknown>)[key])])):y;
 return m(a,b) as PoseOut;
}
