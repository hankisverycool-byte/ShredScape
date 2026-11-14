import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {Outfit} from './game-engine';
import {helmetById,drawHelmetLogo,type Helmet} from './drops';
import {kitById,drawLogo,BRANDS,type Brand} from './kits';
import type {Rig,Leg} from './rig';
const logos=new Map<Brand,T.CanvasTexture>();
const hLogos=new Map<string,T.CanvasTexture>();
function helmetLogoTexture(h:Helmet){let t=hLogos.get(h.id);if(!t){const c=document.createElement('canvas');c.width=c.height=128;drawHelmetLogo(c.getContext('2d')!,h.logo,128,h.accent,'#00000000');t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;hLogos.set(h.id,t);}return t;}
function logoTexture(b:Brand){let t=logos.get(b);if(!t){const c=document.createElement('canvas');c.width=c.height=128;drawLogo(c.getContext('2d')!,b,128,BRANDS[b].ink,'#00000055');t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;logos.set(b,t);}return t;}

type Template = T.Group;
export function createModelAssets(onReady:()=>void){
 const loader=new GLTFLoader(),trees:Template[]=[];let board:Template|null=null,skis:Template|null=null,person:Template|null=null,disposed=false;let goggleParts:{frame:T.BufferGeometry;lens:T.BufferGeometry}|null=null;let helmetParts:{shell:T.BufferGeometry;liner:T.BufferGeometry|null;pads:T.BufferGeometry|null}|null=null;const paintCache=new Map<string,T.BufferGeometry>();
 const resources=new Set<T.BufferGeometry|T.Material|T.Texture>();
 function track(g:T.Object3D){g.traverse(o=>{if(o instanceof T.Mesh){resources.add(o.geometry);o.geometry.userData.assetShared=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){resources.add(m);m.userData.assetShared=true;for(const value of Object.values(m))if(value instanceof T.Texture)resources.add(value);}}});}
 function bake(mesh:T.Mesh,matrix=mesh.matrixWorld){const out=new T.Mesh(mesh.geometry.clone().applyMatrix4(matrix),mesh.material);out.name=mesh.name;out.castShadow=true;out.receiveShadow=true;return out;}
 function fit(group:T.Group,size:number,axis:'x'|'y'|'z'){const box=new T.Box3().setFromObject(group),center=box.getCenter(new T.Vector3()),scale=size/box.getSize(new T.Vector3())[axis];for(const m of group.children as T.Mesh[]){m.geometry.translate(-center.x,-box.min.y,-center.z);m.geometry.scale(scale,scale,scale);}track(group);return group;}
 async function load(url:string,prepare:(scene:T.Group)=>void){try{const gltf=await loader.loadAsync(url);if(disposed){gltf.scene.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});return;}gltf.scene.updateMatrixWorld(true);track(gltf.scene);prepare(gltf.scene);onReady();}catch(e){console.warn('Model could not load; using built-in fallback.',url,e);}}
 void load('/models/snowy-trees.glb',scene=>{scene.traverse(o=>{if(o instanceof T.Mesh){const g=new T.Group();g.add(bake(o));trees.push(fit(g,5,'y'));}});});
 // Ski helmet (CC BY 4.0, see model-credits): baked, turned so the opening faces -Z like the rider, and normalised to width 1 with its rim at y=0.
 void load('/models/ski-helmet.glb',scene=>{const turn=new T.Matrix4().makeRotationY(Math.PI),parts:Record<string,T.BufferGeometry>={};
  scene.traverse(o=>{if(o instanceof T.Mesh)parts[o.name]=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(turn);});
  const shell=parts.Object_3;if(!shell)return;shell.computeBoundingBox();const bb=shell.boundingBox!,k=1/(bb.max.x-bb.min.x),cx=(bb.min.x+bb.max.x)/2,cz=(bb.min.z+bb.max.z)/2;
  for(const g of Object.values(parts)){g.translate(-cx,-bb.min.y,-cz);g.scale(k,k,k);g.userData.assetShared=true;}
  helmetParts={shell,liner:parts.Object_2||null,pads:parts.Object_4||null};});
 // Goggles (CC BY 4.0, see model-credits), thinned out to ~9k triangles: frame, strap and lens. Turned to face -Z and centred on the middle of the head.
 void load('/models/ski-goggles.glb',scene=>{const turn=new T.Matrix4().makeRotationY(Math.PI),parts:Record<string,T.BufferGeometry>={};
  scene.traverse(o=>{if(o instanceof T.Mesh&&['frame','lens'].includes(o.name))parts[o.name]=o.geometry.clone().applyMatrix4(o.matrixWorld).applyMatrix4(turn);});
  if(!parts.frame||!parts.lens)return;for(const g of Object.values(parts)){g.translate(0,-1.684,-.005);g.userData.assetShared=true;}goggleParts={frame:parts.frame,lens:parts.lens};});
 void load('/models/eli-snowboard.glb',scene=>{const g=new T.Group();scene.traverse(o=>{if(o instanceof T.Mesh)g.add(bake(o));});board=fit(g,2.2,'x');});
 void load('/models/skis/scene.gltf',scene=>{const g=new T.Group();// Raw ski mesh has bindings on -Y; flip so they face up and the tip points forward (-Z).
 scene.getObjectByName('Ski_L')?.traverse(o=>{if(o instanceof T.Mesh)g.add(bake(o,new T.Matrix4().makeRotationX(Math.PI)));});skis=fit(g,2.2,'z');
  });
 void load('/models/rider.glb',scene=>{
  const g=new T.Group();scene.traverse(o=>{if(o instanceof T.Mesh&&['Object_4','Object_6','Object_8','Object_10','Object_12'].includes(o.name)){const m=bake(o);m.name=o.name;g.add(m);}});
  person=fit(g,2.65,'y');
  // Source faces +Z. Our riders face -Z.
  // Skinning. Bones: 0 root, 1/2 L shoulder/elbow, 3/4 R shoulder/elbow, 5/6/10 L hip/knee/ankle, 7/8/11 R hip/knee/ankle, 9 chest.
  // Every blend is a smoothstep so nothing is cut along a hard line: a big arm swing used to tear the mesh at the shoulder.
  person.traverse(o=>{if(!(o instanceof T.Mesh))return;o.geometry.rotateY(Math.PI);const p=o.geometry.attributes.position,indices:number[]=[],weights:number[]=[],sm=T.MathUtils.smoothstep;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),ax=Math.abs(x),left=x<0;
    if(o.name==='Object_12'){indices.push(left?10:11,0,0,0);weights.push(1,0,0,0);continue;} // shoes ride the ankle bone
    if(y<1.42){ // hips and legs: thigh -> shin -> ankle, easing into the root at the crotch
     const kb=sm(.80-y,-.08,.08),ab=sm(.34-y,0,.2),rb=y>1.30?sm(y,1.30,1.42):0,leg=1-rb;
     indices.push(0,left?5:7,left?6:8,left?10:11);weights.push(rb,leg*(1-kb),leg*kb*(1-ab),leg*kb*ab);
    }else{ // torso and arms: root -> chest up the body; a wide blend band from torso into shoulder, then shoulder -> elbow
     const cb=sm(y,1.42,1.80),armW=y<2.34?sm(ax,.20,.42)*(1-sm(y,2.20,2.34)):0,eb=sm(1.82-y,-.10,.10);
     indices.push(0,9,left?1:3,left?2:4);weights.push((1-armW)*(1-cb),(1-armW)*cb,armW*(1-eb),armW*eb);
    }
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
 // Paint the helmet shell with vertex colours: a base colour plus stripes and bands, chosen by design. Cached per look.
 function paintedShell(key:string,paint:(x:number,y:number,z:number,c:T.Color)=>void,base:string){let g=paintCache.get(key);if(g)return g;const src=helmetParts!.shell;g=src.clone();g.userData.assetShared=true;const pos=g.attributes.position,col:number[]=[],c=new T.Color();
  for(let i=0;i<pos.count;i++){c.set(base);paint(pos.getX(i),pos.getY(i),pos.getZ(i),c);col.push(c.r,c.g,c.b);}g.setAttribute('color',new T.Float32BufferAttribute(col,3));paintCache.set(key,g);return g;}
 function clone(template:Template|null){return template?.clone(true)||null;}
 return{
  tree(seed:number){return trees.length?clone(trees[Math.abs(Math.floor(seed))%trees.length]):null;},
  snowboard(){return clone(board);},ski(){return clone(skis);},
  rider(outfit:Outfit){
   if(!person)return null;
   const root=new T.Group(),bones:T.Bone[]=[];
   function bone(parent:number,x:number,y:number,z=0){const b=new T.Bone();b.position.set(x,y,z);if(parent<0)root.add(b);else bones[parent].add(b);bones.push(b);}
   bone(-1,0,0);bone(0,-.36,2.16);bone(1,-.24,-.34);bone(0,.36,2.16);bone(3,.24,-.34);bone(0,-.18,1.35);bone(5,-.04,-.61);bone(0,.18,1.35);bone(7,.04,-.61);
   // Chest bone at the waist: shoulders, arms, head and headgear hang off it so the upper body can twist, tuck and angulate.
   bone(0,0,1.45);for(const i of [1,3]){bones[9].add(bones[i]);bones[i].position.y-=1.45;}
   bone(6,-.07,-.57,.12);bone(8,.07,-.57,.12); // 10/11 ankles: measured from the shin/shoe meshes after turning the model to face -Z (ankle .17 above the sole, .12 behind the knee line)
   // Hand centre measured from the skin mesh (after the turn to face -Z): (+-.125, -.28, -.20) from the elbow, i.e. the rest forearm points forward-down.
   const handL=new T.Group(),handR=new T.Group();handL.position.set(-.125,-.28,-.20);handR.position.set(.125,-.28,-.20);bones[2].add(handL);bones[4].add(handR);
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
      colors.push(c.r,c.g,c.b);
      if(front&&Math.abs(x+.12)<.04&&Math.abs(y-1.9)<.04)chestZ=Math.min(chestZ,z);}
     geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();material.map=null;material.normalMap=null;material.vertexColors=true;material.color.set('#ffffff');material.roughness=style==='race'?.45:.8;
    }
    const m=new T.SkinnedMesh(geo,material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;root.add(m);m.bind(skeleton);
   }
   const H=headInfo(),kitGear=new T.Group();kitGear.position.y=-1.45;bones[9].add(kitGear);
   const std=(c:string,o:Partial<T.MeshStandardMaterialParameters>={})=>new T.MeshStandardMaterial({color:c,roughness:.6,...o});
   const add=(g:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number,parent:T.Object3D=kitGear)=>{const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
   // Head gear. Freeride kits wear a beanie and hood; everything else (and any limited-drop helmet) gets a proper shell: rounded crown, front peak,
   // ear pads, a stripe over the top, and a curved goggle lens on a strap instead of a box stuck to the face.
   const design=helmetById(outfit.helmet),lensCol=design?design.lens:kit.lens;
   if(style==='freeride'&&!design){
    add(new T.SphereGeometry(H.r*1.08,16,10,0,Math.PI*2,0,Math.PI*.5),std(kit.accent,{roughness:1}),H.x,H.y+H.r*.32,H.z);
    add(new T.CylinderGeometry(H.r*1.1,H.r*1.1,.07,18),std(kit.accent,{roughness:1}),H.x,H.y+H.r*.32,H.z);
    // hood up over the beanie, open at the face
    add(new T.SphereGeometry(H.r*1.3,16,12,Math.PI*1.5+1.05,Math.PI*2-2.1,0,Math.PI*.6),std(outfit.jacket,{roughness:.85,side:T.DoubleSide}),H.x,H.y+H.r*.2,H.z+.05);
   }else if(helmetParts){
    // The real helmet model, scaled to the head, with the design painted on as vertex colours and a mark on each side.
    const fin=design?.finish||'gloss',shellC=design?design.shell:outfit.hat,stripeC=design?design.stripe:kit.accent,accC=design?design.accent:kit.accent;
    const W=H.r*2.7,top=2*H.y-H.minY,y0=top+H.r*.2-1.03*W,cz=H.z+H.r*.12;
    const geo=paintedShell((design?.id||'stock')+shellC+stripeC+accC,(x,y,z,c)=>{
     const ang=Math.atan2(z,x),sc=new T.Color(stripeC),ac=new T.Color(accC);
     if(!design){if(Math.abs(x)<.035&&y>.4)c.copy(sc);return;}
     if(design.id==='redstag'){if(Math.abs(Math.abs(x)-.14)<.034&&y>.42)c.copy(sc);else if(y>.355&&y<.41)c.copy(ac);}
     else if(design.id==='voltchrome'){if(Math.abs(x)<.05&&y>.4)c.copy(sc);else if(Math.abs(x)>.46&&y>.45&&y<.75&&Math.sin(y*38+ang*2)>.2)c.copy(sc);}
     else if(design.id==='glacierghost'){if(Math.abs(x)<.1&&y>.4)c.copy(sc);else if(y>.36&&y<.4)c.copy(ac);}
     else{const edge=.46+.1*Math.sin(ang*6+y*4);if(y<edge&&y>.3)c.copy(y<edge-.07?ac:sc);else if(Math.abs(x)<.03&&y>.5)c.copy(sc);}
    },shellC);
    const grp=new T.Group();grp.position.set(H.x,y0,cz);grp.scale.setScalar(W);kitGear.add(grp);
    const shellMesh=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,color:'#ffffff',roughness:fin==='chrome'?.18:fin==='matte'?.85:.32,metalness:fin==='chrome'?.55:0,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));shellMesh.castShadow=true;grp.add(shellMesh);
    {const under=new T.Mesh(geo,shellMesh.material);under.scale.setScalar(.975);under.position.set(0,.52*(1-.975),0);grp.add(under);} // a second, slightly smaller shell behind it, so any gap left by the thinned mesh shows shell colour, not the head
    if(helmetParts.liner){const lm=std('#1a1e21',{roughness:.95,side:T.DoubleSide});lm.polygonOffset=true;lm.polygonOffsetFactor=4;lm.polygonOffsetUnits=4;grp.add(new T.Mesh(helmetParts.liner,lm));}
    if(helmetParts.pads){const pm=std('#262c30',{roughness:.9,side:T.DoubleSide});pm.polygonOffset=true;pm.polygonOffsetFactor=3;pm.polygonOffsetUnits=3;grp.add(new T.Mesh(helmetParts.pads,pm));}
    add(new T.CylinderGeometry(.15,.17,.13,14),std(outfit.jacket,{roughness:.85}),H.x,H.minY+.02,H.z+.01); // storm collar
    if(design){for(const sx of [-1,1]){const d=new T.Mesh(new T.PlaneGeometry(.2,.2),new T.MeshBasicMaterial({map:helmetLogoTexture(design),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));d.position.set(H.x+sx*.4*W,y0+.64*W,cz+.02);d.rotation.y=sx*Math.PI/2;kitGear.add(d);}}
   }else{
    const shellC=design?design.shell:outfit.hat,stripeC=design?design.stripe:kit.accent,fin=design?.finish||'gloss';
    const shellMat=std(shellC,fin==='chrome'?{roughness:.2,metalness:.55}:fin==='matte'?{roughness:.9}:{roughness:.3}),stripeMat=std(stripeC,{roughness:.4}),dark=std('#15191b',{roughness:.8});
    const R=H.r*1.12,zs=style==='race'?1.28:1.1,cy=H.y+H.r*.2,cz=H.z+H.r*.06;
    const shell=add(new T.SphereGeometry(R,24,14,0,Math.PI*2,0,Math.PI*.5),shellMat,H.x,cy,cz);shell.scale.set(1,.96,zs);
    // front peak over the goggles, and ear pads
    const peak=add(new T.BoxGeometry(R*1.25,.03,R*.5),shellMat,H.x,cy+R*.2,H.front-R*.02);peak.rotation.x=-.28;
    for(const sx of [-1,1]){const ear=add(new T.SphereGeometry(H.r*.3,10,8),dark,H.x+sx*R*.97,H.y-H.r*.04,H.z+H.r*.1);ear.scale.set(.55,1,.95);}
    // stripes over the top, front to back (one centre stripe on a stock helmet, a pair on a drop helmet)
    for(const x of (design?[-.3,.3]:[0])){const rr=Math.sqrt(Math.max(.0001,(R*.99)**2-(x*R)**2)),t=add(new T.TorusGeometry(rr,.017,6,32,Math.PI),stripeMat,H.x+x*R,cy,cz);t.rotation.y=Math.PI/2;t.scale.set(zs,.96,1);}
    add(new T.CylinderGeometry(.15,.17,.13,14),std(outfit.jacket,{roughness:.85}),H.x,H.minY+.02,H.z+.01); // storm collar
    if(design){for(const sx of [-1,1]){const d=add(new T.PlaneGeometry(.17,.17),new T.MeshBasicMaterial({map:helmetLogoTexture(design),transparent:true}),H.x+sx*(R*1.012),cy+R*.08,cz+.04);d.rotation.y=sx*Math.PI/2;d.castShadow=false;}}
   }
   // goggles: the real model when it has loaded (frame, strap and mirrored lens), otherwise a simple curved lens
   if(goggleParts){const gs=H.r*10,gy=H.y-H.r*.04,gz=H.z-H.r*.24,grp=new T.Group();grp.position.set(H.x,gy,gz);grp.scale.setScalar(gs);kitGear.add(grp);
    const frameMat=std(design?design.accent:'#1a1e21',{roughness:.55,side:T.DoubleSide}),strapMat=std(design?design.stripe:kit.accent,{roughness:.8,side:T.DoubleSide}),lensMat=std(lensCol,{metalness:.65,roughness:.1,side:T.DoubleSide});
    for(const [g,m] of [[goggleParts.frame,frameMat],[goggleParts.lens,lensMat]] as const){const mesh=new T.Mesh(g,m);mesh.castShadow=true;grp.add(mesh);}
    // the strap: an elastic band round the outside of the helmet at lens height, meeting the frame at the sides
    const HWd=H.r*2.7,sr=HWd*.47,strap=add(new T.CylinderGeometry(sr,sr,.075,28,1,true,Math.PI-2.1,4.2),strapMat,H.x,gy+H.r*.12,H.z+H.r*.1);strap.scale.z=1.02;}
   else{   {const gy=H.y+H.r*.2,lr=(H.z-H.front)+.045,strapR=Math.sqrt((H.r*1.12)**2-(H.r*.06)**2)*1.02,strap=helmetParts?null:add(new T.CylinderGeometry(strapR,strapR,.055,28,1,true),std(design?design.accent:kit.accent,{side:T.DoubleSide,roughness:.7}),H.x,H.y+H.r*.28,H.z+H.r*.06);if(strap)strap.scale.z=style==='race'?1.28:1.1;
    add(new T.CylinderGeometry(lr,lr,.17,22,1,true,Math.PI-.78,1.56),std('#14181a',{side:T.DoubleSide}),H.x,gy,H.z);
    add(new T.CylinderGeometry(lr+.014,lr+.014,.125,22,1,true,Math.PI-.7,1.4),std(lensCol,{metalness:.6,roughness:.12,side:T.DoubleSide}),H.x,gy,H.z);}
   }
   // chest logo patch
   const logo=add(new T.PlaneGeometry(.13,.13),new T.MeshBasicMaterial({map:logoTexture(kit.brand),transparent:true}),-.12,1.9,chestZ-.006);logo.rotation.y=Math.PI;logo.castShadow=false;
   // gloves: a mitten over the real hand, with a contrast cuff over the sleeve end
   for(const hand of [handL,handR]){const g=add(new T.CapsuleGeometry(.085,.12,4,8),std(kit.glove,{roughness:.9}),0,0,0,hand);g.scale.set(1,1,1.3);add(new T.CylinderGeometry(.097,.097,.06,12),std(kit.accent),0,.13,0,hand);}
   const mkLeg=(h:number,k:number,a:number,side:number):Leg=>({hip:bones[h],knee:bones[k],ankle:bones[a],hipRest:new T.Vector3(side*.18,0,0),r1:bones[k].position.clone().normalize(),r2:bones[a].position.clone().normalize(),L1:bones[k].position.length(),L2:bones[a].position.length(),soleOff:new T.Vector3(0,-.17,-.125)});
   const legs:[Leg,Leg]=[mkLeg(5,6,10,-1),mkLeg(7,8,11,1)],pelvis=new T.Vector3(0,1.35,0);
   const rig:Rig={legs,pelvis,reach:legs[0].L1+legs[0].L2,hands:[handL,handR],
    movePelvis(x,y,z){pelvis.set(x,y,z);bones[0].position.set(x,y-1.35,z);},
    setTorso(pitch,yaw,roll){bones[9].rotation.set(pitch,yaw,roll);},
    // `out` 0 = arm hanging straight down. The rest pose has the arms angled out ~.6, so the shoulder z-rotation is .55 - out.
    // The rest-pose forearm already points ~.62 forward of the upper arm's line, so `elbow` 0 (straight) means undoing that.
    setArm(side,a){const s=side?-1:1;bones[side?3:1].rotation.set(a.pitch,s*a.twist,s*(.55-a.out));bones[side?4:2].rotation.set(a.elbow-.62,0,0);}};
   return{root,handL,handR,rig,
   // Limp, flailing limbs while tumbling. a = flail strength (decays), k = 1 until getting back up.
   flail(e:number,a:number,k:number,seed:number){const w=(f:number,ph:number)=>Math.sin(e*f+seed+ph);
    bones[0].position.set(0,0,0);bones[10].quaternion.identity();bones[11].quaternion.identity();
    bones[9].rotation.set(w(6,10)*.5*a*k,w(5,11)*.6*a*k,w(7,12)*.4*a*k);
    bones[1].rotation.set((-.6+w(11,0)*1.4*a)*k,0,(.42-.9+w(7,1)*.6*a)*k+.42*(1-k));bones[3].rotation.set((-.6+w(10,2)*1.4*a)*k,0,(-.42+.9+w(8,3)*.6*a)*k-.42*(1-k));
    bones[2].rotation.x=(-.4-Math.abs(w(13,4))*1.1*a)*k-.12*(1-k);bones[4].rotation.x=(-.4-Math.abs(w(12,5))*1.1*a)*k-.12*(1-k);
    bones[5].rotation.set((.35+w(9,6)*1*a)*k,0,-.2*k);bones[7].rotation.set((.2+w(8,7)*1*a)*k,0,.2*k);
    bones[6].rotation.x=(-.5-Math.abs(w(10,8))*1*a)*k;bones[8].rotation.x=(-.3-Math.abs(w(11,9))*1*a)*k;
   }};
  },
  dispose(){disposed=true;for(const r of resources)r.dispose();resources.clear();}
 };
}
