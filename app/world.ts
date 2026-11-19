import {KICKER_CLASSES,KICKER} from './park';
// The world: one straight run. A wide groomed course drops from the summit to the town in a nearly straight line, and the sections (the summit chute,
// Buttermilk Park, Highlands Big Air, Snowmass Park, the Ajax Rail Yard and the town) follow each other back to back. Padded barriers line both sides
// with the crowd standing behind them. Aspen-inspired, not a survey. Units are engine units; 1 unit = SCALE world units.
export const SCALE=.05;
export const BARRIER_X=640; // the barriers: the course is 1280 wide
export const BOUNDS={minX:-BARRIER_X,maxX:BARRIER_X,minY:-1000,maxY:17700};
export const WORLD_X=1500; // terrain, crowd and forest extend this far either side
export const SECTIONS=[{id:'chute',name:'Summit Chute',y0:-400,y1:2500},{id:'butter-park',name:'Buttermilk Park',y0:2800,y1:5600},{id:'big-air',name:'Highlands Big Air',y0:5900,y1:10700},{id:'snowmass-park',name:'Snowmass Park',y0:10900,y1:14100},{id:'rail-yard',name:'Ajax Rail Yard',y0:14300,y1:16100},{id:'aspen-town',name:'Aspen Town',y0:16300,y1:17700}];
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

// ---------- zones ----------
export type Zone={id:string;name:string;kind:'park'|'bowl'|'town'|'lake';x0:number;y0:number;x1:number;y1:number;color:string;desc:string};
export const ZONES:Zone[]=[
 {id:'chute',name:'Summit Chute',kind:'bowl',x0:-BARRIER_X,y0:-400,x1:BARRIER_X,y1:2500,color:'#d5e5df',desc:'The steep top section and the timed GS course. Open and fast.'},
 {id:'butter-park',name:'Buttermilk Park',kind:'park',x0:-BARRIER_X,y0:2800,x1:BARRIER_X,y1:5600,color:'#7cc97a',desc:'The learning park: minis and smalls, boxes and rails, and a large to graduate on.'},
 {id:'big-air',name:'Highlands Big Air',kind:'park',x0:-BARRIER_X,y0:5900,x1:BARRIER_X,y1:10700,color:'#8a4bd1',desc:'Two big-air lines from mini to GIGANTIC. Bring speed.'},
 {id:'snowmass-park',name:'Snowmass Park',kind:'park',x0:-BARRIER_X,y0:10900,x1:BARRIER_X,y1:14100,color:'#e6c24a',desc:'Mediums and larges, a long rail garden, and a huge at the end of the right line.'},
 {id:'rail-yard',name:'Ajax Rail Yard',kind:'park',x0:-BARRIER_X,y0:14300,x1:BARRIER_X,y1:16100,color:'#5fb8d9',desc:'Rails and boxes, with a few mini kickers.'},
 {id:'aspen-town',name:'Aspen Town',kind:'town',x0:-BARRIER_X,y0:16300,x1:BARRIER_X,y1:17700,color:'#ed9a6c',desc:'The base village, the gondola and the Core Rail Jam in the plaza.'},
];
const rectDist=(z:Zone,x:number,y:number)=>Math.hypot(Math.max(z.x0-x,0,x-z.x1),Math.max(z.y0-y,0,y-z.y1));
const PARKS=ZONES.filter(z=>z.kind==='park');
// Smallest zone containing the point (a park inside a mountain wins over the mountain).
export function zoneAt(x:number,y:number){let best:Zone|null=null,ba=1e18;for(const z of ZONES){if(x<z.x0||x>z.x1||y<z.y0||y>z.y1)continue;const a=(z.x1-z.x0)*(z.y1-z.y0);if(a<ba){ba=a;best=z;}}return best;}

