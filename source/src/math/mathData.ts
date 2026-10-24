// 수학 모드 (초등 2학년 아이용 — 한글 모드와 따로): 저장 모양·항목·단계·문제 만들기
// 저장은 한글 진도(State)의 'math' 한 칸에만 (10-23 사용자 허락). 두 기기 합치기는 shared/merge.js mergeMath.
// 아이 이름은 저장소에 쓰지 않는다 — 부모 설정에서 넣은 이름(math.name)을 실행할 때만 읽어 보여 준다.
// 이 파일은 store.ts를 부르지 않는다 (store.ts가 이 파일의 normalizeMath를 쓰므로 서로 부르면 꼬임).
import { ITEM, PET, BUILD, SNACK, type Slot } from '../data/pets';
import { FURN_BY } from '../data/home';

type DevMap = Record<string, number>;
type DayMap = Record<string, DevMap>;
export type Cat = 'add' | 'sub' | 'mul' | 'div';
export type Mode = Cat | 'mix';

export interface MathState {
  level: number; levelT: number;          // (예전) 12단계 한 줄 — 항목별 단계(lv)로 옮기기 전 기록. 새 코드는 lv를 씀
  perDay: number; perDayT: number;        // (예전) 하루 문제 수 — 10-24부터 하루 공부 시간(dayMin)으로 바꿈. 칸은 예전 기록·기기와 맞추려고 남김
  solved: DayMap; correct: DayMap;        // 날짜 → 기기 → 푼 문제 수 / 맞힌 수 (모든 항목 합계)
  total: DevMap;                          // 기기 → 지금까지 맞힌 수 (10개마다 꾸미기, 5개마다 재료)
  owned: string[];                        // 수학 옷장 (동생 옷장과 따로, 돌려받기 없음)
  wear: Record<string, Partial<Record<Slot, string>>>; wearT: Record<string, number>;
  lastItem?: string; lastItemT?: number;
  pet?: string; petT?: number;            // 옷장에서 마지막에 고른 친구
  // ---- 10-23 2차: 항목별 단계 · 문제 시간 · 이름 · 집 짓기·꾸미기 (한글 집과 따로) ----
  lv: Record<Cat, number>; lvT: Record<string, number>;   // 항목 → 지금 단계 (항목마다 나중에 바꾼 쪽)
  solvedC: DayMap; correctC: DayMap;      // '날짜:항목' → 기기 → 푼 수 / 맞힌 수
  timeMul: number; timeMulT: number;      // 문제 시간 배율 (1 보통 · 1.5 넉넉하게 · 0.75 짧게 · 0 끄기)
  name: string; nameT: number;            // 화면에 보일 이름 (부모 설정 → 기기 저장값에만, 저장소에는 없음)
  dog?: string; cat?: string; petsT?: number;   // 수학 집에 사는 강아지·고양이
  built: DayMap;                          // 짓기 id → 기기 → 지은 부분 수
  bought: Record<string, number>;         // 산 가구·놀이 기구 → 시각 (재료 1개씩)
  deco: Record<string, Record<string, string>>; decoT: Record<string, number>;   // 장소 → 자리 → 놓은 가구
  // ---- 10-24 3차: 문제 수 대신 하루 공부 시간 ----
  dayMin: number; dayMinT: number;        // 하루 공부 시간(분, 부모 설정 30분·1시간)
  ms: DayMap;                             // 날짜 → 기기 → 문제 화면에서 공부한 시간(ms)
  // ---- 10-24 4차: 수학 간식 (한글 간식과 따로) ----
  snacks: DayMap;                         // 간식 id → 기기 → 받은 개수 (정답 5개마다 하나)
  eaten: DayMap;                          // 간식 id → 기기 → 먹인 개수
  fed: DayMap;                            // 친구 id → 기기 → 간식을 먹은 횟수 (하트)
}

export const PER_DAY = 50;                // (예전) 하루 문제 수 기본값 — perDay 칸 읽기용으로만 남김
export const DAY_MIN = 30;                // 하루 공부 시간 기본 30분 (10-24 사용자 요청)
export const DAY_MIN_CHOICES = [30, 60];  // 부모 설정: 30분 · 1시간
export const CAT_MAX = 150;               // 한 항목(덧셈·뺄셈·곱셈·나눗셈)은 하루 150문제까지 (10-24 사용자 요청)
export const IDLE_MS = 180000;            // 3분 넘게 안 만지면 공부 시간을 안 셈 (한글 사용 시간과 같은 기준)
export const ITEM_EVERY = 10;             // 정답 10개마다 꾸미기 하나
export const MAT_EVERY = 5;               // 정답 5개마다 집 짓기·꾸미기 재료 하나
export const SNACK_EVERY = 5;             // 정답 5개마다 간식 하나 (10-24 사용자 요청 — 수학 강아지·고양이에게 먹이기)
export const PASS_RATE = 0.9;             // 그날 그 항목 문제의 90% 이상 맞히면 그 항목 다음 단계
export const UP_MIN = 20;                 // 그 항목을 그날 이만큼은 풀어야 다음 단계 판정
export const TIME_CHOICES: [number, string][] = [[1.5, '넉넉하게'], [1, '보통'], [0.75, '짧게'], [0, '끄기']];
const PLACES = ['doghouse', 'cathouse', 'park', 'doghouse-out', 'cathouse-out'];

