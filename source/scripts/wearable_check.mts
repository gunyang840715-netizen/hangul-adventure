import assert from 'node:assert/strict';
import {wornKeys,wornReady,wornSelection,drawWorn}from '../src/art/wearable';
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
assert.deepEqual(wornSelection('corgi','run',0,wear,image),{});
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
