"use client";
import {HELMETS,CHALLENGES,dropAt,countdown,helmetById,type DropState,type Helmet} from './drops';

// Simple vector helmet for cards: dome, stripes, goggle lens and ear pad.
export function HelmetArt({h,size=120}:{h:Helmet;size?:number}){
 const shine=h.finish==='chrome'?'#ffffff':'#ffffff55';
 return <svg viewBox="0 0 120 100" width={size} height={size*100/120} role="img" aria-label={h.name} className="helmet-art">
  <defs><linearGradient id={'g'+h.id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={shine} stopOpacity={h.finish==='chrome'?.9:.35}/><stop offset=".45" stopColor={h.shell}/><stop offset="1" stopColor={h.shell}/></linearGradient></defs>
  <path d="M14 66 C10 30 36 8 64 8 C94 8 112 30 108 66 Z" fill={h.shell}/><path d="M14 66 C10 30 36 8 64 8 C94 8 112 30 108 66 Z" fill={`url(#g${h.id})`}/>
  <path d="M46 10 C40 30 40 52 46 66" stroke={h.stripe} strokeWidth="7" fill="none" strokeLinecap="round"/><path d="M68 8 C64 30 64 52 70 66" stroke={h.stripe} strokeWidth="7" fill="none" strokeLinecap="round"/>
  <path d="M10 50 L28 40 L108 40 L112 66 L14 66 Z" fill={h.accent} opacity=".95"/><path d="M12 52 C40 44 80 44 110 52 L111 64 L14 64 Z" fill="#14181a"/><path d="M16 53 C42 47 80 47 106 53 L107 62 L18 62 Z" fill={h.lens}/>
  <ellipse cx="20" cy="74" rx="9" ry="12" fill="#15191b"/>
 </svg>;
}

const UNIT:Record<string,string>={air:' m',spin:'°',speed:' km/h',race:' s',combo:' pts'};
export function ChallengesPage({now,state,unlocked,equipped,onEquip}:{now:number;state:DropState;unlocked:string[];equipped?:string;onEquip:(id?:string)=>void}){
 const cur=dropAt(now),next=dropAt(cur.end+1),h=helmetById(cur.drop.helmet)!,nh=helmetById(next.drop.helmet)!;
 const st=state.week===cur.week?state:{...state,values:{},done:[]},have=unlocked.includes(h.id),total=cur.drop.challenges.length,doneN=st.done.length;
 return <section className="menu-sheet chal-page"><div className="section-title"><span className="eyebrow">LIMITED TIME · NEW DROP EVERY MONDAY</span><h1>Challenges</h1><p>Finish all three before the clock runs out to keep the helmet forever. Miss it and it rotates back in a few weeks.</p></div>
  <div className="chal-grid"><article className={'drop-card'+(have?' owned':'')}>
   <div className="drop-art"><HelmetArt h={h} size={190}/><span className="drop-brand">{h.brand}</span></div>
   <div className="drop-body"><span className="drop-tag">{have?'UNLOCKED':'LIVE NOW · ENDS IN '+countdown(cur.end-now).toUpperCase()}</span><h2>{h.name}</h2><p>{h.desc}</p>
    <ul className="chal-list">{cur.drop.challenges.map(id=>{const c=CHALLENGES[id],v=st.values[id]||0,ok=st.done.includes(id)||have,pct=c.mode==='min'?(ok?100:0):Math.min(100,v/c.goal*100),u=UNIT[c.feat]||'';
     return <li key={id} className={ok?'done':''}><span className="chal-check">{ok?'✓':''}</span><div><b>{c.title}</b><small>{ok?'Complete':c.mode==='min'?(st.values[id]!==undefined?'Best '+st.values[id].toFixed(1)+u+' · target '+c.goal+u:'Target '+c.goal+u):(c.mode==='count'?v+' / '+c.goal:Math.round(v)+u+' / '+c.goal+u)}</small><i style={{width:pct+'%'}}/></div></li>;})}</ul>
    <div className="drop-foot"><span>{have?total+'/'+total:doneN+'/'+total} challenges</span>{have&&<button className="buy" onClick={()=>onEquip(equipped===h.id?undefined:h.id)}>{equipped===h.id?'EQUIPPED · TAP TO REMOVE':'EQUIP HELMET'}<span>↗</span></button>}</div></div></article>
   <aside className="chal-side"><div className="settings-card"><h2>Coming next</h2><div className="next-drop"><HelmetArt h={nh} size={90}/><div><b>{nh.name}</b><small>Starts in {countdown(cur.end-now)}</small></div></div></div>
    <div className="settings-card"><h2>Your vault <small>{unlocked.length}/{HELMETS.length}</small></h2>{unlocked.length===0?<p className="small-print">No limited helmets yet. Complete a drop to start your collection.</p>:unlocked.map(id=>{const x=helmetById(id);return x?<div className="friend-row" key={id}><HelmetArt h={x} size={46}/><span>{x.name}<small>{x.brand}</small></span><button onClick={()=>onEquip(equipped===id?undefined:id)}>{equipped===id?'REMOVE':'EQUIP'}</button></div>:null;})}</div></aside></div></section>;
}
