import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Compile rig.ts next to node_modules so its `three` import resolves.
fs.mkdirSync('node_modules/.cache-rig',{recursive:true});
fs.writeFileSync('node_modules/.cache-rig/rig.mjs',ts.transpile(fs.readFileSync('app/rig.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}));
const T=await import('three');
const {solveLeg}=await import('../node_modules/.cache-rig/rig.mjs');
// The explorer's left leg: hip (-.18,1.35,0), knee (-.04,-.61) below it, ankle (-.07,-.57,.12) below that.
function makeRig(){
 const root=new T.Group(),hip=new T.Object3D(),knee=new T.Object3D(),ankle=new T.Object3D();
 hip.position.set(-.18,1.35,0);knee.position.set(-.04,-.61,0);ankle.position.set(-.07,-.57,.12);root.add(hip);hip.add(knee);knee.add(ankle);
 const leg={hip,knee,ankle,hipRest:new T.Vector3(-.18,0,0),r1:knee.position.clone().normalize(),r2:ankle.position.clone().normalize(),L1:knee.position.length(),L2:ankle.position.length(),soleOff:new T.Vector3(0,-.17,-.125)};
 return{root,rig:{legs:[leg,leg],pelvis:new T.Vector3(0,1.35,0),reach:leg.L1+leg.L2},leg};
}
const ankleAt=(root,leg)=>{root.updateMatrixWorld(true);return leg.ankle.getWorldPosition(new T.Vector3());};
test('the ankle lands exactly on any reachable target, with the knee pointing forward',()=>{
 const {root,rig,leg}=makeRig();
 for(const [x,y,z] of [[-.2,.3,.1],[-.2,.26,.2],[-.38,.3,.05],[-.2,.6,-.3],[-.2,.45,.35],[-.15,.28,-.15]]){
  const target=new T.Vector3(x,y,z);solveLeg(rig,0,target,new T.Quaternion());
  const got=ankleAt(root,leg);assert.ok(got.distanceTo(target)<2e-3,`target ${[x,y,z]} off by ${got.distanceTo(target).toFixed(4)}`);
  const knee=leg.knee.getWorldPosition(new T.Vector3()),mid=new T.Vector3(-.18,1.35,0).add(target).multiplyScalar(.5);
  assert.ok(knee.z<mid.z+1e-6,'knee should be in front of the hip-ankle line');
 }
});
test('unreachable targets stretch the leg straight toward the target instead of breaking it',()=>{
 const {root,rig,leg}=makeRig(),far=new T.Vector3(-.2,-1,.4);solveLeg(rig,0,far,new T.Quaternion());
 const got=ankleAt(root,leg),hip=new T.Vector3(-.18,1.35,0);
 assert.ok(Math.abs(got.distanceTo(hip)-rig.reach)<.01);assert.ok(Number.isFinite(got.x+got.y+got.z));
});
test('the foot turns to follow the ski but never beyond the ankle limit',()=>{
 const {root,rig,leg}=makeRig(),target=new T.Vector3(-.2,.3,.1);
 solveLeg(rig,0,target,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.3));root.updateMatrixWorld(true);
 const foot=leg.ankle.getWorldQuaternion(new T.Quaternion()),want=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),.3);
 assert.ok(foot.angleTo(want)<.02);
 solveLeg(rig,0,target,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),2),.8);root.updateMatrixWorld(true);
 assert.ok(leg.ankle.quaternion.angleTo(new T.Quaternion())<=.8+1e-6);
});
