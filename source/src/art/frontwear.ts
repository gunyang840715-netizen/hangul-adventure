// 실제 착용 원화의 부품을 친구별 신체에 합성한다. 정면 표시를 쓰는 모든 화면에서 공유한다.
import {FRONT_SCARF,FRONT_SCARVES,type FrontScarfGeometry} from './frontscarves.gen';
import {artSrc} from './artmap';
import {FRONT_CLOTHES,type SharedClothing} from './frontclothes.gen';
import {FRONT_PETS,FRONT_PARTS,type FrontPoint,type FrontPetGeometry,type FrontWearPart} from './frontwear.gen';
import {APPROVED_FRONT_CLOTHES} from './frontwear-approved';
export interface FrontWearLayer {url:string;x:number;y:number;width:number;height:number;deform?:boolean}
interface Cached {promise:Promise<FrontWearLayer|null>;layer?:FrontWearLayer;image?:HTMLImageElement;ready:boolean}
const PX=160,PY=320,W=960,H=980,cache=new Map<string,Cached>(),images=new Map<string,Promise<HTMLImageElement>>();
const id=(pet:string,slot:string,item:string)=>`${pet}:${slot}:${item}`;
function image(url:string){let promise=images.get(url);if(!promise){promise=new Promise<HTMLImageElement>((resolve,reject)=>{const im=new Image();im.decoding='async';im.onload=()=>resolve(im);im.onerror=()=>reject(Error('착용 원화 수신 실패'));im.src=url;});images.set(url,promise);if(images.size>32)images.delete(images.keys().next().value!);promise.catch(()=>images.delete(url));}return promise;}
const surface=()=>{const cv=document.createElement('canvas');cv.width=W;cv.height=H;return cv;};
/** 세 원화 부품을 모든 친구가 공유한다. 친구별로 저장하는 것은 위치·가림 좌표뿐이다. */
async function sharedClothing(pet:string,shape:SharedClothing):Promise<{image:HTMLImageElement;layer:FrontWearLayer}>{
 const baseURL=artSrc(`pet.${pet}.paint-front`);if(!baseURL)throw Error('정면 원화 누락');
 const [base,...sources]=await Promise.all([image(baseURL),...shape.parts.map(p=>image(p.url))]);
 const canvas=()=>{const cv=document.createElement('canvas');cv.width=cv.height=640;return cv;};
 const cv=canvas(),c=cv.getContext('2d')!;
 const transform=(m:number[],u:number,v:number):[number,number]=>[m[0]*u+m[2]*v+m[4],m[1]*u+m[3]*v+m[5]];
 for(const name of ['body','left','right','collar']){
  const index=shape.parts.findIndex(p=>p.name===(name==='left'||name==='right'?'sleeve':name));if(index<0)throw Error('공용 옷 부품 누락');
  const part=shape.parts[index],source=sources[index],[rx,ry]=part.rect,[sw,sh]=part.sourceSize;
  const m=name==='left'?shape.arms[0]:name==='right'?shape.arms[1]:shape.body;
  if(name!=='body'){
   c.save();c.transform(...m as [number,number,number,number,number,number]);
   if(name==='right'){c.translate(1,0);c.scale(-1,1);}
   c.drawImage(source,rx/sw,ry/sh,source.width/sw,source.height/sh);c.restore();continue;
  }
  const [nx,ny]=shape.grid,center=shape.body[0]*.5+shape.body[4];
  const point=(u:number,v:number)=>{const p=transform(m,u,v),t=Math.min(1,Math.max(0,(v-.32)/.66))*(1-shape.bodyBottomScale);p[0]=center+(p[0]-center)*(1-t);return p;};
  const triangle=(uv:number[][])=>{
   const src=uv.map(([u,v])=>[u*sw-rx,v*sh-ry]),dst=uv.map(([u,v])=>point(u,v));
   if(Math.max(...src.map(p=>p[0]))<0||Math.min(...src.map(p=>p[0]))>source.width||Math.max(...src.map(p=>p[1]))<0||Math.min(...src.map(p=>p[1]))>source.height)return;
   const [s0,s1,s2]=src,[d0,d1,d2]=dst,sx1=s1[0]-s0[0],sy1=s1[1]-s0[1],sx2=s2[0]-s0[0],sy2=s2[1]-s0[1],det=sx1*sy2-sx2*sy1;
   const dx1=d1[0]-d0[0],dy1=d1[1]-d0[1],dx2=d2[0]-d0[0],dy2=d2[1]-d0[1],a=(dx1*sy2-dx2*sy1)/det,b=(dy1*sy2-dy2*sy1)/det,cc=(dx2*sx1-dx1*sx2)/det,d=(dy2*sx1-dy1*sx2)/det;
   c.save();c.beginPath();dst.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();c.setTransform(a,b,cc,d,d0[0]-a*s0[0]-cc*s0[1],d0[1]-b*s0[0]-d*s0[1]);c.drawImage(source,0,0);c.restore();
  };
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const u=x/nx,v=y/ny,uu=(x+1)/nx,vv=(y+1)/ny;triangle([[u,v],[uu,v],[u,vv]]);triangle([[uu,v],[uu,vv],[u,vv]]);}
 }
 const mask=canvas(),mc=mask.getContext('2d')!,path=(points:number[][])=>{mc.beginPath();points.forEach(([x,y],i)=>i?mc.lineTo(x,y):mc.moveTo(x,y));mc.closePath();};
 path(shape.bodyClip);mc.fill();mc.globalCompositeOperation='source-in';mc.drawImage(base,0,0,640,640);c.globalCompositeOperation='destination-in';c.drawImage(mask,0,0);
 mc.globalCompositeOperation='source-over';mc.clearRect(0,0,640,640);path(shape.head);mc.fill();
 for(const [left,bottom,width] of shape.feet){mc.beginPath();mc.ellipse(Math.round(left+width/2),Math.round(bottom-width*.29),Math.round(width*.48),Math.round(width*.28),0,0,Math.PI*2);mc.fill();}
 mc.globalCompositeOperation='source-in';mc.drawImage(base,0,0,640,640);c.globalCompositeOperation='destination-out';c.drawImage(mask,0,0);
 const url=cv.toDataURL('image/png'),rendered=await image(url);cv.width=cv.height=mask.width=mask.height=0;
 return{image:rendered,layer:{url,x:0,y:0,width:640,height:640,deform:true}};
}
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
const clothingFor=(pet:string,item:string)=>APPROVED_FRONT_CLOTHES[`${pet}:${item}`]??FRONT_CLOTHES[`${pet}:${item}`];
export function hasFrontWear(pet:string,slot:string,item?:string){if(slot==='clothes')return !!item&&!!clothingFor(pet,item);if(slot==='neck')return item==='scarf'&&!!FRONT_SCARVES[pet];const geometry=FRONT_PETS[pet],part=item&&FRONT_PARTS[`${slot}:${item}`];return !!geometry&&!!part&&slot==='shoes'&&(part.species==='both'||part.species===geometry.species);}
export function prepareFrontWear(pet:string,slot:string,item?:string):Promise<FrontWearLayer|null>{
 if(!item||!hasFrontWear(pet,slot,item))return Promise.resolve(null);
 const key=id(pet,slot,item),old=cache.get(key);if(old)return old.promise;
 const entry:Cached={ready:false,promise:Promise.resolve(null)};cache.set(key,entry);
 const clothing=slot==='clothes'&&clothingFor(pet,item);
 if(clothing){entry.promise=(clothing.shared?sharedClothing(pet,clothing.shared):image(clothing.url).then(source=>({image:source,layer:{...clothing,deform:true}}))).then(result=>{entry.image=result.image;return entry.layer=result.layer;}).catch(()=>{cache.delete(key);return null;});return entry.promise;}
 const part=slot==='neck'?FRONT_SCARF:FRONT_PARTS[`${slot}:${item}`],geometry=FRONT_PETS[pet],baseURL=artSrc(`pet.${pet}.paint-front`);
 if(!baseURL){cache.delete(key);return Promise.resolve(null);}
 entry.promise=Promise.all([image(baseURL),image(part.url)]).then(([base,source])=>{const canvas=slot==='neck'?scarfLayer(base,source,FRONT_SCARVES[pet]):shoeLayer(base,source,part,geometry),layer=crop(canvas);entry.layer=layer;return layer;}).catch(()=>{cache.delete(key);return null;});return entry.promise;
}
/** B 옷은 원화와 동일한 성장/부위 가중치로 그린다. 같은 성체 레이어를 세 성장에 공유. */
export function frontWearCloth(pet:string,item?:string){const entry=item&&cache.get(id(pet,'clothes',item));return entry&&entry.image&&entry.layer?.deform?{image:entry.image,layer:entry.layer}:null;}
/** SVG 이미지 해독까지 끝난 부품만 기존 표시와 교체한다. */
export function frontWearLoaded(pet:string,slot:string,item:string,url:string){const value=cache.get(id(pet,slot,item));if(value?.layer?.url===url)value.ready=true;}
export function frontWearReady(pet:string,wear:Partial<Record<string,string|undefined>>){return Object.entries(wear).filter(([slot,item])=>item&&cache.get(id(pet,slot,item))?.ready).map(([slot])=>slot);}
