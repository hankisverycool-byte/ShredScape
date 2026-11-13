"use client";
import {formatTime,COURSE} from './race';
import type {RunView} from './game-engine';

// Racing HUD: big timer, gate progress, split vs best. Sits at the top edge so the slope and gates stay visible.
export function RaceHud({run,y}:{run?:RunView;y:number}){
 if(!run)return null;
 const recentFinish=run.state==='finished'&&run.lastAge<10;
 if(run.state==='idle'||(run.state==='finished'&&!recentFinish)){
  if(y>COURSE.start.y+60)return null;
  return <div className="race-idle"><b>TIMED RUN</b><span>{run.course} · ride through the start gate below</span>{run.best!=null&&<em>BEST {formatTime(run.best)}</em>}</div>;
 }
 const s=run.last,showSplit=s&&run.lastAge<3.2,sign=(d:number)=>(d<=0?'−':'+')+Math.abs(d).toFixed(2);
 return <div className={'race-hud'+(run.state==='finished'?' finished':'')} role="timer" aria-live="off">
  <div className="race-time">{formatTime(run.time)}</div>
  <div className="race-gates" aria-label={`Gate ${run.gate} of ${run.gates}`}>
   {Array.from({length:run.gates},(_,i)=><i key={i} className={i<run.gate?'done':i===run.gate&&run.state==='running'?'next':''}/>)}
   <span>{run.state==='finished'?'FINISH':`GATE ${Math.min(run.gate+1,run.gates-1)}/${run.gates-1}`}</span>
  </div>
  {showSplit&&s&&<div className={'race-split '+(s.delta==null?'':s.delta<=0?'ahead':'behind')}>
   {s.missed&&<strong className="missed">MISSED +2.00</strong>}
   <span>{s.finish?'FINISH':'SPLIT '+s.n}</span><span className="t">{formatTime(s.time)}</span>{s.delta!=null&&<b>{sign(s.delta)}</b>}
  </div>}
  {run.state==='finished'&&<div className="race-result">{run.newBest?'NEW BEST':'BEST '+(run.best!=null?formatTime(run.best):'—')} · {run.missed?run.missed+' MISSED':'CLEAN RUN'} · <kbd>R</kbd> RESTART</div>}
 </div>;
}
