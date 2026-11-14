import * as T from 'three';
import {createModelAssets} from './model-assets';
import {kitById} from './kits';
import {kickerShape,kickerSurface,kickerBack,railShape} from './park';
import {COURSE} from './race';
import {computePose,blendPose,pushWeight,type PoseIn,type PoseOut} from './rig-pose';
import {solveLeg,type Rig,type Leg} from './rig';
import type {Outfit,Peer,GameSettings} from './game-engine';
import {groundHeight,LANDMARKS,LIFTS,LAKE,BOUNDS,onTrail,zoneAt,forestAt,type Lift} from './world';
type Feature={kind:string;x:number;y:number;size:number;id:string;seed:number};
type Frame={tuck?:number;lift?:number;rail?:boolean;fakie?:boolean;course?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string;view:string;settings:GameSettings;x:number;y:number;z:number;angle:number;speed:number;pushPhase:number;pushPower:number;clock:number;bail:number;spin:number;flip:number;grab:number;playing:boolean;outfit:Outfit;features:Feature[];peers:Peer[];particles:{x:number;y:number;z:number;size:number;life:number}[]};
const S=.05;
const hash=(n:number)=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
const ground=groundHeight;
export function createMountain3D(canvas:HTMLCanvasElement){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#accbd2');
 let assetRevision=0,seenAssetRevision=0;const models=createModelAssets(()=>assetRevision++);
 const scene=new T.Scene();scene.fog=new T.Fog('#accbd2',90,260);
 const camera=new T.PerspectiveCamera(57,1,.1,450);
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
 const C_ON=[new T.Color('#f2f0df'),new T.Color('#e4e9df')],C_PARK=new T.Color('#fbfcf8'),C_OFF=new T.Color('#cbded6'),C_FOREST=new T.Color('#a9c9b7'),C_ROCK=new T.Color('#8f9fa3'),C_ICE=new T.Color('#c3e4ec'),_c=new T.Color();
 // Terrain chunk: 1000 engine units of mountain, the full width of the world. Colour says what the snow is: groomed, park, off-piste, forest, bare rock on the steeps, ice.
 function makeTerrain(chunk:number){const group=new T.Group(),start=chunk*1000,width=(BOUNDS.maxX-BOUNDS.minX+400)*S;const geo=new T.PlaneGeometry(width,50,104,25);geo.rotateX(Math.PI/2);const a=geo.attributes.position;const cs:number[]=[];
 for(let i=0;i<a.count;i++){const xx=a.getX(i)/S,yy=start+(a.getZ(i)+25)/S,h=ground(xx,yy);a.setY(i,h);a.setZ(i,-yy*S);
  const steep=Math.hypot(ground(xx+40,yy)-ground(xx-40,yy),ground(xx,yy+40)-ground(xx,yy-40))/80,z=zoneAt(xx,yy);
  if(z&&z.kind==='lake'&&Math.hypot(xx-LAKE.x,yy-LAKE.y)<LAKE.r)_c.copy(C_ICE);
  else if(onTrail(xx,yy))_c.copy(z&&z.kind==='park'?C_PARK:C_ON[hash(i+chunk)>.82?1:0]);
  else{_c.copy(C_OFF).lerp(C_FOREST,Math.min(1,forestAt(xx,yy)*1.1));}
  if(steep>.055)_c.lerp(C_ROCK,Math.min(.75,(steep-.055)*9)); // bare rock where it is too steep for snow to stay
  cs.push(_c.r,_c.g,_c.b);}
 geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const terrain=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));terrain.receiveShadow=true;group.add(terrain);
 const rel=(x:number,y:number,x0:number,y0:number)=>ground(x,y)-ground(x0,y0);
 for(const lm of LANDMARKS){if(Math.floor(lm.y/1000)!==chunk)continue;const g=new T.Group();g.position.set(lm.x*S,ground(lm.x,lm.y),-lm.y*S);
  if(lm.kind==='village'||lm.kind==='lodge'){
   const n=lm.count||1,cols=Math.min(4,n);for(let i=0;i<n;i++){const c=new T.Group(),cx=(i%cols-(cols-1)/2)*11,cz=Math.floor(i/cols)*10-4;c.position.set(cx,rel(lm.x+cx/S,lm.y-cz/S,lm.x,lm.y),cz);c.rotation.y=(hash(i+lm.x)-.5)*.3;cabin(c);g.add(c);}
   const m=new T.Group();m.position.set(0,0,-9);sign(m,lm.name);g.add(m);
  }else if(lm.kind==='parkgate'){ // an arch over the top of the park with its name on it
   const half=Math.min((lm.r||300)*S*.8,15);for(const sx of [-half,half])box(g,'#c69255',sx,5.2,0,.16,10.4,.16);box(g,'#364e49',0,10.4,0,half*2+.4,.4,.16);const l=label(lm.name);l.scale.set(8,1.5,1);l.position.set(0,11.8,0);g.add(l); // high enough that the chase camera rides under it
  }else if(lm.kind==='lake'){const lake=new T.Mesh(new T.CircleGeometry((lm.r||260)*S,36),new T.MeshStandardMaterial({color:'#a9d6e3',roughness:.15,metalness:.2}));lake.rotation.x=-Math.PI/2;lake.position.y=.09;g.add(lake);const l=label(lm.name);l.position.set(0,3,0);g.add(l);}
  group.add(g);}
 // Lifts: pylons every 600 units with a cable between them.
 for(const L of LIFTS){const len=L.y0-L.y1,pt=(y:number)=>{const k=(L.y0-y)/len;return new T.Vector3((L.x0+(L.x1-L.x0)*k)*S,ground(L.x0+(L.x1-L.x0)*k,y)+10,-y*S);};
  for(let y=L.y1;y<=L.y0;y+=600){if(y<start||y>=start+1000)continue;const p=pt(y);const tw=new T.Group();tw.position.set(p.x,p.y-10,p.z);box(tw,'#536860',0,5,0,.3,10,.3);box(tw,'#52645b',0,10,0,4,.25,.3);group.add(tw);
   const q=pt(Math.min(L.y0,y+600)),mid=p.clone().add(q).multiplyScalar(.5),cable=box(group,'#586961',0,0,0,.04,.04,1);cable.position.copy(mid);cable.scale.z=p.distanceTo(q);cable.lookAt(q);cable.castShadow=false;}}
 // Far peaks: a ring of tall cones beyond the playable walls, and a back wall behind the summits.
 for(const side of [-1,1])for(let i=0;i<4;i++){const peak=mesh(coneGeo,i%2?'#8da7a6':'#7c999a',group,[side*(BOUNDS.maxX*S+14+hash(chunk*7+i)*34),ground(0,start+300)+14,-(start+i*250)*S],[26,46+hash(i+chunk)*30,30]);peak.castShadow=false;}
 if(chunk<=-1)for(let i=-9;i<=9;i++){const peak=mesh(coneGeo,i%2?'#8da7a6':'#7c999a',group,[i*21+hash(i)*8,ground(0,-1000)+30,-(start+300)*S],[30,60+hash(i+3)*40,32]);peak.castShadow=false;}
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
 // GS gate: two poles with panel flags facing in, alternating red/blue.
 const half=f.size*S/2,c=f.seed%2?'#d6453b':'#2f6fd1';
 for(const sx of [-half,half]){box(g,'#f4f4ec',sx,.95,0,.06,1.9,.06);box(g,c,sx+(sx<0?.38:-.38),1.5,0,.76,.62,.03);}
 }else if(f.kind==='start'||f.kind==='finish'){
 const half=f.size*S/2,c=f.kind==='start'?'#2f6fd1':'#d6453b';
 for(const sx of [-half,half])box(g,'#e9e9df',sx,2.1,0,.22,4.2,.22);
 box(g,c,0,4.05,0,half*2,.7,.12);const l=label(f.kind==='start'?'START · '+COURSE.name.toUpperCase():'FINISH');l.scale.set(9,1.7,1);l.position.set(0,5.1,0);g.add(l);
 }
 else{box(g,'#8c7652',0,1,0,.07,2,.07);box(g,f.seed%2?'#d89b5d':'#91ae92',.42,1.8,0,.85,.5,.04);}world.add(g);return g;}
 type PoleObj={group:T.Group;shaft:T.Mesh;basket:T.Mesh;tip:T.Mesh;len:number;setLen(l:number):void};
 type Rider={imported:ReturnType<ReturnType<typeof createModelAssets>['rider']>;rig:Rig;hipRestY:number;root:T.Group;stunt:T.Group;body:T.Group;armL:T.Group;armR:T.Group;legL:T.Group;legR:T.Group;kneeL:T.Group;kneeR:T.Group;elbowL:T.Group;elbowR:T.Group;skiL:T.Group;skiR:T.Group;signature:string;lastAngle:number;lastTime:number;lean:number;gear:Outfit['gear'];equipment:T.Object3D[];rag:Rag|null;land:number;airStart:number;wasAir:boolean;edgeSign:number;release:number;boardG:T.Group;contact:number;normals:T.Vector3[];torso:T.Group;poles:PoleObj[];pp:PoseOut|null;lastX:number;lastY:number;speedEst:number};
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
 const chest=mesh(new T.CylinderGeometry(.43,.285,.84,6),o.jacket,up,[0,1.77,0],[1,1,.61]);chest.rotation.y=Math.PI/6;
 mesh(new T.CylinderGeometry(.29,.31,.18,6),o.jacket,pelvisG,[0,1.30,0],[1,1,.7]);
 box(pelvisG,'#694334',0,1.22,0,.62,.08,.38);
 mesh(new T.CylinderGeometry(.105,.12,.17,6),'#b99372',up,[0,2.22,0],[1,1,1]);
 mesh(new T.SphereGeometry(1,6,4),'#bd9977',up,[0,2.43,0],[.185,.245,.18]);
 box(up,'#30291f',-.069,2.46,-.162,.047,.025,.018);box(up,'#30291f',.069,2.46,-.162,.047,.025,.018);
 mesh(new T.ConeGeometry(.06,.12,4),'#ad8765',up,[0,2.39,-.18],[.7,1,1]).rotation.x=-Math.PI/2;
 mesh(new T.CylinderGeometry(.11,.045,.19,5),'#51442e',up,[0,2.30,-.09],[1,1,.8]);
 mesh(new T.CylinderGeometry(.187,.187,.045,6),o.hat,up,[0,2.52,0],[1,1,1]);
 box(up,'#14181a',0,2.45,-.17,.34,.09,.05);box(up,kitById(o.kit).lens,0,2.45,-.2,.3,.065,.02); // goggles
 function limb(px:number,py:number,c:string,length:number,leg=false){
 const pivot=new T.Group();pivot.position.set(px,py,0);(leg?pelvisG:up).add(pivot);
 const upper=mesh(new T.CylinderGeometry(leg?.19:.18,leg?.135:.115,length*.51,5),c,pivot,[0,-length*.245,0],[1,1,leg?.95:1]);upper.rotation.y=Math.PI/5;
 if(!leg)mesh(new T.CylinderGeometry(.23,.18,.28,5),o.jacket,pivot,[0,-.09,0],[1,1,1]);
 const joint=new T.Group();joint.position.set(0,-length*.49,0);pivot.add(joint);
 mesh(new T.CylinderGeometry(leg?.15:.115,leg?.075:.08,length*.47,5),leg?c:'#bd9977',joint,[0,-length*.23,0],[1,1,1]);
 if(!leg)mesh(new T.CylinderGeometry(.09,.085,.12,5),o.hat,joint,[0,-length*.41,0],[1,1,1]);
 // Legs end in an ankle group (the foot turns with the ski); arms end in a hand group (glove + pole grip).
 const end=new T.Group();end.position.set(0,leg?-.5:-length*.47,0);joint.add(end);
 if(leg)box(end,'#574331',0,-length*.47+.5,-.075,.22,.19,.39);else box(end,kitById(o.kit).glove,0,0,0,.14,.17,.16);
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
 const boardG=new T.Group(),poles:PoleObj[]=[];body.add(boardG);
 if(o.gear==='snowboard'){const equipment=models.snowboard();if(equipment){boardG.add(equipment);}else{box(boardG,'#dad1af',0,.025,0,1.9,.065,.40);box(boardG,o.hat,.48,.065,0,.35,.01,.38);for(const xx of [-.95,.95]){const tip=box(boardG,'#344c4a',xx,.055,0,.18,.07,.38);tip.rotation.z=xx>0?.28:-.28;}}}
 else{
 for(const [g,xx] of [[skiL,-.20],[skiR,.20]] as const){g.position.x=xx;const equipment=models.ski();if(equipment){g.add(equipment);}else{box(g,'#d4ab63',0,.03,-.12,.17,.065,2.1);box(g,o.hat,0,.07,-.9,.17,.05,.35);}}
 if(o.poles!=='none')for(const hand of rig.hands)poles.push(makePole(o.poles==='kit'?'kit':'carbon',kitById(o.kit).accent,hand));
 }
 if(name){const tag=label(name);tag.scale.set(2.8,.53,1);tag.position.y=3;root.add(tag);}scene.add(root);
 return{imported,rig,hipRestY:imported?1.35:1.25,root,stunt,body,armL:aL.pivot,armR:aR.pivot,legL:lL.pivot,legR:lR.pivot,kneeL:lL.joint,kneeR:lR.joint,elbowL:aL.joint,elbowR:aR.joint,skiL,skiR,signature:JSON.stringify(o),lastAngle:0,lastTime:0,lean:0,gear:o.gear,equipment:[boardG,skiL,skiR,...poles.map(q=>q.group)].filter(g=>g.children.length),rag:null,land:0,airStart:0,wasAir:false,edgeSign:0,release:0,boardG,contact:0,normals:[new T.Vector3(0,1,0),new T.Vector3(0,1,0)],torso,poles,pp:null,lastX:0,lastY:0,speedEst:0};
 }
 let local=rider({jacket:'#da744f',pants:'#374854',hat:'#e5b95f',gear:'snowboard'});const remotes=new Map<string,Rider>();
 const previewFloor=new T.Mesh(new T.CircleGeometry(30,48),mat('#40594e'));previewFloor.rotation.x=-Math.PI/2;previewFloor.receiveShadow=true;scene.add(previewFloor);
 const dust=new T.InstancedMesh(sphereGeo,mat('#f4f8e9'),220);dust.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(dust);const dummy=new T.Object3D();
 const liftChairs:T.Group[]=[];for(let i=0;i<8;i++){const g=new T.Group();box(g,'#52665d',0,1,0,.06,2,.06);box(g,'#df9c62',0,0,0,1.6,.12,.8);box(g,'#596f65',0,.35,.35,1.6,.7,.08);scene.add(g);liftChairs.push(g);}
 let width=0,height=0,camReady=false,zone=-999,lastClock=0,shake=0,wasBail=false,camHeading=0,lastX=0,lastY=0,lookReady=false;const camLook=new T.Vector3();
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
 type Motion={tuck?:number;lift?:number;rail?:boolean;fakie?:boolean;x:number;y:number;z:number;angle:number;speed?:number;pushPhase?:number;pushPower?:number;edge?:number;skid?:number;absorb?:number;backseat?:number;snow?:string};
 const _Y=new T.Vector3(0,1,0),_NY=new T.Vector3(0,-1,0),_ft=[new T.Vector3(),new T.Vector3()],_qf=[new T.Quaternion(),new T.Quaternion()],_qy=new T.Quaternion(),_so=new T.Vector3(),_H=new T.Vector3(),_D=new T.Vector3(),_qS=new T.Quaternion(),_qH=new T.Quaternion(),_qW=new T.Quaternion();
 // Gear geometry (measured from the models): boot sits on the binding centre, .10 behind the ski's middle, on top of the binding.
 const SKI_TOP=.089,SKI_BIND=.10,BOARD_TOP=.0875;
 function pose(r:Rider,p:Motion,t:number,bail=0,spin=0,flip=0,grab=0){
 const dt=Math.max(.001,Math.min(.1,t-r.lastTime)),first=!r.lastTime,delta=Math.atan2(Math.sin(p.angle-r.lastAngle),Math.cos(p.angle-r.lastAngle));
 // Remote riders do not send their speed: estimate it from how far they moved.
 let speed=p.speed??0;if(p.speed===undefined){r.speedEst+=((first?0:Math.hypot(p.x-r.lastX,p.y-r.lastY)/dt)-r.speedEst)*Math.min(1,dt*6);speed=r.speedEst;}
 r.lastX=p.x;r.lastY=p.y;
 const board=r.gear==='snowboard',maxLean=board?.36:.42;
 const targetLean=p.edge!==undefined?p.edge*maxLean*(p.fakie?-1:1):first?0:Math.max(-maxLean,Math.min(maxLean,-delta/dt*.18));r.lean+=(targetLean-r.lean)*Math.min(1,dt*9);r.lastAngle=p.angle;r.lastTime=t;
 const air=p.z>0,lifted=(p.lift||0)>0,grounded=!air&&!bail;
 // Takeoff and landing timing; edge changes soften the legs for a moment.
 if(air&&!r.wasAir)r.airStart=t;if(!air&&r.wasAir&&!bail)r.land=1;r.wasAir=air;r.land*=Math.exp(-7*dt);
 const sign=Math.abs(p.edge||0)>.12?Math.sign(p.edge||0):0;if(sign&&r.edgeSign&&sign!==r.edgeSign)r.release=1;if(sign)r.edgeSign=sign;r.release*=Math.exp(-6*dt);
 const edge=grounded?r.lean/maxLean*(1-r.release*.6):0;
 // Pushing (poles / skating) only happens at low speed; at speed the same key is an aerodynamic tuck.
 const inp:PoseIn={speed,push:grounded?Math.min(p.pushPower||0,pushWeight(speed)):0,phase:p.pushPhase||0,tuck:grounded?p.tuck||0:0,air,airT:t-r.airStart,land:r.land,grab:!!grab,edge,skid:grounded?p.skid||0:0,fakie:!!p.fakie,board,rail:!!p.rail&&!air,absorb:grounded?Math.max(-.12,p.absorb||0):0,release:r.release,breath:Math.sin(t*1.6)};
 const tgt=computePose(inp);r.pp=r.pp?blendPose(r.pp,tgt,Math.min(1,dt*(air?16:11))):tgt;const pp=r.pp;
 r.root.position.set(p.x*S,ground(p.x,p.y)+(p.z+(p.lift||0))*S,-p.y*S);r.root.rotation.y=-p.angle;
 // Flips rotate around the hips, with equipment carried through the motion.
 r.stunt.rotation.set(flip+(p.backseat||0)*.3,spin,r.lean*(1-r.release*.6));r.stunt.position.y=1.3;
 if(grounded&&p.snow==='ice'&&inp.skid>.15){r.stunt.rotation.z+=(Math.random()-.5)*.08*inp.skid;r.root.position.y+=Math.random()*.03*inp.skid;} // ice: edges chatter
 if(p.fakie&&!board&&grounded)r.stunt.rotation.x+=.08;
 r.body.position.set(0,-1.3,0);r.body.rotation.set(0,board?Math.PI/2:0,0);
 if(bail>0){ragdoll(r,p,t,dt,bail);return;}
 if(r.rag){r.rag=null;for(const g of r.equipment)g.visible=true;for(let i=debris.length-1;i>=0;i--)if(debris[i].owner===r){debris[i].obj.removeFromParent();debris.splice(i,1);}}
 // --- gear first: the skis/board rest on the snow (or hang from the feet in the air); the legs are then solved to reach them.
 const lean0=r.lean>0?1:0;
 if(board)r.boardG.position.set(0,0,0);
 else{const bk=(p.backseat||0)*.3;r.skiL.position.set(-pp.stance,0,-bk-pp.insideLead*lean0);r.skiR.position.set(pp.stance,0,-bk-pp.insideLead*(1-lean0));}
 settleGear(r,p,air||lifted,dt,edge,board?[0,0]:[pp.insideLift*lean0,pp.insideLift*(1-lean0)]);
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
 // Skis/board rest on the snow under each one: pitch with the slope, roll with sidehills and edge angle.
 // The terrain normal is sampled across the ski's length (smooths small bumps) and low-passed over time.
 // In the air the gear follows the rider's pose; contact blends back in after landing.
 const UP=new T.Vector3(0,1,0),_q=new T.Quaternion(),_q2=new T.Quaternion(),_q3=new T.Quaternion(),_v=new T.Vector3(),_n=new T.Vector3(),_e=new T.Euler();
 function settleGear(r:Rider,p:Motion,lifted:boolean,dt:number,edgeAmt:number,lifts:[number,number]){
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
   const h=ground(gx,gy),chord=(ground(gx+fx*half,gy+fy*half)+ground(gx-fx*half,gy-fy*half))/2,target=Math.max(h,chord)+.015-sink+lifts[i];
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
  if(!r.imported){r.rig.movePelvis(0,r.hipRestY,0);for(const l of r.rig.legs)l.ankle.quaternion.identity();}
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
 world.visible=!wardrobe;dust.visible=!wardrobe;remotes.forEach(r=>r.root.visible=!wardrobe);previewFloor.visible=wardrobe;previewFloor.position.set(f.x*S,py-.05,-f.y*S);
 // Camera follows where you are actually going, not where the skis point, so skids read clearly.
 // Teleports (shuttle, restart) snap the camera instead of flying it across the mountain.
 const jumped=Math.hypot(f.x-lastX,f.y-lastY)>100;lastX=f.x;lastY=f.y;
 {const goal=f.speed>20&&f.course!==undefined?f.course:f.angle+(f.fakie?Math.PI:0);if(jumped)camHeading=goal;camHeading+=Math.atan2(Math.sin(goal-camHeading),Math.cos(goal-camHeading))*(1-Math.exp(-fdt*(f.speed>20?5:1)));}
 const heading=inMenu?f.angle:camHeading+(f.settings.debugYaw||0);const dbg=f.settings.debugCam;const dist=f.settings.cameraDistance+(inMenu?0:Math.min(3,f.speed*.006));
 const target=wardrobe?new T.Vector3(f.x*S+3.4,py+1.9,-f.y*S-4.2):inMenu?new T.Vector3(f.x*S+Math.sin(f.clock*.05)*13,py+5.5,-f.y*S+16):new T.Vector3(f.x*S-Math.sin(heading)*dist,py+.8*(f.z+(f.lift||0))*S+4.2,-f.y*S+Math.cos(heading)*dist);
 if(!wardrobe)target.y=Math.max(target.y,ground(target.x/S,-target.z/S)+3.4);
 if(!camReady||jumped||camera.position.distanceTo(target)>75){camera.position.copy(target);camReady=true;}{const ah=1-Math.exp(-fdt*(inMenu?4:10)),av=1-Math.exp(-fdt*(inMenu?4:5.5));camera.position.x+=(target.x-camera.position.x)*ah;camera.position.z+=(target.z-camera.position.z)*ah;camera.position.y+=(target.y-camera.position.y)*av;}
 // Whatever the smoothing did, never let the camera sink into a slope or a kicker.
 if(!wardrobe){
  // Keep the line of sight clear of crests: sample the ground between the camera and the rider and lift the camera until it clears them.
  const ry=py+(f.z+(f.lift||0))*S+1.5;let need=ground(camera.position.x/S,-camera.position.z/S)+1.6;
  for(let k=1;k<=7;k++){const t=k/8,gx=camera.position.x+(f.x*S-camera.position.x)*t,gz=camera.position.z+(-f.y*S-camera.position.z)*t;need=Math.max(need,(ground(gx/S,-gz/S)+1.4-ry*t)/(1-t));}
  camera.position.y=Math.max(camera.position.y,need);}if(shake>.01&&!inMenu)camera.position.add(new T.Vector3((Math.random()-.5)*shake*.5,(Math.random()-.5)*shake*.4,0));
 if(dbg&&!inMenu){const a=f.angle+dbg.yaw;camera.position.set(f.x*S-Math.sin(a)*dbg.dist,py+(f.z+(f.lift||0))*S+dbg.height,-f.y*S+Math.cos(a)*dbg.dist);camera.lookAt(f.x*S,py+(f.z+(f.lift||0))*S+(dbg.look??1.2),-f.y*S);}
 else if(wardrobe)camera.lookAt(f.x*S,py+1.25,-f.y*S);else if(inMenu)camera.lookAt(f.x*S,py+1,-f.y*S-7);else{const want=new T.Vector3(f.x*S+Math.sin(heading)*6,py+.85*(f.z+(f.lift||0))*S+1.3,-f.y*S-Math.cos(heading)*6);if(!lookReady||jumped){camLook.copy(want);lookReady=true;}else camLook.lerp(want,1-Math.exp(-fdt*14));camera.lookAt(camLook);}
 const fov=f.settings.fov+(inMenu?0:Math.min(9,f.speed*.028));if(Math.abs(camera.fov-fov)>.05){camera.fov+=(fov-camera.fov)*.08;camera.updateProjectionMatrix();}
 if(wardrobe){if(!camera.view?.enabled||camera.view.fullWidth!==w||camera.view.fullHeight!==h)camera.setViewOffset(w,h,-w*.23,0,w,h);}else if(camera.view?.enabled)camera.clearViewOffset();
 const quality=f.settings.quality==='high';renderer.shadowMap.enabled=quality;const pixelRatio=quality?Math.min(window.devicePixelRatio,1.5):.8;if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
 sun.position.set(f.x*S+25,py+45,-f.y*S+15);sun.target.position.set(f.x*S,py,-f.y*S-15);
 // Chairs ride whichever lift is nearest the rider.
 {let best:Lift|null=null,bd=1e9;for(const L of LIFTS){if(f.y<L.y1-300||f.y>L.y0+300)continue;const xl=L.x0+(L.x1-L.x0)*(L.y0-f.y)/(L.y0-L.y1),d=Math.abs(f.x-xl);if(d<bd){bd=d;best=L;}}
  liftChairs.forEach((g,i)=>{if(!best||bd>1600||wardrobe){g.visible=false;return;}g.visible=true;const L=best,yy=Math.max(L.y1,Math.min(L.y0,f.y-900+((i*250+f.clock*45)%2000))),xl=L.x0+(L.x1-L.x0)*(L.y0-yy)/(L.y0-L.y1);g.position.set(xl*S,ground(xl,yy)+8.4,-yy*S);g.rotation.z=Math.sin(f.clock+i)*.035;});}
 renderer.render(scene,camera);}
 return{draw,destroy(){models.dispose();renderer.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});materials.forEach(m=>m.dispose());}};
}