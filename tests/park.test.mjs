import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=ts.transpile(fs.readFileSync('app/park.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {kickerLift,kickerShape,kickerLaunch,railShape,onRail,grindName}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const f={x:100,y:1000,size:1,seed:2};
test('kicker rises from zero at its foot to full height at the lip, only within its width',()=>{
 const k=kickerShape(f);assert.equal(kickerLift(f,100,k.start),0);assert.ok(Math.abs(kickerLift(f,100,k.lip)-k.height)<1e-9);
 assert.ok(kickerLift(f,100,k.lip-10)>kickerLift(f,100,k.lip-40));assert.equal(kickerLift(f,100+k.half+1,k.lip-5),0);assert.equal(kickerLift(f,100,k.lip+1),0);
});
test('kicker launch grows with speed and size; crawling riders just roll off',()=>{
 assert.equal(kickerLaunch(f,30),0);assert.ok(kickerLaunch(f,250)>kickerLaunch(f,120));assert.ok(kickerLaunch({...f,size:1.3},200)>kickerLaunch(f,200));
});
test('rails and boxes: span, width and naming',()=>{
 const rail=railShape(f),box=railShape({...f,seed:3});assert.equal(rail.box,false);assert.equal(box.box,true);assert.ok(box.half>rail.half);
 assert.equal(onRail(f,100,1000),true);assert.equal(onRail(f,100+rail.half+2,1000),false);assert.equal(onRail(f,100,rail.end+1),false);
 assert.equal(grindName(0,false,false),'50–50');assert.equal(grindName(Math.PI/2,true,false),'Boardslide');assert.equal(grindName(Math.PI/2,false,false),'Railslide');assert.equal(grindName(Math.PI,false,true),'Switch 50–50');
});
