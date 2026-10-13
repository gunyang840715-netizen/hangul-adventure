// 친구 새 그림의 움직임 (COLLAB 10-A) — 시간마다 뼈대(몸·머리·귀·꼬리)의 변환, 눈·입 덮개 세기, 연속 동작 칸을 계산한다.
// 애니메이션 원칙: 예비 동작(뛰기 전 웅크림) · 늘어나고 찌그러짐(도약·착지) · 따라오는 동작(귀·꼬리·머리는 스프링으로 늦게 따라와 흔들리다 멈춤)
//                 · 천천히 시작·멈춤 · 겹침 동작 · 높이에 따라 작아지는 그림자.
// 좌표는 모두 640x640 기준판(petpaint.gen.ts). 행렬은 [a b c d e f] (x' = a x + c y + e, y' = b x + d y + f).
import type { PaintRig } from './petpaint';

export type Mat = [number, number, number, number, number, number];
export type Act = 'sit' | 'walk' | 'run' | 'sleep' | 'lie';
type MoodK = 'happy' | 'wow' | 'think' | 'sleep' | 'love';
type MotionK = 'bob' | 'jump' | 'cheer' | 'wiggle' | 'none' | 'fly' | 'hop';

export interface AnimIn {
  mood: MoodK; motion: MotionK; talking: boolean;
  g: number;            // 자람 0~1 (growthOf)
  act?: Act;            // 집 안·놀이터에서: 앉기·걷기·달리기·잠·엎드리기 (없으면 앉은 정면 그대로)
  poke: number;         // 바뀔 때마다 한 번 깡충(누르기 반응)
  reduce: boolean;      // 기기의 '움직임 줄이기'
}
export interface Pose {
  sprite: null | { key: string; frame: number };
  root: Mat; head: Mat; earL: Mat; earR: Mat; tail: Mat; tail2: Mat;
  eyes: number; mouth: number; dim: number;
  lift: number;         // 땅에서 뜬 높이(기준판 px) — 그림자
  wide: number;         // 그림자 너비 배율(옆모습은 길게)
}

const DEG = Math.PI / 180;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const ease = (x: number) => (1 - Math.cos(Math.PI * clamp(x, 0, 1))) / 2;

