import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const transpile=path=>ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const source=transpile('app/game-engine.ts').replace("'./renderer3d'",JSON.stringify(url('export function createMountain3D(){return{draw(f){globalThis.frameState=f},destroy(){}}}'))).replace("'./world'",JSON.stringify(url(transpile('app/world.ts')))).replace("'./tricks'",JSON.stringify(url(transpile('app/tricks.ts')))).replace("'./ski-physics'",JSON.stringify(url(transpile('app/ski-physics.ts')))).replace("'./rig-pose'",JSON.stringify(url(transpile('app/rig-pose.ts')))).replace("'./park'",JSON.stringify(url(transpile('app/park.ts')))).replace("'./race'",JSON.stringify(url(transpile('app/race.ts').replace("'./world'",JSON.stringify(url(transpile('app/world.ts')))))));
const {createGame}=await import(url(source));
globalThis.window={addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem(){return null},setItem(){}};
let callback;
globalThis.requestAnimationFrame=fn=>(callback=fn,1);
globalThis.cancelAnimationFrame=()=>{};
function setup(){let snapshot;const game=createGame({},s=>snapshot=s);let now=performance.now();function tick(seconds){for(let i=0;i<Math.round(seconds*200);i++){now+=5;callback(now);}}game.start();return{game,tick,get state(){return snapshot}};}
test('airborne A/D rotates the rider without changing travel heading and releasing stops it',()=>{
 const s=setup();s.game.input('jump',true);s.game.input('right',true);s.tick(.4);s.game.input('right',false);
 const rotation=globalThis.frameState.spin;assert.ok(rotation>3&&rotation<3.3);assert.equal(globalThis.frameState.angle,0);
 s.tick(.15);assert.equal(globalThis.frameState.spin,rotation);s.tick(.5);assert.ok(s.state.score>=360);assert.equal(s.state.bailed,false);s.game.destroy();
});
test('unfinished airborne W flip bails without banking points',()=>{
 const s=setup();s.game.input('jump',true);s.game.input('up',true);s.tick(.33);s.game.input('up',false);s.tick(.6);assert.equal(s.state.bailed,true);assert.equal(s.state.score,0);s.game.destroy();
});
test('pushing drives animation only on snow and stops when released',()=>{
 const s=setup();s.game.input('up',true);s.tick(.25);assert.ok(globalThis.frameState.pushPower>.9);assert.ok(globalThis.frameState.pushPhase>0);
 s.game.input('up',false);s.tick(.5);assert.ok(globalThis.frameState.pushPower<.01);
 s.game.input('jump',true);s.game.input('up',true);s.tick(.15);assert.equal(globalThis.frameState.pushPower,0);s.game.destroy();
});
// World layout facts used below: park-lane features sit at y=row*200+95, x=950+sin(row*1.88)*110.
const laneX=row=>950+Math.sin(row*1.88)*110,laneY=row=>row*200+95;
test('riding onto a rail locks on, slides, and banks a grind after dropping off the end',()=>{
 const s=setup(),row=3;s.game.debugPlace(laneX(row),laneY(row)-130,0,0,150);s.tick(.25);
 let d=s.game.debugState();assert.equal(d.rail,true);assert.ok(d.lift>8);assert.ok(Math.abs(d.x-laneX(row))<3);
 s.tick(2.5);d=s.game.debugState();assert.equal(d.rail,false);assert.equal(d.bailed,false);assert.ok(d.score>=300,'score '+d.score);s.game.destroy();
});
test('jumping onto a rail from the air locks on; turning on it becomes a sideways slide',()=>{
 const s=setup(),row=3;s.game.debugPlace(laneX(row),laneY(row)-200,0,0,150);s.game.input('jump',true);s.game.input('jump',false);s.tick(1);
 assert.equal(s.game.debugState().rail,true);s.game.input('right',true);s.tick(.6);s.game.input('right',false);
 assert.match(s.game.debugState().trick,/Railslide|Boardslide/);s.game.destroy();
});
test('a snow kicker lifts the rider up its face and launches them, faster = higher',()=>{
 const air=v=>{const s=setup(),row=1;s.game.debugPlace(laneX(row),laneY(row)-120,0,0,v);let lifted=0,peak=0;for(let i=0;i<60;i++){s.tick(.05);const d=s.game.debugState();lifted=Math.max(lifted,d.lift);peak=Math.max(peak,d.z);}s.game.destroy();return{lifted,peak};};
 const slow=air(120),fast=air(260);assert.ok(slow.lifted>15);assert.ok(fast.peak>slow.peak+10,'fast '+fast.peak.toFixed(0)+' slow '+slow.peak.toFixed(0));
});
test('holding push from a standstill poles at first, then tucks once you are fast',()=>{
 const s=setup();s.game.debugPlace(-380,1400,0,0,0);s.game.input('up',true);
 let maxPush=0,tuckWhilePushing=0;const log=[];
 for(let i=0;i<60;i++){s.tick(.05);const d=s.game.debugState();maxPush=Math.max(maxPush,d.pushPower);if(d.pushPower>.5)tuckWhilePushing=Math.max(tuckWhilePushing,d.tuck);log.push([d.speed,d.pushPower,d.tuck]);}
 const last=s.game.debugState();
 assert.ok(maxPush>.9,'should pole at low speed');
 assert.ok(last.speed>110,'should get up to speed, got '+last.speed.toFixed(0));assert.equal(last.bailed,false);
 assert.ok(last.pushPower<.05,'pole push gone at speed, got '+last.pushPower.toFixed(2));
 assert.ok(last.tuck>.8,'tuck at speed, got '+last.tuck.toFixed(2));
 assert.ok(tuckWhilePushing<.5,'no tuck while still poling');
 s.game.destroy();
});
test('the push animation never runs fast: at 30 km/h pressing the key does not pole',()=>{
 const s=setup();s.game.debugPlace(-380,1400,0,0,170);s.game.input('up',true);s.tick(.6);
 const d=s.game.debugState();assert.ok(d.pushPower<.02,'pushPower '+d.pushPower);assert.ok(d.tuck>.5);s.game.destroy();
});
