import assert from 'node:assert/strict';
import fs from 'node:fs';
import {FRONT_PETS,FRONT_PARTS} from '../src/art/frontwear.gen';
import {hasFrontWear,prepareFrontWear,frontWearReady,frontWearLoaded} from '../src/art/frontwear';
const approved=['maltese','poodle','corgi','shiba','koshort','russian','persian'];
assert.deepEqual(Object.keys(FRONT_PETS).sort(),[...approved].sort());
assert.deepEqual(Object.keys(FRONT_PARTS).sort(),['shoes:boots','shoes:ruby']);
for(const pet of approved){const g=FRONT_PETS[pet],key=g.species==='dog'?'boots':'ruby';assert(hasFrontWear(pet,'shoes',key));assert(!hasFrontWear(pet,'shoes',key==='boots'?'ruby':'boots'));assert.equal(g.feet.length,4);assert.equal(new Set(g.feet.map(f=>f[0])).size,4);for(const [x,y,w]of g.feet){assert(x>=0&&x+w<=640&&y>500&&y<=640&&w>0);}assert.deepEqual(frontWearReady(pet,{shoes:key}),[]);frontWearLoaded(pet,'shoes',key,'unreceived');assert.deepEqual(frontWearReady(pet,{shoes:key}),[]);}
for(const pet of ['fold','siamese','schnauzer','missing'])for(const key of ['boots','ruby']){assert(!hasFrontWear(pet,'shoes',key));assert.equal(await prepareFrontWear(pet,'shoes',key),null);}
for(const slot of ['hat','glasses','neck','clothes'])assert.equal(await prepareFrontWear('maltese',slot,'hoodie'),null);
for(const p of Object.values(FRONT_PARTS)){assert.equal(p.rects.length,4);for(const[x,y,w,h]of p.rects)assert(x>=0&&y>=0&&w>0&&h>0&&x+w<=p.width&&y+h<=p.height);}
// 수신 실패에는 기존 표시를 유지하며, 실패한 요청은 다음 시도에서 다시 받는다.
let attempts=0;
(globalThis as any).Image=class{onerror?:()=>void;set src(_:string){attempts++;queueMicrotask(()=>this.onerror?.());}};
assert.equal(await prepareFrontWear('maltese','shoes','boots'),null);const first=attempts;
assert.equal(await prepareFrontWear('maltese','shoes','boots'),null);assert(attempts>first);assert.deepEqual(frontWearReady('maltese',{shoes:'boots'}),[]);
const data=JSON.parse(fs.readFileSync(new URL('./data/front-shoes.json',import.meta.url),'utf8'));
assert.deepEqual(FRONT_PETS,data.pets);assert.deepEqual(FRONT_PARTS,data.parts);
console.log('공통 정면 신발: 검수7조합·네 발/부품 범위·다른 종/미검수 제외·해독 전 기존 표시·수신 실패/재시도 통과');
