import assert from 'node:assert/strict';
import {execFileSync}from 'node:child_process';
execFileSync(process.execPath,['scripts/build_worn_pets.mjs','--check'],{stdio:'inherit'});
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
for(const pose of ['run','jump','scratch'])for(let frame=0;frame<6;frame++)for(let mask=0;mask<8;mask++){
 const choices={hat:'straw',glasses:'round',neck:'bowtie'},parts=Object.keys(choices);
 const selection=Object.fromEntries(parts.filter((_,i)=>mask&(1<<i)).map(s=>[s,choices[s as keyof typeof choices]]));
 assert.deepEqual(wornSelection('corgi',pose,frame,selection,k=>images.get(k)),selection);
 let transforms=0,draws=0,depth=0,clips=0,holes=0;
 const ctx={save(){depth++;},restore(){depth--;},beginPath(){},rect(){},moveTo(){holes++;},lineTo(...xy:number[]){assert.ok(xy.every(Number.isFinite));},closePath(){},clip(rule:string){assert.equal(rule,'evenodd');clips++;},transform(...m:number[]){assert.ok(m.every(Number.isFinite));assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2])>.01);transforms++;},drawImage(){draws++;}}as unknown as CanvasRenderingContext2D;
 drawWorn(ctx,pose,frame,selection,k=>images.get(k));
 assert.equal(draws,Object.keys(selection).length);assert.equal(transforms,draws);assert.equal(clips,pose==='scratch'&&frame>0&&frame<5?draws:0);assert.equal(holes,clips);assert.equal(depth,0);moving++;
}
assert.deepEqual(wornSelection('corgi','jump',6,wear,image),{});
assert.deepEqual(wornSelection('corgi','scratch',6,{neck:'bowtie'},image),{});
assert.deepEqual(wornSelection('corgi','roll',0,{neck:'bowtie'},image),{});
assert.deepEqual(wornSelection('corgi','jump',0,{neck:'scarf'},image),{});
assert.deepEqual(wornSelection('corgi','run',0,{neck:'scarf'},image),{});
for(let frame=0;frame<6;frame++){
 assert.deepEqual(wornSelection('corgi','scratch',frame,{neck:'scarf'},image),{neck:'scarf'});
 assert.deepEqual(wornSelection('corgi','scratch',frame,{neck:'scarf'},()=>undefined),{});
}
assert.deepEqual(wornSelection('corgi','jump',0,{...wear,neck:'bowtie'},k=>k===bowtie.art?undefined:image()),{hat:'straw',glasses:'round'});
console.log('달리기·점프·긁기:',moving,'착탈 조합에서 기존 이미지 재사용·발 가림·개별 변환·미검수 부분 표시 유지 통과');
// 냥이의 땡땡이 정면·걷기8칸과 서기·먹기·잠·앉기 전환 각각 네 칸만 검수했다. 다른 친구나 동작으로 넓혀 선택하면 안 된다.
const cat=wornEntry('koshort','clothes','dots')!;assert.ok(cat);assert.equal(cat.width,300);
assert.deepEqual(wornKeys('koshort',{clothes:'dots',hat:'straw'}),[cat.art,'pet.koshort.paint-wear-clothes-dots-idle','pet.koshort.paint-wear-clothes-dots-eat','pet.koshort.paint-wear-clothes-dots-liesleep','pet.koshort.paint-wear-clothes-dots-walk','pet.koshort.paint-wear-clothes-dots-sitstand']);
assert.deepEqual(wornSelection('koshort','front',0,{clothes:'dots',neck:'scarf'},image),{clothes:'dots'});
assert.deepEqual(wornSelection('koshort','front',0,{clothes:'dots'},()=>undefined),{});
assert.equal(wornReady('koshort','front',0,{clothes:'dots'},image),true);
for(const pet of ['corgi','maltese','russian','siamese'])assert.equal(wornEntry(pet,'clothes','dots'),undefined);
for(const pose of ['run','jump','scratch'])for(let frame=0;frame<8;frame++)assert.deepEqual(wornSelection('koshort',pose,frame,{clothes:'dots'},image),{});
let catDepth=0;const catDrawn:CanvasImageSource[]=[];const catImage={}as CanvasImageSource;
drawWorn({save(){catDepth++;},restore(){catDepth--;},drawImage(im:CanvasImageSource){catDrawn.push(im);}}as unknown as CanvasRenderingContext2D,'front',0,{clothes:'dots'},key=>key===cat.art?catImage:undefined,undefined,'koshort');
assert.equal(catDepth,0);assert.deepEqual(catDrawn,[catImage]);
console.log('냥이 땡땡이 정면: 정확한 친구/아이템/자세·원화 너비·미수신 대체 표시 검사 통과');

