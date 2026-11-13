import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {Outfit} from './game-engine';

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
   for(const original of person.children as T.Mesh[]){
    const source=original.material as T.MeshStandardMaterial,material=source.clone();material.userData={};material.roughness=.95;material.metalness=0;
    let geo=original.geometry;
    if(original.name==='Object_10'){
     // Keep the suit's geometry, but make jacket and trousers respond to wardrobe colors.
     geo=geo.clone();geo.userData={};const pos=geo.attributes.position,colors=[];const jacket=new T.Color(outfit.jacket),pants=new T.Color(outfit.pants);
     for(let i=0;i<pos.count;i++){const c=pos.getY(i)<1.28?pants:jacket;colors.push(c.r,c.g,c.b);}
     geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));material.map=null;material.normalMap=null;material.vertexColors=true;material.color.set('#ffffff');
    }
    if(original.name==='Object_6'){material.color.set(outfit.hat);}
    const m=new T.SkinnedMesh(geo,material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;root.add(m);m.bind(skeleton);
   }
   return{root,handL,handR,pose(phase:number,power:number,air:boolean,grab:number,board:boolean,extra=0,moving=false){
    // Skis: double-pole push. Both arms swing together, legs stay parallel and fold on the push.
    const stride=Math.sin(phase)*power,reach=Math.cos(phase)*power,crouch=air?.1+extra*(grab?.5:.22):(board?(moving?.3:.12):.26+Math.max(0,-reach)*.3)+extra*.5;
    if(board){bones[1].rotation.set(grab?-1.1:-stride*.75,0,.42);bones[3].rotation.set(grab?-.8:stride*.75,0,-.42);}
    else{const arm=grab?-1:-.35-reach*.9;bones[1].rotation.set(arm,0,.3);bones[3].rotation.set(arm,0,-.3);}
    bones[2].rotation.x=bones[4].rotation.x=grab?-.7:-.12;
    // Snowboard: knees open a little for a wider, athletic stance.
    bones[5].rotation.set(crouch,0,board?stride*.40+.12:0);bones[7].rotation.set(crouch,0,board?-.12:0);
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
