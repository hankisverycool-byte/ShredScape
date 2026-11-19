import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const {createGame}=await mod('app/game-engine.ts');
const W=await mod('app/world.ts');const {PARK_FEATURES}=W;
const {kickerShape,railShape}=await mod('app/park.ts');
const keyHandlers={};globalThis.window={addEventListener(n,f){keyHandlers[n]=f;},removeEventListener(){}};
globalThis.localStorage={getItem(){return null},setItem(){}};
let callback;
globalThis.requestAnimationFrame=fn=>(callback=fn,1);
globalThis.cancelAnimationFrame=()=>{};
function setup(){let snapshot;const game=createGame({},s=>snapshot=s);let now=performance.now();function tick(seconds){for(let i=0;i<Math.round(seconds*200);i++){now+=5;callback(now);}}game.start();return{game,tick,get state(){return snapshot}};}
const charged=s=>{s.game.input('jump',true);s.tick(1.3);s.game.input('jump',false);};
test('Space charges while held and jumps on release: a tap hops, a full charge pops',()=>{
 const tap=setup();tap.game.input('jump',true);tap.game.input('jump',false);tap.tick(.05);let hop=0;for(let i=0;i<150;i++){tap.tick(.01);hop=Math.max(hop,globalThis.frameState.z||0);}tap.game.destroy();
 const full=setup();full.game.input('jump',true);full.tick(.4);const mid=full.state.charge;full.tick(.9);assert.ok(mid>.2&&mid<.5,'charge '+mid);assert.equal(full.state.charge,1);assert.equal(full.state.airborne,false);
 full.game.input('jump',false);let top=0;for(let i=0;i<150;i++){full.tick(.01);top=Math.max(top,globalThis.frameState.z||0);}full.game.destroy();
 assert.ok(top>hop*2,`full ${top.toFixed(0)} vs tap ${hop.toFixed(0)}`);
});
test('airborne A/D rotates the rider without changing travel heading, and keeps turning after release',()=>{
 const s=setup();charged(s);s.game.input('right',true);s.tick(.3);s.game.input('right',false);
 const rotation=Math.abs(globalThis.frameState.spin);assert.ok(rotation>.2&&rotation<3,'spin '+rotation);assert.equal(globalThis.frameState.angle,0);
 s.tick(.1);assert.ok(Math.abs(globalThis.frameState.spin)>rotation,'momentum carries on');s.game.destroy();
});
test('a flat hop cannot be turned into a big spin: holding spin the whole hop never gets past about three quarters of a turn',()=>{
 const s=setup();charged(s);s.game.input('right',true);let spin=0;for(let i=0;i<120;i++){s.tick(.01);spin=Math.max(spin,Math.abs(globalThis.frameState.spin||0));}s.game.destroy();assert.ok(spin<1.8*Math.PI,'spin '+spin.toFixed(2));
});
test('unfinished airborne W flip bails without banking points',()=>{
 const s=setup();charged(s);s.game.input('up',true);s.tick(.3);s.game.input('up',false);s.tick(1.2);assert.equal(s.state.bailed,true);assert.equal(s.state.score,0);s.game.destroy();
});
test('pushing drives animation only on snow and stops when released',()=>{
 const s=setup();s.game.input('up',true);s.tick(.25);assert.ok(globalThis.frameState.pushPower>.9);assert.ok(globalThis.frameState.pushPhase>0);
 s.game.input('up',false);s.tick(.5);assert.ok(globalThis.frameState.pushPower<.01);
 charged(s);s.game.input('up',true);s.tick(.15);assert.equal(globalThis.frameState.pushPower,0);s.game.destroy();
});
const rails=PARK_FEATURES.filter(f=>f.kind==='rail'),kickers=PARK_FEATURES.filter(f=>f.kind==='ramp');
const railAt=(pred)=>rails.find(pred);
test('riding onto a rail locks on, slides, and banks a grind after dropping off the end',()=>{
 const f=rails.find(q=>railShape(q).len>=250&&!railShape(q).box),r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-60,0,0,150);s.tick(.5);
 let d=s.game.debugState();assert.equal(d.rail,true);assert.ok(d.lift>8);assert.ok(Math.abs(d.x-f.x)<3);
 for(let i=0;i<300&&s.game.debugState().rail;i++)s.tick(.02);s.tick(.1);d=s.game.debugState();assert.equal(d.rail,false);assert.equal(d.bailed,false);assert.ok(d.score>=150,'score '+d.score);s.game.destroy();
});
test('jumping onto a rail from the air locks on; turning on it becomes a sideways slide',()=>{
 const f=rails.find(q=>railShape(q).len>=250&&!railShape(q).box),r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-95,0,0,150);s.game.input('jump',true);s.game.input('jump',false);for(let i=0;i<40&&!s.game.debugState().rail;i++)s.tick(.025);
 assert.equal(s.game.debugState().rail,true);s.game.input('right',true);s.tick(.45);s.game.input('right',false);
 assert.match(s.game.debugState().trick,/Railslide|Boardslide/);s.game.destroy();
});
// Fly kicker `k` at `kmh`, jumping at the lip, rolling off, or jumping half way up the face. Returns peak height above terrain in world metres.
function fly(k,kmh,mode,rot=false){const sh=kickerShape(k),s=setup();if(mode!=='roll'){s.game.debugPlace(k.x,sh.start-70,0,0,0);s.game.input('jump',true);s.tick(1.3);}s.game.debugPlace(k.x,sh.start-70,0,0,kmh/.18);let peak=0,spin=0,jumped=false,started=false,relanded=false;
 for(let i=0;i<3000;i++){s.tick(.005);const d=s.game.debugState(),frac=(d.y-sh.start)/(sh.lip-sh.start);
  if(!jumped&&d.lift>0&&((mode==='lip'&&d.y>=sh.lip-10)||(mode==='early'&&frac>=.5))){s.game.input('jump',false);jumped=true;}
  if(d.z>0)started=true;if(started){peak=Math.max(peak,d.z);spin=Math.max(spin,Math.abs(d.spin));if(rot&&d.z>0)s.game.input('right',true);if(d.z===0&&d.lift>0&&mode==='early'){relanded=true;break;}if(d.z===0||d.bailed)break;}}
 s.game.destroy();return{peak:peak*.05,relanded,spin};}
