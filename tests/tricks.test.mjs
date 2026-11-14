import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('app/tricks.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {emptyTrick,landingResult,advanceHeading,travel,advanceAirTrick,AIR_CONTROL,rotationCaps,JUMP}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('free roam can turn uphill and move sideways',()=>{const heading=advanceHeading(0,1,Math.PI/1.7);assert.ok(travel(0,0,heading,100,1).y < -99);assert.ok(travel(0,0,Math.PI/2,100,1).x>99);});
test('completed spin flip and grab earn a variety multiplier',()=>{const result=landingResult({...emptyTrick(),spin:3*Math.PI,flip:2*Math.PI,grabTime:1});assert.equal(result.clean,true);assert.equal(result.multiplier,4);assert.ok(result.points>4000);assert.ok(result.names.includes('540°'));});
test('unfinished flip or sideways landing loses the combo',()=>{assert.equal(landingResult({...emptyTrick(),flip:Math.PI}).points,0);assert.equal(landingResult({...emptyTrick(),spin:Math.PI/2}).clean,false);});
test('holding a grab and completing a double flip increase score',()=>{assert.ok(landingResult({...emptyTrick(),grabTime:1}).points>landingResult({...emptyTrick(),grabTime:.2}).points);assert.ok(landingResult({...emptyTrick(),flip:4*Math.PI}).points>landingResult({...emptyTrick(),flip:2*Math.PI}).points);});

// Step the rotation model through `t` seconds with fixed inputs.
const run=(t0,spin,flip,t,steps=200)=>{let x=t0;for(let i=0;i<steps;i++)x=advanceAirTrick(x,spin,flip,t/steps);return x;};
test('rotation is momentum: it builds, coasts when you let go, and reverses when you push the other way',()=>{
 const a=run(emptyTrick(560),1,0,.5);assert.ok(a.spin>0&&a.spinV>0);
 const coast=run(a,0,0,.3);assert.ok(coast.spin>a.spin+.5*a.spinV*.3,'keeps turning');assert.ok(Math.abs(coast.spinV-a.spinV)<a.spinV*.15);
 const stop=run(a,-1,0,.8);assert.ok(Math.abs(stop.spinV)<a.spinV,'opposite input brakes');
});
test('a flat hop cannot spin much; a huge jump can do multiple turns',()=>{
 const flat=run(emptyTrick(JUMP.pop),1,1,2*JUMP.pop/JUMP.gravity),huge=run(emptyTrick(570),1,1,2*570/JUMP.gravity);
 assert.ok(flat.spin<1.75*Math.PI&&flat.flip<1.65*Math.PI,'flat '+flat.spin.toFixed(2)+' '+flat.flip.toFixed(2));
 assert.ok(huge.spin>3*Math.PI&&huge.flip>2*Math.PI,'huge '+huge.spin.toFixed(2)+' '+huge.flip.toFixed(2));
 assert.ok(rotationCaps(570).spinMax>rotationCaps(JUMP.pop).spinMax*2);
});
test('W frontflips, S backflips and diagonal input combines axes',()=>{
 const front=run(emptyTrick(570),-1,-1,1.8);
 assert.ok(front.spin<0);assert.ok(front.flip<0);
 assert.ok(landingResult({...front,spin:0,flip:-2*Math.PI}).names.includes('Frontflip'));
 const back=run(emptyTrick(570),0,1,1.8);assert.ok(back.flip>Math.PI);
 assert.ok(landingResult({...back,flip:2*Math.PI}).names.includes('Backflip'));
});
test('pop stays below about four metres, ramps below five and a half',()=>{
 assert.ok(JUMP.pop*JUMP.pop/(2*JUMP.gravity)*.05<4.2);
 assert.ok(JUMP.ramp*JUMP.ramp/(2*JUMP.gravity)*.05<5.5);
 assert.ok(JUMP.ramp>JUMP.pop);
});
test('sloppy but close landings still count',()=>{
 assert.equal(landingResult({...emptyTrick(),spin:Math.PI+.8}).clean,true);
 assert.equal(landingResult({...emptyTrick(),flip:2*Math.PI-.9}).clean,true);
});
