import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./data/front-clothes.json',import.meta.url),'utf8'));
const registration=Object.fromEntries(data.entries.map(({pet,item,url,x,y,width,height,shared})=>[`${pet}:${item}`,{url,x,y,width,height,...(shared?{shared}:{})}]));
const source='// 자동 생성: scripts/build_front_clothes.mjs; 실제 Dress 친구별 성장3 검수 자료\nexport interface SharedClothing {grid:number[];body:number[];arms:number[][];armBlend?:Record<string,number>;bodyBottomScale:number;parts:{name:string;url:string;rect:number[];sourceSize:number[]}[];bodyClip:number[][];head:number[][];feet:number[][]}\nexport interface FrontClothesPart {url:string;x:number;y:number;width:number;height:number;shared?:SharedClothing}\nexport const FRONT_CLOTHES:Record<string,FrontClothesPart>='+JSON.stringify(registration)+';\n';
const target=new URL('../src/art/frontclothes.gen.ts',import.meta.url);
if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==source)throw Error('B 정면 옷 등록을 다시 생성해야 함');}else fs.writeFileSync(target,source);
