// 공부 먼저 (2026-10-28 사용자 요청): 오늘 공부 분량을 채워야 꾸미기·집 짓기처럼 '공부가 아닌' 화면이 열린다.
//  · 분량은 부모 설정에서 고른다: 끄기 / 학습량 / 시간. 한글(h)과 수학·맞춤법(m)이 따로다.
//  · 저장: 기존 settings 주머니 안의 선택 칸 gate 하나. State 구조·shared/merge.js·저장 키는 그대로이고,
//    두 기기 연동은 settings와 함께(settingsT 나중에 바꾼 쪽) 따라간다. 칸이 없으면(예전 저장 데이터) 아래 기본값.
//  · 새 기록을 만들지 않는다 — 이미 세고 있는 값만 본다:
//      한글   시간: 오늘 앱 사용 시간(todayMs) / 학습량: 오늘 끝낸 새 단계(todayLessons ≥ 하루 새 단계)
//      수학   시간: 오늘 공부 시간(todayMath.ms) / 학습량: 오늘 맞힌 문제(todayMath.correct)
//  · 잠그는 곳은 GATE_SCREENS뿐. 공부 화면(모험·놀이·문제·맞춤법)과 처음 화면·부모 설정·잠자기는 잠그지 않는다.
//  · 막힌 날이 없게: 끄기 · 부모의 '오늘은 바로 열어 주기' · 체험 모드(App에서 건너뜀) · 모험을 다 끝낸 한글.
import { load, setSettings, today, todayMs, todayLessons, curLesson, type State } from '../engine/store';
import { LESSONS } from '../data/curriculum';
import { todayMath } from '../math/mathStore';

export type GateKind = 'h' | 'm';            // h: 한글 / m: 수학·맞춤법
export type GateMode = 'off' | 'time' | 'amount';
export interface GateCfg { mode?: GateMode; min?: number; n?: number; free?: number }   // free: 이 날(today())은 분량 없이 바로 열어 줌
export interface GateStored { h?: GateCfg; m?: GateCfg }

// settings 주머니에 선택 칸 하나만 더한다 (store.ts의 State 구조는 그대로)
declare module '../engine/store' {
  interface Settings { gate?: GateStored }
}

/** 기본값: 한글은 오늘의 새 단계를 끝내면 / 수학·맞춤법은 문제를 10분 풀면 열림 (부모 설정에서 바꿈) */
export const GATE_DEFAULT: Record<GateKind, { mode: GateMode; min: number; n: number }> = {
  h: { mode: 'amount', min: 15, n: 1 },
  m: { mode: 'time', min: 10, n: 10 },
};
/** 시간으로 정할 때 고를 수 있는 분 */
export const GATE_MIN_CHOICES: Record<GateKind, readonly number[]> = { h: [10, 15, 20, 30, 45], m: [10, 15, 20, 30] };
/** 수학·맞춤법 학습량으로 정할 때 고를 수 있는 '맞힌 문제' 수 */
export const GATE_N_CHOICES: readonly number[] = [10, 20, 30, 50];
export const GATE_MODE_LABEL: Record<GateMode, string> = { off: '끄기', amount: '학습량', time: '시간' };
export const GATE_KIND_LABEL: Record<GateKind, string> = { h: '한글', m: '수학·맞춤법' };

/** 잠그는 화면 (공부 화면은 없음) — 한글: 스티커북·우리 집·옷장·친구 고르기·집 짓기·집 안·놀이터·마당 / 수학: 옷장·집 짓기·집 안·놀이터·마당·간식 주기 */
export const GATE_SCREENS: Readonly<Record<string, GateKind>> = {
  book: 'h', house: 'h', dress: 'h', adopt: 'h', build: 'h', room: 'h', park: 'h', yard: 'h',
  mathCloset: 'm', mathBuild: 'm', mathRoom: 'm', mathPark: 'm', mathYard: 'm', mathFeed: 'm',
};
/** 잠겼을 때 돌아갈 곳 */
export const GATE_HOME: Record<GateKind, 'map' | 'math'> = { h: 'map', m: 'math' };

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'number' && isFinite(v) ? Math.round(v) : NaN;
  return n >= lo && n <= hi ? n : d;
};
/** 저장된 gate 칸 (연동·백업에서 망가진 값이 와도 객체만 받음) */
const stored = (s: State): GateStored => {
  const g = (s.settings as { gate?: unknown }).gate;
  return g && typeof g === 'object' ? (g as GateStored) : {};
};