// ---------------- 항목 ----------------
export interface CatDef { id: Cat; name: string; icon: string; stages: number[] }
/** 항목마다 단계(아래 STAGES 번호) — 쉬운 것부터 */
export const CATS: CatDef[] = [
  { id: 'add', name: '덧셈', icon: '➕', stages: [0, 1, 4] },
  { id: 'sub', name: '뺄셈', icon: '➖', stages: [2, 3, 5] },
  { id: 'mul', name: '곱셈', icon: '✖️', stages: [6, 7, 8, 9] },
  { id: 'div', name: '나눗셈', icon: '➗', stages: [10, 11] },
];
export const CAT: Record<Cat, CatDef> = Object.fromEntries(CATS.map(c => [c.id, c])) as any;
const isCat = (x: any): x is Cat => typeof x === 'string' && !!(CAT as any)[x];
/** 예전 12단계 한 줄의 위치 → 항목마다 단계 (그 앞 단계는 끝낸 것으로) */
export function lvFromLevel(level: number): Record<Cat, number> {
  const o = {} as Record<Cat, number>;
  for (const c of CATS) o[c.id] = Math.min(c.stages.length - 1, c.stages.filter(st => st < level).length);
  return o;
}

export function freshMath(): MathState {
  return {
    level: 0, levelT: 0, perDay: PER_DAY, perDayT: 0, solved: {}, correct: {}, total: {}, owned: [], wear: {}, wearT: {},
    lv: lvFromLevel(0), lvT: {}, solvedC: {}, correctC: {}, timeMul: 1, timeMulT: 0, name: '', nameT: 0,
    built: {}, bought: {}, deco: {}, decoT: {}, dayMin: DAY_MIN, dayMinT: 0, ms: {}, snacks: {}, eaten: {}, fed: {},
  };
}

const isNum = (x: any) => typeof x === 'number' && isFinite(x);
const obj = (x: any) => !!x && typeof x === 'object' && !Array.isArray(x);
const devMap = (m: any): DevMap => {
  const o: DevMap = {};
  if (obj(m)) for (const k of Object.keys(m)) if (isNum(m[k]) && m[k] >= 0) o[k] = Math.floor(m[k]);
  return o;
};
const dayMap = (m: any, ok: (k: string) => boolean = k => /^\d+$/.test(k)): DayMap => {
  const o: DayMap = {};
  if (obj(m)) for (const k of Object.keys(m)) if (ok(k)) o[k] = devMap(m[k]);
  return o;
};
const timeMap = (m: any, ok: (k: string) => boolean): Record<string, number> => {
  const o: Record<string, number> = {};
  if (obj(m)) for (const k of Object.keys(m)) if (ok(k) && isNum(m[k]) && m[k] >= 0) o[k] = m[k];
  return o;
};
const dayCatKey = (k: string) => /^\d+:(add|sub|mul|div)$/.test(k);

