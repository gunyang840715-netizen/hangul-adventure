// 하루 모험(세션) 조립
import { compose, decompose, sample, shuffle, pick } from '../lib/hangul';
import { JAMO } from '../data/jamo';
import { LESSONS, WORDS, knownAfter, wordsFor, newWordsAt, sentencesFor, type Known, type Word, type Sentence, type Lesson } from '../data/curriculum';
import { FONT_SYLLABLES } from '../data/fontchars';
import { dueItems, weighted } from './srs';
import { load } from './store';
import { hasPack, hasClip } from './audio';

/** 음성팩이 있으면 녹음된 글자만 문제로 낸다 */
const canSay = (s: string) => !hasPack() || hasClip(s);

export interface Choice { answer: string; options: string[]; id?: string }
export interface BlendRound { cho: string; jung: string; jong?: string; demo?: boolean; choOpts: string[]; jungOpts: string[]; jongOpts?: string[] }
export interface PicRound { word: Word; options: Word[] }
export interface HuntRound { cards: string[]; hits: string[] }
/** 짝 맞추기 카드: 글자 카드는 뒤집어도 소리가 안 남(읽어야 함), 소리 카드(🔊)는 뒤집으면 소리가 남 */
export interface MemoryCard { id: string; face: string; kind: 'text' | 'pic' | 'sound'; say: string }

/** 쓰기 안내 단계: full=위치·순서(화살표·번호) 모두, faint=그림자(흐린 글자)만, none=아무것도 없이 */
export type TraceGuide = 'full' | 'faint' | 'memory' | 'none';
/**
 * 새 글자 하나를 40번 (10번씩 4세트, 세트마다 끝나면 놀이 한 판 → 놀이 4번):
 * 10번(모두 안내) → 놀이 → 10번(안내 5·그림자 5) → 놀이 → 10번(안내 1·그림자 6·혼자 3) → 놀이 → 10번(그림자도 없이 혼자) → 놀이
 */
export const LETTER_SETS: TraceGuide[][] = [
  Array(10).fill('full'),
  [...Array(5).fill('full'), ...Array(5).fill('faint')],
  ['full', ...Array(6).fill('faint'), ...Array(3).fill('none')],
  Array(10).fill('none'),
];

export type Step =
  | { t: 'greet' }
  | { t: 'intro'; ch: string }
  | { t: 'trace'; ch: string; guide: 'full' | 'fade' }
  | { t: 'bubble'; targets: string[]; pool: string[]; perTarget: number; order?: string[] }
  | { t: 'cards'; rounds: Choice[]; kind: 'jamo' | 'syl' | 'word' }
  | { t: 'blend'; rounds: BlendRound[] }
  | { t: 'hop'; rounds: Choice[]; friend: string }
  | { t: 'picture'; rounds: PicRound[]; mode: 'pic2word' | 'word2pic' }
  | { t: 'build'; words: Word[]; extra: string[] }
  | { t: 'batchim'; b: string }
  | { t: 'sentence'; items: Sentence[]; pool: Sentence[] }
  | { t: 'rescue'; friends: string[] }
  | { t: 'traceSet'; items: string[]; reps: number; level: number; guides?: TraceGuide[]; part?: number; parts?: number }
  | { t: 'hunt'; targets: string[]; rounds: HuntRound[]; bat?: boolean }
  | { t: 'mole'; targets: string[]; pool: string[]; perTarget: number; order?: string[] }
  | { t: 'recall'; cards: string[]; targets: string[]; order: string[]; showSec: number }
  | { t: 'memory'; cards: MemoryCard[] }
  | { t: 'feed'; rounds: Choice[] }
  | { t: 'dictation'; items: string[]; order: string[]; mode: 'lesson' | 'review' }
  | { t: 'reward' };

export const idOf = {
  jamo: (ch: string) => 'j:' + ch,
  b: (ch: string) => 'b:' + ch,
  word: (w: string) => 'w:' + w,
  sent: (s: string) => 's:' + s,
};

const vowels = (k: Known) => [...k.jamo].filter(c => JAMO[c].kind === 'v');
const conss = (k: Known) => [...k.jamo].filter(c => JAMO[c].kind === 'c');

export function syllables(k: Known, opt: { cho?: string[]; jong?: string[] } = {}): string[] {
  const out: string[] = [];
  const chos = opt.cho ?? conss(k);
  for (const c of chos) for (const v of vowels(k)) {
    const jongs = opt.jong ?? [''];
    for (const j of jongs) {
      const s = compose(c, v, j);
      if (FONT_SYLLABLES.has(s) && canSay(s)) out.push(s);
    }
  }
  return out;
}

/** 정답과 헷갈릴 만한 보기 고르기 */
function distract(answer: string, pool: string[], n: number): string[] {
  const others = pool.filter(p => p !== answer);
  const pa = decompose(answer);
  if (pa) {
    // 같은 자음 또는 같은 모음을 가진 것을 우선
    const near = others.filter(o => { const po = decompose(o); return po && (po.cho === pa.cho || po.jung === pa.jung) && (po.jong === pa.jong || Math.random() < 0.5); });
    const far = others.filter(o => !near.includes(o));
    return [...sample(near, Math.min(n, Math.ceil(n * 0.7))), ...sample(far, n)].slice(0, n).concat(sample(others, n)).filter((v, i, a) => a.indexOf(v) === i).slice(0, n);
  }
  return sample(others, n);
}

