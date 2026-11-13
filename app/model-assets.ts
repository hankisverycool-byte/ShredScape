import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {Outfit} from './game-engine';
import {kitById,drawLogo,BRANDS,type Brand} from './kits';
const logos=new Map<Brand,T.CanvasTexture>();
function logoTexture(b:Brand){let t=logos.get(b);if(!t){const c=document.createElement('canvas');c.width=c.height=128;drawLogo(c.getContext('2d')!,b,128,BRANDS[b].ink,'#00000055');t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;logos.set(b,t);}return t;}

type Template = T.Group;
export function createModelAssets(onReady:()=>void){
 const loader=new GLTFLoader(),trees:Template[]=[];let board:Template|null=null,skis:Template|null=null,person:Template|null=null,disposed=false;
 const resources=new Set<T.BufferGeometry|T.Material|T.Texture>();
 function track(g:T.Object3D){g.traverse(o=>{if(o instanceof T.Mesh){resources.add(o.geometry);o.geometry.userData.assetShared=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);m.userData.assetShared=true;for(const value of Object.values(m))if(value instanceof T.Texture)resources.add(value);}}});}
 function bake(mesh:T.Mesh,matrix=mesh.matrixWorld){const out=new T.Mesh(mesh.geometry.clone().applyMatrix4(matrix),mesh.material);out.castShadow=true;out.receiveShadow=true;return out;}
 function fit(group:T.Group,size:number,axis:'x'|'y'|'z'){const box=new T.Box3().setFromObject(group),center=box.getCenter(new T.Vector3()),scale=size/box.getSize(new T.Vector3())[axis];for(const m of group.children as T.Mesh[]){m.geometry.translate(-center.x,-box.min.y,-center.z);m.geometry.scale(scale,scale,scale);}track(group);return group;}
 async function load(url:string,prepare:(scene:T.Group)=>void){try{const gltf=await loader.loadAsync(url);if(disposed){gltf.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});return;}gltf.scene.updateMatrixWorld(true);track(gltf.scene);prepare(gltf.scene);onReady();}catch(e){console.warn('Model could not load; using built-in fallback.',url,e);}}
 void load('/models/snowy-trees.glb',scene=>{scene.traverse(o=>{if(o instanceof T.Mesh){const g=new T.Group();g.add(bake(o));trees.push(fit(g,5,'y'));}});});
 void load('/models/eli-snowboard.glb',scene=>{const g=new T.Group();scene.traverse(o=>{if(o instanceof T.Mesh)g.add(bake(o));});board=fit(g,2.2,'x');});
 void load('/models/skis/scene.gltf',scene=>{const g=new T.Group();// Raw ski mesh has bindings on -Y; flip so they face up and the tip points forward (-Z).
 scene.getObjectByName('Ski_L')?.traverse(o=>{if(o instanceof T.Mesh)g.add(bake(o,new T.Matrix4().makeRotationX(Math.PI)));});skis=fit(g,2.2,'z');});
 void load('/models/rider.glb',scene=>{
  const g=new T.Group();scene.traverse(o=>{if(o instanceof T.Mesh&&['Object_4','Object_6','Object_8','Object_10','Object_12'].includes(o.name)){const m=bake(o);m.name=o.name;g.add(m);}});
  person=fit(g,2.65,'y');
  // Source faces +Z. Our riders face -Z.
  person.traverse(o=>{if(!(o instanceof T.Mesh))return;o.geometry.rotateY(Math.PI);const p=o.geometry.attributes.position,indices=[],weights=[];
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);let a=0,b=0,w=0;const left=x<0;
    if(y<1.42){a=left?5:7;b=left?6:8;w=T.MathUtils.smoothstep( .80-y,-.08,.08);if(y>1.30){b=0;w=T.MathUtils.smoothstep(y,1.30,1.42);}}
    else if(Math.abs(x)>.34&&y<2.30){a=left?1:3;b=left?2:4;w=T.MathUtils.smoothstep(1.82-y,-.10,.10);}
    indices.push(a,b,0,0);weights.push(1-w,w,0,0);
   }o.geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));o.geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
  });
 });
 // Head size/position from the skin mesh (for helmets and goggles).
 let head:{x:number;y:number;z:number;r:number;front:number;minY:number}|null=null;
 function headInfo(){if(head)return head;const b=new T.Box3();const v=new T.Vector3();
  let top=0;const skin=(person!.children as T.Mesh[]).find(m=>m.name==='Object_4')!.geometry.attributes.position;for(let i=0;i<skin.count;i++)top=Math.max(top,skin.getY(i));
  // top ~0.34 of the body mesh is the head (skull + face), above the neck
  for(let i=0;i<skin.count;i++){v.fromBufferAttribute(skin,i);if(v.y>top-.34&&Math.abs(v.x)<.25)b.expandByPoint(v);}
  const c=b.getCenter(new T.Vector3()),sz=b.getSize(new T.Vector3());return head={x:c.x,y:c.y,z:c.z,r:Math.max(sz.x,sz.z)/2,front:b.min.z,minY:b.min.y};}
 function clone(template:Template|null){return template?.clone(true)||null;}
 return{
  tree(seed:number){return trees.length?clone(trees[Math.abs(Math.floor(seed))%trees.length]):null;},
  snowboard(){return clone(board);},ski(){return clone(skis);},
  rider(outfit:Outfit){
   if(!person)return null;
   const root=new T.Group(),bones:T.Bone[]=[];
   function bone(parent:number,x:number,y:number,z=0){const b=new T.Bone();b.position.set(x,y,z);if(parent<0)root.add(b);else bones[parent].add(b);bones.push(b);}
   bone(-1,0,0);bone(0,-.36,2.16);bone(1,-.24,-.34);bone(0,.36,2.16);bone(3,.24,-.34);bone(0,-.18,1.35);bone(5,-.04,-.61);bone(0,.18,1.35);bone(7,.04,-.61);
   const handL=new T.Group(),handR=new T.Group();handL.position.set(-.15,-.35,0);handR.position.set(.15,-.35,0);bones[2].add(handL);bones[4].add(handR);
   const skeleton=new T.Skeleton(bones);root.updateMatrixWorld(true);
   // Technical outerwear: the suit mesh is reshaped and recoloured per kit, then helmet/hood, goggles, gloves and a logo are added.
   const kit=kitById(outfit.kit),style=kit.style,hem=style==='freeride'?1.12:1.28;
   const jacketC=new T.Color(outfit.jacket),pantsC=new T.Color(outfit.pants),accentC=new T.Color(kit.accent),zipC=new T.Color('#121618');
   let chestZ=-.2;
   for(const original of person.children as T.Mesh[]){
    if(original.name==='Object_6')continue; // hair: always under a helmet or beanie
    const source=original.material as T.MeshStandardMaterial,material=source.clone();material.userData={};material.roughness=.95;material.metalness=0;
    let geo=original.geometry;
    if(original.name==='Object_10'){
     geo=geo.clone();geo.userData={};const pos=geo.attributes.position,colors:number[]=[],c=new T.Color();
     for(let i=0;i<pos.count;i++){let x=pos.getX(i),z=pos.getZ(i);const y=pos.getY(i),side=Math.abs(x),pants=y<hem,front=z<-.03;
      // Silhouette: freeride = baggy legs flaring to the boot and a roomy torso; race = slim; shell = trim.
      if(pants&&side<.34){const x0=Math.sign(x)*.17,f=style==='freeride'?1.24+.24*Math.max(0,1-y/hem):style==='race'?.94:1.04;x=x0+(x-x0)*f;z*=f;}
      else if(style==='freeride'&&y<2.1){x*=1.07;z*=1.1;}
      pos.setXYZ(i,x,y,z);
      c.copy(pants?pantsC:jacketC);
      if(style==='race'&&((!pants&&side>.2&&side<.34)||(pants&&Math.abs(x)>.22)))c.copy(accentC); // race side panels
      if(!pants&&y<hem+.05)c.copy(style==='shell'?jacketC.clone().multiplyScalar(.7):accentC); // hem / powder skirt trim
      if((!pants&&Math.abs(y-1.98)<.02)||(!pants&&Math.abs(side-.27)<.012)||(pants&&Math.abs(y-.72)<.02))c.multiplyScalar(.72); // taped panel seams
      if(front&&side<.022&&!pants&&y>hem+.05&&y<2.17)c.copy(zipC); // waterproof centre zip
      if(style==='freeride'&&pants&&Math.abs(side-.29)<.014&&y>.82&&y<1.08)c.copy(zipC); // thigh vents
      colors.push(c.r,c.g,c.b);
      if(front&&Math.abs(x+.12)<.04&&Math.abs(y-1.9)<.04)chestZ=Math.min(chestZ,z);}
     geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();material.map=null;material.normalMap=null;material.vertexColors=true;material.color.set('#ffffff');material.roughness=style==='race'?.45:.8;
    }
    const m=new T.SkinnedMesh(geo,material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;root.add(m);m.bind(skeleton);
   }
   const H=headInfo(),kitGear=new T.Group();bones[0].add(kitGear);
   const std=(c:string,o:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color:c,roughness:.6,...o});
   const add=(g:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,parent:T.Object3D=kitGear)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
   if(style==='freeride'){
    add(new T.SphereGeometry(H.r*1.08,16,10,0,Math.PI*2,0,Math.PI*.5),std(kit.accent,{roughness:1}),H.x,H.y+H.r*.32,H.z);
    add(new T.CylinderGeometry(H.r*1.1,H.r*1.1,.07,18),std(kit.accent,{roughness:1}),H.x,H.y+H.r*.32,H.z);
    // hood up over the beanie, open at the face
    add(new T.SphereGeometry(H.r*1.3,16,12,Math.PI*1.5+1.05,Math.PI*2-2.1,0,Math.PI*.6),std(outfit.jacket,{roughness:.85,side:T.DoubleSide}),H.x,H.y+H.r*.2,H.z+.05);
   }else{
    const helmet=add(new T.SphereGeometry(H.r*1.14,18,12,0,Math.PI*2,0,Math.PI*.52),std(outfit.hat,{roughness:.35}),H.x,H.y+H.r*.28,H.z);
    if(style==='race'){helmet.scale.set(1,1,1.25);helmet.position.z+=.04;}
    add(new T.CylinderGeometry(.15,.17,.13,14),std(outfit.jacket,{roughness:.85}),H.x,H.minY+.02,H.z+.01); // storm collar
   }
   // goggles: strap around the head, framed mirrored lens over the eyes
   add(new T.CylinderGeometry(H.r*1.17,H.r*1.17,.055,20,1,true),std(kit.accent,{side:T.DoubleSide}),H.x,H.y+H.r*.22,H.z);
   add(new T.BoxGeometry(H.r*1.7,.13,.07),std('#14181a'),H.x,H.y+H.r*.22,H.front-.01);
   add(new T.BoxGeometry(H.r*1.56,.1,.03),std(kit.lens,{metalness:.7,roughness:.12}),H.x,H.y+H.r*.22,H.front-.045);
   // chest logo patch
   const logo=add(new T.PlaneGeometry(.13,.13),new T.MeshBasicMaterial({map:logoTexture(kit.brand),transparent:true}),-.12,1.9,chestZ-.006);logo.rotation.y=Math.PI;logo.castShadow=false;
   // gloves with contrast cuffs
   for(const hand of [handL,handR]){add(new T.BoxGeometry(.12,.16,.11),std(kit.glove,{roughness:.9}),0,-.02,0,hand);add(new T.CylinderGeometry(.075,.075,.06,10),std(kit.accent),0,.07,0,hand);}
   return{root,handL,handR,pose(phase:number,power:number,air:boolean,grab:number,board:boolean,extra=0,moving=false,edge=0){
    // Skis: double-pole push. Both arms swing together, legs stay parallel and fold on the push.
    const stride=Math.sin(phase)*power,reach=Math.cos(phase)*power,crouch=air?.1+extra*(grab?.5:.22):(board?(moving?.3:.12):.26+Math.max(0,-reach)*.3)+extra*.5;
    if(board){bones[1].rotation.set(grab?-1.1:-stride*.75,0,.42);bones[3].rotation.set(grab?-.8:stride*.75,0,-.42);}
    else{const arm=grab?-1:-.35-reach*.9;bones[1].rotation.set(arm,0,.3);bones[3].rotation.set(arm,0,-.3);}
    bones[2].rotation.x=bones[4].rotation.x=grab?-.7:-.12;
    // Snowboard: knees open a little for a wider, athletic stance.
    bones[5].rotation.set(crouch,0,board?stride*.40+.12:0);bones[7].rotation.set(crouch,0,board?-.12:0);
    // Skis: outside leg long and loaded, inside leg folded and light.
    if(!board&&!air&&edge){const e=Math.abs(edge),[inL,outL,inK]=edge>0?[5,7,6]:[7,5,8];bones[inL].rotation.x+=.3*e;bones[outL].rotation.x-=.1*e;bones[inK].rotation.x-=.45*e;}
    bones[5].position.z=board?power*.32:0;bones[7].position.z=0;
    bones[6].rotation.x=-crouch*1.6-(board?Math.max(0,Math.cos(phase))*power*.35:0);bones[8].rotation.x=-crouch*1.6;
   },
   // Limp, flailing limbs while tumbling. a = flail strength (decays), k = 1 until getting back up.
   flail(e:number,a:number,k:number,seed:number){const w=(f:number,ph:number)=>Math.sin(e*f+seed+ph);
    bones[1].rotation.set((-.6+w(11,0)*1.4*a)*k,0,(.42+.9+w(7,1)*.6*a)*k+.42*(1-k));bones[3].rotation.set((-.6+w(10,2)*1.4*a)*k,0,(-.42-.9+w(8,3)*.6*a)*k-.42*(1-k));
    bones[2].rotation.x=(-.4-Math.abs(w(13,4))*1.1*a)*k-.12*(1-k);bones[4].rotation.x=(-.4-Math.abs(w(12,5))*1.1*a)*k-.12*(1-k);
    bones[5].rotation.set((.35+w(9,6)*1*a)*k,0,.2*k);bones[7].rotation.set((.2+w(8,7)*1*a)*k,0,-.2*k);
    bones[6].rotation.x=(-.5-Math.abs(w(10,8))*1*a)*k;bones[8].rotation.x=(-.3-Math.abs(w(11,9))*1*a)*k;
   }};
  },
  dispose(){disposed=true;for(const r of resources)r.dispose();resources.clear();}
 };
}
