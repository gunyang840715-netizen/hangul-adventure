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
let text="// build_worn_pets.mjs로 자동 생성. 좌표 수정은 scripts/data/worn-pets.json에서 한다.\n"+
 "// 개별 검수한 다른 친구의 실제 착용 부품. 기재하지 않은 아이템/자세에는 적용하지 않는다.\n"+
 "import type {WornAtlas}from './wearable.gen';\n"+
 "export interface WornPetAtlas extends WornAtlas{width?:number;frameAssets?:Record<string,{art:string;rect:number[]}>}\n"+
 "export const WORN_PETS:Record<string,Record<string,WornPetAtlas>>={\n";
for(const[pet,slots]of Object.entries(data.pets)){
 name(pet);let first=true;
 for(const[slot,e]of Object.entries(slots)){
  assert(['clothes','hat','glasses','neck','shoes'].includes(slot));name(e.key);
  if(e.width!==undefined)assert(Number.isInteger(e.width)&&e.width>0);
  const frames=Object.entries(e.frames).map(([key,r])=>{assert.match(key,/^[a-z]+\/\d+$/);return `${name(key)}:${rect(r)}`;}).join(',');
  text+=`${first?' '+pet+':{':','}${slot}:{key:${name(e.key)},art:${art(e.art)}${e.width!==undefined?',width:'+e.width:''},frames:{${frames}},frameAssets:{\n`;
  for(const[key,asset]of Object.entries(e.frameAssets||{})){assert.match(key,/^[a-z]+\/\d+$/);assert(!Object.hasOwn(e.frames,key),'자세 중복: '+key);text+=`  ${name(key)}:{art:${art(asset.art)},rect:${rect(asset.rect)}},\n`;}
  text+=' }}';first=false;
 }
 text+='},\n';
}
text+='};\n';
if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),text,'검수 데이터로 착용 지원표를 다시 생성해야 한다');
else fs.writeFileSync(target,text);
console.log('친구별 착용 지원표 '+(process.argv.includes('--check')?'일치 확인':'생성 완료'));