function choices(answers: string[], pool: string[], nOpt: number, idf: (a: string) => string): Choice[] {
  return answers.map(a => ({ answer: a, options: shuffle([a, ...distract(a, pool, nOpt - 1)]), id: idf(a) }));
}

function blendRound(cho: string, jung: string, k: Known, jong?: string, demo = false): BlendRound {
  const cs = conss(k), vs = vowels(k);
  const r: BlendRound = {
    cho, jung, jong, demo,
    choOpts: shuffle([cho, ...sample(cs.filter(c => c !== cho), cs.length > 2 ? 2 : 1)]),
    jungOpts: shuffle([jung, ...sample(vs.filter(v => v !== jung), 2)]),
  };
  if (jong) r.jongOpts = shuffle([jong, ...sample([...k.batchim, ...'ㄱㄴㅁㅇㄹ'].filter((b, i, a) => b !== jong && a.indexOf(b) === i), 1)]);
  return r;
}

function picRounds(words: Word[], pool: Word[], n: number): PicRound[] {
  const chosen = words.slice(0, n);
  return chosen.map(w => {
    const others = pool.filter(p => p.text !== w.text && p.emoji !== w.emoji);
    // 첫 글자가 같거나 길이가 같은 것을 섞어 헷갈리게
    const near = others.filter(o => o.text[0] === w.text[0] || o.text.length === w.text.length);
    const opts = [...sample(near, 1), ...sample(others, 3)].filter((v, i, a) => a.findIndex(x => x.text === v.text) === i).slice(0, 2);
    return { word: w, options: shuffle([w, ...opts]) };
  });
}

function pickWords(pool: Word[], fresh: Word[], n: number): Word[] {
  const ids = weighted(pool.map(w => idOf.word(w.text)), n * 2).map(id => id.slice(2));
  const byWeak = ids.map(t => pool.find(w => w.text === t)!).filter(Boolean);
  return [...fresh, ...byWeak].filter((v, i, a) => a.findIndex(x => x.text === v.text) === i).slice(0, n);
}

/** 복습 몸풀기: 오늘 복습할 것 중 최대 4개로 소리 카드 (배운 글자·낱말만. 예전 판에서 잘못 기록된 안 배운 글자는 뺀다) */
function warmup(k: Known): Step | null {
  const s = load();
  const wordSet = new Set(wordsFor(k).map(w => w.text));
  const ids = Object.keys(s.items).filter(id =>
    id.startsWith('j:') ? k.jamo.has(id.slice(2)) : id.startsWith('w:') ? wordSet.has(id.slice(2)) : false);
  const due = dueItems(ids).slice(0, 4);
  if (due.length < 2) return null;
  const jam = due.filter(d => d.startsWith('j:')).map(d => d.slice(2));
  const wds = due.filter(d => d.startsWith('w:')).map(d => d.slice(2));
  const rounds: Choice[] = [];
  const vpool = [...k.jamo];
  jam.forEach(ch => rounds.push({ answer: ch, options: shuffle([ch, ...distract(ch, vpool, 2)]), id: idOf.jamo(ch) }));
  const wpool = wordsFor(k).map(w => w.text);
  wds.forEach(w => rounds.push({ answer: w, options: shuffle([w, ...distract(w, wpool, 2)]), id: idOf.word(w) }));
  if (rounds.length < 2) return null;
  return { t: 'cards', rounds: shuffle(rounds), kind: jam.length >= wds.length ? 'jamo' : 'word' };
}

