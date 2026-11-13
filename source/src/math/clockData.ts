// 시계와 시간 (2026-11-13 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이)
// "정답만 맞히는 퀴즈가 아니라, 시곗바늘 이동과 시간의 흐름을 이해시키는 데 집중" — 글은 짧고 쉬운 한국어(사용자 예시 그대로 '-요' 말투)
//  0 시계 바늘 알아보기(짧은 바늘=시 · 긴 바늘=분 · 초침은 심화) → 1 정각 읽기 → 2 30분·15분·45분 읽기 → 3 5분 단위 읽기(잘하면 1분 단위 도전)
//  → 4 시계 직접 맞추기 → 5 60분 이내의 시간 전후 계산 → 6 시간을 넘나드는 전후 계산 → 7 하루·여러 날의 시간 계산
//  · 문제는 그때그때 만든다(은행 없음). 유형(CkKind)마다 기록 열쇠가 하나 — 틀린 유형은 짧게 다시 복습.
//  · 한 판 = 본 문제 10개. 한 번에 맞힌 것이 9개(90%) 이상이면 그 단계 통과, 처음 6문제를 모두 한 번에 맞히면 바로 통과.
//    연속 3번 정답이면 조금 어렵게, 연속 2번 오답이면 조금 쉽게(도움 숫자·쉬운 수) — 난이도 자동 조절.
//  · 오답: 정답을 바로 보여 주지 않고 구체적인 힌트 → 다시 풀기(고르기 2번·돌림판과 맞추기 3번 틀리면 풀이를 보여 줌). 기록은 '한 번에 맞혔나'.
//  · 저장: 새 칸 없음(shared/merge.js 그대로) — 단계는 State.math.lv.ck(나중에 바꾼 쪽), 유형별 상태는 sp['ck:유형'](맞춤법과 같은 상태 규칙),
//    하루 기록은 solvedC·correctC['날짜:ck'·'날짜:ck.유형'], 이 학습에 쓴 시간은 ms['날짜:ck'].
// 이 파일은 spellData.ts(기록 상태 규칙)만 부른다 (mathData.ts가 이 파일의 열쇠 목록을 씀 — 서로 부르면 꼬임).
import { spOf, SP_WRONG, SP_FIX1, SP_RECHECK_MIN } from './spellData';

export type Rnd = () => number;
export type CkKind = 'r0' | 'r30' | 'r15' | 'r45' | 'r5' | 'r1' | 's0' | 's5' | 'a1' | 'b1' | 'a2' | 'b2' | 'd1' | 'd2' | 'd3';

/** 하루 기록 열쇠의 항목 이름 ('날짜:ck') */
export const CK_CAT = 'ck';
/** 단계 수: 0 바늘 알아보기 + 1~7단계. State.math.lv.ck = 통과한 단계 수(0~8, 8이면 모두 통과) */
export const CK_MAX = 8;
export const CK_ROUND = 10;      // 한 판의 본 문제 수
export const CK_PASS = 9;        // 한 번에 맞힌 본 문제가 이만큼이면 통과 (90%)
export const CK_FAST = 6;        // 처음부터 이만큼을 모두 한 번에 맞히면 바로 통과
export const CK_BONUS_MAX = 3;   // 한 판의 도전 문제(1분 단위 등)는 여기까지
export const CK_AGAIN_MAX = 3;   // 한 판에서 '다시 한 번'은 여기까지

export interface CkStepDef { step: number; icon: string; name: string; short: string; goal: string; learned: string }
/** 단계 (이름은 사용자 원문 그대로) — learned: 그 단계를 한 뒤 보여 주는 '오늘 배운 것' 한 문장 */
export const CK_STEPS: CkStepDef[] = [
  { step: 0, icon: '🕰️', name: '시계 바늘 알아보기', short: '바늘 알아보기', goal: '짧은 바늘·긴 바늘·초침', learned: "짧은 바늘은 '시', 긴 바늘은 '분'을 알려줘요." },
  { step: 1, icon: '🕐', name: '정각 읽기', short: '정각 읽기', goal: '몇 시일까요?', learned: "긴 바늘이 12를 가리키면 '정각', 짧은 바늘이 가리키는 숫자가 '시'예요." },
  { step: 2, icon: '🕞', name: '30분, 15분, 45분 읽기', short: '30·15·45분', goal: '긴 바늘이 6·3·9일 때', learned: '긴 바늘이 3이면 15분, 6이면 30분, 9면 45분이에요.' },
  { step: 3, icon: '🕔', name: '5분 단위 읽기', short: '5분 단위 읽기', goal: '숫자 × 5 = 분', learned: "긴 바늘이 가리키는 숫자에 5를 곱하면 '분'이에요." },
  { step: 4, icon: '👆', name: '시계 직접 맞추기', short: '시계 맞추기', goal: '바늘을 끌어서 맞추기', learned: '긴 바늘이 움직이면 짧은 바늘도 조금씩 따라가요. 30분이면 두 숫자의 한가운데!' },
  { step: 5, icon: '➡️', name: '60분 이내의 시간 전후 계산', short: '몇 분 후·전', goal: '같은 시 안에서', learned: "'후'는 시계 방향으로, '전'은 시계 반대 방향으로 긴 바늘이 움직여요." },
  { step: 6, icon: '🔄', name: '시간을 넘나드는 전후 계산', short: '시를 넘어서', goal: '60분이 넘으면 다음 시', learned: "60분이 되면 1시간! 긴 바늘이 12를 지나면 '시'가 바뀌어요." },
  { step: 7, icon: '🌞', name: '하루·여러 날의 시간 계산', short: '하루와 여러 날', goal: '하루는 24시간', learned: '하루는 24시간! 여러 날은 24를 그 날 수만큼 더하면(곱하면) 돼요.' },
];
/** 모두 통과한 뒤의 '골고루 복습' 한 판을 한 뒤 보여 주는 한 문장 */
export const CK_MIX_LEARNED = '시계를 읽고, 맞추고, 시간을 계산하는 방법을 골고루 연습했어요.';
export const CK_REVIEW_LEARNED = '틀렸던 문제를 힌트를 보고 다시 풀면 내 것이 돼요.';

export interface CkKindDef { id: CkKind; step: number; name: string; bonus?: boolean }
/** 유형 (부모 화면의 '어려워하는 유형' 이름) */
export const CK_KINDS: CkKindDef[] = [
  { id: 'r0', step: 1, name: '정각 읽기' },
  { id: 'r30', step: 2, name: '30분 읽기' },
  { id: 'r15', step: 2, name: '15분 읽기' },
  { id: 'r45', step: 2, name: '45분 읽기' },
  { id: 'r5', step: 3, name: '5분 단위 읽기' },
  { id: 'r1', step: 3, name: '1분 단위 읽기(도전)', bonus: true },
  { id: 's0', step: 4, name: '정각·30분 맞추기' },
  { id: 's5', step: 4, name: '5분 단위 맞추기' },
  { id: 'a1', step: 5, name: '몇 분 후(같은 시 안)' },
  { id: 'b1', step: 5, name: '몇 분 전(같은 시 안)' },
  { id: 'a2', step: 6, name: '몇 분 후(시가 바뀜)' },
  { id: 'b2', step: 6, name: '몇 분 전(시가 바뀜)' },
  { id: 'd1', step: 7, name: '하루는 24시간' },
  { id: 'd2', step: 7, name: '여러 날은 몇 시간' },
  { id: 'd3', step: 7, name: '며칠과 몇 시간' },
];
export const CK_KIND: Record<CkKind, CkKindDef> = Object.fromEntries(CK_KINDS.map(k => [k.id, k])) as Record<CkKind, CkKindDef>;
export const isCkKind = (x: unknown): x is CkKind => typeof x === 'string' && Object.prototype.hasOwnProperty.call(CK_KIND, x);
/** 유형별 기록 열쇠 (State.math.sp — 맞춤법 '문장id.번호', 빈칸 추리 'bk숫자'와 겹치지 않게 ':') */
export const ckKey = (kind: CkKind) => 'ck:' + kind;
export const CK_KEY_SET = new Set(CK_KINDS.map(k => ckKey(k.id)));
/** 하루 기록 열쇠의 뒷부분: '날짜:ck'(이 학습 전체) · '날짜:ck.유형' */
export const ckDaySuffix = (kind?: CkKind) => (kind ? `${CK_CAT}.${kind}` : CK_CAT);
export const CK_DAY_SUFFIX = new Set([CK_CAT, ...CK_KINDS.map(k => ckDaySuffix(k.id))]);

