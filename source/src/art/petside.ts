// 옆모습 꾸미기 (COLLAB 10-A) — 걷기·달리기·점프·서서 쉬기·먹기·앉기 같은 손그림 연속 동작 중에도 모자·안경·목걸이·옷이 보이게.
// · 기준점(petside.gen.ts, source/scripts/art_side.py가 만듦): 친구마다 기준 프레임(idle 0)의 머리 원·눈·목·머리 둘레·옷 상자와,
//   동작의 칸마다 머리 변환(크기·각도·이동)과 몸통 변환(각도·이동). 모든 칸을 찾은 동작만 들어 있다(못 찾은 동작은 지금처럼 숨김).
// · 그림(iside.<slot>.<key>, art_sheets.py items-side): GPT가 그린 옆모습 아이템. 정사각형 안 물건 자리는 itemside.gen.ts.
// · 붙이는 규칙(아래 placeM)은 art_side.py의 place()와 같다 — 검사 그림과 앱이 같은 자리에 그린다.
// · 옷은 몸 실루엣 안에만(캔버스 source-atop) 그리고 머리·귀는 그 위에 다시 그린다. 신발·장난감은 옆모습에서 숨긴다.
import { artSrc } from './artmap';
import { PET_SIDE } from './petside.gen';
import { ITEM_SIDE } from './itemside.gen';

type P2 = [number, number];
/** 고개를 숙여 얼굴 비율까지 달라지는 칸은 원본 그림에서 직접 검수한 기준점을 사용. */
export interface SideAnchors {
  hc: P2; hr: number; e: P2; f: P2 | null; k1: P2; k2: P2;
  p: number[];                                   // 머리 둘레 [x, y, x, y, …]
}
export interface SideRig extends SideAnchors {
  cb: [number, number, number, number];          // 옷 상자 x0 y0 x1 y1
  m: Record<string, { h: number[][]; b?: number[][]; a?: (SideAnchors | null)[] }>;
}
export interface SideFrame { h: M6; b: M6 | null; r: SideRig }
/** 2D 변환 [a b c d e f] — x' = a x + c y + e, y' = b x + d y + f (캔버스 setTransform·SVG matrix와 같은 순서) */
export type M6 = [number, number, number, number, number, number];
export type SideSlot = 'hat' | 'glasses' | 'neck' | 'clothes';
export const SIDE_SLOTS: SideSlot[] = ['clothes', 'neck', 'glasses', 'hat'];

export const mul = (m: M6, n: M6): M6 => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const rad = Math.PI / 180;
/** 머리 변환 h=[크기, 각도, x, y]: 기준 프레임 좌표 → 그 칸 좌표 */
export function headM(h: number[]): M6 {
  const [s, deg, tx, ty] = h, a = deg * rad;
  return [s * Math.cos(a), s * Math.sin(a), -s * Math.sin(a), s * Math.cos(a), tx, ty];
}
/** 몸통 변환 b=[각도, dx, dy]: 옷 상자 가운데 둘레로 돌리고 옮김 */
export function bodyM(r: SideRig, b: number[]): M6 {
  const [deg, dx, dy] = b, a = deg * rad, ca = Math.cos(a), sa = Math.sin(a);
  const cx = (r.cb[0] + r.cb[2]) / 2, cy = (r.cb[1] + r.cb[3]) / 2;
  return [ca, sa, -sa, ca, cx + dx - ca * cx + sa * cy, cy + dy - sa * cx - ca * cy];
}

/** 아이템 그림(0~1 정사각형) → 기준 프레임 좌표. box = 정사각형 안 물건 자리 */
export function placeM(slot: SideSlot, r: SideRig, box: [number, number, number, number]): M6 {
  const [bx0, by0, bx1, by1] = box, bw = bx1 - bx0, bh = by1 - by0;
  const [hx, hy] = r.hc, Hr = r.hr;
  if (slot === 'hat') {
    const L = Math.min(2.1 * Hr / bw, 1.9 * Hr / bh);
    const cx = hx - 0.05 * Hr, bottom = hy - Hr + 0.48 * Hr;
    return [L, 0, 0, L, cx - (bx0 + bx1) / 2 * L, bottom - by1 * L];
  }
  if (slot === 'glasses') {
    const [ex, ey] = r.e;
    let cx: number, cy: number, w: number, ang = 0;
    if (r.f) {
      const [fx, fy] = r.f;
      cx = ex * 0.55 + fx * 0.45; cy = ey * 0.55 + fy * 0.45;
      w = Math.hypot(fx - ex, fy - ey) + 0.8 * Hr; ang = Math.atan2(fy - ey, fx - ex);
    } else { cx = ex + 0.12 * Hr; cy = ey; w = 0.95 * Hr; }
    const L = w / bw, ca = Math.cos(ang) * L, sa = Math.sin(ang) * L;
    const ox = -(bx0 + bx1) / 2, oy = -(by0 + by1) / 2;
    return [ca, sa, -sa, ca, cx + ca * ox - sa * oy, cy + sa * ox + ca * oy];
  }
  if (slot === 'neck') {
    const [x1, y1] = r.k1, [x2, y2] = r.k2;
    const mx = x1 + 0.6 * (x2 - x1), my = y1 + 0.6 * (y2 - y1);
    const ln = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
    const w = Math.min(1.15 * ln, 1.4 * Hr);
    const L = Math.min(w / bw, 1.05 * w / bh), ca = Math.cos(ang) * L, sa = Math.sin(ang) * L;
    const ox = -(bx0 + bx1) / 2, oy = -by0 - 0.12 * w / L;
    return [ca, sa, -sa, ca, mx + ca * ox - sa * oy, my + sa * ox + ca * oy];
  }
  // 옷: 옷 상자 높이에 맞추고 가슴 앞(오른쪽)·등선(위)에 붙임, 상자가 더 길면 가로로 1.3배까지 늘림
  const [x0, y0, x1, y1] = r.cb, h = y1 - y0, wb = x1 - x0;
  let L = h / bh, sx = 1;
  if (bw * L > wb) L = wb / bw;
  else if (bw * L < wb) sx = Math.min(wb / (bw * L), 1.3);
  return [L * sx, 0, 0, L, x1 - bx1 * L * sx, y0 - by0 * L];
}

export const sideRig = (pid: string): SideRig | undefined => PET_SIDE[pid];
/** 그 동작의 그 칸에 옆모습 꾸미기를 붙일 수 있으면 [머리 변환, 몸통 변환(없으면 옷 숨김)] */
export function sideFrame(pid: string, key: string, frame: number): SideFrame | null {
  const r = PET_SIDE[pid], m = r?.m[key];
  if (!r || !m || frame < 0 || frame >= m.h.length) return null;
  const anchors = m.a?.[frame];
  return { h: headM(m.h[frame]), b: m.b ? bodyM(r, m.b[frame]) : null, r: anchors ? { ...r, ...anchors } : r };
}
/** 아이템 id(slot:key)의 옆모습 그림 키·정사각형 안 물건 자리 */
export function sideArt(id: string): { key: string; box: [number, number, number, number] } | null {
  const box = ITEM_SIDE[id];
  const key = 'iside.' + id.replace(':', '.');
  return box && artSrc(key) ? { key, box } : null;
}
