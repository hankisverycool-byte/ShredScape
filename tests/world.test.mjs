import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const W=await mod('app/world.ts'),P=await mod('app/park.ts'),R=await mod('app/race.ts');
const {BOUNDS,ZONES,TRAILS,LOCATIONS,LIFTS,START,PARK_FEATURES,MOUNTAINS,groundHeight,trailX,zoneAt,onTrail,snowAt,featuresNear,regionAt}=W;
const slope=(x,y)=>Math.hypot((groundHeight(x+4,y)-groundHeight(x-4,y))/8,(groundHeight(x,y+4)-groundHeight(x,y-4))/8);
test('four mountains and five park zones',()=>{
 assert.equal(MOUNTAINS.length,4);assert.deepEqual(MOUNTAINS.map(m=>m.name),['Snowmass','Buttermilk','Aspen Highlands','Aspen Mountain']);
 assert.equal(ZONES.filter(z=>z.kind==='park').length,4);assert.ok(ZONES.some(z=>z.kind==='town'));
 for(const z of ZONES){assert.ok(z.x0>=BOUNDS.minX&&z.x1<=BOUNDS.maxX&&z.y0>=BOUNDS.minY&&z.y1<=BOUNDS.maxY,z.name+' inside the world');assert.ok(z.x1>z.x0&&z.y1>z.y0);}
 assert.equal(regionAt(525,3800),'Highlands Big Air');assert.equal(regionAt(1750,9300),'Aspen Town');assert.equal(regionAt(2550,500),'Aspen Mountain');
});
test('the terrain is finite everywhere, falls to the valley, and the arrival points are flat',()=>{
 for(let x=BOUNDS.minX;x<=BOUNDS.maxX;x+=370)for(let y=BOUNDS.minY;y<=BOUNDS.maxY;y+=550)assert.ok(Number.isFinite(groundHeight(x,y)));
 assert.ok(groundHeight(2550,-900)-groundHeight(2550,9900)>250,'total drop');
 for(const l of LOCATIONS)assert.ok(slope(l.x,l.y)<.02,l.name+' slope '+slope(l.x,l.y).toFixed(3));
 assert.ok(slope(START.x,START.y)<.02);
});
test('every trail has sensible length and slope and stays in the world',()=>{
 for(const t of TRAILS){const a=t.pts[0][0],b=t.pts.at(-1)[0];assert.ok(b-a>=1000,t.name+' length');
  for(let y=a;y<=b;y+=100){const x=trailX(t,y);assert.ok(Number.isFinite(x)&&x>BOUNDS.minX&&x<BOUNDS.maxX,t.name+' x at '+y);assert.ok(slope(x,y)<.3,t.name+' too steep at '+y);}
  assert.equal(trailX(t,a-1),null);assert.equal(trailX(t,b+1),null);}
});
test('snow: trails and parks are groomed, off-piste is powder',()=>{
 assert.equal(snowAt(2300,5200),'groomed');assert.equal(snowAt(3500,4000),'powder');assert.equal(onTrail(-1275,5000),true);assert.equal(onTrail(1750,9300),true);
});
test('every park feature is inside its own zone, and kickers have room to land',()=>{
 const zoneOf={butter:'butter-park',snow:'snowmass-park',air:'big-air',yard:'rail-yard',core:'aspen-town'};
 for(const f of PARK_FEATURES){const z=ZONES.find(z=>z.id===zoneOf[f.id.split(':')[0]]);assert.ok(f.x>=z.x0&&f.x<=z.x1&&f.y>=z.y0&&f.y<=z.y1,f.id+' outside '+z.name);}
 const ks=PARK_FEATURES.filter(f=>f.kind==='ramp');
 for(const a of ks)for(const b of ks){if(a===b||Math.abs(a.x-b.x)>P.kickerClass(a).half+P.kickerClass(b).half)continue;
  const sa=P.kickerShape(a),sb=P.kickerShape(b);if(sb.start<sa.start)continue;assert.ok(sb.start>=sa.lip||sb.lip<sa.start,`${a.id} and ${b.id} overlap`);}
 // a kicker has at least its landing zone before the next one on the same line (the landing is what makes the size safe)
 const line=id=>ks.filter(f=>f.id.startsWith(id)).sort((p,q)=>p.y-q.y);
 for(const id of ['butter:k-1450','butter:k-1100','snow:k-3050','snow:k-2700','air:k330','air:k700']){const l=line(id);for(let i=1;i<l.length;i++)assert.ok(P.kickerShape(l[i]).start-P.kickerShape(l[i-1]).lip>=P.kickerClass(l[i-1]).landing-1,`${l[i-1].id} -> ${l[i].id}`);}
});
test('the Big Air park holds every size, mini to gigantic; the learning park stays small',()=>{
 const sizes=id=>new Set(PARK_FEATURES.filter(f=>f.kind==='ramp'&&f.id.startsWith(id)).map(f=>f.size));
 assert.deepEqual([...sizes('air')].sort(),[0,1,2,3,4,5]);assert.ok(Math.max(...sizes('butter'))<=3);assert.ok(Math.max(...sizes('yard'))<=1);
 assert.ok(PARK_FEATURES.filter(f=>f.kind==='rail').length>=25);
});
test('trees stay off trails, parks and lodges; the bowl above the treeline is bare',()=>{
 for(const [x,y] of [[2300,5000],[2550,1500],[-1275,5200],[1750,9300],[480,800]]){for(const f of featuresNear(x,y))if(f.kind==='tree'||f.kind==='rock')assert.equal(onTrail(f.x,f.y),false,'obstacle on trail at '+Math.round(f.x)+','+Math.round(f.y));}
 assert.equal(featuresNear(480,800).filter(f=>f.kind==='tree'&&Math.hypot(f.x-480,f.y-800)<500).length,0);
 assert.ok(featuresNear(2800,6000).filter(f=>f.kind==='tree').length>10);
});
test('features lookup is fast enough to run every half second',()=>{const t=performance.now();for(let i=0;i<30;i++)featuresNear(-1300+i*90,4000+i*150);assert.ok((performance.now()-t)/30<5);});
test('lifts run uphill, and the timed course follows Spar Gulch from top to bottom',()=>{
 for(const L of LIFTS){assert.ok(L.y0>L.y1);assert.ok(groundHeight(L.x1,L.y1)>groundHeight(L.x0,L.y0)+100,L.name);}
 const c=R.COURSE;assert.equal(c.name,'Spar Gulch GS');assert.equal(c.gates.length,9);assert.ok(c.gates.at(-1).y-c.start.y>5000);
 for(const g of [c.start,...c.gates])assert.ok(Math.abs(g.x-trailX(TRAILS.find(t=>t.id==='spar-gulch'),g.y))<g.w);
});
