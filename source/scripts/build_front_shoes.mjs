// 검수한 네 발 신발 자료로만 공통 정면 등록을 만든다.
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./data/front-shoes.json',import.meta.url),'utf8'));
const types=`// 자동 생성: node scripts/build_front_shoes.mjs\nexport type FrontPoint=[number,number];\nexport interface FrontPetGeometry {species:string;feet:number[][]}\nexport interface FrontWearPart {slot:string;key:string;species:string;url:string;width:number;height:number;rects:number[][]}\n`;
fs.writeFileSync(new URL('../src/art/frontwear.gen.ts',import.meta.url),types+'export const FRONT_PETS:Record<string,FrontPetGeometry>='+JSON.stringify(data.pets)+';\nexport const FRONT_PARTS:Record<string,FrontWearPart>='+JSON.stringify(data.parts)+';\n');