const idleArt='pet.koshort.paint-wear-clothes-dots-idle',idleImage={}as CanvasImageSource;
assert.deepEqual(wornSelection('koshort','idle',4,{clothes:'dots'},image),{});
assert.deepEqual(wornSelection('koshort','idle',0,{clothes:'dots'},key=>key===cat.art?catImage:undefined),{});
assert.deepEqual(wornSelection('koshort','front',0,{clothes:'dots'},key=>key===idleArt?idleImage:undefined),{});
for(let frame=0;frame<4;frame++){
 assert.deepEqual(wornSelection('koshort','idle',frame,{clothes:'dots'},key=>key===idleArt?idleImage:undefined),{clothes:'dots'});
 let count=0,depth=0;drawWorn({save(){depth++;},restore(){depth--;},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,idleImage);assert.ok(rect.every(Number.isFinite));count++;}}as unknown as CanvasRenderingContext2D,'idle',frame,{clothes:'dots'},key=>key===idleArt?idleImage:undefined,undefined,'koshort');assert.equal(count,1);assert.equal(depth,0);
}
console.log('냥이 서기4칸: 정면/동작 자산 분리·해당 자세 파일 미수신 시 기존 표시 유지 통과');

const eatArt='pet.koshort.paint-wear-clothes-dots-eat';
for(let frame=0;frame<4;frame++){assert.deepEqual(wornSelection('koshort','eat',frame,{clothes:'dots'},key=>key===eatArt?image():undefined),{clothes:'dots'});assert.deepEqual(wornSelection('koshort','eat',frame,{clothes:'dots'},key=>key===idleArt?image():undefined),{});}
assert.deepEqual(wornSelection('koshort','eat',4,{clothes:'dots'},image),{});
console.log('냥이 먹기4칸: 정확한 자세별 파일 선택·동작 파일 미수신 대체 표시 통과');

const sleepArt='pet.koshort.paint-wear-clothes-dots-liesleep',sleepImage=image();
for(let frame=0;frame<4;frame++){
 assert.deepEqual(wornSelection('koshort','liesleep',frame,{clothes:'dots'},key=>key===sleepArt?sleepImage:undefined),{clothes:'dots'});
 assert.deepEqual(wornSelection('koshort','liesleep',frame,{clothes:'dots'},key=>key===sleepArt?undefined:image()),{});
 let count=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,sleepImage);assert.ok(rect.every(Number.isFinite));count++;}}as unknown as CanvasRenderingContext2D,'liesleep',frame,{clothes:'dots'},key=>key===sleepArt?sleepImage:undefined,undefined,'koshort');assert.equal(count,1);
}
assert.deepEqual(wornSelection('koshort','liesleep',4,{clothes:'dots'},image),{});
console.log('냥이 잠 전환4칸: 정확한 파일·누락 시 기존 표시·다른 자세로 오선택 방지 통과');

const walkArt='pet.koshort.paint-wear-clothes-dots-walk',walkImage=image();
for(let frame=0;frame<8;frame++){
 assert.deepEqual(wornSelection('koshort','walk',frame,{clothes:'dots'},key=>key===walkArt?walkImage:undefined),{clothes:'dots'});
 assert.deepEqual(wornSelection('koshort','walk',frame,{clothes:'dots'},key=>key===walkArt?undefined:image()),{});
 let count=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,walkImage);assert.ok(rect.every(Number.isFinite));count++;}}as unknown as CanvasRenderingContext2D,'walk',frame,{clothes:'dots'},key=>key===walkArt?walkImage:undefined,undefined,'koshort');assert.equal(count,1);
}
assert.deepEqual(wornSelection('koshort','walk',8,{clothes:'dots'},image),{});
console.log('냥이 걷기8칸: 두 줄 부품 좌표·개별 파일 선택·미수신 대체 표시 통과');

