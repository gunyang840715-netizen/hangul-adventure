import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync}from 'node:child_process';
import {FRONT_CLOTHES}from '../src/art/frontclothes.gen';
import {hasFrontWear,prepareFrontWear,frontWearCloth,frontWearLoaded,frontWearReady}from '../src/art/frontwear';
execFileSync(process.execPath,['scripts/build_front_clothes.mjs','--check'],{stdio:'inherit'});
const data=JSON.parse(fs.readFileSync('scripts/data/front-clothes.json','utf8'));
const dogs=['corgi','maltese','poodle','schnauzer','shiba'],cats=['fold','koshort','persian','russian','siamese'];
assert.equal(data.entries.length,10);assert.deepEqual(data.entries.filter((e:any)=>e.item==='sweater').map((e:any)=>e.pet).sort(),cats);assert.deepEqual(data.entries.filter((e:any)=>e.item==='hoodie').map((e:any)=>e.pet).sort(),dogs);
const hash=(bytes:Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(data.sharedAssets.length,3);assert.deepEqual(data.sharedAssets.map((a:any)=>a.name).sort(),['body','collar','sleeve']);assert.equal(new Set(data.sharedAssets.map((a:any)=>a.url)).size,3);
for(const a of data.sharedAssets){assert.deepEqual([...a.consumers].sort(),dogs);const bytes=fs.readFileSync('../'+a.url.replace(/^\.\//,''));assert.equal(hash(bytes),a.sha256);assert.equal(bytes.length,a.bytes);assert.ok(bytes.length<=40000);}
for(const e of data.entries){
 assert.deepEqual(e.stages,['baby','kid','adult']);assert.equal(e.pose,'front');assert.equal(e.productNumericPassed,3);assert.equal(e.productVisualPassed,3);assert.equal(e.method,'B');assert.ok(hasFrontWear(e.pet,'clothes',e.item));assert.ok(!hasFrontWear(e.pet,'hat',e.item));assert.equal(FRONT_CLOTHES[e.pet+':'+e.item].url,e.url);
 if(e.item==='sweater'){const bytes=fs.readFileSync('../'+e.url.replace(/^\.\//,''));assert.equal(bytes.length,e.bytes);assert.equal(hash(bytes),e.sha256);assert.ok(!hasFrontWear(e.pet,'clothes','hoodie'));continue;}
 assert.ok(!hasFrontWear(e.pet,'clothes','sweater'));assert.equal(e.shared.parts.length,3);assert.deepEqual(FRONT_CLOTHES[e.pet+':hoodie'].shared,e.shared);
 assert.equal(e.sha256,hash(Buffer.from(data.sharedAssets.map((a:any)=>a.sha256).join(''))));assert.equal(e.bytes,data.sharedAssets.reduce((n:number,a:any)=>n+a.bytes,0));
 for(const p of e.shared.parts){assert.equal(data.sharedAssets.filter((a:any)=>a.name===p.name&&a.url===p.url).length,1,'모든 친구가 동일 부품을 참조');assert.equal(p.rect.length,4);assert.equal(p.sourceSize.length,2);assert.ok(p.rect.every((n:number)=>Number.isFinite(n)&&n>=0));assert.ok(p.rect[0]+p.rect[2]<=p.sourceSize[0]&&p.rect[1]+p.rect[3]<=p.sourceSize[1]);}
 assert.equal(e.shared.grid.length,2);assert.ok(e.shared.grid.every((n:number)=>Number.isInteger(n)&&n>0&&n<=32));assert.equal(e.shared.body.length,6);assert.equal(e.shared.arms.length,2);assert.ok([e.shared.body,...e.shared.arms].every((m:number[])=>m.length===6&&m.every(Number.isFinite)&&Math.abs(m[0]*m[3]-m[1]*m[2])>.01));assert.equal(e.shared.feet.length,4);assert.ok(e.shared.bodyBottomScale>0&&e.shared.bodyBottomScale<=1);
}
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
 fail=true;assert.equal(await prepareFrontWear('corgi','clothes','hoodie'),null);assert.equal(frontWearCloth('corgi','hoodie'),null);assert.deepEqual(frontWearReady('corgi',{clothes:'hoodie'}),[],'공유 부품 수신 실패 때 기존 옷 유지');
 assert.equal(await prepareFrontWear('corgi','clothes','hoodie'),null);assert.deepEqual(frontWearReady('corgi',{clothes:'hoodie'}),[]);
}finally{if(previous===undefined)delete globalImages.Image;else globalImages.Image=previous;}
console.log('B 스웨터5·공유 후드티5×성장3: 실제3부품 공유·해시·상한·기존 착용·수신 실패/재시도·착탈 전환 통과');
