// 개별 검수한 다른 친구의 실제 착용 부품. 기재하지 않은 아이템/자세에는 적용하지 않는다.
import type {WornAtlas}from './wearable.gen';
export const WORN_PETS:Record<string,Record<string,WornAtlas&{width:number}>>={
 koshort:{clothes:{key:'dots',art:'pet.koshort.paint-wear-clothes-dots',width:300,frames:{'front/0':[0,0,300,214,170,381]}}},
};