const sitArt='pet.koshort.paint-wear-clothes-dots-sitstand',sitImage=image();
for(let frame=0;frame<4;frame++){
 assert.deepEqual(wornSelection('koshort','sitstand',frame,{clothes:'dots'},key=>key===sitArt?sitImage:undefined),{clothes:'dots'});
 assert.deepEqual(wornSelection('koshort','sitstand',frame,{clothes:'dots'},key=>key===sitArt?undefined:image()),{});
 let count=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,sitImage);assert.ok(rect.every(Number.isFinite));count++;}}as unknown as CanvasRenderingContext2D,'sitstand',frame,{clothes:'dots'},key=>key===sitArt?sitImage:undefined,undefined,'koshort');assert.equal(count,1);
}
assert.deepEqual(wornSelection('koshort','sitstand',4,{clothes:'dots'},image),{});
console.log('냥이 앉기 전환4칸: 해당 부품 선택·다른 파일 오선택 방지·미수신 기존 표시 통과');

const malteseCap=wornEntry('maltese','hat','cap')!,malteseCapImage=image();assert.ok(malteseCap);assert.equal(malteseCap.width,274);
assert.deepEqual(wornKeys('maltese',{hat:'cap',clothes:'stripe'}),[malteseCap.art,'pet.maltese.paint-wear-hat-cap-idle','pet.maltese.paint-wear-hat-cap-walk']);
assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap',clothes:'stripe'},key=>key===malteseCap.art?malteseCapImage:undefined),{hat:'cap'});
assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap'},()=>undefined),{});
assert.deepEqual(wornSelection('maltese','front',1,{hat:'cap'},image),{});
for(const pet of ['corgi','koshort'])assert.equal(wornEntry(pet,'hat','cap'),undefined);
for(const pose of ['sitstand','eat','liesleep','run','jump','scratch'])for(let frame=0;frame<8;frame++)assert.deepEqual(wornSelection('maltese',pose,frame,{hat:'cap'},image),{});
let capDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseCapImage);assert.deepEqual(r,[0,0,274,207,182,50,274,207]);capDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{hat:'cap'},key=>key===malteseCap.art?malteseCapImage:undefined,undefined,'maltese');assert.equal(capDraws,1);
console.log('뭉치 야구모자 정면: 친구·아이템·자세 범위와 원화 실제 크기·미수신 대체 표시 통과');
const poodleCap=wornEntry('poodle','hat','cap')!;assert.ok(poodleCap);assert.equal(poodleCap.art,malteseCap.art);assert.deepEqual(poodleCap.frames,malteseCap.frames);
assert.deepEqual(wornKeys('poodle',{hat:'cap'}),[malteseCap.art]);assert.deepEqual(wornSelection('poodle','front',0,{hat:'cap'},image),{hat:'cap'});assert.deepEqual(wornSelection('poodle','front',0,{hat:'cap'},()=>undefined),{});
for(const pose of ['walk','idle','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('poodle',pose,0,{hat:'cap'},image),{});
console.log('초코 야구모자 정면: 검수 부품 재사용·정확한 친구/자세/수신 범위 통과');
const malteseIdleArt='pet.maltese.paint-wear-hat-cap-idle',malteseIdleImage=image();
for(let frame=0;frame<4;frame++){
 assert.deepEqual(wornSelection('maltese','idle',frame,{hat:'cap'},key=>key===malteseIdleArt?malteseIdleImage:undefined),{hat:'cap'});
 assert.deepEqual(wornSelection('maltese','idle',frame,{hat:'cap'},key=>key===malteseIdleArt?undefined:image()),{});
 assert.deepEqual(wornSelection('maltese','idle',frame,{hat:'straw'},image),{});
 let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,malteseIdleImage);assert.ok(rect.every(Number.isFinite));assert.ok(rect[5]<0,'머리 위 여백 좌표 유지');draws++;}}as unknown as CanvasRenderingContext2D,'idle',frame,{hat:'cap'},key=>key===malteseIdleArt?malteseIdleImage:undefined,undefined,'maltese');assert.equal(draws,1);
}
assert.deepEqual(wornSelection('maltese','idle',4,{hat:'cap'},image),{});
console.log('뭉치 야구모자 서기4칸: 개별 머리·귀 부품 선택, 수신 실패, 원래 정면과 초코 범위 보존 통과');
const shibaCap=wornEntry('shiba','hat','cap')!;assert.ok(shibaCap);assert.equal(shibaCap.art,poodleCap.art);assert.deepEqual(shibaCap.frames,poodleCap.frames);
assert.deepEqual(wornKeys('shiba',{hat:'cap'}),[shibaCap.art]);assert.deepEqual(wornSelection('shiba','front',0,{hat:'cap'},image),{hat:'cap'});assert.deepEqual(wornSelection('shiba','front',0,{hat:'cap'},()=>undefined),{});
assert.deepEqual(wornSelection('shiba','front',1,{hat:'cap'},image),{});
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('shiba',pose,0,{hat:'cap'},image),{});
console.log('보리 야구모자 정면: 검수 부품 재사용·미수신·다른 자세 오선택 방지 통과');
const schnauzerCap=wornEntry('schnauzer','hat','cap')!,schnauzerCapImage=image();assert.ok(schnauzerCap);assert.equal(schnauzerCap.width,253);
assert.deepEqual(wornKeys('schnauzer',{hat:'cap'}),[schnauzerCap.art]);
assert.deepEqual(wornSelection('schnauzer','front',0,{hat:'cap'},key=>key===schnauzerCap.art?schnauzerCapImage:undefined),{hat:'cap'});
assert.deepEqual(wornSelection('schnauzer','front',0,{hat:'cap'},key=>key===schnauzerCap.art?undefined:image()),{});
assert.deepEqual(wornSelection('schnauzer','front',1,{hat:'cap'},image),{});
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('schnauzer',pose,0,{hat:'cap'},image),{});
let schnauzerDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,schnauzerCapImage);assert.deepEqual(r,[0,0,253,207,182,50,253,207]);schnauzerDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{hat:'cap'},key=>key===schnauzerCap.art?schnauzerCapImage:undefined,undefined,'schnauzer');assert.equal(schnauzerDraws,1);
console.log('콩이 야구모자 정면: 귀 가림 전용 부품·정확한 친구/자세/수신 범위 통과');
for(const[pet,width,height,x,y]of [['russian',247,187,196,40],['siamese',212,151,210,45],['fold',241,165,196,25],['persian',230,197,209,45]]as const){
 const entry=wornEntry(pet,'hat','cap')!,im=image();assert.ok(entry);assert.equal(entry.art,`pet.${pet}.paint-wear-hat-cap`);assert.equal(entry.width,width);
 assert.deepEqual(wornKeys(pet,{hat:'cap',clothes:'dots'}),[entry.art]);
 assert.deepEqual(wornSelection(pet,'front',0,{hat:'cap'},key=>key===entry.art?im:undefined),{hat:'cap'});
 assert.deepEqual(wornSelection(pet,'front',0,{hat:'cap'},key=>key===entry.art?undefined:image()),{});
 assert.deepEqual(wornSelection(pet,'front',1,{hat:'cap'},image),{});
 for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection(pet,pose,0,{hat:'cap'},image),{});
 let draws=0;drawWorn({save(){},restore(){},drawImage(actual:CanvasImageSource,...r:number[]){assert.equal(actual,im);assert.deepEqual(r,[0,0,width,height,x,y,width,height]);draws++;}}as unknown as CanvasRenderingContext2D,'front',0,{hat:'cap'},key=>key===entry.art?im:undefined,undefined,pet);assert.equal(draws,1);
}
console.log('네 고양이 야구모자 정면: 친구별 원화·머리 좌표·미수신·다른 자세 오선택 방지 통과');
const malteseWalkArt='pet.maltese.paint-wear-hat-cap-walk',malteseWalkImage=image();
for(let frame=0;frame<8;frame++){
 assert.deepEqual(wornSelection('maltese','walk',frame,{hat:'cap'},key=>key===malteseWalkArt?malteseWalkImage:undefined),{hat:'cap'});
 assert.deepEqual(wornSelection('maltese','walk',frame,{hat:'cap'},key=>key===malteseWalkArt?undefined:image()),{});
 let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,malteseWalkImage);assert.ok(rect.every(Number.isFinite));assert.ok(rect[5]<0,'머리 위 여백 좌표 유지');draws++;}}as unknown as CanvasRenderingContext2D,'walk',frame,{hat:'cap'},key=>key===malteseWalkArt?malteseWalkImage:undefined,undefined,'maltese');assert.equal(draws,1);
}
assert.deepEqual(wornSelection('maltese','walk',8,{hat:'cap'},image),{});
console.log('뭉치 야구모자 걷기8칸: 개별 부품·원래 정면/서기 보존·파일 미수신 기존 표시 통과');
