export const SCALE=.05;
export const BOUNDS={minX:-2200,maxX:2200,minY:-600,maxY:6500};
export const LOCATIONS=[
{id:'summit',name:'Frostpeak Summit',x:0,y:0,description:'The top of the world. Choose your own line.',color:'#d5e5df'},
{id:'ridge',name:'Eagle Ridge',x:1050,y:800,description:'Wide bowls and steep, untouched powder.',color:'#e6c88b'},
{id:'lake',name:'Mirror Lake',x:-1100,y:2100,description:'Frozen water, quiet forest and natural kickers.',color:'#84bdcf'},
{id:'park',name:'Outlaw Park',x:950,y:3300,description:'Big-air jumps, long rails and technical lines.',color:'#ed9a6c'},
{id:'village',name:'Pinehaven Village',x:-800,y:5400,description:'Cabins, a plaza and the return gondola.',color:'#a5bb87'}
] as const;
export const trailCenter=(y:number)=>Math.sin(y*.0017)*68+Math.sin(y*.00043)*42;
export function groundHeight(x:number,y:number){
 const lake=Math.exp(-((x+1100)**2/400000+(y-2100)**2/500000));
 const base=-y*.010;
 const ridges=Math.sin(x*.0017)*5+Math.sin(y*.0012)*2;
 const sides=Math.max(0,Math.abs(x)-1550)*.025;
 const h=base+ridges*(1-lake)+sides;const lakeDistance=Math.hypot(x+1100,y-2100);const blend=Math.max(0,Math.min(1,(lakeDistance-290)/160));return -21*(1-blend)+h*blend;
}
export function regionAt(x:number,y:number){return LOCATIONS.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b).name;}
export type Feature={kind:'tree'|'rock'|'ramp'|'rail'|'flag';x:number;y:number;size:number;seed:number;id:string};
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export function featuresNear(x:number,y:number){const result:Feature[]=[];for(let row=Math.floor((y-1300)/200);row<=Math.ceil((y+1700)/200);row++){if(row< -3||row>33)continue;for(let col=-10;col<=10;col++){const xx=col*200,yy=row*200,seed=row*577+col*79;const px=xx+(hash(seed)-.5)*120,py=yy+hash(seed+2)*120;
 if(Math.abs(px-x)>1500)continue;
 const inHub=LOCATIONS.some(p=>Math.hypot(px-p.x,py-p.y)<260);
 const trail=Math.abs(px-trailCenter(py))<230||Math.abs(px-950)<210||Math.abs(px+800)<170;
 if(!trail&&!inHub&&hash(seed+3)>.3)result.push({kind:hash(seed+4)>.92?'rock':'tree',x:px,y:py,size:.8+hash(seed+8)*.6,seed,id:'n'+row+':'+col});}
 if(row>0&&row<31){for(const lane of [0,950,-800]){if(Math.abs(lane-x)>1500)continue;const yy=row*200+95;result.push({kind:row%3===0&&lane===950?'rail':'ramp',x:lane+Math.sin(row*1.88)*110,y:yy,size:lane===950?1.3:1,seed:row,id:'p'+row+':'+lane});}}
 }return result;}
