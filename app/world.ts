import {KICKER_CLASSES,KICKER} from './park';
// The world: one long, narrow mountain in the spirit of Aspen. A wide main run (Spar Gulch) winds down the spine from the summit to the town,
// with steep walls either side. The terrain parks sit on detours: side runs that peel off the main run, pass through a park, and rejoin
// it further down. Aspen-inspired, not a survey. Units are engine units; 1 unit = SCALE world units.
export const SCALE=.05;
export const BOUNDS={minX:-1500,maxX:1500,minY:-1000,maxY:14000};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

// ---------- zones ----------
export type Zone={id:string;name:string;kind:'park'|'bowl'|'town'|'lake';x0:number;y0:number;x1:number;y1:number;color:string;desc:string};
export const ZONES:Zone[]=[
 {id:'butter-park',name:'Buttermilk Park',kind:'park',x0:-1330,y0:3300,x1:-600,y1:6300,color:'#7cc97a',desc:'West detour: the learning park, with minis and smalls, boxes and rails, and a large to graduate on.'},
 {id:'snowmass-park',name:'Snowmass Park',kind:'park',x0:-1330,y0:7000,x1:-550,y1:10300,color:'#e6c24a',desc:'West detour: mediums and larges, a long rail garden, and a huge at the end of the right line.'},
 {id:'big-air',name:'Highlands Big Air',kind:'park',x0:250,y0:3800,x1:1150,y1:8700,color:'#8a4bd1',desc:'East detour: two big-air lines from mini to GIGANTIC. Bring speed.'},
 {id:'rail-yard',name:'Ajax Rail Yard',kind:'park',x0:450,y0:9300,x1:1100,y1:11200,color:'#5fb8d9',desc:'East detour: rails and boxes, with a few mini kickers.'},
 {id:'aspen-town',name:'Aspen Town',kind:'town',x0:-450,y0:12300,x1:450,y1:13500,color:'#ed9a6c',desc:'The base village, the gondola and the Core Rail Jam in the plaza.'},
 {id:'highland-bowl',name:'Highland Bowl',kind:'bowl',x0:250,y0:-400,x1:1100,y1:2200,color:'#d5e5df',desc:'Steep, wide-open alpine bowl above the trees. Ungroomed.'},
 {id:'big-burn',name:'The Big Burn',kind:'bowl',x0:-1350,y0:1000,x1:-500,y1:3000,color:'#a5bb87',desc:'Huge open slopes with scattered glades.'},
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
const L0=-1000,L1=14000,DROP=330;
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
 return h+Math.max(0,Math.abs(x)-1000)*.32; // steep walls close the mountain in on both sides
}
// ---------- places ----------
export type Location={id:string;name:string;x:number;y:number;color:string;kind:'summit'|'park'|'town'|'lake'|'bowl';description:string};
export const LOCATIONS:Location[]=[
 {id:'ajax',name:'Summit',x:0,y:350,color:'#d5e5df',kind:'summit',description:'Top of the Silver Queen Gondola. Steep, fast, and the start of Spar Gulch.'},
 {id:'highland-bowl',name:'Highland Bowl',x:700,y:700,color:'#84bdcf',kind:'bowl',description:'Steep, wide-open alpine bowl above the trees.'},
 {id:'big-burn',name:'The Big Burn',x:-900,y:1700,color:'#a5bb87',kind:'bowl',description:'Huge open slopes and glades.'},
 {id:'butter-park',name:'Buttermilk Park',x:-965,y:3560,color:'#7cc97a',kind:'park',description:'West detour. Minis and smalls to learn on, a rail line, and a large at the end.'},
 {id:'big-air',name:'Highlands Big Air',x:685,y:4060,color:'#8a4bd1',kind:'park',description:'East detour. Mini to GIGANTIC, two lines, built for speed.'},
 {id:'mid',name:'Mid Mountain',x:0,y:6000,color:'#e6c88b',kind:'summit',description:'The middle of Spar Gulch, with the detours on both sides.'},
 {id:'snowmass-park',name:'Snowmass Park',x:-965,y:7260,color:'#e6c24a',kind:'park',description:'West detour. Mediums and larges, and the long rail garden.'},
 {id:'rail-yard',name:'Ajax Rail Yard',x:775,y:9360,color:'#5fb8d9',kind:'park',description:'East detour. Rails, boxes and mini kickers.'},
 {id:'town',name:'Aspen Town',x:0,y:12650,color:'#ed9a6c',kind:'town',description:'Gondola base, plaza, and the Core Rail Jam.'},
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
 // The main run, straight down the spine.
 {id:'spar-gulch',name:'Spar Gulch',level:'blue',w:520,pts:[[-100,0],[1200,120],[2400,-100],[3600,60],[4800,-120],[6000,100],[7200,-80],[8400,60],[9600,-60],[10800,40],[12000,0],[13200,0]]},
 {id:'golden-horn',name:'Golden Horn',level:'blue',w:440,pts:[[-100,520],[1000,560],[2200,420],[3200,300],[3900,150]]},
 {id:'copper-bowl',name:'Copper Bowl',level:'black',w:340,pts:[[600,-520],[1500,-480],[2600,-420],[3300,-250],[3700,-80]]},
 {id:'exhibition',name:'Exhibition',level:'black',w:320,pts:[[400,520],[1200,640],[2000,700]]},
 // Detours: each leaves the main run, passes through a park, and rejoins it.
 {id:'buttermilk-run',name:'Buttermilk Run',level:'green',w:520,pts:[[3100,40],[3500,-250],[3900,-780],[4400,-960],[5200,-960],[6000,-960],[6500,-780],[6900,-300],[7200,-60]]},
 {id:'snowmass-run',name:'Snowmass Run',level:'blue',w:480,pts:[[7400,-60],[7700,-350],[8000,-800],[8500,-940],[9500,-940],[10300,-900],[10700,-500],[11000,-100],[11400,0]]},
 {id:'highlands-run',name:'Highlands Run',level:'blue',w:520,pts:[[3300,60],[3600,300],[3900,600],[4400,700],[6000,700],[8000,700],[8700,550],[9000,250],[9300,60]]},
 {id:'yard-run',name:'Ajax Run',level:'blue',w:460,pts:[[9500,60],[9700,350],[10000,700],[10500,775],[11000,700],[11400,300],[11700,20]]},
 {id:'little-nell',name:'Little Nell',level:'green',w:700,pts:[[11400,0],[12200,0],[13000,0],[13500,0]]},
];
export const trailById=(id:string)=>TRAILS.find(t=>t.id===id)!;
// Catmull-Rom through the knots. null outside the trail's length.
export function trailX(tr:Trail,y:number):number|null{
 const p=tr.pts,n=p.length;if(y<p[0][0]||y>p[n-1][0])return null;
 let i=0;while(i<n-2&&y>p[i+1][0])i++;
 const p0=p[Math.max(0,i-1)][1],p1=p[i][1],p2=p[i+1][1],p3=p[Math.min(n-1,i+2)][1],u=(y-p[i][0])/(p[i+1][0]-p[i][0]);
 return .5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);
}
const VALLEY_Y=11900;
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
 {kind:'village',x:0,y:13550,name:'ASPEN',count:16},{kind:'village',x:-950,y:13300,name:'SNOWMASS VILLAGE',count:9},{kind:'village',x:950,y:13300,name:'HIGHLANDS BASE',count:4},
 {kind:'lodge',x:250,y:430,name:'SUNDECK'},{kind:'lodge',x:700,y:560,name:'CLOUD NINE'},{kind:'lodge',x:-700,y:1590,name:'ELK CAMP'},{kind:'lodge',x:-250,y:2400,name:'SUMMIT HUT'},
 ...PARKS.map(z=>({kind:'parkgate' as const,x:(z.x0+z.x1)/2,y:z.y0+30,name:z.name.toUpperCase(),r:(z.x1-z.x0)/2})),
];
export type Lift={id:string;name:string;x0:number;y0:number;x1:number;y1:number};
export const LIFTS:Lift[]=[ // bottom -> top
 {id:'silver-queen',name:'Silver Queen Gondola',x0:330,y0:13000,x1:250,y1:520},
 {id:'loge-peak',name:'Loge Peak Express',x0:-330,y0:12900,x1:-250,y1:700},
];