// ---------- 숨은 글자 찾기 ----------
// (예전에는 배운 글자가 모자라면 기본 자모 전체로 채웠다 → 안 배운 글자가 나와서 없앰. 이제 배운 글자만)
const PARTS: Record<string, string[]> = {
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ', 'ㅏ'], 'ㅚ': ['ㅗ', 'ㅣ'], 'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ', 'ㅓ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'],
  'ㅐ': ['ㅏ'], 'ㅔ': ['ㅓ'], 'ㅒ': ['ㅑ'], 'ㅖ': ['ㅕ'], 'ㄲ': ['ㄱ'], 'ㄸ': ['ㄷ'], 'ㅃ': ['ㅂ'], 'ㅆ': ['ㅅ'], 'ㅉ': ['ㅈ'],
};
// 모양이 비슷해서 헷갈리는 것 (오답 카드에서 뺀다)
const LOOKS: Record<string, string[]> = {
  'ㄱ': ['ㅋ', 'ㄲ'], 'ㄴ': ['ㄷ', 'ㅌ', 'ㄸ', 'ㄹ'], 'ㄷ': ['ㅌ', 'ㄸ', 'ㄹ'], 'ㅂ': ['ㅃ'], 'ㅅ': ['ㅆ', 'ㅈ', 'ㅊ', 'ㅉ'], 'ㅈ': ['ㅊ', 'ㅉ'], 'ㅇ': ['ㅎ'],
  'ㅋ': ['ㄱ'], 'ㅌ': ['ㄷ'], 'ㅊ': ['ㅈ'], 'ㅎ': ['ㅇ'], 'ㄲ': ['ㄱ', 'ㅋ'], 'ㄸ': ['ㄷ', 'ㅌ'], 'ㅃ': ['ㅂ'], 'ㅆ': ['ㅅ'], 'ㅉ': ['ㅈ', 'ㅊ'],
  'ㅏ': ['ㅑ', 'ㅐ', 'ㅒ', 'ㅘ', 'ㅙ'], 'ㅓ': ['ㅕ', 'ㅔ', 'ㅖ', 'ㅝ', 'ㅞ'], 'ㅗ': ['ㅛ', 'ㅘ', 'ㅙ', 'ㅚ'], 'ㅜ': ['ㅠ', 'ㅝ', 'ㅞ', 'ㅟ'], 'ㅡ': ['ㅢ'],
  'ㅣ': ['ㅐ', 'ㅔ', 'ㅒ', 'ㅖ', 'ㅚ', 'ㅟ', 'ㅢ'], 'ㅑ': ['ㅏ', 'ㅒ'], 'ㅕ': ['ㅓ', 'ㅖ'], 'ㅛ': ['ㅗ'], 'ㅠ': ['ㅜ'],
};
function comps(s: string): string[] {
  const p = decompose(s);
  if (!p) return [s];
  const c = [p.cho, p.jung, ...(p.jong ? [p.jong] : [])];
  return c.flatMap(x => [x, ...(PARTS[x] ?? [])]);
}

/** 글자가 아닌 그림 카드: 배운 글자가 모자랄 때 안 배운 글자 대신 채운다 (소리는 내지 않음) */
export const PICS = ['🍓', '⭐', '🐟', '🌸', '🎈', '🍩', '🧸', '🐥', '🍀', '🦋', '🍭', '🍎', '🐞', '🍒', '🎀', '🌙'];

/**
 * 숨은 글자 찾기 판 만들기: 카드는 '지금까지 배운' 자음·모음(·받침)으로 된 음절만.
 * 앞 판에서 쓴 카드는 되도록 피하고, 모자라면 다시 쓴다. 카드가 4장이 안 되는 판은 버린다.
 */
function huntRounds(targets: string[], k: Known, bat = false, n = 3, perOf?: (t: string) => number): HuntRound[] {
  const chos = conss(k);
  const jungs = vowels(k);
  const jongs = bat ? ['', ...new Set([...k.batchim, ...targets])] : [''];
  const U: string[] = [];
  for (const c of chos) for (const v of jungs) for (const j of jongs) {
    const s = compose(c, v, j);
    if (FONT_SYLLABLES.has(s) && canSay(s)) U.push(s);
  }
  const avoid = new Set(targets.flatMap(t => [t, ...(LOOKS[t] ?? [])]));
  const hitOf = (s: string, t: string) => {
    const p = decompose(s)!;
    if (bat) return p.jong === t && p.cho !== t;
    return p.cho === t || p.jung === t;
  };
  const rounds: HuntRound[] = [];
  const used = new Set<string>();
  const freshFirst = (list: string[]) => [...shuffle(list.filter(s => !used.has(s))), ...shuffle(list.filter(s => used.has(s)))];
  for (let r = 0; r < n; r++) {
    const hits: string[] = [];
    for (const t of targets) {
      const per = perOf ? perOf(t) : targets.length === 1 ? 2 : 1;
      const others = new Set(targets.filter(x => x !== t).flatMap(x => [x, ...(LOOKS[x] ?? [])]).filter(x => x !== t));
      const cand = freshFirst(U.filter(s => hitOf(s, t) && !comps(s).some(c => others.has(c)) && !hits.includes(s)));
      hits.push(...cand.slice(0, per));
    }
    const dis = freshFirst(U.filter(s => !comps(s).some(c => avoid.has(c)) && !hits.includes(s))).slice(0, Math.max(3, Math.min(6, 12 - hits.length)));
    [...hits, ...dis].forEach(x => used.add(x));
    if (hits.length && hits.length + dis.length >= 4) rounds.push({ cards: shuffle([...hits, ...dis]), hits });
  }
  return rounds;
}

function memoryLetters(letters: string[]): MemoryCard[] {
  const four = [...new Set(letters)].slice(0, 4);
  return shuffle(four.flatMap(ch => [
    { id: ch, face: ch, kind: 'text' as const, say: '' },
    { id: ch, face: '🔊', kind: 'sound' as const, say: ch },     // 소리는 게임에서 이름/소리로 번갈아
  ]));
}
function memoryWords(ws: Word[]): MemoryCard[] {
  return shuffle(ws.slice(0, 4).flatMap(w => [
    { id: w.text, face: w.emoji, kind: 'pic' as const, say: w.text },
    { id: w.text, face: w.text, kind: 'text' as const, say: '' },   // 글자는 스스로 읽기
  ]));
}

/** 요일마다 다른 놀이가 나오도록 */
const rot = <T,>(list: T[], _idx: number, _salt = 0) => pick(list);