/** m ∘ n (n 먼저, 그다음 m) */
export function mul(m: Mat, n: Mat): Mat {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
/** (px,py)를 중심으로 회전·확대한 뒤 (tx,ty)만큼 옮김 */
export function about(px: number, py: number, ang = 0, sx = 1, sy = sx, tx = 0, ty = 0): Mat {
  const c = Math.cos(ang), s = Math.sin(ang);
  const a = c * sx, b = s * sx, cc = -s * sy, d = c * sy;
  return [a, b, cc, d, px + tx - (a * px + cc * py), py + ty - (b * px + d * py)];
}
const ID: Mat = [1, 0, 0, 1, 0, 0];

/** 감쇠 스프링 (귀·머리·꼬리가 늦게 따라오며 흔들리다 멈춤) */
class Spring {
  x = 0; v = 0;
  constructor(private k: number, private c: number) {}
  step(target: number, dt: number) {
    const a = -this.k * (this.x - target) - this.c * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
}

type Place = 'front' | 'side' | 'lie' | 'asleep';
interface Seg { key: string; from: number; to: number; fps: number; loop?: boolean; hold?: boolean; lift?: number[] }

export class PetAnim {
  private t = 0;
  private motion = ''; private mt = 0;
  private blinkAt = rnd(1, 3.5); private blinkT = -9; private dbl = false;
  private earAt = rnd(2, 6);
  private tiltAt = rnd(5, 10); private tiltT = -9; private tiltDir = Math.random() < 0.5 ? -1 : 1;
  private thinkDir = Math.random() < 0.5 ? -1 : 1;
  private phase = rnd(0, 6);
  private sHead = new Spring(70, 8); private sEarL = new Spring(150, 6); private sEarR = new Spring(150, 6); private sTail = new Spring(45, 5);
  private mouthK = 0; private mouthGoal = 0; private mouthAt = 0; private eyesK = 0;
  private prevLift = 0; private vy = 0;
  private hopT = -9; private excitedUntil = 0;
  private lastPoke = 0;
  // 연속 동작
  private act: Act = 'sit';
  private segs: Seg[] = []; private segT = 0; private cur: { key: string; f: number } | null = null;
  private loopSeg: Seg | null = null;

  constructor(private rig: PaintRig) {}

  private has(k: string) { return !!this.rig.motions[k]; }
  private n(k: string) { return this.rig.motions[k]?.n ?? 0; }

  // ------------------------------------------------------------------ 연속 동작 순서
  /** 지금 보이는 칸이 어떤 자세인지 */
  private place(): Place {
    const c = this.cur;
    if (!c) return 'front';
    if (c.key === 'sitstand') return c.f >= this.n('sitstand') - 1 ? 'front' : 'side';
    if (c.key === 'liesleep') return c.f === 0 ? 'front' : c.f >= 3 ? 'asleep' : 'lie';
    if (c.key === 'lying') return 'lie';
    return 'side';
  }
  private toFront(): Seg[] {
    const c = this.cur, ss = this.n('sitstand');
    if (!c) return [];
    if (c.key === 'sitstand') return [{ key: 'sitstand', from: c.f, to: ss - 1, fps: 7 }];
    if (c.key === 'liesleep') return [{ key: 'liesleep', from: c.f, to: 0, fps: 6 }];
    if (c.key === 'lying') return [{ key: 'liesleep', from: 2, to: 0, fps: 6 }];
    return this.has('sitstand') ? [{ key: 'sitstand', from: 0, to: ss - 1, fps: 7 }] : [];
  }
  private toSide(): Seg[] {
    const c = this.cur, ss = this.n('sitstand');
    if (!this.has('sitstand')) return [];
    if (!c) return [{ key: 'sitstand', from: ss - 1, to: 0, fps: 8 }];
    if (c.key === 'sitstand') return [{ key: 'sitstand', from: c.f, to: 0, fps: 8 }];
    if (c.key === 'liesleep' || c.key === 'lying') return [{ key: 'liesleep', from: c.key === 'lying' ? 2 : c.f, to: 0, fps: 7 }, { key: 'sitstand', from: ss - 1, to: 0, fps: 8 }];
    return [];
  }
  private toLie(k: number): Seg[] {
    const c = this.cur;
    const down: Seg = { key: 'liesleep', from: 0, to: k, fps: 5, hold: true };
    if (!c) return [down];
    if (c.key === 'liesleep') return [{ ...down, from: c.f }];
    if (c.key === 'lying') return k >= 3 ? [{ ...down, from: 2 }] : [{ key: 'lying', from: 0, to: 0, fps: 1, hold: true }];
    return [...this.toFront(), down];
  }
  private plan(next: Act) {
    let segs: Seg[] = [];
    if (next === 'sit') segs = this.toFront();
    else if (next === 'walk' || next === 'run') {
      const k = next === 'run' && this.has('run') ? 'run' : 'walk';
      if (this.has(k) && (this.has('sitstand') || this.place() === 'side')) {
        const m = this.rig.motions[k];
        segs = [...this.toSide(), { key: k, from: 0, to: m.n - 1, fps: m.fps, loop: true }];
      } else segs = this.toFront();
    } else if (next === 'sleep' || next === 'lie') {
      if (this.has('liesleep')) {
        segs = this.toLie(next === 'sleep' ? 3 : 2);
        if (next === 'lie' && this.has('lying')) segs.push({ key: 'lying', from: 0, to: 0, fps: 1, hold: true });
      } else segs = this.toFront();
    }
    this.segs = segs; this.segT = 0; this.loopSeg = null;
    if (!segs.length && next === 'sit') this.cur = null;
  }
  /** 옆모습일 때 한 번 점프(칸마다 높이) */
  private sideJump() {
    if (!this.has('jump')) return;
    const m = this.rig.motions.jump;
    const lift = [0, 0.3, 0.95, 0.75, 0.2, 0, 0, 0].slice(0, m.n);
    const back = this.segs.length ? this.segs : this.loopSeg ? [{ ...this.loopSeg, from: 0 }] : [];
    this.segs = [{ key: 'jump', from: 0, to: m.n - 1, fps: m.fps, lift }, ...back]; this.segT = 0; this.loopSeg = null;
  }
  private stepSegs(dt: number): number {
    // 반환: 이 칸의 뜬 높이(0~1)
    if (!this.segs.length) return 0;
    const s = this.segs[0];
    this.segT += dt;
    const steps = Math.floor(this.segT * s.fps);
    const dir = s.to >= s.from ? 1 : -1;
    const len = Math.abs(s.to - s.from);
    let f: number;
    if (s.loop) {
      const nn = this.n(s.key);
      f = (s.from + steps) % nn;
      this.loopSeg = s;
    } else if (steps <= len) f = s.from + dir * steps;
    else if (s.hold) f = s.to;
    else {
      this.segs.shift(); this.segT = 0;
      if (!this.segs.length) {
        // 끝: 정면 앉기 칸에서 끝났으면 정면 그림으로
        const endFront = (s.key === 'sitstand' && s.to >= this.n('sitstand') - 1) || (s.key === 'liesleep' && s.to === 0);
        this.cur = endFront ? null : { key: s.key, f: s.to };
        return 0;
      }
      return this.stepSegs(0);
    }
    this.cur = { key: s.key, f };
    return s.lift ? (s.lift[f] ?? 0) : 0;
  }

  // ------------------------------------------------------------------ 정면 자세의 몸 움직임
  private rootMotion(motion: string, u: number, H0: number) {
    // 반환: 위로 뜬 높이 y, 가로·세로 배율, 기울기
    let y = 0, sx = 1, sy = 1, rot = 0;
    const T = 2 * Math.PI;
    switch (motion) {
      case 'bob': { const s = ease((u % 2.6) / 1.3 > 1 ? 2 - (u % 2.6) / 1.3 : (u % 2.6) / 1.3); y = 0.035 * H0 * s; sy = 1 + 0.012 * s; sx = 1 - 0.008 * s; break; }
      case 'jump': {
        const P = 0.86, ph = (u % P) / P;
        if (ph < 0.16) { const k = Math.sin(ph / 0.16 * Math.PI / 2); sy = 1 - 0.1 * k; sx = 1 + 0.07 * k; }          // 웅크림(예비 동작)
        else if (ph < 0.66) { const a = (ph - 0.16) / 0.5; y = 4 * a * (1 - a) * 0.26 * H0; const st = Math.cos(Math.PI * a) ** 2; sy = 1 + 0.07 * st; sx = 1 - 0.045 * st; }
        else if (ph < 0.82) { const k = Math.sin((ph - 0.66) / 0.16 * Math.PI); sy = 1 - 0.11 * k; sx = 1 + 0.08 * k; } // 착지 찌그러짐
        break;
      }
      case 'cheer': { const w = Math.sin(T * u / 1.8); rot = 6 * DEG * w; y = Math.abs(w) * 0.1 * H0; const k = 1 - Math.abs(w); sy = 1 - 0.05 * k * k; sx = 1 + 0.035 * k * k; break; }
      case 'wiggle': if (u < 1) { rot = 8 * DEG * Math.sin(T * u / 0.5) * (1 - u * 0.3); } break;
      case 'fly': { const s = ease((u % 3) / 1.5 > 1 ? 2 - (u % 3) / 1.5 : (u % 3) / 1.5); y = 0.1 * H0 * s; rot = 3 * DEG * s; break; }
      case 'hop': if (u < 0.5) { const a = u / 0.5; y = Math.sin(Math.PI * a) * 0.16 * H0; const k = a < 0.15 ? Math.sin(a / 0.15 * Math.PI) : a > 0.85 ? Math.sin((a - 0.85) / 0.15 * Math.PI) : 0; sy = 1 - 0.08 * k; sx = 1 + 0.06 * k; } break;
    }
    return { y, sx, sy, rot };
  }

  step(dtIn: number, p: AnimIn): Pose {
    const dt = Math.min(Math.max(dtIn, 0), 1 / 20);
    this.t += dt;
    const t = this.t, r = this.rig;
    const H0 = r.ground - r.top;
    const cx = r.cx, G = r.ground;
    const S = 0.6 + 0.4 * p.g, HS = 1.24 - 0.24 * p.g;
    if (p.motion !== this.motion) { this.motion = p.motion; this.mt = t; }
    const want: Act = p.act ?? 'sit';
    if (want !== this.act) { this.act = want; this.plan(want); }
    let hop = false;
    if (p.poke !== this.lastPoke) {
      this.lastPoke = p.poke; this.excitedUntil = t + 1.6;
      if (!p.reduce) { if (this.place() === 'side') this.sideJump(); else hop = true; }
    }
    if (hop) this.hopT = t;
    const liftK = p.reduce ? 0 : this.stepSegs(dt);
    const place = this.place();
    const sleepy = p.mood === 'sleep' || place === 'asleep';
    const excited = t < this.excitedUntil || p.motion === 'jump' || p.motion === 'cheer' || p.mood === 'love' || p.mood === 'wow';

    // 숨쉬기 (잘 때는 느리고 깊게)
    const per = sleepy ? 4.6 : 3.5, amp = sleepy ? 0.02 : 0.012;
    const b = Math.sin(2 * Math.PI * t / per + this.phase);

    // ---------------- 연속 동작 칸
    if (this.cur) {
      const lift = liftK * 0.32 * H0;
      const brS = place === 'asleep' || place === 'lie' ? amp * 0.8 * b : 0;
      const root = about(cx, G, 0, S * (1 - brS * 0.3), S * (1 + brS), 0, -lift * S);
      this.prevLift = lift;
      return { sprite: { key: this.cur.key, frame: this.cur.f }, root, head: root, earL: root, earR: root, tail: root, tail2: root,
        eyes: 0, mouth: 0, dim: place === 'asleep' ? 0.95 : 1, lift: lift * S, wide: place === 'side' ? 1.35 : place === 'front' ? 1 : 1.25 };
    }

    // ---------------- 정면 앉기 (그림 한 장을 휘게)
    const mo = p.reduce ? { y: 0, sx: 1, sy: 1, rot: 0 } : this.rootMotion(this.motion, t - this.mt, H0);
    let { y, sx, sy, rot } = mo;
    if (!p.reduce && t - this.hopT < 0.5) { const h = this.rootMotion('hop', t - this.hopT, H0); y += h.y; sx *= h.sx; sy *= h.sy; }
    sy *= 1 + amp * b; sx *= 1 - amp * 0.35 * b;
    this.vy = (y - this.prevLift) / Math.max(dt, 1e-3); this.prevLift = y;
    const root = about(cx, G, rot, S * sx, S * sy, 0, -y * S);

    // 고개: 천천히 살랑 + 가끔 갸웃 + 기분(생각=갸웃, 잠=숙임) + 몸이 뛰면 늦게 따라옴
    if (t > this.tiltAt) { this.tiltT = t; this.tiltAt = t + rnd(7, 13); this.tiltDir = -this.tiltDir; }
    const tiltOn = t - this.tiltT < 1.6 ? Math.sin(Math.PI * (t - this.tiltT) / 1.6) : 0;
    let headGoal = 1.3 * DEG * Math.sin(2 * Math.PI * t / 6.5 + this.phase) + 5 * DEG * this.tiltDir * tiltOn;
    if (p.mood === 'think') headGoal += 10 * DEG * this.thinkDir;
    if (sleepy) headGoal += 4 * DEG;
    if (p.reduce) headGoal = 0;
    const headA = this.sHead.step(headGoal, dt);
    const headDy = (sleepy ? 0.02 * H0 : 0) - amp * 0.4 * H0 * Math.sin(2 * Math.PI * (t - 0.1) / per + this.phase) + amp * 0.4 * H0 * b; // 숨쉴 때 머리는 0.1초 늦게
    const head = mul(root, about(r.neck[0], r.neck[1], headA, HS, HS, 0, headDy));

    // 귀: 5~10초마다 쫑긋, 놀라면 쫑긋 세움, 뛰면 출렁(따라오는 동작)
    if (!p.reduce && t > this.earAt) {
      this.earAt = t + rnd(4.5, 9.5);
      const k = (r.ears === 'floppy' ? 1.1 : 1.7) * (Math.random() < 0.5 ? 1 : -1);   // 순간 속도(rad/s) → 약 5~8도
      const which = Math.random();
      if (which < 0.45) this.sEarL.v += k; else if (which < 0.9) this.sEarR.v -= k; else { this.sEarL.v += k; this.sEarR.v -= k; }
    }
    const flop = r.ears === 'floppy' ? 1 : 0.5;
    if (!p.reduce) { this.sEarL.v += this.vy * 0.00025 * flop; this.sEarR.v -= this.vy * 0.00025 * flop; }
    const perk = p.mood === 'wow' ? 5 * DEG : sleepy ? -3 * DEG : 0;
    const eL = this.sEarL.step(r.ears === 'floppy' ? -perk * 0.5 : -perk, dt), eR = this.sEarR.step(r.ears === 'floppy' ? perk * 0.5 : perk, dt);
    const earL = mul(head, about(r.earL[0], r.earL[1], clamp(eL, -0.3, 0.3)));
    const earR = mul(head, about(r.earR[0], r.earR[1], clamp(eR, -0.3, 0.3)));

    // 꼬리: 강아지는 빠르게 좌우, 고양이는 느린 S자(마디 둘)
    let tA = 0, t2A = 0;
    if (!p.reduce && r.tail) {
      if (r.cat) {
        const w = excited ? 2 * Math.PI * t / 1.1 : 2 * Math.PI * t / 2.6;
        const A = sleepy ? 2 : excited ? 9 : 6;
        tA = A * DEG * Math.sin(w + this.phase); t2A = (A + 6) * DEG * Math.sin(w + this.phase - 1.3);
      } else {
        const f = sleepy ? 0.3 : excited ? 4 : 2.2, A = sleepy ? 2 : excited ? 15 : 9;
        tA = A * DEG * Math.sin(2 * Math.PI * f * t); t2A = 0.6 * A * DEG * Math.sin(2 * Math.PI * f * t - 0.9);
      }
    }
    tA = this.sTail.step(tA, dt) * 0.4 + tA * 0.6;
    const tail = r.tail ? mul(root, about(r.tail[0], r.tail[1], tA)) : root;
    const tail2 = r.tail && r.tailMid ? mul(tail, about(r.tailMid[0], r.tailMid[1], t2A)) : tail;

    // 눈: 2.5~6초마다 깜빡(가끔 두 번), 잠·사랑은 감음
    if (t > this.blinkAt) { this.blinkT = t; this.dbl = Math.random() < 0.18; this.blinkAt = t + rnd(2.5, 6); }
    const bt = t - this.blinkT, bl = (x: number) => (x < 0 ? 0 : x < 0.06 ? x / 0.06 : x < 0.09 ? 1 : x < 0.16 ? 1 - (x - 0.09) / 0.07 : 0);
    const blink = Math.max(bl(bt), this.dbl ? bl(bt - 0.22) : 0);
    const eyesGoal = sleepy || p.mood === 'love' ? 1 : blink;
    this.eyesK = eyesGoal >= this.eyesK || blink > 0 ? eyesGoal : this.eyesK + (eyesGoal - this.eyesK) * Math.min(1, dt * 14);

    // 입: 말할 때 벌렸다 다물었다, 놀람·사랑은 벌림
    if (p.talking) {
      if (t > this.mouthAt) { this.mouthGoal = this.mouthGoal > 0.5 ? rnd(0, 0.25) : rnd(0.6, 1); this.mouthAt = t + rnd(0.08, 0.16); }
    } else this.mouthGoal = p.mood === 'wow' || p.mood === 'love' ? 1 : 0;
    this.mouthK += (this.mouthGoal - this.mouthK) * Math.min(1, dt * 22);

    return { sprite: null, root, head, earL, earR, tail, tail2, eyes: this.eyesK, mouth: this.mouthK, dim: sleepy ? 0.94 : 1, lift: y * S, wide: 1 };
  }
}

export const IDENTITY = ID;
