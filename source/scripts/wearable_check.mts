import assert from 'node:assert/strict';
import {execFileSync}from 'node:child_process';
execFileSync(process.execPath,['scripts/build_worn_pets.mjs','--check'],{stdio:'inherit'});
import {wornKeys,wornReady,wornSelection,drawWorn,wornEntry}from '../src/art/wearable';
import {WORN}from '../src/art/wearable.gen';
const wear={clothes:'stripe',hat:'straw',glasses:'round',neck:'scarf',shoes:'sneaker'},slots=Object.keys(wear);
const image=()=>({}as CanvasImageSource);
assert.deepEqual(wornKeys('maltese',wear),['pet.maltese.paint-wear-clothes-stripe','pet.maltese.paint-wear-shoes-sneaker','pet.maltese.paint-wear-glasses-round']);
assert.equal(wornKeys('corgi',wear).length,5);
assert.equal(wornReady('corgi','front',0,{},image),false);
assert.equal(wornReady('maltese','front',0,wear,image),false);
assert.equal(wornReady('corgi','run',0,wear,image),false);
assert.equal(wornReady('corgi','front',0,{...wear,hat:'unknown'},image),false);
assert.equal(wornReady('corgi','front',0,wear,()=>undefined),false);
assert.deepEqual(wornSelection('maltese','front',0,wear,image),{clothes:'stripe',shoes:'sneaker',glasses:'round'});
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
assert.equal(wornEntry('russian','neck','bowtie'),undefined);
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
assert.deepEqual(wornKeys('maltese',{hat:'cap',clothes:'stripe'}),['pet.maltese.paint-wear-clothes-stripe',malteseCap.art,'pet.maltese.paint-wear-hat-cap-idle','pet.maltese.paint-wear-hat-cap-walk']);
assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap',clothes:'stripe'},key=>key===malteseCap.art?malteseCapImage:undefined),{hat:'cap'});
assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap'},()=>undefined),{});
assert.deepEqual(wornSelection('maltese','front',1,{hat:'cap'},image),{});
for(const pet of ['corgi','koshort'])assert.equal(wornEntry(pet,'hat','cap'),undefined);
for(const pose of ['sitstand','eat','liesleep','run','jump','scratch'])for(let frame=0;frame<8;frame++)assert.deepEqual(wornSelection('maltese',pose,frame,{hat:'cap'},image),{});
let capDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseCapImage);assert.deepEqual(r,[0,0,274,207,182,50,274,207]);capDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{hat:'cap'},key=>key===malteseCap.art?malteseCapImage:undefined,undefined,'maltese');assert.equal(capDraws,1);
console.log('뭉치 야구모자 정면: 친구·아이템·자세 범위와 원화 실제 크기·미수신 대체 표시 통과');
const poodleCap=wornEntry('poodle','hat','cap')!;assert.ok(poodleCap);assert.equal(poodleCap.art,malteseCap.art);assert.deepEqual(poodleCap.frames,malteseCap.frames);
assert.deepEqual(wornKeys('poodle',{hat:'cap'}),[malteseCap.art,'pet.maltese.paint-wear-hat-cap-walk']);assert.deepEqual(wornSelection('poodle','front',0,{hat:'cap'},image),{hat:'cap'});assert.deepEqual(wornSelection('poodle','front',0,{hat:'cap'},()=>undefined),{});
for(const pose of ['idle','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('poodle',pose,0,{hat:'cap'},image),{});
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
for(let frame=0;frame<8;frame++){
 assert.deepEqual(wornSelection('poodle','walk',frame,{hat:'cap'},key=>key===malteseWalkArt?malteseWalkImage:undefined),{hat:'cap'});
 assert.deepEqual(wornSelection('poodle','walk',frame,{hat:'cap'},key=>key===malteseWalkArt?undefined:image()),{});
 let transforms=0,draws=0;drawWorn({save(){},restore(){},transform(...m:number[]){assert.equal(m.length,6);assert.ok(m.every(Number.isFinite));assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2])>1e-8);transforms++;},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseWalkImage);assert.deepEqual(r,[2,2,154,90,266,-3,154,90]);draws++;}}as unknown as CanvasRenderingContext2D,'walk',frame,{hat:'cap'},key=>key===malteseWalkArt?malteseWalkImage:undefined,undefined,'poodle');assert.equal(transforms,1);assert.equal(draws,1);
}
assert.deepEqual(wornSelection('poodle','walk',8,{hat:'cap'},image),{});
console.log('초코 걷기8칸: 실제 부품 재사용·개별 비퇴화변환·파일 미수신 기존 표시 통과');