// ---------- 놀이 고르기: 매번 무작위, 같은 놀이가 연달아 나오지 않게 ----------
type GameKind = 'hunt' | 'bubble' | 'mole' | 'feed' | 'memory' | 'hop' | 'cards';
const LETTER_GAMES: GameKind[] = ['hunt', 'bubble', 'mole', 'feed', 'memory', 'hop', 'cards'];
/** ok: 지금 배운 글자만으로 할 수 있는 놀이인지 (안 되는 놀이는 건너뜀) */
type NextGame = (ok?: (g: GameKind) => boolean) => GameKind;
function gameBag(): NextGame {
  const bag: GameKind[] = [];
  let last: GameKind | null = null;
  return (ok = () => true) => {
    const find = () => bag.findIndex(g => g !== last && ok(g));
    let i = find();
    if (i < 0) { bag.push(...shuffle(LETTER_GAMES)); i = find(); }
    if (i < 0) i = bag.findIndex(g => ok(g));
    if (i < 0) return LETTER_GAMES.find(g => ok(g)) ?? 'bubble';
    const g = bag.splice(i, 1)[0];
    last = g;
    return g;
  };
}

/** 같은 것이 연달아 나오지 않게 섞기 */
export function spreadList<T>(items: T[]): T[] {
  for (let tries = 0; tries < 60; tries++) {
    const a = shuffle(items);
    if (a.every((x, i) => i === 0 || x !== a[i - 1])) return a;
  }
  return shuffle(items);
}

/**
 * 문제 보기(오답)로 쓸 자모: '지금까지 배운' 글자(k)에서만 고른다 (같은 종류 먼저, 그다음 다른 종류).
 * 모자라도 안 배운 글자는 절대 넣지 않는다. 모양이 헷갈리는 것은 뺀다.
 */
function jamoPool(targets: string[], k: Known, n = 6): string[] {
  const kinds = new Set(targets.map(t => JAMO[t]?.kind));
  const avoid = new Set(targets.flatMap(t => LOOKS[t] ?? []).filter(x => !targets.includes(x)));
  const ok = (x: string) => !!JAMO[x] && !targets.includes(x) && !avoid.has(x);
  const same = [...k.jamo].filter(x => ok(x) && kinds.has(JAMO[x].kind));
  const other = [...k.jamo].filter(x => ok(x) && !kinds.has(JAMO[x].kind));
  return [...shuffle(same), ...shuffle(other)].slice(0, n);
}

/** 복습할 글자 고르기 (약한 것 먼저) */
function reviewPick(cands: string[], n: number, exclude: string[]): string[] {
  const c = [...new Set(cands)].filter(x => !exclude.includes(x) && JAMO[x]);
  if (!c.length || n <= 0) return [];
  return weighted(c.map(idOf.jamo), n).map(x => x.slice(2));
}

function jamoChoices(order: string[], T: string[], pool: string[]): Choice[] {
  return order.map(a => {
    // 같이 배우는 짝(ㅏ↔ㅓ)은 보기로 넣어 서로 견주게
    const mate = T.filter(x => x !== a && JAMO[x]?.kind === JAMO[a]?.kind);
    const rest = pool.filter(x => x !== a && !mate.includes(x) && !(LOOKS[a] ?? []).includes(x));
    return { answer: a, options: shuffle([a, ...[...mate, ...shuffle(rest)].slice(0, 2)]), id: idOf.jamo(a) };
  });
}

/** 글자 하나(또는 짝)를 배운 뒤 하는 놀이: 새 글자 문제를 더 자주, 복습 글자도 섞어서 */
function letterGame(g: GameKind, T: string[], R: string[], k: Known): Step {
  const all = [...T, ...R];
  // 새 글자와 복습 글자를 번갈아 (같은 글자가 연달아 나오지 않게): ㄱ ㅏ ㄱ ㅓ ㄱ
  const t0 = T[0];
  const order = T.length > 1 ? spreadList([...T, ...T, ...R])
    : R.length >= 2 ? [t0, R[0], t0, R[1], t0]
    : R.length === 1 ? [t0, R[0], t0, R[0], t0]
    : [t0, t0];                              // 처음 배우는 글자 하나뿐일 때
  const pool = jamoPool(all, k, 6);
  // 배운 글자가 하나뿐일 때(맨 처음 글자): 방울·두더지에 다른 글자 대신 그림을 섞어 '그 글자만' 찾게
  const deco = new Set([...all, ...pool]).size < 2 ? sample(PICS, 4) : [];
  switch (g) {
    case 'hunt': return { t: 'hunt', targets: all, rounds: huntRounds(all, k, false, T.length === 1 ? 2 : 1, t => T.includes(t) ? 2 : 1) };
    case 'bubble': return { t: 'bubble', targets: all, pool: [...all, ...pool, ...deco], perTarget: 2, order };
    case 'mole': return { t: 'mole', targets: all, pool: [...all, ...pool, ...deco], perTarget: 2, order };
    case 'feed': return { t: 'feed', rounds: jamoChoices(order, T, [...all, ...pool]) };
    case 'hop': return { t: 'hop', rounds: jamoChoices(order, T, [...all, ...pool]), friend: T[0] };
    case 'cards': return { t: 'cards', rounds: jamoChoices(order, T, [...all, ...pool]), kind: 'jamo' };
    case 'memory': return { t: 'memory', cards: memoryLetters([...all, ...pool].slice(0, 4)) };
  }
}

