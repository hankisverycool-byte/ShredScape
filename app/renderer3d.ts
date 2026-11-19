import * as T from 'three';
import {createModelAssets} from './model-assets';
import {kitById} from './kits';
import {kickerShape,kickerSurface,kickerBack,railShape,onRail} from './park';
import {COURSE} from './race';
import {computePose,blendPose,pushWeight,type PoseIn,type PoseOut,type Arm} from './rig-pose';
import {GRABS} from './tricks';
import {solveLeg,type Rig,type Leg} from './rig';
import type {Outfit,Peer,GameSettings} from './game-engine';
import {groundHeight,LANDMARKS,LIFTS,BOUNDS,BARRIER_X,WORLD_X,onTrail,zoneAt,forestAt,type Lift} from './world';
type Feature={kind:string;x:number;y:number;size:number;id:string;seed:number};
type Frame={landSeq?:number;landYaw?:number;qx?:number;qy?:number;qz?:number;qw?:number;tuckAmt?:number;extAmt?:number;gtKind?:string;gtAmt?:number;balance?:number;stumble?:number;edgeAngle?:number;crash?:{kind:string;fx:number;fy:number;power:number;lean:number;side:number;tilt:number}|null;cross?:number;scissor?:number;grabStyle?:number;hour?:number;soft?:number;cam?:{mode:string;id:number;t:number};tuck?:number;lift?:number;rail?:boolean;fakie?:boolean;course?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string;view:string;settings:GameSettings;x:number;y:number;z:number;angle:number;speed:number;pushPhase:number;pushPower:number;clock:number;bail:number;spin:number;flip:number;grab:number;playing:boolean;outfit:Outfit;features:Feature[];peers:Peer[];particles:{x:number;y:number;z:number;size:number;life:number}[]};
const S=.05;
const hash=(n:number)=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
// Heights are drawn in scene metres. Engine heights are in engine units (the same scale as x and y), so a metre of scene height is groundHeight*S; VERT exaggerates the
// terrain relief a little (a true 1-3% run would look flat) while everything the rider touches (skis, kickers, jump heights) stays in true proportion to the rider.
const VERT=6;
const ground=(x:number,y:number)=>groundHeight(x,y)*S*VERT;
export function createMountain3D(canvas:HTMLCanvasElement){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#accbd2');
 let assetRevision=0,seenAssetRevision=0;const models=createModelAssets(()=>assetRevision++);
 // Daylight by hour (7:00 and 19:00 match, so the cycle loops without a jump): warm low sun at the ends, bright white at midday, gold in the afternoon.
 const KEYS:{h:number;sky:string;hemi:string;hemiI:number;sun:string;sunI:number}[]=[
  {h:7,sky:'#cfb4b0',hemi:'#f2dcd6',hemiI:1.5,sun:'#ffb283',sunI:1.2},{h:9,sky:'#b6d3dc',hemi:'#e9faff',hemiI:2.05,sun:'#fff0dd',sunI:2.2},
  {h:12.5,sky:'#accbd2',hemi:'#e9faff',hemiI:2.3,sun:'#fffaf0',sunI:2.8},{h:16,sky:'#bfd0da',hemi:'#eef4fa',hemiI:2.0,sun:'#ffe6c4',sunI:2.35},
  {h:18,sky:'#d4b4a6',hemi:'#f4dad0',hemiI:1.6,sun:'#ff9d68',sunI:1.6},{h:19,sky:'#cfb4b0',hemi:'#f2dcd6',hemiI:1.5,sun:'#ffb283',sunI:1.2}];
 const cA=new T.Color(),cB=new T.Color(),LIGHT={sky:new T.Color(),hemiSky:new T.Color(),sun:new T.Color(),hemi:2,sunI:2,dx:25,dy:45};
 function light(h:number){let i=0;while(i<KEYS.length-2&&h>KEYS[i+1].h)i++;const a=KEYS[i],b=KEYS[i+1],u=Math.max(0,Math.min(1,(h-a.h)/(b.h-a.h)));
  LIGHT.sky.copy(cA.set(a.sky).lerp(cB.set(b.sky),u));LIGHT.hemiSky.copy(cA.set(a.hemi).lerp(cB.set(b.hemi),u));LIGHT.sun.copy(cA.set(a.sun).lerp(cB.set(b.sun),u));
  LIGHT.hemi=a.hemiI+(b.hemiI-a.hemiI)*u;LIGHT.sunI=a.sunI+(b.sunI-a.sunI)*u;const t=(h-7)/12;LIGHT.dx=Math.cos(Math.PI*(1-t))*45;LIGHT.dy=14+34*Math.sin(Math.PI*t);return LIGHT;}
 const scene=new T.Scene();scene.fog=new T.Fog('#accbd2',200,1300);
 const camera=new T.PerspectiveCamera(57,1,.1,3200);
 const hemi=new T.HemisphereLight('#e9faff','#8aa3b9',2.2);scene.add(hemi);
 const sun=new T.DirectionalLight('#ffe9b9',2.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-35;sun.shadow.camera.right=35;sun.shadow.camera.top=35;sun.shadow.camera.bottom=-35;sun.shadow.camera.far=120;sun.shadow.bias=-.001;scene.add(sun,sun.target);
 const materials=new Map<string,T.MeshStandardMaterial>();
 function mat(c:string){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:1,flatShading:true}));return materials.get(c)!;}
 const boxGeo=new T.BoxGeometry(1,1,1),coneGeo=new T.ConeGeometry(1,1,7),sphereGeo=new T.IcosahedronGeometry(1,0);
 function mesh(g:T.BufferGeometry,c:string,parent:T.Object3D,pos:number[],scale:number[]){const m=new T.Mesh(g,mat(c));m.position.set(pos[0],pos[1],pos[2]);m.scale.set(scale[0],scale[1],scale[2]);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 function box(p:T.Object3D,c:string,x:number,y:number,z:number,w:number,h:number,d:number){return mesh(boxGeo,c,p,[x,y,z],[w,h,d]);}
 function label(text:string){const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#20372ee8';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#e1c28c';ctx.lineWidth=5;ctx.strokeRect(5,5,502,86);ctx.fillStyle='#f1e5c7';ctx.textAlign='center';ctx.font='bold 29px Georgia';ctx.fillText(text,256,58);const tex=new T.CanvasTexture(c);tex.magFilter=T.NearestFilter;const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,depthTest:true}));sprite.scale.set(6,1.125,1);return sprite;}
 function tree(parent:T.Object3D,size:number,seed=0){const imported=models.tree(seed);if(imported){imported.scale.setScalar(size);parent.add(imported);return;}box(parent,'#705b43',0,1,0,.3,2,.3);for(let i=0;i<3;i++){mesh(coneGeo,i%2?'#375d51':'#2b4e43',parent,[0,1.6+i*.9,0],[(1.6-i*.35)*size,2*size,(1.6-i*.35)*size]);mesh(coneGeo,'#e3eee7',parent,[0,2.05+i*.9,0],[(1.24-i*.27)*size,1.35*size,(1.24-i*.27)*size]);}}
 function cabin(parent:T.Object3D){box(parent,'#856448',0,1.5,0,7,3,5);box(parent,'#af8c61',0,.3,2.8,8,.6,1.4);const roof=mesh(new T.CylinderGeometry(0,5,2.4,4), '#dce8df',parent,[0,4,0],[1.15,1,.85]);roof.rotation.y=Math.PI/4;box(parent,'#423e35',0,1,2.54,1.1,2,.12);for(const x of [-2.2,2.2]){box(parent,'#f5cf78',x,1.7,2.55,1.1,1,.12);box(parent,'#433c30',x,1.7,2.65,.1,1,.1);}box(parent,'#716e60',2,4.5,-1,.65,2,.65);}
 function sign(parent:T.Object3D,title:string){box(parent,'#897352',0,1.5,0,.18,3,.18);const l=label(title);l.position.set(0,3,0);parent.add(l);}
 const world=new T.Group();scene.add(world);let chunks=new Map<number,T.Group>();let featureMap=new Map<string,T.Group>();
 const C_ON=[new T.Color('#eef4fa'),new T.Color('#e3ecf4')],C_PARK=new T.Color('#f7fbff'),C_OFF=new T.Color('#d4e3ef'),C_FOREST=new T.Color('#a9c9b7'),C_ROCK=new T.Color('#8f9fa3'),C_ICE=new T.Color('#c3e4ec'),_c=new T.Color();
 // Terrain chunk: 1000 engine units of mountain, the full width of the world. Colour says what the snow is: groomed, park, off-piste, forest, bare rock on the steeps, ice.


 // ---- Snow: soft smooth-shaded ground with fine noise, sastrugi streaks, bluer hollows and a micro-relief bump texture that catches the sun. ----
 const vn=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),h=(a:number,b:number)=>hash(a*127+b*311+17);return (h(ix,iy)*(1-sx)+h(ix+1,iy)*sx)*(1-sy)+(h(ix,iy+1)*(1-sx)+h(ix+1,iy+1)*sx)*sy;};
 const snowBump=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d')!,im=g.createImageData(256,256);
  for(let j=0;j<256;j++)for(let i=0;i<256;i++){const v=.5*vn(i/16,j/16)+.3*vn(i/6,j/6)+.2*vn(i/2.2,j/2.2),sp=hash(i*13+j*57)>.985?.35:0,k=Math.max(0,Math.min(255,(v+sp)*255)),o=(j*256+i)*4;im.data[o]=im.data[o+1]=im.data[o+2]=k;im.data[o+3]=255;}
  g.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(110,34);t.anisotropy=4;return t;})();
 const SNOW_SHADE=new T.Color('#a9c4de'),SNOW_WARM=new T.Color('#fafdff');
 // ---- Distant mountains: low-poly ranges rising out of the haze on both sides and at either end of the course. ----
 const peakVariants=[0,1,2,3].map(v=>{const g=new T.ConeGeometry(1,1,7,1,false);const p=g.attributes.position,col:number[]=[],c=new T.Color();
  for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<.49){p.setX(i,p.getX(i)*(1+(hash(i*7+v*31)-.5)*.5));p.setZ(i,p.getZ(i)*(1+(hash(i*11+v*17)-.5)*.5));}p.setY(i,y+(y>.49?(hash(v+3)-.3)*.12:0));
   const t=Math.max(0,Math.min(1,(y+.5)));c.set('#5f7690').lerp(c.clone().set('#9fb4c6'),Math.min(1,t*1.3));if(t>.62)c.set('#f6fafc');col.push(c.r,c.g,c.b);}
  g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeVertexNormals();g.userData.assetShared=true;return g;});
 const peakMat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1});peakMat.userData.assetShared=true;
 const farMat=new T.MeshStandardMaterial({vertexColors:true,roughness:1});farMat.userData.assetShared=true;
 function buildDistant(group:T.Group,chunk:number){const start=chunk*1000;
  // open flat ground out to the foothills (no walls), then the peaks
  for(const side of [-1,1]){const w=8000,geo=new T.PlaneGeometry(w*S,50,10,12);geo.rotateX(Math.PI/2);const a=geo.attributes.position,cs:number[]=[];
   for(let i=0;i<a.count;i++){const yy=start+(a.getZ(i)+25)/S,gx=side*(WORLD_X+w/2+(a.getX(i)/S)*0),h=ground(side*WORLD_X,yy),k=Math.max(0,Math.min(1,Math.abs(a.getX(i)/S+w/2)/w));a.setY(i,h-k*14*0);a.setX(i,side*(WORLD_X*S+(a.getX(i)+w*S/2)));a.setZ(i,-yy*S);void gx;_c.set('#eef4f6').lerp(_c.clone().set('#d6e3ec'),k);cs.push(_c.r,_c.g,_c.b);}
   geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const m=new T.Mesh(geo,farMat);m.receiveShadow=false;group.add(m);
   for(let i=0;i<3;i++){const hs=hash(chunk*53+i*7+(side>0?3:0)),x=side*(11500+hash(hs*91)*4500+i*900),y=start+hash(hs*17)*1000,sc=90+hash(hs*5)*110,mm=models.mountain();
    if(mm){const w=260+hash(hs*5)*160;mm.position.set(x*S,ground(side*WORLD_X,y)-6,-y*S);mm.scale.set(w,w*.95,w);mm.rotation.y=hash(hs*9)*6.28;group.add(mm);}
    else{const peak=new T.Mesh(peakVariants[(i+chunk+(side>0?1:0)+4000)%4],peakMat);peak.position.set(x*S,ground(side*WORLD_X,y)+sc*.35,-y*S);peak.scale.set(sc*.95,sc*1.15+hash(hs*3)*50,sc*.95);peak.castShadow=false;group.add(peak);}}}
  if(chunk<=-1||chunk>=17)for(let i=-7;i<=7;i++){const hs=hash(chunk*19+i),y=chunk<=-1?-7500-hash(hs)*1500:BOUNDS.maxY+7500+hash(hs)*1500,sc=110+hash(hs*3)*120,mm=models.mountain(),px=(i*1700+hash(hs*7)*800)*S,gy=ground(0,chunk<=-1?-1000:BOUNDS.maxY);
   if(mm){const w=420+hash(hs*5)*520;mm.position.set(px,gy-6,-y*S);mm.scale.set(w,w*1.3,w);mm.rotation.y=hash(hs*9)*6.28;group.add(mm);}
   else{const peak=new T.Mesh(peakVariants[(i+8)%4],peakMat);peak.position.set(px,gy+sc*.3,-y*S);peak.scale.set(sc*1.1,sc*1.2+hash(hs*5)*60,sc*1.1);peak.castShadow=false;group.add(peak);}}}
 // ---- Barriers and the crowd: padded panels along both sides of the course, spectators standing on the stands behind them. ----
 const crowdGeoB=new T.CapsuleGeometry(.28,.55,2,6),crowdGeoH=new T.SphereGeometry(.2,6,5);crowdGeoB.userData.assetShared=true;crowdGeoH.userData.assetShared=true;
 const crowdMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.9,flatShading:true}),headMat=new T.MeshStandardMaterial({color:'#ffffff',roughness:.8,flatShading:true});crowdMat.userData.assetShared=true;headMat.userData.assetShared=true;
 const SHIRTS=['#d6453b','#2f6fd1','#e8c24a','#3fae5a','#f2f2f2','#ed9a6c','#8a4bd1','#22303a','#ff7aa8','#35c5c5'],SKIN=['#f1c9a5','#d9a47a','#b57d54','#8a5a3b','#6b4430'],PANELS=['#f4f4f0','#d6453b','#2f6fd1','#e8c24a'];
 type Crowd={b:T.InstancedMesh;h:T.InstancedMesh;x:Float32Array;y:Float32Array;g:Float32Array;ph:Float32Array;sc:Float32Array;yw:Float32Array;n:number};
 const crowds=new Map<number,Crowd>(),_cd=new T.Object3D(),_cc=new T.Color();
 function buildBarriers(group:T.Group,chunk:number){const start=chunk*1000,PAN=80;
  for(const side of [-1,1])for(let y=start;y<start+1000;y+=PAN){const yy=y+PAN/2;if(yy<BOUNDS.minY||yy>BOUNDS.maxY)continue;const gy=ground(side*BARRIER_X,yy),k=Math.floor(y/PAN)+(side>0?2:0);
   box(group,PANELS[k%PANELS.length],side*BARRIER_X*S,gy+.55,-yy*S,.2,1.1,PAN*S*.97);box(group,'#262c31',side*BARRIER_X*S,gy+.2,-yy*S,.24,.4,PAN*S*.97);
   if(k%4===0){const sg=box(group,PANELS[(k/4+1)%PANELS.length],side*(BARRIER_X+10)*S,gy+1.9,-yy*S,.1,1.1,PAN*S*.9);sg.castShadow=false;box(group,'#262c31',side*(BARRIER_X+10)*S,gy+.9,-yy*S,.12,1.2,.12);}}
  // the crowd: three rows behind each barrier, packed together, in bright jackets
  const per:{x:number;y:number;sc:number;yaw:number}[]=[];for(const side of [-1,1])for(let cl=0;cl<5;cl++){const cs=chunk*911+cl*53+(side>0?7:0);if(hash(cs)<.35)continue; // some stretches stay empty
   const cy=start+cl*200+hash(cs*3)*120,cnt=6+Math.floor(hash(cs*5)*9),len=30+hash(cs*7)*50;
   for(let i=0;i<cnt;i++){const h0=hash(cs*97+i*13),h1=hash(h0*991+i),y=cy+(h0-.5)*len,x=side*(BARRIER_X+30+Math.floor(h1*2.6)*24+hash(h1*77)*12);if(y<BOUNDS.minY||y>BOUNDS.maxY)continue;per.push({x,y,sc:.85+hash(h1*31)*.3,yaw:(hash(h0*53)-.5)*1.1});}}
  if(!per.length)return;const n=per.length,b=new T.InstancedMesh(crowdGeoB,crowdMat,n),hd=new T.InstancedMesh(crowdGeoH,headMat,n),c:Crowd={b,h:hd,x:new Float32Array(n),y:new Float32Array(n),g:new Float32Array(n),ph:new Float32Array(n),sc:new Float32Array(n),yw:new Float32Array(n),n};
  per.forEach((q,i)=>{c.sc[i]=q.sc;c.yw[i]=q.yaw;c.x[i]=q.x;c.y[i]=q.y;c.g[i]=ground(q.x,q.y);c.ph[i]=hash(i*31+chunk)*6.28;b.setColorAt(i,_cc.set(SHIRTS[Math.floor(hash(i*17+chunk*3)*SHIRTS.length)]));hd.setColorAt(i,_cc.set(SKIN[Math.floor(hash(i*29+chunk*5)*SKIN.length)]));});
  b.frustumCulled=false;hd.frustumCulled=false;b.castShadow=false;hd.castShadow=false;group.add(b,hd);crowds.set(chunk,c);animateCrowd(c,0,-1e9);}
 // The crowd cheers: people near the rider hop up and down.
 function animateCrowd(c:Crowd,t:number,ry:number){for(let i=0;i<c.n;i++){const d=Math.abs(c.y[i]-ry),cheer=Math.max(0,1-d/520),bob=Math.abs(Math.sin(t*5.5+c.ph[i]))*.5*cheer+Math.sin(t*1.7+c.ph[i])*.03,gy=c.g[i]+bob;
   _cd.scale.setScalar(c.sc[i]);_cd.position.set(c.x[i]*S,gy+.55*c.sc[i],-c.y[i]*S);_cd.rotation.set(0,(c.x[i]>0?Math.PI/2:-Math.PI/2)+c.yw[i],Math.sin(t*3+c.ph[i])*.08*cheer);_cd.updateMatrix();c.b.setMatrixAt(i,_cd.matrix);
   _cd.position.y=gy+1.3*c.sc[i];_cd.rotation.set(0,0,0);_cd.updateMatrix();c.h.setMatrixAt(i,_cd.matrix);}
  c.b.instanceMatrix.needsUpdate=true;c.h.instanceMatrix.needsUpdate=true;}
 function makeTerrain(chunk:number){const group=new T.Group(),start=chunk*1000,width=(2*WORLD_X+400)*S;const geo=new T.PlaneGeometry(width,50,170,60);geo.rotateX(Math.PI/2);const a=geo.attributes.position;const cs:number[]=[];
 for(let i=0;i<a.count;i++){const xx=a.getX(i)/S,yy=start+(a.getZ(i)+25)/S,h=ground(xx,yy);a.setY(i,h);a.setZ(i,-yy*S);
  const steep=Math.hypot(groundHeight(xx+40,yy)-groundHeight(xx-40,yy),groundHeight(xx,yy+40)-groundHeight(xx,yy-40))/80,z=zoneAt(xx,yy);
  if(onTrail(xx,yy))_c.copy(z&&z.kind==='park'?C_PARK:C_ON[hash(i+chunk)>.82?1:0]);
  else{_c.copy(C_OFF).lerp(C_FOREST,Math.min(1,forestAt(xx,yy)*1.1));}
  if(steep>.055)_c.lerp(C_ROCK,Math.min(.75,(steep-.055)*9)); // bare rock where it is too steep for snow to stay
  // snow character: fine noise, streaks running downhill, hollows go blue-grey, windswept crests go warm and bright
  {const k=1+.035*(vn(xx*.012,yy*.0035)-.5)+.03*(vn(xx*.05,yy*.012)-.5)+.02*(vn(xx*.2,yy*.05)-.5),cv=(ground(xx+40,yy)+ground(xx-40,yy)+ground(xx,yy+40)+ground(xx,yy-40))/4-h;
   _c.multiplyScalar(k);if(cv>0)_c.lerp(SNOW_SHADE,Math.min(.3,cv*4.5));else _c.lerp(SNOW_WARM,Math.min(.1,-cv*2.5));}
  cs.push(_c.r,_c.g,_c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const terrain=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:0,bumpMap:snowBump,bumpScale:1.4}));terrain.receiveShadow=true;group.add(terrain);
 const rel=(x:number,y:number,x0:number,y0:number)=>ground(x,y)-ground(x0,y0);
 for(const lm of LANDMARKS){if(Math.floor(lm.y/1000)!==chunk)continue;const g=new T.Group();g.position.set(lm.x*S,ground(lm.x,lm.y),-lm.y*S);
  if(lm.kind==='village'||lm.kind==='lodge'){
   const n=lm.count||1,cols=Math.min(4,n),real=models.houseCount()>0,sp=real?(lm.kind==='lodge'?0:15):11;for(let i=0;i<n;i++){const c=new T.Group(),cx=(i%cols-(cols-1)/2)*sp,cz=Math.floor(i/cols)*sp*.95-4;c.position.set(cx,rel(lm.x+cx/S,lm.y-cz/S,lm.x,lm.y),cz);c.rotation.y=(hash(i+lm.x)-.5)*.3;
    const hm=lm.kind==='lodge'?models.house(2+Math.floor(hash(lm.x+lm.y)*2)):models.house(hash(i*13+lm.x)>.93?2+Math.floor(hash(i*5+lm.y)*2):Math.floor(hash(i*7+lm.y)*2));
    if(hm){hm.scale.setScalar(lm.kind==='lodge'?2.6:2);hm.rotation.y=Math.floor(hash(i*3+lm.x+lm.y)*4)*Math.PI/2+(hash(i)-.5)*.2;c.add(hm);}else cabin(c);g.add(c);}
   const m=new T.Group();m.position.set(0,0,-9);sign(m,lm.name);g.add(m);
  }else if(lm.kind==='parkgate'){ // an arch over the top of the park with its name on it
   const half=Math.min((lm.r||300)*S*.8,15);for(const sx of [-half,half])box(g,'#c69255',sx,5.2,0,.16,10.4,.16);box(g,'#364e49',0,10.4,0,half*2+.4,.4,.16);const l=label(lm.name);l.scale.set(8,1.5,1);l.position.set(0,11.8,0);g.add(l); // high enough that the chase camera rides under it
  }
  group.add(g);}
 // Lifts: pylons every 600 units with a cable between them.
 for(const L of LIFTS){const len=L.y0-L.y1,pt=(y:number)=>{const k=(L.y0-y)/len;return new T.Vector3((L.x0+(L.x1-L.x0)*k)*S,ground(L.x0+(L.x1-L.x0)*k,y)+10,-y*S);};
  for(let y=L.y1;y<=L.y0;y+=600){if(y<start||y>=start+1000)continue;const p=pt(y);const tw=new T.Group();tw.position.set(p.x,p.y-10,p.z);box(tw,'#536860',0,5,0,.3,10,.3);box(tw,'#52645b',0,10,0,4,.25,.3);group.add(tw);
   const q=pt(Math.min(L.y0,y+600)),mid=p.clone().add(q).multiplyScalar(.5),cable=box(group,'#586961',0,0,0,.04,.04,1);cable.position.copy(mid);cable.scale.z=p.distanceTo(q);cable.lookAt(q);cable.castShadow=false;}}
 buildDistant(group,chunk);
 buildBarriers(group,chunk);
 world.add(group);return group;}
 function disposeGroup(group:T.Object3D){group.traverse(obj=>{if(obj instanceof T.Mesh&&!obj.geometry.userData.assetShared&&![boxGeo,coneGeo,sphereGeo].includes(obj.geometry))obj.geometry.dispose();if(obj instanceof T.Mesh){const list=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of list)if(!m.userData.assetShared&&![...materials.values()].includes(m as T.MeshStandardMaterial))m.dispose();}if(obj instanceof T.SkinnedMesh)obj.skeleton.dispose();if(obj instanceof T.Sprite&&!obj.material.userData.assetShared){obj.material.map?.dispose();obj.material.dispose();}});group.removeFromParent();}
 function makeFeature(f:Feature){const g=new T.Group();g.position.set(f.x*S,ground(f.x,f.y),-f.y*S);
 if(f.kind==='tree')tree(g,f.size,f.seed);else if(f.kind==='rock')mesh(sphereGeo,'#7c918a',g,[0,.4,0],[1.1*f.size,.8*f.size,.9*f.size]);
 else if(f.kind==='ramp'){
 // Snow kicker: a solid mound pushed up out of the hillside. Face to the lip, rounded top, back sloping down, sides rolling into the slope.
 const k=kickerShape(f),g0=ground(f.x,f.y),back=kickerBack(f),y0=k.start-k.run*.15,y1=k.lip+back,NX=24,NY=Math.max(16,Math.round((y1-y0)/9)),pos:number[]=[],idx:number[]=[];
 for(let j=0;j<=NY;j++)for(let i=0;i<=NX;i++){const lx=(i/NX*2-1)*k.half*1.05,wy=y0+j/NY*(y1-y0),lift=kickerSurface(f,f.x+lx,wy);pos.push(lx*S,ground(f.x+lx,wy)-g0+lift*S-.03,-(wy-f.y)*S);}
 for(let j=0;j<NY;j++)for(let i=0;i<NX;i++){const a=j*(NX+1)+i,b2=a+1,c2=a+NX+1,d=c2+1;idx.push(a,c2,b2,b2,c2,d);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();
 const snow=new T.Mesh(geo,mat('#f3f7f5'));snow.material.side=T.DoubleSide;snow.receiveShadow=true;snow.castShadow=true;g.add(snow);
 }
 else if(f.kind==='rail'){
 // Rail or box, pitched to follow the slope under it.
 const r=railShape(f),g0=ground(f.x,f.y),gA=ground(f.x,r.start)-g0,gB=ground(f.x,r.end)-g0,len=r.len*S,h=r.height*S;
 const bar=new T.Group();bar.position.set(0,(gA+gB)/2+h,0);bar.rotation.x=-Math.atan2(gA-gB,len);g.add(bar);
 if(r.box){box(bar,'#eef2f0',0,-.06,0,r.half*2*S,.12,len);for(const sx of [-1,1])box(bar,f.seed%4===1?'#2f6fd1':'#d6453b',sx*r.half*S,-.3,0,.05,.42,len);box(bar,'#3d4a46',0,-h/2-.1,0,r.half*1.2*S,h-.2,len*.9);}
 else{box(bar,'#edb957',0,-.05,0,.16,.1,len);for(const zp of [-.42,0,.42])box(bar,'#53665a',0,-h/2,zp*len,.11,h,.11);}
 }
 else if(f.kind==='gate'){
 // GS gate: two tall slim poles with a pennant on top (so it can be read from a long way off) and a panel flag facing in, alternating red/blue.
 const half=f.size*S/2,c=f.seed%2?'#d6453b':'#2f6fd1';
 for(const sx of [-half,half]){box(g,'#f4f4ec',sx,1.6,0,.07,3.2,.07);box(g,c,sx+(sx<0?.5:-.5),2.4,0,1,.8,.03);box(g,c,sx,3.35,0,.5,.3,.03);}
 }else if(f.kind==='start'||f.kind==='finish'){
 // A normal-sized timing gate: two slim posts, a thin bar, a small timing box and a modest banner. The finish has a checkered bar.
 const half=f.size*S/2,c=f.kind==='start'?'#2f6fd1':'#d6453b';
 for(const sx of [-half,half]){box(g,'#e9e9df',sx,1.6,0,.14,3.2,.14);box(g,c,sx,.5,0,.2,1,.2);}
 if(f.kind==='finish'){const n=Math.round(half*2/.4);for(let i=0;i<n;i++)box(g,i%2?'#111':'#fff',-half+.2+i*.4,3.2,0,.4,.3,.1);}else box(g,c,0,3.2,0,half*2,.16,.1);
 box(g,'#14181a',0,2.7,0,1.3,.5,.18);box(g,'#ff6a2a',0,2.7,.1,.9,.16,.02);const l=label(f.kind==='start'?'START':'FINISH');l.scale.set(3.4,.7,1);l.position.set(0,3.85,0);g.add(l);
 if(f.kind==='start'){ // staging area: a flat approach with a low fence line on either side of the start so you line up before you drop in
  for(const sx of [-1,1])for(let k=0;k<5;k++)box(g,k%2?'#d6453b':'#f4f4f0',sx*(half+1.2),.5,-(k*2.2+2.4),.14,1,2.1);}
 }
 else{box(g,'#8c7652',0,1,0,.07,2,.07);box(g,f.seed%2?'#d89b5d':'#91ae92',.42,1.8,0,.85,.5,.04);}world.add(g);return g;}
 type PoleObj={group:T.Group;shaft:T.Mesh;basket:T.Mesh;tip:T.Mesh;len:number;setLen(l:number):void};
 type Rider={imported:ReturnType<ReturnType<typeof createModelAssets>['rider']>;rig:Rig;hipRestY:number;root:T.Group;stunt:T.Group;body:T.Group;armL:T.Group;armR:T.Group;legL:T.Group;legR:T.Group;kneeL:T.Group;kneeR:T.Group;elbowL:T.Group;elbowR:T.Group;skiL:T.Group;skiR:T.Group;signature:string;lastAngle:number;lastTime:number;lean:number;gear:Outfit['gear'];equipment:T.Object3D[];rag:Rag|null;land:number;airStart:number;wasAir:boolean;edgeSign:number;release:number;boardG:T.Group;lastLand?:number;tiltP?:number;tiltR?:number;bodyY?:number;qs:T.Quaternion;grabW:number;grabErr:number;bikeG:T.Group;bikePivot:T.Group;contact:number;normals:T.Vector3[];torso:T.Group;poles:PoleObj[];pp:PoseOut|null;lastX:number;lastY:number;speedEst:number};
 type Rag={start:number;tumble:number;tumbleV:number;yaw:number;yawV:number;h:number;hV:number;seed:number};
 type Debris={obj:T.Object3D;owner:Rider;vel:T.Vector3;spin:T.Vector3};const debris:Debris[]=[];
 const outfitAvatar=(o:Outfit)=>o.avatar||'explorer';
 // Ski poles: shared geometry, built per hand. Style is a wardrobe option (none / carbon / kit colour).
 const poleGeo=new T.CylinderGeometry(.022,.022,1,6),basketGeo=new T.CylinderGeometry(.1,.07,.02,10),tipGeo=new T.ConeGeometry(.022,.07,5),gripGeo=new T.CylinderGeometry(.04,.036,.26,8);
 for(const g of [poleGeo,basketGeo,tipGeo,gripGeo])g.userData.assetShared=true;
 function makePole(style:'carbon'|'kit',accent:string,hand:T.Object3D):PoleObj{
  const group=new T.Group();hand.add(group);
  const shaft=new T.Mesh(poleGeo,mat(style==='kit'?accent:'#2c3236')),basket=new T.Mesh(basketGeo,mat('#1c2225')),tip=new T.Mesh(tipGeo,mat('#9aa3a0')),grip=new T.Mesh(gripGeo,mat(style==='kit'?'#1c2225':accent));
  tip.rotation.x=Math.PI;grip.position.y=.04; // the fist closes round the grip; the shaft leaves the bottom of the hand
  for(const m of [shaft,basket,tip,grip]){m.castShadow=true;group.add(m);}
  const pole:PoleObj={group,shaft,basket,tip,len:0,setLen(l){this.len=l;shaft.scale.y=l;shaft.position.y=-l/2;basket.position.y=-(l-.16);tip.position.y=-l-.03;}};
  pole.setLen(1.45);return pole;
 }
 function rider(o:Outfit,name?:string):Rider{
 const root=new T.Group(),stunt=new T.Group(),body=new T.Group();stunt.position.y=1.3;root.add(stunt);body.position.y=-1.3;stunt.add(body);
 // Hand-built faceted silhouette ("classic" rider). Hips, waist and torso hang from `pelvisG` so the pelvis can move with the legs.
 const pelvisG=new T.Group();body.add(pelvisG);
 const torso=new T.Group(),up=new T.Group();torso.position.y=1.25;up.position.y=-1.25;pelvisG.add(torso);torso.add(up);
 const kitX=kitById(o.kit),bag=kitX.style==='freeride'?1.4:kitX.style==='shell'?1.15:.92; // baggy freeride pants, relaxed shell, tight race suit
 const chest=mesh(new T.CylinderGeometry(.43,.285,.84,6),o.jacket,up,[0,1.77,0],[1,1,.61]);chest.rotation.y=Math.PI/6;
 mesh(new T.CylinderGeometry(.29,.31,.18,6),o.jacket,pelvisG,[0,1.30,0],[1,1,.7]);
 if(kitX.style!=='race'){ // long shell hem over the hips, chest seam + zip, shoulder yoke, hood down behind the neck
  mesh(new T.CylinderGeometry(.33,.4,.3,6),o.jacket,pelvisG,[0,1.2,0],[1,1,.74]);
  box(up,kitX.accent,0,1.8,-.255,.035,.78,.02);box(up,kitX.accent,-.2,1.5,-.25,.34,.025,.02);box(up,kitX.accent,.2,1.5,-.25,.34,.025,.02);
  box(up,kitX.accent,0,2.1,-.19,.7,.04,.02);
  const hd=mesh(new T.CylinderGeometry(.2,.26,.2,6),o.jacket,up,[0,2.2,.09],[1,1,.8]);hd.rotation.x=.35;}
 box(pelvisG,'#694334',0,1.22,0,.62,.08,.38);
 mesh(new T.CylinderGeometry(.105,.12,.17,6),'#b99372',up,[0,2.22,0],[1,1,1]);if(kitX.style!=='race')mesh(new T.CylinderGeometry(.14,.16,.12,6),o.jacket,up,[0,2.2,0],[1,1,.9]); // collar
 mesh(new T.SphereGeometry(1,6,4),'#bd9977',up,[0,2.43,0],[.185,.245,.18]);
 box(up,'#30291f',-.069,2.46,-.162,.047,.025,.018);box(up,'#30291f',.069,2.46,-.162,.047,.025,.018);
 mesh(new T.ConeGeometry(.06,.12,4),'#ad8765',up,[0,2.39,-.18],[.7,1,1]).rotation.x=-Math.PI/2;
 mesh(new T.CylinderGeometry(.11,.045,.19,5),'#51442e',up,[0,2.30,-.09],[1,1,.8]);
 mesh(new T.CylinderGeometry(.187,.187,.045,6),o.hat,up,[0,2.52,0],[1,1,1]);
 box(up,'#14181a',0,2.45,-.17,.34,.09,.05);box(up,kitById(o.kit).lens,0,2.45,-.2,.3,.065,.02); // goggles
 function limb(px:number,py:number,c:string,length:number,leg=false){
 const pivot=new T.Group();pivot.position.set(px,py,0);(leg?pelvisG:up).add(pivot);
 const upper=mesh(new T.CylinderGeometry(leg?.19*bag:.18*(bag>1?1.12:1),leg?.135*bag:.115*(bag>1?1.12:1),length*.51,5),c,pivot,[0,-length*.245,0],[1,1,leg?.95:1]);upper.rotation.y=Math.PI/5;
 if(!leg)mesh(new T.CylinderGeometry(.23,.18,.28,5),o.jacket,pivot,[0,-.09,0],[1,1,1]);
 const joint=new T.Group();joint.position.set(0,-length*.49,0);pivot.add(joint);
 mesh(new T.CylinderGeometry(leg?.15*bag:.115*(bag>1?1.12:1),leg?.075*bag+(bag>1?.05:0):.08,length*.47,5),leg?c:(kitX.style==='race'?'#bd9977':o.jacket),joint,[0,-length*.23,0],[1,1,1]);
 if(!leg)mesh(new T.CylinderGeometry(.09,.085,.12,5),o.hat,joint,[0,-length*.41,0],[1,1,1]);
 // Legs end in an ankle group (the foot turns with the ski); arms end in a hand group (glove + pole grip).
 const end=new T.Group();end.position.set(0,leg?-.5:-length*.47,0);joint.add(end);
 if(leg){box(end,'#262b2f',0,-length*.47+.5,-.075,.25,.24,.44);box(end,'#8a949a',0,-length*.47+.4,-.2,.26,.05,.18);}else box(end,kitById(o.kit).glove,0,0,0,.14,.17,.16);
 return {pivot,joint,end};}
 const aL=limb(-.43,2.08,o.jacket,.94),aR=limb(.43,2.08,o.jacket,.94),lL=limb(-.20,1.25,o.pants,1.15,true),lR=limb(.20,1.25,o.pants,1.15,true);
 const mkLeg=(l:typeof lL,side:number):Leg=>({hip:l.pivot,knee:l.joint,ankle:l.end,hipRest:new T.Vector3(side*.2,0,0),r1:new T.Vector3(0,-1,0),r2:new T.Vector3(0,-1,0),L1:1.15*.49,L2:.5,soleOff:new T.Vector3(0,-.1355,-.075)});
 const classicRig:Rig={legs:[mkLeg(lL,-1),mkLeg(lR,1)],pelvis:new T.Vector3(0,1.25,0),reach:1.15*.49+.5,hands:[aL.end,aR.end],
  movePelvis(x,y,z){this.pelvis.set(x,y,z);pelvisG.position.set(x,y-1.25,z);},
  setTorso(pitch,yaw,roll){torso.rotation.set(pitch,yaw,roll);},
  setArm(side,a){const k=side?-1:1,pv=side?aR:aL;pv.pivot.rotation.set(a.pitch,k*a.twist,-k*a.out);pv.joint.rotation.set(a.elbow,0,0);}};
 const imported=outfitAvatar(o)==='explorer'?models.rider(o):null;if(imported){body.traverse(n=>{if(n instanceof T.Mesh)n.visible=false;});body.add(imported.root);}
 const rig=imported?imported.rig:classicRig;
 const skiL=new T.Group(),skiR=new T.Group();body.add(skiL,skiR);
 const boardG=new T.Group(),bikeG=new T.Group(),bikePivot=new T.Group(),poles:PoleObj[]=[];body.add(boardG,bikeG);bikePivot.position.y=.62;bikeG.add(bikePivot);
 if(o.gear==='snowboard'){const equipment=models.snowboard();if(equipment){boardG.add(equipment);}else{box(boardG,'#dad1af',0,.025,0,1.9,.065,.40);box(boardG,o.hat,.48,.065,0,.35,.01,.38);for(const xx of [-.95,.95]){const tip=box(boardG,'#344c4a',xx,.055,0,.18,.07,.38);tip.rotation.z=xx>0?.28:-.28;}}}
 else{
 const bike=o.gear==='skibike';
 for(const [g,xx] of [[skiL,bike?-.27:-.20],[skiR,bike?.27:.20]] as const){g.position.x=xx;const equipment=models.ski();if(equipment){g.add(equipment);}else{box(g,'#d4ab63',0,.03,-.12,.17,.065,2.1);box(g,o.hat,0,.07,-.9,.17,.05,.35);}if(bike)g.scale.set(.85,1,.5);}
 if(bike){ // ski bike: a front and a rear ski under a bike frame with a seat and handlebars; the rider also wears two short ski blades
  const kit=kitById(o.kit),frameC=kit.accent,dark='#1d2125',P=bikePivot,Y=-.62,tube=(a:[number,number,number],b:[number,number,number],w:number,c:string)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),m=box(P,c,0,0,0,w,w,A.distanceTo(B));m.position.copy(A).add(B).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),B.clone().sub(A).normalize());return m;};
  for(const [z,front] of [[.66,false],[-.66,true]] as const){box(P,dark,0,Y+.07,z,.17,.07,1.05);const tip=box(P,dark,0,Y+.12,z+(front?-.55:.55),.17,.06,.26);tip.rotation.x=front?-.5:.5;box(P,frameC,0,Y+.12,z,.07,.06,.5);}
  tube([0,Y+.12,.66],[0,Y+.98,.28],.075,frameC);tube([0,Y+.12,-.66],[0,Y+1.34,-.42],.075,frameC);tube([0,Y+.98,.28],[0,Y+1.2,-.36],.07,frameC);tube([0,Y+.5,.46],[0,Y+.5,-.56],.05,dark);
  box(P,dark,0,Y+1.03,.3,.26,.08,.5);box(P,dark,0,Y+1.36,-.44,.72,.055,.055);for(const sx of [-1,1])box(P,'#0e1012',sx*.38,Y+1.36,-.44,.16,.075,.075);
 }
 if(o.poles!=='none'&&!bike)for(const hand of rig.hands)poles.push(makePole(o.poles==='kit'?'kit':'carbon',kitById(o.kit).accent,hand));
 }
 if(name){const tag=label(name);tag.scale.set(2.8,.53,1);tag.position.y=3;root.add(tag);}scene.add(root);
 return{imported,rig,hipRestY:imported?1.35:1.25,root,stunt,body,armL:aL.pivot,armR:aR.pivot,legL:lL.pivot,legR:lR.pivot,kneeL:lL.joint,kneeR:lR.joint,elbowL:aL.joint,elbowR:aR.joint,skiL,skiR,bikeG,bikePivot,qs:new T.Quaternion(),grabW:0,grabErr:0,signature:JSON.stringify(o),lastAngle:0,lastTime:0,lean:0,gear:o.gear,equipment:[boardG,bikeG,skiL,skiR,...poles.map(q=>q.group)].filter(g=>g.children.length),rag:null,land:0,airStart:0,wasAir:false,edgeSign:0,release:0,boardG,contact:0,normals:[new T.Vector3(0,1,0),new T.Vector3(0,1,0),new T.Vector3(0,1,0)],torso,poles,pp:null,lastX:0,lastY:0,speedEst:0};
 }
 let local=rider({jacket:'#da744f',pants:'#374854',hat:'#e5b95f',gear:'snowboard'});const remotes=new Map<string,Rider>();
 const previewFloor=new T.Mesh(new T.CircleGeometry(30,48),mat('#40594e'));previewFloor.rotation.x=-Math.PI/2;previewFloor.receiveShadow=true;scene.add(previewFloor);
 const dust=new T.InstancedMesh(sphereGeo,mat('#f4f8e9'),220);dust.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(dust);const dummy=new T.Object3D();
 // Chairs: every lift always has a line of chairs creeping up one cable and down the other, whether or not you are near. They are slow, and they never stop.
 const CHAIR_SPACING=700,CHAIR_SPEED=26;
 const chairs:{g:T.Group;L:Lift;i:number;up:boolean;n:number}[]=[];for(const L of LIFTS){const n=Math.max(2,Math.round((L.y0-L.y1)/CHAIR_SPACING));for(const up of [true,false])for(let i=0;i<n;i++){const g=new T.Group();box(g,'#52665d',0,1,0,.06,2,.06);box(g,'#df9c62',0,0,0,1.6,.12,.8);box(g,'#596f65',0,.35,.35,1.6,.7,.08);g.visible=false;scene.add(g);chairs.push({g,L,i,up,n});}}
 let width=0,height=0,camReady=false,zone=-999,lastClock=0,shake=0,wasBail=false,camHeading=0,lastX=0,lastY=0,lookReady=false,rcId=-1,rcFirst=true,rcT=performance.now();const rcAnchor=new T.Vector3(),rcPos=new T.Vector3(),rcLook=new T.Vector3();const camLook=new T.Vector3();
 // Ski tracks: one ribbon per ski (one for a board). Thin when carving, wide smears when skidding.
 const trackMat=new T.MeshBasicMaterial({color:'#aebfc2',transparent:true,opacity:.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
 type TrackPt={x:number;y:number;z:number;nx:number;nz:number;w:number;gap:boolean};
 const tracks=[0,1].map(()=>{const mesh=new T.Mesh(new T.BufferGeometry(),trackMat);mesh.frustumCulled=false;scene.add(mesh);return{pts:[] as TrackPt[],broken:true,mesh};});
 function layTracks(f:Frame){const board=f.outfit.gear!=='skis';tracks[1].mesh.visible=!board;
  // Deep snow (powder, or warm soft afternoon snow) cuts wider, darker, longer-lasting grooves; firm morning corduroy leaves a thin light line.
  const depth=f.snow==='powder'?1:f.snow==='ice'?0:(f.soft||0)*.6;trackMat.opacity=.4+.35*depth;trackMat.color.set(depth>.5?'#8da3ac':'#aebfc2');
  if(f.cam||f.view!=='game'||f.z>0||(f.lift||0)>0||f.bail>0||f.speed<6){for(const t of tracks)t.broken=true;return;}
  const h=f.angle,c=f.course??f.angle,slip=Math.abs(Math.sin(h-c));
  (board?[0]:[-.2,.2]).forEach((o,i)=>{const t=tracks[i],x=f.x*S+Math.cos(h)*o,z=-f.y*S+Math.sin(h)*o,last=t.pts[t.pts.length-1],d=last?Math.hypot(last.x-x,last.z-z):99;
   if(d<.35)return;if(d>40)t.pts=[];
   t.pts.push({x,z,y:ground(x/S,-z/S)+.07,nx:Math.cos(c),nz:Math.sin(c),w:((f.outfit.gear==='skibike'?.1:board?.28:.07)+slip*(board?1.4:1.1))*(1+.9*depth),gap:t.broken||d>4});t.broken=false;if(t.pts.length>(depth>.5?800:400))t.pts.shift();
   const v:number[]=[];for(let k=1;k<t.pts.length;k++){const a=t.pts[k-1],b=t.pts[k];if(b.gap)continue;const ax=a.nx*a.w/2,az=a.nz*a.w/2,bx=b.nx*b.w/2,bz=b.nz*b.w/2;
    v.push(a.x-ax,a.y,a.z-az,a.x+ax,a.y,a.z+az,b.x+bx,b.y,b.z+bz,a.x-ax,a.y,a.z-az,b.x+bx,b.y,b.z+bz,b.x-bx,b.y,b.z-bz);}
   t.mesh.geometry.dispose();t.mesh.geometry=new T.BufferGeometry();t.mesh.geometry.setAttribute('position',new T.Float32BufferAttribute(v,3));});}
 type Motion={landSeq?:number;landYaw?:number;qx?:number;qy?:number;qz?:number;qw?:number;tuckAmt?:number;extAmt?:number;gtKind?:string;gtAmt?:number;balance?:number;stumble?:number;edgeAngle?:number;crash?:{kind:string;fx:number;fy:number;power:number;lean:number;side:number;tilt:number}|null;cross?:number;scissor?:number;grabStyle?:number;tuck?:number;lift?:number;rail?:boolean;fakie?:boolean;x:number;y:number;z:number;angle:number;speed?:number;pushPhase?:number;pushPower?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string};
 const _qg=new T.Quaternion(),_qa=new T.Quaternion(),_qk=new T.Quaternion(),_Y=new T.Vector3(0,1,0),_NY=new T.Vector3(0,-1,0),_ft=[new T.Vector3(),new T.Vector3()],_qf=[new T.Quaternion(),new T.Quaternion()],_qy=new T.Quaternion(),_so=new T.Vector3(),_H=new T.Vector3(),_D=new T.Vector3(),_qS=new T.Quaternion(),_qH=new T.Quaternion(),_qW=new T.Quaternion();
 // Gear geometry (measured from the models): boot sits on the binding centre, .10 behind the ski's middle, on top of the binding.
 const SKI_TOP=.089,SKI_BIND=.10,BOARD_TOP=.0875;
 function pose(r:Rider,p:Motion,t:number,bail=0,spin=0,flip=0,grab=0){
 const dt=Math.max(.001,Math.min(.1,t-r.lastTime)),first=!r.lastTime,delta=Math.atan2(Math.sin(p.angle-r.lastAngle),Math.cos(p.angle-r.lastAngle));
 // Remote riders do not send their speed: estimate it from how far they moved.
 let speed=p.speed??0;if(p.speed===undefined){r.speedEst+=((first?0:Math.hypot(p.x-r.lastX,p.y-r.lastY)/dt)-r.speedEst)*Math.min(1,dt*6);speed=r.speedEst;}
 r.lastX=p.x;r.lastY=p.y;
 const bike=r.gear==='skibike',board=r.gear==='snowboard',maxLean=board?.36:bike?.5:.42;
 const targetLean=p.edge!==undefined?p.edge*maxLean*(p.fakie?-1:1):first?0:Math.max(-maxLean,Math.min(maxLean,-delta/dt*.18));r.lean+=(targetLean-r.lean)*Math.min(1,dt*9);r.lastAngle=p.angle;r.lastTime=t;
 const air=p.z>0,lifted=(p.lift||0)>0,grounded=!air&&!bail;
 // Takeoff and landing timing; edge changes soften the legs for a moment.
 if(air&&!r.wasAir)r.airStart=t;if(!air&&r.wasAir&&!bail)r.land=1;r.wasAir=air;r.land*=Math.exp(-7*dt);
 const sign=Math.abs(p.edge||0)>.12?Math.sign(p.edge||0):0;if(sign&&r.edgeSign&&sign!==r.edgeSign)r.release=1;if(sign)r.edgeSign=sign;r.release*=Math.exp(-6*dt);
 const edge=grounded?r.lean/maxLean*(1-r.release*.6):0;
 // Pushing (poles / skating) only happens at low speed; at speed the same key is an aerodynamic tuck.
 const inp:PoseIn={speed,push:grounded?Math.min(p.pushPower||0,pushWeight(speed)):0,phase:p.pushPhase||0,tuck:grounded?p.tuck||0:0,air,airT:t-r.airStart,bike,airTuck:air?p.tuckAmt||0:0,airExt:air?p.extAmt||0:0,land:r.land,grab:!!grab||(board&&air&&((p.cross||0)>.3||(p.scissor||0)>.3)),grabStyle:p.grabStyle||(p.cross&&p.cross>.3?0:p.scissor&&p.scissor>.3?2:0),edge,skid:grounded?p.skid||0:0,fakie:!!p.fakie,board,rail:!!p.rail&&!air,absorb:grounded?Math.max(-.12,p.absorb||0):0,release:r.release,breath:Math.sin(t*1.6)};
 const tgt=computePose(inp);r.pp=r.pp?blendPose(r.pp,tgt,Math.min(1,dt*(air?16:11))):tgt;const pp=r.pp;
 // The body is not glued to the snow: on the ground it rides on a damped vertical spring (the legs absorb every bump, the skis follow the real surface), in the air it is free.
 const baseY=ground(p.x,p.y)+(p.z+(p.lift||0))*S;if(first||air||bail>0||r.bodyY===undefined||Math.abs(baseY-r.bodyY)>1.5)r.bodyY=baseY;else r.bodyY+=(baseY-r.bodyY)*(1-Math.exp(-dt*15));
 r.root.position.set(p.x*S,r.bodyY,-p.y*S);
 // The rider is not a flat sprite on the ground plane: on a slope or up a kicker face the whole body leans with the surface (about half to full of its angle), and eases back upright in the air.
 {let tp=0,tr=0;if(!air&&!(bail>0)){const d=14,fx=Math.sin(p.angle),fy=Math.cos(p.angle),rx=Math.cos(p.angle),ry=-Math.sin(p.angle),sf=(x:number,y:number)=>ground(x,y)+featLiftAt(x,y)*S;
   tp=Math.atan((sf(p.x+fx*d,p.y+fy*d)-sf(p.x-fx*d,p.y-fy*d))/(2*d*S))*.8;tr=Math.atan((sf(p.x+rx*d,p.y+ry*d)-sf(p.x-rx*d,p.y-ry*d))/(2*d*S))*.6;}
  r.tiltP=(r.tiltP||0)+(tp-(r.tiltP||0))*(1-Math.exp(-dt*(air?10:8)));r.tiltR=(r.tiltR||0)+(tr-(r.tiltR||0))*(1-Math.exp(-dt*(air?10:8)));
  r.root.rotation.order='YXZ';r.root.rotation.set(Math.max(-.7,Math.min(.7,r.tiltP)),-p.angle,Math.max(-.5,Math.min(.5,r.tiltR)));}
 // Flips rotate around the hips, with equipment carried through the motion.
 // The rider's body is a free rigid body in the air (the engine integrates its real orientation); on the ground it eases back to the skiing lean,
 // so there is no snap in or out of a trick. Stumbles wobble it, and butters and manuals tip it nose-down or tail-down.
 if(p.landSeq!==undefined){if(r.lastLand!==undefined&&r.lastLand!==p.landSeq&&!first)r.qs.premultiply(_qk.setFromAxisAngle(_Y,-(p.landYaw||0)));r.lastLand=p.landSeq;}
 {const wob=(p.stumble||0),gtA=p.gtAmt||0,gtK=p.gtKind||'';let gx=(p.backseat||0)*.3+(p.fakie&&!board&&!air?.08:0)+(gtK==='nose'?.32:gtK==='tail'?-.34:gtK==='manual'?-.14:0)*gtA+Math.sin(t*15)*.07*Math.min(1,wob);
  let gz=r.lean*(1-r.release*.6)+(gtK==='manual'?(p.balance||0)*.35:0)+Math.sin(t*11+1)*.09*Math.min(1,wob);
  _qg.setFromEuler(_e.set(gx,0,gz));
  if(air&&p.qw!==undefined)_qa.set(p.qx||0,p.qy||0,p.qz||0,p.qw).normalize();else if(air)_qa.setFromEuler(_e.set(flip,spin,0)).multiply(_qg);else _qa.copy(_qg);
  if(first)r.qs.copy(_qa);else r.qs.slerp(_qa,1-Math.exp(-dt*(air?60:12)));
  r.stunt.quaternion.copy(r.qs);r.stunt.position.y=1.3;}
 if(grounded&&p.snow==='ice'&&inp.skid>.15){r.root.position.y+=Math.random()*.03*inp.skid;} // ice: edges chatter
  r.body.position.set(0,-1.3,0);r.body.rotation.set(0,board?Math.PI/2:0,0);
 if(bail>0){ragdoll(r,p,t,dt,bail);return;}
 if(r.rag){r.rag=null;for(const g of r.equipment)g.visible=true;for(let i=debris.length-1;i>=0;i--)if(debris[i].owner===r){debris[i].obj.removeFromParent();debris.splice(i,1);}}
 // --- gear first: the skis/board rest on the snow (or hang from the feet in the air); the legs are then solved to reach them.
 const lean0=r.lean>0?1:0;
 if(board)r.boardG.position.set(0,0,0);
 else{const bk=(p.backseat||0)*.3;r.skiL.position.set(-pp.stance,0,-bk-pp.insideLead*lean0);r.skiR.position.set(pp.stance,0,-bk-pp.insideLead*(1-lean0));}
 settleGear(r,p,air||lifted,dt,edge,board?[0,0]:[pp.insideLift*lean0,pp.insideLift*(1-lean0)]);
 // Q / E tricks in the air: Q crosses the skis into an X, E scissors them fore and aft.
 if(bike){const cx=air?p.cross||0:0,sc=air?p.scissor||0:0;r.bikePivot.rotation.set(0,sc*.9,cx*1.3);} // Q: tabletop (bike rolls flat), E: whip (bike swings sideways)
 if(!board&&!bike&&air){const cx=p.cross||0,sc=p.scissor||0;if(cx>.01){_qk.setFromAxisAngle(_Y,-cx*.62);r.skiL.quaternion.multiply(_qk);_qk.setFromAxisAngle(_Y,cx*.62);r.skiR.quaternion.multiply(_qk);}if(sc>.01){r.skiL.position.z-=sc*.5;r.skiR.position.z+=sc*.5;_qk.setFromAxisAngle(_Y,sc*.14);r.skiL.quaternion.multiply(_qk);_qk.setFromAxisAngle(_Y,-sc*.14);r.skiR.quaternion.multiply(_qk);}}
 // Butters pivot on the nose or the tail: the other end of the skis comes off the snow. Manuals ride the tails, nose slightly up.
 if(!board&&!bike&&!air&&(p.gtAmt||0)>.02){const k=p.gtAmt||0,kind=p.gtKind||'',th=(kind==='nose'?-.5:kind==='tail'?.5:.24+(p.balance||0)*.08)*k;for(const g of [r.skiL,r.skiR]){_qk.setFromAxisAngle(new T.Vector3(1,0,0),th);g.quaternion.multiply(_qk);g.position.y+=Math.abs(Math.sin(th))*1.05;}}
 // Grabbing a tail or a nose: the skier pulls that end of the ski up toward the hand (tail grabs raise the tail, nose grabs the nose).
 if(!board&&!bike&&air&&r.grabW>.02&&p.grabStyle!==undefined){const def=GRABS[Math.max(0,Math.min(GRABS.length-1,p.grabStyle))];for(const h of def.hands){const g=h.ski==='L'?r.skiL:r.skiR;if(h.t>.5||h.t<-.5){_qk.setFromAxisAngle(new T.Vector3(1,0,0),(h.t>0?-.62:.55)*r.grabW);g.quaternion.multiply(_qk);}}}
 const rig=r.rig;
 for(const side of [0,1] as const){
  const g=board?r.boardG:side?r.skiR:r.skiL,sx=side?1:-1;
  if(board){_so.set(sx*pp.stance,BOARD_TOP,0);_qy.setFromAxisAngle(_Y,pp.footYaw[side]);}else{_so.set(0,SKI_TOP,SKI_BIND);_qy.identity();}
  _qf[side].copy(g.quaternion).multiply(_qy);
  _ft[side].copy(_so).applyQuaternion(g.quaternion).add(g.position); // sole centre on the binding
  if(board&&side===0&&pp.skate>.02){ // skating: the rear foot steps off, plants beside the board and drives it forward
   const u=pp.skateU,sp=Math.max(0,Math.min(1,(u-.45)/.55)),lift=.16*Math.sin(Math.PI*sp);
   _so.set(-pp.stance+(-.3+.65*u),lift,-.32);_so.applyQuaternion(g.quaternion).add(g.position);_ft[0].lerp(_so,pp.skate);
  }
  _ft[side].sub(_D.copy(rig.legs[side].soleOff).applyQuaternion(_qf[side])); // sole -> ankle
 }
 // Pelvis: nominal stance over the bindings, height from the feet and how deep the knees are bent.
 const avgY=(_ft[0].y+_ft[1].y)/2,hipY=avgY+rig.reach*.975*(1-.33*pp.flex)+pp.flex*0;
 rig.movePelvis(pp.hipSide,hipY,(board?0:SKI_BIND)+pp.hipBack);
 solveLeg(rig,0,_ft[0],_qf[0]);solveLeg(rig,1,_ft[1],_qf[1]);
 rig.setTorso(pp.torsoPitch+Math.sin(t*1.6)*.01,pp.torsoYaw,pp.torsoRoll);rig.setArm(0,pp.armL);rig.setArm(1,pp.armR);
 if(!board&&!bike)applyGrab(r,p,dt,air&&!!grab,pp);else r.grabErr=-1;
 // --- poles: gripped in the glove. Planted tips are stretched to touch the snow; trailing/tucked poles hang free.
 if(r.poles.length){
  r.root.updateMatrixWorld(true);r.stunt.getWorldQuaternion(_qS);
  r.poles.forEach((pole,i)=>{const sd=i?1:-1,tilt=pp.poleTilt,out=pp.poleOut;
   rig.hands[i].getWorldPosition(_H);rig.hands[i].getWorldQuaternion(_qH);
   _D.set(sd*Math.sin(out)*Math.cos(tilt),-Math.cos(out)*Math.cos(tilt),Math.sin(tilt)).normalize().applyQuaternion(_qS);
   let len=1.45;
   if(pp.polePlant>.01&&_D.y<-.15&&!lifted){let L=len;for(let k=0;k<2;k++){const tx=_H.x+_D.x*L,tz=_H.z+_D.z*L;L=Math.max(.9,Math.min(1.9,(_H.y-ground(tx/S,-tz/S)-.02)/-_D.y));}len+=(L-len)*pp.polePlant;}
   pole.setLen(len);
   _qW.setFromUnitVectors(_NY,_D);pole.group.quaternion.copy(_qH.invert().multiply(_qW));});
 }
 }
 // ---- Grabs: numeric two-bone IK on the rig's own arm parameters, so the hand really travels to the ski. The remaining distance is reported back to the game as grab quality.
 const AL={pitch:[-.5,1.55],out:[-1.3,.95],elbow:[0,1.9]};
 function reachArm(r:Rider,side:0|1,target:T.Vector3,start:Arm){
  const rig=r.rig,hand=rig.hands[side],cur:Arm={...start},p0=new T.Vector3(),p1=new T.Vector3(),keys=['pitch','out','elbow'] as const;
  const ev=(a:Arm,o:T.Vector3)=>{rig.setArm(side,a);r.root.updateMatrixWorld(true);hand.getWorldPosition(o);};
  for(let it=0;it<8;it++){ev(cur,p0);const e=[target.x-p0.x,target.y-p0.y,target.z-p0.z];if(Math.hypot(e[0],e[1],e[2])<.02)break;
   const J=[[0,0,0],[0,0,0],[0,0,0]];keys.forEach((k,i)=>{const a2={...cur,[k]:cur[k]+.04};ev(a2,p1);J[0][i]=(p1.x-p0.x)/.04;J[1][i]=(p1.y-p0.y)/.04;J[2][i]=(p1.z-p0.z)/.04;});
   // damped least squares: dp = J^T (J J^T + l I)^-1 e
   const M=[[0,0,0],[0,0,0],[0,0,0]];for(let a=0;a<3;a++)for(let b=0;b<3;b++){let v=a===b?.01:0;for(let k=0;k<3;k++)v+=J[a][k]*J[b][k];M[a][b]=v;}
   const det=M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);if(Math.abs(det)<1e-9)break;
   const inv=[[(M[1][1]*M[2][2]-M[1][2]*M[2][1])/det,(M[0][2]*M[2][1]-M[0][1]*M[2][2])/det,(M[0][1]*M[1][2]-M[0][2]*M[1][1])/det],[(M[1][2]*M[2][0]-M[1][0]*M[2][2])/det,(M[0][0]*M[2][2]-M[0][2]*M[2][0])/det,(M[0][2]*M[1][0]-M[0][0]*M[1][2])/det],[(M[1][0]*M[2][1]-M[1][1]*M[2][0])/det,(M[0][1]*M[2][0]-M[0][0]*M[2][1])/det,(M[0][0]*M[1][1]-M[0][1]*M[1][0])/det]];
   const y=[0,0,0];for(let a=0;a<3;a++)for(let b=0;b<3;b++)y[a]+=inv[a][b]*e[b];
   keys.forEach((k,i)=>{let d=0;for(let a=0;a<3;a++)d+=J[a][i]*y[a];d=Math.max(-.4,Math.min(.4,d));cur[k]=Math.max(AL[k][0],Math.min(AL[k][1],cur[k]+d));});}
  ev(cur,p0);return{arm:cur,err:p0.distanceTo(target)};}
 const _ga=new T.Vector3();
 function applyGrab(r:Rider,p:Motion,dt:number,grabbing:boolean,pp:PoseOut){
  const want=grabbing&&r.gear==='skis'&&(p.grabStyle!==undefined),w0=r.grabW;r.grabW+=((want?1:0)-r.grabW)*Math.min(1,dt*(want?7:9));
  if(r.grabW<.02){r.grabErr=-1;return;}
  const def=GRABS[Math.max(0,Math.min(GRABS.length-1,p.grabStyle||0))];r.root.updateMatrixWorld(true);
  const armFK=[pp.armL,pp.armR];let tot=0,n=0;
  for(const h of def.hands){const side=h.hand==='L'?0:1,ski=h.ski==='L'?r.skiL:r.skiR,sgn=h.ski==='L'?-1:1,xo=(h.edge==='in'?-sgn:sgn)*.085; // inside edge faces the body's centre line
   _ga.set(xo,SKI_TOP+.035,SKI_BIND+h.t*.9);ski.localToWorld(_ga);
   const fk=armFK[side],res=reachArm(r,side,_ga,{...fk,twist:0}),w=r.grabW;
   r.rig.setArm(side,{pitch:fk.pitch+(res.arm.pitch-fk.pitch)*w,out:fk.out+(res.arm.out-fk.out)*w,elbow:fk.elbow+(res.arm.elbow-fk.elbow)*w,twist:0});tot+=res.err;n++;}
  // the free hand stays out for balance
  const free=[0,1].filter(i=>!def.hands.some(h=>(h.hand==='L'?0:1)===i));for(const i of free)r.rig.setArm(i as 0|1,{pitch:.2,out:.75*r.grabW+(armFK[i].out)*(1-r.grabW),elbow:.3,twist:0});
  r.grabErr=n?tot/n:0;
 }
 // EVERYTHING is ground: the skis and boots sit on whatever surface is really under them (snow, a kicker mound, a rail or a box), sampled independently per ski.
 let curFeatures:{kind:string;x:number;y:number;size:number;seed:number;id:string}[]=[];
 // Height (engine units) added by kicker mounds and rails at a point; zero on plain snow.
 function featLiftAt(x:number,y:number){let add=0;for(const ft of curFeatures){if(ft.kind==='ramp'){const l=kickerSurface(ft as never,x,y);if(l>add)add=l;}else if(ft.kind==='rail'&&Math.abs(ft.x-x)<40&&onRail(ft as never,x,y)){const h=railShape(ft as never).height;if(h>add)add=h;}}return add;}
 function surfAt(x:number,y:number){let add=0;for(const ft of curFeatures){if(ft.kind==='ramp'){const l=kickerSurface(ft as never,x,y);if(l>add)add=l;}else if(ft.kind==='rail'&&Math.abs(ft.x-x)<40&&onRail(ft as never,x,y)){const h=railShape(ft as never).height;if(h>add)add=h;}}return ground(x,y)+add*S;}
 // Skis/board rest on the snow under each one: pitch with the slope, roll with sidehills and edge angle.
 // The terrain normal is sampled across the ski's length (smooths small bumps) and low-passed over time.
 // In the air the gear follows the rider's pose; contact blends back in after landing.
 const UP=new T.Vector3(0,1,0),_q=new T.Quaternion(),_q2=new T.Quaternion(),_q3=new T.Quaternion(),_v=new T.Vector3(),_n=new T.Vector3(),_e=new T.Euler();
 function settleGear(r:Rider,p:Motion,lifted:boolean,dt:number,edgeAmt:number,lifts:[number,number]){
  r.contact+=((lifted?0:1)-r.contact)*Math.min(1,dt*(lifted?14:9));
  const board=r.gear==='snowboard',parts=board?[r.boardG]:r.gear==='skibike'?[r.skiL,r.skiR,r.bikeG]:[r.skiL,r.skiR];
  for(const g of parts)g.quaternion.identity();
  if(r.contact<.01)return;
  r.root.updateMatrixWorld(true);
  const fx=Math.sin(p.angle),fy=Math.cos(p.angle),half=1.1/S,d=half,sink=p.snow==='powder'?.03:p.snow==='ice'?-.08:0; // powder: bases just under the surface, top sheets still visible; // lake ice surface sits slightly above the terrain
  parts.forEach((g,i)=>{
   g.getWorldPosition(_v);const gx=_v.x/S,gy=-_v.z/S;
   const hX=(surfAt(gx+d,gy)-surfAt(gx-d,gy))/(2*d*S),hY=(surfAt(gx,gy+d)-surfAt(gx,gy-d))/(2*d*S);
   _n.set(-hX,1,hY).normalize();r.normals[i].lerp(_n,Math.min(1,dt*14)).normalize();
   // world orientation = terrain tilt * heading yaw (* board's sideways mount) * edge roll about the long axis
   _q.setFromUnitVectors(UP,r.normals[i]);
   _q2.setFromEuler(_e.set(0,-p.angle+(board?Math.PI/2:0),0));_q.multiply(_q2);
   _q3.setFromEuler(board?_e.set(edgeAmt*.5,0,0):_e.set(0,0,edgeAmt*.55));_q.multiply(_q3);
   g.parent!.getWorldQuaternion(_q2);g.quaternion.copy(_q2.invert().multiply(_q)).slerp(_q3.identity(),1-r.contact);
   // Height: rest on whichever is higher, the snow under the binding or the tip-tail chord (bridges dips, never clips crests).
   const h=surfAt(gx,gy),chord=(surfAt(gx+fx*half,gy+fy*half)+surfAt(gx-fx*half,gy-fy*half))/2,target=Math.max(h,chord)+.015-sink+(lifts[i]||0);
   const wy=_v.y;_v.y=wy+(target-wy)*r.contact;g.parent!.worldToLocal(_v);g.position.copy(_v);
  });
 }
 // Procedural ragdoll: the body tumbles and bounces with momentum, limbs flail on damped springs,
 // and the gear flies off as loose debris (the "yard sale"). Last 0.35s blends back to standing.
 function ragdoll(r:Rider,p:{x:number;y:number;angle:number;speed?:number},t:number,dt:number,bail:number){
  const speed=Math.min(p.speed||0,320);
  if(!r.rag){
   // The crash decides how you go down: a nose-heavy landing pitches you over the front, a backseat one flops you backward, an edge catch spins you sideways; speed sets how violently.
   const cr=(p as Motion).crash,pw=cr?cr.power:Math.min(1,speed/320),fwdCrash=cr?(cr.kind==='nose'||cr.lean<-.25):false,sideCrash=cr?(cr.kind==='edge'||Math.abs(cr.side)>.5):false,sgn=cr&&cr.side<0?-1:1;
   r.rag={start:t,tumble:0,tumbleV:(fwdCrash?-1:1)*(sideCrash?1.6:3)+(fwdCrash?-1:1)*speed/38*(sideCrash?.4:1),yaw:0,yawV:sideCrash?sgn*(5+pw*7):(Math.random()-.5)*7,h:.25,hV:1.6+pw*3+speed/160,seed:Math.random()*10};
   const fwd=new T.Vector3(Math.sin(p.angle),0,-Math.cos(p.angle)),side=new T.Vector3(Math.cos(p.angle),0,Math.sin(p.angle));
   for(const g of r.equipment){g.updateWorldMatrix(true,true);const c=g.clone(true);g.matrixWorld.decompose(c.position,c.quaternion,c.scale);scene.add(c);g.visible=false;
    debris.push({obj:c,owner:r,vel:fwd.clone().multiplyScalar(speed*S*(.45+Math.random()*.6)).addScaledVector(side,(Math.random()-.5)*7).add(new T.Vector3(0,3+Math.random()*4,0)),spin:new T.Vector3((Math.random()-.5)*16,(Math.random()-.5)*12,(Math.random()-.5)*16)});}
  }
  const R=r.rag,e=t-R.start;
  R.hV-=20*dt;R.h+=R.hV*dt;if(R.h<0){R.h=0;R.hV=Math.abs(R.hV)>1.5?-R.hV*.35:0;R.tumbleV*=.7;R.yawV*=.7;}
  if(R.h===0){R.tumbleV*=Math.exp(-2.6*dt);R.yawV*=Math.exp(-3*dt);}
  R.tumble+=R.tumbleV*dt;R.yaw+=R.yawV*dt;
  const rest=Math.round((R.tumble-Math.PI/2)/Math.PI)*Math.PI+Math.PI/2;if(Math.abs(R.tumbleV)<2.2)R.tumble+=(rest-R.tumble)*Math.min(1,dt*5);
  const up=bail<.35?1-bail/.35:0,ease=up*up*(3-2*up),roll=Math.atan2(Math.sin(R.tumble),Math.cos(R.tumble))*(1-ease),lying=Math.abs(Math.sin(roll));
  r.stunt.rotation.set(roll,R.yaw*(1-ease),r.lean*(1-ease));
  r.stunt.position.y=1.3-lying*1.05+R.h;
  const a=Math.exp(-e*2)*(1-ease),k=(1-ease),w=(f:number,ph:number)=>Math.sin(e*f+R.seed+ph);
  r.armL.rotation.set((-.5+w(11,0)*1.5*a)*k,0,(-1.1+w(7,1)*.6*a)*k);r.armR.rotation.set((-.5+w(10,2)*1.5*a)*k,0,(1.1+w(8,3)*.6*a)*k);
  r.elbowL.rotation.x=(-.4-Math.abs(w(13,4))*1.2*a)*k;r.elbowR.rotation.x=(-.4-Math.abs(w(12,5))*1.2*a)*k;
  r.legL.rotation.set((.35+w(9,6)*1.1*a)*k,0,-.25*k);r.legR.rotation.set((.2+w(8,7)*1.1*a)*k,0,.25*k);
  r.kneeL.rotation.x=(-.5-Math.abs(w(10,8))*1.1*a)*k;r.kneeR.rotation.x=(-.3-Math.abs(w(11,9))*1.1*a)*k;
  r.torso.rotation.set(w(6,10)*.5*a*k,w(5,11)*.6*a*k,w(7,12)*.4*a*k);
  r.imported?.flail(e,a,k,R.seed);
  if(!r.imported){r.rig.movePelvis(0,r.hipRestY,0);for(const l of r.rig.legs)l.ankle.quaternion.identity();}
 }
 function stepDebris(dt:number){for(const d of debris){const o=d.obj;d.vel.y-=20*dt;o.position.addScaledVector(d.vel,dt);o.rotation.x+=d.spin.x*dt;o.rotation.y+=d.spin.y*dt;o.rotation.z+=d.spin.z*dt;
  const floor=ground(o.position.x/S,-o.position.z/S)+.06;if(o.position.y<floor){o.position.y=floor;d.vel.y=Math.abs(d.vel.y)>1?-d.vel.y*.3:0;d.vel.x*=.6;d.vel.z*=.6;d.spin.multiplyScalar(.55);}}}
 // ---- Speed streaks: flecks of snow hanging in the air around the rider; as you ride past them they stretch into lines. ----
 const NSTR=70,strPos=new Float32Array(NSTR*6),strSeed=Array.from({length:NSTR},(_,i)=>({x:(hash(i*3.1)-.5)*30,y:hash(i*5.7)*14,z:(hash(i*7.3)-.5)*60})),strGeo=new T.BufferGeometry(),strMat=new T.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:0,depthWrite:false,fog:false});
 strGeo.setAttribute('position',new T.BufferAttribute(strPos,3));const streaks=new T.LineSegments(strGeo,strMat);streaks.frustumCulled=false;scene.add(streaks);
 function updateStreaks(f:Frame){const kmh=f.speed*.18,a=Math.max(0,Math.min(1,(kmh-25)/70));strMat.opacity=a*.55;streaks.visible=a>0&&!f.bail;if(!streaks.visible)return;
  const dx=Math.sin(f.course||0),dz=-Math.cos(f.course||0),len=.6+a*3.2,gy=ground(f.x,f.y)+Math.max(0,f.z)*S;
  for(let i=0;i<NSTR;i++){const q=strSeed[i],along=((q.z+(f.x*dx*S+(-f.y)*dz*S))%60+60)%60-30,
   // position in a frame travelling with the rider: flecks are fixed in the world so they slide backwards past the camera
   px=f.x*S+(-q.x*dz)+dx*(-along),pz=-f.y*S+(q.x*dx)+dz*(-along),py=gy+.3+q.y*.5;
   strPos.set([px,py,pz,px-dx*len,py,pz-dz*len],i*6);}
  strGeo.attributes.position.needsUpdate=true;}
 // ---- Edge spray: snow thrown off the skis when carving hard or skidding sideways. ----
 const NSP=90,spPos=new Float32Array(NSP*3),spVel=new Float32Array(NSP*3),spLife=new Float32Array(NSP),spGeo=new T.BufferGeometry(),spMat=new T.PointsMaterial({color:'#ffffff',size:.16,transparent:true,opacity:.85,depthWrite:false,sizeAttenuation:true});let spNext=0,spAcc=0;
 for(let i=0;i<NSP;i++)spPos[i*3+1]=-999;spGeo.setAttribute('position',new T.BufferAttribute(spPos,3));const spray=new T.Points(spGeo,spMat);spray.frustumCulled=false;scene.add(spray);
 function updateSpray(f:Frame,dt:number){const kmh=f.speed*.18,e=Math.abs(f.edge||0),slip=Math.abs(Math.sin((f.angle||0)-(f.course??f.angle??0))),power=f.z>0||f.bail>0||(f.lift||0)>0?0:Math.max(e*.9,f.skid||0,slip)*Math.min(1,kmh/25);
  spAcc+=dt*(power>.2?power*90:0);const h=f.angle||0,side=Math.sign(f.edge||Math.sin(h-(f.course??h))||1);
  while(spAcc>=1){spAcc--;const i=spNext++%NSP,o=(Math.random()<.5?-.2:.2);spPos[i*3]=f.x*S+Math.cos(h)*o;spPos[i*3+1]=ground(f.x,f.y)+.08;spPos[i*3+2]=-f.y*S+Math.sin(h)*o;
   const sp=(1.5+Math.random()*2.5)*(.4+power);spVel[i*3]=Math.cos(h)*side*sp+(Math.random()-.5);spVel[i*3+1]=1+Math.random()*2.2*power;spVel[i*3+2]=Math.sin(h)*side*sp+(Math.random()-.5);spLife[i]=.45+Math.random()*.3;}
  for(let i=0;i<NSP;i++){if(spLife[i]<=0){spPos[i*3+1]=-999;continue;}spLife[i]-=dt;spVel[i*3+1]-=9*dt;spPos[i*3]+=spVel[i*3]*dt;spPos[i*3+1]+=spVel[i*3+1]*dt;spPos[i*3+2]+=spVel[i*3+2]*dt;}
  spGeo.attributes.position.needsUpdate=true;}
 function draw(f:Frame){curFeatures=f.features as never;const fdt=Math.min(.05,Math.max(0,f.clock-lastClock));lastClock=f.clock;stepDebris(fdt);layTracks(f);if(f.bail>0&&!wasBail)shake=1;wasBail=f.bail>0;shake*=Math.exp(-5*fdt);if(assetRevision!==seenAssetRevision){seenAssetRevision=assetRevision;for(const g of chunks.values())disposeGroup(g);chunks.clear();crowds.clear();zone=-999;for(const g of featureMap.values())disposeGroup(g);featureMap.clear();local.signature='';for(const r of remotes.values())r.signature='';}
 const w=canvas.clientWidth,h=canvas.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const chunk=Math.floor(f.y/1000);if(chunk!==zone){zone=chunk;for(let n=chunk-2;n<=chunk+8;n++)if(!chunks.has(n))chunks.set(n,makeTerrain(n));for(const [n,g]of chunks)if(n<chunk-2||n>chunk+8){disposeGroup(g);chunks.delete(n);crowds.delete(n);}}
 const ids=new Set(f.features.map(p=>p.id));for(const feature of f.features)if(!featureMap.has(feature.id))featureMap.set(feature.id,makeFeature(feature));for(const[id,g]of featureMap)if(!ids.has(id)){disposeGroup(g);featureMap.delete(id);}
 if(local.signature!==JSON.stringify(f.outfit)){disposeGroup(local.root);local=rider(f.outfit);}if(f.view==='wardrobe'||f.view==='shop')pose(local,{...f,z:0,angle:f.outfit.gear==='snowboard'?Math.PI/2:0,speed:0,pushPower:0},f.clock);else pose(local,f,f.clock,f.bail,f.spin,f.flip,f.grab);
 for(const peer of f.peers){let r=remotes.get(peer.id);if(!r||r.signature!==JSON.stringify(peer.outfit)){if(r)disposeGroup(r.root);r=rider(peer.outfit,peer.name);remotes.set(peer.id,r);}pose(r,{...peer,pushPhase:peer.motion?.pushPhase,pushPower:peer.motion?.pushPower},f.clock,0,peer.motion?.spin||0,peer.motion?.flip||0,peer.motion?.grab||0);}
 for(const[id,r]of remotes)if(!f.peers.some(p=>p.id===id)){disposeGroup(r.root);remotes.delete(id);}
 const count=Math.min(f.particles.length,220);dust.count=count;for(let i=0;i<count;i++){const p=f.particles[i];dummy.position.set(p.x*S,ground(p.x,p.y)+p.z*S+.08,-p.y*S);dummy.scale.setScalar(p.size*.035);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;

 const py=ground(f.x,f.y);const inMenu=f.view!=='game';const wardrobe=f.view==='wardrobe'||f.view==='shop';
 world.visible=!wardrobe;dust.visible=!wardrobe;remotes.forEach(r=>r.root.visible=!wardrobe);previewFloor.visible=wardrobe;previewFloor.position.set(f.x*S,py-.05,-f.y*S);
 // Camera follows where you are actually going, not where the skis point, so skids read clearly.
 // Teleports (shuttle, restart) snap the camera instead of flying it across the mountain.
 const jumped=Math.hypot(f.x-lastX,f.y-lastY)>100;lastX=f.x;lastY=f.y;
 {const goal=f.speed>20&&f.course!==undefined?f.course:f.angle+(f.fakie?Math.PI:0);if(jumped)camHeading=goal;camHeading+=Math.atan2(Math.sin(goal-camHeading),Math.cos(goal-camHeading))*(1-Math.exp(-fdt*(f.speed>20?5:1)));}
 const heading=inMenu?f.angle:camHeading+(f.settings.debugYaw||0);const dbg=f.settings.debugCam;const dist=f.settings.cameraDistance+(inMenu?0:Math.min(3,f.speed*.006));
 const target=wardrobe?new T.Vector3(f.x*S+3.4,py+1.9,-f.y*S-4.2):inMenu?new T.Vector3(f.x*S+Math.sin(f.clock*.05)*13,py+5.5,-f.y*S+16):new T.Vector3(f.x*S-Math.sin(heading)*dist,py+.8*(f.z+(f.lift||0))*S+4.2-Math.max(0,f.absorb||0)*.45,-f.y*S+Math.cos(heading)*dist);
 if(!wardrobe)target.y=Math.max(target.y,ground(target.x/S,-target.z/S)+3.4);
 if(!camReady||jumped||camera.position.distanceTo(target)>75){camera.position.copy(target);camReady=true;}{const ah=1-Math.exp(-fdt*(inMenu?4:10)),av=1-Math.exp(-fdt*(inMenu?4:5.5));camera.position.x+=(target.x-camera.position.x)*ah;camera.position.z+=(target.z-camera.position.z)*ah;camera.position.y+=(target.y-camera.position.y)*av;}
 // Whatever the smoothing did, never let the camera sink into a slope or a kicker.
 if(!wardrobe){
  // Keep the line of sight clear of crests: sample the ground between the camera and the rider and lift the camera until it clears them.
  const ry=py+(f.z+(f.lift||0))*S+1.5;let need=ground(camera.position.x/S,-camera.position.z/S)+1.6;
  for(let k=1;k<=7;k++){const t=k/8,gx=camera.position.x+(f.x*S-camera.position.x)*t,gz=camera.position.z+(-f.y*S-camera.position.z)*t;need=Math.max(need,(ground(gx/S,-gz/S)+1.4-ry*t)/(1-t));}
  camera.position.y=Math.max(camera.position.y,need);}if(shake>.01&&!inMenu)camera.position.add(new T.Vector3((Math.random()-.5)*shake*.5,(Math.random()-.5)*shake*.4,0));
 if(dbg&&!inMenu){const a=f.angle+dbg.yaw;camera.position.set(f.x*S-Math.sin(a)*dbg.dist,py+(f.z+(f.lift||0))*S+dbg.height,-f.y*S+Math.cos(a)*dbg.dist);camera.lookAt(f.x*S,py+(f.z+(f.lift||0))*S+(dbg.look??1.2),-f.y*S);}
 else if(wardrobe)camera.lookAt(f.x*S,py+1.25,-f.y*S);else if(inMenu)camera.lookAt(f.x*S,py+1,-f.y*S-7);else{const ah2=6+Math.min(10,f.speed*.04),lx=f.x*S+Math.sin(heading)*ah2,lz=-f.y*S-Math.cos(heading)*ah2,want=new T.Vector3(lx,py+.85*(f.z+(f.lift||0))*S+1.3+(ground(lx/S,-lz/S)-py)*.7,lz);if(!lookReady||jumped){camLook.copy(want);lookReady=true;}else camLook.lerp(want,1-Math.exp(-fdt*14));camera.lookAt(camLook);}
 const fov=f.settings.fov+(inMenu?0:Math.min(9,f.speed*.028)+Math.min(5,f.z*S*.4));if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*.08;camera.updateProjectionMatrix();}
 // Broadcast replay cameras: a chase cam, a static side cam, a low cam ahead of the rider, an orbit and a wide. Static cams stay put and pan to follow.
 if(f.cam&&!inMenu){const now=performance.now(),rdt=Math.min(.05,(now-rcT)/1000);rcT=now;const rx=f.x*S,rz=-f.y*S,ry=py+(f.z+(f.lift||0))*S+1,hd=f.course??f.angle,fx=Math.sin(hd),fz=-Math.cos(hd),px=-fz,pz=fx,mode=f.cam.mode,R=new T.Vector3(rx,ry,rz);
  if(f.cam.id!==rcId){rcId=f.cam.id;rcFirst=true;const sd=Math.sin(rcId*12.9898)>0?1:-1;
   if(mode==='side')rcAnchor.set(rx+px*sd*10-fx*3,0,rz+pz*sd*10-fz*3);else if(mode==='low')rcAnchor.set(rx+fx*34+px*sd*3,0,rz+fz*34+pz*sd*3);else rcAnchor.set(rx+px*sd*46-fx*14,0,rz+pz*sd*46-fz*14);
   const g=ground(rcAnchor.x/S,-rcAnchor.z/S);rcAnchor.y=mode==='low'?g+.5:mode==='side'?Math.max(g+.9,ry+1.2):Math.max(g+4,py+16);}
  if(mode==='orbit'){const a=f.cam.t*.55+rcId;rcPos.set(rx+Math.cos(a)*7.5,ry+2.2,rz+Math.sin(a)*7.5);}
  else if(mode==='chase'){const want=new T.Vector3(rx-fx*6.8,ry+2.1,rz-fz*6.8);if(rcFirst)rcPos.copy(want);else rcPos.lerp(want,1-Math.exp(-rdt*8));}
  else rcPos.copy(rcAnchor);
  rcPos.y=Math.max(rcPos.y,ground(rcPos.x/S,-rcPos.z/S)+.5);
  if(rcFirst)rcLook.copy(R);else rcLook.lerp(R,1-Math.exp(-rdt*9));rcFirst=false;
  camera.position.copy(rcPos);camera.lookAt(rcLook);
  const dist=Math.max(2,rcPos.distanceTo(R)),fv=mode==='chase'?56:mode==='orbit'?50:Math.max(16,Math.min(52,2*Math.atan(2.7/dist)*180/Math.PI));camera.fov=fv;camera.updateProjectionMatrix();}
 if(wardrobe){if(!camera.view?.enabled||camera.view.fullWidth!==w||camera.view.fullHeight!==h)camera.setViewOffset(w,h,-w*.23,0,w,h);}else if(camera.view?.enabled)camera.clearViewOffset();
 const quality=f.settings.quality==='high';renderer.shadowMap.enabled=quality;const pixelRatio=quality?Math.min(window.devicePixelRatio,1.5):.8;if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
 {const L=light(f.hour??12);scene.fog!.color.copy(L.sky);renderer.setClearColor(L.sky);hemi.color.copy(L.hemiSky);hemi.intensity=L.hemi;sun.color.copy(L.sun);sun.intensity=L.sunI;sun.position.set(f.x*S+L.dx,py+L.dy,-f.y*S+15);}sun.target.position.set(f.x*S,py,-f.y*S-15);
 updateStreaks(f);updateSpray(f,fdt);
 for(const [n,c] of crowds){if(Math.abs((n+.5)*1000-f.y)<1900)animateCrowd(c,f.clock,f.y);}
 // Chairs: position depends only on the clock, so they keep moving at the same slow pace everywhere. Only chairs near the camera are shown.
 {const t=f.clock;for(const c of chairs){const L=c.L,len=L.y0-L.y1,s=((c.i/c.n)*len+(c.up?1:-1)*t*CHAIR_SPEED+len*10)%len,yy=c.up?L.y1+s:L.y1+(len-s),k=(L.y0-yy)/len,xl=L.x0+(L.x1-L.x0)*k+(c.up?-16:16);
   if(Math.abs(yy-f.y)>1700||wardrobe){c.g.visible=false;continue;}c.g.visible=true;c.g.position.set(xl*S,ground(xl,yy)+8.4,-yy*S);c.g.rotation.y=c.up?0:Math.PI;c.g.rotation.z=Math.sin(t*.8+c.i)*.03;}}
 renderer.render(scene,camera);return{grabErr:local.grabErr};}
 return{draw,destroy(){models.dispose();renderer.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});materials.forEach(m=>m.dispose());}};
}