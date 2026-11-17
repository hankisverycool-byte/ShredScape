import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('app/tricks.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const T=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const {emptyTrick,landingResult,advanceHeading,travel,advanceAirTrick,rotationCaps,JUMP,GRABS,grabByName,classifyRotation,judgeLanding,bodyAttitude,qaxis,qmul,varietyFactor,qrot}=T;
// Fly the body for `t` seconds with fixed inputs. vz sets how hard you left the ground (rotation caps).
const fly=(t0,inp,t,steps=600)=>{let x=t0;for(let i=0;i<steps;i++)x=advanceAirTrick(x,inp,t/steps);return x;};
const deg=r=>r*180/Math.PI;
test('free roam can turn uphill and move sideways',()=>{const heading=advanceHeading(0,1,Math.PI/1.7);assert.ok(travel(0,0,heading,100,1).y < -99);assert.ok(travel(0,0,Math.PI/2,100,1).x>99);});
test('rotation is momentum: it builds, coasts when you let go, and reverses when you push the other way',()=>{
 const a=fly(emptyTrick(560),{spin:1},.5);assert.ok(a.spin>0&&a.wy>0);
 const coast=fly(a,{},.3);assert.ok(coast.spin>a.spin+.5*a.wy*.3,'keeps turning');assert.ok(Math.abs(coast.wy-a.wy)<a.wy*.2);
 const stop=fly(a,{spin:-1},.8);assert.ok(Math.abs(stop.wy)<a.wy,'opposite input brakes');
});
test('tucking speeds rotation up and extending slows it, because angular momentum is conserved',()=>{
 const spin=fly(emptyTrick(560),{spin:1},.5),tuck=fly(spin,{tuck:1},.5),ext=fly(spin,{ext:1},.5),plain=fly(spin,{},.5);
 assert.ok(tuck.wy>plain.wy*1.25,'tucked '+tuck.wy+' vs '+plain.wy);assert.ok(ext.wy<plain.wy*.85,'extended '+ext.wy+' vs '+plain.wy);
 assert.ok(tuck.inertia<1&&ext.inertia>1);
});
test('a flat hop cannot spin much; a huge jump can do multiple turns',()=>{
 const flat=fly(emptyTrick(JUMP.pop),{spin:1,flip:1},2*JUMP.pop/JUMP.gravity/1.1),huge=fly(emptyTrick(570),{spin:1,flip:1},2*570/JUMP.gravity/1.1);
 assert.ok(flat.spin<1.75*Math.PI&&flat.flip<1.65*Math.PI,'flat '+flat.spin.toFixed(2)+' '+flat.flip.toFixed(2));
 assert.ok(huge.spin>3*Math.PI&&huge.flip>2*Math.PI,'huge '+huge.spin.toFixed(2)+' '+huge.flip.toFixed(2));
 assert.ok(rotationCaps(570).spinMax>rotationCaps(JUMP.pop).spinMax*2);
});
test('off-axis rotation: spinning after flipping turns about the new body axis, so the real orientation changes',()=>{
 // flip the body 90 degrees onto its back, then "spin": the body's up axis should sweep through the horizon, not stay upright
 let t=emptyTrick(560);t={...t,q:qaxis(1,0,0,Math.PI/2)};const before=bodyAttitude(t.q);
 t=fly(t,{spin:1},.5);const after=bodyAttitude(t.q);
 assert.ok(before.tilt>1.5,'starts 90deg tilted');assert.ok(Math.abs(after.yaw-before.yaw)<3,'yaw is not simply the spin total');assert.ok(t.spin>1,'spin accumulated about the body axis');
 // pure spin about the upright body keeps it upright
 const up=fly(emptyTrick(560),{spin:1},.6);assert.ok(bodyAttitude(up.q).tilt<.01);
});
test('naming reads the real rotation: spins, corks, flips, double and triple corks',()=>{
 const base={spin:0,flip:0,roll:0,peakTilt:0,takeoffSwitch:false},c=o=>classifyRotation({...base,...o}).name,P=Math.PI;
 for(const [h,n] of [[1,'180°'],[2,'360°'],[3,'540°'],[4,'720°'],[5,'900°'],[6,'1080°'],[7,'1260°'],[8,'1440°']])assert.equal(c({spin:h*P}),n);
 assert.equal(c({spin:3*P,takeoffSwitch:true}),'Switch 540°');assert.equal(c({spin:-3*P}),'Unnatural 540°');
 assert.equal(c({spin:2*P,roll:.2,peakTilt:1.2}),'Cork 360');assert.equal(c({spin:3*P,roll:.4,peakTilt:1.3}),'Cork 540');assert.equal(c({spin:4*P,roll:.4,peakTilt:1.3}),'Cork 720');assert.equal(c({spin:5*P,roll:.4,peakTilt:1.3}),'Cork 900');
 assert.equal(c({spin:4*P,flip:.4,peakTilt:1.2}),'Bio 720');assert.equal(c({spin:3*P,flip:-.4,peakTilt:1.2}),'Rodeo 540');
 assert.equal(c({flip:2*P}),'Backflip');assert.equal(c({flip:-2*P}),'Frontflip');assert.equal(c({flip:4*P}),'Double Backflip');assert.equal(c({flip:6*P}),'Triple Backflip');
 assert.equal(c({spin:P,flip:2*P,peakTilt:3}),'Lincoln Loop');assert.equal(c({spin:3*P,flip:2*P,peakTilt:3}),'Misty 540');assert.equal(c({spin:3*P,flip:-2*P,peakTilt:3}),'Rodeo 540');
 assert.equal(c({spin:6*P,flip:2*P,peakTilt:3}),'Double Cork 1080'.replace('Double Cork 1080','Misty 1080').replace('Misty','Misty'));
 assert.equal(c({spin:6*P,flip:4*P,peakTilt:3}),'Double Cork 1080');assert.equal(c({spin:7*P,flip:4*P,peakTilt:3}),'Double Cork 1260');assert.equal(c({spin:8*P,flip:6*P,peakTilt:3}),'Triple Cork 1440');
 assert.equal(c({roll:2*P,peakTilt:3}),'Sideflip');assert.equal(c({flip:.2,peakTilt:1.3}),'Off-axis flip');
});
test('landings are judged from the body: perfect, clean, sketchy, crash, with a reason',()=>{
 const J=q=>judgeLanding({q}),I={x:0,y:0,z:0,w:1};
 assert.equal(J(I).grade,'perfect');assert.equal(J(qaxis(0,1,0,Math.PI)).grade,'perfect','a clean switch landing');
 assert.equal(J(qaxis(1,0,0,.45)).grade,'clean');assert.equal(J(qaxis(1,0,0,.45)).kind,'backseat');
 assert.equal(J(qaxis(1,0,0,-.45)).kind,'nose');assert.equal(J(qaxis(1,0,0,.8)).grade,'sketchy');
 assert.equal(J(qaxis(0,1,0,Math.PI/2)).grade,'crash');assert.equal(J(qaxis(0,1,0,Math.PI/2)).kind,'edge');assert.equal(J(qaxis(1,0,0,1.8)).grade,'crash');
});
test('all nine grabs name the hand and the exact part of the ski it has to reach',()=>{
 const names=['Safety','Mute','Japan','Tail','Nose','Blunt','Truck Driver','Double Safety','Critical'];
 assert.deepEqual(GRABS.map(g=>g.name),names);
 for(const g of GRABS){assert.ok(g.hands.length>=1&&g.hands.every(h=>['L','R'].includes(h.hand)&&['L','R'].includes(h.ski)&&h.t>=-1&&h.t<=1),g.name);assert.ok(g.difficulty>=1&&g.desc.length>20);}
 assert.equal(grabByName('Truck Driver').hands.length,2);assert.equal(grabByName('Critical').cross,1);assert.ok(grabByName('Critical').difficulty>grabByName('Safety').difficulty);
});
test('scoring: difficulty, grab quality and duration, amplitude, landing grade, combos and variety all matter',()=>{
 const P=Math.PI,mk=o=>({...emptyTrick(),...o}),S=(o,opts)=>landingResult(mk(o),opts);
 const plain=S({spin:2*P,peak:4,airTime:1}),spin5=S({spin:5*P,peak:4,airTime:1});assert.ok(spin5.points>plain.points*2.5,'harder rotation pays much more');
 const grabbed=S({spin:2*P,peak:4,airTime:1,grabTime:1,grab:'Mute',grabQuality:1}),short=S({spin:2*P,peak:4,airTime:1,grabTime:.2,grab:'Mute',grabQuality:1}),weak=S({spin:2*P,peak:4,airTime:1,grabTime:1,grab:'Mute',grabQuality:.2});
 assert.ok(grabbed.points>plain.points&&grabbed.points>short.points&&grabbed.points>weak.points);assert.ok(S({spin:2*P,grabTime:1,grab:'Critical',peak:4,airTime:1,grabQuality:1}).points>S({spin:2*P,grabTime:1,grab:'Safety',peak:4,airTime:1,grabQuality:1}).points);
 assert.ok(S({spin:2*P,peak:12,airTime:2}).points>plain.points,'amplitude');
 const sk=S({spin:2*P,peak:4,airTime:1,q:qaxis(1,0,0,.8)});assert.equal(sk.grade,'sketchy');assert.ok(sk.points<plain.points);assert.equal(S({spin:2*P,peak:4,airTime:1,q:qaxis(0,1,0,Math.PI/2)}).points,0);
 const noisy=S({spin:2*P,peak:4,airTime:1,corrections:5});assert.ok(noisy.points<plain.points,'style: lots of corrections costs points');
 const again=S({spin:2*P,peak:4,airTime:1},{recent:['360°','360°','360°']});assert.ok(again.points<plain.points*.5,'repeating penalised');assert.equal(varietyFactor('x',['y']),1);assert.ok(varietyFactor('360°',['360°','360°','360°','360°'])>=.35);
 const combo=S({spin:3*P,peak:4,airTime:1,grabTime:1,grab:'Safety',crossTime:.5,grabQuality:1});assert.ok(combo.multiplier>S({spin:3*P,peak:4,airTime:1}).multiplier,'more in one trick, bigger multiplier');
});
test('rails and jibs: entries, spins, presses, switch-ups, transfers and links are scored',()=>{
 const base={...emptyTrick(),grinding:true,grindDist:200,grinds:['50–50']};const S=o=>landingResult({...base,...o},{landing:{grade:'clean',kind:'ok',tilt:0,yawErr:0,lean:0,side:0,yaw:0}});
 const plain=S({}),entry=S({railEntry:'Frontside 270 on'}),spin=S({railSpin:2*Math.PI}),press=S({press:'Nose press',pressTime:1.5}),sw=S({switchups:1}),tr=S({transfers:1}),lk=S({link:2});
 for(const r of [entry,spin,press,sw,tr,lk])assert.ok(r.points>plain.points);assert.ok(entry.names.join().includes('270'));assert.ok(press.names.includes('Nose press'));assert.ok(tr.names.includes('Transfer'));
 assert.ok(S({grinds:['50–50','Boardslide','Lipslide']}).points>plain.points);
});
test('Q / E tricks: cross, scissor; method, stalefish on a board; tabletop, whip on a bike',()=>{
 const n=o=>landingResult({...emptyTrick(),...o},{landing:{grade:'clean',kind:'ok',tilt:0,yawErr:0,lean:0,side:0,yaw:0}}).names;
 assert.ok(n({crossTime:.5}).includes('Cross'));assert.ok(n({scissorTime:.5}).includes('Scissor'));assert.ok(n({board:true,crossTime:.5}).includes('Method'));assert.ok(n({board:true,scissorTime:.5}).includes('Stalefish'));
 assert.ok(n({bike:true,crossTime:.5}).includes('Tabletop'));assert.ok(n({bike:true,scissorTime:.5}).includes('Whip'));
});
test('pop stays below about four metres, ramps below five and a half',()=>{
 assert.ok(JUMP.pop*JUMP.pop/(2*JUMP.gravity)*.05<4.2);assert.ok(JUMP.ramp*JUMP.ramp/(2*JUMP.gravity)*.05<5.5);assert.ok(JUMP.ramp>JUMP.pop);
});