const malteseTie=wornEntry('maltese','neck','bowtie')!,malteseTieImage=image();assert.ok(malteseTie);assert.equal(malteseTie.width,163);assert.deepEqual(wornKeys('maltese',{neck:'bowtie'}),[malteseTie.art,'pet.maltese.paint-wear-neck-bowtie-idle','pet.maltese.paint-wear-neck-bowtie-walk']);
for(const pose of ['sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('maltese',pose,0,{neck:'bowtie'},image),{});
assert.deepEqual(wornSelection('maltese','front',1,{neck:'bowtie'},image),{});
let neckMixed=0;for(const pose of ['front','idle','walk'])for(let mask=0;mask<32;mask++){
 const choices={...wear,hat:'cap',neck:'bowtie'},selected=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?choices[s as keyof typeof choices]:undefined]));
 const expected={...(pose==='front'&&selected.clothes?{clothes:'stripe'}:{}),...(pose==='front'&&selected.shoes?{shoes:'sneaker'}:{}),...((pose==='front'||pose==='idle'||pose==='walk')&&selected.neck?{neck:'bowtie'}:{}),...(selected.hat?{hat:'cap'}:{}),...(pose==='front'&&selected.glasses?{glasses:'round'}:{})};assert.deepEqual(wornSelection('maltese',pose,0,selected,image),expected);neckMixed++;
}
assert.equal(neckMixed,96);assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap',neck:'bowtie'},key=>key===malteseTie.art?undefined:image()),{hat:'cap'});assert.deepEqual(wornSelection('maltese','front',0,{hat:'cap',neck:'bowtie'},key=>key===malteseCap.art?undefined:image()),{neck:'bowtie'});
let tieDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseTieImage);assert.deepEqual(r,[0,0,163,100,245,382,163,100]);tieDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{neck:'bowtie'},key=>key===malteseTie.art?malteseTieImage:undefined,undefined,'maltese');assert.equal(tieDraws,1);console.log('뭉치 나비넥타이 정면: 96혼합·모자와 개별 수신·다른 친구/자세 오선택 방지 통과');