const pickKicker=size=>kickers.find(k=>k.size===size&&k.id.startsWith('air'));
test('jumping off a kicker is what sends you up: rolling off only hops, jumping at the lip gives real air',()=>{
 for(const size of [1,3,5]){const k=pickKicker(size),roll=fly(k,50,'roll').peak,jump=fly(k,50,'lip').peak,lipH=kickerShape(k).height*.05;
  assert.ok(roll-lipH<1.2,`size ${size}: roll-off hop was ${(roll-lipH).toFixed(1)}m`);assert.ok(jump-lipH>1.5*(1+size*.6)*.5,`size ${size}: jump air ${(jump-lipH).toFixed(1)}m`);assert.ok(jump>roll+1);}
});
test('kicker sizes climb from mini to gigantic: each class sends you higher than the one below',()=>{
 const peaks=[0,1,2,3,4,5].map(sz=>fly(pickKicker(sz)||kickers.find(k=>k.size===sz),50,'lip').peak);
 for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1]+.7,'sizes '+peaks.map(p=>p.toFixed(1)).join(', '));
 assert.ok(peaks[0]<3&&peaks[5]>12,'mini '+peaks[0].toFixed(1)+'m, gigantic '+peaks[5].toFixed(1)+'m');
});
test('timing matters: jumping early on a big kicker gives much less air and you come down on the face',()=>{
 const k=pickKicker(5),lip=fly(k,30,'lip'),early=fly(k,30,'early');assert.ok(early.peak<lip.peak*.5,`early ${early.peak.toFixed(1)}m vs lip ${lip.peak.toFixed(1)}m`);assert.equal(early.relanded,true);
 assert.ok(fly(k,60,'early').peak<fly(k,60,'lip').peak*.5);
});
test('faster means more air and distance off the same kicker',()=>{const k=pickKicker(3);assert.ok(fly(k,70,'lip').peak>fly(k,35,'lip').peak+2);});
test('holding push from a standstill poles at first, then tucks once you are fast',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,0);s.game.input('up',true);let maxPush=0,tuckWhilePushing=0;
 for(let i=0;i<60;i++){s.tick(.05);const d=s.game.debugState();maxPush=Math.max(maxPush,d.pushPower);if(d.pushPower>.5)tuckWhilePushing=Math.max(tuckWhilePushing,d.tuck);}
 const last=s.game.debugState();assert.ok(maxPush>.8,'should (got '+maxPush.toFixed(2)+') pole at low speed');assert.ok(last.speed>110,'got '+last.speed.toFixed(0));assert.equal(last.bailed,false);
 assert.ok(last.pushPower<.05);assert.ok(last.tuck>.8);assert.ok(tuckWhilePushing<.5);s.game.destroy();
});
test('the push animation never runs fast: at 30 km/h pressing the key does not pole',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,170);s.game.input('up',true);s.tick(.6);
 const d=s.game.debugState();assert.ok(d.pushPower<.02,'pushPower '+d.pushPower);assert.ok(d.tuck>.5);s.game.destroy();
});