// ---------- trees, rocks and park features ----------
export type Feature={kind:'tree'|'rock'|'ramp'|'rail'|'flag'|'gate'|'start'|'finish';x:number;y:number;size:number;seed:number;id:string};
// Forest density 0..1: none above the treeline and in the bowls, thickest low down, in patches, thin in the Big Burn glades.
export function forestAt(x:number,y:number){
 const z=zoneAt(x,y);if(z&&z.kind==='bowl'&&z.id==='highland-bowl')return 0;
 const alt=smooth(2000,3000,y),n=.5+.5*Math.sin(x*.0017+y*.0009)*Math.sin(x*.0011-y*.0014+2);
 // Glades: long, winding open lanes through the forest with just a few scattered trees, running downhill like tree runs.
 const lane=Math.sin(x*.0046+Math.sin(y*.0013)*2.2+Math.sin(y*.0004)*3),glade=smooth(.35,.7,lane);
 return Math.min(1,alt*(.62+.55*n)*(1-.8*glade)*(z&&z.id==='big-burn'?.25:1)*(1-smooth(9000,9400,y)));
}
const nearLandmark=(x:number,y:number)=>LANDMARKS.some(l=>(l.kind==='village'||l.kind==='lodge')&&Math.hypot(x-l.x,y-l.y)<(l.kind==='village'?380:130));
export const PARK_FEATURES:Feature[]=[];
function kickerLine(park:string,x:number,y0:number,classes:number[]){let y=y0;classes.forEach((c,i)=>{const k=KICKER_CLASSES[c];PARK_FEATURES.push({kind:'ramp',x,y:y+k.run-KICKER.lipAt,size:c,seed:c,id:`${park}:k${x}:${i}`});y+=k.run+k.landing;});}
// items: [size, isBox]. A box is lower and wider; a rail is longer and thinner.
function railLine(park:string,x:number,y0:number,items:[number,boolean][],gap:number){let y=y0;items.forEach(([size,box],i)=>{const len=(box?140:170)*size;PARK_FEATURES.push({kind:'rail',x,y:y+len/2,size,seed:i*2+(box?1:0),id:`${park}:r${x}:${i}`});y+=len+gap;});}
// Buttermilk Park: a gentle progression. Left: minis -> smalls -> medium. Middle: boxes then rails. Right: small -> mediums -> large.
kickerLine('butter',-1200,3500,[0,0,1,1,2]);kickerLine('butter',-850,3550,[1,2,2,3]);
railLine('butter',-1025,3650,[[.6,true],[.8,true],[1,false],[1.1,true],[1.4,false],[1.4,true],[1.8,false],[1.2,true]],110);
// Snowmass Park: bigger. Left: small -> medium -> large -> medium. Middle: rail garden. Right: medium -> large -> huge.
kickerLine('snow',-1200,7200,[1,2,3,2]);kickerLine('snow',-750,7250,[2,3,4]);
railLine('snow',-975,7350,[[1.2,false],[1,true],[1.6,false],[1.4,true],[2,false],[1,true],[1.8,false]],120);
// Highlands Big Air: every size from MINI to GIGANTIC on two lines, with the long run-outs they need.
kickerLine('air',500,4000,[0,3,4,5]);kickerLine('air',870,4050,[1,4,5,2]);
// Ajax Rail Yard: rails and boxes, plus four minis/smalls on the right.
railLine('yard',775,9500,[[1,true],[1.3,false],[1,true],[1.7,false],[1.2,true],[1.5,false]],60);
railLine('yard',620,9600,[[.8,false],[1.4,true],[1,false],[1.6,false]],90);kickerLine('yard',920,9650,[0,0,1,1]);
// Aspen Core Rail Jam: the plaza.
railLine('core',0,12500,[[1,true],[1.3,false],[1,true]],80);railLine('core',-150,12530,[[.8,false],[1.2,true],[1,false]],80);railLine('core',150,12530,[[1,true],[.8,false],[1.2,true]],80);

export function featuresNear(x:number,y:number){
 const out:Feature[]=[];
 const c0=Math.floor((x-1500)/160),c1=Math.ceil((x+1500)/160),r0=Math.floor((y-1300)/160),r1=Math.ceil((y+1700)/160);
 for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){
  const seed=row*577+col*79,px=col*160+(hash(seed)-.5)*110,py=row*160+hash(seed+2)*110;
  if(Math.abs(px-x)>1500||px<BOUNDS.minX||px>BOUNDS.maxX||py<BOUNDS.minY||py>BOUNDS.maxY)continue;
  if(onTrail(px,py)||nearLandmark(px,py))continue;
  const f=forestAt(px,py);
  if(hash(seed+3)<f)out.push({kind:'tree',x:px,y:py,size:.8+hash(seed+8)*.6,seed,id:'n'+row+':'+col});
  else if(f<.12&&hash(seed+5)<.07)out.push({kind:'rock',x:px,y:py,size:1.1+hash(seed+8)*1.3,seed,id:'n'+row+':'+col});
 }
 for(const f of PARK_FEATURES)if(Math.abs(f.x-x)<=1500&&f.y>=y-1700&&f.y<=y+2100)out.push(f);
 return out;
}