/** 저장·연동으로 받은 값을 안전하게 (틀린 칸은 버리고 기본값). 수학 칸이 망가져도 한글 진도는 그대로 읽힌다 */
export function normalizeMath(o: any): MathState | undefined {
  if (!obj(o)) return undefined;
  const f = freshMath();
  const level = isNum(o.level) ? Math.max(0, Math.min(STAGES.length - 1, Math.floor(o.level))) : 0;
  const m: MathState = {
    level,
    levelT: isNum(o.levelT) ? o.levelT : 0,
    perDay: isNum(o.perDay) && o.perDay >= 5 && o.perDay <= 200 ? Math.floor(o.perDay) : f.perDay,
    perDayT: isNum(o.perDayT) ? o.perDayT : 0,
    solved: dayMap(o.solved), correct: dayMap(o.correct), total: devMap(o.total),
    owned: Array.isArray(o.owned) ? [...new Set(o.owned.filter((x: any) => typeof x === 'string' && ITEM[x]))].sort() as string[] : [],
    wear: {}, wearT: {},
  } as MathState;
  if (obj(o.wear)) for (const p of Object.keys(o.wear)) {
    const w = o.wear[p];
    if (!PET[p] || !obj(w)) continue;
    const clean: Partial<Record<Slot, string>> = {};
    for (const sl of Object.keys(w)) if (typeof w[sl] === 'string' && ITEM[sl + ':' + w[sl]]) (clean as any)[sl] = w[sl];
    m.wear[p] = clean;
  }
  m.wearT = timeMap(o.wearT, p => !!PET[p]);
  if (typeof o.lastItem === 'string' && ITEM[o.lastItem]) { m.lastItem = o.lastItem; m.lastItemT = isNum(o.lastItemT) ? o.lastItemT : 0; }
  if (typeof o.pet === 'string' && PET[o.pet]) { m.pet = o.pet; m.petT = isNum(o.petT) ? o.petT : 0; }
  // 항목별 단계: 없으면 예전 12단계 위치에서 옮김
  const lv = lvFromLevel(level);
  if (obj(o.lv)) for (const c of CATS) if (isNum(o.lv[c.id])) lv[c.id] = Math.max(0, Math.min(c.stages.length - 1, Math.floor(o.lv[c.id])));
  m.lv = lv;
  m.lvT = timeMap(o.lvT, isCat);
  m.solvedC = dayMap(o.solvedC, dayCatKey); m.correctC = dayMap(o.correctC, dayCatKey);
  m.timeMul = TIME_CHOICES.some(([v]) => v === o.timeMul) ? o.timeMul : 1;
  m.timeMulT = isNum(o.timeMulT) ? o.timeMulT : 0;
  m.name = typeof o.name === 'string' ? o.name.trim().slice(0, 10) : '';
  m.nameT = isNum(o.nameT) ? o.nameT : 0;
  const dog = typeof o.dog === 'string' && PET[o.dog]?.species === 'dog' ? o.dog : undefined;
  const cat = typeof o.cat === 'string' && PET[o.cat]?.species === 'cat' ? o.cat : undefined;
  if (dog || cat || isNum(o.petsT)) { if (dog) m.dog = dog; if (cat) m.cat = cat; m.petsT = isNum(o.petsT) ? o.petsT : 0; }
  m.built = dayMap(o.built, k => !!BUILD[k]);
  m.bought = timeMap(o.bought, k => !!FURN_BY[k]);
  m.deco = {};
  if (obj(o.deco)) for (const pl of Object.keys(o.deco)) {
    if (!PLACES.includes(pl) || !obj(o.deco[pl])) continue;
    const d: Record<string, string> = {};
    for (const sl of Object.keys(o.deco[pl])) if (typeof o.deco[pl][sl] === 'string' && FURN_BY[o.deco[pl][sl]]) d[sl] = o.deco[pl][sl];
    m.deco[pl] = d;
  }
  m.decoT = timeMap(o.decoT, k => PLACES.includes(k));
  // 3차(10-24): 하루 공부 시간 · 공부한 시간 (없으면 30분 · 아직 0)
  m.dayMin = DAY_MIN_CHOICES.includes(o.dayMin) ? o.dayMin : DAY_MIN;
  m.dayMinT = isNum(o.dayMinT) ? o.dayMinT : 0;
  m.ms = dayMap(o.ms);
  // 4차(10-24): 수학 간식 — 모르는 간식·친구는 버림
  m.snacks = dayMap(o.snacks, k => !!SNACK[k]);
  m.eaten = dayMap(o.eaten, k => !!SNACK[k]);
  m.fed = dayMap(o.fed, k => !!PET[k]);
  return m;
}

// ---------------- 단계 ----------------
export interface Problem { q: string; ans: string; opts: string[]; stage: number; cat: Cat; sec: number }
type Ans = number | [number, number];      // [몫, 나머지]
interface Raw { q: string; ans: Ans; wrong: Ans[] }

const R = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const ones = (n: number) => n % 10, tens = (n: number) => Math.floor(n / 10) % 10, hund = (n: number) => Math.floor(n / 100) % 10;
/** 받아올림 없이 각 자리를 더해 붙인 값 (자주 하는 실수: 47+38 → 715) */
const noCarryJoin = (a: number, b: number) => Number(String(Math.floor(a / 10) + Math.floor(b / 10)) + String(ones(a) + ones(b)));
/** 자리마다 큰 수에서 작은 수를 뺀 값 (자주 하는 실수: 52-38 → 26) */
const absDigits = (a: number, b: number) => {
  let r = 0, p = 1;
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10), p *= 10) r += Math.abs(ones(x) - ones(y)) * p;
  return r;
};
const hasCarry = (a: number, b: number) => { for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) + ones(y) >= 10) return true; return false; };
const hasBorrow = (a: number, b: number) => { for (let x = a, y = b; y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) < ones(y)) return true; return false; };

