import {KICKER_CLASSES,KICKER} from './park';
// The world: a stylised remake of the Aspen valley. Four mountains side by side (Snowmass, Buttermilk, Aspen Highlands, Aspen Mountain)
// all fall toward +y into the valley floor, where the town and the base villages sit. It is Aspen-inspired, not a survey: places and
// trail names are real, distances and layout are squeezed to fit a game. Units are engine units; 1 unit = SCALE world units.
export const SCALE=.05;
export const BOUNDS={minX:-3700,maxX:3700,minY:-1000,maxY:10000};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

// ---------- zones ----------
export type Zone={id:string;name:string;kind:'park'|'bowl'|'town'|'lake';x0:number;y0:number;x1:number;y1:number;color:string;desc:string};
export const ZONES:Zone[]=[
 {id:'butter-park',name:'Buttermilk Park',kind:'park',x0:-1550,y0:4200,x1:-1000,y1:7000,color:'#7cc97a',desc:'The learning park: minis and smalls, boxes and rails, and a large to graduate on.'},
 {id:'snowmass-park',name:'Snowmass Park',kind:'park',x0:-3150,y0:5400,x1:-2600,y1:8300,color:'#e6c24a',desc:'Mediums and larges, a long rail garden, and a huge at the end of the right line.'},
 {id:'big-air',name:'Highlands Big Air',kind:'park',x0:150,y0:3700,x1:900,y1:8600,color:'#8a4bd1',desc:'Two big-air lines: mini to GIGANTIC. Bring speed.'},
 {id:'rail-yard',name:'Ajax Rail Yard',kind:'park',x0:2300,y0:7000,x1:2850,y1:8800,color:'#5fb8d9',desc:'Rails and boxes at the foot of Ruthie\'s Run, with a few mini kickers.'},
 {id:'aspen-town',name:'Aspen Town',kind:'town',x0:1350,y0:9000,x1:2150,y1:9900,color:'#ed9a6c',desc:'The base village, the gondola and the Core Rail Jam in the plaza.'},
 {id:'highland-bowl',name:'Highland Bowl',kind:'bowl',x0:150,y0:-400,x1:850,y1:1800,color:'#d5e5df',desc:'Steep, wide-open alpine bowl above the trees. Ungroomed.'},
 {id:'big-burn',name:'The Big Burn',kind:'bowl',x0:-3500,y0:1000,x1:-2350,y1:4600,color:'#a5bb87',desc:'Huge open slopes with scattered glades.'},
 {id:'maroon-lake',name:'Maroon Lake',kind:'lake',x0:740,y0:2240,x1:1260,y1:2760,color:'#84bdcf',desc:'A frozen lake. Edges barely grip.'},
];
export const LAKE={x:1000,y:2500,r:260};
const rectDist=(z:Zone,x:number,y:number)=>Math.hypot(Math.max(z.x0-x,0,x-z.x1),Math.max(z.y0-y,0,y-z.y1));
const PARKS=ZONES.filter(z=>z.kind==='park');
// Smallest zone containing the point (a park inside a mountain wins over the mountain).
export function zoneAt(x:number,y:number){let best:Zone|null=null,ba=1e18;for(const z of ZONES){if(x<z.x0||x>z.x1||y<z.y0||y>z.y1)continue;const a=(z.x1-z.x0)*(z.y1-z.y0);if(a<ba){ba=a;best=z;}}return best;}

