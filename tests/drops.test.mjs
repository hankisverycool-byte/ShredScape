import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const D=await mod('app/drops.ts');
const {DROPS,HELMETS,CHALLENGES,dropAt,applyFeat,freshDrop,countdown,helmetById}=D;
test('every drop has a helmet and three real challenges, and drops rotate weekly',()=>{
 assert.equal(HELMETS.length,DROPS.length);
 for(const d of DROPS){assert.ok(helmetById(d.helmet));assert.equal(d.challenges.length,3);for(const c of d.challenges)assert.ok(CHALLENGES[c],c);}
 const t=Date.UTC(2026,10,14,12),a=dropAt(t),b=dropAt(t+7*864e5);assert.notEqual(a.drop.helmet,b.drop.helmet);assert.ok(a.start<=t&&t<a.end&&a.end-a.start===7*864e5);
 assert.equal(dropAt(t+28*864e5).drop.helmet,a.drop.helmet,'cycle repeats');
});
test('feats complete challenges: max, count and min modes',()=>{
 const drop=DROPS[0];let st=freshDrop(1);
 let r=applyFeat(st,drop,{type:'air',value:5});assert.deepEqual(r.newly,[]);st=r.state;assert.equal(st.values.air8,5);
 r=applyFeat(st,drop,{type:'air',value:9});assert.deepEqual(r.newly,['air8']);st=r.state;
 r=applyFeat(st,drop,{type:'air',value:20});assert.deepEqual(r.newly,[],'already done');
 r=applyFeat(st,drop,{type:'spin',value:720});assert.deepEqual(r.newly,['spin540']);
 const cnt=DROPS[3];let s2=freshDrop(1),done=[];for(let i=0;i<10;i++){const q=applyFeat(s2,cnt,{type:'land',value:1});s2=q.state;done.push(...q.newly);}assert.deepEqual(done,['land10']);
 const race=DROPS[1];let q=applyFeat(freshDrop(1),race,{type:'race',value:30});assert.deepEqual(q.newly,[]);q=applyFeat(q.state,race,{type:'race',value:24.5});assert.deepEqual(q.newly,['race26']);
});
test('countdown formats days, hours and minutes',()=>{assert.equal(countdown(3*864e5+4*36e5),'3d 4h');assert.equal(countdown(5*36e5+7*6e4),'5h 7m');assert.equal(countdown(9*6e4),'9m');});
