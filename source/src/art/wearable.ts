// 미리 맞춘 착용 표면: 기기에서 격자 합성을 반복하지 않고 필요한 그림만 받는다.
import {WORN} from './wearable.gen';
import {WORN_EXTRA} from './wearable.extra.gen';
import {WORN_MOTION} from './wearable.motion.gen';
import {WORN_PETS,WORN_PET_VARIANTS,type WornPetAtlas} from './wearable.pets.gen';
import type {Mat} from './petanim';
export type SelectedWear=Partial<Record<string,string|undefined>>;
export function inverse(m:Mat):Mat{
 const d=m[0]*m[3]-m[1]*m[2];
 return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
const slots=['clothes','shoes','neck','hat','glasses'] as const;
type RuntimeWorn=WornPetAtlas&{transforms?:Record<string,Mat>};
const registered=new Map<string,RuntimeWorn>();
for(const slot of slots)registered.set(`corgi:${slot}:${WORN[slot].key}`,WORN[slot]);
for(const[key,entry]of Object.entries(WORN_EXTRA))registered.set(`corgi:${key}`,entry);
for(const[pet,entries]of Object.entries(WORN_PETS))for(const[slot,entry]of Object.entries(entries))registered.set(`${pet}:${slot}:${entry.key}`,entry);
for(const[pet,entries]of Object.entries(WORN_PET_VARIANTS))for(const[item,entry]of Object.entries(entries))registered.set(`${pet}:${item}`,entry);
for(const key of WORN_MOTION.items){
 const id=`${WORN_MOTION.pet}:${key}`,entry=registered.get(id),reference=entry?.frames[WORN_MOTION.reference];
 if(!entry||!reference)continue;
 const limits:Partial<Record<string,string[]>>=WORN_MOTION.only;
 const transforms=Object.fromEntries(Object.entries(WORN_MOTION.transforms).filter(([pose])=>!limits[key]||limits[key]!.includes(pose.split('/')[0])).map(([pose,m])=>[pose,m as Mat]));
 registered.set(id,{...entry,frames:{...entry.frames,...Object.fromEntries(Object.keys(transforms).map(p=>[p,reference]))},transforms});
}
/** 같은 슬롯에서도 선택한 아이템과 검수된 원화가 정확히 맞을 때만 연결한다. */
export function wornEntry(id:string,slot:string,item?:string){
 if(!item)return undefined;
 return registered.get(`${id}:${slot}:${item}`);
}
function frameAsset(entry:RuntimeWorn|undefined,key:string){return entry?.frameAssets?.[key]||(entry?.frames[key]?{art:entry.art,rect:entry.frames[key]}:undefined);}
export function wornSelection(id:string,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined):SelectedWear{
 return Object.fromEntries(slots.filter(s=>{const selected=frameAsset(wornEntry(id,s,wear[s]),`${pose}/${frame}`);return !!selected&&!!image(selected.art);}).map(s=>[s,wear[s]]));
}
export function wornKeys(id:string,wear:SelectedWear):string[]{
 return [...new Set(slots.flatMap(s=>{const entry=wornEntry(id,s,wear[s]);return entry?[entry.art,...Object.values(entry.frameAssets||{}).map(f=>f.art)]:[];}))];
}
/** 미검수 조합/자세에는 기존 표시를 유지한다. 아이템 선택이나 저장값을 바꾸지 않는다. */
export function wornReady(id:string,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined):boolean{
 const selected=slots.filter(s=>wear[s]);
 return selected.length>0&&selected.length===Object.keys(wornSelection(id,pose,frame,wear,image)).length;
}
export function drawWorn(c:CanvasRenderingContext2D,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined,head?:Mat,id='corgi'){
 for(const slot of slots){
  const entry=wornEntry(id,slot,wear[slot]);if(!entry)continue;
  const selected=frameAsset(entry,`${pose}/${frame}`);if(!selected)continue;const im=image(selected.art),rect=selected.rect;if(!im)continue;
  const [x,y,w,h,dx,dy]=rect;
  c.save();try{
   if(head&&(slot==='hat'||slot==='glasses'))c.transform(...head);
   // 귀를 긁는 발은 모자 챙/목끈보다 앞에 있다. 원래 발 픽셀을 그대로 남긴다.
   const paw=id===WORN_MOTION.pet?WORN_MOTION.foreground[`${pose}/${frame}` as keyof typeof WORN_MOTION.foreground]:undefined;
   if(paw){c.beginPath();c.rect(-2048,-2048,4096,4096);paw.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();c.clip('evenodd');}
   const placement=entry.transforms?.[`${pose}/${frame}`];if(placement)c.transform(...placement);c.drawImage(im,x,y,w,h,dx,dy,w,h);
  }finally{c.restore();}
 }
}