/** 배운 글자만으로 놀이가 제대로 되는지: 보기가 하나뿐이거나, 짝이 2개 이하거나, 숨은 글자 카드가 모자라면 그 놀이는 고르지 않는다 */
export function playable(s: Step): boolean {
  switch (s.t) {
    case 'feed': case 'hop': case 'cards':
      return s.rounds.length > 0 && s.rounds.every(r => r.options.includes(r.answer) && new Set(r.options).size >= 2);
    case 'memory': return new Set(s.cards.map(c => c.id)).size >= 3;
    case 'hunt': return s.rounds.length > 0 && s.rounds.reduce((a, r) => a + r.hits.length, 0) >= 3;
    case 'bubble': case 'mole': return new Set([...s.pool, ...s.targets]).size >= 2;
    case 'blend': return s.rounds.length > 0;
    case 'picture': return s.rounds.length > 0 && s.rounds.every(r => r.options.length >= 2);
    case 'build': return s.words.length > 0;
    case 'recall': return s.targets.length > 0 && s.order.length >= 2;
    default: return true;
  }
}

/** 글자 하나 배운 뒤 놀이 하나: 지금 배운 글자만으로 할 수 있는 놀이 중에서 고른다 */
function letterStep(next: NextGame, T: string[], R: string[], k: Known): Step {
  const made: Partial<Record<GameKind, Step>> = {};
  const make = (g: GameKind) => (made[g] ??= letterGame(g, T, R, k));
  return make(next(g => playable(make(g))));
}

/** 카드 16장 위치 기억하기: 두 글자를 2장씩 (예: ㅏ 2장 · ㅓ 2장) + 나머지 12장은 배운 다른 글자, 모자라면 그림 카드 */
function recallStep(two: string[], k: Known): Step {
  const faces = two.flatMap(t => [t, t]);
  const avoid = new Set(two.flatMap(t => [t, ...(LOOKS[t] ?? [])]));
  const known = shuffle([...k.jamo].filter(x => !avoid.has(x)));
  const need = 16 - faces.length;
  const others = [...known.slice(0, need), ...sample(PICS, Math.max(0, need - known.length))];
  return { t: 'recall', cards: shuffle([...faces, ...others]), targets: two, order: spreadList(faces), showSec: 10 };
}

function traceReps() { return Math.max(3, Math.min(15, load().settings.traceReps || 10)); }

/**
 * 받아쓰기 시험: 읽어 주는 글자를 안 보고 쓰기. 글자마다 두 번씩, 순서는 무작위(같은 글자가 연달아 나오지 않게), 적어도 4문제
 * mode: lesson = 그날 공부 끝 시험(통과해야 다음 단계), review = 다음날 시작 전 복습 시험(떨어지면 전 단계 다시)
 */
export function dictationStep(items: string[], mode: 'lesson' | 'review'): Step {
  const its = [...new Set(items.filter(Boolean))];
  let qs = its.flatMap(x => [x, x]);
  while (qs.length < 4 && its.length) qs = [...qs, ...its];
  return { t: 'dictation', items: its, order: spreadList(qs), mode };
}