// ---------------- 시각 (분으로 셈: 0 = 밤 12시, 720 = 낮 12시) ----------------
export const mod = (a: number, n: number) => ((a % n) + n) % n;
/** 시계 숫자판의 '시' (1~12) */
export const H12 = (t: number) => { const h = Math.floor(mod(Math.round(t), 720) / 60); return h === 0 ? 12 : h; };
export const MIN = (t: number) => mod(Math.round(t), 60);
/** '3시 25분' · 정각은 '3시' */
export const hm = (t: number) => (MIN(t) ? `${H12(t)}시 ${MIN(t)}분` : `${H12(t)}시`);
export const ampmOf = (t: number) => (mod(Math.round(t), 1440) < 720 ? '오전' : '오후');
/** '오후 3시 25분' */
export const hmAP = (t: number) => `${ampmOf(t)} ${hm(t)}`;
/** 24시간 표기 '15:25' */
export const h24 = (t: number) => `${Math.floor(mod(Math.round(t), 1440) / 60)}:${String(MIN(t)).padStart(2, '0')}`;
/** 바늘 각도(도, 12시 방향이 0, 시계 방향) — 짧은 바늘은 1분에 0.5도씩 따라 움직인다 */
export const minuteAngle = (t: number) => mod(t, 60) * 6;
export const hourAngle = (t: number) => mod(t, 720) * 0.5;

