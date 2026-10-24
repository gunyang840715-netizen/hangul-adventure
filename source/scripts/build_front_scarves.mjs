// 검수한 정면 목도리 접촉점과 턱털 가림 자료를 생성한다.
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('./data/front-scarves.json',import.meta.url),'utf8'));
const types="// 자동 생성: node scripts/build_front_scarves.mjs\nimport type {FrontPoint,FrontWearPart} from './frontwear.gen';\nexport interface FrontScarfGeometry {width:number;target:FrontPoint;occlusion:FrontPoint[]}\n";
fs.writeFileSync(new URL('../src/art/frontscarves.gen.ts',import.meta.url),types+'export const FRONT_SCARF:FrontWearPart='+JSON.stringify(data.part)+';\nexport const FRONT_SCARVES:Record<string,FrontScarfGeometry>='+JSON.stringify(data.pets)+';\n');