function add2(carry: boolean): Raw {
  let a = 0, b = 0;
  for (let k = 0; k < 50; k++) {
    if (!carry) { const ta = R(1, 8), tb = R(1, 9 - ta), oa = R(0, 9), ob = R(0, 9 - oa); a = ta * 10 + oa; b = tb * 10 + ob; }
    else {
      const oa = R(1, 9), ob = R(10 - oa, 9);
      // 열 개 중 넷은 십의 자리에서도 받아올림 (답이 100이 넘음)
      const both = Math.random() < 0.4;
      const ta = R(1, 8), tb = both ? R(Math.max(1, 9 - ta), 9) : R(1, Math.max(1, 8 - ta));
      a = ta * 10 + oa; b = tb * 10 + ob;
    }
    if (a >= 10 && b >= 10 && hasCarry(a, b) === carry) break;
  }
  const s = a + b;
  return { q: `${a} + ${b}`, ans: s, wrong: [s - 10, s + 10, s + 1, s - 1, noCarryJoin(a, b), s + 2, s - 2] };
}
function sub2(borrow: boolean): Raw {
  let a = 0, b = 0;
  for (let k = 0; k < 50; k++) {
    const ta = R(2, 9), tb = R(1, ta - 1);
    const oa = borrow ? R(0, 8) : R(0, 9);
    const ob = borrow ? R(oa + 1, 9) : R(0, oa);
    a = ta * 10 + oa; b = tb * 10 + ob;
    if (hasBorrow(a, b) === borrow) break;
  }
  const d = a - b;
  return { q: `${a} − ${b}`, ans: d, wrong: [absDigits(a, b), d + 10, d - 10, d + 1, d - 1, d + 2] };
}
function add3(): Raw {
  let a = 0, b = 0;
  for (let k = 0; k < 50; k++) { a = R(100, 899); b = R(100, 999 - a); if (b >= 100 && (hasCarry(a, b) || Math.random() < 0.25)) break; }
  const s = a + b;
  return { q: `${a} + ${b}`, ans: s, wrong: [s - 10, s + 10, s - 100, s + 100, s + 1, s - 1] };
}
function sub3(): Raw {
  let a = 0, b = 0;
  for (let k = 0; k < 50; k++) { a = R(200, 999); b = R(100, a - 1); if (hund(b) > 0 && (hasBorrow(a, b) || Math.random() < 0.25)) break; }
  const d = a - b;
  return { q: `${a} − ${b}`, ans: d, wrong: [absDigits(a, b), d + 10, d - 10, d + 100, d - 100, d + 1, d - 1] };
}
function mulFact(lo: number, hi: number): Raw {
  const x = R(lo, hi), y = R(2, 9);
  const p = x * y;
  return { q: `${x} × ${y}`, ans: p, wrong: [x * (y + 1), x * (y - 1), (x + 1) * y, (x - 1) * y, x + y, p + 1, p - 1] };
}
function mul21(): Raw {
  let a = 0;
  do { a = R(12, 98); } while (ones(a) === 0);
  const b = R(2, 9), p = a * b;
  const carry = Math.floor(ones(a) * b / 10);
  return { q: `${a} × ${b}`, ans: p, wrong: [p - carry * 10, p + 10, p - 10, p + b, p - b, p + 1] };
}
function div(rem: boolean): Raw {
  const d = R(2, 9), qn = R(rem ? 1 : 2, 9);
  if (!rem) {
    const n = d * qn;
    return { q: `${n} ÷ ${d}`, ans: qn, wrong: [qn + 1, qn - 1, qn + 2, qn - 2, d === qn ? qn + 3 : d] };
  }
  const r = R(1, d - 1), n = d * qn + r;
  return { q: `${n} ÷ ${d}`, ans: [qn, r], wrong: [[qn, r + 1], [qn, r - 1], [qn + 1, r], [qn - 1, r + d], [qn - 1, r], [qn + 1, r - 1]] };
}