// ---------- mountains ----------
export const MOUNTAINS=[
 {id:'aspen',name:'Aspen Mountain',x:0,x0:-1500,x1:1500,color:'#d5e5df'},
];
export const mountainAt=(x:number)=>MOUNTAINS.find(m=>x<m.x1)||MOUNTAINS[MOUNTAINS.length-1];
// ---------- terrain ----------
const L0=-1000,L1=17700,DROP=430;
// Fall line: steep for the top two thirds, easing to a gentle valley floor (Hermite curve, slope 1.3 -> .12).
const fallCurve=(t:number)=>1.3*(t*t*t-2*t*t+t)+(-2*t*t*t+3*t*t)+.12*(t*t*t-t*t);
const RIDGES:{x:number;h:number;s:number}[]=[];
const PEAKS=[{x:0,y:-300,h:30,sx:600,sy:800},{x:-1200,y:0,h:16,sx:500,sy:700},{x:1200,y:100,h:16,sx:500,sy:700}];
function parkInfluence(x:number,y:number){let m=0;for(const z of PARKS)m=Math.max(m,1-smooth(0,260,rectDist(z,x,y)));return m;}
function raw(x:number,y:number){
 const t=(clamp(y,L0,L1)-L0)/(L1-L0);
 let h=-DROP*fallCurve(t);
 const fade=1-smooth(.5,.82,t);
 for(const r of RIDGES)h+=fade*r.h*Math.exp(-((x-r.x)**2)/(2*r.s*r.s)); // ridges between the mountains, fading out into the valley
 for(const p of PEAKS)h+=p.h*Math.exp(-((x-p.x)**2/(2*p.sx*p.sx)+(y-p.y)**2/(2*p.sy*p.sy)));
 const calm=(1-.85*parkInfluence(x,y))*(1-smooth(.8,.9,t)); // rolling relief, quiet in parks and flat in the valley
 h+=calm*(1.5*Math.sin(x*.0014+y*.0008)+.5*Math.sin(x*.003-y*.0016+1.3));
 return h+Math.min(12,Math.max(0,Math.abs(x)-BARRIER_X-20)*.09); // low stands behind the barriers, then open flat ground out to the distant mountains
}
// ---------- places ----------
export type Location={id:string;name:string;x:number;y:number;color:string;kind:'summit'|'park'|'town'|'lake'|'bowl';description:string};
export const LOCATIONS:Location[]=[
 {id:'ajax',name:'Summit',x:0,y:350,color:'#d5e5df',kind:'summit',description:'Top of the Silver Queen Gondola. Steep, fast, and the start of the run.'},
 {id:'butter-park',name:'Buttermilk Park',x:0,y:2880,color:'#7cc97a',kind:'park',description:'Section 2. Minis and smalls to learn on, a rail line, and a large at the end.'},
 {id:'big-air',name:'Highlands Big Air',x:0,y:6000,color:'#8a4bd1',kind:'park',description:'Section 3. Mini to GIGANTIC, two lines, built for speed.'},
 {id:'snowmass-park',name:'Snowmass Park',x:0,y:11000,color:'#e6c24a',kind:'park',description:'Section 4. Mediums and larges, and the long rail garden.'},
 {id:'rail-yard',name:'Ajax Rail Yard',x:0,y:14400,color:'#5fb8d9',kind:'park',description:'Section 5. Rails, boxes and mini kickers.'},
 {id:'town',name:'Aspen Town',x:0,y:16450,color:'#ed9a6c',kind:'town',description:'The finish: gondola base, plaza, and the Core Rail Jam.'},
];
export const START={x:0,y:350};
// Flat pads so every arrival point is a place you can stand still.
const FLATS:{x:number;y:number;r:number;drop:number;h:number}[]=[...LOCATIONS.map(l=>({x:l.x,y:l.y,r:l.kind==='park'?110:150,drop:0,h:0}))];
for(const f of FLATS)f.h=raw(f.x,f.y)+f.drop;
export function groundHeight(x:number,y:number){
 let h=raw(x,y);
 for(const f of FLATS){const d=Math.hypot(x-f.x,y-f.y);if(d<f.r+220){const m=1-smooth(f.r*.55,f.r+220,d);h+=(f.h-h)*m;}}
 return h;
}
export function regionAt(x:number,y:number){const z=zoneAt(x,y);return z?z.name:mountainAt(x).name;}