// ---------- mountains ----------
export const MOUNTAINS=[
 {id:'snowmass',name:'Snowmass',x:-2850,x0:-3700,x1:-2050,color:'#a5bb87'},
 {id:'buttermilk',name:'Buttermilk',x:-1300,x0:-2050,x1:-420,color:'#e6c88b'},
 {id:'highlands',name:'Aspen Highlands',x:450,x0:-420,x1:1650,color:'#84bdcf'},
 {id:'aspen',name:'Aspen Mountain',x:2550,x0:1650,x1:3700,color:'#d5e5df'},
];
export const mountainAt=(x:number)=>MOUNTAINS.find(m=>x<m.x1)||MOUNTAINS[MOUNTAINS.length-1];
// ---------- terrain ----------
const L0=-1000,L1=10000,DROP=260;
// Fall line: steep for the top two thirds, easing to a gentle valley floor (Hermite curve, slope 1.3 -> .12).
const fallCurve=(t:number)=>1.3*(t*t*t-2*t*t+t)+(-2*t*t*t+3*t*t)+.12*(t*t*t-t*t);
const RIDGES=[{x:-2050,h:9,s:520},{x:-420,h:9,s:520},{x:1650,h:8,s:520}];
const PEAKS=[{x:-2900,y:-250,h:24,sx:900,sy:800},{x:-1300,y:200,h:12,sx:800,sy:700},{x:480,y:-250,h:30,sx:900,sy:800},{x:2550,y:-250,h:26,sx:900,sy:800}];
function parkInfluence(x:number,y:number){let m=0;for(const z of PARKS)m=Math.max(m,1-smooth(0,260,rectDist(z,x,y)));return m;}
function raw(x:number,y:number){
 const t=(clamp(y,L0,L1)-L0)/(L1-L0);
 let h=-DROP*fallCurve(t);
 const fade=1-smooth(.5,.82,t);
 for(const r of RIDGES)h+=fade*r.h*Math.exp(-((x-r.x)**2)/(2*r.s*r.s)); // ridges between the mountains, fading out into the valley
 for(const p of PEAKS)h+=p.h*Math.exp(-((x-p.x)**2/(2*p.sx*p.sx)+(y-p.y)**2/(2*p.sy*p.sy)));
 const calm=(1-.85*parkInfluence(x,y))*(1-smooth(.8,.9,t)); // rolling relief, quiet in parks and flat in the valley
 h+=calm*(2.2*Math.sin(x*.0017+y*.0009)+1.1*Math.sin(x*.0038-y*.0019+1.3)+.4*Math.sin(x*.0083+y*.0047));
 return h+Math.max(0,Math.abs(x)-3300)*.03; // the outer walls
}
// ---------- places ----------
export type Location={id:string;name:string;x:number;y:number;color:string;kind:'summit'|'park'|'town'|'lake'|'bowl';description:string};
export const LOCATIONS:Location[]=[
 {id:'ajax',name:'Aspen Mountain Summit',x:2550,y:350,color:'#d5e5df',kind:'summit',description:'Top of the Silver Queen Gondola. Steep, fast, and the start of Spar Gulch.'},
 {id:'highland-bowl',name:'Highland Bowl',x:480,y:450,color:'#84bdcf',kind:'bowl',description:'Steep, wide-open alpine bowl above the trees.'},
 {id:'buttermilk',name:'Buttermilk Summit',x:-1300,y:1500,color:'#e6c88b',kind:'summit',description:'Friendly cruisers, and the way down to the park.'},
 {id:'big-burn',name:'Snowmass · Big Burn',x:-2900,y:1500,color:'#a5bb87',kind:'bowl',description:'Huge open slopes and glades.'},
 {id:'maroon-lake',name:'Maroon Lake',x:1000,y:2500,color:'#84bdcf',kind:'lake',description:'A frozen lake in the trees. Edges barely grip.'},
 {id:'butter-park',name:'Buttermilk Park',x:-1275,y:4260,color:'#7cc97a',kind:'park',description:'Minis and smalls to learn on, a rail line, and a large at the end.'},
 {id:'snowmass-park',name:'Snowmass Park',x:-2875,y:5460,color:'#e6c24a',kind:'park',description:'Mediums and larges, and the long rail garden.'},
 {id:'big-air',name:'Highlands Big Air',x:525,y:3760,color:'#8a4bd1',kind:'park',description:'Mini to GIGANTIC. Two lines, built for speed.'},
 {id:'rail-yard',name:'Ajax Rail Yard',x:2575,y:7060,color:'#5fb8d9',kind:'park',description:'Rails, boxes and mini kickers below Ruthie\'s Run.'},
 {id:'town',name:'Aspen Town',x:1750,y:9060,color:'#ed9a6c',kind:'town',description:'Gondola base, plaza, and the Core Rail Jam.'},
 {id:'snowmass-village',name:'Snowmass Village',x:-2750,y:9200,color:'#a5bb87',kind:'town',description:'Fanny Hill, lodges and the Elk Camp Gondola.'},
];
export const START={x:2550,y:350};
// Flat pads so every arrival point is a place you can stand still, and the frozen lake.
const FLATS:{x:number;y:number;r:number;drop:number;h:number}[]=[...LOCATIONS.filter(l=>l.kind!=='lake').map(l=>({x:l.x,y:l.y,r:l.kind==='park'?110:150,drop:0,h:0})),{x:LAKE.x,y:LAKE.y,r:LAKE.r,drop:-3,h:0}];
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
 {id:'spar-gulch',name:'Spar Gulch',level:'blue',w:520,pts:[[-100,2480],[900,2650],[1900,2400],[3000,2600],[4100,2350],[5200,2300],[6300,2150],[7400,2000],[8500,1850],[9300,1750]]},
 {id:'ruthies',name:'Ruthie\'s Run',level:'blue',w:420,pts:[[0,2800],[1200,3050],[2400,2900],[3700,3200],[5000,3000],[6200,2800],[7400,2650]]},
 {id:'copper-bowl',name:'Copper Bowl',level:'black',w:380,pts:[[600,2250],[1700,2050],[2900,2200],[4000,2050],[5200,1900]]},
 {id:'little-nell',name:'Little Nell',level:'green',w:640,pts:[[7600,2050],[8400,1900],[9300,1750],[9800,1750]]},
 {id:'golden-horn',name:'Golden Horn',level:'blue',w:520,pts:[[-100,380],[1000,520],[2000,250],[3000,40],[4000,-130],[5200,-180],[6500,-120],[8000,-60],[9300,60]]},
 {id:'thunderbowl',name:'Thunderbowl',level:'blue',w:560,pts:[[200,950],[1300,1100],[2500,1050],[3800,1200],[5200,1250],[6600,1350],[8000,1450],[9300,1600]]},
 {id:'exhibition',name:'Exhibition',level:'black',w:320,pts:[[500,650],[1500,500],[2600,700]]},
 {id:'main-buttermilk',name:'Main Buttermilk',level:'green',w:500,pts:[[1200,-1300],[2400,-1350],[3500,-1300],[4200,-1275]]},
 {id:'tiehack',name:'Tiehack',level:'blue',w:520,pts:[[1500,-1500],[2600,-1600],[3700,-1750],[5000,-1850],[6300,-1800],[7600,-1750],[8700,-1550],[9300,-1350]]},
 {id:'west-buttermilk',name:'West Buttermilk',level:'green',w:640,pts:[[3500,-700],[4500,-550],[5800,-600],[7200,-650],[8600,-800],[9300,-1000]]},
 {id:'panda-peak',name:'Panda Peak',level:'green',w:800,pts:[[8000,-1300],[8800,-1300],[9500,-1300]]},
 {id:'big-burn',name:'Big Burn',level:'blue',w:900,pts:[[900,-2900],[2000,-3000],[3200,-2850],[4400,-2800],[5300,-2850]]},
 {id:'long-shot',name:'Long Shot',level:'black',w:340,pts:[[1500,-3350],[2800,-3300],[4000,-3400],[5200,-3350]]},
 {id:'campground',name:'Campground',level:'blue',w:480,pts:[[5200,-2300],[6400,-2350],[7600,-2400],[8800,-2600],[9300,-2750]]},
 {id:'fanny-hill',name:'Fanny Hill',level:'green',w:800,pts:[[8000,-2800],[8800,-2750],[9400,-2750]]},
];
export const trailById=(id:string)=>TRAILS.find(t=>t.id===id)!;
// Catmull-Rom through the knots. null outside the trail's length.
export function trailX(tr:Trail,y:number):number|null{
 const p=tr.pts,n=p.length;if(y<p[0][0]||y>p[n-1][0])return null;
 let i=0;while(i<n-2&&y>p[i+1][0])i++;
 const p0=p[Math.max(0,i-1)][1],p1=p[i][1],p2=p[i+1][1],p3=p[Math.min(n-1,i+2)][1],u=(y-p[i][0])/(p[i+1][0]-p[i][0]);
 return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);
}
const VALLEY_Y=8750;
// Groomed: on a trail, inside a park or the town, or on the valley floor that links the bases.
export function onTrail(x:number,y:number){
 if(y>VALLEY_Y)return true;
 const z=zoneAt(x,y);if(z&&(z.kind==='park'||z.kind==='town'))return true;
 for(const tr of TRAILS){const c=trailX(tr,y);if(c!==null&&Math.abs(x-c)<tr.w/2)return true;}
 return false;
}
// The frozen lake is ice, pisted terrain is groomed, everything else is powder.
export function snowAt(x:number,y:number):'groomed'|'powder'|'ice'{return Math.hypot(x-LAKE.x,y-LAKE.y)<LAKE.r?'ice':onTrail(x,y)?'groomed':'powder';}