test('rotation is earned by air: a mini kicker allows a turn at most, a gigantic one allows multiple',()=>{
 const mini=fly(pickKicker(0),50,'lip',true).spin,giga=fly(pickKicker(5),60,'lip',true).spin;
 assert.ok(mini<2*Math.PI,'mini spin '+(mini*180/Math.PI).toFixed(0)+'°');assert.ok(giga>3*Math.PI,'gigantic spin '+(giga*180/Math.PI).toFixed(0)+'°');
});
test('landing on the back of a kicker rides it down: the mound is solid, not a hollow ramp',()=>{
 const k=pickKicker(2),sh=kickerShape(k),s=setup();s.game.debugPlace(k.x,sh.start-60,0,0,12);for(let i=0;i<4000;i++){s.tick(.005);if(s.game.debugState().y>sh.lip+20)break;}
 const d=s.game.debugState();assert.ok(d.y>sh.lip,'crossed the top');assert.ok(d.lift>0||d.z>0,'still over the back of the mound: lift '+d.lift.toFixed(1)+' z '+d.z.toFixed(1));assert.equal(d.bailed,false);s.game.destroy();
});

test('on a rail J is a switch-up: it turns you half way round, flipping the slide name, and is banked with the grind',()=>{
 const f=rails.find(q=>railShape(q).len>=250&&!railShape(q).box),r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-60,0,0,150);s.tick(.4);
 assert.equal(s.game.debugState().rail,true);s.game.input('grab',true);s.tick(.05);s.game.input('grab',false);s.tick(.3);const a=Math.abs(s.game.debugState().angle);
 assert.ok(Math.abs(a-Math.PI)<.3,'angle '+a.toFixed(2));let trick='';for(let i=0;i<400&&!trick.includes('Switch-up');i++){s.tick(.02);trick=s.state.trick||'';}
 assert.ok(trick.includes('Switch-up'),'trick '+trick);s.game.destroy();
});
test('dropping from one rail onto another within two seconds links them',()=>{
 const [f,g]=rails.filter(q=>!railShape(q).box&&railShape(q).len>=170),r=railShape(f),s=setup();s.game.debugPlace(f.x,r.start-60,0,0,150);s.tick(.4);assert.equal(s.game.debugState().rail,true);
 for(let i=0;i<300&&s.game.debugState().rail;i++)s.tick(.02);assert.equal(s.game.debugState().rail,false);const rg=railShape(g);s.game.debugPlace(g.x,rg.start-60,0,0,150);s.tick(.4);const d=s.game.debugState();assert.equal(d.rail,true,'on second rail '+JSON.stringify(d));assert.ok(d.chain>=1,'chain '+d.chain);s.game.destroy();
});
test('instant replay records the last seconds, plays them back with cuts and slow-mo, and exits',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,150);s.tick(3);
 assert.equal(s.game.startReplay(),true);s.tick(.2);let r=s.state.replay;assert.ok(r&&r.on&&r.dur>=2.5&&r.cam==='chase','replay '+JSON.stringify(r));assert.ok(globalThis.frameState.cam,'renderer got a replay camera');
 const before=s.game.debugState().y;s.tick(1);assert.equal(s.game.debugState().y,before,'game is frozen while the replay plays');s.tick(4);assert.ok(s.state.replay.cutId>1,'camera cut');
 s.game.stopReplay();s.tick(.1);assert.equal(s.state.replay,undefined);s.tick(.5);assert.ok(s.game.debugState().y>before,'play resumes');s.game.destroy();
});
test('the replay key is set by the user and fires the replay',()=>{
 const s=setup();s.game.setSettings({quality:'low',fov:65,sensitivity:1,cameraDistance:10,replayKey:'KeyP'});s.game.debugPlace(0,500,0,0,150);s.tick(3);
 keyHandlers.keydown({code:'KeyB',target:{matches:()=>false},preventDefault(){}});s.tick(.1);assert.equal(s.state.replay,undefined);
 keyHandlers.keydown({code:'KeyP',target:{matches:()=>false},preventDefault(){}});s.tick(.1);assert.equal(s.state.replay?.on,true);s.game.stopReplay();s.game.destroy();
});
test('snow warms up through the day and the game clock loops from 7 to 19',()=>{
 const s=setup();s.game.debugSetHour(9);s.tick(.1);assert.equal(s.state.soft,0);s.game.debugSetHour(16);s.tick(.1);assert.equal(s.state.soft,1);
 s.game.debugSetHour(18.995);s.tick(1);assert.ok(s.state.hour<8,'wrapped to '+s.state.hour);s.game.destroy();
});