// ---------- trails ----------
// A trail is a centre line x(y) through [y,x] knots. Groomed snow lies within w/2 of it.
export type Trail={id:string;name:string;level:'green'|'blue'|'black';w:number;pts:[number,number][]};
export const TRAILS:Trail[]=[
 // One wide groomed run, almost dead straight, wall to wall between the barriers.
 {id:'spar-gulch',name:'Main Run',level:'blue',w:1300,pts:[[-100,0],[1500,30],[3000,-25],[5000,25],[7000,-30],[9000,25],[11000,-25],[13000,20],[15000,-20],[17000,0],[17800,0]]},
];
export const trailById=(id:string)=>TRAILS.find(t=>t.id===id)!;
// Catmull-Rom through the knots. null outside the trail's length.
export function trailX(tr:Trail,y:number):number|null{
 const p=tr.pts,n=p.length;if(y<p[0][0]||y>p[n-1][0])return null;
 let i=0;while(i<n-2&&y>p[i+1][0])i++;
 const p0=p[Math.max(0,i-1)][1],p1=p[i][1],p2=p[i+1][1],p3=p[Math.min(n-1,i+2)][1],u=(y-p[i][0])/(p[i+1][0]-p[i][0]);
 return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);
}
const VALLEY_Y=16300;
// Groomed: on a trail, inside a park or the town, or on the valley floor that links the bases.
export function onTrail(x:number,y:number){
 if(y>VALLEY_Y)return true;
 const z=zoneAt(x,y);if(z&&(z.kind==='park'||z.kind==='town'))return true;
 for(const tr of TRAILS){const c=trailX(tr,y);if(c!==null&&Math.abs(x-c)<tr.w/2)return true;}
 return false;
}
// Pisted terrain is groomed, everything else is powder.
export function snowAt(x:number,y:number):'groomed'|'powder'|'ice'{return onTrail(x,y)?'groomed':'powder';}

// ---------- landmarks and lifts ----------
export type Landmark={kind:'village'|'lodge'|'parkgate'|'lake';x:number;y:number;name:string;count?:number;r?:number};
export const LANDMARKS:Landmark[]=[
 {kind:'village',x:0,y:17420,name:'ASPEN',count:12},{kind:'village',x:-1050,y:16700,name:'SNOWMASS VILLAGE',count:6},{kind:'village',x:1050,y:16700,name:'HIGHLANDS BASE',count:3},
 {kind:'lodge',x:850,y:430,name:'SUNDECK'},{kind:'lodge',x:-850,y:1500,name:'ELK CAMP'},
 ...PARKS.map(z=>({kind:'parkgate' as const,x:(z.x0+z.x1)/2,y:z.y0+30,name:z.name.toUpperCase(),r:(z.x1-z.x0)/2})),
];
export type Lift={id:string;name:string;x0:number;y0:number;x1:number;y1:number};
export const LIFTS:Lift[]=[ // bottom -> top, outside the crowd on either side
 {id:'silver-queen',name:'Silver Queen Gondola',x0:1000,y0:16900,x1:1000,y1:520},
 {id:'loge-peak',name:'Loge Peak Express',x0:-1000,y0:16800,x1:-1000,y1:700},
];