// ---------- landmarks and lifts ----------
export type Landmark={kind:'village'|'lodge'|'parkgate'|'lake';x:number;y:number;name:string;count?:number;r?:number};
export const LANDMARKS:Landmark[]=[
 {kind:'village',x:1750,y:9560,name:'ASPEN',count:16},{kind:'village',x:-2750,y:9420,name:'SNOWMASS VILLAGE',count:9},
 {kind:'village',x:-1300,y:9300,name:'BUTTERMILK BASE',count:4},{kind:'village',x:450,y:9300,name:'HIGHLANDS BASE',count:4},
 {kind:'lodge',x:2300,y:430,name:'SUNDECK'},{kind:'lodge',x:700,y:560,name:'CLOUD NINE'},{kind:'lodge',x:-2680,y:1590,name:'ELK CAMP'},{kind:'lodge',x:-1080,y:1590,name:'SUMMIT HUT'},
 ...PARKS.map(z=>({kind:'parkgate' as const,x:(z.x0+z.x1)/2,y:z.y0+30,name:z.name.toUpperCase(),r:(z.x1-z.x0)/2})),
 {kind:'lake',x:LAKE.x,y:LAKE.y,name:'MAROON LAKE',r:LAKE.r},
];
export type Lift={id:string;name:string;x0:number;y0:number;x1:number;y1:number};
export const LIFTS:Lift[]=[ // bottom -> top
 {id:'silver-queen',name:'Silver Queen Gondola',x0:1950,y0:9400,x1:2550,y1:520},
 {id:'loge-peak',name:'Loge Peak Express',x0:1400,y0:9300,x1:1000,y1:700},
 {id:'summit-express',name:'Summit Express',x0:-700,y0:9200,x1:-1000,y1:1800},
 {id:'elk-camp',name:'Elk Camp Gondola',x0:-2300,y0:9300,x1:-2600,y1:1700},
];

