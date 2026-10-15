// 친구 새 그림(손그림 수채) 그리기 — COLLAB 9·10-A
// · 정면 앉은 그림 한 장을 25x25 격자로 나눠 머리·귀·꼬리 뼈대를 따라 부드럽게 휘게 그린다(WebGL).
//   눈 감기·입 벌리기는 GPT 편집본에서 바뀐 곳만 떼어 낸 덮개를 겹친다.
// · 걷기·달리기·점프·앉기·엎드리기·잠은 손그림 연속 동작(한 줄 그림)을 넘겨 그린다(2D).
// · 친구마다 캔버스 하나. WebGL은 하나만 만들어 돌려 쓰고(기기마다 개수 제한이 있음) 그린 것을 각 캔버스에 복사한다.
// · WebGL이 안 되면 2D로(휘기 없이 통째로), 그림을 못 받으면 Pet.tsx가 예전 그림(사진 머리·SVG)으로 그린다.
// · 연속 동작 중에는 옆모습 꾸미기(모자·안경·목걸이·옷)를 칸마다 머리·몸통 자리에 그린다(art/petside.ts). 옷은 몸 안에만, 머리·귀는 그 위에.
// 그림은 그 친구가 화면에 나올 때 받는다(서비스워커는 설치 때 받지 않음 — 받은 뒤에는 저장해 둠).
import { ART_MAP, artSrc } from './artmap';
import { PAINT_RIG } from './petpaint.gen';
import { PetAnim, type AnimIn, type Pose, type Mat } from './petanim';
import { sideFrame, sideArt, sideRig, placeM, mul, SIDE_SLOTS, type SideFrame, type SideSlot } from './petside';

export type { Act } from './petanim';
type Pt = [number, number];
export interface PaintMotion { n: number; w: number; h: number; ground: number; fps: number; loop: boolean; reach?: number }   // reach: 먹기 — 코끝이 몸 가운데보다 앞에 있는 거리(기준판 px)
export interface PaintRig {
  tex: number; ground: number; sp: number; eyeDist: number; cx: number; top: number;
  eyeL: Pt; eyeR: Pt; mouth: Pt; neck: Pt; earL: Pt; earR: Pt;
  tail: Pt | null; tailMid: Pt | null; tailTip: Pt | null;
  cat: boolean; ears: string;
  grid: number;                                // 격자 한 변의 꼭짓점 수
  w: string;                                   // 꼭짓점마다 머리·왼귀·오른귀·꼬리·꼬리끝 가중치(0~255) — 0이 많아 [0,개수]로 줄여 base64
  items: { head: number[]; hatDy: number; neck: number[]; clothes: number[]; shoes: number[]; toy: number[] };
  motions: Record<string, PaintMotion>;
  eyesBox: number[]; mouthBox?: number[];
}

/** 캔버스가 덮는 곳(기준판 좌표): 정면 그림 640칸 둘레에 좌우 160 · 위 320(점프) · 아래 20 */
export const VIEW = { x: -160, y: -320, w: 960, h: 980 };
const TEX = 640;

export function paintable(id: string) {
  return !!PAINT_RIG[id] && !!ART_MAP[`pet.${id}.paint-front`] && !!ART_MAP[`pet.${id}.paint-eyes`];
}
export function rigOf(id: string): PaintRig | undefined { return PAINT_RIG[id]; }

