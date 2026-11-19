import * as T from 'three';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';

// Image-based lighting + sky from CC0 Poly Haven HDRIs (see public/models/credits.json). One panorama per part of the day.
export type Sky={id:string;file:string;from:number;fog:string;exposure:number;env:number};
export const SKIES:Sky[]=[
 {id:'night',file:'qwantani_night',from:-1,fog:'#1b2434',exposure:.9,env:.35},
 {id:'morning',file:'passendorf_snow',from:6.5,fog:'#c4d3de',exposure:1,env:.9},
 {id:'day',file:'horn-koppe_snow',from:10,fog:'#d2dee8',exposure:1,env:1},
 {id:'dusk',file:'rural_winter_roadside',from:16.5,fog:'#d8c3bd',exposure:.95,env:.8},
 {id:'night',file:'qwantani_night',from:19.5,fog:'#1b2434',exposure:.9,env:.35},
];
export const skyFor=(hour:number)=>{let s=SKIES[0];for(const k of SKIES)if(hour>=k.from)s=k;return s;};

export function createEnvironment(renderer:T.WebGLRenderer,scene:T.Scene){
 const pmrem=new T.PMREMGenerator(renderer),cache=new Map<string,{env:T.Texture;bg:T.Texture}>(),loading=new Set<string>();let current='';
 function load(file:string){if(cache.has(file)||loading.has(file))return;loading.add(file);
  new RGBELoader().load(`/env/${file}.hdr`,tex=>{tex.mapping=T.EquirectangularReflectionMapping;const env=pmrem.fromEquirectangular(tex).texture;cache.set(file,{env,bg:tex});loading.delete(file);current='';},undefined,()=>loading.delete(file));}
 load('horn-koppe_snow');
 return{
  /** Returns the sky in use (or undefined while nothing has loaded yet, in which case the flat colours stay). */
  apply(hour:number):Sky|undefined{const s=skyFor(hour);load(s.file);const c=cache.get(s.file)||cache.get('horn-koppe_snow');if(!c)return undefined;
   if(current!==s.file){current=s.file;scene.environment=c.env;scene.background=c.bg;scene.backgroundBlurriness=.04;scene.backgroundIntensity=s.env;}
   scene.environmentIntensity=s.env;renderer.toneMappingExposure=s.exposure;return s;},
  dispose(){pmrem.dispose();for(const c of cache.values()){c.env.dispose();c.bg.dispose();}},
 };
}
