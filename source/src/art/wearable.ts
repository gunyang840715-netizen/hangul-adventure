// 미리 맞춘 착용 표면: 기기에서 격자 합성을 반복하지 않고 필요한 그림만 받는다.
import {WORN} from './wearable.gen';
import type {Mat} from './petanim';
export type SelectedWear=Partial<Record<string,string|undefined>>;
export function inverse(m:Mat):Mat{
 const d=m[0]*m[3]-m[1]*m[2];
 return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];
}
const slots=['clothes','shoes','neck','hat','glasses'] as const;
export function wornKeys(id:string,wear:SelectedWear):string[]{
 if(id!=='corgi')return [];
 return slots.filter(s=>wear[s]===WORN[s].key).map(s=>WORN[s].art);
}
/** 미검수 조합/자세에는 기존 표시를 유지한다. 아이템 선택이나 저장값을 바꾸지 않는다. */
export function wornReady(id:string,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined):boolean{
 if(id!=='corgi')return false;
 const selected=slots.filter(s=>wear[s]);
 return selected.length>0&&selected.every(s=>wear[s]===WORN[s].key&&!!WORN[s].frames[`${pose}/${frame}`]&&!!image(WORN[s].art));
}
export function drawWorn(c:CanvasRenderingContext2D,pose:string,frame:number,wear:SelectedWear,image:(key:string)=>CanvasImageSource|undefined,head?:Mat){
 for(const slot of slots){
  if(!wear[slot])continue;
  const entry=WORN[slot],im=image(entry.art),rect=entry.frames[`${pose}/${frame}`];if(!im||!rect)continue;
  const [x,y,w,h,dx,dy]=rect;
  c.save();try{if(head&&(slot==='hat'||slot==='glasses'))c.transform(...head);c.drawImage(im,x,y,w,h,dx,dy,w,h);}finally{c.restore();}
 }
}