// ============================================================ 그림 받기
type Load = { img?: HTMLImageElement; state: 'loading' | 'ok' | 'fail'; p: Promise<HTMLImageElement | null> };
const IMGS: Record<string, Load> = {};
function img(key: string): Load {
  let L = IMGS[key];
  if (L) return L;
  const src = artSrc(key);
  const im = new Image();
  im.decoding = 'async';
  L = IMGS[key] = { state: 'loading', p: Promise.resolve(null) };
  L.p = new Promise(res => {
    if (!src) { L.state = 'fail'; res(null); return; }
    im.onload = () => { L.img = im; L.state = 'ok'; res(im); };
    im.onerror = () => { L.state = 'fail'; res(null); };
    im.src = src;
  });
  return L;
}
const BASE = ['front', 'eyes', 'mouth'];
/** 연결 복구 때 실패한 그림만 다시 받기. 정상 그림·진행 중 요청은 재사용한다. */
export function retryPaintImages() {
  for (const key of Object.keys(IMGS)) {
    if (IMGS[key].state !== 'fail' || !ART_MAP[key]) continue;
    delete IMGS[key]; img(key);
  }
}
/** 정면 그림·눈·입 덮개 (모두 받으면 true, 하나라도 실패하면 false) */
export function loadBase(id: string): Promise<boolean> {
  const keys = BASE.filter(k => ART_MAP[`pet.${id}.paint-${k}`]);
  return Promise.all(keys.map(k => img(`pet.${id}.paint-${k}`).p)).then(a => a.every(Boolean));
}
export function baseState(id: string): 'ok' | 'fail' | 'loading' {
  const keys = BASE.filter(k => ART_MAP[`pet.${id}.paint-${k}`]);
  const st = keys.map(k => IMGS[`pet.${id}.paint-${k}`]?.state);
  if (st.some(s => s === 'fail')) return 'fail';
  return st.every(s => s === 'ok') ? 'ok' : 'loading';
}
/** 연속 동작 그림 미리 받기 */
export function loadMotions(id: string) {
  const r = PAINT_RIG[id];
  if (r) for (const k of Object.keys(r.motions)) img(`pet.${id}.paint-${k}`);
}
/** 앱이 켜진 뒤 한가할 때: 고른 친구들의 그림을 받아 둔다(서비스워커가 저장 → 인터넷이 없어도 보임) */
export function prefetchPets(ids: string[]) {
  const run = () => ids.forEach(id => { if (paintable(id)) { loadBase(id); loadMotions(id); } });
  const w = window as any;
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 1500);
}

// ============================================================ WebGL (하나를 같이 씀)
type GL = WebGLRenderingContext;
interface GLPet { tf: WebGLTexture; te: WebGLTexture; tm: WebGLTexture | null; wb: WebGLBuffer; uv: number; N: number }
let gl: GL | null | undefined;            // undefined = 아직 안 만듦, null = 못 씀
let gl2 = false;
let glc: HTMLCanvasElement;
let prog: WebGLProgram;
const MESH: Record<number, { pos: WebGLBuffer; idx: WebGLBuffer; n: number }> = {};
const U: Record<string, WebGLUniformLocation | null> = {};
let A = { pos: 0, w: 0, w2: 0 };
const GLP: Record<string, GLPet | null> = {};

const VS = `
attribute vec2 aPos; attribute vec4 aW; attribute float aW2;
uniform vec3 uB[12]; uniform vec4 uView;
varying vec2 vT;
vec2 tr(int i, vec3 p) { return vec2(dot(uB[i * 2], p), dot(uB[i * 2 + 1], p)); }
void main() {
  vec3 p = vec3(aPos, 1.0);
  float eL = aW.y, eR = aW.z, t2 = aW2;
  float hd = max(aW.x - eL - eR, 0.0), tl = max(aW.w - t2, 0.0), bd = max(1.0 - aW.x - aW.w, 0.0);
  vec2 q = bd * tr(0, p) + hd * tr(1, p) + eL * tr(2, p) + eR * tr(3, p) + tl * tr(4, p) + t2 * tr(5, p);
  q /= max(bd + hd + eL + eR + tl + t2, 0.0001);
  vT = aPos;
  vec2 c = (q - uView.xy) / uView.zw;
  gl_Position = vec4(c.x * 2.0 - 1.0, 1.0 - c.y * 2.0, 0.0, 1.0);
}`;
const FS = `
precision mediump float;
varying vec2 vT;
uniform sampler2D uF, uE, uM;
uniform vec4 uEB, uMB; uniform float uEK, uMK, uDim, uUV;
void main() {
  vec4 c = texture2D(uF, vT * uUV);
  if (uEK > 0.002) {
    vec2 e = (vT - uEB.xy) / uEB.zw;
    if (e.x > 0.0 && e.y > 0.0 && e.x < 1.0 && e.y < 1.0) { vec4 o = texture2D(uE, e) * uEK; c = o + c * (1.0 - o.a); }
  }
  if (uMK > 0.002) {
    vec2 m = (vT - uMB.xy) / uMB.zw;
    if (m.x > 0.0 && m.y > 0.0 && m.x < 1.0 && m.y < 1.0) { vec4 o = texture2D(uM, m) * uMK; c = o + c * (1.0 - o.a); }
  }
  gl_FragColor = vec4(c.rgb * uDim, c.a);
}`;

