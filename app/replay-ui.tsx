"use client";
import type {ReplayView} from './game-engine';

// Friendly name for a KeyboardEvent.code ("KeyB" -> "B", "ArrowUp" -> "↑").
export function keyLabel(code:string){const m:Record<string,string>={ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Backquote:'`',Semicolon:';',Quote:"'",Comma:',',Period:'.',Slash:'/',Backslash:'\\',BracketLeft:'[',BracketRight:']',Minus:'-',Equal:'=',Tab:'TAB',Enter:'ENTER',Backspace:'⌫'};return m[code]||code.replace(/^(Key|Digit|Numpad)/,'');}
// Keys the game already uses; they can't be the replay key.
export const RESERVED=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyJ','KeyH','KeyR','KeyM','ShiftLeft','ShiftRight','Escape','Tab','Enter'];

// ESPN-style replay layer: letterbox, bug, slow-mo tag, lower-third play summary, scrub bar and a wipe on every camera cut.
export function ReplayUi({r,keyName,onExit}:{r:ReplayView;keyName:string;onExit:()=>void}){
 const pct=Math.min(100,r.t/r.dur*100),slow=!r.paused&&r.rate<.9,mode=r.user===null?'AUTO SLO-MO':'×'+r.user;
 return <div className="rp" role="region" aria-label="Instant replay">
  <div className="rp-bar top"/><div className="rp-bar bottom"/>
  <div key={r.cutId} className="rp-wipe"/>
  <div className="rp-bug"><b>▶</b>INSTANT REPLAY</div>
  {(slow||r.paused)&&<div className="rp-slow">{r.paused?'PAUSED':'SLO-MO ×'+r.rate.toFixed(2)}</div>}
  <div className="rp-lower">
   <div className="rp-tag">{r.bailed?'WIPEOUT':'THE PLAY'}</div>
   <h2>{r.bailed?'WIPEOUT':(r.trick||'RUN')}</h2>
   <div className="rp-sub">{r.landing||' '}</div>
   <div className="rp-stats"><span><small>SPEED</small><b>{r.kmh}</b> km/h</span><span><small>AIR</small><b>{r.air.toFixed(1)}</b> m</span><span><small>BIGGEST AIR</small><b>{r.peak.toFixed(1)}</b> m</span><span><small>POINTS</small><b>{r.score.toLocaleString()}</b></span></div>
  </div>
  <div className="rp-scrub" aria-hidden="true"><i style={{width:pct+'%'}}/>{Array.from({length:Math.max(0,r.cuts-1)},(_,i)=><u key={i} style={{left:((i+1)*3.2/r.dur*100)+'%'}}/>)}<em>{r.cam.toUpperCase()} CAM</em></div>
  <div className="rp-help"><span><kbd>←</kbd><kbd>→</kbd> Scrub</span><span><kbd>↑</kbd><kbd>↓</kbd> Speed: {mode}</span><span><kbd>SPACE</kbd> Pause</span><span><kbd>{keyName}</kbd> Exit</span></div>
  <button className="rp-exit" onClick={onExit}>EXIT REPLAY ✕</button>
 </div>;
}
