import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=ts.transpile(fs.readFileSync('app/rig-pose.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {computePose,blendPose,pushWeight,tuckWeight,ARM_LIMITS,PUSH_FULL,PUSH_NONE}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const base={speed:0,push:0,phase:0,tuck:0,air:false,airT:0,land:0,grab:false,edge:0,skid:0,fakie:false,board:false,rail:false,absorb:0,release:0,breath:0};
test('pushing is a low-speed move: full under ~10 km/h, gone by ~20 km/h',()=>{
 assert.equal(pushWeight(0),1);assert.equal(pushWeight(PUSH_FULL),1);assert.equal(pushWeight(PUSH_NONE),0);assert.equal(pushWeight(300),0);
 assert.ok(pushWeight(80)>0&&pushWeight(80)<1);assert.ok(PUSH_NONE*.18<22&&PUSH_FULL*.18<11);
});
test('holding push at speed tucks instead: tuck takes over as pushing fades',()=>{
 assert.equal(tuckWeight(20,true),0);assert.equal(tuckWeight(300,true),1);assert.equal(tuckWeight(300,false),0);
 assert.ok(tuckWeight(PUSH_NONE,true)>.5);
});
test('a tuck folds the torso forward and bends the knees deeper than gliding',()=>{
 const glide=computePose({...base,speed:150}),tuck=computePose({...base,speed:150,tuck:1});
 assert.ok(tuck.flex>glide.flex+.3);assert.ok(tuck.torsoPitch<glide.torsoPitch-.3);assert.ok(tuck.poleTilt>glide.poleTilt);assert.equal(tuck.polePlant,0);
});
test('arms stay inside the shoulder limits in every state',()=>{
 const states=[{},{speed:150},{push:1,phase:0},{push:1,phase:Math.PI},{push:.5,phase:2},{tuck:1,speed:200},{air:true,airT:1},{air:true,airT:1,grab:true},{rail:true},{board:true,speed:100},{board:true,push:1},{edge:1,speed:150},{edge:-1,speed:150}];
 for(const st of states)for(let ph=0;ph<6.3;ph+=.7){const p=computePose({...base,...st,phase:ph});
  for(const a of [p.armL,p.armR]){assert.ok(a.pitch>=ARM_LIMITS.pitch[0]&&a.pitch<=ARM_LIMITS.pitch[1],JSON.stringify(st)+' pitch '+a.pitch);assert.ok(a.elbow>=ARM_LIMITS.elbow[0]&&a.elbow<=ARM_LIMITS.elbow[1]);assert.ok(a.out>=ARM_LIMITS.out[0]&&a.out<=ARM_LIMITS.out[1]);}
  assert.ok(p.flex>=0&&p.flex<=1&&Math.abs(p.torsoPitch)<=1.05);}
});
test('double-poling swings the arms between forward and driven back; the same cycle is bounded',()=>{
 const reach=computePose({...base,push:1,phase:0}),drive=computePose({...base,push:1,phase:Math.PI});
 assert.ok(reach.armL.pitch>.7);assert.ok(drive.armL.pitch<.1);assert.ok(reach.armL.pitch-drive.armL.pitch<1.2);
});
test('on a board only the rear foot skates, and only when pushing',()=>{
 assert.equal(computePose({...base,board:true,push:0}).skate,0);assert.ok(computePose({...base,board:true,push:1}).skate>.9);assert.equal(computePose({...base,board:false,push:1}).skate,0);
});
test('blending eases every number toward the target',()=>{
 const a=computePose(base),b=computePose({...base,tuck:1,speed:200}),m=blendPose(a,b,.5);
 assert.ok(Math.abs(m.flex-(a.flex+b.flex)/2)<1e-9);assert.ok(Math.abs(m.armL.elbow-(a.armL.elbow+b.armL.elbow)/2)<1e-9);assert.equal(m.footYaw.length,2);
});