const cfgOf = (kind: GateKind, s: State): GateCfg => { const c = stored(s)[kind]; return c && typeof c === 'object' ? c : {}; };

/** 지금 적용되는 규칙 — 없거나 이상한 값은 기본값으로 */
export function gateRule(kind: GateKind, s: State = load()): { mode: GateMode; min: number; n: number } {
  const d = GATE_DEFAULT[kind];
  const o = cfgOf(kind, s);
  const mode: GateMode = o.mode === 'off' || o.mode === 'time' || o.mode === 'amount' ? o.mode : d.mode;
  return { mode, min: int(o.min, 1, 180, d.min), n: int(o.n, 1, 500, d.n) };
}

export interface GateStatus {
  kind: GateKind; mode: GateMode;
  open: boolean;                          // 지금 열려 있나 (꺼짐 · 오늘 열어 줌 · 분량 채움)
  met: boolean;                           // 분량을 채웠나 (꺼짐이면 true)
  free: boolean;                          // 부모가 오늘 바로 열어 준 상태
  unit: 'min' | 'lesson' | 'problem';
  have: number; need: number;             // 화면에 보일 값 (시간은 분)
  pct: number;                            // 0~100
}

/** 오늘 분량을 얼마나 채웠나 / 지금 열려 있나 */
export function gateStatus(kind: GateKind, s: State = load()): GateStatus {
  const r = gateRule(kind, s);
  let unit: GateStatus['unit'] = 'min', have = 0, need = 0, frac = 1, done = true;
  if (r.mode === 'time') {
    const ms = kind === 'h' ? todayMs(s) : todayMath(s.math).ms;
    need = r.min; have = Math.min(need, Math.floor(ms / 60000)); frac = ms / (need * 60000); done = ms >= need * 60000;
  } else if (r.mode === 'amount') {
    if (kind === 'h') {
      // 한글 학습량 = 오늘의 새 단계 (부모 설정의 '하루 새 단계'와 같은 수). 모험을 다 끝냈으면 더 할 새 단계가 없으니 연다
      unit = 'lesson'; need = Math.max(1, s.settings.newPerDay || 1);
      const n = todayLessons(s);
      have = Math.min(need, n); frac = n / need; done = n >= need || curLesson(s) >= LESSONS.length;
    } else {
      // 수학·맞춤법 학습량 = 오늘 맞힌 문제 (아무거나 눌러서 채우지 못하게 푼 문제가 아니라 맞힌 문제)
      unit = 'problem'; need = r.n;
      const c = todayMath(s.math).correct;
      have = Math.min(need, c); frac = c / need; done = c >= need;
    }
  }
  const free = cfgOf(kind, s).free === today();
  const met = r.mode === 'off' || done;
  return { kind, mode: r.mode, open: met || free, met, free, unit, have, need, pct: met ? 100 : Math.max(0, Math.min(99, Math.floor(frac * 100))) };
}

// 체험 모드·시험용 주소(?screen= 등)에서는 잠그지 않는다 (App이 정함 — 부모가 눌러 보거나 화면을 확인할 때 막히지 않게)
let bypass = false;
export function setGateBypass(on: boolean) { bypass = on; }
export const gateBypassed = () => bypass;

/** 그 종류가 지금 잠겨 있나 (화면의 🔒 표시용) */
export function gateLocked(kind: GateKind, s: State = load()): boolean { return !bypass && !gateStatus(kind, s).open; }

/** 그 화면이 지금 잠겨 있으면 상태를, 열려 있거나 잠그는 화면이 아니면 null */
export function gateBlock(screen: string, s: State = load()): GateStatus | null {
  if (bypass || !Object.prototype.hasOwnProperty.call(GATE_SCREENS, screen)) return null;
  const st = gateStatus(GATE_SCREENS[screen], s);
  return st.open ? null : st;
}

