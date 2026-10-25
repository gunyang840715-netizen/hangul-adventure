// 실제 착용 원화의 부품을 친구별 신체에 합성한다. 정면 표시를 쓰는 모든 화면에서 공유한다.
import {FRONT_SCARF,FRONT_SCARVES,type FrontScarfGeometry} from './frontscarves.gen';
import {artSrc} from './artmap';
import {FRONT_CLOTHES} from './frontclothes.gen';
import {FRONT_PETS,FRONT_PARTS,type FrontPoint,type FrontPetGeometry,type FrontWearPart} from './frontwear.gen';
export interface FrontWearLayer {url:string;x:number;y:number;width:number;height:number;deform?:boolean}
interface Cached {promise:Promise<FrontWearLayer|null>;layer?:FrontWearLayer;image?:HTMLImageElement;ready:boolean}
const PX=160,PY=320,W=960,H=980,cache=new Map<string,Cached>(),images=new Map<string,Promise<HTMLImageElement>>();
const id=(pet:string,slot:string,item:string)=>`${pet}:${slot}:${item}`;
function image(url:string){let promise=images.get(url);if(!promise){promise=new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(Error('착용 원화 수신 실패'));im.src=url;});images.set(url,promise);if(images.size>32)images.delete(images.keys().next().value!);promise.catch(()=>images.delete(url));}return promise;}
const surface=()=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;return cv;};
function polygon(c:CanvasRenderingContext2D,points:FrontPoint[]){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x+PX,y+PY):c.moveTo(x+PX,y+PY));c.closePath();}
/** 원래 몸의 알파로 뒤쪽 부품을 가린다. 원래 털색을 새 부품에 구워 넣지 않는다. */
function hideBehind(c:CanvasRenderingContext2D,base:HTMLImageElement,polygons:FrontPoint[][]){if(!polygons.length)return;const mask=surface(),m=mask.getContext('2d')!;for(const points of polygons){polygon(m,points);m.fill();}m.globalCompositeOperation='source-in';m.drawImage(base,PX,PY,640,640);const alpha=m.getImageData(0,0,W,H);for(let i=3;i<alpha.data.length;i+=4)if(alpha.data[i]>=250)alpha.data[i]=255;m.putImageData(alpha,0,0);c.save();c.globalCompositeOperation='destination-out';c.drawImage(mask,0,0);c.restore();mask.width=mask.height=0;}
function shoeLayer(base:HTMLImageElement,source:HTMLImageElement,part:FrontWearPart,pet:FrontPetGeometry){
 if(pet.feet.length!==4||part.rects.length!==4)throw Error('정면 신발 네 짝 기준 누락');const cv=surface(),c=cv.getContext('2d')!,piece=surface(),p=piece.getContext('2d')!;
 const draw=(index:number)=>{const[left,bottom,footWidth]=pet.feet[index],[sx,sy,sw,sh]=part.rects[[3,1,1,3][index]],scale=footWidth*1.18/sw,width=sw*scale,height=sh*scale,x=left+(footWidth-width)/2,y=bottom+1-height;p.clearRect(0,0,W,H);p.save(); if(index===0||index===2){p.translate(2*(x+PX)+width,0);p.scale(-1,1);} p.drawImage(source,sx,sy,sw,sh,x+PX,y+PY,width,height);p.restore();
  // 신발의 뒤쪽 입구는 발목 뒤로 보낸다. 앞쪽 끈·리본·발등·밑창은 원화 그대로 남긴다.
  const rim:FrontPoint[]=[[x+width*.20,y],[x+width*.86,y],[x+width*.96,y+height*.14],[x+width*.75,y+height*.23],[x+width*.30,y+height*.22],[x+width*.12,y+height*.14]];
  hideBehind(p,base,[rim]);c.drawImage(piece,0,0);
 };
 draw(0);draw(3);
 // 뒤발 신발은 앞다리/앞발 뒤에, 앞발 신발은 그 앞에 놓는다.
 hideBehind(c,base,pet.feet.slice(1,3).map(([left,bottom,width])=>[[left-width*.1,bottom-width*3.6],[left+width*1.1,bottom-width*3.6],[left+width*1.1,bottom+2],[left-width*.1,bottom+2]]as FrontPoint[]));
 draw(1);draw(2);piece.width=piece.height=0;return cv;
}
function scarfLayer(base:HTMLImageElement,source:HTMLImageElement,geometry:FrontScarfGeometry){const cv=surface(),c=cv.getContext('2d')!,[sx,sy,sw,sh]=FRONT_SCARF.rects[0],scale=geometry.width/sw; c.drawImage(source,PX+geometry.target[0]-(sx+sw*.5)*scale,PY+geometry.target[1]-(sy+sh*.35)*scale,source.width*scale,source.height*scale);hideBehind(c,base,[geometry.occlusion]);return cv;}
function crop(cv:HTMLCanvasElement):FrontWearLayer {const c=cv.getContext('2d')!,pixels=c.getImageData(0,0,W,H).data;let x=W,y=H,right=0,bottom=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){const n=(i-3)/4,xx=n%W,yy=Math.floor(n/W);x=Math.min(x,xx);y=Math.min(y,yy);right=Math.max(right,xx+1);bottom=Math.max(bottom,yy+1);}if(right<=x||bottom<=y)throw Error('착용 부품이 비어 있음');const out=document.createElement('canvas');out.width=right-x;out.height=bottom-y;out.getContext('2d')!.drawImage(cv,x,y,out.width,out.height,0,0,out.width,out.height);const result={url:out.toDataURL('image/webp',.93),x:x-PX,y:y-PY,width:out.width,height:out.height};cv.width=cv.height=out.width=out.height=0;return result;}
export function hasFrontWear(pet:string,slot:string,item?:string){if(slot==='clothes')return !!item&&!!FRONT_CLOTHES[`${pet}:${item}`];if(slot==='neck')return item==='scarf'&&!!FRONT_SCARVES[pet];const geometry=FRONT_PETS[pet],part=item&&FRONT_PARTS[`${slot}:${item}`];return !!geometry&&!!part&&slot==='shoes'&&(part.species==='both'||part.species===geometry.species);}
export function prepareFrontWear(pet:string,slot:string,item?:string):Promise<FrontWearLayer|null>{
 if(!item||!hasFrontWear(pet,slot,item))return Promise.resolve(null);
 const key=id(pet,slot,item),old=cache.get(key);if(old)return old.promise;
 const entry:Cached={ready:false,promise:Promise.resolve(null)};cache.set(key,entry);
 const clothing=slot==='clothes'&&FRONT_CLOTHES[`${pet}:${item}`];
 if(clothing){entry.promise=image(clothing.url).then(source=>{entry.image=source;return entry.layer={...clothing,deform:true};}).catch(()=>{cache.delete(key);return null;});return entry.promise;}
 const part=slot==='neck'?FRONT_SCARF:FRONT_PARTS[`${slot}:${item}`],geometry=FRONT_PETS[pet],baseURL=artSrc(`pet.${pet}.paint-front`);
 if(!baseURL){cache.delete(key);return Promise.resolve(null);}
 entry.promise=Promise.all([image(baseURL),image(part.url)]).then(([base,source])=>{const canvas=slot==='neck'?scarfLayer(base,source,FRONT_SCARVES[pet]):shoeLayer(base,source,part,geometry),layer=crop(canvas);entry.layer=layer;return layer;}).catch(()=>{cache.delete(key);return null;});return entry.promise;
}
/** B 옷은 원화와 동일한 성장/부위 가중치로 그린다. 같은 성체 레이어를 세 성장에 공유. */
export function frontWearCloth(pet:string,item?:string){const entry=item&&cache.get(id(pet,'clothes',item));return entry&&entry.image&&entry.layer?.deform?{image:entry.image,layer:entry.layer}:null;}
/** SVG 이미지 해독까지 끝난 부품만 기존 표시와 교체한다. */
export function frontWearLoaded(pet:string,slot:string,item:string,url:string){const value=cache.get(id(pet,slot,item));if(value?.layer?.url===url)value.ready=true;}
export function frontWearReady(pet:string,wear:Partial<Record<string,string|undefined>>){return Object.entries(wear).filter(([slot,item])=>item&&cache.get(id(pet,slot,item))?.ready).map(([slot])=>slot);}
