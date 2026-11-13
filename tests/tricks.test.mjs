import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpile(fs.readFileSync('app/tricks.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {emptyTrick,landingResult,advanceHeading,travel,advanceAirTrick,AIR_CONTROL,JUMP}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('free roam can turn uphill and move sideways',()=>{const heading=advanceHeading(0,1,Math.PI/1.7);assert.ok(travel(0,0,heading,100,1).y < -99);assert.ok(travel(0,0,Math.PI/2,100,1).x>99);});
test('completed spin flip and grab earn a variety multiplier',()=>{const result=landingResult({...emptyTrick(),spin:3*Math.PI,flip:2*Math.PI,grabTime:1});assert.equal(result.clean,true);assert.equal(result.multiplier,4);assert.ok(result.points>4000);assert.ok(result.names.includes('540°'));});
test('unfinished flip or sideways landing loses the combo',()=>{assert.equal(landingResult({...emptyTrick(),flip:Math.PI}).points,0);assert.equal(landingResult({...emptyTrick(),spin:Math.PI/2}).clean,false);});
test('holding a grab and completing a double flip increase score',()=>{assert.ok(landingResult({...emptyTrick(),grabTime:1}).points>landingResult({...emptyTrick(),grabTime:.2}).points);assert.ok(landingResult({...emptyTrick(),flip:4*Math.PI}).points>landingResult({...emptyTrick(),flip:2*Math.PI}).points);});

test('air rotation follows hold duration and stops on release',()=>{
 const a=advanceAirTrick(emptyTrick(),1,0,.2),b=advanceAirTrick(emptyTrick(),1,0,.4);
 assert.ok(Math.abs(b.spin-a.spin*2)<1e-9);
 assert.deepEqual(advanceAirTrick(b,0,0,.5),b);
 assert.ok(Math.abs(advanceAirTrick(b,-1,0,.4).spin)<1e-9);
});
test('W frontflips, S backflips and diagonal input combines axes',()=>{
 const front=advanceAirTrick(emptyTrick(),-1,-1,2*Math.PI/AIR_CONTROL.flipRate);
 assert.ok(front.spin<0);assert.ok(front.flip<0);
 assert.ok(landingResult({...front,spin:0}).names.includes('Frontflip'));
 const back=advanceAirTrick(emptyTrick(),0,1,2*Math.PI/AIR_CONTROL.flipRate);
 assert.ok(landingResult(back).names.includes('Backflip'));
});
test('pop stays below two metres, ramps below 3.2 metres',()=>{
 assert.ok(JUMP.pop*JUMP.pop/(2*JUMP.gravity)*.05<2);
 assert.ok(JUMP.ramp*JUMP.ramp/(2*JUMP.gravity)*.05<3.2);
 assert.ok(JUMP.ramp>JUMP.pop);
});
test('sloppy but close landings still count',()=>{
 assert.equal(landingResult({...emptyTrick(),spin:Math.PI+.8}).clean,true);
 assert.equal(landingResult({...emptyTrick(),flip:2*Math.PI-.9}).clean,true);
});