/** sec: 문제 하나 제한 시간(초, 부모 설정 배율을 곱함) — 2학년이 보기 4개 중에서 고르는 시간을 넉넉히 잡은 값(추정) */
export interface StageDef { name: string; sub: string; sec: number; gen: () => Raw }
export const STAGES: StageDef[] = [
  { name: '두 자리 덧셈', sub: '받아올림 없음', sec: 15, gen: () => add2(false) },
  { name: '두 자리 덧셈', sub: '받아올림', sec: 20, gen: () => add2(true) },
  { name: '두 자리 뺄셈', sub: '받아내림 없음', sec: 15, gen: () => sub2(false) },
  { name: '두 자리 뺄셈', sub: '받아내림', sec: 25, gen: () => sub2(true) },
  { name: '세 자리 덧셈', sub: '받아올림', sec: 30, gen: add3 },
  { name: '세 자리 뺄셈', sub: '받아내림', sec: 35, gen: sub3 },
  { name: '곱셈구구', sub: '2·3·4·5단', sec: 10, gen: () => mulFact(2, 5) },
  { name: '곱셈구구', sub: '6·7·8·9단', sec: 12, gen: () => mulFact(6, 9) },
  { name: '곱셈구구', sub: '2~9단 섞어서', sec: 12, gen: () => mulFact(2, 9) },
  { name: '곱셈', sub: '(두 자리)×(한 자리)', sec: 30, gen: mul21 },
  { name: '나눗셈', sub: '나머지 없음', sec: 15, gen: () => div(false) },
  { name: '나눗셈', sub: '나머지 있음', sec: 25, gen: () => div(true) },
];
export const stageName = (i: number) => { const s = STAGES[Math.max(0, Math.min(STAGES.length - 1, i))]; return `${s.name} (${s.sub})`; };
/** 단계 번호 → 항목 */
export const catOf = (stage: number): Cat => (CATS.find(c => c.stages.includes(stage)) ?? CATS[0]).id;
/** 항목의 n번째 단계 → STAGES 번호 */
export const catStage = (cat: Cat, i: number) => { const st = CAT[cat].stages; return st[Math.max(0, Math.min(st.length - 1, i))]; };
/** 항목의 문제 시간 범위(초, 보통) — 부모 설정 안내용 */
export const catSecRange = (cat: Cat): [number, number] => { const s = CAT[cat].stages.map(st => STAGES[st].sec); return [Math.min(...s), Math.max(...s)]; };

/** 보기 글자: 나머지가 있는 나눗셈은 '몫 … 나머지' */
export const show = (a: Ans) => Array.isArray(a) ? `${a[0]} … ${a[1]}` : String(a);

/** 고른 항목(골고루면 네 항목 중 하나 — open이 있으면 그중에서, 오늘 150문제를 다 푼 항목은 빼려고)의 지금 단계 문제
 *  — 그 항목의 앞 단계가 있으면 다섯 문제 중 하나쯤은 앞 단계 복습 */
export function makeProblemFor(mode: Mode, lv: Record<Cat, number>, review = 0.2, open?: Cat[]): Problem {
  const pool: Cat[] = open && open.length ? open : CATS.map(c => c.id);
  const cat: Cat = mode === 'mix' ? pool[R(0, pool.length - 1)] : mode;
  const stages = CAT[cat].stages;
  const i = Math.max(0, Math.min(stages.length - 1, lv[cat] ?? 0));
  return makeStageProblem(stages[i > 0 && Math.random() < review ? R(0, i - 1) : i]);
}

/** 그 단계 문제 하나, 보기 4개 */
export function makeStageProblem(stage: number): Problem {
  const st = Math.max(0, Math.min(STAGES.length - 1, stage));
  const raw = STAGES[st].gen();
  const ans = show(raw.ans);
  const isDiv = raw.q.includes('÷');
  // 보기에 쓸 수 없는 값: 음수, 나눗셈의 0·0보다 작은 몫, 0 이하 나머지
  const usable = (a: Ans) => Array.isArray(a) ? a[0] >= 1 && a[1] >= 1 : a >= (isDiv ? 1 : 0);
  const seen = new Set([ans]);
  const wrong: string[] = [];
  for (const w of raw.wrong) {
    if (!usable(w)) continue;
    const t = show(w);
    if (seen.has(t)) continue;
    seen.add(t); wrong.push(t);
  }
  // 그럴듯한 오답을 앞쪽에서 셋 (모자라면 가까운 수로 채움)
  const pick = wrong.slice(0, 5).sort(() => Math.random() - 0.5).slice(0, 3);
  for (let k = 3; pick.length < 3; k++) {
    const t = Array.isArray(raw.ans) ? show([raw.ans[0] + k, raw.ans[1]]) : String((raw.ans as number) + k);
    if (!seen.has(t)) { seen.add(t); pick.push(t); }
  }
  const opts = [ans, ...pick].sort(() => Math.random() - 0.5);
  return { q: raw.q, ans, opts, stage: st, cat: catOf(st), sec: STAGES[st].sec };
}