const malteseTieIdle='pet.maltese.paint-wear-neck-bowtie-idle',malteseTieIdleImage=image(),malteseTieRects=[[2,2,104,53,222,184],[110,2,104,54,217,182],[218,2,104,53,221,183],[326,2,106,54,219,184]];
for(let frame=0;frame<4;frame++){assert.deepEqual(wornSelection('maltese','idle',frame,{neck:'bowtie'},key=>key===malteseTieIdle?malteseTieIdleImage:undefined),{neck:'bowtie'});assert.deepEqual(wornSelection('maltese','idle',frame,{hat:'cap',neck:'bowtie'},key=>key===malteseTieIdle?undefined:image()),{hat:'cap'});let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,malteseTieIdleImage);const r=malteseTieRects[frame];assert.deepEqual(rect,[...r,r[2],r[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'idle',frame,{neck:'bowtie'},key=>key===malteseTieIdle?malteseTieIdleImage:undefined,undefined,'maltese');assert.equal(draws,1);}
assert.deepEqual(wornSelection('maltese','idle',4,{neck:'bowtie'},image),{});assert.deepEqual(wornSelection('poodle','idle',0,{neck:'bowtie'},image),{});console.log('뭉치 나비넥타이 서기4칸: 앞뒤 목끈·매듭 전용 파일·모자 독립 수신·정면 보존 통과');

const otherDogTies=[{"pet":"poodle","art":"pet.poodle.paint-wear-neck-bowtie","width":165,"rect":[0,0,165,102,239,382]},{"pet":"shiba","art":"pet.shiba.paint-wear-neck-bowtie","width":176,"rect":[0,0,176,106,236,385]},{"pet":"schnauzer","art":"pet.schnauzer.paint-wear-neck-bowtie","width":160,"rect":[0,0,160,100,240,385]}];let dogTieMixed=0;for(const r of otherDogTies){
 const e=wornEntry(r.pet,'neck','bowtie')!;assert.ok(e);assert.equal(e.art,r.art);assert.equal(e.width,r.width);assert.deepEqual(wornKeys(r.pet,{neck:'bowtie'}),[r.art]);const own=image(),capArt=wornEntry(r.pet,'hat','cap')!.art;
 for(let mask=0;mask<32;mask++){const choices={...wear,hat:'cap',neck:'bowtie'},selected=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?choices[s as keyof typeof choices]:undefined]));const expected={...(selected.clothes?{clothes:'stripe'}:{}),...(selected.shoes?{shoes:'sneaker'}:{}),...(selected.neck?{neck:'bowtie'}:{}),...(selected.hat?{hat:'cap'}:{}),...(selected.glasses?{glasses:'round'}:{})};assert.deepEqual(wornSelection(r.pet,'front',0,selected,image),expected);dogTieMixed++;}
 for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection(r.pet,pose,0,{neck:'bowtie'},image),{});assert.deepEqual(wornSelection(r.pet,'front',1,{neck:'bowtie'},image),{});assert.deepEqual(wornSelection(r.pet,'front',0,{hat:'cap',neck:'bowtie'},key=>key===r.art?undefined:image()),{hat:'cap'});assert.deepEqual(wornSelection(r.pet,'front',0,{hat:'cap',neck:'bowtie'},key=>key===capArt?undefined:image()),{neck:'bowtie'});
 let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,own);assert.deepEqual(rect,[...r.rect,r.rect[2],r.rect[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'front',0,{neck:'bowtie'},key=>key===r.art?own:undefined,undefined,r.pet);assert.equal(draws,1);
}assert.equal(dogTieMixed,96);console.log('초코·보리·콩이 나비넥타이 정면: 96혼합·각자 목부품·모자 독립 수신·다른 자세 오선택 방지 통과');

const malteseShoe=wornEntry('maltese','shoes','sneaker')!,malteseShoeImage=image();assert.ok(malteseShoe);assert.equal(malteseShoe.width,317);assert.deepEqual(wornKeys('maltese',{shoes:'sneaker'}),[malteseShoe.art]);
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('maltese',pose,0,{shoes:'sneaker'},image),{});assert.deepEqual(wornSelection('maltese','front',1,{shoes:'sneaker'},image),{});assert.equal(wornEntry('russian','shoes','sneaker'),undefined);
let shoeDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseShoeImage);assert.deepEqual(r,[0,0,317,96,173,528,317,96]);shoeDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{shoes:'sneaker'},key=>key===malteseShoe.art?malteseShoeImage:undefined,undefined,'maltese');assert.equal(shoeDraws,1);
const threeSlots={hat:'cap',neck:'bowtie',shoes:'sneaker'};for(const[missing,art]of [['hat',malteseCap.art],['neck',malteseTie.art],['shoes',malteseShoe.art]])assert.deepEqual(wornSelection('maltese','front',0,threeSlots,key=>key===art?undefined:image()),Object.fromEntries(Object.entries(threeSlots).filter(([slot])=>slot!==missing)));console.log('뭉치 정면 운동화: 네 발 전용 부품·모자/목/신발 독립 수신·다른 자세/친구 오선택 방지 통과');

// 뭉치 금테안경은 두 눈과 귀 가림을 검수한 정면 한 칸만 연결한다.
const malteseGlasses=wornEntry('maltese','glasses','round')!,malteseGlassesImage=image();assert.ok(malteseGlasses);assert.equal(malteseGlasses.width,227);assert.deepEqual(wornKeys('maltese',{glasses:'round'}),[malteseGlasses.art]);
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('maltese',pose,0,{glasses:'round'},image),{});assert.deepEqual(wornSelection('maltese','front',1,{glasses:'round'},image),{});assert.deepEqual(wornSelection('maltese','front',0,{glasses:'sun'},image),{});for(const pet of ['russian','siamese','fold','persian'])assert.equal(wornEntry(pet,'glasses','round'),undefined);
let glassesDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseGlassesImage);assert.deepEqual(r,[0,0,227,96,211,229,227,96]);glassesDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{glasses:'round'},key=>key===malteseGlasses.art?malteseGlassesImage:undefined,undefined,'maltese');assert.equal(glassesDraws,1);
const fourSlots={hat:'cap',neck:'bowtie',shoes:'sneaker',glasses:'round'};for(const[missing,art]of [['hat',malteseCap.art],['neck',malteseTie.art],['shoes',malteseShoe.art],['glasses',malteseGlasses.art]])assert.deepEqual(wornSelection('maltese','front',0,fourSlots,key=>key===art?undefined:image()),Object.fromEntries(Object.entries(fourSlots).filter(([slot])=>slot!==missing)));console.log('뭉치 정면 금테안경: 네 슬롯 독립 수신·미검수 자세/친구/안경 오선택 방지 통과');

