import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const transpile=path=>ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const source=transpile('app/game-engine.ts').replace("'./renderer3d'",JSON.stringify(url('export function createMountain3D(){return{draw(f){globalThis.frameState=f},destroy(){}}}'))).replace("'./world'",JSON.stringify(url(transpile('app/world.ts')))).replace("'./tricks'",JSON.stringify(url(transpile('app/tricks.ts')))).replace("'./ski-physics'",JSON.stringify(url(transpile('app/ski-physics.ts'))));
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
