import assert from 'node:assert/strict';
import {wornKeys,wornReady,wornSelection,drawWorn,wornEntry}from '../src/art/wearable';
import {WORN}from '../src/art/wearable.gen';
const wear={clothes:'stripe',hat:'straw',glasses:'round',neck:'scarf',shoes:'sneaker'},slots=Object.keys(wear);
const image=()=>({}as CanvasImageSource);
assert.equal(wornKeys('maltese',wear).length,0);
assert.equal(wornKeys('corgi',wear).length,5);
assert.equal(wornReady('corgi','front',0,{},image),false);
assert.equal(wornReady('maltese','front',0,wear,image),false);
assert.equal(wornReady('corgi','run',0,wear,image),false);
assert.equal(wornReady('corgi','front',0,{...wear,hat:'unknown'},image),false);
assert.equal(wornReady('corgi','front',0,wear,()=>undefined),false);
assert.deepEqual(wornSelection('maltese','front',0,wear,image),{});
assert.deepEqual(wornSelection('corgi','run',0,wear,image),{hat:'straw',glasses:'round'});
assert.deepEqual(wornSelection('corgi','front',0,{...wear,hat:'crown'},image),{clothes:'stripe',shoes:'sneaker',neck:'scarf',glasses:'round'});
assert.deepEqual(wornSelection('corgi','front',0,wear,k=>k===WORN.hat.art?undefined:image()),{clothes:'stripe',shoes:'sneaker',neck:'scarf',glasses:'round'});
const frames=Object.keys(WORN.clothes.frames);assert.equal(frames.length,25);
let checks=0;
for(const key of frames){
 const[pose,frame]=key.split('/');
 for(let mask=1;mask<32;mask++){
  const selected=Object.fromEntries(slots.filter((_,i)=>mask&(1<<i)).map(s=>[s,wear[s as keyof typeof wear]]));
  assert.equal(wornReady('corgi',pose,+frame,selected,image),true);
  let depth=0,draws=0,transforms=0;
  const ctx={save(){depth++;},restore(){depth--;},transform(){transforms++;},drawImage(...args:unknown[]){draws++;assert.equal(args.length,9);assert.ok((args.slice(1)as number[]).every(Number.isFinite));}}as unknown as CanvasRenderingContext2D;
  drawWorn(ctx,pose,+frame,selected,image,[1,0,0,1,0,0]);
  assert.equal(depth,0);assert.equal(draws,Object.keys(selected).length);assert.equal(transforms,Number(!!selected.hat)+Number(!!selected.glasses));checks++;
 }
}
console.log('착용 렌더러:',checks,'조합·자세, 미검수·로딩 실패 시 기존 표시·문맥 복원 통과');
let mixed=0;
for(const key of frames){const[pose,fi]=key.split('/');for(let mask=0;mask<32;mask++){
 const combination=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?wear[s as keyof typeof wear]:'unadapted']));
 const selected=wornSelection('corgi',pose,+fi,combination,image);
 assert.equal(Object.keys(selected).length,slots.filter((_,i)=>mask&(1<<i)).length);
 let draws=0;const ctx={save(){},restore(){},drawImage(){draws++;}}as unknown as CanvasRenderingContext2D;
 drawWorn(ctx,pose,+fi,combination,image);assert.equal(draws,Object.keys(selected).length);mixed++;
}}
console.log('혼합 착용:',mixed,'조합·자세에서 미지원 아이템 대체 방지·검수 부품 유지 통과');
// 같은 슬롯의 기존 목도리와 새 나비넥타이가 서로 대체되거나 함께 그려지면 안 된다.
const bowtie=wornEntry('corgi','neck','bowtie')!;
assert.ok(bowtie);assert.notEqual(bowtie.art,WORN.neck.art);
assert.equal(wornEntry('maltese','neck','bowtie'),undefined);
assert.equal(wornEntry('corgi','hat','bowtie'),undefined);
assert.deepEqual(wornKeys('corgi',{neck:'bowtie'}),[bowtie.art]);
assert.deepEqual(wornKeys('corgi',{neck:'scarf'}),[WORN.neck.art]);
assert.deepEqual(wornSelection('corgi','front',0,{...wear,neck:'bowtie'},k=>k===bowtie.art?undefined:image()),{clothes:'stripe',shoes:'sneaker',hat:'straw',glasses:'round'});
assert.deepEqual(wornSelection('corgi','front',0,{neck:'scarf'},k=>k===bowtie.art?image():undefined),{});
const images=new Map([...Object.values(WORN),bowtie].map(a=>[a.art,{art:a.art}as unknown as CanvasImageSource]));
let variants=0;
for(const key of frames){
 const[pose,fi]=key.split('/');assert.ok(bowtie.frames[key]);
 for(let mask=0;mask<32;mask++){
  const selected=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?(s==='neck'?'bowtie':wear[s as keyof typeof wear]):'unadapted']));
  const drawn:CanvasImageSource[]=[];let depth=0;
  const ctx={save(){depth++;},restore(){depth--;},drawImage(im:CanvasImageSource){drawn.push(im);}}as unknown as CanvasRenderingContext2D;
  drawWorn(ctx,pose,+fi,selected,k=>images.get(k));
  assert.equal(depth,0);assert.equal(drawn.length,slots.filter((_,i)=>mask&(1<<i)).length);
  assert.equal(drawn.includes(images.get(bowtie.art)!),selected.neck==='bowtie');assert.equal(drawn.includes(images.get(WORN.neck.art)!),false);variants++;
 }
}
console.log('목 착용 변형:',variants,'혼합·자세에서 정확한 아이템 자산 선택·누락 시 다른 부품 유지 통과');
let moving=0;
for(const pose of ['run','jump'])for(let frame=0;frame<6;frame++)for(let mask=0;mask<8;mask++){
 const choices={hat:'straw',glasses:'round',neck:'bowtie'},parts=Object.keys(choices);
 const selection=Object.fromEntries(parts.filter((_,i)=>mask&(1<<i)).map(s=>[s,choices[s as keyof typeof choices]]));
 assert.deepEqual(wornSelection('corgi',pose,frame,selection,k=>images.get(k)),selection);
 let transforms=0,draws=0,depth=0;
 const ctx={save(){depth++;},restore(){depth--;},transform(...m:number[]){assert.ok(m.every(Number.isFinite));assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2])>.01);transforms++;},drawImage(){draws++;}}as unknown as CanvasRenderingContext2D;
 drawWorn(ctx,pose,frame,selection,k=>images.get(k));
 assert.equal(draws,Object.keys(selection).length);assert.equal(transforms,draws);assert.equal(depth,0);moving++;
}
assert.deepEqual(wornSelection('corgi','jump',6,wear,image),{});
assert.deepEqual(wornSelection('corgi','scratch',0,{neck:'bowtie'},image),{});
assert.deepEqual(wornSelection('corgi','jump',0,{...wear,neck:'bowtie'},k=>k===bowtie.art?undefined:image()),{hat:'straw',glasses:'round'});
console.log('달리기·점프:',moving,'착탈 조합에서 기존 이미지 재사용·개별 변환·미검수 부분 표시 유지 통과');