// 원래 눈과 귀에 각각 맞춘 금테안경만 친구별로 연결한다.
const otherDogGlasses=[{"pet":"poodle","art":"pet.poodle.paint-wear-glasses-round","width":192,"rect":[0,0,192,69,223,248]},{"pet":"shiba","art":"pet.shiba.paint-wear-glasses-round","width":226,"rect":[0,0,226,96,213,225]},{"pet":"schnauzer","art":"pet.schnauzer.paint-wear-glasses-round","width":236,"rect":[0,0,236,79,203,247]}];let dogGlassesMixed=0;for(const r of otherDogGlasses){
 const e=wornEntry(r.pet,'glasses','round')!;assert.ok(e);assert.equal(e.art,r.art);assert.equal(e.width,r.width);assert.deepEqual(wornKeys(r.pet,{glasses:'round'}),[r.art]);const own=image();
 for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection(r.pet,pose,0,{glasses:'round'},image),{});assert.deepEqual(wornSelection(r.pet,'front',1,{glasses:'round'},image),{});assert.deepEqual(wornSelection(r.pet,'front',0,{glasses:'sun'},image),{});
 for(let mask=0;mask<32;mask++){const choices={...wear,hat:'cap',neck:'bowtie'},selected=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?choices[s as keyof typeof choices]:undefined]));assert.deepEqual(wornSelection(r.pet,'front',0,selected,image),{...(selected.clothes?{clothes:'stripe'}:{}),...(selected.shoes?{shoes:'sneaker'}:{}),...(selected.neck?{neck:'bowtie'}:{}),...(selected.hat?{hat:'cap'}:{}),...(selected.glasses?{glasses:'round'}:{})});dogGlassesMixed++;}
 const three={hat:'cap',neck:'bowtie',glasses:'round'};for(const slot of ['hat','neck','glasses']as const){const missing=wornEntry(r.pet,slot,three[slot])!.art;assert.deepEqual(wornSelection(r.pet,'front',0,three,key=>key===missing?undefined:image()),Object.fromEntries(Object.entries(three).filter(([s])=>s!==slot)));}
 let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,own);assert.deepEqual(rect,[...r.rect,r.rect[2],r.rect[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'front',0,{glasses:'round'},key=>key===r.art?own:undefined,undefined,r.pet);assert.equal(draws,1);
}assert.equal(dogGlassesMixed,96);console.log('초코·보리·콩이 정면 금테안경: 96혼합·각자 눈 부품·세 슬롯 독립 수신·미검수 자세 오선택 방지 통과');

// 걷기 각 칸은 몸 뒤 목끈과 턱털 가림을 따로 구운 전용 부품만 선택한다.
const malteseTieWalk='pet.maltese.paint-wear-neck-bowtie-walk',malteseTieWalkImage=image(),malteseTieWalkRects=[[2,2,87,48,267,179],[93,2,90,54,263,181],[187,2,90,47,269,172],[281,2,89,46,266,164],[374,2,88,48,265,177],[466,2,87,47,268,179],[557,2,89,47,263,179],[650,2,89,46,264,177]];
for(let frame=0;frame<8;frame++){assert.deepEqual(wornSelection('maltese','walk',frame,{hat:'cap',neck:'bowtie'},image),{neck:'bowtie',hat:'cap'});assert.deepEqual(wornSelection('maltese','walk',frame,{hat:'cap',neck:'bowtie'},key=>key===malteseTieWalk?undefined:image()),{hat:'cap'});assert.deepEqual(wornSelection('maltese','walk',frame,{hat:'cap',neck:'bowtie'},key=>key===malteseWalkArt?undefined:image()),{neck:'bowtie'});let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,malteseTieWalkImage);const r=malteseTieWalkRects[frame];assert.deepEqual(rect,[...r,r[2],r[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'walk',frame,{neck:'bowtie'},key=>key===malteseTieWalk?malteseTieWalkImage:undefined,undefined,'maltese');assert.equal(draws,1);}
assert.deepEqual(wornSelection('maltese','walk',8,{neck:'bowtie'},image),{});assert.deepEqual(wornSelection('poodle','walk',0,{neck:'bowtie'},image),{});console.log('뭉치 나비넥타이 걷기8칸: 전용 목끈·매듭 자산·모자 독립 수신·원래 정면/서기 보존 통과');

// 네 각도의 신발 원화를 친구별 네 발에 맞춘 정면 부품만 사용한다.
const otherDogShoes=[{"pet":"poodle","art":"pet.poodle.paint-wear-shoes-sneaker","width":277,"rect":[0,0,277,78,196,547]},{"pet":"shiba","art":"pet.shiba.paint-wear-shoes-sneaker","width":336,"rect":[0,0,336,101,158,524]},{"pet":"schnauzer","art":"pet.schnauzer.paint-wear-shoes-sneaker","width":324,"rect":[0,0,324,96,160,529]}];let dogShoeMixed=0;for(const r of otherDogShoes){
 const e=wornEntry(r.pet,'shoes','sneaker')!;assert.ok(e);assert.equal(e.art,r.art);assert.equal(e.width,r.width);assert.deepEqual(wornKeys(r.pet,{shoes:'sneaker'}),[r.art]);const own=image();
 for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection(r.pet,pose,0,{shoes:'sneaker'},image),{});assert.deepEqual(wornSelection(r.pet,'front',1,{shoes:'sneaker'},image),{});assert.deepEqual(wornSelection(r.pet,'front',0,{shoes:'boots'},image),{});
 for(let mask=0;mask<32;mask++){const choices={...wear,hat:'cap',neck:'bowtie'},selected=Object.fromEntries(slots.map((s,i)=>[s,mask&(1<<i)?choices[s as keyof typeof choices]:undefined]));assert.deepEqual(wornSelection(r.pet,'front',0,selected,image),{...(selected.clothes?{clothes:'stripe'}:{}),...(selected.shoes?{shoes:'sneaker'}:{}),...(selected.neck?{neck:'bowtie'}:{}),...(selected.hat?{hat:'cap'}:{}),...(selected.glasses?{glasses:'round'}:{})});dogShoeMixed++;}
 const four={hat:'cap',neck:'bowtie',glasses:'round',shoes:'sneaker'};for(const slot of ['hat','neck','glasses','shoes']as const){const missing=wornEntry(r.pet,slot,four[slot])!.art;assert.deepEqual(wornSelection(r.pet,'front',0,four,key=>key===missing?undefined:image()),Object.fromEntries(Object.entries(four).filter(([s])=>s!==slot)));}
 let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,own);assert.deepEqual(rect,[...r.rect,r.rect[2],r.rect[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'front',0,{shoes:'sneaker'},key=>key===r.art?own:undefined,undefined,r.pet);assert.equal(draws,1);
}assert.equal(dogShoeMixed,96);console.log('초코·보리·콩이 정면 운동화: 96혼합·네 발 전용 부품·네 슬롯 독립 수신·미검수 자세 오선택 방지 통과');

// 몸판과 좌우 소매를 검수한 뭉치 줄무늬옷은 정면 한 칸만 연결한다.
const malteseShirt=wornEntry('maltese','clothes','stripe')!,malteseShirtImage=image();assert.ok(malteseShirt);assert.equal(malteseShirt.width,202);assert.deepEqual(wornKeys('maltese',{clothes:'stripe'}),[malteseShirt.art]);
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection('maltese',pose,0,{clothes:'stripe'},image),{});assert.deepEqual(wornSelection('maltese','front',1,{clothes:'stripe'},image),{});assert.deepEqual(wornSelection('maltese','front',0,{clothes:'hoodie'},image),{});for(const pet of ['russian','siamese','fold','persian'])assert.equal(wornEntry(pet,'clothes','stripe'),undefined);
const fiveSlots={clothes:'stripe',shoes:'sneaker',neck:'bowtie',hat:'cap',glasses:'round'};for(let mask=0;mask<32;mask++){const selected=Object.fromEntries(Object.entries(fiveSlots).filter((_,i)=>mask&(1<<i)));assert.deepEqual(wornSelection('maltese','front',0,selected,image),selected);}
for(const slot of Object.keys(fiveSlots)as(keyof typeof fiveSlots)[]){const missing=wornEntry('maltese',slot,fiveSlots[slot])!.art;assert.deepEqual(wornSelection('maltese','front',0,fiveSlots,key=>key===missing?undefined:image()),Object.fromEntries(Object.entries(fiveSlots).filter(([s])=>s!==slot)));}
let shirtDraws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...r:number[]){assert.equal(im,malteseShirtImage);assert.deepEqual(r,[0,0,202,100,231,428,202,100]);shirtDraws++;}}as unknown as CanvasRenderingContext2D,'front',0,{clothes:'stripe'},key=>key===malteseShirt.art?malteseShirtImage:undefined,undefined,'maltese');assert.equal(shirtDraws,1);console.log('뭉치 줄무늬옷 정면: 몸판·좌우소매 전용 부품·32혼합·다섯 슬롯 독립 수신·미검수 자세/친구/후드티 대체 표시 통과');

