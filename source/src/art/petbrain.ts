// 친구가 스스로 돌아다니기 (COLLAB 10-A 자유 행동) — 집 안·놀이터에서 게임 속 동물처럼:
// 몇 초마다 다음 행동을 고른다(걷기·달리기·앉아 쉬기·서서 쉬기·깡충·엎드리기·놀 곳·밥그릇에 가서 먹기·귀 긁기·
// 그루밍(고양이)·기지개·구르기(강아지), 같은 행동 연달아 X). 잠잘 때는 잠자리로 걸어가 엎드려 자고, 깨면 기지개부터.
// 새 그림(연속 동작)이 없는 친구는 예전처럼 제자리. 그림이 없는 동작은 고르지 않는다.
// 화면은 반환값의 x·y(친구 상자 왼쪽 위)·act·flip·style(이동 시간)을 그대로 쓴다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { paintable, rigOf, type Act } from './petpaint';

export interface Spot { x: number; y: number }
export interface Area { x0: number; x1: number; y0: number; y1: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface WanderOpts {
  pet: string;            // 친구 id
  size: number;           // 친구 상자 크기(px)
  mode: 'play' | 'sleep';
  home: Spot;             // 놀 때 기본 자리(장난감 옆 등) — 걸어 다닐 수 없으면 여기
  bed: Spot;              // 잘 때 자리
  area: Area;             // 돌아다닐 곳(친구 상자 왼쪽 위 기준)
  spots?: Spot[];         // 가끔 들르는 곳(놀 곳·다른 친구 옆 …)
  bowl?: Rect | null;     // 밥그릇(화면 좌표) — 있으면 가끔 가서 먹는다
  grow?: number;          // 그림 배율(자람: 0.6 + 0.4·growthOf) — 먹을 때 코끝 위치 계산용
  hold?: Spot | null;     // 정해진 자리(놀이 기구 등)에 가서 머물기 — 있으면 돌아다니지 않음
  restAct?: Act;          // hold에서의 자세(기본 앉기)
  touch?: Spot | null;    // 손가락으로 직접 옮기는 자리(저장하지 않음)
}
export interface WanderState { x: number; y: number; act: Act; flip: boolean; poke: number; style: Record<string, string> }
/** 화면이 움직이는 상자에 onTransitionEnd={w.onArrive}로 붙인다 — 도착한 뒤에 다음 동작(먹기 등)을 시작하려고
 *  (기기가 바쁘면 CSS 이동이 늦게 끝나므로 시간만 재면 도착 전에 먹기 시작함) */
export type Wander = WanderState & { onArrive: (e: Event) => void };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 이 친구가 걸어 다닐 수 있나(걷기 그림이 있나) */
export function canWander(pet: string) {
  const r = rigOf(pet);
  return paintable(pet) && !!r?.motions.walk && !!r?.motions.sitstand;
}
const has = (pet: string, k: string) => !!rigOf(pet)?.motions[k];

export function useWander(o: WanderOpts): Wander {
  const live = canWander(o.pet) && !reduce();
  const start = o.hold ?? (o.mode === 'sleep' ? o.bed : o.home);
  const [st, setSt] = useState<WanderState>({ x: start.x, y: start.y, act: o.mode === 'sleep' && live ? 'sleep' : 'sit', flip: false, poke: 0, style: {} });
  const cur = useRef(st); cur.current = st;
  const opt = useRef(o); opt.current = o;
  const timer = useRef(0);
  const lastKind = useRef('');
  const pending = useRef<null | (() => void)>(null);        // 도착하면 할 일
  const endRef = useRef<(e: Event) => void>(() => {});
  const onArrive = useRef((e: Event) => endRef.current(e)).current;

  useEffect(() => {
    const clear = () => clearTimeout(timer.current);
    const later = (ms: number, f: () => void) => { clear(); timer.current = window.setTimeout(f, ms); };
    const set = (p: Partial<WanderState>) => setSt(s => ({ ...s, ...p }));
    const fire = () => { const f = pending.current; pending.current = null; if (f) { clear(); f(); } };
    endRef.current = (e: Event) => { if (e.target === e.currentTarget && pending.current) fire(); };
    if (o.touch) {
      pending.current = null;
      set({ x: o.touch.x, y: o.touch.y, act: 'sit', style: { transition: 'none' } });
      return clear;
    }
    if (!live) {
      // 예전처럼: 정해진 자리로(1.4초 부드럽게)
      const at = o.hold ?? (o.mode === 'sleep' ? o.bed : o.home);
      set({ x: at.x, y: at.y, act: o.mode === 'sleep' ? 'sleep' : 'sit', style: {} });
      return clear;
    }
    const can = (k: string) => has(opt.current.pet, k);
    /** (x,y)로 걷거나 뛰어가서 끝나면 then */
    const go = (to: Spot, run: boolean, then: () => void) => {
      const s = cur.current, sz = opt.current.size;
      const dx = to.x - s.x, dy = to.y - s.y, d = Math.hypot(dx, dy);
      if (d < 8) { then(); return; }
      const speed = (run ? 1.45 : 0.42) * sz;                  // 걷기 0.42·달리기 1.45 상자/초 (발이 미끄러지지 않게 맞춘 값)
      const sitting = s.act === 'sit' || s.act === 'groom' || s.act === 'scratch';
      const up = sitting ? 0.45 : s.act === 'sleep' || s.act === 'lie' ? 1.2 : 0;   // 일어서는 시간
      const dur = d / speed;
      const flip = Math.abs(dx) > 4 ? dx < 0 : s.flip;
      set({ act: run ? 'run' : 'walk', flip, x: to.x, y: to.y,
        style: { transition: `left ${dur.toFixed(2)}s linear ${up}s, top ${dur.toFixed(2)}s linear ${up}s` } });
      pending.current = then;
      later((dur + up) * 1000 + 1500, fire);                   // 도착 알림(transitionend)이 안 오면(숨김 등) 조금 늦게라도
    };
    const A = () => opt.current.area;
    const randomSpot = (far: boolean): Spot => {
      const a = A(), s = cur.current;
      for (let i = 0; i < 8; i++) {
        const p = { x: rnd(a.x0, a.x1), y: rnd(a.y0, a.y1) };
        const d = Math.hypot(p.x - s.x, p.y - s.y);
        if (d > (far ? 380 : 140)) return p;
      }
      return { x: rnd(a.x0, a.x1), y: rnd(a.y0, a.y1) };
    };
    const sit = (ms: number, then: () => void) => { set({ act: 'sit' }); later(ms, then); };
    /** 걷고 난 뒤: 앉거나 옆으로 선 채 쉬기 */
    const settle = (ms: number, then: () => void) => { set({ act: can('idle') && Math.random() < 0.5 ? 'stand' : 'sit' }); later(ms, then); };
    /** 밥그릇 앞 자리: 코끝이 그릇 가운데 오게, 다가오는 쪽을 보고 */
    const eatSpot = () => {
      const op = opt.current, b = op.bowl!, r = rigOf(op.pet)!, k = op.size / r.tex;
      const reach = (r.motions.eat?.reach ?? 0.4 * r.tex) * k * (op.grow ?? 1);   // 작은(어린) 친구는 그림도 작다
      const bx = b.x + b.w / 2, feet = b.y + b.h * 0.92;
      const right = cur.current.x + op.size / 2 < bx;            // 그릇 왼쪽에서 오면 오른쪽을 보고 먹는다
      const center = right ? r.cx * k : op.size - r.cx * k;     // 좌우 반전은 상자 가운데 기준
      return { at: { x: (right ? bx - reach : bx + reach) - center, y: feet - r.ground * k }, right };
    };
    const next = () => {
      const op = opt.current;
      if (op.hold) { go(op.hold, true, () => { set({ act: op.restAct ?? 'sit', flip: false, style: {} }); }); return; }
      if (op.mode === 'sleep') { go(op.bed, false, () => { set({ act: 'sleep' }); }); return; }
      // 다음 행동 고르기 (같은 것 연달아 X, 그림이 없는 동작은 빼고)
      const opts: [string, number][] = [
        ['walk', 30], ['run', 12], ['rest', 12], ['stand', can('idle') ? 10 : 0], ['hop', 8],
        ['spot', op.spots?.length ? 10 : 0], ['lie', 6], ['eat', op.bowl && can('eat') ? 10 : 0],
        ['scratch', can('scratch') ? 7 : 0], ['groom', can('groom') ? 8 : 0], ['stretch', can('stretch') ? 6 : 0], ['roll', can('roll') ? 5 : 0],
      ];
      const pool = opts.filter(([k, w]) => w > 0 && k !== lastKind.current);
      let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), kind = pool[0][0];
      for (const [k, w] of pool) { if ((r -= w) < 0) { kind = k; break; } }
      lastKind.current = kind;
      switch (kind) {
        case 'walk': go(randomSpot(false), false, () => settle(rnd(2200, 4200), next)); break;
        case 'run': go(randomSpot(true), true, () => { set({ poke: cur.current.poke + 1 }); settle(rnd(2000, 3500), next); }); break;
        case 'rest': sit(rnd(2500, 4500), next); break;
        case 'stand': set({ act: 'stand' }); later(rnd(2500, 4500), next); break;
        case 'hop': set({ act: 'sit', poke: cur.current.poke + 1 }); later(rnd(1600, 2600), next); break;
        case 'spot': { const sp = op.spots![Math.floor(Math.random() * op.spots!.length)]; go(sp, Math.random() < 0.4, () => { set({ poke: cur.current.poke + 1 }); sit(rnd(2500, 4000), next); }); break; }
        case 'lie': set({ act: 'lie' }); later(rnd(4000, 6500), next); break;
        case 'eat': { const e = eatSpot(); go(e.at, false, () => { set({ act: 'eat', flip: !e.right }); later(rnd(3500, 6000), () => settle(rnd(1500, 2500), next)); }); break; }
        case 'scratch': set({ act: 'scratch' }); later(rnd(2400, 3600), next); break;
        case 'groom': set({ act: 'groom' }); later(rnd(3000, 5000), next); break;
        case 'stretch': set({ act: 'stretch' }); later(rnd(3200, 4200), next); break;
        case 'roll': set({ act: 'roll' }); later(rnd(3000, 3800), next); break;
      }
    };
    // 모드·놀이 기구가 바뀌면 곧바로 새로 — 자다가 깨면 기지개부터
    const waking = (cur.current.act === 'sleep' || cur.current.act === 'lie') && o.mode === 'play' && !o.hold;
    if (waking && can('stretch')) later(300, () => { set({ act: 'stretch' }); lastKind.current = 'stretch'; later(rnd(3400, 4200), next); });
    else later(cur.current.act === 'sleep' && o.mode === 'play' ? 300 : 600, next);
    return () => { clear(); pending.current = null; };
  }, [live, o.mode, o.hold?.x, o.hold?.y, o.pet, o.touch?.x, o.touch?.y]);
  return { ...st, onArrive };
}
