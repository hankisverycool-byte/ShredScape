import test from 'node:test';
import assert from 'node:assert/strict';
import {mod} from './helpers.mjs';
const K=await mod('app/kits.ts');
const {KITS,ICONS,ALL_KITS,kitById,BRANDS}=K;
test('the shop has outerwear and six original icon skins with valid ids and prices',()=>{
 assert.ok(KITS.length>=9);assert.equal(ICONS.length,6);
 const ids=ALL_KITS.map(k=>k.id);assert.equal(new Set(ids).size,ids.length,'unique ids');
 for(const k of ALL_KITS){assert.match(k.id,/^[a-z]{2,16}$/,k.id+' valid for the room server');assert.ok(BRANDS[k.brand],k.brand);assert.ok(k.price>=0);for(const c of [k.jacket,k.pants,k.accent,k.helmet,k.lens,k.glove])assert.match(c,/^#[0-9a-f]{6}$/i);}
 for(const k of ICONS){assert.equal(k.tier,'icon');assert.ok(k.tag&&k.price>=1500,k.name);}
 assert.equal(kitById('kaito').name,'Kaito "Hurricane" Mori');assert.equal(kitById('nope').id,'timber');
});
