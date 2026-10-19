// 친구별 착용 지원표를 검수 데이터에서 재생성한다. 기존 좌표는 데이터에 그대로 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath}from 'node:url';
import assert from 'node:assert/strict';
const here=path.dirname(fileURLToPath(import.meta.url)),target=path.resolve(here,'../src/art/wearable.pets.gen.ts');
const data=JSON.parse(fs.readFileSync(path.join(here,'data/worn-pets.json'),'utf8'));
assert.equal(data.schema,1,'착용 데이터 형식');
const arts=new Set([...fs.readFileSync(path.resolve(here,'../src/art/artmap.ts'),'utf8').matchAll(/"([^"]+)":/g)].map(m=>m[1]));
const name=value=>{assert.match(value,/^[a-z0-9._/-]+$/);return `'${value}'`;};
const rect=r=>{assert.equal(r.length,6);assert(r.every(Number.isFinite));assert(r[0]>=0&&r[1]>=0&&r[2]>0&&r[3]>0);return JSON.stringify(r);};
const art=value=>{assert(arts.has(value),'착용 자산 미등록: '+value);return name(value);};
const matrix=m=>{assert.equal(m.length,6);assert(m.every(Number.isFinite));assert(Math.abs(m[0]*m[3]-m[1]*m[2])>1e-8,'착용 변환 퇴화');return JSON.stringify(m);};
let text="// build_worn_pets.mjs로 자동 생성. 좌표 수정은 scripts/data/worn-pets.json에서 한다.\n"+
 "// 개별 검수한 다른 친구의 실제 착용 부품. 기재하지 않은 아이템/자세에는 적용하지 않는다.\n"+
 "import type {WornAtlas}from './wearable.gen';\n"+
 "import type {Mat}from './petanim';\n"+
 "export interface WornPetAtlas extends WornAtlas{width?:number;frameAssets?:Record<string,{art:string;rect:number[]}>;transforms?:Record<string,Mat>}\n"+
 "export const WORN_PETS:Record<string,Record<string,WornPetAtlas>>={\n";
for(const[pet,slots]of Object.entries(data.pets)){
 name(pet);let first=true;
 for(const[slot,e]of Object.entries(slots)){
  assert(['clothes','hat','glasses','neck','shoes'].includes(slot));name(e.key);
  if(e.width!==undefined)assert(Number.isInteger(e.width)&&e.width>0);
  const frames=Object.entries(e.frames).map(([key,r])=>{assert.match(key,/^[a-z]+\/\d+$/);return `${name(key)}:${rect(r)}`;}).join(',');
  text+=`${first?' '+pet+':{':','}${slot}:{key:${name(e.key)},art:${art(e.art)}${e.width!==undefined?',width:'+e.width:''},frames:{${frames}},frameAssets:{\n`;
  for(const[key,asset]of Object.entries(e.frameAssets||{})){assert.match(key,/^[a-z]+\/\d+$/);assert(!Object.hasOwn(e.frames,key),'자세 중복: '+key);text+=`  ${name(key)}:{art:${art(asset.art)},rect:${rect(asset.rect)}},\n`;}
  text+=' }';
  if(e.transforms){const entries=Object.entries(e.transforms).map(([key,m])=>{assert.match(key,/^[a-z]+\/\d+$/);assert(Object.hasOwn(e.frames,key)||Object.hasOwn(e.frameAssets||{},key),'착용 부품 없는 자세 변환');return `${name(key)}:${matrix(m)}`;});text+=`,transforms:{${entries.join(',')}}`;}
  text+='}';first=false;
 }
 text+='},\n';
}
text+='};\n';
// 기본 슬롯의 검수 범위와 좌표를 덮어쓰지 않고, 같은 슬롯의 다른 품목을 더한다.
const variants=data.variants??[];assert(Array.isArray(variants),'추가 품목 형식');
const extra=new Map(),seen=new Set();
for(const e of variants){
 name(e.pet);assert(Object.hasOwn(data.pets,e.pet),'미등록 친구의 추가 품목');
 assert(['clothes','hat','glasses','neck','shoes'].includes(e.slot),'추가 품목 슬롯');name(e.key);
 const id=`${e.pet}:${e.slot}:${e.key}`;assert(!seen.has(id),'추가 품목 중복');seen.add(id);
 assert(data.pets[e.pet][e.slot]?.key!==e.key,'기본 품목 덮어쓰기 금지');
 if(e.width!==undefined)assert(Number.isInteger(e.width)&&e.width>0);
 assert(e.frames&&typeof e.frames==='object'&&!Array.isArray(e.frames),'추가 품목 자세 형식');
 assert(Object.keys(e.frames).length+Object.keys(e.frameAssets||{}).length>0,'추가 품목 자세 누락');
 const frames=Object.entries(e.frames).map(([key,r])=>{assert.match(key,/^[a-z]+\/\d+$/);return `${name(key)}:${rect(r)}`;}).join(',');
 let entry=`{key:${name(e.key)},art:${art(e.art)}${e.width!==undefined?',width:'+e.width:''},frames:{${frames}},frameAssets:{\n`;
 for(const[key,asset]of Object.entries(e.frameAssets||{})){assert.match(key,/^[a-z]+\/\d+$/);assert(!Object.hasOwn(e.frames,key),'추가 품목 자세 중복: '+key);entry+=`  ${name(key)}:{art:${art(asset.art)},rect:${rect(asset.rect)}},\n`;}
 entry+=' }';
 if(e.transforms){const values=Object.entries(e.transforms).map(([key,m])=>{assert.match(key,/^[a-z]+\/\d+$/);assert(Object.hasOwn(e.frames,key)||Object.hasOwn(e.frameAssets||{},key),'착용 부품 없는 추가 품목 변환');return `${name(key)}:${matrix(m)}`;});entry+=`,transforms:{${values.join(',')}}`;}
 entry+='}';const entries=extra.get(e.pet)||[];entries.push(`  '${e.slot}:${e.key}':${entry},\n`);extra.set(e.pet,entries);
}
text+='\nexport const WORN_PET_VARIANTS:Record<string,Record<string,WornPetAtlas>>={\n';
for(const[pet,entries]of extra)text+=` ${pet}:{\n${entries.join('')} },\n`;
text+='};\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),text,'검수 데이터로 착용 지원표를 다시 생성해야 한다');
else fs.writeFileSync(target,text);
console.log('친구별 착용 지원표 '+(process.argv.includes('--check')?'일치 확인':'생성 완료'));