function getGL(): GL | null {
  if (gl !== undefined) return gl;
  gl = null;
  try {
    glc = document.createElement('canvas');
    glc.width = 256; glc.height = 256;
    const opt = { premultipliedAlpha: true, alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true } as WebGLContextAttributes;
    let g = glc.getContext('webgl2', opt) as GL | null;
    gl2 = !!g;
    if (!g) g = (glc.getContext('webgl', opt) || glc.getContext('experimental-webgl', opt)) as GL | null;
    if (!g) return null;
    const sh = (type: number, src: string) => {
      const s = g!.createShader(type)!; g!.shaderSource(s, src); g!.compileShader(s);
      if (!g!.getShaderParameter(s, g!.COMPILE_STATUS)) throw new Error(g!.getShaderInfoLog(s) || 'shader');
      return s;
    };
    prog = g.createProgram()!;
    g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error('link');
    g.useProgram(prog);
    for (const n of ['uB', 'uView', 'uF', 'uE', 'uM', 'uEB', 'uMB', 'uEK', 'uMK', 'uDim', 'uUV']) U[n] = g.getUniformLocation(prog, n);
    A = { pos: g.getAttribLocation(prog, 'aPos'), w: g.getAttribLocation(prog, 'aW'), w2: g.getAttribLocation(prog, 'aW2') };
    g.uniform1i(U.uF, 0); g.uniform1i(U.uE, 1); g.uniform1i(U.uM, 2);
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
    g.clearColor(0, 0, 0, 0);
    glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); gl = null; });
    gl = g;
  } catch {
    gl = null;
  }
  return gl;
}

/** 격자(한 변 N개 꼭짓점) — 같은 크기면 모든 친구가 같이 씀 */
function mesh(g: GL, N: number) {
  if (MESH[N]) return MESH[N];
  const pos = new Float32Array(N * N * 2), idx: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { pos[(j * N + i) * 2] = i * TEX / (N - 1); pos[(j * N + i) * 2 + 1] = j * TEX / (N - 1); }
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const p = g.createBuffer()!; g.bindBuffer(g.ARRAY_BUFFER, p); g.bufferData(g.ARRAY_BUFFER, pos, g.STATIC_DRAW);
  const ix = g.createBuffer()!; g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, ix); g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), g.STATIC_DRAW);
  return (MESH[N] = { pos: p, idx: ix, n: idx.length });
}
/** 가중치 풀기: [0, 개수]는 0을 개수만큼 */
function unRle(b64: string, len: number) {
  const raw = atob(b64), out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < raw.length && o < len; i++) {
    const v = raw.charCodeAt(i);
    if (v === 0) { o += raw.charCodeAt(++i); } else out[o++] = v;
  }
  return out;
}

function texFrom(g: GL, im: HTMLImageElement | HTMLCanvasElement, mip: boolean) {
  const t = g.createTexture()!;
  g.bindTexture(g.TEXTURE_2D, t);
  g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, im);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  if (mip) { g.generateMipmap(g.TEXTURE_2D); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); }
  else g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
  return t;
}

function glPet(id: string): GLPet | null {
  if (id in GLP) return GLP[id];
  const g = getGL();
  const f = IMGS[`pet.${id}.paint-front`]?.img, e = IMGS[`pet.${id}.paint-eyes`]?.img, m = IMGS[`pet.${id}.paint-mouth`]?.img;
  if (!g || !f || !e) return null;
  try {
    let tf: WebGLTexture, uv = 1 / TEX;
    if (gl2) tf = texFrom(g, f, true);
    else {
      // WebGL1은 2의 거듭제곱 크기에서만 작게 줄인 그림(밉맵)을 만들 수 있어 1024판 왼쪽 위에 놓는다
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      c.getContext('2d')!.drawImage(f, 0, 0, TEX, TEX);
      tf = texFrom(g, c, true); uv = 1 / 1024;
    }
    const te = texFrom(g, e, gl2), tm = m ? texFrom(g, m, gl2) : null;
    const N = PAINT_RIG[id].grid;
    const wv = unRle(PAINT_RIG[id].w, N * N * 5);
    const wb = g.createBuffer()!; g.bindBuffer(g.ARRAY_BUFFER, wb); g.bufferData(g.ARRAY_BUFFER, wv, g.STATIC_DRAW);
    mesh(g, N);
    return (GLP[id] = { tf, te, tm, wb, uv, N });
  } catch {
    return (GLP[id] = null);
  }
}

