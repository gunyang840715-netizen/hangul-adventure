// 친구가 스스로 돌아다니기 (COLLAB 10-A 자유 행동) — 집 안·놀이터에서 게임 속 동물처럼:
// 몇 초마다 다음 행동을 고른다(걷기·달리기·앉아 쉬기·깡충·엎드리기·놀 곳·밥그릇에 가기, 같은 행동 연달아 X).
// 잠잘 때는 잠자리로 걸어가 엎드려 잔다. 새 그림(연속 동작)이 없는 친구는 예전처럼 제자리.
// 화면은 반환값의 x·y(친구 상자 왼쪽 위)·act·flip·style(이동 시간)을 그대로 쓴다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { paintable, rigOf, type Act } from './petpaint';

export interface Spot { x: number; y: number }
export interface Area { x0: number; x1: number; y0: number; y1: number }
export interface WanderOpts {
  pet: string;            // 친구 id
  size: number;           // 친구 상자 크기(px)
  mode: 'play' | 'sleep';
  home: Spot;             // 놀 때 기본 자리(장난감 옆 등) — 걸어 다닐 수 없으면 여기
  bed: Spot;              // 잘 때 자리
  area: Area;             // 돌아다닐 곳(친구 상자 왼쪽 위 기준)
  spots?: Spot[];         // 가끔 들르는 곳(밥그릇·놀 곳·다른 친구 옆 …)
  hold?: Spot | null;     // 정해진 자리(놀이 기구 등)에 가서 머물기 — 있으면 돌아다니지 않음
  restAct?: Act;          // hold에서의 자세(기본 앉기)
}
export interface WanderState { x: number; y: number; act: Act; flip: boolean; poke: number; style: Record<string, string> }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 이 친구가 걸어 다닐 수 있나(걷기 그림이 있나) */
export function canWander(pet: string) {
  const r = rigOf(pet);
  return paintable(pet) && !!r?.motions.walk && !!r?.motions.sitstand;
}

export function useWander(o: WanderOpts): WanderState {
  const live = canWander(o.pet) && !reduce();
  const start = o.hold ?? (o.mode === 'sleep' ? o.bed : o.home);
  const [st, setSt] = useState<WanderState>({ x: start.x, y: start.y, act: o.mode === 'sleep' && live ? 'sleep' : 'sit', flip: false, poke: 0, style: {} });
  const cur = useRef(st); cur.current = st;
  const opt = useRef(o); opt.current = o;
  const timer = useRef(0);
  const lastKind = useRef('');

  useEffect(() => {
    const clear = () => clearTimeout(timer.current);
    const later = (ms: number, f: () => void) => { clear(); timer.current = window.setTimeout(f, ms); };
    const set = (p: Partial<WanderState>) => setSt(s => ({ ...s, ...p }));
    if (!live) {
      // 예전처럼: 정해진 자리로(1.4초 부드럽게)
      const at = o.hold ?? (o.mode === 'sleep' ? o.bed : o.home);
      set({ x: at.x, y: at.y, act: o.mode === 'sleep' ? 'sleep' : 'sit', style: {} });
      return clear;
    }
    /** (x,y)로 걷거나 뛰어가서 끝나면 then */
    const go = (to: Spot, run: boolean, then: () => void) => {
      const s = cur.current, sz = opt.current.size;
      const dx = to.x - s.x, dy = to.y - s.y, d = Math.hypot(dx, dy);
      if (d < 8) { then(); return; }
      const speed = (run ? 1.45 : 0.42) * sz;                  // 걷기 0.42·달리기 1.45 상자/초 (발이 미끄러지지 않게 맞춘 값)
      const up = s.act === 'sit' ? 0.45 : s.act === 'sleep' || s.act === 'lie' ? 1.2 : 0;   // 일어서는 시간
      const dur = d / speed;
      const flip = Math.abs(dx) > 4 ? dx < 0 : s.flip;
      set({ act: run ? 'run' : 'walk', flip, x: to.x, y: to.y,
        style: { transition: `left ${dur.toFixed(2)}s linear ${up}s, top ${dur.toFixed(2)}s linear ${up}s` } });
      later((dur + up) * 1000 + 30, then);
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
    const next = () => {
      const op = opt.current;
      if (op.hold) { go(op.hold, true, () => { set({ act: op.restAct ?? 'sit', flip: false, style: {} }); }); return; }
      if (op.mode === 'sleep') { go(op.bed, false, () => { set({ act: 'sleep' }); }); return; }
      // 다음 행동 고르기 (같은 것 연달아 X)
      const opts: [string, number][] = [['walk', 34], ['run', 14], ['rest', 18], ['hop', 12], ['spot', op.spots?.length ? 14 : 0], ['lie', 8]];
      const pool = opts.filter(([k]) => k !== lastKind.current);
      let r = Math.random() * pool.reduce((a, [, w]) => a + w, 0), kind = pool[0][0];
      for (const [k, w] of pool) { if ((r -= w) < 0) { kind = k; break; } }
      lastKind.current = kind;
      switch (kind) {
        case 'walk': go(randomSpot(false), false, () => sit(rnd(2200, 4200), next)); break;
        case 'run': go(randomSpot(true), true, () => { set({ poke: cur.current.poke + 1 }); sit(rnd(2000, 3500), next); }); break;
        case 'rest': sit(rnd(2500, 4500), next); break;
        case 'hop': set({ act: 'sit', poke: cur.current.poke + 1 }); later(rnd(1600, 2600), next); break;
        case 'spot': { const sp = op.spots![Math.floor(Math.random() * op.spots!.length)]; go(sp, Math.random() < 0.4, () => { set({ poke: cur.current.poke + 1 }); sit(rnd(2500, 4000), next); }); break; }
        case 'lie': set({ act: 'lie' }); later(rnd(4000, 6500), next); break;
      }
    };
    // 모드·놀이 기구가 바뀌면 곧바로 새로
    later(cur.current.act === 'sleep' && o.mode === 'play' ? 300 : 600, next);
    return clear;
  }, [live, o.mode, o.hold?.x, o.hold?.y, o.pet]);
  return st;
}