// 각 친구의 몸판·좌우 소매·목털과 앞다리 가림을 검수한 정면 부품만 연결한다.
const otherDogShirts=[{"pet":"poodle","art":"pet.poodle.paint-wear-clothes-stripe","width":186,"rect":[0,0,186,102,233,412]},{"pet":"shiba","art":"pet.shiba.paint-wear-clothes-stripe","width":212,"rect":[0,0,212,102,227,432]},{"pet":"schnauzer","art":"pet.schnauzer.paint-wear-clothes-stripe","width":193,"rect":[0,0,193,101,230,423]}];let dogShirtMixed=0;for(const r of otherDogShirts){const e=wornEntry(r.pet,'clothes','stripe')!;assert.ok(e);assert.equal(e.art,r.art);assert.equal(e.width,r.width);assert.deepEqual(wornKeys(r.pet,{clothes:'stripe'}),[r.art]);const own=image();
for(const pose of ['idle','walk','sitstand','eat','liesleep','run','jump','scratch'])assert.deepEqual(wornSelection(r.pet,pose,0,{clothes:'stripe'},image),{});assert.deepEqual(wornSelection(r.pet,'front',1,{clothes:'stripe'},image),{});assert.deepEqual(wornSelection(r.pet,'front',0,{clothes:'hoodie'},image),{});
const five={clothes:'stripe',shoes:'sneaker',neck:'bowtie',hat:'cap',glasses:'round'};for(let mask=0;mask<32;mask++){const selected=Object.fromEntries(Object.entries(five).filter((_,i)=>mask&(1<<i)));assert.deepEqual(wornSelection(r.pet,'front',0,selected,image),selected);dogShirtMixed++;}for(const slot of Object.keys(five)as(keyof typeof five)[]){const missing=wornEntry(r.pet,slot,five[slot])!.art;assert.deepEqual(wornSelection(r.pet,'front',0,five,key=>key===missing?undefined:image()),Object.fromEntries(Object.entries(five).filter(([s])=>s!==slot)));}
let draws=0;drawWorn({save(){},restore(){},drawImage(im:CanvasImageSource,...rect:number[]){assert.equal(im,own);assert.deepEqual(rect,[...r.rect,r.rect[2],r.rect[3]]);draws++;}}as unknown as CanvasRenderingContext2D,'front',0,{clothes:'stripe'},key=>key===r.art?own:undefined,undefined,r.pet);assert.equal(draws,1);}
assert.equal(dogShirtMixed,96);console.log('초코·보리·콩이 정면 줄무늬옷: 96혼합·각 몸판/소매 전용 부품·다섯 슬롯 독립 수신·미검수 자세/후드티 대체 표시 통과');
