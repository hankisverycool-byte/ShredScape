import * as T from 'three';
import {createModelAssets} from './model-assets';
import {kitById} from './kits';
import {kickerShape,KICKER,railShape} from './park';
import type {Outfit,Peer,GameSettings} from './game-engine';
import {groundHeight,LOCATIONS} from './world';
type Feature={kind:string;x:number;y:number;size:number;id:string;seed:number};
type Frame={lift?:number;rail?:boolean;fakie?:boolean;course?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string;view:string;settings:GameSettings;x:number;y:number;z:number;angle:number;speed:number;pushPhase:number;pushPower:number;clock:number;bail:number;spin:number;flip:number;grab:number;playing:boolean;outfit:Outfit;features:Feature[];peers:Peer[];particles:{x:number;y:number;z:number;size:number;life:number}[]};
const S=.05, center=(y:number)=>Math.sin(y*.0017)*68+Math.sin(y*.00043)*42;
const hash=(n:number)=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
const ground=groundHeight;
export function createMountain3D(canvas:HTMLCanvasElement){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#accbd2');
 let assetRevision=0,seenAssetRevision=0;const models=createModelAssets(()=>assetRevision++);
 const scene=new T.Scene();scene.fog=new T.Fog('#accbd2',65,190);
 const camera=new T.PerspectiveCamera(57,1,.1,350);
 const hemi=new T.HemisphereLight('#e9faff','#607368',2.2);scene.add(hemi);
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
 function makeTerrain(chunk:number){const group=new T.Group(),start=chunk*1000;const geo=new T.PlaneGeometry(240,50,60,25);geo.rotateX(Math.PI/2);const a=geo.attributes.position;const cs=[];for(let i=0;i<a.count;i++){const xx=a.getX(i)/S,yy=start+(a.getZ(i)+25)/S;a.setY(i,ground(xx,yy));a.setZ(i,-yy*S);const path=Math.abs(xx-center(yy))<235;const color=new T.Color(path?(hash(i+chunk)>.82?'#e4e9df':'#f2f0df'):'#cbded6');cs.push(color.r,color.g,color.b);}geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const terrain=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));terrain.receiveShadow=true;group.add(terrain);

 for(const loc of LOCATIONS){if(Math.floor(loc.y/1000)!==chunk)continue;const landmark=new T.Group();landmark.position.set(loc.x*S,ground(loc.x,loc.y),-loc.y*S);
 const marker=new T.Group();marker.position.set(5,0,0);sign(marker,loc.name.toUpperCase());landmark.add(marker);
 if(loc.id==='summit'||loc.id==='village'){const count=loc.id==='village'?6:1;for(let i=0;i<count;i++){const c=new T.Group();const cx=-9-Math.floor(i/3)*10,cz=(i%3-1)*12;c.position.set(cx,ground(loc.x+cx/S,loc.y-cz/S)-ground(loc.x,loc.y),cz);cabin(c);landmark.add(c);}}
 if(loc.id==='park'){for(let i=0;i<3;i++){const gate=new T.Group();gate.position.set((i-1)*9,0,-10);box(gate,'#c69255',-3,2,0,.2,4,.2);box(gate,'#c69255',3,2,0,.2,4,.2);box(gate,'#364e49',0,4,0,6,.45,.2);landmark.add(gate);}}
 if(loc.id==='lake'){const lake=new T.Mesh(new T.CircleGeometry(14,24),new T.MeshStandardMaterial({color:'#7db6c7',roughness:.18,metalness:.2}));lake.rotation.x=-Math.PI/2;lake.position.y=.08;landmark.add(lake);for(let i=0;i<8;i++){const rock=mesh(sphereGeo,'#b7d4d7',landmark,[Math.sin(i)*15,.4,Math.cos(i)*15],[2,.8,1]);}}
 group.add(landmark);
 }
 for(let i=0;i<2;i++){const yy=start+i*500;const tower=new T.Group();tower.position.set(24,ground(480,yy),-yy*S);box(tower,'#536860',0,5,0,.3,10,.3);box(tower,'#52645b',0,10,0,5,.25,.3);group.add(tower);const cable=box(group,'#586961',22,ground(480,yy)+10,-yy*S-12.5,.035,.035,25.3);cable.rotation.x=-Math.atan(.28);}
 for(let side of [-1,1])for(let i=0;i<5;i++){const peak=mesh(coneGeo,i%2?'#8da7a6':'#7c999a',group,[side*(70+hash(chunk+i)*40),ground(0,start+300)+8,-(start+i*210)*S],[25,35+hash(i+chunk)*25,28]);peak.castShadow=false;}
 world.add(group);return group;}
 function disposeGroup(group:T.Object3D){group.traverse(obj=>{if(obj instanceof T.Mesh&&!obj.geometry.userData.assetShared&&![boxGeo,coneGeo,sphereGeo].includes(obj.geometry))obj.geometry.dispose();if(obj instanceof T.Mesh){const list=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of list)if(!m.userData.assetShared&&![...materials.values()].includes(m as T.MeshStandardMaterial))m.dispose();}if(obj instanceof T.SkinnedMesh)obj.skeleton.dispose();if(obj instanceof T.Sprite){obj.material.map?.dispose();obj.material.dispose();}});group.removeFromParent();}
 function makeFeature(f:Feature){const g=new T.Group();g.position.set(f.x*S,ground(f.x,f.y),-f.y*S);
 if(f.kind==='tree')tree(g,f.size,f.seed);else if(f.kind==='rock')mesh(sphereGeo,'#7c918a',g,[0,.4,0],[1.1*f.size,.8*f.size,.9*f.size]);
 else if(f.kind==='ramp'){
 // Snow kicker: a shaped face rising to the lip, draped over the terrain, with a dyed takeoff line and side markers.
 const k=kickerShape(f),g0=ground(f.x,f.y),N=10,pos:number[]=[],skirt=k.half+12;
 const P=(lx:number,t:number,top:boolean)=>{const wy=k.start+t*k.run;return[lx*S,ground(f.x+lx,wy)-g0+(top?k.height*Math.pow(t,KICKER.curve)*S:-.06),-(wy-f.y)*S];};
 const quad=(a:number[],b:number[],c:number[],d:number[])=>pos.push(...a,...b,...c,...a,...c,...d);
 for(let i=0;i<N;i++){const t0=i/N,t1=(i+1)/N;
  quad(P(-k.half,t0,true),P(k.half,t0,true),P(k.half,t1,true),P(-k.half,t1,true));
  quad(P(-skirt,t0,false),P(-k.half,t0,true),P(-k.half,t1,true),P(-skirt,t1,false));
  quad(P(k.half,t0,true),P(skirt,t0,false),P(skirt,t1,false),P(k.half,t1,true));}
 quad(P(-k.half,1,true),P(k.half,1,true),P(skirt,1,false),P(-skirt,1,false));
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.computeVertexNormals();
 const snow=new T.Mesh(geo,mat('#f3f7f5'));snow.material.side=T.DoubleSide;snow.receiveShadow=true;snow.castShadow=true;g.add(snow);
 const lip=P(0,1,true),line=box(g,'#2f6fd1',0,lip[1]+.015,lip[2]+.1,k.half*2*S,.03,.14);line.castShadow=false;
 for(const sx of [-1,1]){const m=P(sx*(k.half+4),.92,true);box(g,'#e0563a',m[0],m[1]+.3,m[2],.07,.9,.07);}
 }
 else if(f.kind==='rail'){
 // Rail or box, pitched to follow the slope under it.
 const r=railShape(f),g0=ground(f.x,f.y),gA=ground(f.x,r.start)-g0,gB=ground(f.x,r.end)-g0,len=r.len*S,h=r.height*S;
 const bar=new T.Group();bar.position.set(0,(gA+gB)/2+h,0);bar.rotation.x=-Math.atan2(gA-gB,len);g.add(bar);
 if(r.box){box(bar,'#eef2f0',0,-.06,0,r.half*2*S,.12,len);for(const sx of [-1,1])box(bar,f.seed%4===1?'#2f6fd1':'#d6453b',sx*r.half*S,-.3,0,.05,.42,len);box(bar,'#3d4a46',0,-h/2-.1,0,r.half*1.2*S,h-.2,len*.9);}
 else{box(bar,'#edb957',0,-.05,0,.16,.1,len);for(const zp of [-.42,0,.42])box(bar,'#53665a',0,-h/2,zp*len,.11,h,.11);}
 }
 else if(f.kind==='gate'){
 // GS gate: two poles with panel flags facing in, alternating red/blue.
 const half=f.size*S/2,c=f.seed%2?'#d6453b':'#2f6fd1';
 for(const sx of [-half,half]){box(g,'#f4f4ec',sx,.95,0,.06,1.9,.06);box(g,c,sx+(sx<0?.38:-.38),1.5,0,.76,.62,.03);}
 }else if(f.kind==='start'||f.kind==='finish'){
 const half=f.size*S/2,c=f.kind==='start'?'#2f6fd1':'#d6453b';
 for(const sx of [-half,half])box(g,'#e9e9df',sx,2.1,0,.22,4.2,.22);
 box(g,c,0,4.05,0,half*2,.7,.12);const l=label(f.kind==='start'?'START · FROSTPEAK GS':'FINISH');l.scale.set(9,1.7,1);l.position.set(0,5.1,0);g.add(l);
 }
 else{box(g,'#8c7652',0,1,0,.07,2,.07);box(g,f.seed%2?'#d89b5d':'#91ae92',.42,1.8,0,.85,.5,.04);}world.add(g);return g;}
 type Rider={imported:ReturnType<ReturnType<typeof createModelAssets>['rider']>;root:T.Group;stunt:T.Group;body:T.Group;armL:T.Group;armR:T.Group;legL:T.Group;legR:T.Group;kneeL:T.Group;kneeR:T.Group;elbowL:T.Group;elbowR:T.Group;skiL:T.Group;skiR:T.Group;signature:string;lastAngle:number;lastTime:number;lean:number;gear:Outfit['gear'];equipment:T.Object3D[];rag:Rag|null;land:number;airStart:number;wasAir:boolean;edgeSign:number;release:number;boardG:T.Group;contact:number;normals:T.Vector3[];torso:T.Group;poles:T.Group[]};
 type Rag={start:number;tumble:number;tumbleV:number;yaw:number;yawV:number;h:number;hV:number;seed:number};
 type Debris={obj:T.Object3D;owner:Rider;vel:T.Vector3;spin:T.Vector3};const debris:Debris[]=[];
 const outfitAvatar=(o:Outfit)=>o.avatar||'explorer';
 function rider(o:Outfit,name?:string):Rider{
 const root=new T.Group(),stunt=new T.Group(),body=new T.Group();stunt.position.y=1.3;root.add(stunt);body.position.y=-1.3;stunt.add(body);
 // Hand-built faceted silhouette: broad shoulders, narrow waist, long tapered legs.
 // Upper body pivots at the waist. `up` keeps the original body-space coordinates for everything on the torso.
 const torso=new T.Group(),up=new T.Group();torso.position.y=1.25;up.position.y=-1.25;body.add(torso);torso.add(up);
 const chest=mesh(new T.CylinderGeometry(.43,.285,.84,6),o.jacket,up,[0,1.77,0],[1,1,.61]);chest.rotation.y=Math.PI/6;
 mesh(new T.CylinderGeometry(.29,.31,.18,6),o.jacket,body,[0,1.30,0],[1,1,.7]);
 box(body,'#694334',0,1.22,0,.62,.08,.38);
 mesh(new T.CylinderGeometry(.105,.12,.17,6),'#b99372',up,[0,2.22,0],[1,1,1]);
 mesh(new T.SphereGeometry(1,6,4),'#bd9977',up,[0,2.43,0],[.185,.245,.18]);
 box(up,'#30291f',-.069,2.46,-.162,.047,.025,.018);box(up,'#30291f',.069,2.46,-.162,.047,.025,.018);
 mesh(new T.ConeGeometry(.06,.12,4),'#ad8765',up,[0,2.39,-.18],[.7,1,1]).rotation.x=-Math.PI/2;
 mesh(new T.CylinderGeometry(.11,.045,.19,5),'#51442e',up,[0,2.30,-.09],[1,1,.8]);
 mesh(new T.CylinderGeometry(.187,.187,.045,6),o.hat,up,[0,2.52,0],[1,1,1]);
 box(up,'#14181a',0,2.45,-.17,.34,.09,.05);box(up,kitById(o.kit).lens,0,2.45,-.2,.3,.065,.02); // goggles
 function limb(px:number,py:number,c:string,length:number,leg=false){
 const pivot=new T.Group();pivot.position.set(px,py,0);(leg?body:up).add(pivot);
 const upper=mesh(new T.CylinderGeometry(leg?.19:.18,leg?.135:.115,length*.51,5),c,pivot,[0,-length*.245,0],[1,1,leg?.95:1]);upper.rotation.y=Math.PI/5;
 if(!leg)mesh(new T.CylinderGeometry(.23,.18,.28,5),o.jacket,pivot,[0,-.09,0],[1,1,1]);
 const joint=new T.Group();joint.position.set(0,-length*.49,0);pivot.add(joint);
 mesh(new T.CylinderGeometry(leg?.15:.115,leg?.075:.08,length*.47,5),leg?c:'#bd9977',joint,[0,-length*.23,0],[1,1,1]);
 if(!leg)mesh(new T.CylinderGeometry(.09,.085,.12,5),o.hat,joint,[0,-length*.41,0],[1,1,1]);
 box(joint,leg?'#574331':kitById(o.kit).glove,0,-length*.47,leg?-.075:0,leg?.22:.14,leg?.19:.17,leg?.39:.16);return {pivot,joint};}
 const aL=limb(-.43,2.08,o.jacket,.94),aR=limb(.43,2.08,o.jacket,.94),lL=limb(-.20,1.25,o.pants,1.15,true),lR=limb(.20,1.25,o.pants,1.15,true);
 const imported=outfitAvatar(o)==='explorer'?models.rider(o):null;if(imported){body.traverse(n=>{if(n instanceof T.Mesh)n.visible=false;});body.add(imported.root);}
 const skiL=new T.Group(),skiR=new T.Group();body.add(skiL,skiR);
 const boardG=new T.Group(),poles:T.Group[]=[];body.add(boardG);
 if(o.gear==='snowboard'){const equipment=models.snowboard();if(equipment){boardG.add(equipment);}else{box(boardG,'#dad1af',0,.025,0,1.9,.065,.40);box(boardG,o.hat,.48,.065,0,.35,.01,.38);for(const xx of [-.95,.95]){const tip=box(boardG,'#344c4a',xx,.055,0,.18,.07,.38);tip.rotation.z=xx>0?.28:-.28;}}}
 else{
 for(const [g,xx] of [[skiL,-.20],[skiR,.20]] as const){g.position.x=xx;const equipment=models.ski();if(equipment){g.add(equipment);}else{box(g,'#d4ab63',0,.03,-.12,.17,.065,2.1);box(g,o.hat,0,.07,-.9,.17,.05,.35);}}
 for(const elbow of imported?[imported.handL,imported.handR]:[aL.joint,aR.joint]){const pole=new T.Group();pole.position.set(0,imported?0:-.44,0);if(imported)pole.scale.y=1.15;elbow.add(pole);poles.push(pole);box(pole,'#9baba2',0,-.58,0,.025,1.16,.025);box(pole,'#34443c',0,.04,0,.06,.18,.06);box(pole,'#34443c',0,-1.08,0,.15,.035,.15);}
 }
 if(name){const tag=label(name);tag.scale.set(2.8,.53,1);tag.position.y=3;root.add(tag);}scene.add(root);
 return{imported,root,stunt,body,armL:aL.pivot,armR:aR.pivot,legL:lL.pivot,legR:lR.pivot,kneeL:lL.joint,kneeR:lR.joint,elbowL:aL.joint,elbowR:aR.joint,skiL,skiR,signature:JSON.stringify(o),lastAngle:0,lastTime:0,lean:0,gear:o.gear,equipment:[boardG,skiL,skiR,...poles].filter(g=>g.children.length),rag:null,land:0,airStart:0,wasAir:false,edgeSign:0,release:0,boardG,contact:0,normals:[new T.Vector3(0,1,0),new T.Vector3(0,1,0)],torso,poles};
 }
 let local=rider({jacket:'#da744f',pants:'#374854',hat:'#e5b95f',gear:'snowboard'});const remotes=new Map<string,Rider>();
 const previewFloor=new T.Mesh(new T.CircleGeometry(30,48),mat('#40594e'));previewFloor.rotation.x=-Math.PI/2;previewFloor.receiveShadow=true;scene.add(previewFloor);
 const dust=new T.InstancedMesh(sphereGeo,mat('#f4f8e9'),220);dust.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(dust);const dummy=new T.Object3D();
 const liftChairs:T.Group[]=[];for(let i=0;i<8;i++){const g=new T.Group();box(g,'#52665d',0,1,0,.06,2,.06);box(g,'#df9c62',0,0,0,1.6,.12,.8);box(g,'#596f65',0,.35,.35,1.6,.7,.08);scene.add(g);liftChairs.push(g);}
 let width=0,height=0,camReady=false,zone=-999,lastClock=0,shake=0,wasBail=false,camHeading=0,lastX=0,lastY=0;
 // Ski tracks: one ribbon per ski (one for a board). Thin when carving, wide smears when skidding.
 const trackMat=new T.MeshBasicMaterial({color:'#aebfc2',transparent:true,opacity:.45,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,side:T.DoubleSide});
 type TrackPt={x:number;y:number;z:number;nx:number;nz:number;w:number;gap:boolean};
 const tracks=[0,1].map(()=>{const mesh=new T.Mesh(new T.BufferGeometry(),trackMat);mesh.frustumCulled=false;scene.add(mesh);return{pts:[] as TrackPt[],broken:true,mesh};});
 function layTracks(f:Frame){const board=f.outfit.gear==='snowboard';tracks[1].mesh.visible=!board;
  if(f.view!=='game'||f.z>0||(f.lift||0)>0||f.bail>0||f.speed<6){for(const t of tracks)t.broken=true;return;}
  const h=f.angle,c=f.course??f.angle,slip=Math.abs(Math.sin(h-c));
  (board?[0]:[-.2,.2]).forEach((o,i)=>{const t=tracks[i],x=f.x*S+Math.cos(h)*o,z=-f.y*S+Math.sin(h)*o,last=t.pts[t.pts.length-1],d=last?Math.hypot(last.x-x,last.z-z):99;
   if(d<.35)return;if(d>40)t.pts=[];
   t.pts.push({x,z,y:ground(x/S,-z/S)+.07,nx:Math.cos(c),nz:Math.sin(c),w:(board?.28:.07)+slip*(board?1.4:1.1),gap:t.broken||d>4});t.broken=false;if(t.pts.length>400)t.pts.shift();
   const v:number[]=[];for(let k=1;k<t.pts.length;k++){const a=t.pts[k-1],b=t.pts[k];if(b.gap)continue;const ax=a.nx*a.w/2,az=a.nz*a.w/2,bx=b.nx*b.w/2,bz=b.nz*b.w/2;
    v.push(a.x-ax,a.y,a.z-az,a.x+ax,a.y,a.z+az,b.x+bx,b.y,b.z+bz,a.x-ax,a.y,a.z-az,b.x+bx,b.y,b.z+bz,b.x-bx,b.y,b.z-bz);}
   t.mesh.geometry.dispose();t.mesh.geometry=new T.BufferGeometry();t.mesh.geometry.setAttribute('position',new T.Float32BufferAttribute(v,3));});}
 type Motion={lift?:number;rail?:boolean;fakie?:boolean;x:number;y:number;z:number;angle:number;speed?:number;pushPhase?:number;pushPower?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string};
 function pose(r:Rider,p:Motion,t:number,bail=0,spin=0,flip=0,grab=0){
 const dt=Math.max(.001,t-r.lastTime),delta=Math.atan2(Math.sin(p.angle-r.lastAngle),Math.cos(p.angle-r.lastAngle));
 const maxLean=r.gear==='snowboard'?.36:.42,targetLean=p.edge!==undefined?p.edge*maxLean*(p.fakie?-1:1):r.lastTime?Math.max(-maxLean,Math.min(maxLean,-delta/dt*.18)):0;r.lean+=(targetLean-r.lean)*Math.min(1,dt*9);r.lastAngle=p.angle;r.lastTime=t;
 const airborne=p.z>0,moving=(p.speed||0)>10,board=r.gear==='snowboard',power=airborne||bail?0:p.pushPower||0;
 // Takeoff: legs extend, then tuck. Landing: a quick squash that springs back.
 if(airborne&&!r.wasAir)r.airStart=t;if(!airborne&&r.wasAir&&!bail)r.land=1;r.wasAir=airborne;r.land*=Math.exp(-7*dt);
 const tuck=airborne?Math.min(1,(t-r.airStart)/.25):0,squash=r.land;
 // Edge change: legs soften and the skis go briefly flat before rolling onto the new edges.
 const sign=Math.abs(p.edge||0)>.12?Math.sign(p.edge||0):0;if(sign&&r.edgeSign&&sign!==r.edgeSign)r.release=1;if(sign)r.edgeSign=sign;r.release*=Math.exp(-6*dt);
 const skid=airborne?0:p.skid||0,soak=airborne?0:Math.max(-.12,p.absorb||0)+r.release*.25+skid*.3+(p.rail?.25:0),edgeAmt=airborne||bail?0:r.lean/maxLean*(1-r.release*.6);
 // Upper body: forward stance, fold into pole pushes, tuck in the air, counter-lean (angulation) in carves, look back in switch.
 const onRail=!!p.rail&&!airborne;
 const fold=board?0:Math.max(0,-Math.cos(p.pushPhase||0))*power*.3+power*.12;
 const upper={pitch:bail?0:-(board?(grab?.25:0):(moving?.16:.04)+fold+skid*.12+tuck*(grab?.5:.22)+squash*.25),yaw:p.fakie&&!board&&!airborne?.6:0,roll:airborne?0:-r.lean*.45,balance:onRail?1:0};
 r.torso.rotation.set(upper.pitch,upper.yaw,upper.roll);
 r.imported?.pose(p.pushPhase||0,power,airborne,grab,board,airborne?tuck:squash*.8+soak,moving,edgeAmt,upper);
 const stride=Math.sin(p.pushPhase||0)*power,recovery=Math.max(0,Math.cos(p.pushPhase||0))*power;
 r.root.position.set(p.x*S,ground(p.x,p.y)+(p.z+(p.lift||0))*S+.1,-p.y*S);r.root.rotation.y=-p.angle;
 // Flips rotate around the hips, with equipment carried through the motion.
 r.stunt.rotation.set(flip+(p.backseat||0)*.3,spin,r.lean*(1-r.release*.6));r.stunt.position.y=1.3;
 // Powder: skis sink, floating up with speed. Ice: edges chatter when they slip.
 if(!airborne&&p.snow==='powder')r.root.position.y-=.1-.06*Math.min(1,(p.speed||0)/220);
 if(!airborne&&p.snow==='ice'&&skid>.15){r.stunt.rotation.z+=(Math.random()-.5)*.08*skid;r.root.position.y+=Math.random()*.03*skid;}
 r.body.rotation.set(0,board?Math.PI/2:0,board?-power*.16:0);
 const bend=airborne?.12+tuck*(grab?.58:.26):(moving?(board?.34:.28):.10)+squash*.55+soak;
 r.body.position.y=-1.3-bend*.13+Math.sin(t*5)*.008;
 r.armL.rotation.set(grab?-.95:airborne?-.5:moving?-.25:.04,0,grab?.1:board?-.45:airborne?-.4:-.14);
 r.armR.rotation.set(grab?.35:airborne?-.5:moving?-.25:-.04,0,grab?1.05:board?.45:airborne?.4:.14);
 r.elbowL.rotation.x=r.elbowR.rotation.x=grab?-.85:moving?-.4:-.12;
 if(onRail){r.armL.rotation.z=-.95;r.armR.rotation.z=.95;} // arms wide for balance on a rail
 r.legL.position.set(-.20,1.25,0);r.legR.position.set(.20,1.25,0);
 r.legL.rotation.set(bend,0,board?-.25:0);r.legR.rotation.set(bend,0,board?.25:0);r.kneeL.rotation.x=r.kneeR.rotation.x=-bend*1.7;
 r.skiL.position.set(-.20,0,-(p.backseat||0)*.3);r.skiR.position.set(.20,0,-(p.backseat||0)*.3);r.body.position.x=0;r.boardG.position.set(0,0,0);
 // Boots stay on the snow while the knees bend; the body drops, not the feet.
 if(!airborne)r.root.position.y+=bend*.13-.04;
 // Switch on skis: lean slightly into the tails (the chest turns to look back, the boots stay on the skis).
 if(p.fakie&&!board&&!airborne&&!bail)r.stunt.rotation.x+=.08;
 if(!board&&!airborne&&!bail&&Math.abs(edgeAmt)>.02){
  // Weight on the outside ski: outside leg long, inside leg folded and light, inside ski leads a touch. Hips drop into the turn.
  const e=Math.abs(edgeAmt),left=edgeAmt>0,[legIn,legOut,kneeIn,skiIn]=left?[r.legL,r.legR,r.kneeL,r.skiL]:[r.legR,r.legL,r.kneeR,r.skiR];
  legIn.rotation.x+=.3*e;kneeIn.rotation.x-=.5*e;legOut.rotation.x-=.1*e;skiIn.position.y=.04*e;skiIn.position.z-=.12*e;r.body.position.x=-edgeAmt*.12;
 }
 if(power>.001&&board){
 // Front boot stays bound; rear boot steps beside the board and sweeps backward.
 r.legL.position.x=-.20+stride*.32;r.legL.position.z=power*.37;r.legL.position.y+=recovery*.11;
 r.legL.rotation.z=stride*.48;r.legL.rotation.x=.12;r.kneeL.rotation.x=-.22-recovery*.42;
 r.armL.rotation.x=-stride*.45;r.armR.rotation.x=stride*.35;r.armL.rotation.z=-.55;r.armR.rotation.z=.45;
 }else if(power>.001){
 // Double-pole: skis stay parallel, both poles plant together, legs fold on the push.
 const reach=Math.cos(p.pushPhase||0)*power;
 r.legL.rotation.x=r.legR.rotation.x=bend+.1+Math.max(0,-reach)*.25;r.kneeL.rotation.x=r.kneeR.rotation.x=-(bend+.1)*1.7;
 r.armL.rotation.x=r.armR.rotation.x=-.4-reach*.9;r.elbowL.rotation.x=r.elbowR.rotation.x=-.3;
 }
 settleGear(r,p,airborne||bail>0||(p.lift||0)>0,dt,edgeAmt);
 // Poles are aimed in the rider's frame, not the forearm's: tips trail back when gliding or in the air, swing through the plant when pushing.
 if(r.poles.length){r.root.updateMatrixWorld(true);r.stunt.getWorldQuaternion(_q);
  const tilt=power>.05?.35*Math.cos(p.pushPhase||0)-.45:airborne?-1.2:moving?-.8:-.22;
  r.poles.forEach((pole,i)=>{_q3.setFromEuler(_e.set(tilt,0,(i?-1:1)*(airborne||moving?.12:.2)));pole.parent!.getWorldQuaternion(_q2);pole.quaternion.copy(_q2.invert().multiply(_q).multiply(_q3));});}
 if(bail>0)ragdoll(r,p,t,dt,bail);else if(r.rag){r.rag=null;for(const g of r.equipment)g.visible=true;for(let i=debris.length-1;i>=0;i--)if(debris[i].owner===r){debris[i].obj.removeFromParent();debris.splice(i,1);}}
 }
 // Skis/board rest on the snow under each one: pitch with the slope, roll with sidehills and edge angle.
 // The terrain normal is sampled across the ski's length (smooths small bumps) and low-passed over time.
 // In the air the gear follows the rider's pose; contact blends back in after landing.
 const UP=new T.Vector3(0,1,0),_q=new T.Quaternion(),_q2=new T.Quaternion(),_q3=new T.Quaternion(),_v=new T.Vector3(),_n=new T.Vector3(),_e=new T.Euler();
 function settleGear(r:Rider,p:Motion,lifted:boolean,dt:number,edgeAmt:number){
  r.contact+=((lifted?0:1)-r.contact)*Math.min(1,dt*(lifted?14:9));
  const board=r.gear==='snowboard',parts=board?[r.boardG]:[r.skiL,r.skiR];
  for(const g of parts)g.quaternion.identity();
  if(r.contact<.01)return;
  r.root.updateMatrixWorld(true);
  const fx=Math.sin(p.angle),fy=Math.cos(p.angle),half=1.1/S,d=half,sink=p.snow==='powder'?.03:p.snow==='ice'?-.08:0; // powder: bases just under the surface, top sheets still visible; // lake ice surface sits slightly above the terrain
  parts.forEach((g,i)=>{
   g.getWorldPosition(_v);const gx=_v.x/S,gy=-_v.z/S;
   const hX=(ground(gx+d,gy)-ground(gx-d,gy))/(2*d*S),hY=(ground(gx,gy+d)-ground(gx,gy-d))/(2*d*S);
   _n.set(-hX,1,hY).normalize();r.normals[i].lerp(_n,Math.min(1,dt*14)).normalize();
   // world orientation = terrain tilt * heading yaw (* board's sideways mount) * edge roll about the long axis
   _q.setFromUnitVectors(UP,r.normals[i]);
   _q2.setFromEuler(_e.set(0,-p.angle+(board?Math.PI/2:0),0));_q.multiply(_q2);
   _q3.setFromEuler(board?_e.set(edgeAmt*.5,0,0):_e.set(0,0,edgeAmt*.55));_q.multiply(_q3);
   g.parent!.getWorldQuaternion(_q2);g.quaternion.copy(_q2.invert().multiply(_q)).slerp(_q3.identity(),1-r.contact);
   // Height: rest on whichever is higher, the snow under the binding or the tip-tail chord (bridges dips, never clips crests).
   const h=ground(gx,gy),chord=(ground(gx+fx*half,gy+fy*half)+ground(gx-fx*half,gy-fy*half))/2,target=Math.max(h,chord)+.015-sink;
   const wy=_v.y;_v.y=wy+(target-wy)*r.contact;g.parent!.worldToLocal(_v);g.position.copy(_v);
  });
 }
 // Procedural ragdoll: the body tumbles and bounces with momentum, limbs flail on damped springs,
 // and the gear flies off as loose debris (the "yard sale"). Last 0.35s blends back to standing.
 function ragdoll(r:Rider,p:{x:number;y:number;angle:number;speed?:number},t:number,dt:number,bail:number){
  const speed=Math.min(p.speed||0,320);
  if(!r.rag){
   r.rag={start:t,tumble:0,tumbleV:3+speed/38,yaw:0,yawV:(Math.random()-.5)*7,h:.25,hV:2.5+speed/90,seed:Math.random()*10};
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
 }
 function stepDebris(dt:number){for(const d of debris){const o=d.obj;d.vel.y-=20*dt;o.position.addScaledVector(d.vel,dt);o.rotation.x+=d.spin.x*dt;o.rotation.y+=d.spin.y*dt;o.rotation.z+=d.spin.z*dt;
  const floor=ground(o.position.x/S,-o.position.z/S)+.06;if(o.position.y<floor){o.position.y=floor;d.vel.y=Math.abs(d.vel.y)>1?-d.vel.y*.3:0;d.vel.x*=.6;d.vel.z*=.6;d.spin.multiplyScalar(.55);}}}
 function draw(f:Frame){const fdt=Math.min(.05,Math.max(0,f.clock-lastClock));lastClock=f.clock;stepDebris(fdt);layTracks(f);if(f.bail>0&&!wasBail)shake=1;wasBail=f.bail>0;shake*=Math.exp(-5*fdt);if(assetRevision!==seenAssetRevision){seenAssetRevision=assetRevision;for(const g of featureMap.values())disposeGroup(g);featureMap.clear();local.signature='';for(const r of remotes.values())r.signature='';}
 const w=canvas.clientWidth,h=canvas.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const chunk=Math.floor(f.y/1000);if(chunk!==zone){zone=chunk;for(let n=chunk-2;n<=chunk+4;n++)if(!chunks.has(n))chunks.set(n,makeTerrain(n));for(const [n,g]of chunks)if(n<chunk-2||n>chunk+4){disposeGroup(g);chunks.delete(n);}}
 const ids=new Set(f.features.map(p=>p.id));for(const feature of f.features)if(!featureMap.has(feature.id))featureMap.set(feature.id,makeFeature(feature));for(const[id,g]of featureMap)if(!ids.has(id)){disposeGroup(g);featureMap.delete(id);}
 if(local.signature!==JSON.stringify(f.outfit)){disposeGroup(local.root);local=rider(f.outfit);}if(f.view==='wardrobe'||f.view==='shop')pose(local,{...f,z:0,angle:f.outfit.gear==='snowboard'?Math.PI/2:0,speed:0,pushPower:0},f.clock);else pose(local,f,f.clock,f.bail,f.spin,f.flip,f.grab);
 for(const peer of f.peers){let r=remotes.get(peer.id);if(!r||r.signature!==JSON.stringify(peer.outfit)){if(r)disposeGroup(r.root);r=rider(peer.outfit,peer.name);remotes.set(peer.id,r);}pose(r,{...peer,pushPhase:peer.motion?.pushPhase,pushPower:peer.motion?.pushPower},f.clock,0,peer.motion?.spin||0,peer.motion?.flip||0,peer.motion?.grab||0);}
 for(const[id,r]of remotes)if(!f.peers.some(p=>p.id===id)){disposeGroup(r.root);remotes.delete(id);}
 const count=Math.min(f.particles.length,220);dust.count=count;for(let i=0;i<count;i++){const p=f.particles[i];dummy.position.set(p.x*S,ground(p.x,p.y)+p.z*S+.08,-p.y*S);dummy.scale.setScalar(p.size*.035);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;

 const py=ground(f.x,f.y);const inMenu=f.view!=='game';const wardrobe=f.view==='wardrobe'||f.view==='shop';
 world.visible=!wardrobe;dust.visible=!wardrobe;remotes.forEach(r=>r.root.visible=!wardrobe);liftChairs.forEach(c=>c.visible=!wardrobe);previewFloor.visible=wardrobe;previewFloor.position.set(f.x*S,py-.05,-f.y*S);
 // Camera follows where you are actually going, not where the skis point, so skids read clearly.
 // Teleports (shuttle, restart) snap the camera instead of flying it across the mountain.
 const jumped=Math.hypot(f.x-lastX,f.y-lastY)>100;lastX=f.x;lastY=f.y;
 {const goal=f.speed>20&&f.course!==undefined?f.course:f.angle+(f.fakie?Math.PI:0);if(jumped)camHeading=goal;camHeading+=Math.atan2(Math.sin(goal-camHeading),Math.cos(goal-camHeading))*Math.min(1,fdt*(f.speed>20?4:.8));}
 const heading=inMenu?f.angle:camHeading+(f.settings.debugYaw||0);const dbg=f.settings.debugCam;const dist=f.settings.cameraDistance;
 const target=wardrobe?new T.Vector3(f.x*S+3.4,py+1.9,-f.y*S-4.2):inMenu?new T.Vector3(f.x*S+Math.sin(f.clock*.05)*13,py+5.5,-f.y*S+16):new T.Vector3(f.x*S-Math.sin(heading)*dist,py+4.5+f.z*S*.35,-f.y*S+Math.cos(heading)*dist);
 if(!camReady||jumped||camera.position.distanceTo(target)>75){camera.position.copy(target);camReady=true;}camera.position.lerp(target,.065);if(shake>.01&&!inMenu)camera.position.add(new T.Vector3((Math.random()-.5)*shake*.5,(Math.random()-.5)*shake*.4,0));
 if(dbg&&!inMenu){const a=f.angle+dbg.yaw;camera.position.set(f.x*S-Math.sin(a)*dbg.dist,py+(f.z+(f.lift||0))*S+dbg.height,-f.y*S+Math.cos(a)*dbg.dist);camera.lookAt(f.x*S,py+(f.z+(f.lift||0))*S+1.2,-f.y*S);}
 else if(wardrobe)camera.lookAt(f.x*S,py+1.25,-f.y*S);else if(inMenu)camera.lookAt(f.x*S,py+1,-f.y*S-7);else camera.lookAt(f.x*S+Math.sin(heading)*7,py+1,-f.y*S-Math.cos(heading)*7);
 const fov=f.settings.fov+(inMenu?0:Math.min(9,f.speed*.028));if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*.08;camera.updateProjectionMatrix();}
 if(wardrobe){if(!camera.view?.enabled||camera.view.fullWidth!==w||camera.view.fullHeight!==h)camera.setViewOffset(w,h,-w*.23,0,w,h);}else if(camera.view?.enabled)camera.clearViewOffset();
 const quality=f.settings.quality==='high';renderer.shadowMap.enabled=quality;const pixelRatio=quality?Math.min(window.devicePixelRatio,1.5):.8;if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
 sun.position.set(f.x*S+25,py+45,-f.y*S+15);sun.target.position.set(f.x*S,py,-f.y*S-15);
 liftChairs.forEach((g,i)=>{const yy=f.y-500+((i*250+f.clock*45)%2000);g.position.set(22,ground(480,yy)+8,-yy*S);g.rotation.z=Math.sin(f.clock+i)*.035;});
 renderer.render(scene,camera);}
 return{draw,destroy(){models.dispose();renderer.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});materials.forEach(m=>m.dispose());}};
}