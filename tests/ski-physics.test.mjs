import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const src=ts.transpile(fs.readFileSync('app/ski-physics.ts','utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {stepSki}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
// Slope falls toward +y (like the mountain). gradY<0 means height drops as y grows.
const base={steer:0,push:false,brake:false,boost:false,sensitivity:1,gradX:0,gradY:-.02,snow:'groomed',rand:()=>.5};
function run(state,input,seconds){let s={...state,speed:0};for(let i=0;i<seconds*100;i++)s=stepSki(s,input,.01);return s;}
test('pointing downhill gains more speed than traversing',()=>{
 const down=run({vx:0,vy:20,angle:0},base,2),across=run({vx:20,vy:0,angle:Math.PI/2},base,2);
 assert.ok(down.speed>across.speed+40);
});
test('a gentle carve keeps speed, a skid scrapes it away',()=>{
 const flat={...base,gradY:0};
 const carve=stepSki({vx:0,vy:150,angle:.08},flat,.05),skid=stepSki({vx:0,vy:150,angle:1.1},flat,.05);
 assert.ok(carve.carve>.9&&carve.skid<.1);assert.ok(skid.skid>.5);
 assert.ok(carve.speed>skid.speed+5);
});
test('the same turn input drifts wider at high speed',()=>{
 const flat={...base,gradY:0,steer:1};
 const slow=run({vx:0,vy:80,angle:0},flat,.6),fast=run({vx:0,vy:300,angle:0},flat,.6);
 assert.ok(fast.slip>slow.slip);
});
test('hockey stop turns the skis across travel and stops quickly',()=>{
 const s=run({vx:0,vy:200,angle:0},{...base,gradY:0,brake:true},1.2);
 assert.ok(s.speed<20);
});
test('ice grips less than groomed snow',()=>{
 const g=stepSki({vx:0,vy:150,angle:.4},{...base,gradY:0},.1),i=stepSki({vx:0,vy:150,angle:.4},{...base,gradY:0,snow:'ice'},.1);
 assert.ok(Math.abs(i.angle-i.course)>Math.abs(g.angle-g.course));
});
test('switch: skiing backwards downhill speeds up and carves like regular',()=>{
 const sw=run({vx:0,vy:20,angle:Math.PI},base,2),reg=run({vx:0,vy:20,angle:0},base,2);
 assert.ok(Math.abs(sw.speed-reg.speed)<1);assert.equal(sw.fakie,true);
 const carve=stepSki({vx:0,vy:150,angle:Math.PI+.08},{...base,gradY:0},.05);
 assert.ok(carve.carve>.9&&carve.speed>147);
});
test('switch: hockey stop works backwards too',()=>{
 const s=run({vx:0,vy:200,angle:Math.PI},{...base,gradY:0,brake:true},1.2);
 assert.ok(s.speed<20);
});
test('regular to switch pivot keeps momentum, no instant 180',()=>{
 const flat={...base,gradY:0,steer:1,pivot:true};let s={vx:0,vy:150,angle:0},maxStep=0,prev=0;
 for(let i=0;i<200&&!(s.fakie&&Math.cos(s.angle-Math.atan2(s.vx,s.vy))<-.95);i++){s=stepSki(s,flat,.01);maxStep=Math.max(maxStep,Math.abs(s.angle-prev));prev=s.angle;}
 assert.equal(s.fakie,true);assert.ok(maxStep<.06);assert.ok(s.speed>60,'kept '+s.speed.toFixed(0));
});

test('warm soft snow is draggier than firm snow, but ice does not change',()=>{
 const roll=(snow,soft)=>{let st={vx:0,vy:150,angle:0};for(let i=0;i<200;i++)st=stepSki(st,{steer:0,push:false,brake:false,boost:false,sensitivity:1,gradX:0,gradY:0,snow,soft},.01);return Math.hypot(st.vx,st.vy);};
 assert.ok(roll('groomed',1)<roll('groomed',0)-3,'soft '+roll('groomed',1)+' firm '+roll('groomed',0));assert.ok(roll('powder',1)<roll('powder',0));assert.equal(roll('ice',1),roll('ice',0));
});
