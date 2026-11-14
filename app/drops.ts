// Limited-time drops: a rotating weekly helmet you can only earn by finishing three challenges while it is live.
// Brands are fictional look-alikes (energy-drink-style racing helmets), with original marks.
export type Helmet={id:string;name:string;brand:string;shell:string;stripe:string;accent:string;lens:string;finish:'matte'|'gloss'|'chrome';logo:'stag'|'bolt'|'ghost'|'flame';desc:string};
export const HELMETS:Helmet[]=[
 {id:'redstag',name:'Redstag Racing Helmet',brand:'REDSTAG',shell:'#142a5e',stripe:'#e2262d',accent:'#ffc928',lens:'#ff3b3b',finish:'gloss',logo:'stag',desc:'Navy shell, twin red stripes and the golden stag. Gives you wings, allegedly.'},
 {id:'voltchrome',name:'Voltage Chrome Helmet',brand:'VOLTAGE',shell:'#c9d2d8',stripe:'#b8ff2c',accent:'#16181a',lens:'#b8ff2c',finish:'chrome',logo:'bolt',desc:'Mirror-silver shell with neon-lime bolt stripes.'},
 {id:'glacierghost',name:'Glacier Ghost Helmet',brand:'GHOSTLINE',shell:'#f3f7fa',stripe:'#52c7ff',accent:'#0e2a3a',lens:'#52c7ff',finish:'matte',logo:'ghost',desc:'Frosted white shell, ice-blue stripes, a ghost on each side.'},
 {id:'magmarush',name:'Magma Rush Helmet',brand:'MAGMA RUSH',shell:'#17181a',stripe:'#ff6a1a',accent:'#ffd23c',lens:'#ff6a1a',finish:'gloss',logo:'flame',desc:'Blacked-out shell with a lava-orange flame stripe.'},
];
export const helmetById=(id?:string)=>HELMETS.find(h=>h.id===id);

export type Challenge={id:string;title:string;feat:string;goal:number;mode:'max'|'min'|'count'};
export const CHALLENGES:Record<string,Challenge>={
 air8:{id:'air8',title:'Get 8 m of air and land it',feat:'air',goal:8,mode:'max'},
 spin540:{id:'spin540',title:'Land a clean 540',feat:'spin',goal:540,mode:'max'},
 link2:{id:'link2',title:'Link 2 rails in one chain',feat:'link',goal:2,mode:'max'},
 speed90:{id:'speed90',title:'Hit 90 km/h',feat:'speed',goal:90,mode:'max'},
 race26:{id:'race26',title:'Finish Spar Gulch GS in under 26 s',feat:'race',goal:26,mode:'min'},
 cross1:{id:'cross1',title:'Land a Q / E trick (cross, scissor, method or stalefish)',feat:'cross',goal:1,mode:'count'},
 flip1:{id:'flip1',title:'Land a clean flip',feat:'flip',goal:1,mode:'max'},
 combo2k:{id:'combo2k',title:'Bank 2,000 points in one landing',feat:'combo',goal:2000,mode:'max'},
 switchup1:{id:'switchup1',title:'Land a rail switch-up',feat:'switchup',goal:1,mode:'max'},
 air12:{id:'air12',title:'Get 12 m of air and land it',feat:'air',goal:12,mode:'max'},
 spin720:{id:'spin720',title:'Land a clean 720',feat:'spin',goal:720,mode:'max'},
 land10:{id:'land10',title:'Land 10 jumps',feat:'land',goal:10,mode:'count'},
};
export type Drop={helmet:string;challenges:string[]};
export const DROPS:Drop[]=[
 {helmet:'redstag',challenges:['air8','spin540','link2']},
 {helmet:'voltchrome',challenges:['speed90','race26','cross1']},
 {helmet:'glacierghost',challenges:['flip1','combo2k','switchup1']},
 {helmet:'magmarush',challenges:['air12','spin720','land10']},
];
// A new drop goes live every Monday (UTC) and lasts a week.
const WEEK=7*864e5,EPOCH=Date.UTC(2026,0,5);
export function dropAt(now:number){const n=Math.floor((now-EPOCH)/WEEK),i=((n%DROPS.length)+DROPS.length)%DROPS.length;return{week:n,drop:DROPS[i],start:EPOCH+n*WEEK,end:EPOCH+(n+1)*WEEK};}
export function countdown(ms:number){const s=Math.max(0,Math.floor(ms/1000)),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d>0?`${d}d ${h}h`:h>0?`${h}h ${m}m`:`${m}m`;}

