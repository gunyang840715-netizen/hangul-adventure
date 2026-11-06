// 정면 착용 부품 공통 형식(신발은 10-31 사용자 지시로 꾸미기에서 삭제됨)
export type FrontPoint=[number,number];
export interface FrontWearPart {slot:string;key:string;species:string;url:string;width:number;height:number;rects:number[][]}
