import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const {KICKER_CLASSES,KICKER,kickerLift,kickerShape,kickerSlope,kickerExitVz,kickerJumpVz,kickerPop,kickerClass,railShape,onRail,grindName}=await mod('app/park.ts');
const k=(size)=>({x:100,y:1000,size,seed:size});
test('six kicker classes, each longer, wider, taller and with more run-out than the last',()=>{
 assert.deepEqual(KICKER_CLASSES.map(c=>c.name),['MINI','SMALL','MEDIUM','LARGE','HUGE','GIGANTIC']);
 for(let i=1;i<6;i++){const a=KICKER_CLASSES[i-1],b=KICKER_CLASSES[i];assert.ok(b.run>a.run&&b.half>a.half&&b.height>a.height&&b.landing>a.landing);}
 assert.equal(kickerClass(k(0)).name,'MINI');assert.equal(kickerClass(k(5)).name,'GIGANTIC');assert.equal(kickerClass(k(9)).name,'GIGANTIC');
});
test('a kicker rises from zero at its foot to full height at the lip, only within its width',()=>{
 for(let i=0;i<6;i++){const f=k(i),s=kickerShape(f);assert.equal(kickerLift(f,100,s.start),0);assert.ok(Math.abs(kickerLift(f,100,s.lip)-s.height)<1e-9);
  assert.ok(kickerLift(f,100,s.lip-10)>kickerLift(f,100,s.lip-40));assert.equal(kickerLift(f,100+s.half+1,s.lip-5),0);assert.equal(kickerLift(f,100,s.lip+1),0);}
});
test('the face is steepest at the lip, and bigger kickers have steeper lips',()=>{
 for(let i=0;i<6;i++){const s=kickerShape(k(i));assert.ok(kickerSlope(k(i),s.lip)>kickerSlope(k(i),s.lip-s.run*.5));}
 for(let i=1;i<6;i++)assert.ok(kickerSlope(k(i),kickerShape(k(i)).lip)>kickerSlope(k(i-1),kickerShape(k(i-1)).lip)-.01);
});
test('rolling off is a small hop; jumping at the lip is much more, and jumping early is worth far less',()=>{
 for(let i=0;i<6;i++){const f=k(i),lip=kickerShape(f).lip,v=280;assert.ok(kickerJumpVz(f,lip,v)>2*kickerExitVz(f,v),'class '+i);
  assert.ok(kickerPop(f,lip)>1.9*kickerPop(f,kickerShape(f).start+kickerShape(f).run*.5));assert.equal(kickerExitVz(f,0),0);}
 assert.ok(kickerJumpVz(k(5),kickerShape(k(5)).lip,280)>kickerJumpVz(k(0),kickerShape(k(0)).lip,280)*2);
 assert.ok(kickerJumpVz(k(3),kickerShape(k(3)).lip,400)>kickerJumpVz(k(3),kickerShape(k(3)).lip,150));
});
test('rails and boxes: span, width and naming',()=>{
 const f={x:100,y:1000,size:1,seed:2},rail=railShape(f),box=railShape({...f,seed:3});assert.equal(rail.box,false);assert.equal(box.box,true);assert.ok(box.half>rail.half);
 assert.equal(onRail(f,100,1000),true);assert.equal(onRail(f,100+rail.half+2,1000),false);assert.equal(onRail(f,100,rail.end+1),false);
 assert.equal(grindName(0,false,false),'50–50');assert.equal(grindName(-Math.PI/2,true,false),'Lipslide');assert.equal(grindName(-Math.PI/2,false,false),'Lipslide');assert.equal(grindName(Math.PI/2,true,false),'Boardslide');assert.equal(grindName(Math.PI/2,false,false),'Railslide');assert.equal(grindName(Math.PI,false,true),'Switch 50–50');
});