// Progress is kept per week so an expired drop's progress is never reused.
export type DropState={week:number;values:Record<string,number>;done:string[]};
export const freshDrop=(week:number):DropState=>({week,values:{},done:[]});
// Apply one thing that happened in the game. Returns the new state and any challenge ids completed by it.
export function applyFeat(st:DropState,drop:Drop,feat:{type:string;value:number}){
 const values={...st.values},done=[...st.done],newly:string[]=[];
 for(const id of drop.challenges){const c=CHALLENGES[id];if(c.feat!==feat.type||done.includes(id))continue;
  const v=c.mode==='count'?(values[id]||0)+1:c.mode==='min'?Math.min(values[id]??1e9,feat.value):Math.max(values[id]||0,feat.value);values[id]=v;
  if(c.mode==='min'?v<=c.goal:v>=c.goal){done.push(id);newly.push(id);}}
 return{state:{...st,values,done},newly};
}

// Helmet marks, drawn to a canvas for the side decals and the cards.
export function drawHelmetLogo(ctx:CanvasRenderingContext2D,logo:Helmet['logo'],s:number,ink:string,bg?:string){
 ctx.clearRect(0,0,s,s);if(bg){ctx.fillStyle=bg;ctx.beginPath();ctx.arc(s/2,s/2,s*.48,0,7);ctx.fill();}
 ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=s*.075;ctx.lineCap='round';ctx.lineJoin='round';const c=s/2;
 if(logo==='stag'){ // two antler sweeps over a disc
  ctx.beginPath();ctx.arc(c,c*1.18,s*.17,0,7);ctx.fill();
  for(const k of [-1,1]){ctx.beginPath();ctx.moveTo(c+k*s*.1,c*1.0);ctx.quadraticCurveTo(c+k*s*.34,c*.7,c+k*s*.3,c*.28);ctx.moveTo(c+k*s*.24,c*.66);ctx.lineTo(c+k*s*.4,c*.56);ctx.stroke();}
 }else if(logo==='bolt'){ctx.beginPath();ctx.moveTo(c+s*.1,s*.1);ctx.lineTo(c-s*.18,c*1.08);ctx.lineTo(c+s*.02,c*1.08);ctx.lineTo(c-s*.1,s*.9);ctx.lineTo(c+s*.2,c*.9);ctx.lineTo(c,c*.9);ctx.closePath();ctx.fill();}
 else if(logo==='ghost'){ctx.beginPath();ctx.moveTo(c-s*.24,s*.86);ctx.lineTo(c-s*.24,c*.9);ctx.quadraticCurveTo(c-s*.24,s*.14,c,s*.14);ctx.quadraticCurveTo(c+s*.24,s*.14,c+s*.24,c*.9);ctx.lineTo(c+s*.24,s*.86);ctx.lineTo(c+s*.12,s*.76);ctx.lineTo(c,s*.86);ctx.lineTo(c-s*.12,s*.76);ctx.closePath();ctx.fill();ctx.fillStyle=bg||'#000';ctx.beginPath();ctx.arc(c-s*.09,c*.86,s*.045,0,7);ctx.arc(c+s*.09,c*.86,s*.045,0,7);ctx.fill();}
 else{ctx.beginPath();ctx.moveTo(c,s*.08);ctx.quadraticCurveTo(c+s*.34,c*.75,c+s*.2,c*1.4);ctx.quadraticCurveTo(c+s*.12,s*.92,c,s*.9);ctx.quadraticCurveTo(c-s*.3,s*.9,c-s*.26,c*1.2);ctx.quadraticCurveTo(c-s*.24,c*.8,c,s*.08);ctx.fill();}
}