// ---------------- 조사 (숫자를 한자말로 읽을 때의 받침) ----------------
const hasB = (n: number) => [0, 1, 3, 6, 7, 8].includes(Math.abs(Math.round(n)) % 10);
export const nEul = (n: number) => `${n}${hasB(n) ? '을' : '를'}`;
export const nGwa = (n: number) => `${n}${hasB(n) ? '과' : '와'}`;
export const nEun = (n: number) => `${n}${hasB(n) ? '은' : '는'}`;
/** '25로' · '30으로' (ㄹ 받침인 1·7·8은 '로') */
export const nRo = (n: number) => `${n}${hasB(n) && ![1, 7, 8].includes(Math.abs(Math.round(n)) % 10) ? '으로' : '로'}`;
/** 화면 글 → 읽어 줄 말 (기호를 말로, 그림 글자는 뺌) */
export function speakable(text: string): string {
  return text
    .replace(/(\d+)\s*=\s*\?/g, (_x, a) => `${nEun(+a)} 얼마일까요`)
    .replace(/(\d+)\s*=\s*/g, (_x, a) => `${nEun(+a)} `)
    .replace(/\s*×\s*/g, ' 곱하기 ').replace(/\s*÷\s*/g, ' 나누기 ').replace(/\s*\+\s*/g, ' 더하기 ').replace(/\s*[−-]\s*(?=\d)/g, ' 빼기 ')
    .replace(/(\d+):(\d\d)/g, (_x, a, b) => `${+a}시 ${+b}분`)
    .replace(/[→·…=]/g, ', ').replace(/['"()]/g, ' ')
    .replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu, ' ')
    .replace(/\s+/g, ' ').replace(/\s+([,.?!])/g, '$1').trim();
}

const ri = (rnd: Rnd, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pickOf = <T,>(rnd: Rnd, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
function shuffled<T>(rnd: Rnd, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------------- 문제 ----------------
/** 보기: h·m은 시간 읽기 보기의 시·분(힌트 고르기용), why는 그 오답이 왜 아닌지 (비어 있으면 그 문제의 다음 걸음 힌트를 대신 보여 줌) */
export interface CkOpt { label: string; ok: boolean; h?: number; m?: number; why?: string }
interface Base { kind: CkKind; step: number; tier: number; q: string; bonus?: boolean }
/** 시간 읽기: mode pick = 보기 넷 / wheel = 시·분 돌림판 */
export interface ReadTask extends Base { type: 'read'; t: number; mode: 'pick' | 'wheel'; minStep: 5 | 1; opts: CkOpt[]; ring: boolean }
/** 시계 맞추기: target(0~1439)으로, 시계는 start에서 시작 */
export interface SetTask extends Base { type: 'set'; target: number; start: number; snap: 5 | 1; ring: boolean }
/** 몇 분 후·전: delta > 0 후, < 0 전 · cross = 시가 바뀜 · ampm = 오전/오후가 붙은 문제 */
export interface ShiftTask extends Base { type: 'shift'; start: number; delta: number; end: number; ampm: boolean; cross: boolean; opts: CkOpt[] }
export type DayForm = 'day' | 'turns' | 'days' | 'mix' | 'toDays' | 'toMix';
/** 하루와 여러 날: n일 h시간 = total시간 · eq = 처음부터 덧셈식을 보여 줌(쉬운 판) */
export interface DayTask extends Base { type: 'day'; form: DayForm; n: number; h: number; total: number; opts: CkOpt[]; eq: boolean }
export type CkTask = ReadTask | SetTask | ShiftTask | DayTask;

/** 같은 문제가 한 판에 두 번 나오지 않게 */
export function taskSig(k: CkTask): string {
  if (k.type === 'read') return `r:${mod(k.t, 720)}`;
  if (k.type === 'set') return `s:${mod(k.target, 720)}`;
  if (k.type === 'shift') return `x:${mod(k.start, 720)}:${k.delta}`;
  return `d:${k.form}:${k.n}:${k.h}`;
}
/** 문제의 정답을 글로 (부모 화면·풀이) */
export function taskAnswer(k: CkTask): string {
  if (k.type === 'read') return hm(k.t);
  if (k.type === 'set') return hmAP(k.target);
  return k.opts.find(o => o.ok)!.label;
}

const readOpt = (h: number, m: number, ok = false): CkOpt => ({ label: m ? `${h}시 ${m}분` : `${h}시`, ok, h, m });
const nextH = (h: number) => (h % 12) + 1;
const prevH = (h: number) => ((h + 10) % 12) + 1;

export function makeRead(kind: CkKind, tier: number, rnd: Rnd = Math.random): ReadTask {
  const h = ri(rnd, 1, 12);
  let m = 0;
  if (kind === 'r30') m = 30;
  else if (kind === 'r15') m = 15;
  else if (kind === 'r45') m = 45;
  else if (kind === 'r5') m = pickOf(rnd, tier >= 2 ? [35, 40, 50, 55, 5, 10, 20, 25, 35, 40, 50, 55] : [5, 10, 20, 25, 35, 40, 50, 55, 15, 30, 45]);
  else if (kind === 'r1') { do { m = ri(rnd, 1, 59); } while (m % 5 === 0); }
  const t = (h % 12) * 60 + m;
  const wheel = kind === 'r5' || kind === 'r1';
  const opts: CkOpt[] = [];
  if (!wheel) {
    const cands: CkOpt[] = [];
    if (m === 0) {
      // 정각: 긴 바늘의 12를 읽는 실수 · 옆 숫자
      if (h !== 12) cands.push(readOpt(12, 0));
      cands.push(readOpt(nextH(h), 0), readOpt(prevH(h), 0));
      for (const x of shuffled(rnd, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])) cands.push(readOpt(x, 0));
    } else {
      const n = m / 5;
      const first = [
        readOpt(nextH(h), m),                               // 짧은 바늘이 다음 숫자에 가까워서 다음 시로 읽음
        readOpt(h, n),                                      // 긴 바늘의 숫자를 그대로 분으로 읽음 (6 → 6분)
        readOpt(n, (h % 12) * 5),                           // 두 바늘을 바꿔 읽음
        m === 30 ? readOpt(h, 0) : readOpt(h, 60 - m),      // 15분 ↔ 45분
      ];
      cands.push(...shuffled(rnd, first), readOpt(prevH(h), m), readOpt(nextH(h), m === 30 ? 15 : 30), readOpt(prevH(h), m === 30 ? 45 : 30));
    }
    opts.push(readOpt(h, m, true));
    for (const c of cands) if (opts.length < 4 && !opts.some(o => o.label === c.label)) opts.push(c);
  }
  return {
    type: 'read', kind, step: CK_KIND[kind].step, tier, t, mode: wheel ? 'wheel' : 'pick', minStep: kind === 'r1' ? 1 : 5,
    opts: shuffled(rnd, opts), ring: tier <= 0 && m !== 0, bonus: kind === 'r1',
    q: kind === 'r0' ? '몇 시일까요?' : '몇 시 몇 분일까요?',
  };
}

/** 시간 읽기 채점 */
export const readJudge = (k: ReadTask, h: number, m: number) => h === H12(k.t) && m === MIN(k.t);

export interface Hint { text: string; glow: 'h' | 'm' | 'both' | null; ring: boolean }
function minHintText(M: number, strong: boolean): string {
  if (M === 0) return "긴 바늘이 12를 가리켜요. 12에 딱 맞으면 '정각'이에요.";
  const n = Math.floor(M / 5), k = M % 5;
  if (k === 0) return strong ? '숫자 하나에 5분씩이에요. 바깥의 파란 숫자를 보고 긴 바늘이 가리키는 곳을 읽어 보세요.' : `긴 바늘이 ${nEul(n)} 가리켜요. ${n} × 5는 몇 분일까요?`;
  if (n === 0) return `긴 바늘이 12에서 작은 눈금 ${k}칸을 갔어요. 작은 눈금 한 칸은 1분이에요.`;
  return `긴 바늘이 ${nEul(n)} 지나 작은 눈금 ${k}칸을 더 갔어요. ${n} × 5에 ${nEul(k)} 더하면 몇 분일까요?`;
}
function hourHintText(H: number, M: number): string {
  if (M === 0) return "짧은 바늘이 가리키는 숫자를 읽어 보세요. 그 숫자가 '시'예요.";
  const nx = nextH(H);
  return M >= 40 ? `짧은 바늘이 ${nGwa(H)} ${nx} 사이에 있어요. ${nx}에 가까워도 아직 ${nx}시가 안 됐어요. 지나온 숫자가 '시'예요.`
    : `짧은 바늘이 ${nGwa(H)} ${nx} 사이에 있어요. 지나온 숫자가 '시'예요.`;
}
const SWAP_READ = "짧은 바늘이 '시', 긴 바늘이 '분'이에요. 짧은 바늘부터 다시 읽어 볼까요?";
/** 시간 읽기 오답 힌트 (nth: 이 문제에서 몇 번째 오답인가, 1부터) — 정답을 말하지 않고 틀린 쪽(시·분)을 다시 보게 한다 */
export function readHint(k: ReadTask, h: number, m: number, nth: number): Hint {
  const H = H12(k.t), M = MIN(k.t);
  const hourOk = h === H, minOk = m === M;
  const strong = nth >= 2;
  const ring = M !== 0 && (strong || k.ring);
  // 두 바늘을 바꿔 읽음: 고른 '시'가 긴 바늘의 숫자, 고른 '분'이 짧은 바늘의 숫자 × 5
  if (!hourOk && !minOk && M > 0 && h % 12 === Math.floor(M / 5) % 12 && m === (H % 12) * 5) return { text: SWAP_READ, glow: 'both', ring };
  if (hourOk && !minOk) return { text: minHintText(M, strong), glow: 'm', ring };
  if (!hourOk && minOk) return { text: hourHintText(H, M), glow: 'h', ring };
  // 둘 다 틀림: 먼저 분(긴 바늘), 그다음 시(짧은 바늘)
  return nth % 2 === 1 && M !== 0 ? { text: minHintText(M, false), glow: 'm', ring } : { text: hourHintText(H, M), glow: 'h', ring };
}
/** 시간 읽기 풀이 */
export function readExplain(k: ReadTask): string {
  const H = H12(k.t), M = MIN(k.t), n = Math.floor(M / 5), r = M % 5;
  if (M === 0) return `긴 바늘이 12 → 정각 · 짧은 바늘이 ${H} → ${H}시`;
  const hour = `짧은 바늘은 ${nGwa(H)} ${nextH(H)} 사이 → ${H}시`;
  if (r === 0) return `${hour} · 긴 바늘은 ${n} → ${n} × 5 = ${M}분`;
  return n === 0 ? `${hour} · 긴 바늘은 12에서 ${r}칸 → ${M}분` : `${hour} · 긴 바늘은 ${n}에서 ${r}칸 더 → ${n} × 5 + ${r} = ${M}분`;
}

export function makeSet(kind: CkKind, tier: number, rnd: Rnd = Math.random): SetTask {
  const h = ri(rnd, 1, 12);
  const m = kind === 's0' ? pickOf(rnd, [0, 30]) : pickOf(rnd, tier >= 2 ? [35, 40, 45, 50, 55, 25] : [5, 10, 15, 20, 25, 35, 40, 45, 50, 55]);
  // 밤 12시대(오전 12시)는 헷갈려서 내지 않는다 → 12시는 낮 12시(오후)
  const pm = h === 12 ? true : rnd() < 0.5;
  const target = (pm ? 720 : 0) + (h % 12) * 60 + m;
  // 처음 시계: 다른 시, 긴 바늘은 12에(목표가 정각이면 6에) — 두 바늘을 모두 움직여야 맞게
  let sh = h;
  while (sh === h) sh = ri(rnd, 1, 12);
  const start = (sh % 12) * 60 + (m === 0 ? 30 : 0);
  return { type: 'set', kind, step: 4, tier, target, start, snap: 5, ring: tier <= 0 && m !== 0, q: `${hmAP(target)}${m ? '으로' : '로'} 시계를 맞춰 보세요.` };
}
export const setJudge = (k: SetTask, t: number) => mod(Math.round(t), 720) === mod(k.target, 720);
const SWAP_SET = "짧은 바늘이 '시', 긴 바늘이 '분'이에요. 두 바늘이 서로 바뀌었는지 볼까요?";
/** 시계 맞추기 오답 힌트 (t: 아이가 맞춘 시각) */
export function setHint(k: SetTask, t: number, nth: number): Hint {
  const H = H12(k.target), M = MIN(k.target), h = H12(t), m = MIN(t);
  const hourOk = h === H, minOk = m === M;
  const strong = nth >= 2;
  const ring = M !== 0 && (strong || k.ring);
  if (!hourOk && !minOk && m === (H % 12) * 5 && h % 12 === Math.floor(M / 5) % 12) return { text: SWAP_SET, glow: 'both', ring };
  const minText = M === 0 ? "'정각'은 긴 바늘이 12를 가리켜요. 긴 바늘을 12로 옮겨 보세요."
    : strong ? `바깥의 파란 숫자에서 ${nEul(M)} 찾아 긴 바늘을 놓아 보세요.`
      : `${M}분은 5분씩 몇 번일까요? 12에서부터 5분씩 세면서 긴 바늘을 옮겨 보세요.`;
  if (hourOk && !minOk) return { text: minText, glow: 'm', ring };
  if (!hourOk && minOk) {
    return { text: M === 0 ? `짧은 바늘이 ${nEul(H)} 가리키게 옮겨 보세요.` : `${H}시 ${M}분은 짧은 바늘이 ${nGwa(H)} ${nextH(H)} 사이에 있어요. 짧은 바늘을 옮겨 보세요.`, glow: 'h', ring };
  }
  return strong ? { text: minText, glow: 'm', ring } : { text: "먼저 짧은 바늘로 '시'를, 그다음 긴 바늘로 '분'을 맞춰 보세요.", glow: 'both', ring };
}
/** 시계 맞추기 풀이 (바늘을 정답으로 옮기면서 보여 줌) */
export function setExplain(k: SetTask): string {
  const H = H12(k.target), M = MIN(k.target);
  return M === 0 ? `긴 바늘은 12, 짧은 바늘은 ${H}!` : `긴 바늘은 ${M % 5 === 0 ? M / 5 : `${M}분 눈금`}, 짧은 바늘은 ${nGwa(H)} ${nextH(H)} 사이!`;
}
/** 맞췄을 때: 짧은 바늘이 숫자 사이에 있는 까닭 */
export function setPraise(k: SetTask): string {
  const H = H12(k.target), M = MIN(k.target), nx = nextH(H);
  if (M === 0) return `정각이라서 짧은 바늘이 ${nEul(H)} 똑바로 가리켜요.`;
  if (M === 30) return `30분이 지나서 짧은 바늘은 ${nGwa(H)} ${nx}의 한가운데에 있어요.`;
  return M < 30 ? `${M}분이 지나서 짧은 바늘이 ${nEul(H)} 조금 지났어요.` : `${M}분이 지나서 짧은 바늘이 ${nx}에 가까워졌어요. 그래도 아직 ${H}시예요!`;
}

/** 몇 분 후·전: a1·b1 같은 시 안 / a2·b2 시가 바뀜. noon = 낮 12시를 넘는 도전 문제(오전 ↔ 오후) */
export function makeShift(kind: CkKind, tier: number, rnd: Rnd = Math.random, noon = false): ShiftTask {
  const after = kind === 'a1' || kind === 'a2', cross = kind === 'a2' || kind === 'b2';
  const easy = tier <= 0;
  let sm = 0, d = 5;
  for (let i = 0; i < 400; i++) {
    if (!cross) {
      d = pickOf(rnd, easy ? [5, 10, 15, 20] : [5, 10, 15, 20, 25, 30, 35, 40, 45]);
      sm = easy ? 10 * ri(rnd, 0, 5) : 5 * ri(rnd, 0, 11);
      if (after ? sm + d <= 55 : sm - d >= 0) break;
    } else {
      d = pickOf(rnd, easy ? [10, 15, 20, 30] : [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
      sm = after ? pickOf(rnd, easy ? [40, 45, 50, 55] : [10, 15, 20, 25, 30, 35, 40, 45, 50, 55]) : pickOf(rnd, easy ? [0, 5, 10, 15] : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
      if (after ? sm + d >= 60 : sm - d < 0) break;
    }
  }
  const delta = after ? d : -d;
  noon = noon && cross;
  let ampm = noon || (tier >= 2 ? rnd() < 0.7 : tier === 1 ? rnd() < 0.4 : false);
  let start = 0, end = 0;
  if (noon) {
    // 낮 12시를 넘는 도전 문제: 오전 11시대에서 앞으로, 오후 12시대에서 뒤로
    start = (after ? 11 : 12) * 60 + sm;
    end = start + delta;
  } else if (ampm) {
    // 오전 1시 ~ 오후 11시대에서, 밤 12시대(0시대)는 시작·도착 모두 피하고 낮 12시도 넘지 않게
    ampm = false;
    for (let i = 0; i < 400 && !ampm; i++) {
      start = ri(rnd, 1, 23) * 60 + sm;
      end = start + delta;
      ampm = end >= 60 && end < 1440 && (start < 720) === (end < 720);
    }
  }
  if (!ampm) {
    start = (ri(rnd, 1, 12) % 12) * 60 + sm;
    end = mod(start + delta, 720);
  }
  const L = (t: number) => (ampm ? hmAP(t) : hm(t));
  const sh = start - sm;                           // 시작한 '시'의 정각
  const opts: CkOpt[] = [{ label: L(end), ok: true }];
  const cands: [string, string][] = [];
  const lab = (t: number): string | null => (ampm ? (t >= 60 && t < 1440 ? hmAP(t) : null) : hm(mod(t, 720)));
  const push = (t: number, why: string) => { const s = lab(t); if (s) cands.push([s, why]); };
  let must: [string, string][] = [];
  if (cross && after) {
    const toHour = 60 - sm, rest = d - toHour;
    const slip = rest ? `${toHour}분을 가면 정각이에요. 남은 ${rest}분을 더 가면 몇 분일까요?` : `${sm} + ${nEun(d)} 60이에요. 60분이면 딱 정각이에요.`;
    { const s = lab(end - 60); if (s) must.push([s, "긴 바늘이 12를 지나갔어요. 그러면 '시'도 하나 올라가요."]); }
    if (sm + d > 60 && rnd() < 0.6) must.push([`${ampm ? ampmOf(start) + ' ' : ''}${H12(start)}시 ${sm + d}분`, `${sm + d}분은 60분이 넘어요. 60분은 1시간이라서 '시'가 하나 올라가요.`]);
    push(end + 10, slip); if (rest >= 10) push(end - 10, slip);
    push(end + 60, "'시'는 하나만 올라가요.");
    push(start - d, "'후'는 시계 방향으로, 앞으로 가요.");
  } else if (cross) {
    const rest = d - sm;
    const slip = sm ? `${sm}분을 뒤로 가면 정각이에요. 남은 ${rest}분을 더 뒤로 가요.` : `정각에서 ${d}분을 뒤로 가요. 60 − ${nEun(d)} 얼마일까요?`;
    { const s = lab(end + 60); if (s) must.push([s, "긴 바늘이 12를 거꾸로 지나갔어요. 그러면 '시'가 하나 내려가요."]); }
    if (sm > 0) push(sh - 60 + (d - sm), `${sm}분에서 ${d}분은 뺄 수 없어요. 1시간(60분)을 빌려 와서 60 + ${sm} − ${nRo(d)} 계산해요.`);
    push(end + 10, slip); push(end - 10, slip);
    push(end - 60, "'시'는 하나만 내려가요.");
    push(start + d, "'전'은 시계 반대 방향으로, 뒤로 가요.");
  } else if (after) {
    const slip = `${sm} + ${nEul(d)} 다시 계산해 볼까요?`;
    push(start - d, "'후'는 시계 방향으로, 앞으로 가요.");
    push(end + 60, "긴 바늘이 12를 지나지 않았어요. '시'는 그대로예요.");
    if (MIN(end) + 10 < 60) push(end + 10, slip);
    if (MIN(end) - 10 >= 0) push(end - 10, slip);
    if (sm > 0) push(sh + d, `처음에 이미 ${sm}분이었어요. ${sm}분에 ${d}분을 더해요.`);
  } else {
    const slip = `${sm} − ${nEul(d)} 다시 계산해 볼까요?`;
    push(start + d, "'전'은 시계 반대 방향으로, 뒤로 가요.");
    push(end - 60, "긴 바늘이 12를 지나지 않았어요. '시'는 그대로예요.");
    if (MIN(end) + 10 < 60) push(end + 10, slip);
    if (MIN(end) - 10 >= 0) push(end - 10, slip);
  }
  const again = '다시 계산해 볼까요?';
  for (const [label, why] of [...must, ...shuffled(rnd, cands), ...[5, -5, 15, -15, 20, -20, 25].map(x => [lab(end + x) ?? '', again] as [string, string])]) {
    if (opts.length < 4 && label && label !== L(start) && !opts.some(o => o.label === label)) opts.push({ label, ok: false, why });
  }
  return {
    type: 'shift', kind, step: CK_KIND[kind].step, tier, start, delta, end, ampm, cross, opts: shuffled(rnd, opts), bonus: noon || undefined,
    q: `${L(start)}에서 ${d}분 ${after ? '후는' : '전은'} 몇 시 몇 분일까요?`,
  };
}
/** 몇 분 후·전: 고르기 전에 볼 수 있는 힌트 (첫걸음만) */
export function shiftHint(k: ShiftTask): string {
  const d = Math.abs(k.delta), sm = MIN(k.start), after = k.delta > 0;
  const L = (t: number) => (k.ampm ? hmAP(t) : hm(t));
  if (!k.cross) {
    if (after) return sm ? `긴 바늘이 시계 방향으로 ${d}분 움직여요. ${sm} + ${nEun(d)} 얼마일까요?` : `정각에서 긴 바늘이 시계 방향으로 ${d}분 움직여요.`;
    return `긴 바늘이 시계 반대 방향으로 ${d}분 움직여요. ${sm} − ${nEun(d)} 얼마일까요?`;
  }
  if (after) {
    const toHour = 60 - sm, rest = d - toHour;
    return rest ? `${L(k.start)}에서 ${toHour}분을 가면 ${L(k.start + toHour)} 정각이에요. ${d}분 중에 몇 분이 남았을까요?` : `${sm} + ${nEun(d)} 60이에요. 60분은 몇 시간일까요?`;
  }
  return sm ? `${sm}분을 뒤로 가면 ${L(k.start - sm)} 정각이에요. ${d}분 중에 몇 분이 남았을까요?` : `정각에서 뒤로 가면 '시'가 하나 내려가요. 60 − ${nEun(d)} 얼마일까요?`;
}
export interface ShiftStep { from: number; to: number; text: string; hop: string }
/** 몇 분 후·전 풀이: 바늘이 움직이는 차례 (시가 바뀌면 정각에서 한 번 멈춤) — from·to는 이어지는 시각(분) */
export function shiftSteps(k: ShiftTask): ShiftStep[] {
  const d = Math.abs(k.delta), sm = MIN(k.start), after = k.delta > 0;
  const s = k.start, e = k.start + k.delta;        // 이어지는 값 (12시간 시계에서는 넘어가도 그대로 셈)
  if (!k.cross) return [{ from: s, to: e, hop: `${after ? '+' : '−'}${d}분`, text: after ? `긴 바늘이 시계 방향으로 ${d}분 움직여요.` : `긴 바늘이 시계 반대 방향으로 ${d}분 움직여요.` }];
  if (after) {
    const toHour = 60 - sm, rest = d - toHour, mid = s + toHour;
    if (!rest) return [{ from: s, to: e, hop: `+${d}분`, text: `${d}분을 가면 딱 ${H12(e)}시 정각! 60분이 되면 '시'가 하나 올라가요.` }];
    return [
      { from: s, to: mid, hop: `+${toHour}분`, text: `${toHour}분을 가면 ${H12(mid)}시 정각! (${sm} + ${toHour} = 60분)` },
      { from: mid, to: e, hop: `+${rest}분`, text: `남은 ${rest}분을 더 가요. 긴 바늘이 12를 지나서 '시'가 바뀌었어요.` },
    ];
  }
  const mid = s - sm, rest = d - sm;
  if (!sm) return [{ from: s, to: e, hop: `−${d}분`, text: `정각에서 ${d}분을 뒤로 가요. ${H12(s)}시보다 앞이니까 ${H12(e)}시예요.` }];
  return [
    { from: s, to: mid, hop: `−${sm}분`, text: `${sm}분을 뒤로 가면 ${H12(mid)}시 정각!` },
    { from: mid, to: e, hop: `−${rest}분`, text: `남은 ${rest}분을 더 뒤로 가요. ${H12(mid)}시보다 앞이니까 ${H12(e)}시예요.` },
  ];
}

/** 몇 분 후·전 풀이를 식으로 (60분을 넘는 받아올림·빌림): '35 + 40 = 75분 · 75분은 1시간 15분 → 12시 15분' */
export function shiftExplain(k: ShiftTask): string {
  const d = Math.abs(k.delta), sm = MIN(k.start), after = k.delta > 0;
  const L = (t: number) => (k.ampm ? hmAP(t) : hm(t));
  const e = k.start + k.delta;
  if (!k.cross) return after ? `${sm} + ${d} = ${sm + d}분 → ${L(e)}` : `${sm} − ${d} = ${sm - d}분 → ${L(e)}`;
  if (after) {
    const tot = sm + d, rest = tot - 60;
    return rest ? `${sm} + ${d} = ${tot}분 · ${tot}분은 1시간 ${rest}분 → ${L(e)}` : `${sm} + ${d} = 60분 · 60분은 1시간 → ${L(e)}`;
  }
  // 빌림: 1시간(60분)을 빌려 와서 뺀다 — '12시 10분은 11시 70분과 같아요'
  const prev = k.start - sm - 60;
  return `${L(k.start)}${sm ? '은' : '는'} ${L(prev)} ${sm + 60}분과 같아요 · ${sm + 60} − ${d} = ${sm + 60 - d}분 → ${L(e)}`;
}

const hours = (n: number) => `${n}시간`;
export function makeDay(kind: CkKind, tier: number, rnd: Rnd = Math.random, reverse = false): DayTask {
  let form: DayForm = 'day', n = 1, h = 0, q = '', ans = '';
  const wr: [string, string][] = [];
  if (kind === 'd1') {
    form = tier >= 1 && rnd() < 0.4 ? 'turns' : 'day';
    if (form === 'day') {
      q = '하루는 몇 시간일까요?'; ans = hours(24);
      wr.push([hours(12), '12시간은 짧은 바늘이 한 바퀴 도는 시간이에요. 하루에는 두 바퀴를 돌아요.']);
      for (const [v, why] of shuffled(rnd, [[60, "60은 1시간의 '분'이에요. 하루는 오전 12시간과 오후 12시간이에요."], [30, '오전 12시간과 오후 12시간을 더해 보세요.'], [48, '48시간은 이틀이에요. 하루는 그 절반이에요.'], [10, '오전 12시간과 오후 12시간을 더해 보세요.']] as [number, string][])) wr.push([hours(v), why]);
    } else {
      q = '시계의 짧은 바늘은 하루에 몇 바퀴 돌까요?'; ans = '2바퀴';
      wr.push(['1바퀴', '한 바퀴는 12시간이에요. 하루는 24시간이라서 한 바퀴를 더 돌아요.'], ['12바퀴', '12는 시계의 숫자예요. 짧은 바늘은 12시간에 한 바퀴 돌아요.'], ['24바퀴', '24는 하루의 시간이에요. 짧은 바늘은 12시간에 한 바퀴 돌아요.']);
    }
  } else if (kind === 'd2') {
    n = tier <= 0 ? ri(rnd, 2, 3) : tier === 1 ? ri(rnd, 2, 5) : ri(rnd, 3, 7);
    const T = 24 * n;
    if (reverse) {
      form = 'toDays'; q = `${T}시간은 며칠일까요?`; ans = `${n}일`;
      for (const [v, why] of [[n - 1, '24시간을 한 번 덜 세었어요.'], [n + 1, '24시간을 한 번 더 세었어요.'], [2 * n, '12시간씩 세었어요. 하루는 24시간이에요.'], [n + 2, '24시간씩 다시 세어 보세요.']] as [number, string][]) if (v >= 1) wr.push([`${v}일`, why]);
    } else {
      form = 'days'; q = `${n}일은 몇 시간일까요?`; ans = hours(T);
      const c: [number, string][] = [
        [24 * (n - 1), `하루를 덜 세었어요. 24를 ${n}번 더해요.`], [24 * (n + 1), `하루를 더 세었어요. 24를 ${n}번만 더해요.`],
        [12 * n, '하루를 12시간으로 세었어요. 하루는 24시간이에요.'], [20 * n + 4, `20만 ${n}번 더했어요. 4도 ${n}번 더해야 해요.`],
        [T - 10, `덧셈을 다시 해 볼까요? 24를 ${n}번 더해요.`], [T + 10, `덧셈을 다시 해 볼까요? 24를 ${n}번 더해요.`],
      ];
      for (const [v, why] of shuffled(rnd, c)) wr.push([hours(v), why]);
    }
  } else {
    n = tier <= 0 ? ri(rnd, 1, 2) : tier === 1 ? ri(rnd, 1, 3) : ri(rnd, 2, 5);
    h = tier <= 0 ? ri(rnd, 1, 6) : tier === 1 ? ri(rnd, 1, 12) : ri(rnd, 1, 23);
    if (reverse) { n = ri(rnd, 1, 3); h = ri(rnd, 1, 23); }
    const T = 24 * n + h;
    if (reverse) {
      form = 'toMix'; q = `${T}시간은 며칠과 몇 시간일까요?`; ans = `${n}일 ${h}시간`;
      const c: [string, string][] = [[`${n + 1}일 ${h}시간`, '하루(24시간)를 한 번 더 세었어요.'], [`${n}일 ${h + (h > 2 ? -2 : 2)}시간`, '']];
      if (T - 20 * n < 24) c.push([`${n}일 ${T - 20 * n}시간`, '하루는 20시간이 아니라 24시간이에요.']);
      if (T % 12) c.push([`${Math.floor(T / 12)}일 ${T % 12}시간`, '12시간씩 묶었어요. 하루는 24시간이에요.']);
      c.push([`${n}일 ${h < 23 ? h + 1 : h - 1}시간`, ''], [`${n + 2}일 ${h}시간`, '하루(24시간)를 더 많이 세었어요.']);
      for (const x of shuffled(rnd, c)) wr.push(x);
    } else {
      form = 'mix'; q = `${n}일과 ${h}시간은 모두 몇 시간일까요?`; ans = hours(T);
      const c: [number, string][] = [
        [24 * n, `${h}시간을 더하는 것을 잊었어요.`], [n + h, `'일'과 '시간'은 그냥 더할 수 없어요. 먼저 ${n}일을 시간으로 바꿔요.`],
        [24 * (n + 1) + h, '하루를 한 번 더 더했어요.'], [12 * n + h, '하루를 12시간으로 세었어요. 하루는 24시간이에요.'],
        [T + 10, ''], [T - 10, ''],
      ];
      // '시간을 안 더함'은 가장 흔한 실수라 늘 보기로
      wr.push([hours(c[0][0]), c[0][1]]);
      for (const [v, why] of shuffled(rnd, c.slice(1))) if (v > 0) wr.push([hours(v), why]);
    }
  }
  const opts: CkOpt[] = [{ label: ans, ok: true }];
  for (const [label, why] of wr) if (opts.length < 4 && !opts.some(o => o.label === label)) opts.push({ label, ok: false, why });
  const total = form === 'day' || form === 'turns' ? 24 : 24 * n + h;
  return { type: 'day', kind, step: 7, tier, form, n, h, total, opts: shuffled(rnd, opts), eq: tier <= 0 && (form === 'days' || form === 'mix'), bonus: reverse || undefined, q };
}
/** 24, 48, 72 … (n개) */
export const daySums = (n: number) => Array.from({ length: n }, (_x, i) => 24 * (i + 1));
export interface DayHint { text: string; eq: boolean; sums: boolean }
/** 하루와 여러 날 오답 힌트 (nth: 1부터) — 보기마다의 까닭(why)에 이어서 보여 줌 */
export function dayHint(k: DayTask, nth: number): DayHint {
  const first = nth <= 1;
  switch (k.form) {
    case 'day': return { text: first ? '시계의 짧은 바늘이 한 바퀴 돌면 12시간이에요. 하루에는 두 바퀴를 돌아요.' : '오전 12시간에 오후 12시간을 더하면 몇 시간일까요?', eq: false, sums: false };
    case 'turns': return { text: first ? '짧은 바늘이 한 바퀴 돌면 12시간이에요. 하루는 24시간이에요.' : '24시간은 12시간이 몇 번일까요?', eq: false, sums: false };
    case 'days': return first ? { text: `달력 한 장은 하루, 하루는 24시간이에요. 24를 ${k.n}번 더해 보세요.`, eq: true, sums: false }
      : { text: `${daySums(k.n - 1).join(', ')} … 다음은 얼마일까요?`, eq: true, sums: true };
    case 'mix': return first ? { text: `먼저 ${k.n}일을 시간으로 바꿔요. ${k.n === 1 ? '하루는 24시간이에요.' : `24를 ${k.n}번 더해요.`}`, eq: true, sums: false }
      : { text: `${k.n}일은 ${24 * k.n}시간이에요. 여기에 ${k.h}시간을 더해요.`, eq: true, sums: true };
    case 'toDays': return first ? { text: `24시간이 하루예요. ${k.total}시간 안에 24시간이 몇 번 들어갈까요?`, eq: false, sums: false }
      : { text: '24, 48, 72 … 이렇게 24씩 세어 보세요.', eq: false, sums: true };
    default: return first ? { text: `${k.total}시간에서 하루(24시간)를 빼 보세요. ${k.total} − 24는 얼마일까요?`, eq: false, sums: false }
      : { text: "24시간씩 묶고 남는 시간이 '몇 시간'이에요.", eq: false, sums: true };
  }
}
/** 하루와 여러 날 풀이 */
export function dayExplain(k: DayTask): string {
  const T = 24 * k.n;
  switch (k.form) {
    case 'day': return '오전 12시간 + 오후 12시간 = 24시간';
    case 'turns': return '12시간 × 2바퀴 = 24시간';
    case 'days': return `${Array(k.n).fill(24).join(' + ')} = ${T} · 24 × ${k.n} = ${T}`;
    case 'mix': return k.n === 1 ? `24 + ${k.h} = ${k.total}` : `24 × ${k.n} = ${T} · ${T} + ${k.h} = ${k.total}`;
    case 'toDays': return `24 × ${k.n} = ${k.total} → ${k.n}일`;
    default: return `${k.total} − ${T} = ${k.h} → ${k.n}일 ${k.h}시간`;
  }
}

/** 그 유형의 문제 하나 (challenge: 도전 문제 — 낮 12시를 넘는 전후 계산 · 거꾸로 묻는 하루 문제) */
export function makeTask(kind: CkKind, tier: number, rnd: Rnd = Math.random, challenge = false): CkTask {
  const t = Math.max(0, Math.min(2, Math.round(tier)));
  if (kind[0] === 'r') return makeRead(kind, t, rnd);
  if (kind[0] === 's') return makeSet(kind, t, rnd);
  if (kind[0] === 'd') return makeDay(kind, t, rnd, challenge && kind !== 'd1');
  return makeShift(kind, t, rnd, challenge && (kind === 'a2' || kind === 'b2'));
}

// ---------------- 한 판 (본 문제 10개 · 난이도 자동 조절 · 틀린 유형 다시) ----------------
type Weights = Partial<Record<CkKind, number>>;
/** 단계마다 [쉽게, 보통, 어렵게]일 때 본 문제 유형의 무게 */
const MIX: Record<number, [Weights, Weights, Weights]> = {
  1: [{ r0: 1 }, { r0: 1 }, { r0: 1 }],
  2: [{ r30: 3, r15: 1, r45: 1 }, { r30: 1, r15: 1, r45: 1 }, { r30: 1, r15: 2, r45: 3 }],
  3: [{ r5: 1 }, { r5: 1 }, { r5: 1 }],
  4: [{ s0: 3, s5: 1 }, { s0: 1, s5: 3 }, { s5: 1 }],
  5: [{ a1: 1, b1: 1 }, { a1: 1, b1: 1 }, { a1: 1, b1: 1 }],
  6: [{ a2: 1, b2: 1 }, { a2: 1, b2: 1 }, { a2: 1, b2: 1 }],
  7: [{ d1: 2, d2: 3, d3: 1 }, { d1: 1, d2: 3, d3: 3 }, { d2: 2, d3: 3 }],
};
/** 도전 문제(본 문제 수·통과 판정에 안 셈): 그 단계를 '어렵게' 풀고 있을 때 가끔 */
const BONUS: Record<number, CkKind[]> = { 3: ['r1'], 6: ['a2', 'b2'], 7: ['d2', 'd3'] };
/** 모두 통과한 뒤 '골고루 복습'에 나오는 단계의 무게 (시간 계산이 더 자주) */
const MIX_STEPS: [number, number][] = [[2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3]];

function weighted<K extends string>(rnd: Rnd, w: Partial<Record<K, number>>): K {
  const ks = Object.keys(w) as K[];
  const tot = ks.reduce((a, k) => a + (w[k] || 0), 0);
  let x = rnd() * tot;
  for (const k of ks) { x -= w[k] || 0; if (x < 0) return k; }
  return ks[ks.length - 1];
}

export type RoundMode = 'level' | 'mix' | 'review';
export type TaskTag = 'main' | 'review' | 'again' | 'bonus';
export interface RoundCfg {
  mode: RoundMode;
  step: number;                 // level: 그 단계(1~7)
  frontier?: boolean;           // 지금 통과해야 할 단계인가 (통과 판정을 함)
  review?: CkKind[];            // 시작할 때 짧게 복습할 유형 (지난번에 틀린 유형)
  tier?: number;                // 처음 난이도 (0 쉽게 · 1 보통 · 2 어렵게)
  weak?: CkKind[];              // 골고루 복습에서 더 자주 낼 유형
}
export interface RoundState {
  cfg: RoundCfg;
  tier: number;
  main: number; right: number;          // 본 문제: 푼 수 · 한 번에 맞힌 수
  solved: number; stars: number;        // 이번 판에 푼 문제 · 한 번에 맞힌 문제 (복습·다시·도전 포함)
  runRight: number; runWrong: number;   // 연속 정답 · 연속 오답 (난이도 조절)
  pending: { kind: CkKind; due: number; tag: 'review' | 'again' }[];
  bonusN: number; againN: number;
  seen: string[];
  lastTag: TaskTag | null;
  done: null | 'pass' | 'fast' | 'end';  // pass 90% 통과 · fast 처음 6문제 모두 맞혀 바로 통과 · end 끝(통과 아님)
  wrongKinds: CkKind[];                  // 이번 판에 틀린 유형
}
export interface RoundItem { task: CkTask; tag: TaskTag }

export function roundStart(cfg: RoundCfg): RoundState {
  const review = (cfg.review || []).filter(isCkKind);
  const pending = cfg.mode === 'review' ? review.flatMap(k => [{ kind: k, due: 0, tag: 'review' as const }, { kind: k, due: 0, tag: 'review' as const }]).slice(0, 8)
    : review.slice(0, 2).map(k => ({ kind: k, due: 0, tag: 'review' as const }));
  return {
    cfg, tier: Math.max(0, Math.min(2, cfg.tier ?? 1)), main: 0, right: 0, solved: 0, stars: 0, runRight: 0, runWrong: 0,
    pending, bonusN: 0, againN: 0, seen: [], lastTag: null, done: cfg.mode === 'review' && !pending.length ? 'end' : null, wrongKinds: [],
  };
}
/** 본 문제 유형 고르기 */
function mainKind(st: RoundState, rnd: Rnd): CkKind {
  if (st.cfg.mode === 'mix') {
    const weak = (st.cfg.weak || []).filter(isCkKind);
    if (weak.length && rnd() < 0.35) return pickOf(rnd, weak);
    const steps: Record<string, number> = {};
    for (const [s, w] of MIX_STEPS) steps[String(s)] = w;
    const kind = weighted(rnd, MIX[+weighted(rnd, steps)][st.tier]);
    // 골고루 복습은 통과 판정이 없으므로, 잘하고 있으면(어렵게) 5분 단위 읽기의 절반은 1분 단위 읽기로 넓힌다
    return kind === 'r5' && st.tier >= 2 && rnd() < 0.5 ? 'r1' : kind;
  }
  return weighted(rnd, MIX[Math.max(1, Math.min(7, st.cfg.step))][st.tier]);
}
/** 겹치지 않는 문제 만들기 */
function fresh(st: RoundState, make: () => CkTask): CkTask {
  let k = make();
  for (let i = 0; i < 30 && st.seen.includes(taskSig(k)); i++) k = make();
  return k;
}
/** 다음 문제 (끝났으면 null) — st.seen·st.pending을 바꾼다 */
export function roundNext(st: RoundState, rnd: Rnd = Math.random): RoundItem | null {
  if (st.done) return null;
  let item: RoundItem | null = null;
  const due = st.pending.findIndex(p => p.due <= st.main);
  if (due >= 0) {
    const p = st.pending.splice(due, 1)[0];
    // 복습·다시 한 번은 한 칸 쉽게 (도움 숫자·쉬운 수)
    item = { task: fresh(st, () => makeTask(p.kind, Math.max(0, st.tier - 1), rnd)), tag: p.tag };
  } else if (st.cfg.mode === 'review') {
    return null;
  } else if (st.cfg.mode === 'level' && st.tier >= 2 && st.lastTag === 'main' && st.bonusN < CK_BONUS_MAX && BONUS[st.cfg.step] && rnd() < 0.4) {
    const kind = pickOf(rnd, BONUS[st.cfg.step]);
    const task = fresh(st, () => makeTask(kind, 2, rnd, true));
    task.bonus = true;
    st.bonusN++;
    item = { task, tag: 'bonus' };
  } else {
    // 같은 문제만 남은 유형(하루는 몇 시간 등)이 걸리면 다른 유형으로
    for (let i = 0; i < 12; i++) {
      const kind = mainKind(st, rnd);
      const task = fresh(st, () => makeTask(kind, st.tier, rnd));
      item = { task, tag: 'main' };
      if (!st.seen.includes(taskSig(task))) break;
    }
  }
  if (!item) return null;
  // 도전 유형(1분 단위 읽기)은 통과 판정이 있는 판의 본 문제로는 내지 않는다 — MIX에 도전 유형이 없음(골고루 복습에서만 본 문제로 나옴)
  st.seen.push(taskSig(item.task));
  st.lastTag = item.tag;
  return item;
}
/** 한 문제를 푼 뒤 (ok: 한 번에 맞혔나) — 난이도 조절 · 틀린 유형 다시 넣기 · 통과 판정 */
export function roundAnswer(st: RoundState, item: RoundItem, ok: boolean): void {
  st.solved++;
  if (ok) st.stars++;
  if (item.tag === 'main') { st.main++; if (ok) st.right++; }
  if (ok) { st.runRight++; st.runWrong = 0; } else { st.runWrong++; st.runRight = 0; }
  if (st.runRight >= 3) { st.tier = Math.min(2, st.tier + 1); st.runRight = 0; }
  if (st.runWrong >= 2) { st.tier = Math.max(0, st.tier - 1); st.runWrong = 0; }
  if (!ok) {
    if (!st.wrongKinds.includes(item.task.kind)) st.wrongKinds.push(item.task.kind);
    // 틀린 유형은 두 문제 뒤에 한 번 더 (복습 판에서는 바로 뒤에)
    if (st.againN < CK_AGAIN_MAX) { st.againN++; st.pending.push({ kind: item.task.kind, due: st.cfg.mode === 'review' ? 0 : st.main + 2, tag: 'again' }); }
  }
  if (st.cfg.mode === 'review') { if (!st.pending.length) st.done = 'end'; return; }
  if (st.cfg.mode === 'level' && st.cfg.frontier && st.main === CK_FAST && st.right === CK_FAST && st.stars === st.solved) { st.done = 'fast'; return; }
  if (st.main >= CK_ROUND) st.done = st.cfg.mode === 'level' && st.right >= CK_PASS ? 'pass' : 'end';
}
/** 통과했나 */
export const roundPassed = (st: RoundState) => st.done === 'pass' || st.done === 'fast';

// ---------------- 기록 읽기 (State.math의 sp · solvedC · correctC — 저장 모양은 mathData.ts) ----------------
type DevMap = Record<string, number>;
type DayMap = Record<string, DevMap>;
const sum = (m: DevMap | undefined) => { let s = 0; for (const k in (m || {})) s += m![k] || 0; return s; };
export interface KindStat { kind: CkKind; solved: number; correct: number; wrongNow: boolean; rate: number }
/** 유형별 기록: 최근 days일 동안 푼 수·한 번에 맞힌 수(두 기기 합계), 지금 '틀림' 상태인가 */
export function kindStats(solvedC: DayMap, correctC: DayMap, sp: Record<string, number>, today: number, days = 30): KindStat[] {
  return CK_KINDS.map(k => {
    let solved = 0, correct = 0;
    for (let d = today - days + 1; d <= today; d++) {
      const key = `${d}:${ckDaySuffix(k.id)}`;
      solved += sum(solvedC[key]); correct += sum(correctC[key]);
    }
    return { kind: k.id, solved, correct, wrongNow: spOf(sp[ckKey(k.id)])?.st === SP_WRONG, rate: solved ? correct / solved : 1 };
  });
}
/** 지금 틀린 상태인 유형 (오래전에 틀린 것부터) — 다음 판을 시작할 때 짧게 복습 */
export function wrongKinds(sp: Record<string, number>): CkKind[] {
  return CK_KINDS.map(k => k.id).filter(k => spOf(sp[ckKey(k)])?.st === SP_WRONG).sort((a, b) => sp[ckKey(a)] - sp[ckKey(b)]);
}
/** 다음 판을 시작할 때 짧게 복습할 유형: 지금 틀린 유형(오래전에 틀린 것부터) → 틀렸다가 고친 지 이틀이 지난 유형(한 번 더 확인 — 맞춤법과 같은 규칙) */
export function reviewKinds(sp: Record<string, number>, nowMin: number): CkKind[] {
  const fixed = CK_KINDS.map(k => k.id)
    .filter(k => { const p = spOf(sp[ckKey(k)]); return !!p && p.st === SP_FIX1 && nowMin - p.min >= SP_RECHECK_MIN; })
    .sort((a, b) => sp[ckKey(a)] - sp[ckKey(b)]);
  return [...wrongKinds(sp), ...fixed];
}
/** 그 단계의 본 문제 유형 (도전 유형은 빼고) */
export const stepKinds = (step: number): CkKind[] => CK_KINDS.filter(k => k.step === step && !k.bonus).map(k => k.id);
/** 그 단계의 기록 합계 (단계 지도: 최근 정답률) */
export function stepStat(stats: KindStat[], step: number): { solved: number; correct: number; rate: number } {
  const ks = stepKinds(step);
  let solved = 0, correct = 0;
  for (const s of stats) if (ks.includes(s.kind)) { solved += s.solved; correct += s.correct; }
  return { solved, correct, rate: solved ? correct / solved : 1 };
}
/** 한 판을 시작할 난이도 (정답률에 따라 자동 조절): 처음이거나 자주 틀렸으면 쉽게(도움 숫자·쉬운 수), 잘해 왔으면 보통·어렵게 */
export function startTier(stats: KindStat[], step: number): number {
  const r = stepStat(stats, step);
  if (r.solved < 5) return 0;
  return r.rate >= 0.9 ? 2 : r.rate >= 0.7 ? 1 : 0;
}
/** 어려워하는 유형: 지금 틀린 상태이거나, 4문제 이상 풀었는데 한 번에 맞힌 것이 75%가 안 되는 유형 (낮은 것부터) */
export function weakKinds(stats: KindStat[]): KindStat[] {
  return stats.filter(s => s.wrongNow || (s.solved >= 4 && s.rate < 0.75)).sort((a, b) => a.rate - b.rate || Number(b.wrongNow) - Number(a.wrongNow));
}
/** 정해진 씨앗으로 늘 같은 난수 (부모 화면의 추천 복습 문제가 열 때마다 바뀌지 않게) */
export function seeded(seed: number): Rnd {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
/** 추천 복습 문제 (부모 화면): 그 유형의 문제를 글로 — 시계 그림 문제는 바늘 위치를 말로 */
export function sampleProblem(kind: CkKind, rnd: Rnd): { q: string; a: string; tip: string } {
  const k = makeTask(kind, 1, rnd);
  if (k.type === 'read') {
    const H = H12(k.t), M = MIN(k.t);
    const hand = M === 0 ? `짧은 바늘이 ${H}에, 긴 바늘이 12에` : `짧은 바늘이 ${nGwa(H)} ${nextH(H)} 사이에, 긴 바늘이 ${M % 5 === 0 ? M / 5 : `${Math.floor(M / 5) || 12}에서 작은 눈금 ${M % 5}칸 더 간 곳`}에`;
    return { q: `${hand} 있어요. ${k.q}`, a: hm(k.t), tip: readExplain(k) };
  }
  if (k.type === 'set') return { q: `${hmAP(k.target)}일 때 두 바늘은 어디에 있을까요?`, a: setExplain(k), tip: setPraise(k) };
  if (k.type === 'shift') return { q: k.q, a: taskAnswer(k), tip: shiftSteps(k).map(s => s.text).join(' ') };
  return { q: k.q, a: taskAnswer(k), tip: dayExplain(k) };
}
