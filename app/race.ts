import {trailCenter} from './world';

// Frostpeak GS: a timed giant-slalom run down the main trail. Riders travel toward +y (downhill).
export type Gate={x:number;y:number;w:number;kind:'start'|'gate'|'finish';n:number};
const START=300,FINISH=3900,STEP=450;
export const COURSE:{name:string;start:Gate;gates:Gate[]}={
 name:'Frostpeak GS',
 start:{x:trailCenter(START),y:START,w:320,kind:'start',n:0},
 // Gates alternate either side of the trail line so the run needs real turns. The last "gate" is the finish.
 gates:[...Array.from({length:7},(_,i)=>{const y=START+(i+1)*STEP;return{x:trailCenter(y)+(i%2?60:-60),y,w:130,kind:'gate' as const,n:i+1};}),
  {x:trailCenter(FINISH),y:FINISH,w:420,kind:'finish',n:8}],
};
export const MISS_PENALTY=2;
export type Best={total:number;splits:number[]};
export type Split={n:number;time:number;delta:number|null;missed:boolean;finish:boolean};
export type Run={state:'idle'|'running'|'finished';t0:number;next:number;splits:number[];penalty:number;missed:number;last:Split|null;lastAt:number;total:number;newBest:boolean};
export const idleRun=():Run=>({state:'idle',t0:0,next:0,splits:[],penalty:0,missed:0,last:null,lastAt:0,total:0,newBest:false});
const crossed=(g:Gate,py:number,y:number)=>py<g.y&&y>=g.y;

// Advance the run for one movement step from (px,py) to (x,y) at time t. Returns the new best when a run beats it.
export function stepRun(run:Run,best:Best|null,px:number,py:number,x:number,y:number,t:number):{run:Run;best:Best|null}{
 const s=COURSE.start;
 if(run.state!=='running'){
  if(crossed(s,py,y)&&Math.abs(x-s.x)<s.w/2)return{run:{...idleRun(),state:'running',t0:t},best};
  return{run,best};
 }
 if(y<s.y-250)return{run:idleRun(),best}; // went back above the start: run abandoned
 const g=COURSE.gates[run.next];
 if(!g||!crossed(g,py,y))return{run,best};
 const missed=Math.abs(x-g.x)>=g.w/2&&g.kind!=='finish',penalty=run.penalty+(missed?MISS_PENALTY:0);
 const time=t-run.t0+penalty,splits=[...run.splits,time],i=splits.length-1,finish=g.kind==='finish';
 const delta=best&&best.splits[i]!==undefined?time-best.splits[i]:null;
 const last:Split={n:g.n,time,delta,missed,finish};
 if(!finish)return{run:{...run,next:run.next+1,splits,penalty,missed:run.missed+(missed?1:0),last,lastAt:t},best};
 const newBest=!best||time<best.total;
 return{run:{...run,state:'finished',next:run.next+1,splits,penalty,last,lastAt:t,total:time,newBest},best:newBest?{total:time,splits}:best};
}
export function formatTime(s:number){const m=Math.floor(s/60),r=s-m*60;return m+':'+(r<10?'0':'')+r.toFixed(2);}