const UB = new Float32Array(36);
function glDraw(id: string, pose: Pose, w: number, h: number): boolean {
  const g = getGL();
  if (!g || g.isContextLost()) return false;
  const P = glPet(id);
  if (!P) return false;
  const r = PAINT_RIG[id];
  if (glc.width < w || glc.height < h) { glc.width = Math.max(glc.width, w); glc.height = Math.max(glc.height, h); }
  g.viewport(0, 0, w, h);
  g.enable(g.SCISSOR_TEST); g.scissor(0, 0, w, h); g.clear(g.COLOR_BUFFER_BIT); g.disable(g.SCISSOR_TEST);
  g.useProgram(prog);
  const ms: Mat[] = [pose.root, pose.head, pose.earL, pose.earR, pose.tail, pose.tail2];
  ms.forEach((m, i) => { UB.set([m[0], m[2], m[4]], i * 6); UB.set([m[1], m[3], m[5]], i * 6 + 3); });
  g.uniform3fv(U.uB, UB);
  g.uniform4f(U.uView, VIEW.x, VIEW.y, VIEW.w, VIEW.h);
  const eb = r.eyesBox, mb = r.mouthBox ?? [0, 0, 1, 1];
  g.uniform4f(U.uEB, eb[0], eb[1], eb[2], eb[3]); g.uniform4f(U.uMB, mb[0], mb[1], mb[2], mb[3]);
  g.uniform1f(U.uEK, pose.eyes); g.uniform1f(U.uMK, P.tm ? pose.mouth : 0); g.uniform1f(U.uDim, pose.dim); g.uniform1f(U.uUV, P.uv);
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, P.tf);
  g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, P.te);
  g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, P.tm ?? P.te);
  const M = mesh(g, P.N);
  g.bindBuffer(g.ARRAY_BUFFER, M.pos);
  g.enableVertexAttribArray(A.pos); g.vertexAttribPointer(A.pos, 2, g.FLOAT, false, 0, 0);
  g.bindBuffer(g.ARRAY_BUFFER, P.wb);
  g.enableVertexAttribArray(A.w); g.vertexAttribPointer(A.w, 4, g.UNSIGNED_BYTE, true, 5, 0);
  g.enableVertexAttribArray(A.w2); g.vertexAttribPointer(A.w2, 1, g.UNSIGNED_BYTE, true, 5, 4);
  g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, M.idx);
  g.drawElements(g.TRIANGLES, M.n, g.UNSIGNED_SHORT, 0);
  return true;
}