export function buildLesson(idx: number): Step[] {
  const lesson: Lesson = LESSONS[idx];
  const k = knownAfter(idx);
  const kPrev = idx > 0 ? knownAfter(idx - 1) : { jamo: new Set<string>(), batchim: new Set<string>() };
  const steps: Step[] = [{ t: 'greet' }];
  const w = warmup(kPrev);
  if (w && idx > 0) steps.push(w);
  const words = wordsFor(k);
  const fresh = newWordsAt(idx);
  const reps = traceReps();
  const known = [...k.jamo];
  const vs = vowels(k);

  // 쓰기 10번 → 놀이 → 쓰기 10번 → 놀이 → 쓰기 10번 → 놀이
  const cycle = (items: (lv: number) => string[], games: Step[]) => {
    games.forEach((g, i) => { steps.push({ t: 'traceSet', items: items(i + 1), reps, level: i + 1 }, g); });
  };

  if (lesson.kind === 'letters' || lesson.kind === 'vowel' || lesson.kind === 'cons') {
    // 하루에 모음 2 + 자음 2: 글자마다 [만나기 → 10번 쓰기 → 놀이 → 10번 → 놀이 → 10번], 짝을 다 배우면 카드 위치 기억하기
    const neu = lesson.items;
    const groups = [neu.filter(c => JAMO[c].kind === 'v'), neu.filter(c => JAMO[c].kind === 'c')].filter(g => g.length);
    const next = gameBag();
    const seen = [...kPrev.jamo];            // 지금까지 배운 글자: 앞 단계 + 오늘 이미 만난 글자 (복습·보기는 여기서만)
    // 놀이에는 '지금까지 배운 글자'만 나온다 (오늘 뒤에 배울 글자도 아직 안 나옴)
    const learned = (xs: string[]): Known => ({ jamo: new Set(xs), batchim: new Set(kPrev.batchim) });
    for (const g of groups) {
      for (const ch of g) {
        steps.push({ t: 'intro', ch });
        const kNow = learned([...seen, ch]);
        // 쓰기 10번 → 놀이 → 쓰기 10번 → 놀이 → 쓰기 10번 → 놀이 → 쓰기 10번(혼자) → 놀이 (글자 하나에 40번, 놀이 4번)
        LETTER_SETS.forEach((guides, b) => {
          steps.push({ t: 'traceSet', items: [ch], reps: guides.length, level: b + 1, guides, part: b, parts: LETTER_SETS.length });
          steps.push(letterStep(next, [ch], reviewPick(seen, 2, [ch]), kNow));
        });
        seen.push(ch);
      }
      const kG = learned(seen);
      if (g.length >= 2) steps.push(recallStep(g.slice(0, 2), kG));
      else steps.push(recallStep([g[0], ...reviewPick(seen, 1, [g[0]])].slice(0, 2), kG));
    }
    // 새 자음·모음으로 소리 합치기 (ㄱ + ㅏ = 가)
    const sylNew = syllables(k).filter(sy => { const p = decompose(sy)!; return neu.includes(p.cho) || neu.includes(p.jung); });
    if (sylNew.length >= 2) steps.push({ t: 'blend', rounds: shuffle(sylNew).slice(0, 4).map((sy, i) => { const p = decompose(sy)!; return blendRound(p.cho, p.jung, k, undefined, i === 0); }) });
    // 마무리: 오늘 배운 글자 + 앞에서 배운 글자 찾기. 배운 글자로 만든 카드로 안 되면(맨 첫날) 모음끼리·자음끼리만
    const R = reviewPick([...kPrev.jamo], 1, neu);
    const fin = [...neu, ...R];
    const endHunt = [fin, neu.filter(c => JAMO[c].kind === 'v'), neu.filter(c => JAMO[c].kind === 'c')]
      .filter(t => t.length > 0)
      .map((t): Step => ({ t: 'hunt', targets: t, rounds: huntRounds(t, k, false, 1, () => (t.length <= 2 ? 2 : 1)) }))
      .find(playable);
    if (endHunt) steps.push(endHunt);
    // 그날 마지막: 오늘 배운 글자 받아쓰기 시험 (통과해야 다음 단계)
    steps.push(dictationStep(neu, 'lesson'));
    steps.push({ t: 'rescue', friends: neu });
  }

  if (lesson.kind === 'batchim') {
    const b = lesson.items[0];
    steps.push({ t: 'batchim', b });
    const real = [...new Set(WORDS.flatMap(w => [...w.text]))].filter(ch => {
      const p = decompose(ch); return p && p.jong === b && k.jamo.has(p.cho) && k.jamo.has(p.jung) && 'ㅏㅓㅗㅜㅡㅣ'.includes(p.jung) && canSay(ch);
    });
    const vs6 = vs.filter(v => 'ㅏㅓㅗㅜㅣ'.includes(v));
    const pool = shuffle(real).slice(0, 5);
    for (let guard = 0; pool.length < 5 && guard < 300; guard++) { const c = pick(conss(k).filter(c => c !== 'ㅇ')); const sy = compose(c, pick(vs6), b); if (!pool.includes(sy) && FONT_SYLLABLES.has(sy) && canSay(sy)) pool.push(sy); }
    const withB = [...new Set([...real, ...syllables(k, { jong: [b] }).filter(s => 'ㅏㅓㅗㅜㅣ'.includes(decompose(s)!.jung))])];
    const g1: Step = { t: 'hunt', targets: [b], rounds: huntRounds([b], k, true), bat: true };
    const g2: Step = { t: 'blend', rounds: pool.slice(0, 4).map((sy, i) => { const p = decompose(sy)!; return blendRound(p.cho, p.jung, k, b, i === 0); }) };
    let g3: Step;
    if (fresh.length >= 2 && words.length >= 3) g3 = { t: 'picture', rounds: picRounds(shuffle(fresh), words, Math.min(5, fresh.length)), mode: 'pic2word' };
    else {
      const pairs = [...sample(real, 3), ...sample(withB, 5)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5).map(s => {
        const p = decompose(s)!;
        const bare = compose(p.cho, p.jung);
        const opts = [s, ...(canSay(bare) ? [bare] : [])];
        if (opts.length < 2) opts.push(pick(withB.filter(x => x !== s)));
        return { answer: s, options: shuffle(opts), id: idOf.b(b) };
      });
      g3 = { t: 'cards', rounds: pairs, kind: 'syl' };
    }
    const traceSyl = [pool[0], pool[1] ?? pool[0], pool[2] ?? pool[0]];
    cycle(lv => [traceSyl[lv - 1]], [g1, g2, g3]);
    if (fresh.length >= 2) steps.push({ t: 'build', words: sample(fresh.filter(x => x.text.length <= 3), 3), extra: sample(syllables(k), 3) });
    steps.push(dictationStep(traceSyl, 'lesson'));
    steps.push({ t: 'rescue', friends: [b] });
  }

  if (lesson.kind === 'words') {
    const ws = pickWords(words, shuffle(fresh), 5);
    const trace = shuffle([...new Set(ws.flatMap(x => [...x.text]))]).slice(0, 3);
    const g1: Step = { t: 'picture', rounds: picRounds(ws, words, ws.length), mode: 'pic2word' };
    const g2: Step = { t: 'build', words: sample(words.filter(x => x.text.length >= 2 && x.text.length <= 3), 3), extra: sample(syllables(k), 3) };
    const wt = words.map(x => x.text);
    const g3: Step = rot<Step>([
      { t: 'memory', cards: memoryWords(sample(words, 4)) },
      { t: 'hop', rounds: choices(sample(wt, 5), wt, 3, idOf.word), friend: pick(known) },
      { t: 'picture', rounds: picRounds(pickWords(words, [], 4), words, 4), mode: 'word2pic' },
    ], idx);
    cycle(lv => [trace[(lv - 1) % trace.length]], [g1, g2, g3]);
    steps.push(dictationStep(trace, 'lesson'));
  }

  if (lesson.kind === 'review') {
    const weak = weighted(known.map(idOf.jamo), 3).map(x => x.slice(2));
    const two = weak.slice(0, 2);
    const g1: Step = { t: 'hunt', targets: two, rounds: huntRounds(two, k) };
    const g2: Step = rot<Step>([{ t: 'mole', targets: two, pool: known, perTarget: 4 }, { t: 'bubble', targets: two, pool: known, perTarget: 4 }], idx);
    const g3: Step = { t: 'feed', rounds: choices(shuffle([...weak, ...sample(known, 3)]).slice(0, 5), known, 3, idOf.jamo) };
    cycle(() => two, [g1, g2, g3]);
  }

  if (lesson.kind === 'sentence') {
    const pool = sentencesFor(k);
    const ids = weighted(pool.map(s => idOf.sent(s.text)), 3).map(x => x.slice(2));
    const items = ids.map(t => pool.find(s => s.text === t)!);
    steps.push({ t: 'sentence', items, pool });
    const syl = shuffle([...new Set(items.flatMap(s => [...s.text.replace(/[ .!?]/g, '')]))]).filter(ch => canSay(ch));
    steps.push({ t: 'traceSet', items: [syl[0] ?? '가'], reps, level: 2 });
    const ws = pickWords(words, [], 4);
    steps.push({ t: 'picture', rounds: picRounds(ws, words, 4), mode: 'word2pic' });
    steps.push({ t: 'traceSet', items: [syl[1] ?? syl[0] ?? '나'], reps, level: 3 });
    steps.push({ t: 'memory', cards: memoryWords(sample(words, 4)) });
    steps.push(dictationStep([syl[0] ?? '가', syl[1] ?? syl[0] ?? '나'], 'lesson'));
  }

  steps.push({ t: 'reward' });
  return steps;
}

