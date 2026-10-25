import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync}from 'node:child_process';
import {FRONT_CLOTHES}from '../src/art/frontclothes.gen';
import {hasFrontWear,prepareFrontWear,frontWearCloth,frontWearLoaded,frontWearReady}from '../src/art/frontwear';
execFileSync(process.execPath,['scripts/build_front_clothes.mjs','--check'],{stdio:'inherit'});
const data=JSON.parse(fs.readFileSync('scripts/data/front-clothes.json','utf8'));
assert.equal(data.entries.length,5);assert.deepEqual(data.entries.map((e:any)=>e.pet).sort(),['fold','koshort','persian','russian','siamese']);
for(const e of data.entries){assert.deepEqual(e.stages,['baby','kid','adult']);assert.equal(e.pose,'front');assert.equal(e.productNumericPassed,3);assert.equal(e.productVisualPassed,3);assert.equal(e.method,'B');const bytes=fs.readFileSync('../'+e.url.replace(/^\.\//,''));assert.equal(bytes.length,e.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);assert.ok(hasFrontWear(e.pet,'clothes','sweater'));assert.ok(!hasFrontWear(e.pet,'clothes','hoodie'));assert.ok(!hasFrontWear(e.pet,'hat','sweater'));assert.equal(FRONT_CLOTHES[e.pet+':sweater'].url,e.url);}
for(const pet of ['maltese','poodle','corgi','shiba','schnauzer'])assert.equal(hasFrontWear(pet,'clothes','hoodie'),false,'미배포 후드티가 기존 표시를 대체하면 안 됨');
assert.ok(hasFrontWear('poodle','shoes','boots'));assert.ok(hasFrontWear('koshort','shoes','ruby'));assert.ok(hasFrontWear('maltese','neck','scarf'));
const globalImages=globalThis as unknown as {Image:any};const previous=globalImages.Image;let fail=false;
class TestImage{decoding='';onload=()=>{};onerror=()=>{};set src(_url:string){queueMicrotask(()=>fail?this.onerror():this.onload());}}
try{
 globalImages.Image=TestImage;
 const layer=await prepareFrontWear('koshort','clothes','sweater');assert.ok(layer?.deform);assert.ok(frontWearCloth('koshort','sweater'));
 assert.deepEqual(frontWearReady('koshort',{clothes:'sweater'}),[],'이미지 수신만으로 기존 옷을 숨기면 안 됨');
 frontWearLoaded('koshort','clothes','sweater','wrong-url');assert.deepEqual(frontWearReady('koshort',{clothes:'sweater'}),[]);
 frontWearLoaded('koshort','clothes','sweater',layer.url);assert.deepEqual(frontWearReady('koshort',{clothes:'sweater'}),['clothes']);
 assert.deepEqual(frontWearReady('koshort',{clothes:'dots'}),[]);assert.equal(frontWearCloth('koshort','dots'),null);
 fail=true;assert.equal(await prepareFrontWear('russian','clothes','sweater'),null);assert.equal(frontWearCloth('russian','sweater'),null);assert.deepEqual(frontWearReady('russian',{clothes:'sweater'}),[]);
 fail=false;const retry=await prepareFrontWear('russian','clothes','sweater');assert.ok(retry?.deform);assert.ok(frontWearCloth('russian','sweater'));
 assert.equal(await prepareFrontWear('corgi','clothes','hoodie'),null);
}finally{if(previous===undefined)delete globalImages.Image;else globalImages.Image=previous;}
console.log('B 정면 스웨터:5친구×성장3 등록·해시·기존 신발/목도리·수신 실패/재시도·정확한 착탈 전환 통과');
