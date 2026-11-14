import * as T from 'three';
import type {Arm} from './rig-pose';

// Shared rig interface: both rider models (imported "explorer" and hand-built "classic") expose the same
// joints, so one pose pipeline drives either. Everything here is in the rider's body space (faces -Z).
export type Leg={hip:T.Object3D;knee:T.Object3D;ankle:T.Object3D;
 hipRest:T.Vector3;   // hip joint offset from the pelvis centre
 r1:T.Vector3;r2:T.Vector3;L1:number;L2:number; // rest thigh / shin vectors (bone space) and lengths
 soleOff:T.Vector3};  // ankle -> sole centre, in the foot's own frame
export type Rig={
 legs:[Leg,Leg];
 pelvis:T.Vector3;                                     // current hip-centre position (body space)
 movePelvis(x:number,y:number,z:number):void;
 setTorso(pitch:number,yaw:number,roll:number):void;
 setArm(side:0|1,a:Arm):void;
 hands:[T.Object3D,T.Object3D];
 reach:number;                                         // max hip-to-ankle distance
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const _h=new T.Vector3(),_d=new T.Vector3(),_f=new T.Vector3(),_u=new T.Vector3(),_t=new T.Vector3(),_k=new T.Vector3(),_a=new T.Vector3(),_s=new T.Vector3();
const _qs=new T.Quaternion(),_qi=new T.Quaternion(),_qa=new T.Quaternion();

/** Two-bone IK: put the ankle of `leg` at `target` (body space) with the knee bending forward, and tilt the foot to `footQ`. */
export function solveLeg(rig:Rig,side:0|1,target:T.Vector3,footQ:T.Quaternion,ankleLimit=.8){
 const leg=rig.legs[side],hip=_h.copy(rig.pelvis).add(leg.hipRest),d=_d.copy(target).sub(hip);
 const len=clamp(d.length(),Math.abs(leg.L1-leg.L2)+.02,leg.L1+leg.L2-.002);d.normalize();
 const a=Math.acos(clamp((leg.L1*leg.L1+len*len-leg.L2*leg.L2)/(2*leg.L1*len),-1,1)); // angle at the hip between the line to the ankle and the thigh
 _f.set(0,0,-1);const u=_u.copy(_f).addScaledVector(d,-_f.dot(d));if(u.lengthSq()<1e-6)u.set(0,0,-1);u.normalize(); // knee points forward
 const t=_t.copy(d).multiplyScalar(Math.cos(a)).addScaledVector(u,Math.sin(a));
 leg.hip.quaternion.setFromUnitVectors(leg.r1,t);
 const knee=_k.copy(hip).addScaledVector(t,leg.L1),ankle=_a.copy(hip).addScaledVector(d,len);
 _s.copy(ankle).sub(knee).normalize();_qs.setFromUnitVectors(leg.r2,_s); // shin, in body space
 leg.knee.quaternion.copy(_qi.copy(leg.hip.quaternion).invert()).multiply(_qs);
 // Foot follows the ski/board, within what an ankle can do.
 _qa.copy(_qs).invert().multiply(footQ);if(_qa.w<0){_qa.x*=-1;_qa.y*=-1;_qa.z*=-1;_qa.w*=-1;}
 const ang=2*Math.acos(clamp(_qa.w,-1,1));if(ang>ankleLimit)_qa.copy(_qi.identity()).slerp(_qa.clone(),ankleLimit/ang);
 leg.ankle.quaternion.copy(_qa);
}