/** 놀이터: 배운 것으로 놀이 하나 */
export function buildPlay(idx: number, kind?: string): Step[] {
  const k = knownAfter(Math.max(0, idx - 1));
  if (k.jamo.size < 2) return [];
  const words = wordsFor(k);
  const all = [...k.jamo];
  const syl = syllables(k);
  const games: (() => Step)[] = [
    () => ({ t: 'bubble', targets: sample(all, 2), pool: all, perTarget: 4 }),
    () => ({ t: 'mole', targets: sample(all, 2), pool: all, perTarget: 4 }),
    () => ({ t: 'feed', rounds: choices(sample(all, 5), all, 3, idOf.jamo) }),
    () => ({ t: 'memory', cards: memoryLetters(sample(all, 4)) }),
    () => { const t = sample(all, 2); return { t: 'hunt', targets: t, rounds: huntRounds(t, k) }; },
    () => recallStep(sample(all.filter(x => JAMO[x]), 2), k),
    () => ({ t: 'cards', rounds: choices(sample(syl.length ? syl : all, 6), syl.length ? syl : all, 3, s => (syl.length ? 'x:' : 'j:') + s), kind: syl.length ? 'syl' : 'jamo' }),
    () => ({ t: 'hop', rounds: choices(sample(syl.length ? syl : all, 6), syl.length ? syl : all, 3, s => (syl.length ? 'x:' : 'j:') + s), friend: pick(all) }),
  ];
  if (syl.length) games.push(() => ({ t: 'blend', rounds: sample(syl, 4).map(sy => { const p = decompose(sy)!; return blendRound(p.cho, p.jung, k); }) }));
  if (words.length >= 4) {
    games.push(() => ({ t: 'picture', rounds: picRounds(sample(words, 5), words, 5), mode: 'pic2word' }));
    games.push(() => ({ t: 'build', words: sample(words.filter(x => x.text.length >= 2 && x.text.length <= 3), 3), extra: sample(syl, 3) }));
    games.push(() => ({ t: 'memory', cards: memoryWords(sample(words, 4)) }));
  }
  // 배운 글자만으로 제대로 되는 놀이만 (몇 번 다시 만들어 보고 안 되면 다른 놀이)
  const tryMake = (f: () => Step) => { for (let i = 0; i < 4; i++) { const s = f(); if (playable(s)) return s; } return null; };
  if (kind) for (const f of games) { const s = f(); if (s.t === kind) { const ok = playable(s) ? s : tryMake(f); if (ok) return [ok]; } }
  for (const f of shuffle(games)) { const s = tryMake(f); if (s) return [s]; }
  return [];
}

