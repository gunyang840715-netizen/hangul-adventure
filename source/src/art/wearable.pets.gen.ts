// 개별 검수한 다른 친구의 실제 착용 부품. 기재하지 않은 아이템/자세에는 적용하지 않는다.
import type {WornAtlas}from './wearable.gen';
export interface WornPetAtlas extends WornAtlas{width?:number;frameAssets?:Record<string,{art:string;rect:number[]}>}
export const WORN_PETS:Record<string,Record<string,WornPetAtlas>>={
 koshort:{clothes:{key:'dots',art:'pet.koshort.paint-wear-clothes-dots',width:300,frames:{'front/0':[0,0,300,214,170,381]},frameAssets:{
  'idle/0':{art:'pet.koshort.paint-wear-clothes-dots-idle',rect:[2,2,260,182,48,89]},
  'idle/1':{art:'pet.koshort.paint-wear-clothes-dots-idle',rect:[266,2,258,183,49,89]},
  'idle/2':{art:'pet.koshort.paint-wear-clothes-dots-idle',rect:[528,2,260,183,49,88]},
  'idle/3':{art:'pet.koshort.paint-wear-clothes-dots-idle',rect:[792,2,260,184,50,87]},
 }}},
};
