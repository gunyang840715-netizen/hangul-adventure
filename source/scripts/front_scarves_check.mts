import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FRONT_SCARF,FRONT_SCARVES} from '../src/art/frontscarves.gen';
import {hasFrontWear,prepareFrontWear,frontWearReady} from '../src/art/frontwear';
const data=JSON.parse(fs.readFileSync(new URL('./data/front-scarves.json',import.meta.url),'utf8'));
assert.deepEqual(FRONT_SCARVES,data.pets);assert.deepEqual(FRONT_SCARF,data.part);
assert.deepEqual(Object.keys(FRONT_SCARVES).sort(),['maltese','poodle','schnauzer','shiba']);
for(const [pet,g] of Object.entries(FRONT_SCARVES)){assert(hasFrontWear(pet,'neck','scarf'));assert(!hasFrontWear(pet,'neck','bell'));assert(g.width>150&&g.width<210);assert(g.target[1]>390&&g.target[1]<430);assert(g.occlusion.length>10);assert.deepEqual(frontWearReady(pet,{neck:'scarf'}),[]);}
for(const pet of ['corgi','koshort','russian','siamese','persian','fold','missing'])assert(!hasFrontWear(pet,'neck','scarf'));
let attempts=0;(globalThis as any).Image=class{onerror?:()=>void;set src(_:string){attempts++;queueMicrotask(()=>this.onerror?.());}};
assert.equal(await prepareFrontWear('schnauzer','neck','scarf'),null);const first=attempts;assert.equal(await prepareFrontWear('schnauzer','neck','scarf'),null);assert(attempts>first);
assert.deepEqual(frontWearReady('schnauzer',{neck:'scarf'}),[]);
console.log('공통 목도리: 네 친구만 등록·다른 품목/기존 코기 제외·가림 자료·수신 실패 재시도 통과');