// ---------- trees, rocks and park features ----------
export type Feature={kind:'tree'|'rock'|'ramp'|'rail'|'flag'|'gate'|'start'|'finish';x:number;y:number;size:number;seed:number;id:string};
// Forest density 0..1: none above the treeline and in the bowls, thickest low down, in patches, thin in the Big Burn glades.
export function forestAt(x:number,y:number){
 const z=zoneAt(x,y);if(z&&z.kind==='bowl'&&z.id==='highland-bowl')return 0;
 const alt=smooth(2300,3500,y),n=.5+.5*Math.sin(x*.0017+y*.0009)*Math.sin(x*.0011-y*.0014+2);
 return alt*(.3+.7*n)*(z&&z.id==='big-burn'?.18:1)*(1-smooth(9000,9400,y));
}
const nearLandmark=(x:number,y:number)=>LANDMARKS.some(l=>(l.kind==='village'||l.kind==='lodge')&&Math.hypot(x-l.x,y-l.y)<(l.kind==='village'?380:130));
export const PARK_FEATURES:Feature[]=[];
function kickerLine(park:string,x:number,y0:number,classes:number[]){let y=y0;classes.forEach((c,i)=>{const k=KICKER_CLASSES[c];PARK_FEATURES.push({kind:'ramp',x,y:y+k.run-KICKER.lipAt,size:c,seed:c,id:`${park}:k${x}:${i}`});y+=k.run+k.landing;});}
// items: [size, isBox]. A box is lower and wider; a rail is longer and thinner.
function railLine(park:string,x:number,y0:number,items:[number,boolean][],gap:number){let y=y0;items.forEach(([size,box],i)=>{const len=(box?140:170)*size;PARK_FEATURES.push({kind:'rail',x,y:y+len/2,size,seed:i*2+(box?1:0),id:`${park}:r${x}:${i}`});y+=len+gap;});}
// Buttermilk Park: a gentle progression. Left: minis -> smalls -> medium. Middle: boxes then rails. Right: small -> mediums -> large.
kickerLine('butter',-1450,4350,[0,0,1,1,2]);kickerLine('butter',-1100,4400,[1,2,2,3]);
railLine('butter',-1275,4450,[[.6,true],[.8,true],[1,false],[1.1,true],[1.4,false],[1.4,true],[1.8,false],[1.2,true]],110);
// Snowmass Park: bigger. Left: small -> medium -> large -> medium. Middle: rail garden. Right: medium -> large -> huge.
kickerLine('snow',-3050,5550,[1,2,3,2]);kickerLine('snow',-2700,5600,[2,3,4]);
railLine('snow',-2875,5650,[[1.2,false],[1,true],[1.6,false],[1.4,true],[2,false],[1,true],[1.8,false]],120);
// Highlands Big Air: every size from MINI to GIGANTIC on two lines, with the long run-outs they need.
kickerLine('air',330,3900,[0,3,4,5]);kickerLine('air',700,3950,[1,4,5,2]);
// Ajax Rail Yard: rails and boxes, plus four minis/smalls on the right.
railLine('yard',2575,7150,[[1,true],[1.3,false],[1,true],[1.7,false],[1.2,true],[1.5,false]],60);
railLine('yard',2420,7250,[[.8,false],[1.4,true],[1,false],[1.6,false]],90);kickerLine('yard',2730,7300,[0,0,1,1]);
// Aspen Core Rail Jam: the plaza.
railLine('core',1750,9150,[[1,true],[1.3,false],[1,true]],80);railLine('core',1600,9180,[[.8,false],[1.2,true],[1,false]],80);railLine('core',1900,9180,[[1,true],[.8,false],[1.2,true]],80);

export function featuresNear(x:number,y:number){
 const out:Feature[]=[];
 const c0=Math.floor((x-1500)/200),c1=Math.ceil((x+1500)/200),r0=Math.floor((y-1300)/200),r1=Math.ceil((y+1700)/200);
 for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
  const seed=row*577+col*79,px=col*200+(hash(seed)-.5)*120,py=row*200+hash(seed+2)*120;
  if(Math.abs(px-x)>1500||px<BOUNDS.minX||px>BOUNDS.maxX||py<BOUNDS.minY||py>BOUNDS.maxY)continue;
  if(onTrail(px,py)||zoneAt(px,py)?.kind==='lake'||nearLandmark(px,py))continue;
  const f=forestAt(px,py);
  if(hash(seed+3)<f)out.push({kind:'tree',x:px,y:py,size:.8+hash(seed+8)*.6,seed,id:'n'+row+':'+col});
  else if(f<.12&&hash(seed+5)<.16)out.push({kind:'rock',x:px,y:py,size:1.1+hash(seed+8)*1.3,seed,id:'n'+row+':'+col});
 }
 for(const f of PARK_FEATURES)if(Math.abs(f.x-x)<=1500&&f.y>=y-1700&&f.y<=y+2100)out.push(f);
 return out;
}