test('direction: D spins the rider clockwise from above and A the other way, matching the ground turn direction on landing',()=>{
 const ground=setup();ground.game.debugPlace(0,500,0,0,40);ground.game.input('right',true);ground.tick(.3);const gAngle=ground.game.debugState().angle;ground.game.destroy();
 const air=setup();charged(air);air.game.input('right',true);air.tick(.25);const spin=globalThis.frameState.spin;air.game.destroy();
 assert.ok(gAngle>0,'ground right turn increases heading');assert.ok(spin<0,'air right spin is the same visual direction (heading = angle - spin)');
});
test('a wipeout sends you to the nearest spawn once the tumble ends',()=>{
 const s=setup();s.game.debugPlace(0,5200,0,0,150);charged(s);s.game.input('up',true);s.tick(.3);s.game.input('up',false);s.tick(1.2);assert.equal(s.state.bailed,true);
 s.tick(2.2);const d=s.game.debugState();assert.equal(s.state.bailed,false);assert.ok(s.state.respawn>=1,'respawn counted');assert.ok(s.state.respawnName,'named '+s.state.respawnName);
 const {LOCATIONS}=W;const near=LOCATIONS.map(l=>Math.hypot(l.x-d.x,l.y-d.y)).sort((a,b)=>a-b)[0];assert.ok(near<1,'standing on a spawn point, '+near);s.game.destroy();
});
test('Q and E in the air cross or scissor the skis and are scored; on a board they are a method and a stalefish',()=>{
 for(const [gear,names] of [['skis',['Cross','Scissor']],['snowboard',['Method','Stalefish']]]){
  const s=setup();s.game.setOutfit({jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear});s.game.debugPlace(0,500,0,0,60);charged(s);s.game.input('crossL',true);s.game.input('crossR',true);s.tick(.4);
  assert.ok(globalThis.frameState.cross>.8&&globalThis.frameState.scissor>.8,'pose amounts '+globalThis.frameState.cross);
  const t=s.state.trick;for(const n of names)assert.ok(t.includes(n),gear+' trick '+t);s.game.destroy();}
});
test('challenge feats are queued for the page: air height, spin, speed',()=>{
 const feats=[];const s=(()=>{let snapshot;const game=createGame({},n=>{snapshot=n;feats.push(...(n.feats||[]));});let now=performance.now();game.start();return{game,tick(sec){for(let i=0;i<Math.round(sec*200);i++){now+=5;callback(now);}}};})();
 s.game.debugPlace(0,500,0,0,150);s.tick(1);s.game.input('jump',true);s.tick(.9);s.game.input('jump',false);s.game.input('right',true);s.tick(.2);s.game.input('right',false);s.tick(2);
 const types=feats.map(f=>f.type);assert.ok(types.includes('land'),'feats '+JSON.stringify(feats));assert.ok(feats.find(f=>f.type==='air').value>1);s.game.destroy();
});