export const lessonAt = (i: number) => LESSONS[Math.min(i, LESSONS.length - 1)];

// ---------- 이어하기 고치기: 예전 판에서 만들어 둔 남은 놀이에 안 배운 글자가 있으면 다시 만든다 ----------
/** 단계에 보이는 글자들 (그림 카드 포함, 아래에서 걸러 냄) */
function stepTexts(st: Step): string[] {
  const o: string[] = [];
  const add = (...xs: (string | string[] | undefined)[]) => xs.flat().forEach(x => { if (x) o.push(x); });
  switch (st.t) {
    case 'intro': case 'trace': add(st.ch); break;
    case 'traceSet': add(st.items); break;
    case 'bubble': case 'mole': add(st.targets, st.pool, st.order); break;
    case 'cards': case 'feed': case 'hop': st.rounds.forEach(r => add(r.answer, r.options)); break;
    case 'blend': st.rounds.forEach(r => add(r.cho, r.jung, r.jong, r.choOpts, r.jungOpts, r.jongOpts)); break;
    case 'picture': st.rounds.forEach(r => add(r.word.text, r.options.map(w => w.text))); break;
    case 'build': add(st.words.map(w => w.text), st.extra); break;
    case 'batchim': add(st.b); break;
    case 'sentence': add(st.items.map(s => s.text), st.pool.map(s => s.text)); break;
    case 'rescue': add(st.friends); break;
    case 'hunt': add(st.targets); st.rounds.forEach(r => add(r.cards, r.hits)); break;
    case 'recall': add(st.cards, st.targets, st.order); break;
    case 'memory': st.cards.forEach(c => add(c.id, c.face, c.say)); break;
    case 'dictation': add(st.items, st.order); break;
  }
  return o;
}
/** 배운 자모(k.jamo)·받침(k.batchim)만으로 된 글자인지 (그림 카드는 통과) */
function fitsKnown(s: string, k: Known): boolean {
  for (const ch of s) {
    if (/[ㄱ-ㆎ]/.test(ch)) { if (!k.jamo.has(ch)) return false; continue; }
    const p = decompose(ch);
    if (!p) continue;
    if (!k.jamo.has(p.cho) || !k.jamo.has(p.jung)) return false;
    if (p.jong && !k.batchim.has(p.jong)) return false;
  }
  return true;
}
export function stepFits(st: Step, k: Known) { return stepTexts(st).every(s => fitsKnown(s, k)); }

function remake(st: Step, k: Known, cur: string, seen: string[], next: NextGame): Step | null {
  const L = [...k.jamo].filter(x => JAMO[x]);
  if (st.t === 'recall') {
    const two = st.targets.filter(t => k.jamo.has(t)).slice(0, 2);
    const pair = two.length >= 2 ? two : [...two, ...reviewPick(L, 2 - two.length, two)].slice(0, 2);
    return pair.length ? recallStep(pair, k) : null;
  }
  if (st.t === 'hunt') {
    const t0 = st.targets.filter(t => (st.bat ? k.batchim.has(t) : k.jamo.has(t)));
    const cands = [t0, t0.filter(t => JAMO[t]?.kind === 'v'), t0.filter(t => JAMO[t]?.kind === 'c')].filter(t => t.length);
    for (const t of cands) {
      const s: Step = { t: 'hunt', targets: t, rounds: huntRounds(t, k, !!st.bat, Math.max(1, st.rounds.length), () => (t.length <= 2 ? 2 : 1)), bat: st.bat };
      if (playable(s)) return s;
    }
  }
  if (!cur && st.t === 'cards') return warmup(k);              // 시작할 때 복습 몸풀기
  if (cur && k.jamo.has(cur)) return letterStep(next, [cur], reviewPick(seen, 2, [cur]), k);
  if (L.length >= 2) { const two = sample(L, 2); return letterStep(next, [two[0]], [two[1]], k); }
  return null;
}

/**
 * 이어하기: 앞 단계 + 지금까지 만난 새 글자 기준으로, from 번째부터 남은 단계 중 안 배운 글자가 있는 놀이만
 * 같은 자리에 배운 글자만으로 다시 만든다 (소개·쓰기 단계와 이미 한 단계는 그대로라 단계 번호가 안 바뀜).
 */
export function refreshSteps(steps: Step[], idx: number, from: number): Step[] {
  const kPrev = idx > 0 ? knownAfter(idx - 1) : { jamo: new Set<string>(), batchim: new Set<string>() };
  const seen = [...kPrev.jamo];
  const bat = new Set(kPrev.batchim);
  const next = gameBag();
  let cur = '';
  const out: Step[] = [];
  steps.forEach((st, i) => {
    if (st.t === 'intro') { if (!seen.includes(st.ch)) seen.push(st.ch); cur = st.ch; }
    if (st.t === 'batchim') bat.add(st.b);
    const k: Known = { jamo: new Set(seen), batchim: new Set(bat) };
    if (i < from || stepFits(st, k)) { out.push(st); return; }
    const fix = remake(st, k, cur, seen, next);
    if (fix) out.push(fix);
  });
  return out;
}
