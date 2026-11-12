// 글자 합치기 모험 조립 (2026-11-12 사용자 요청: 낱말 공부 전에 가~휴를 '읽으면서 쓰는' 연습 — data/syllables.ts)
// 하루에 한 줄(14글자):
//   인사 → 글자 줄 읽기(듣고 따라 읽기·하나씩 눌러 읽기)
//   → 세 글자씩 [합치기(ㄱ + ㅏ = 가) → 글자마다 읽으면서 쓰기 → 읽기 놀이]
//   → 글자 줄에서 찾기 → 받아쓰기 시험(통과해야 그 줄 통과) → 선물 뽑기
// 놀이·시험·보기에는 '지금까지 연습한 글자'(앞 줄 전부 + 오늘 줄에서 이미 쓴 글자)만 나온다.
import { decompose, sample, shuffle } from '../lib/hangul';
import { SYL_ROWS, SYL_VOWELS, SYL_CONS } from '../data/syllables';
import { sylReps } from '../lib/studyCfg';
import { dictationStep, spreadList, type Step, type Choice, type BlendRound, type MemoryCard } from './session';

/** 한 번에 묶어 배우는 글자 수: [가 나 다][라 마 바][사 아 자][차 카 타][파 하] */
export const SYL_GROUP = 3;
/** 놀이 한 판의 문제 수 */
const QUESTIONS = 5;
/** 받아쓰기 시험에 내는 글자 수 (그 줄 14글자 중에서 — 글자마다 몇 번 묻는지는 부모 설정 '받아쓰기') */
export const SYL_TEST_ITEMS = 5;
/** 글자 줄에서 찾기 문제 수 */
export const SYL_FIND_ITEMS = 7;

/** 같이 배운 짝 모음(ㅏ↔ㅓ …): 합치기 보기에 넣어 서로 견주게 */
const MATE: Record<string, string> = { 'ㅏ': 'ㅓ', 'ㅓ': 'ㅏ', 'ㅗ': 'ㅜ', 'ㅜ': 'ㅗ', 'ㅡ': 'ㅣ', 'ㅣ': 'ㅡ', 'ㅑ': 'ㅕ', 'ㅕ': 'ㅑ', 'ㅛ': 'ㅠ', 'ㅠ': 'ㅛ' };

export function sylGroups(row: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < row.length; i += SYL_GROUP) out.push(row.slice(i, i + SYL_GROUP));
  return out;
}

/** 헷갈릴 만한 보기: 모음이 같은 글자(가↔나 — 자음 견주기)와 자음이 같은 글자(가↔거 — 모음 견주기)를 하나씩 먼저 */
function distract(answer: string, pool: string[], n: number): string[] {
  const pa = decompose(answer)!;
  const others = pool.filter(p => p !== answer);
  const sameV = others.filter(o => decompose(o)!.jung === pa.jung);
  const sameC = others.filter(o => decompose(o)!.cho === pa.cho);
  const first = [...sample(sameV, 1), ...sample(sameC, 1)];
  return [...first, ...shuffle(others)].filter((v, i, a) => a.indexOf(v) === i).slice(0, n);
}

/** 문제 낼 글자: 방금 쓴 묶음 + 앞에서 연습한 글자(복습) 몇 개. 연습한 글자가 모자라면 묶음을 한 번 더 */
function questions(group: string[], before: string[]): string[] {
  const review = sample(before, Math.max(0, QUESTIONS - group.length));
  const qs = [...group, ...review];
  for (let i = 0; qs.length < QUESTIONS && group.length > 1; i++) qs.push(group[i % group.length]);
  return spreadList(qs);
}

function choiceRounds(qs: string[], pool: string[]): Choice[] {
  return qs.map(a => ({ answer: a, options: shuffle([a, ...distract(a, pool, 2)]), id: 'x:' + a }));
}

