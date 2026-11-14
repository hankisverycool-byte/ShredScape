import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const {stepRun,idleRun,COURSE,MISS_PENALTY,formatTime}=await mod('app/race.ts');
// Ride straight down through each gate centre (or offset), one step per gate, 2s apart.
function ride(best,offsetFor=()=>0){let run=idleRun(),t=0;const s=COURSE.start;({run,best}=stepRun(run,best,s.x,s.y-10,s.x,s.y+1,t));
 for(const g of COURSE.gates){t+=2;const x=g.x+offsetFor(g);({run,best}=stepRun(run,best,x,g.y-10,x,g.y+1,t));}return{run,best};}
test('start gate starts the clock, gates record splits, finish sets a best',()=>{
 const {run,best}=ride(null);
 assert.equal(run.state,'finished');assert.equal(run.splits.length,COURSE.gates.length);
 assert.equal(run.total,2*COURSE.gates.length);assert.equal(run.newBest,true);assert.deepEqual(best.splits,run.splits);
});
test('missing a gate adds a penalty and shows as lost time against the best',()=>{
 const first=ride(null);
 const second=ride(first.best,g=>g.n===3?200:0);
 assert.equal(second.run.missed,1);assert.equal(second.run.total,first.run.total+MISS_PENALTY);assert.equal(second.run.newBest,false);
 assert.ok(second.run.last.delta>0);assert.equal(second.best,first.best);
});
test('skipping the start gate or riding back above it does not time a run',()=>{
 const s=COURSE.start;let {run}=stepRun(idleRun(),null,s.x+400,s.y-10,s.x+400,s.y+1,0);assert.equal(run.state,'idle');
 ({run}=stepRun(idleRun(),null,s.x,s.y-10,s.x,s.y+1,0));assert.equal(run.state,'running');
 ({run}=stepRun(run,null,s.x,s.y,s.x,s.y-300,1));assert.equal(run.state,'idle');
});
test('time format',()=>{assert.equal(formatTime(83.456),'1:23.46');assert.equal(formatTime(7.1),'0:07.10');});
