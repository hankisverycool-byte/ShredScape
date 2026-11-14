import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const W=await mod('app/world.ts'),P=await mod('app/park.ts'),R=await mod('app/race.ts');
const {BOUNDS,ZONES,TRAILS,LOCATIONS,LIFTS,START,PARK_FEATURES,MOUNTAINS,groundHeight,trailX,zoneAt,onTrail,snowAt,featuresNear,regionAt}=W;
const slope=(x,y)=>Math.hypot((groundHeight(x+4,y)-groundHeight(x-4,y))/8,(groundHeight(x,y+4)-groundHeight(x,y-4))/8);
test('one long narrow mountain with four park zones on detours',()=>{
 assert.equal(MOUNTAINS.length,1);assert.equal(MOUNTAINS[0].name,'Aspen Mountain');assert.ok(BOUNDS.maxY-BOUNDS.minY>=4*(BOUNDS.maxX-BOUNDS.minX),'long and narrow');
 assert.equal(ZONES.filter(z=>z.kind==='park').length,4);assert.ok(ZONES.some(z=>z.kind==='town'));
 for(const z of ZONES){assert.ok(z.x0>=BOUNDS.minX&&z.x1<=BOUNDS.maxX&&z.y0>=BOUNDS.minY&&z.y1<=BOUNDS.maxY,z.name+' inside the world');assert.ok(z.x1>z.x0&&z.y1>z.y0);}
 assert.equal(regionAt(700,4500),'Highlands Big Air');assert.equal(regionAt(0,12700),'Aspen Town');assert.equal(regionAt(0,500),'Aspen Mountain');
});
test('the terrain is finite everywhere, falls to the valley, and the arrival points are flat',()=>{
 for(let x=BOUNDS.minX;x<=BOUNDS.maxX;x+=370)for(let y=BOUNDS.minY;y<=BOUNDS.maxY;y+=550)assert.ok(Number.isFinite(groundHeight(x,y)));
 assert.ok(groundHeight(0,-900)-groundHeight(0,13900)>250,'total drop');
 for(const l of LOCATIONS)assert.ok(slope(l.x,l.y)<.02,l.name+' slope '+slope(l.x,l.y).toFixed(3));
 assert.ok(slope(START.x,START.y)<.02);
});
test('detours peel off the main run and rejoin it, passing through their park',()=>{
 const main=TRAILS.find(t=>t.id==='spar-gulch'),mx=y=>trailX(main,y);
 for(const [id,park] of [['buttermilk-run','butter-park'],['snowmass-run','snowmass-park'],['highlands-run','big-air'],['yard-run','rail-yard']]){const t=TRAILS.find(q=>q.id===id),z=ZONES.find(q=>q.id===park),a=t.pts[0][0],b=t.pts.at(-1)[0];
  assert.ok(Math.abs(t.pts[0][1]-mx(a))<150,id+' starts on the main run');assert.ok(Math.abs(t.pts.at(-1)[1]-mx(b))<150,id+' rejoins the main run');
  let inside=false;for(let y=a;y<=b;y+=100){const x=trailX(t,y);if(x>z.x0&&x<z.x1&&y>z.y0&&y<z.y1)inside=true;}assert.ok(inside,id+' passes through '+park);}
});
test('every trail has sensible length and slope and stays in the world',()=>{
 for(const t of TRAILS){const a=t.pts[0][0],b=t.pts.at(-1)[0];assert.ok(b-a>=1000,t.name+' length');
  for(let y=a;y<=b;y+=100){const x=trailX(t,y);assert.ok(Number.isFinite(x)&&x>BOUNDS.minX&&x<BOUNDS.maxX,t.name+' x at '+y);assert.ok(slope(x,y)<.3,t.name+' too steep at '+y);}
  for(let y=a;y<=b;y+=100)assert.ok(Math.abs(trailX(t,y))<=1000,t.name+' stays off the walls');
  assert.equal(trailX(t,a-1),null);assert.equal(trailX(t,b+1),null);}
});
test('snow: trails and parks are groomed, off-piste is powder',()=>{
 assert.equal(snowAt(0,5000),'groomed');assert.equal(snowAt(1400,4000),'powder');assert.equal(onTrail(-1025,5000),true);assert.equal(onTrail(0,12700),true);
});
test('every park feature is inside its own zone, and kickers have room to land',()=>{
 const zoneOf={butter:'butter-park',snow:'snowmass-park',air:'big-air',yard:'rail-yard',core:'aspen-town'};
 for(const f of PARK_FEATURES){const z=ZONES.find(z=>z.id===zoneOf[f.id.split(':')[0]]);assert.ok(f.x>=z.x0&&f.x<=z.x1&&f.y>=z.y0&&f.y<=z.y1,f.id+' outside '+z.name);}
 const ks=PARK_FEATURES.filter(f=>f.kind==='ramp');
 for(const a of ks)for(const b of ks){if(a===b||Math.abs(a.x-b.x)>P.kickerClass(a).half+P.kickerClass(b).half)continue;
  const sa=P.kickerShape(a),sb=P.kickerShape(b);if(sb.start<sa.start)continue;assert.ok(sb.start>=sa.lip||sb.lip<sa.start,`${a.id} and ${b.id} overlap`);}
 // a kicker has at least its landing zone before the next one on the same line (the landing is what makes the size safe)
 const line=id=>ks.filter(f=>f.id.startsWith(id)).sort((p,q)=>p.y-q.y);
 for(const id of ['butter:k-1200','butter:k-850','snow:k-1200','snow:k-750','air:k500','air:k870']){const l=line(id);for(let i=1;i<l.length;i++)assert.ok(P.kickerShape(l[i]).start-P.kickerShape(l[i-1]).lip>=P.kickerClass(l[i-1]).landing-1,`${l[i-1].id} -> ${l[i].id}`);}
});
test('the Big Air park holds every size, mini to gigantic; the learning park stays small',()=>{
 const sizes=id=>new Set(PARK_FEATURES.filter(f=>f.kind==='ramp'&&f.id.startsWith(id)).map(f=>f.size));
 assert.deepEqual([...sizes('air')].sort(),[0,1,2,3,4,5]);assert.ok(Math.max(...sizes('butter'))<=3);assert.ok(Math.max(...sizes('yard'))<=1);
 assert.ok(PARK_FEATURES.filter(f=>f.kind==='rail').length>=25);
});
test('trees stay off trails, parks and lodges; the bowl above the treeline is bare',()=>{
 for(const [x,y] of [[0,5000],[0,1500],[-1025,5200],[0,12700],[700,800]]){for(const f of featuresNear(x,y))if(f.kind==='tree'||f.kind==='rock')assert.equal(onTrail(f.x,f.y),false,'obstacle on trail at '+Math.round(f.x)+','+Math.round(f.y));}
 assert.equal(featuresNear(700,800).filter(f=>f.kind==='tree'&&Math.hypot(f.x-700,f.y-800)<500).length,0);
 assert.ok(featuresNear(300,7000).filter(f=>f.kind==='tree').length>10);
});
test('features lookup is fast enough to run every half second',()=>{const t=performance.now();for(let i=0;i<30;i++)featuresNear(-1000+i*60,4000+i*150);assert.ok((performance.now()-t)/30<5);});
test('lifts run uphill, and the timed course follows Spar Gulch from top to bottom',()=>{
 for(const L of LIFTS){assert.ok(L.y0>L.y1);assert.ok(groundHeight(L.x1,L.y1)>groundHeight(L.x0,L.y0)+100,L.name);}
 const c=R.COURSE;assert.equal(c.name,'Spar Gulch GS');assert.equal(c.gates.length,9);assert.ok(c.gates.at(-1).y-c.start.y>5000);
 for(const g of [c.start,...c.gates])assert.ok(Math.abs(g.x-trailX(TRAILS.find(t=>t.id==='spar-gulch'),g.y))<g.w);
});