// ============================================================ 친구 하나(캔버스 하나)
export interface PaintOpts {
  id: string;
  canvas: HTMLCanvasElement;
  onPose?: (p: Pose) => void;      // 꾸미기 아이템 위치 맞추기
}
const reduceMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export class PaintPet {
  anim: PetAnim;
  inp: AnimIn = { mood: 'happy', motion: 'bob', talking: false, g: 1, poke: 0, reduce: false };
  size = 200;
  visible = true;
  private ctx: CanvasRenderingContext2D | null;
  private px = 0.3; private cw = 0; private ch = 0;
  private io?: IntersectionObserver;
  // 옆모습 꾸미기: 입은 것의 옆모습 그림, 옷·목걸이를 몸에 입힌 칸 그림(같은 칸이면 다시 안 그림)
  private wearKey = '';
  private side: Partial<Record<SideSlot, { key: string; box: [number, number, number, number] }>> = {};
  private oc: HTMLCanvasElement | null = null; private ocKey = '';
  constructor(public o: PaintOpts) {
    this.anim = new PetAnim(PAINT_RIG[o.id]);
    this.ctx = o.canvas.getContext('2d');
    if (typeof IntersectionObserver === 'function') {
      this.io = new IntersectionObserver(es => { for (const e of es) this.visible = e.isIntersecting; });
      this.io.observe(o.canvas);
    }
  }
  /** 입은 아이템(옷장 wear) → 옆모습 그림을 미리 받아 둔다(나올 때 받기 — 서비스워커가 저장) */
  setWear(wear: Partial<Record<string, string | undefined>>) {
    const k = SIDE_SLOTS.map(sl => wear[sl] ?? '').join('|');
    if (k === this.wearKey) return;
    this.wearKey = k; this.ocKey = ''; this.side = {};
    if (!sideRig(this.o.id)) return;
    for (const sl of SIDE_SLOTS) {
      const it = wear[sl] ? sideArt(`${sl}:${wear[sl]}`) : null;
      if (it) { this.side[sl] = it; img(it.key); }
    }
  }
  /** 칸 그림에 옷(몸 실루엣 안에만)·목걸이를 입히고 머리·귀를 그 위에 다시 그린 그림. 입힐 것이 없으면 null */
  private dress(im: HTMLImageElement, m: PaintMotion, key: string, fi: number, sf: SideFrame): HTMLCanvasElement | null {
    const r = sf.r;
    const cl = sf.b ? this.side.clothes : undefined, nk = this.side.neck;
    const clI = cl && IMGS[cl.key]?.img, nkI = nk && IMGS[nk.key]?.img;
    if (!clI && !nkI) return null;
    const ck = `${key}|${fi}|${this.wearKey}|${clI ? 1 : 0}${nkI ? 1 : 0}`;
    if (this.oc && this.ocKey === ck) return this.oc;
    const oc = this.oc ?? (this.oc = document.createElement('canvas'));
    if (oc.width !== m.w || oc.height !== m.h) { oc.width = m.w; oc.height = m.h; }
    const o = oc.getContext('2d');
    if (!o) return null;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, m.w, m.h);
    o.drawImage(im, fi * m.w, 0, m.w, m.h, 0, 0, m.w, m.h);
    if (clI && cl && sf.b) {
      o.globalCompositeOperation = 'source-atop';
      o.setTransform(...mul(sf.b, placeM('clothes', r, cl.box))); o.drawImage(clI, 0, 0, 1, 1);
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over';
    }
    if (nkI && nk) { o.setTransform(...mul(sf.h, placeM('neck', r, nk.box))); o.drawImage(nkI, 0, 0, 1, 1); o.setTransform(1, 0, 0, 1, 0, 0); }
    // 머리·귀는 옷·목걸이 위에(옆모습에서는 늘어진 귀·턱이 목과 어깨를 가림)
    const H = sf.h, P = r.p;
    o.save(); o.beginPath();
    for (let i = 0; i < P.length; i += 2) {
      const x = H[0] * P[i] + H[2] * P[i + 1] + H[4], y = H[1] * P[i] + H[3] * P[i + 1] + H[5];
      if (i) o.lineTo(x, y); else o.moveTo(x, y);
    }
    o.closePath(); o.clip();
    o.drawImage(im, fi * m.w, 0, m.w, m.h, 0, 0, m.w, m.h);
    o.restore();
    this.ocKey = ck;
    return oc;
  }
  setSize(size: number) {
    this.size = size;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.px = Math.min(size * dpr / TEX, 1);                   // 기준판 1칸 = 캔버스 몇 칸 (원본보다 크게는 안 그림)
    const cw = Math.ceil(VIEW.w * this.px), ch = Math.ceil(VIEW.h * this.px);
    if (cw !== this.cw || ch !== this.ch) { this.cw = this.o.canvas.width = cw; this.ch = this.o.canvas.height = ch; }
  }
  frame(dt: number) {
    this.inp.reduce = !!reduceMQ?.matches;
    let pose = this.anim.step(dt, this.inp);
    // 동작 그림을 기다리는 동안 실제로는 정면 그림을 그린다. 정면 꾸미기도 함께 유지.
    if (this.visible && !this.draw(pose) && pose.sprite) pose = { ...pose, sprite: null };
    // WebGL 없이 통째로 그릴 때는 머리가 따로 돌지 않으니 머리 아이템도 몸을 따라가게
    this.o.onPose?.(getGL() ? pose : { ...pose, head: pose.root });
  }
  private draw(pose: Pose): boolean {
    const c = this.ctx, r = PAINT_RIG[this.o.id];
    if (!c || !r) return false;
    const px = this.px;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cw, this.ch);
    const toCanvas = (): void => c.setTransform(px, 0, 0, px, -VIEW.x * px, -VIEW.y * px);
    // 땅 그림자: 높이 뜰수록 작고 옅게
    toCanvas();
    const H0 = r.ground - r.top, S = pose.root[3] > 0 ? Math.hypot(pose.root[0], pose.root[1]) : 1;
    const k = Math.max(0.35, 1 - pose.lift / (H0 * 0.7));
    c.globalAlpha = 0.16 * k;
    c.fillStyle = '#5a3d22';
    c.beginPath(); c.ellipse(r.cx, r.ground - 2, 150 * S * pose.wide * k, 20 * S * (0.7 + 0.3 * k), 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    if (pose.sprite) {
      const m = r.motions[pose.sprite.key], im = IMGS[`pet.${this.o.id}.paint-${pose.sprite.key}`]?.img;
      if (m && im) {
        toCanvas(); c.transform(...pose.root);
        const s = 1 / r.sp, dw = m.w * s, dh = m.h * s, dx = r.cx - dw / 2, dy = r.ground - m.ground * s;
        const key = pose.sprite.key, fi = pose.sprite.frame;
        if (pose.dim < 1) c.filter = `brightness(${pose.dim})`;
        const sf = this.wearKey.replace(/\|/g, '') ? sideFrame(this.o.id, key, fi) : null;
        const dressed = sf ? this.dress(im, m, key, fi, sf) : null;
        if (dressed) c.drawImage(dressed, 0, 0, m.w, m.h, dx, dy, dw, dh);
        else c.drawImage(im, fi * m.w, 0, m.w, m.h, dx, dy, dw, dh);
        if (sf) {
          // 안경·모자: 머리 변환을 따라(칸 그림 밖으로 나가도 되게 큰 캔버스에)
          c.translate(dx, dy); c.scale(s, s);
          for (const sl of ['glasses', 'hat'] as const) {
            const it = this.side[sl], si = it && IMGS[it.key]?.img;
            if (!it || !si) continue;
            c.save(); c.transform(...mul(sf.h, placeM(sl, sf.r, it.box))); c.drawImage(si, 0, 0, 1, 1); c.restore();
          }
        }
        c.filter = 'none';
        return true;
      }
      // 연속 동작 그림이 아직 없으면 정면 그림으로
    }
    if (glDraw(this.o.id, pose, this.cw, this.ch)) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(glc, 0, glc.height - this.ch, this.cw, this.ch, 0, 0, this.cw, this.ch);
      return false;
    }
    // WebGL이 없을 때: 통째로 움직이고 눈·입 덮개만 겹침
    const f = IMGS[`pet.${this.o.id}.paint-front`]?.img;
    if (!f) return false;
    toCanvas(); c.transform(...pose.root);
    if (pose.dim < 1) c.filter = `brightness(${pose.dim})`;
    c.drawImage(f, 0, 0, TEX, TEX);
    const over = (key: string, box: number[] | undefined, a: number) => {
      const im = IMGS[`pet.${this.o.id}.paint-${key}`]?.img;
      if (!im || !box || a < 0.002) return;
      c.globalAlpha = a; c.drawImage(im, box[0], box[1], box[2], box[3]); c.globalAlpha = 1;
    };
    over('eyes', r.eyesBox, pose.eyes); over('mouth', r.mouthBox, pose.mouth);
    c.filter = 'none';
    return false;
  }
  destroy() { this.io?.disconnect(); }
}

// ============================================================ 한 번에 돌리기 (requestAnimationFrame 하나)
const LIVE = new Set<PaintPet>();
let raf = 0, last = 0, acc = 0;
function loop(ts: number) {
  raf = LIVE.size ? requestAnimationFrame(loop) : 0;
  const dt = last ? Math.min((ts - last) / 1000, 0.1) : 1 / 60;
  last = ts;
  // 친구가 많이 보이면 초당 30장으로 (태블릿 부담 줄이기)
  let vis = 0; LIVE.forEach(p => { if (p.visible) vis++; });
  acc += dt;
  const step = vis > 4 ? 1 / 32 : 0;
  if (acc < step) return;
  const d = acc; acc = 0;
  LIVE.forEach(p => { try { p.frame(d); } catch { /* 한 친구 오류가 다른 친구를 멈추지 않게 */ } });
}
export function startPet(p: PaintPet) {
  LIVE.add(p);
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
}
export function stopPet(p: PaintPet) {
  LIVE.delete(p); p.destroy();
  if (!LIVE.size && raf) { cancelAnimationFrame(raf); raf = 0; }
}
