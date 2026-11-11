import * as T from 'three';
import type {Outfit,Peer} from './game-engine';
type Feature={kind:string;x:number;y:number;size:number;id:string;seed:number};
type Frame={x:number;y:number;z:number;angle:number;speed:number;clock:number;bail:number;spin:number;flip:number;grab:number;playing:boolean;outfit:Outfit;features:Feature[];peers:Peer[];particles:{x:number;y:number;z:number;size:number;life:number}[]};
const S=.05, center=(y:number)=>Math.sin(y*.0017)*68+Math.sin(y*.00043)*42;
const hash=(n:number)=>{const k=Math.sin(n*127.1+311.7)*43758.5453;return k-Math.floor(k);};
const ground=(x:number,y:number)=>-y*.014+Math.max(0,Math.abs(x-center(y))-240)*.028;
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
 function makeTerrain(chunk:number){const group=new T.Group(),start=chunk*1000;const geo=new T.PlaneGeometry(140,50,28,20);geo.rotateX(Math.PI/2);const a=geo.attributes.position;const cs=[];for(let i=0;i<a.count;i++){const xx=a.getX(i)/S,yy=start+(a.getZ(i)+25)/S;a.setY(i,ground(xx,yy));a.setZ(i,-yy*S);const path=Math.abs(xx-center(yy))<235;const color=new T.Color(path?(hash(i+chunk)>.82?'#e4e9df':'#f2f0df'):'#cbded6');cs.push(color.r,color.g,color.b);}geo.setAttribute('color',new T.Float32BufferAttribute(cs,3));geo.computeVertexNormals();const terrain=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));terrain.receiveShadow=true;group.add(terrain);
 // Named terrain-park zones, cabins, lift, lake and avalanche fences give the route landmarks.
 if(chunk%6===0){const h=new T.Group();h.position.set(-20,ground(-400,start+200),-(start+200)*S);cabin(h);const signpost=new T.Group();signpost.position.set(2,0,4);sign(signpost,chunk===0?'FROSTPEAK LODGE':'PINECONE REFUGE');h.add(signpost);group.add(h);}
 if(chunk%6===2){const lake=new T.Mesh(new T.CircleGeometry(15,12),new T.MeshStandardMaterial({color:'#78aeb9',roughness:.26,metalness:.15}));lake.rotation.x=-Math.PI/2;lake.position.set(-33,ground(-660,start+500)+.06,-(start+500)*S);group.add(lake);const s=new T.Group();s.position.set(-10,ground(-200,start),-start*S);sign(s,'GLACIER GLADE');group.add(s);}
 if(chunk%6===4){const p=new T.Group();p.position.set(center(start)*S+8,ground(center(start),start),-start*S);sign(p,'THE STOMPING GROUNDS');group.add(p);for(let i=0;i<8;i++){const q=new T.Group();q.position.set(14,ground(280,start+i*100),-(start+i*100)*S);box(q,'#977d56',0,.6,0,.15,1.2,.15);box(q,'#c3a273',0,.7,-2.5,.1,.12,5);group.add(q);}}
 for(let i=0;i<2;i++){const yy=start+i*500;const tower=new T.Group();tower.position.set(24,ground(480,yy),-yy*S);box(tower,'#536860',0,5,0,.3,10,.3);box(tower,'#52645b',0,10,0,5,.25,.3);group.add(tower);const cable=box(group,'#586961',22,ground(480,yy)+10,-yy*S-12.5,.035,.035,25.3);cable.rotation.x=-Math.atan(.28);}
 for(let side of [-1,1])for(let i=0;i<5;i++){const peak=mesh(coneGeo,i%2?'#8da7a6':'#7c999a',group,[side*(70+hash(chunk+i)*40),ground(0,start+300)+8,-(start+i*210)*S],[25,35+hash(i+chunk)*25,28]);peak.castShadow=false;}
 world.add(group);return group;}
 function disposeGroup(group:T.Object3D){group.traverse(obj=>{if(obj instanceof T.Mesh&&![boxGeo,coneGeo,sphereGeo].includes(obj.geometry))obj.geometry.dispose();if(obj instanceof T.Sprite){obj.material.map?.dispose();obj.material.dispose();}});group.removeFromParent();}
 function makeFeature(f:Feature){const g=new T.Group();g.position.set(f.x*S,ground(f.x,f.y),-f.y*S);
 if(f.kind==='tree')tree(g,f.size);else if(f.kind==='rock')mesh(sphereGeo,'#7c918a',g,[0,.4,0],[1.1*f.size,.8*f.size,.9*f.size]);
 else if(f.kind==='ramp'){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-1.6,0,2,1.6,0,2,1.6,1.25,-.8,-1.6,0,2,1.6,1.25,-.8,-1.6,1.25,-.8],3));geo.computeVertexNormals();const ramp=new T.Mesh(geo,mat('#b19160'));ramp.material.side=T.DoubleSide;ramp.receiveShadow=true;g.add(ramp);for(let i=0;i<7;i++){const z=2-i*.4;box(g,'#d4b77c',0,(2-z)/2.8*1.25+.02,z,3.2,.06,.065);}box(g,'#7b6142',-1.4,.55,-.6,.14,1.1,.14);box(g,'#7b6142',1.4,.55,-.6,.14,1.1,.14);}
 else if(f.kind==='rail'){box(g,'#edb957',0,.7,0,.2,.18,4);box(g,'#53665a',0,.35,-1.5,.15,.7,.15);box(g,'#53665a',0,.35,1.5,.15,.7,.15);}
 else{box(g,'#8c7652',0,1,0,.07,2,.07);box(g,f.seed%2?'#d89b5d':'#91ae92',.42,1.8,0,.85,.5,.04);}world.add(g);return g;}
 type Rider={root:T.Group;body:T.Group;armL:T.Group;armR:T.Group;legL:T.Group;legR:T.Group;scarf:T.Mesh;signature:string};
 function rider(o:Outfit,name?:string):Rider{const root=new T.Group(),body=new T.Group();root.add(body);const torso=box(body,o.jacket,0,1.15,0,.62,.65,.35);box(body,'#e2ba91',0,1.74,0,.43,.4,.39);box(body,o.hat,0,1.98,0,.5,.2,.45);mesh(sphereGeo,o.hat,body,[0,2.14,0],[.1,.1,.1]);box(body,'#2c434b',0,1.78,-.21,.45,.12,.04);box(body,'#b9dde0',0,1.8,-.235,.34,.06,.02);const scarf=box(body,'#edce8d',.2,1.43,.3,.14,.08,.65);
 function limb(x:number,y:number,c:string,h:number){const pivot=new T.Group();pivot.position.set(x,y,0);body.add(pivot);box(pivot,c,0,-h/2,0,.19,h,.23);return pivot;}
 const armL=limb(-.42,1.4,o.jacket,.57),armR=limb(.42,1.4,o.jacket,.57),legL=limb(-.2,.86,o.pants,.67),legR=limb(.2,.86,o.pants,.67);
 for(const x of [-.2,.2])box(body,'#2e3d38',x,.14,0,.24,.23,.4);
 if(o.gear==='snowboard'){box(body,'#dfb46c',0,.03,0,1.65,.1,.33);for(const x of [-.83,.83]){const tip=box(body,'#d28357',x,.075,0,.2,.1,.33);tip.rotation.z=x>0?.3:-.3;}}
 else for(const x of [-.2,.2]){box(body,'#ddac5e',x,.03,-.1,.16,.08,1.75);const pole=box(body,'#667f77',x*2.8,.65,.2,.035,1.1,.035);pole.rotation.x=.25;}
 if(name){const tag=label(name);tag.scale.set(2.8,.53,1);tag.position.y=2.7;root.add(tag);}scene.add(root);return{root,body,armL,armR,legL,legR,scarf,signature:JSON.stringify(o)};}
 let local=rider({jacket:'#da744f',pants:'#374854',hat:'#e5b95f',gear:'snowboard'});const remotes=new Map<string,Rider>();
 const dust=new T.InstancedMesh(sphereGeo,mat('#f4f8e9'),110);dust.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(dust);const dummy=new T.Object3D();
 const liftChairs:T.Group[]=[];for(let i=0;i<8;i++){const g=new T.Group();box(g,'#52665d',0,1,0,.06,2,.06);box(g,'#df9c62',0,0,0,1.6,.12,.8);box(g,'#596f65',0,.35,.35,1.6,.7,.08);scene.add(g);liftChairs.push(g);}
 let width=0,height=0,camReady=false,zone=-999;
 function pose(r:Rider,p:{x:number;y:number;z:number;angle:number},t:number,bail=0,spin=0,flip=0,grab=0){r.root.position.set(p.x*S,ground(p.x,p.y)+p.z*S,-p.y*S);r.root.rotation.y=-p.angle;r.body.rotation.set(flip>0?(1-flip/.65)*Math.PI*2:bail>0?Math.PI*.5:0,spin>0?(1-spin/.65)*Math.PI*2:0,-p.angle*.55);const crouch=p.z>0?.14:Math.sin(t*8)*.025;r.body.position.y=-crouch;r.armL.rotation.z=grab>0?-.2:-.55-p.angle*.5;r.armR.rotation.z=grab>0?.25:.55-p.angle*.5;r.armL.rotation.x=grab>0?-1.5:.2;r.armR.rotation.x=grab>0?-1.2:-.15;r.legL.rotation.x=p.z>0?-.3:Math.sin(t*6)*.04;r.legR.rotation.x=-r.legL.rotation.x;r.scarf.rotation.x=Math.sin(t*10)*.2;}
 function draw(f:Frame){const w=canvas.clientWidth,h=canvas.clientHeight;if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const chunk=Math.floor(f.y/1000);if(chunk!==zone){zone=chunk;for(let n=chunk-2;n<=chunk+4;n++)if(!chunks.has(n))chunks.set(n,makeTerrain(n));for(const [n,g]of chunks)if(n<chunk-2||n>chunk+4){disposeGroup(g);chunks.delete(n);}}
 const ids=new Set(f.features.map(p=>p.id));for(const feature of f.features)if(!featureMap.has(feature.id))featureMap.set(feature.id,makeFeature(feature));for(const[id,g]of featureMap)if(!ids.has(id)){disposeGroup(g);featureMap.delete(id);}
 if(local.signature!==JSON.stringify(f.outfit)){disposeGroup(local.root);local=rider(f.outfit);}pose(local,f,f.clock,f.bail,f.spin,f.flip,f.grab);
 for(const peer of f.peers){let r=remotes.get(peer.id);if(!r||r.signature!==JSON.stringify(peer.outfit)){if(r)disposeGroup(r.root);r=rider(peer.outfit,peer.name);remotes.set(peer.id,r);}pose(r,peer,f.clock);}
 for(const[id,r]of remotes)if(!f.peers.some(p=>p.id===id)){disposeGroup(r.root);remotes.delete(id);}
 const count=Math.min(f.particles.length,110);dust.count=count;for(let i=0;i<count;i++){const p=f.particles[i];dummy.position.set(p.x*S,ground(p.x,p.y)+p.z*S+.08,-p.y*S);dummy.scale.setScalar(p.size*.025);dummy.updateMatrix();dust.setMatrixAt(i,dummy.matrix);}dust.instanceMatrix.needsUpdate=true;
 const py=ground(f.x,f.y),target=new T.Vector3(f.x*S*.8,py+5.5+f.z*S*.3,-f.y*S+11);if(!camReady){camera.position.copy(target);camReady=true;}camera.position.lerp(target,.08);camera.lookAt(f.x*S*.7,py+.7,-f.y*S-11);
 sun.position.set(f.x*S+25,py+45,-f.y*S+15);sun.target.position.set(f.x*S,py,-f.y*S-15);
 liftChairs.forEach((g,i)=>{const yy=f.y-500+((i*250+f.clock*45)%2000);g.position.set(22,ground(480,yy)+8,-yy*S);g.rotation.z=Math.sin(f.clock+i)*.035;});
 renderer.render(scene,camera);}
 return{draw,destroy(){renderer.dispose();scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});materials.forEach(m=>m.dispose());}};
}