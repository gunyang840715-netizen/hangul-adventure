import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {execFileSync}from 'node:child_process';
import {FRONT_CLOTHES}from '../src/art/frontclothes.gen';
import {APPROVED_FRONT_CLOTHES}from '../src/art/frontwear-approved';
import {APPROVED_FRONT_NECK}from '../src/art/frontwear-neck-approved';
import {hasFrontWear,hasApprovedFrontWear,prepareFrontWear,frontWearCloth,frontWearLoaded,frontWearReady}from '../src/art/frontwear';
execFileSync(process.execPath,['scripts/build_front_clothes.mjs','--check'],{stdio:'inherit'});
const data=JSON.parse(fs.readFileSync('scripts/data/front-clothes.json','utf8'));
const dogs=['corgi','maltese','poodle','schnauzer','shiba'],cats=['fold','koshort','persian','russian','siamese'];
assert.equal(data.entries.length,10);assert.deepEqual(data.entries.filter((e:any)=>e.item==='sweater').map((e:any)=>e.pet).sort(),cats);assert.deepEqual(data.entries.filter((e:any)=>e.item==='hoodie').map((e:any)=>e.pet).sort(),dogs);
const hash=(bytes:Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync('../art/art-manifest.json','utf8'));
const dotEntries=cats.map(pet=>APPROVED_FRONT_CLOTHES[`${pet}:dots`]);
assert.equal(new Set(dotEntries.map(e=>e.url)).size,cats.length,'친구마다 다른 착용 그림');
for(const [i,e] of dotEntries.entries()){
 const path=e.url.replace(/^\.\//,''),bytes=fs.readFileSync('../'+path),short=path.match(/\.([0-9a-f]{8})\.webp$/)?.[1];
 assert.ok(path.startsWith(`art/pets/${cats[i]}.paint-wear-clothes-dots-front.`));
 assert.equal(hash(bytes).slice(0,8),short);assert.ok(bytes.length<=400000);
 assert.equal(manifest.files.filter((f:any)=>f.u===path&&f.b===bytes.length).length,1);
 assert.ok(e.x>=0&&e.y>=0&&e.width>0&&e.height>0&&e.x+e.width<=640&&e.y+e.height<=640);
 assert.ok(hasFrontWear(cats[i],'clothes','dots'));
}
assert.ok(!hasFrontWear('corgi','clothes','dots'));
const stripeDogs=['maltese','poodle','shiba','schnauzer'];
const stripeEntries=stripeDogs.map(pet=>APPROVED_FRONT_CLOTHES[`${pet}:stripe`]);
assert.equal(new Set(stripeEntries.map(e=>e.url)).size,stripeDogs.length,'강아지마다 다른 줄무늬 티 그림');
for(const [i,e] of stripeEntries.entries()){
 const path=e.url.replace(/^\.\//,''),bytes=fs.readFileSync('../'+path),short=path.match(/\.([0-9a-f]{8})\.webp$/)?.[1];
 assert.ok(path.startsWith(`art/pets/${stripeDogs[i]}.paint-wear-clothes-stripe-front.`));
 assert.equal(hash(bytes).slice(0,8),short);assert.ok(bytes.length<=400000);
 assert.equal(manifest.files.filter((f:any)=>f.u===path&&f.b===bytes.length).length,1);
 assert.ok(e.x>=0&&e.y>=0&&e.width>0&&e.height>0&&e.x+e.width<=640&&e.y+e.height<=640);
 assert.ok(hasFrontWear(stripeDogs[i],'clothes','stripe'));
}
assert.equal(APPROVED_FRONT_CLOTHES['corgi:stripe'],undefined,'기존 식빵이 그림 유지');
// 각 승인 착용 그림이 정확한 친구·품목 파일과 크기·해시로 등록되었는지 검사한다.
for(const [key,e] of Object.entries(APPROVED_FRONT_CLOTHES)){
 const [pet,item,...extra]=key.split(':');assert.equal(extra.length,0);assert.ok(pet&&item);
 const path=e.url.replace(/^\.\//,''),bytes=fs.readFileSync('../'+path),short=path.match(/\.([0-9a-f]{8})\.webp$/)?.[1];
 assert.ok(path.startsWith(`art/pets/${pet}.paint-wear-clothes-${item}-front.`));
 assert.equal(hash(bytes).slice(0,8),short);assert.ok(bytes.length<=400000);
 assert.equal(manifest.files.filter((f:any)=>f.u===path&&f.b===bytes.length).length,1);
 assert.ok(e.x>=0&&e.y>=0&&e.width>0&&e.height>0&&e.x+e.width<=640&&e.y+e.height<=640);
 assert.ok(!e.shared,'검수한 착용 그림은 공유 부품이 아니다');assert.ok(hasFrontWear(pet,'clothes',item));
}
// 목걸이도 친구별 승인 그림만 정면 좌표 그대로 사용한다.
for(const [key,e] of Object.entries(APPROVED_FRONT_NECK)){
 const [pet,item,...extra]=key.split(':');assert.equal(extra.length,0);assert.ok(pet&&item);
 const path=e.url.replace(/^\.\//,''),bytes=fs.readFileSync('../'+path),short=path.match(/\.([0-9a-f]{8})\.webp$/)?.[1];
 assert.ok(path.startsWith(`art/pets/${pet}.paint-wear-neck-${item}-front.`));
 assert.equal(hash(bytes).slice(0,8),short);assert.ok(bytes.length<=400000);
 assert.equal(manifest.files.filter((f:any)=>f.u===path&&f.b===bytes.length).length,1);
 assert.ok(e.x>=0&&e.y>=0&&e.width>0&&e.height>0&&e.x+e.width<=640&&e.y+e.height<=640);
 assert.ok(hasApprovedFrontWear(pet,'neck',item));assert.ok(hasFrontWear(pet,'neck',item));
}
assert.ok(!hasApprovedFrontWear('corgi','neck','medal'),'미승인 친구는 기존 표시를 유지한다');
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
 const dots=await prepareFrontWear('koshort','clothes','dots');assert.ok(dots?.deform);assert.equal(frontWearCloth('koshort','dots')?.layer.url,dots.url);
 assert.deepEqual(frontWearReady('koshort',{clothes:'dots'}),[]);
 frontWearLoaded('koshort','clothes','dots',dots.url);assert.deepEqual(frontWearReady('koshort',{clothes:'dots'}),['clothes']);
 assert.deepEqual(frontWearReady('koshort',{}),[],'옷을 벗으면 착용 층 표시 해제');
 const stripe=await prepareFrontWear('maltese','clothes','stripe');assert.ok(stripe?.deform);
 assert.deepEqual(frontWearReady('maltese',{clothes:'stripe'}),[]);
 frontWearLoaded('maltese','clothes','stripe',stripe.url);
 assert.deepEqual(frontWearReady('maltese',{clothes:'stripe'}),['clothes']);
 assert.deepEqual(frontWearReady('maltese',{}),[],'줄무늬 티를 벗으면 착용 층 표시 해제');
 const police=await prepareFrontWear('maltese','clothes','police');assert.ok(police?.deform);
 assert.equal(police.url,APPROVED_FRONT_CLOTHES['maltese:police'].url);
 assert.deepEqual(frontWearReady('maltese',{clothes:'police'}),[]);
 frontWearLoaded('maltese','clothes','police',police.url);
 assert.deepEqual(frontWearReady('maltese',{clothes:'police'}),['clothes']);
 assert.deepEqual(frontWearReady('maltese',{}),[],'경찰 조끼를 벗으면 착용 층 표시 해제');
 const hoodie=await prepareFrontWear('maltese','clothes','hoodie');assert.ok(hoodie?.deform);
 assert.equal(hoodie.url,APPROVED_FRONT_CLOTHES['maltese:hoodie'].url,'승인한 개별 후드티가 우선');
 const medal=await prepareFrontWear('maltese','neck','medal');assert.ok(medal&&!medal.deform);
 assert.equal(medal.url,APPROVED_FRONT_NECK['maltese:medal'].url);
 assert.deepEqual(frontWearReady('maltese',{neck:'medal'}),[],'새 목걸이 수신 전 기존 표시 유지');
 frontWearLoaded('maltese','neck','medal',medal.url);
 assert.deepEqual(frontWearReady('maltese',{neck:'medal'}),['neck']);
 assert.deepEqual(frontWearReady('maltese',{}),[],'목걸이를 벗으면 착용 층 해제');
 assert.equal(await prepareFrontWear('corgi','neck','medal'),null,'미승인 메달은 대체하지 않음');
 fail=true;assert.equal(await prepareFrontWear('russian','clothes','sweater'),null);assert.equal(frontWearCloth('russian','sweater'),null);assert.deepEqual(frontWearReady('russian',{clothes:'sweater'}),[]);
 fail=false;const retry=await prepareFrontWear('russian','clothes','sweater');assert.ok(retry?.deform);assert.ok(frontWearCloth('russian','sweater'));
 fail=true;assert.equal(await prepareFrontWear('corgi','clothes','hoodie'),null);assert.equal(frontWearCloth('corgi','hoodie'),null);assert.deepEqual(frontWearReady('corgi',{clothes:'hoodie'}),[],'공유 부품 수신 실패 때 기존 옷 유지');
 assert.equal(await prepareFrontWear('corgi','clothes','hoodie'),null);assert.deepEqual(frontWearReady('corgi',{clothes:'hoodie'}),[]);
}finally{if(previous===undefined)delete globalImages.Image;else globalImages.Image=previous;}
console.log('B 스웨터5·공유 후드티5×성장3: 실제3부품 공유·해시·상한·기존 착용·수신 실패/재시도·착탈 전환 통과');