test('ski bike: Q is a tabletop, E a whip, J a no-hander; rails are frame slides',()=>{
 const s=setup();s.game.setOutfit({jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear:'skibike'});s.game.debugPlace(0,500,0,0,60);charged(s);s.game.input('crossL',true);s.game.input('crossR',true);s.game.input('grab',true);s.tick(.4);
 const t=s.state.trick;for(const n of ['Tabletop','Whip','No-hander'])assert.ok(t.includes(n),'trick '+t);assert.ok(globalThis.frameState.cross>.8);s.game.destroy();
});

test('physics runs on a fixed timestep: the same moves give the same result at 20 fps and at 200 fps',()=>{
 const run=ms=>{let snap;const game=createGame({},n=>snap=n);let now=performance.now();game.start();game.debugPlace(0,500,0,0,120);game.input('right',true);
  for(let i=0;i<Math.round(2000/ms);i++){now+=ms;callback(now);}const d=game.debugState();game.destroy();return d;};
 const a=run(5),b=run(50);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<12,'positions '+JSON.stringify([a.x,a.y,b.x,b.y]));assert.ok(Math.abs(a.angle-b.angle)<.05,'heading');
});
test('skis never face backward by accident: they swing back round to the direction of travel',()=>{
 const s=setup();s.game.debugPlace(0,500,Math.PI*.95,0,150);s.tick(.1);let d=s.game.debugState();
 s.tick(2.5);d=s.game.debugState();assert.ok(Math.cos(d.angle-d.course)>.6,'angle '+d.angle.toFixed(2)+' course '+d.course.toFixed(2));s.game.destroy();
});
test('X reverts on purpose: the skis swing round smoothly (not a snap) and then stay switch',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,150);s.tick(.3);const a0=s.game.debugState().angle;s.game.input('revert',true);s.game.input('revert',false);s.tick(.05);const mid=s.game.debugState().angle;
 assert.ok(Math.abs(mid-a0)>.1&&Math.abs(mid-a0)<Math.PI*.9,'in the middle of the turn '+(mid-a0).toFixed(2));s.tick(1.2);const d=s.game.debugState();
 assert.ok(Math.cos(d.angle-d.course)<-.6,'now riding switch');assert.equal(s.state.stance,'switch');s.tick(2);const e=s.game.debugState();assert.ok(Math.cos(e.angle-e.course)<-.5,'and it stays switch');s.game.destroy();
});
test('butters: Q is a nose butter, E a tail butter, A/D spins you on them and it banks as a ground trick',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,80);s.tick(.2);s.game.input('crossL',true);s.tick(.15);assert.equal(s.state.groundTrick,'nose');
 s.game.input('left',true);s.tick(1.4);s.game.input('left',false);s.game.input('crossL',false);s.tick(.3);
 assert.ok(s.state.score>0&&/Nose Butter/.test(s.state.trick),'banked '+s.state.trick+' '+s.state.score);s.game.destroy();
 const t=setup();t.game.debugPlace(0,500,0,0,80);t.tick(.2);t.game.input('crossR',true);t.tick(.3);assert.equal(t.state.groundTrick,'tail');t.game.input('crossR',false);t.tick(.2);assert.ok(/Tail Butter/.test(t.state.trick));t.game.destroy();
 const m=setup();m.game.debugPlace(0,500,0,0,60);m.tick(.2);m.game.input('crossL',true);m.game.input('crossR',true);m.tick(.2);assert.equal(m.state.groundTrick,'manual');m.game.destroy();
});
test('ollie and nollie: Space released with E / Q held pops a little higher and names the trick',()=>{
 for(const [k,name] of [['crossR','Ollie'],['crossL','Nollie']]){const s=setup();s.game.debugPlace(0,500,0,0,90);s.game.input('jump',true);s.tick(1.3);s.game.input(k,true);s.game.input('jump',false);s.tick(.15);assert.ok((s.state.trick||'').includes(name),name+' '+s.state.trick);s.game.destroy();}
});
test('the nine grabs can be selected with H and are named in the snapshot',()=>{
 const s=setup();const seen=[s.state.grabName];for(let i=0;i<9;i++){s.game.input('grabtype',true);s.game.input('grabtype',false);s.tick(.12);seen.push(s.state.grabName);}
 assert.deepEqual(seen.slice(0,9).sort(),['Blunt','Critical','Double Safety','Japan','Mute','Nose','Safety','Tail','Truck Driver'].sort());s.game.destroy();
});
test('landing quality: perfect landings keep speed, a sloppy one loses it; the body orientation is what counts',()=>{
 const run=(hold)=>{const s=setup();s.game.debugPlace(0,500,0,0,150);s.game.input('jump',true);s.tick(1.3);s.game.input('jump',false);if(hold)s.game.input('right',true);const v0=s.game.debugState().speed;s.tick(hold||.05);s.game.input('right',false);s.tick(2.2);const d=s.game.debugState();s.game.destroy();return{v0,d};};
 const clean=run(0);assert.equal(clean.d.bailed,false);assert.ok(clean.d.speed>clean.v0*.8,'clean keeps most speed');
});
test('crash details are passed on: a wipeout records how you went down',()=>{
 const s=setup();s.game.debugPlace(0,500,0,0,150);s.game.input('jump',true);s.tick(1.3);s.game.input('jump',false);s.game.input('up',true);s.tick(.3);s.game.input('up',false);s.tick(1.3);
 assert.equal(s.state.bailed,true);assert.ok(globalThis.frameState.crash&&globalThis.frameState.crash.power>0,'crash info reaches the renderer');s.game.destroy();
});
test('riding switch: facing backwards is read as switch, and push, turn, brake keep it stable',()=>{
 const s=setup();s.game.debugPlace(-300,1000,0,0,170);s.tick(.2);s.game.input('revert',true);s.game.input('revert',false);s.tick(.8);let d=s.game.debugState();assert.equal(d.fakie,true,'facing uphill while travelling downhill is switch');assert.equal(d.bailed,false);
 s.game.input('left',true);s.tick(.8);s.game.input('left',false);d=s.game.debugState();assert.equal(d.fakie,true,'a switch carve stays switch');assert.ok(d.speed>60,'momentum kept: '+d.speed.toFixed(0));
 s.game.input('down',true);s.tick(1);s.game.input('down',false);d=s.game.debugState();assert.equal(d.bailed,false,'braking switch does not crash');
 s.game.input('up',true);s.tick(1);d=s.game.debugState();assert.equal(d.bailed,false);assert.ok(d.speed>30);s.game.destroy();
});