/** 열리려면: '8분 더 공부하면' · '오늘의 모험을 마치면' · '문제를 4개 더 맞히면' */
export function gateNeedText(st: GateStatus, s: State = load()): string {
  if (st.mode === 'time') {
    const ms = st.kind === 'h' ? todayMs(s) : todayMath(s.math).ms;
    return `${Math.max(1, Math.ceil((st.need * 60000 - ms) / 60000))}분 더 공부하면`;
  }
  if (st.unit === 'lesson') return st.need - st.have > 1 ? `오늘의 모험을 ${st.need - st.have}개 더 마치면` : '오늘의 모험을 마치면';
  return `문제를 ${Math.max(1, st.need - st.have)}개 더 맞히면`;
}
/** 진행 이름표: '오늘 공부' · '오늘의 모험' · '맞힌 문제' */
export const gateLabel = (st: GateStatus) => (st.unit === 'min' ? '오늘 공부' : st.unit === 'lesson' ? '오늘의 모험' : '맞힌 문제');
/** 진행을 글로: '7/15분' · '0/1개' · '4/10개' */
export const gateProgressText = (st: GateStatus) => `${st.have}/${st.need}${st.unit === 'min' ? '분' : '개'}`;

// ---------- 부모 설정 쓰기 (settings.gate 한 칸만 바꿈 — 나머지 설정은 그대로) ----------
function put(mut: (g: GateStored) => void) {
  const cur = stored(load());
  const g: GateStored = { ...cur };
  if (cur.h) g.h = { ...cur.h };
  if (cur.m) g.m = { ...cur.m };
  mut(g);
  setSettings({ gate: g });
}
export function setGate(kind: GateKind, p: Pick<GateCfg, 'mode' | 'min' | 'n'>) { put(g => { g[kind] = { ...(g[kind] || {}), ...p }; }); }
/** 오늘 하루만 분량을 안 채워도 열어 주기 (내일은 다시 분량을 채워야 함) */
export function openGateToday(kind: GateKind) { put(g => { g[kind] = { ...(g[kind] || {}), free: today() }; }); }
export function closeGateToday(kind: GateKind) { put(g => { const c = { ...(g[kind] || {}) }; delete c.free; g[kind] = c; }); }

// ---------- 열린 순간 알아채기 (축하용 — 저장하지 않고 이 실행 안에서만) ----------
interface Seen { day: number; mode: GateMode; met: boolean; open: boolean }
const seen: Partial<Record<GateKind, Seen>> = {};
const pending: Partial<Record<GateKind, boolean>> = {};
const KINDS: readonly GateKind[] = ['h', 'm'];

/** 닫혀 있던 문이 분량을 채워서 열린 순간을 알아 둔다(축하용). 같은 날·같은 방식으로 지켜보던 중에 분량이 차야만 —
 *  부모가 끄거나 바꾼 것 · 오늘 열어 준 것 · 앱을 켰을 때 이미 열려 있던 것은 축하하지 않는다.
 *  App이 1초마다 부르고, 열림·닫힘이 바뀌었으면 true (화면을 다시 그리라는 뜻) */
export function gateWatch(s: State = load()): boolean {
  let changed = false;
  const t = today();
  for (const k of KINDS) {
    const st = gateStatus(k, s);
    const p = seen[k];
    if (p && p.day !== t) pending[k] = false;
    if (p && p.day === t && p.mode === st.mode && !p.met && st.met && st.mode !== 'off' && !st.free) pending[k] = true;
    if (p && p.open !== st.open) changed = true;
    seen[k] = { day: t, mode: st.mode, met: st.met, open: st.open };
  }
  return changed;
}
/** 축하할 것이 있나 (한 번만 true — 가져가면 지움) */
export function takeGateOpened(kind: GateKind): boolean { gateWatch(); const v = !!pending[kind]; pending[kind] = false; return v && !bypass; }
/** 축하할 것이 있나 (지우지 않고 보기만) */
export function peekGateOpened(kind: GateKind): boolean { gateWatch(); return !!pending[kind] && !bypass; }
/** 시험용: 지켜본 기록 지우기 */
export function resetGateWatch() { for (const k of KINDS) { delete seen[k]; delete pending[k]; } }