// ---------- trees, rocks and park features ----------
export type Feature={kind:'tree'|'rock'|'ramp'|'rail'|'flag'|'gate'|'start'|'finish';x:number;y:number;size:number;seed:number;id:string};
// Forest density 0..1: none above the treeline and in the bowls, thickest low down, in patches, thin in the Big Burn glades.
export function forestAt(x:number,y:number){
 if(Math.abs(x)<BARRIER_X+170)return 0; // the course and the crowd stands are clear
 const alt=smooth(1500,2600,y),n=.5+.5*Math.sin(x*.0017+y*.0009)*Math.sin(x*.0011-y*.0014+2);
 return Math.min(1,alt*(.7+.5*n)*(1-smooth(16400,16900,y)));
}
const nearLandmark=(x:number,y:number)=>LANDMARKS.some(l=>(l.kind==='village'||l.kind==='lodge')&&Math.hypot(x-l.x,y-l.y)<(l.kind==='village'?380:130));
export const PARK_FEATURES:Feature[]=[];
function kickerLine(park:string,x:number,y0:number,classes:number[]){let y=y0;classes.forEach((c,i)=>{const k=KICKER_CLASSES[c];PARK_FEATURES.push({kind:'ramp',x,y:y+k.run-KICKER.lipAt,size:c,seed:c,id:`${park}:k${x}:${i}`});y+=k.run+k.landing;});}
// items: [size, isBox]. A box is lower and wider; a rail is longer and thinner.
function railLine(park:string,x:number,y0:number,items:[number,boolean][],gap:number){let y=y0;items.forEach(([size,box],i)=>{const len=(box?140:170)*size;PARK_FEATURES.push({kind:'rail',x,y:y+len/2,size,seed:i*2+(box?1:0),id:`${park}:r${x}:${i}`});y+=len+gap;});}
// Buttermilk Park: a gentle progression. Left: minis -> smalls -> medium. Middle: boxes then rails. Right: small -> mediums -> large.
kickerLine('butter',-380,2950,[0,0,1,1,2]);kickerLine('butter',160,3000,[1,2,2,3]);
railLine('butter',-100,3100,[[.6,true],[.8,true],[1,false],[1.1,true],[1.4,false],[1.4,true],[1.8,false],[1.2,true]],110);
// Highlands Big Air: every size from MINI to GIGANTIC on two lines, with the long run-outs they need.
kickerLine('air',-190,6100,[0,3,4,5]);kickerLine('air',270,6150,[1,4,5,2]);
// Snowmass Park: bigger. Left: small -> medium -> large -> medium. Middle: rail garden. Right: medium -> large -> huge.
kickerLine('snow',-330,11100,[1,2,3,2]);kickerLine('snow',200,11150,[2,3,4]);
railLine('snow',-60,11250,[[1.2,false],[1,true],[1.6,false],[1.4,true],[2,false],[1,true],[1.8,false]],120);
// Ajax Rail Yard: rails and boxes, plus four minis/smalls on the right.
railLine('yard',0,14400,[[1,true],[1.3,false],[1,true],[1.7,false],[1.2,true],[1.5,false]],60);
railLine('yard',-220,14500,[[.8,false],[1.4,true],[1,false],[1.6,false]],90);kickerLine('yard',250,14500,[0,0,1,1]);
// Aspen Core Rail Jam: the plaza.
railLine('core',0,16600,[[1,true],[1.3,false],[1,true]],80);railLine('core',-180,16630,[[.8,false],[1.2,true],[1,false]],80);railLine('core',180,16630,[[1,true],[.8,false],[1.2,true]],80);

export function featuresNear(x:number,y:number){
 const out:Feature[]=[];
 const c0=Math.floor((x-1500)/160),c1=Math.ceil((x+1500)/160),r0=Math.floor((y-1300)/160),r1=Math.ceil((y+1700)/160);
 for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
  const seed=row*577+col*79,px=col*160+(hash(seed)-.5)*110,py=row*160+hash(seed+2)*110;
  if(Math.abs(px-x)>1500||px<-WORLD_X||px>WORLD_X||py<BOUNDS.minY||py>BOUNDS.maxY)continue;
  if(onTrail(px,py)||nearLandmark(px,py))continue;
  const f=forestAt(px,py);
  if(hash(seed+3)<f)out.push({kind:'tree',x:px,y:py,size:.8+hash(seed+8)*.6,seed,id:'n'+row+':'+col});
  else if(f<.12&&Math.abs(px)>BARRIER_X+170&&hash(seed+5)<.07)out.push({kind:'rock',x:px,y:py,size:1.1+hash(seed+8)*1.3,seed,id:'n'+row+':'+col});
 }
 for(const f of PARK_FEATURES)if(Math.abs(f.x-x)<=1500&&f.y>=y-1700&&f.y<=y+2100)out.push(f);
 return out;
}
