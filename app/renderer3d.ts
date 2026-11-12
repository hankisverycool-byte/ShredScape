import * as T from 'three';
import type {Outfit,Peer,GameSettings} from './game-engine';
import {groundHeight,LOCATIONS} from './world';
type Feature={kind:string;x:number;y:number;size:number;id:string;seed:number};
type Frame={view:string;settings:GameSettings;x:number;y:number;z:number;angle:number;speed:number;clock:number;bail:number;spin:number;flip:number;grab:number;playing:boolean;outfit:Outfit;features:Feature[];peers:Peer[];particles:{x:number;y:number;z:number;size:number;life:number}[]};
const S=.05, center=(y:number)=>Math.sin(y*.0017)*68+Math.sin(y*.00043)*42;
const hash=(n:number)=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
const ground=groundHeight;
export function createMountain3D(canvas:HTMLCanvasElement){
 const renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor('#accbd2');
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
 function tree(parent:T.Object3D,size:number){box(parent,'#705b43',0,1,0,.3,2,.3);for(let i=0;i<3;i++){mesh(coneGeo,i%2?'#375d51':'#2b4e43',parent,[0,1.6+i*.9,0],[(1.6-i*.35)*size,2*size,(1.6-i*.35)*size]);mesh(coneGeo,'#e3eee7',parent,[0,2.05+i*.9,0],[(1.24-i*.27)*size,1.35*size,(1.24-i*.27)*size]);}}
 function cabin(parent:T.Object3D){box(parent,'#856448',0,1.5,0,7,3,5);box(parent,'#af8c61',0,.3,2.8,8,.6,1.4);const roof=mesh(new T.CylinderGeometry(0,5,2.4,4), '#dce8df',parent,[0,4,0],[1.15,1,.85]);roof.rotation.y=Math.PI/4;box(parent,'#423e35',0,1,2.54,1.1,2,.12);for(const x of [-2.2,2.2]){box(parent,'#f5cf78',x,1.7,2.55,1.1,1,.12);box(parent,'#433c30',x,1.7,2.65,.1,1,.1);}box(parent,'#716e60',2,4.5,-1,.65,2,.65);}
 function sign(parent:T.Object3D,title:string){box(parent,'#897352',0,1.5,0,.18,3,.18);const l=label(title);l.position.set(0,3,0);parent.add(l);}
 const world=new T.Group();scene.add(world);let chunks=new Map<number,T.Group>();let featureMap=new Map<string,T.Group>();
 function makeTerrain(chunk:number){const group=new T.Group(),start=chunk*1000;const geo=new T.PlaneGeometry(240,50,60,25);geo.rotateX(Math.PI/2);const a=geo.attributes.position;const cs=[];for(let i=0;i<a.count;i++){const xx=a.getX(i)/S,yy=start+(a.getZ(i)+25)/S;a.setY(i,ground(xx,yy));a.setZ(i,-yy*S);const path=Math.abs(xx-center(yy))<235;const color=new T.Color(path?(hash(i+chunk)>.82?'#e4e9df':'#f2f0df'):'#cbded6');cs.push(color.r,color.g,color.b);}geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const terrain=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));terrain.receiveShadow=true;group.add(terrain);

 for(const loc of LOCATIONS){if(Math.floor(loc.y/1000)!==chunk)continue;const landmark=new T.Group();landmark.position.set(loc.x*S,ground(loc.x,loc.y),-loc.y*S);
 const marker=new T.Group();marker.position.set(5,0,0);sign(marker,loc.name.toUpperCase());landmark.add(marker);
 if(loc.id==='summit'||loc.id==='village'){const count=loc.id==='village'?6:1;for(let i=0;i<count;i++){const c=new T.Group();c.position.set(-9-Math.floor(i/3)*10,0,(i%3-1)*12);cabin(c);landmark.add(c);}box(landmark,'#756747',0,.05,0,9,.1,9);}
 if(loc.id==='park'){for(let i=0;i<3;i++){const gate=new T.Group();gate.position.set((i-1)*9,0,-10);box(gate,'#c69255',-3,2,0,.2,4,.2);box(gate,'#c69255',3,2,0,.2,4,.2);box(gate,'#364e49',0,4,0,6,.45,.2);landmark.add(gate);}}
 if(loc.id==='lake'){const lake=new T.Mesh(new T.CircleGeometry(14,24),new T.MeshStandardMaterial({color:'#7db6c7',roughness:.18,metalness:.2}));lake.rotation.x=-Math.PI/2;lake.position.y=.08;landmark.add(lake);for(let i=0;i<8;i++){const rock=mesh(sphereGeo,'#b7d4d7',landmark,[Math.sin(i)*15,.4,Math.cos(i)*15],[2,.8,1]);}}
 group.add(landmark);
 }
 for(let i=0;i<2;i++){const yy=start+i*500;const tower=new T.Group();tower.position.set(24,ground(480,yy),-yy*S);box(tower,'#536860',0,5,0,.3,10,.3);box(tower,'#52645b',0,10,0,5,.25,.3);group.add(tower);const cable=box(group,'#586961',22,ground(480,yy)+10,-yy*S-12.5,.035,.035,25.3);cable.rotation.x=-Math.atan(.28);}
 for(let side of [-1,1])for(let i=0;i<5;i++){const peak=mesh(coneGeo,i%2?'#8da7a6':'#7c999a',group,[side*(70+hash(chunk+i)*40),ground(0,start+300)+8,-(start+i*210)*S],[25,35+hash(i+chunk)*25,28]);peak.castShadow=false;}
 world.add(group);return group;}
 function disposeGroup(group:T.Object3D){group.traverse(obj=>{if(obj instanceof T.Mesh&&![boxGeo,coneGeo,sphereGeo].includes(obj.geometry))obj.geometry.dispose();if(obj instanceof T.Mesh){const list=Array.isArray(obj.material)?obj.material:[obj.material];for(const m of list)if(![...materials.values()].includes(m as T.MeshStandardMaterial))m.dispose();}if(obj instanceof T.Sprite){obj.material.map?.dispose();obj.material.dispose();}});group.removeFromParent();}
 function makeFeature(f:Feature){const g=new T.Group();g.position.set(f.x*S,ground(f.x,f.y),-f.y*S);
 if(f.kind==='tree')tree(g,f.size);else if(f.kind==='rock')mesh(sphereGeo,'#7c918a',g,[0,.4,0],[1.1*f.size,.8*f.size,.9*f.size]);
 else if(f.kind==='ramp'){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-1.6,0,2,1.6,0,2,1.6,1.25,-.8,-1.6,0,2,1.6,1.25,-.8,-1.6,1.25,-.8],3));geo.computeVertexNormals();const ramp=new T.Mesh(geo,mat('#b19160'));ramp.material.side=T.DoubleSide;ramp.receiveShadow=true;g.add(ramp);for(let i=0;i<7;i++){const z=2-i*.4;box(g,'#d4b77c',0,(2-z)/2.8*1.25+.02,z,3.2,.06,.065);}box(g,'#7b6142',-1.4,.55,-.6,.14,1.1,.14);box(g,'#7b6142',1.4,.55,-.6,.14,1.1,.14);}
 else if(f.kind==='rail'){box(g,'#edb957',0,.7,0,.2,.18,4);box(g,'#53665a',0,.35,-1.5,.15,.7,.15);box(g,'#53665a',0,.35,1.5,.15,.7,.15);}
 else{box(g,'#8c7652',0,1,0,.07,2,.07);box(g,f.seed%2?'#d89b5d':'#91ae92',.42,1.8,0,.85,.5,.04);}world.add(g);return g;}
 type Rider={root:T.Group;body:T.Group;armL:T.Group;armR:T.Group;legL:T.Group;legR:T.Group;scarf:T.Mesh;signature:string;lastAngle:number;lastTime:number;lean:number;gear:Outfit['gear']};
 function rider(o:Outfit,name?:string):Rider{
 const root=new T.Group(),body=new T.Group();root.add(body);
 // Adult proportions: small head, longer articulated legs, broad layered outerwear.
 const torso=mesh(new T.CylinderGeometry(.34,.28,.85,8),o.jacket,body,[0,1.55,0],[1,1,.72]);
 box(body,o.jacket,0,1.2,0,.6,.3,.39);box(body,'#253438',0,1.08,0,.62,.12,.4);
 const head=mesh(sphereGeo,'#c6a282',body,[0,2.18,-.01],[.21,.27,.21]);
 mesh(new T.SphereGeometry(.235,8,6),o.hat,body,[0,2.3,.015],[1,.68,1]);
 box(body,'#303d40',0,2.19,-.205,.4,.13,.055);box(body,'#a4c9ce',0,2.21,-.24,.33,.065,.018);
 box(body,'#2e393c',0,2.05,-.15,.32,.14,.14);
 box(body,o.jacket,0,1.94,.04,.45,.19,.38);
 const scarf=box(body,'#9c8f72',.14,1.91,.25,.16,.08,.45);
 function limb(px:number,py:number,c:string,length:number,leg=false){const pivot=new T.Group();pivot.position.set(px,py,0);body.add(pivot);
 mesh(new T.CylinderGeometry(leg?.15:.13,leg?.14:.1,length*.56,6),c,pivot,[0,-length*.25,0],[1,1,1]);
 const joint=new T.Group();joint.position.set(0,-length*.52,0);pivot.add(joint);joint.rotation.x=leg?-.24:-.22;
 mesh(new T.CylinderGeometry(leg?.14:.1,leg?.12:.1,length*.5,6),c,joint,[0,-length*.24,0],[1,1,1]);
 box(joint,leg?'#253238':'#313b3e',0,-length*.49,leg?-.07:0,leg?.24:.16,leg?.22:.19,leg?.42:.2);return pivot;}
 const armL=limb(-.4,1.88,o.jacket,.8),armR=limb(.4,1.88,o.jacket,.8),legL=limb(-.19,1.13,o.pants,1),legR=limb(.19,1.13,o.pants,1);
 if(o.gear==='snowboard'){const board=box(body,'#dad1af',0,.025,0,1.8,.065,.38);box(body,'#bb6647',.48,.065,0,.35,.01,.36);for(const xx of [-.9,.9]){const tip=box(body,'#344c4a',xx,.055,0,.18,.07,.36);tip.rotation.z=xx>0?.28:-.28;}body.rotation.y=.22;}
 else for(const xx of [-.19,.19]){box(body,'#d4ab63',xx,.03,-.12,.15,.065,1.95);box(body,'#344f4c',xx,.065,-.85,.15,.05,.3);}
 if(name){const tag=label(name);tag.scale.set(2.8,.53,1);tag.position.y=3;root.add(tag);}scene.add(root);return{root,body,armL,armR,legL,legR,scarf,signature:JSON.stringify(o),lastAngle:0,lastTime:0,lean:0,gear:o.gear};
 }
 let local=rider({jacket:'#da744f',pants:'#374854',hat:'#e5b95f',gear:'snowboard'});const remotes=new Map<string,Rider>();
 const previewFloor=new T.Mesh(new T.CircleGeometry(30,48),mat('#40594e'));previewFloor.rotation.x=-Math.PI/2;previewFloor.receiveShadow=true;scene.add(previewFloor);
 const dust=new T.InstancedMesh(sphereGeo,mat('#f4f8e9'),110);dust.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(dust);const dummy=new T.Object3D();
 const liftChairs:T.Group[]=[];for(let i=0;i<8;i++){const g=new T.Group();box(g,'#52665d',0,1,0,.06,2,.06);box(g,'#df9c62',0,0,0,1.6,.12,.8);box(g,'#596f65',0,.35,.35,1.6,.7,.08);scene.add(g);liftChairs.push(g);}
 let width=0,height=0,camReady=false,zone=-999;
 function pose(r:Rider,p:{x:number;y:number;z:number;angle:number;speed?:number},t:number,bail=0,spin=0,flip=0,grab=0){
 const dt=Math.max(.001,t-r.lastTime),delta=Math.atan2(Math.sin(p.angle-r.lastAngle),Math.cos(p.angle-r.lastAngle));
 const targetLean=r.lastTime?Math.max(-.32,Math.min(.32,-delta/dt*.16)):0;r.lean+=(targetLean-r.lean)*Math.min(1,dt*9);r.lastAngle=p.angle;r.lastTime=t;
 const airborne=p.z>0,moving=(p.speed||0)>10,board=r.gear==='snowboard';
 r.root.position.set(p.x*S,ground(p.x,p.y)+p.z*S+.1,-p.y*S);r.root.rotation.y=-p.angle;
 r.body.rotation.set(flip>0?flip:bail>0?Math.PI*.5:moving?-.08:0,spin+(board?Math.PI/2:0),r.lean);
 const bend=airborne?(grab?.65:.4):moving?.3:.12;
 r.body.position.y=-bend*.27+Math.sin(t*5)*.012;
 r.legL.rotation.x=bend+(moving?Math.sin(t*7)*.035:0);r.legR.rotation.x=bend-(moving?Math.sin(t*7)*.035:0);
 for(const leg of [r.legL,r.legR]){const knee=leg.children.find(c=>c instanceof T.Group);if(knee)knee.rotation.x=-bend*1.8;}
 r.armL.rotation.set(grab?-1.4:moving?-.35:.1,0,grab?-.15:board?-.6:-.22+r.lean);
 r.armR.rotation.set(grab?-.9:moving?-.35:-.1,0,grab?.25:board?.6:.22+r.lean);
 for(const arm of [r.armL,r.armR]){const elbow=arm.children.find(c=>c instanceof T.Group);if(elbow)elbow.rotation.x=grab?-.9:moving?-.6:-.2;}
 r.scarf.rotation.x=Math.sin(t*10)*.2;
 }
 function draw(f:Frame){const w=canvas.clientWidth,h=canvas.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const chunk=Math.floor(f.y/1000);if(chunk!==zone){zone=chunk;for(let n=chunk-2;n<=chunk+4;n++)if(!chunks.has(n))chunks.set(n,makeTerrain(n));for(const [n,g]of chunks)if(n<chunk-2||n>chunk+4){disposeGroup(g);chunks.delete(n);}}
 const ids=new Set(f.features.map(p=>p.id));for(const feature of f.features)if(!featureMap.has(feature.id))featureMap.set(feature.id,makeFeature(feature));for(const[id,g]of featureMap)if(!ids.has(id)){disposeGroup(g);featureMap.delete(id);}
 if(local.signature!==JSON.stringify(f.outfit)){disposeGroup(local.root);local=rider(f.outfit);}if(f.view==='wardrobe'||f.view==='shop')pose(local,{...f,z:0,angle:0},f.clock);else pose(local,f,f.clock,f.bail,f.spin,f.flip,f.grab);
 for(const peer of f.peers){let r=remotes.get(peer.id);if(!r||r.signature!==JSON.stringify(peer.outfit)){if(r)disposeGroup(r.root);r=rider(peer.outfit,peer.name);remotes.set(peer.id,r);}pose(r,peer,f.clock);}
 for(const[id,r]of remotes)if(!f.peers.some(p=>p.id===id)){disposeGroup(r.root);remotes.delete(id);}
 const count=Math.min(f.particles.length,110);dust.count=count;for(let i=0;i<count;i++){const p=f.particles[i];dummy.position.set(p.x*S,ground(p.x,p.y)+p.z*S+.08,-p.y*S);dummy.scale.setScalar(p.size*.025);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;

 const py=ground(f.x,f.y);const inMenu=f.view!=='game';const wardrobe=f.view==='wardrobe'||f.view==='shop';
 world.visible=!wardrobe;dust.visible=!wardrobe;remotes.forEach(r=>r.root.visible=!wardrobe);liftChairs.forEach(c=>c.visible=!wardrobe);previewFloor.visible=wardrobe;previewFloor.position.set(f.x*S,py-.05,-f.y*S);
 const heading=f.angle;const dist=f.settings.cameraDistance;
 const target=wardrobe?new T.Vector3(f.x*S+3.4,py+1.9,-f.y*S-4.2):inMenu?new T.Vector3(f.x*S+Math.sin(f.clock*.05)*13,py+5.5,-f.y*S+16):new T.Vector3(f.x*S-Math.sin(heading)*dist,py+4.5+f.z*S*.35,-f.y*S+Math.cos(heading)*dist);
 if(!camReady||camera.position.distanceTo(target)>75){camera.position.copy(target);camReady=true;}camera.position.lerp(target,.065);
 if(wardrobe)camera.lookAt(f.x*S,py+1.25,-f.y*S);else if(inMenu)camera.lookAt(f.x*S,py+1,-f.y*S-7);else camera.lookAt(f.x*S+Math.sin(heading)*7,py+1,-f.y*S-Math.cos(heading)*7);
 if(camera.fov!==f.settings.fov){camera.fov=f.settings.fov;camera.updateProjectionMatrix();}
 if(wardrobe){if(!camera.view?.enabled||camera.view.fullWidth!==w||camera.view.fullHeight!==h)camera.setViewOffset(w,h,-w*.23,0,w,h);}else if(camera.view?.enabled)camera.clearViewOffset();
 const quality=f.settings.quality==='high';renderer.shadowMap.enabled=quality;const pixelRatio=quality?Math.min(window.devicePixelRatio,1.5):.8;if(renderer.getPixelRatio()!==pixelRatio)renderer.setPixelRatio(pixelRatio);
 sun.position.set(f.x*S+25,py+45,-f.y*S+15);sun.target.position.set(f.x*S,py,-f.y*S-15);
 liftChairs.forEach((g,i)=>{const yy=f.y-500+((i*250+f.clock*45)%2000);g.position.set(22,ground(480,yy)+8,-yy*S);g.rotation.z=Math.sin(f.clock+i)*.035;});
 renderer.render(scene,camera);}
 return{draw,destroy(){renderer.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});materials.forEach(m=>m.dispose());}};
}