/** 짝 맞추기: 글자 카드(스스로 읽기)와 소리 카드(🔊) */
function memoryCards(xs: string[]): MemoryCard[] {
  return shuffle(xs.flatMap(ch => [
    { id: ch, face: ch, kind: 'text' as const, say: '' },
    { id: ch, face: '🔊', kind: 'sound' as const, say: ch },
  ]));
}

type GameKind = 'cards' | 'memory' | 'hop' | 'feed' | 'mole' | 'bubble';
const GAMES: GameKind[] = ['cards', 'memory', 'hop', 'feed', 'mole', 'bubble'];

/** 묶음을 쓴 뒤 하는 읽기 놀이 — known: 지금까지 연습한 글자(이 묶음 포함), before: 그중 이 묶음 앞의 것 */
function game(kind: GameKind, group: string[], before: string[], known: string[]): Step {
  const qs = questions(group, before);
  switch (kind) {
    case 'cards': return { t: 'cards', rounds: choiceRounds(qs, known), kind: 'syl' };
    case 'hop': return { t: 'hop', rounds: choiceRounds(qs, known), friend: decompose(group[0])!.cho };
    case 'feed': return { t: 'feed', rounds: choiceRounds(qs, known) };
    case 'memory': {
      const four = [...group, ...sample(before, 4)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
      return { t: 'memory', cards: memoryCards(four) };
    }
    case 'mole': case 'bubble': {
      const targets = [...new Set(qs)];
      const pool = [...targets, ...sample(known.filter(x => !targets.includes(x)), 3)];
      return { t: kind, targets, pool, perTarget: 1, order: qs };
    }
  }
}

function blendRounds(group: string[], demoFirst: boolean): BlendRound[] {
  return group.map((sy, i) => {
    const p = decompose(sy)!;
    const vs = [MATE[p.jung], ...shuffle(SYL_VOWELS.filter(v => v !== p.jung && v !== MATE[p.jung]))].slice(0, 2);
    return {
      cho: p.cho, jung: p.jung, demo: demoFirst && i === 0,
      choOpts: shuffle([p.cho, ...sample(SYL_CONS.filter(c => c !== p.cho), 2)]),
      jungOpts: shuffle([p.jung, ...vs]),
    };
  });
}

/** 글자 합치기 한 줄(row: 0 = 가~하 … 9 = 규~휴)의 모험 */
export function buildSylLesson(row: number): Step[] {
  const today = SYL_ROWS[row];
  const earlier = SYL_ROWS.slice(0, row).flat();          // 앞 줄에서 이미 연습한 글자
  const reps = sylReps();
  const steps: Step[] = [{ t: 'greet' }, { t: 'sylread', items: today }];
  const kinds = shuffle(GAMES);
  const done: string[] = [];                               // 오늘 줄에서 이미 쓴 글자
  sylGroups(today).forEach((group, gi) => {
    steps.push({ t: 'blend', rounds: blendRounds(group, gi === 0) });
    for (const sy of group) steps.push({ t: 'traceSet', items: [sy], reps, level: 1 });
    const before = [...earlier, ...done];
    steps.push(game(kinds[gi % kinds.length], group, before, [...before, ...group]));
    done.push(...group);
  });
  steps.push({ t: 'sylfind', items: today, order: spreadList(sample(today, SYL_FIND_ITEMS)) });
  // 그날 마지막: 오늘 줄에서 고른 글자 받아쓰기 시험 (통과해야 이 줄 통과 — 다른 단계와 같은 규칙)
  steps.push(dictationStep(sample(today, SYL_TEST_ITEMS), 'lesson'));
  steps.push({ t: 'reward' });
  return steps;
}

/** 이어 하기: 아직 안 한 쓰기는 지금 부모 설정(글자 합치기 쓰기 횟수)으로 — 이어 할 자리 앞은 그대로 */
export function applySylSettings(steps: Step[], from: number): Step[] {
  const reps = sylReps();
  return steps.map((st, i) => (i >= from && st.t === 'traceSet' && !st.guides && st.reps !== reps ? { ...st, reps } : st));
}
