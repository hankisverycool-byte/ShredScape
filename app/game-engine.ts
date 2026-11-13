import {createMountain3D} from './renderer3d';
import {featuresNear,groundHeight,regionAt,LOCATIONS,BOUNDS} from './world';
import {emptyTrick,landingResult,advanceHeading,travel,advanceAirTrick,JUMP} from './tricks';
export type Outfit={jacket:string;pants:string;hat:string;gear:'snowboard'|'skis';avatar?:'explorer'|'classic'};
export type RiderMotion={spin:number;flip:number;pushPhase:number;pushPower:number;grab:number};
export type Peer={id:string;name:string;x:number;y:number;z:number;angle:number;outfit:Outfit;score:number;motion?:RiderMotion};
export type GameSnapshot={score:number;best:number;combo:number;multiplier:number;trick:string;speed:number;airborne:boolean;distance:number;bailed:boolean;playing:boolean;x:number;y:number;z:number;angle:number;region?:string;creditsEarned?:number;landing?:string;spin?:number;flip?:number;landingReady?:boolean;grab?:number;pushPhase?:number;pushPower?:number};
export type GameSettings={quality:'low'|'high';fov:number;sensitivity:number;cameraDistance:number};
export function createGame(canvas:HTMLCanvasElement,onUpdate:(s:GameSnapshot)=>void){
 const mountain=createMountain3D(canvas);let outfit:Outfit={jacket:'#bb633e',pants:'#303e43',hat:'#343c40',gear:'snowboard'};
 let x=0,y=0,z=0,vz=0,speed=0,angle=0,score=0,best=0,combo=0,multiplier=1,clock=0,bail=0,grace=1,totalDistance=0,creditsEarned=0;
 let playing=false,destroyed=false,raf=0,last=performance.now(),pub=0,featureTime=0,jumpCooldown=0,bankTime=0,pushPhase=0,pushPower=0;
 let trick='Choose your own line.',landing='',view='start',settings:GameSettings={quality:'high',fov:65,sensitivity:1,cameraDistance:10};
 let tricks=emptyTrick(),features=featuresNear(x,y),peers:Peer[]=[],visualPeers:Peer[]=[];
 const pressed=new Set<string>(),particles:{x:number;y:number;z:number;size:number;life:number}[]=[];
 try{best=Number(localStorage.getItem('shredscape-best'))||0;}catch{}
 const emit=()=>onUpdate({score,best,combo,multiplier,trick,speed:Math.round(speed*.18),airborne:z>0,distance:Math.round(totalDistance/10),bailed:bail>0,playing,x,y,z,angle,region:regionAt(x,y),creditsEarned,landing,spin:tricks.spin,flip:tricks.flip,landingReady:landingResult(tricks).clean,grab:pressed.has('grab')&&z>0?1:0,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0});
 function spray(n:number){for(let i=0;i<n;i++)particles.push({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*20,z:Math.random()*12,size:2+Math.random()*4,life:.3+Math.random()*.5});if(particles.length>110)particles.splice(0,particles.length-110);}
 function jump(ramp=false){if(!playing||z>0||bail||jumpCooldown)return;z=1;vz=ramp?JUMP.ramp:JUMP.pop;tricks=emptyTrick();combo=0;multiplier=1;bankTime=0;landing='';trick=ramp?'BIG AIR':'AIR TIME';spray(8);}
 function wipeout(){bail=1;speed*=.4;z=0;vz=0;combo=0;multiplier=1;trick='Wipeout · unbanked combo lost';landing='Missed landing';tricks=emptyTrick();spray(24);}
 function land(){const result=landingResult(tricks);z=0;vz=0;jumpCooldown=.25;if(!result.clean){wipeout();return;}combo=result.base;multiplier=result.multiplier;score+=result.points;creditsEarned+=Math.floor(result.points/100);best=Math.max(best,score);try{localStorage.setItem('shredscape-best',String(best));}catch{}trick=result.names.join(' + ')||'Clean landing';landing=result.points?'BANKED +'+result.points:'Clean landing';bankTime=2.5;grace=.45;spray(12);tricks=emptyTrick();}
 const keys:Record<string,string>={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',KeyJ:'grab',KeyH:'grabtype',KeyR:'restart',ShiftLeft:'boost'};
 function reset(){x=0;y=0;z=0;angle=0;speed=0;score=0;combo=0;multiplier=1;tricks=emptyTrick();bail=0;grace=1;features=featuresNear(x,y);pressed.clear();landing='';emit();}
 function input(action:string,down:boolean){action=keys[action]||action;const already=pressed.has(action);if(down)pressed.add(action);else pressed.delete(action);if(!down||already)return;if(action==='restart'){reset();return;}if(action==='jump')jump();if(z>0){if(action==='grabtype'){const names=['Indy','Mute','Tail grab','Nose grab'];tricks.grab=names[(names.indexOf(tricks.grab)+1)%names.length];}}}
 function keydown(e:KeyboardEvent){if((e.target as HTMLElement)?.matches('input,select,textarea'))return;const a=keys[e.code];if(a&&playing){e.preventDefault();input(a,true);}}
 function keyup(e:KeyboardEvent){if(keys[e.code])input(keys[e.code],false);}
 function blur(){pressed.clear();}
 window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);
 function update(dt:number){clock+=dt;if(playing){jumpCooldown=Math.max(0,jumpCooldown-dt);grace=Math.max(0,grace-dt);bankTime=Math.max(0,bankTime-dt);if(bankTime===0&&z===0){combo=0;multiplier=1;}
 if(bail>0){bail=Math.max(0,bail-dt);if(!bail)grace=1.8;}else{
 const steer=Number(pressed.has('right'))-Number(pressed.has('left'));const wasAirborne=z>0;if(!wasAirborne)angle=advanceHeading(angle,steer,dt,settings.sensitivity);
 // Push and gravity act along heading. Holding brake comes to a complete stop.
 const slope=(groundHeight(x+Math.sin(angle)*30,y+Math.cos(angle)*30)-groundHeight(x,y))/1.5;
 const pushing=!wasAirborne&&pressed.has('up');pushPower+=((pushing?1:0)-pushPower)*Math.min(1,dt*12);if(pushPower>.01)pushPhase+=dt*(outfit.gear==='skis'?7.5:6);const push=pushing?145:0;const downhill=-slope*95;
 const drag=pressed.has('down')?260:24+Math.abs(speed)*.13;
 if(!wasAirborne)speed=Math.max(0,Math.min(pressed.has('boost')?420:310,speed+(push+downhill-drag)*dt));
 if(!pressed.has('up')&&speed<3)speed=0;
 const before={x,y};const next=travel(x,y,angle,speed,dt);x=Math.max(BOUNDS.minX,Math.min(BOUNDS.maxX,next.x));y=Math.max(BOUNDS.minY,Math.min(BOUNDS.maxY,next.y));totalDistance+=Math.hypot(x-before.x,y-before.y);
 if(x!==next.x||y!==next.y){speed=0;trick='Mountain boundary · turn around or open the map';}
 if(z>0){vz-=JUMP.gravity*dt;z+=vz*dt;tricks=advanceAirTrick(tricks,steer,Number(pressed.has('down'))-Number(pressed.has('up')),dt);if(pressed.has('grab'))tricks.grabTime+=dt;const preview=landingResult(tricks);combo=preview.base;multiplier=preview.multiplier;trick=preview.names.join(' + ')||'AIR TIME';if(z<=0)land();}
 else if(speed>40&&steer&&Math.random()<.5)spray(2);
 featureTime+=dt;if(featureTime>.5){featureTime=0;features=featuresNear(x,y);}
 for(const f of features){const d=Math.hypot(x-f.x,y-f.y);if(f.kind==='ramp'&&d<30&&z===0&&speed>65&&Math.cos(angle)>.35){jump(true);break;}if(f.kind==='rail'&&d<22&&z<16&&speed>35){z=20;vz=90;tricks=emptyTrick();tricks.grinding=true;trick='50–50 grind';grace=1;break;}if((f.kind==='tree'||f.kind==='rock')&&d<10*f.size&&z<12&&!grace){wipeout();break;}}
 }}
 for(let i=particles.length-1;i>=0;i--){particles[i].life-=dt;particles[i].z+=dt*12;if(particles[i].life<0)particles.splice(i,1);}
 visualPeers=peers.map(p=>{const old=visualPeers.find(v=>v.id===p.id);if(!old||Math.hypot(old.x-p.x,old.y-p.y)>400)return p;return{...p,x:old.x+(p.x-old.x)*Math.min(1,dt*9),y:old.y+(p.y-old.y)*Math.min(1,dt*9),z:old.z+(p.z-old.z)*Math.min(1,dt*9)};});
 pub+=dt;if(pub>.1){pub=0;emit();}
 }
 function frame(now:number){if(destroyed)return;const dt=Math.min(.04,(now-last)/1000);last=now;update(dt);mountain.draw({x,y,z,angle,speed,clock,bail,pushPhase,pushPower:playing&&z===0&&!bail?pushPower:0,spin:tricks.spin,flip:tricks.flip,grab:pressed.has('grab')&&z>0?1:0,playing,outfit,features,peers:visualPeers,particles,view,settings});raf=requestAnimationFrame(frame);}
 raf=requestAnimationFrame(frame);emit();
 return{start(){playing=true;view='game';emit();},pause(){playing=false;pushPower=0;pressed.clear();emit();},reset,input,setOutfit(o:Outfit){outfit={...o};},setPeers(p:Peer[]){peers=p;},setView(v:string){view=v;},setSettings(s:GameSettings){settings=s;},travel(id:string){const dest=LOCATIONS.find(p=>p.id===id);if(!dest)return;x=dest.x;y=dest.y;z=0;speed=0;angle=0;bail=0;grace=1;combo=0;tricks=emptyTrick();features=featuresNear(x,y);emit();},destroy(){destroyed=true;cancelAnimationFrame(raf);mountain.destroy();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);}};
}
