// 미리 맞춘 착용 표면: 기기에서 격자 합성을 반복하지 않고 필요한 그림만 받는다.
import {WORN,type WornAtlas} from './wearable.gen';
import {WORN_EXTRA} from './wearable.extra.gen';
import {WORN_MOTION} from './wearable.motion.gen';
import type {Mat} from './petanim';
export type SelectedWear=Partial<Record<string,string|undefined>>;
export function inverse(m:Mat):Mat{
 const d=m[0]*m[3]-m[1]*m[2];
 return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
const slots=['clothes','shoes','neck','hat','glasses'] as const;
type RuntimeWorn=WornAtlas&{transforms?:Record<string,Mat>};
const registered=new Map<string,RuntimeWorn>();
for(const slot of slots)registered.set(`corgi:${slot}:${WORN[slot].key}`,WORN[slot]);
for(const[key,entry]of Object.entries(WORN_EXTRA))registered.set(`corgi:${key}`,entry);
for(const key of WORN_MOTION.items){
 const id=`${WORN_MOTION.pet}:${key}`,entry=registered.get(id),reference=entry?.frames[WORN_MOTION.reference];
 if(!entry||!reference)continue;
 const transforms=Object.fromEntries(Object.entries(WORN_MOTION.transforms).map(([pose,m])=>[pose,m as Mat]));
 registered.set(id,{...entry,frames:{...entry.frames,...Object.fromEntries(Object.keys(transforms).map(p=>[p,reference]))},transforms});
}
/** 같은 슬롯에서도 선택한 아이템과 검수된 원화가 정확히 맞을 때만 연결한다. */
export function wornEntry(id:string,slot:string,item?:string){
 if(id!=='corgi'||!item)return undefined;
 return registered.get(`${id}:${slot}:${item}`);
}
export function wornSelection(id:string,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined):SelectedWear{
 if(id!=='corgi')return {};
 return Object.fromEntries(slots.filter(s=>{const entry=wornEntry(id,s,wear[s]);return !!entry?.frames[`${pose}/${frame}`]&&!!image(entry.art);}).map(s=>[s,wear[s]]));
}
export function wornKeys(id:string,wear:SelectedWear):string[]{
 if(id!=='corgi')return [];
 return slots.flatMap(s=>{const entry=wornEntry(id,s,wear[s]);return entry?[entry.art]:[];});
}
/** 미검수 조합/자세에는 기존 표시를 유지한다. 아이템 선택이나 저장값을 바꾸지 않는다. */
export function wornReady(id:string,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined):boolean{
 if(id!=='corgi')return false;
 const selected=slots.filter(s=>wear[s]);
 return selected.length>0&&selected.length===Object.keys(wornSelection(id,pose,frame,wear,image)).length;
}
export function drawWorn(c:CanvasRenderingContext2D,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined,head?:Mat){
 for(const slot of slots){
  const entry=wornEntry('corgi',slot,wear[slot]);if(!entry)continue;
  const im=image(entry.art),rect=entry.frames[`${pose}/${frame}`];if(!im||!rect)continue;
  const [x,y,w,h,dx,dy]=rect;
  c.save();try{if(head&&(slot==='hat'||slot==='glasses'))c.transform(...head);const placement=entry.transforms?.[`${pose}/${frame}`];if(placement)c.transform(...placement);c.drawImage(im,x,y,w,h,dx,dy,w,h);}finally{c.restore();}
 }
}
