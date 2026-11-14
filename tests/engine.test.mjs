import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const {createGame}=await mod('app/game-engine.ts');
const {PARK_FEATURES}=await mod('app/world.ts');
const {kickerShape,railShape}=await mod('app/park.ts');
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
const rails=PARK_FEATURES.filter(f=>f.kind==='rail'),kickers=PARK_FEATURES.filter(f=>f.kind==='ramp');
const railAt=(pred)=>rails.find(pred);
test('riding onto a rail locks on, slides, and banks a grind after dropping off the end',()=>{
 const f=rails[0],r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-60,0,0,150);s.tick(.5);
 let d=s.game.debugState();assert.equal(d.rail,true);assert.ok(d.lift>8);assert.ok(Math.abs(d.x-f.x)<3);
 s.tick(.4);d=s.game.debugState();assert.equal(d.rail,false);assert.equal(d.bailed,false);assert.ok(d.score>=150,'score '+d.score);s.game.destroy();
});
test('jumping onto a rail from the air locks on; turning on it becomes a sideways slide',()=>{
 const f=rails.find(q=>railShape(q).len>=250&&!railShape(q).box),r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-95,0,0,150);s.game.input('jump',true);s.game.input('jump',false);for(let i=0;i<40&&!s.game.debugState().rail;i++)s.tick(.025);
 assert.equal(s.game.debugState().rail,true);s.game.input('right',true);s.tick(.45);s.game.input('right',false);
 assert.match(s.game.debugState().trick,/Railslide|Boardslide/);s.game.destroy();
});
// Fly kicker `k` at `kmh`, jumping at the lip, rolling off, or jumping half way up the face. Returns peak height above terrain in world metres.
function fly(k,kmh,mode){const sh=kickerShape(k),s=setup();s.game.debugPlace(k.x,sh.start-70,0,0,kmh/.18);let peak=0,jumped=false,started=false,relanded=false;
 for(let i=0;i<3000;i++){s.tick(.005);const d=s.game.debugState(),frac=(d.y-sh.start)/(sh.lip-sh.start);
  if(!jumped&&d.lift>0&&((mode==='lip'&&d.y>=sh.lip-10)||(mode==='early'&&frac>=.5))){s.game.input('jump',true);s.game.input('jump',false);jumped=true;}
  if(d.z>0)started=true;if(started){peak=Math.max(peak,d.z);if(d.z===0&&d.lift>0&&mode==='early'){relanded=true;break;}if(d.z===0||d.bailed)break;}}
 s.game.destroy();return{peak:peak*.05,relanded};}
const pickKicker=size=>kickers.find(k=>k.size===size&&k.id.startsWith('air'));
test('jumping off a kicker is what sends you up: rolling off only hops, jumping at the lip gives real air',()=>{
 for(const size of [1,3,5]){const k=pickKicker(size),roll=fly(k,50,'roll').peak,jump=fly(k,50,'lip').peak,lipH=kickerShape(k).height*.05;
  assert.ok(roll-lipH<1.2,`size ${size}: roll-off hop was ${(roll-lipH).toFixed(1)}m`);assert.ok(jump-lipH>1.5*(1+size*.6)*.5,`size ${size}: jump air ${(jump-lipH).toFixed(1)}m`);assert.ok(jump>roll+1);}
});
test('kicker sizes climb from mini to gigantic: each class sends you higher than the one below',()=>{
 const peaks=[0,1,2,3,4,5].map(sz=>fly(pickKicker(sz)||kickers.find(k=>k.size===sz),50,'lip').peak);
 for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1]+.7,'sizes '+peaks.map(p=>p.toFixed(1)).join(', '));
 assert.ok(peaks[0]<3&&peaks[5]>14,'mini '+peaks[0].toFixed(1)+'m, gigantic '+peaks[5].toFixed(1)+'m');
});
test('timing matters: jumping early on a big kicker gives much less air and you come down on the face',()=>{
 const k=pickKicker(5),lip=fly(k,30,'lip'),early=fly(k,30,'early');assert.ok(early.peak<lip.peak*.5,`early ${early.peak.toFixed(1)}m vs lip ${lip.peak.toFixed(1)}m`);assert.equal(early.relanded,true);
 assert.ok(fly(k,60,'early').peak<fly(k,60,'lip').peak*.5);
});
test('faster means more air and distance off the same kicker',()=>{const k=pickKicker(3);assert.ok(fly(k,70,'lip').peak>fly(k,35,'lip').peak+2);});
test('holding push from a standstill poles at first, then tucks once you are fast',()=>{
 const s=setup();s.game.debugPlace(2550,500,0,0,0);s.game.input('up',true);let maxPush=0,tuckWhilePushing=0;
 for(let i=0;i<60;i++){s.tick(.05);const d=s.game.debugState();maxPush=Math.max(maxPush,d.pushPower);if(d.pushPower>.5)tuckWhilePushing=Math.max(tuckWhilePushing,d.tuck);}
 const last=s.game.debugState();assert.ok(maxPush>.9,'should pole at low speed');assert.ok(last.speed>110,'got '+last.speed.toFixed(0));assert.equal(last.bailed,false);
 assert.ok(last.pushPower<.05);assert.ok(last.tuck>.8);assert.ok(tuckWhilePushing<.5);s.game.destroy();
});
test('the push animation never runs fast: at 30 km/h pressing the key does not pole',()=>{
 const s=setup();s.game.debugPlace(2550,500,0,0,170);s.game.input('up',true);s.tick(.6);
 const d=s.game.debugState();assert.ok(d.pushPower<.02,'pushPower '+d.pushPower);assert.ok(d.tuck>.5);s.game.destroy();
});
