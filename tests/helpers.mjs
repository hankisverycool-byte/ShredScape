import fs from 'node:fs';
import ts from 'typescript';
// Loads an app/*.ts module for tests, following its relative imports (renderer3d is replaced by a stub that records the last frame).
const cache=new Map(),toUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const stub=toUrl('export function createMountain3D(){return{draw(f){globalThis.frameState=f},destroy(){}}}');
export function load(path){
 if(cache.has(path))return cache.get(path);
 const src=ts.transpile(fs.readFileSync(path,'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022})
  .replace(/from\s+'\.\/([\w-]+)'/g,(m,name)=>'from '+JSON.stringify(name==='renderer3d'?stub:load('app/'+name+'.ts')));
 const url=toUrl(src);cache.set(path,url);return url;
}
export const mod=path=>import(load(path));
