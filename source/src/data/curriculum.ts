// 커리큘럼: 단원 → 단계. 낱말·문장은 "배운 글자로만 된 것"이 자동으로 풀린다.
import { decompose } from '../lib/hangul';

export type LessonKind = 'letters' | 'vowel' | 'cons' | 'batchim' | 'words' | 'sentence' | 'review';

export interface Lesson {
  id: string;
  unit: number;
  title: string;
  kind: LessonKind;
  items: string[]; // letters/vowel/cons: 자모, batchim: 받침 자음, words/sentence/review: 비움
}

export interface Unit { id: number; name: string; emoji: string; color: string; desc: string }

/**
 * 진도: 하루(모험 1개)에 모음 2개 + 자음 2개.
 * - 모음은 헷갈리는 짝끼리(ㅏ·ㅓ, ㅗ·ㅜ …) 함께 배워 서로 견주게 하고
 * - 자음은 초등 1학년 국어 교과서(ㄱ ㄴ ㄷ … ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ)와 같은 가나다 순서
 * - 짝이 남는 자음(ㅋ ㅌ ㅍ ㅎ)은 마지막 이틀에 → 그다음 낱말
 */
export const UNITS: Unit[] = [
  { id: 1, name: '글자 마을', emoji: '🌼', color: '#ff9ec7', desc: 'ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ · ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ' },
  { id: 2, name: '글자 숲', emoji: '🌳', color: '#7bd88f', desc: 'ㅑ ㅕ ㅛ ㅠ · ㅅ ㅇ ㅈ ㅊ' },
  { id: 3, name: '바람 언덕', emoji: '🍃', color: '#9be08f', desc: 'ㅋ ㅌ ㅍ ㅎ' },
  { id: 4, name: '낱말 다리', emoji: '🌈', color: '#ffc26b', desc: '글자를 합쳐 낱말 읽기' },
  { id: 5, name: '받침 성 ①', emoji: '🏰', color: '#c3a6ff', desc: '받침 ㅇ ㄴ ㅁ' },
  { id: 6, name: '받침 성 ②', emoji: '🏯', color: '#b197fc', desc: '받침 ㄹ ㄱ ㅂ ㅅ' },
  { id: 7, name: '쌍둥이 동굴', emoji: '💎', color: '#63e6be', desc: 'ㅐ ㅔ ㅒ ㅖ · ㄲ ㄸ ㅃ ㅆ' },
  { id: 8, name: '무지개 섬', emoji: '🦄', color: '#ffa8a8', desc: 'ㅘ ㅝ ㅚ ㅟ ㅙ ㅞ ㅢ · ㅉ' },
  { id: 9, name: '이야기 나라', emoji: '📖', color: '#ffd43b', desc: '문장 읽기' },
];

/** 진도표가 바뀌면 올림 (예전 진도를 새 진도표로 옮김) */
export const CURRICULUM_VER = 2;

let n = 0;
const L = (unit: number, kind: LessonKind, items: string[], title?: string): Lesson => ({
  id: `L${++n}`, unit, kind, items,
  title: title ?? (kind === 'batchim' ? `받침 ${items.join(' ')}` : items.join(' ')),
});

export const LESSONS: Lesson[] = [
  L(1, 'letters', ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']), L(1, 'letters', ['ㅗ', 'ㅜ', 'ㄷ', 'ㄹ']), L(1, 'letters', ['ㅡ', 'ㅣ', 'ㅁ', 'ㅂ']),
  L(2, 'letters', ['ㅑ', 'ㅕ', 'ㅅ', 'ㅇ']), L(2, 'letters', ['ㅛ', 'ㅠ', 'ㅈ', 'ㅊ']),
  L(3, 'letters', ['ㅋ', 'ㅌ']), L(3, 'letters', ['ㅍ', 'ㅎ']),
  L(4, 'words', [], '첫 낱말 ①'), L(4, 'words', [], '첫 낱말 ②'), L(4, 'words', [], '첫 낱말 ③'),
  L(5, 'batchim', ['ㅇ']), L(5, 'batchim', ['ㄴ']), L(5, 'batchim', ['ㅁ']), L(5, 'words', [], '받침 낱말'),
  L(6, 'batchim', ['ㄹ']), L(6, 'batchim', ['ㄱ']), L(6, 'batchim', ['ㅂ']), L(6, 'batchim', ['ㅅ']), L(6, 'words', [], '받침 낱말'),
  L(7, 'letters', ['ㅐ', 'ㅔ', 'ㄲ', 'ㄸ']), L(7, 'letters', ['ㅒ', 'ㅖ', 'ㅃ', 'ㅆ']), L(7, 'words', [], '낱말 놀이'),
  L(8, 'letters', ['ㅘ', 'ㅝ', 'ㅉ']), L(8, 'letters', ['ㅚ', 'ㅟ']), L(8, 'letters', ['ㅙ', 'ㅞ']), L(8, 'letters', ['ㅢ']), L(8, 'words', [], '낱말 놀이'),
  L(9, 'sentence', [], '이야기 ①'), L(9, 'sentence', [], '이야기 ②'), L(9, 'sentence', [], '이야기 ③'), L(9, 'sentence', [], '이야기 ④'),
];

/** 예전 진도표(1판)에서 각 단계까지 배운 자모 → 새 진도표 단계 번호로 옮기기 */
const OLD_V1: string[][] = [
  ['ㅏ', 'ㅓ'], ['ㅗ', 'ㅜ'], ['ㅡ', 'ㅣ'], [], ['ㄱ', 'ㄴ'], ['ㄷ', 'ㄹ'], ['ㅁ', 'ㅂ'], ['ㅅ', 'ㅇ'], ['ㅈ', 'ㅎ'], [], [], [], [],
  ['ㅑ', 'ㅕ'], ['ㅛ', 'ㅠ'], [], ['ㅋ', 'ㅌ'], ['ㅍ', 'ㅊ'], [], ['b:ㅇ'], ['b:ㄴ'], ['b:ㅁ'], [], ['b:ㄹ'], ['b:ㄱ'], ['b:ㅂ'], ['b:ㅅ'], [],
  ['ㄲ', 'ㄸ'], ['ㅃ', 'ㅆ', 'ㅉ'], [], ['ㅐ', 'ㅔ'], ['ㅒ', 'ㅖ'], [], ['ㅘ', 'ㅝ'], ['ㅚ', 'ㅟ', 'ㅢ'], ['ㅙ', 'ㅞ'], [], [], [], [], [],
];
export function migrateLessonIdx(oldIdx: number): number {
  if (oldIdx >= OLD_V1.length) return LESSONS.length;
  const known = new Set<string>();
  for (let i = 0; i < oldIdx && i < OLD_V1.length; i++) OLD_V1[i].forEach(x => known.add(x));
  // 새 진도표에서 아직 다 못 배운 첫 단계 (낱말 단계는 그 앞 글자를 다 배웠으면 통과)
  for (let i = 0; i < LESSONS.length; i++) {
    const l = LESSONS[i];
    const need = l.kind === 'batchim' ? l.items.map(x => 'b:' + x) : (l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons') ? l.items : null;
    if (need && !need.every(x => known.has(x))) return i;
    if (!need && oldIdx < OLD_V1.length && i > 0) {
      // 낱말·문장 단계: 예전에 같은 종류를 지나왔는지 대략 판단 → 앞 글자 단계가 다 끝났으면 그대로 진행
      continue;
    }
  }
  return LESSONS.length;
}

export interface Word { text: string; emoji: string }

// 그림으로 보여 줄 수 있는 낱말들
export const WORDS: Word[] = [
  ['아기', '👶'], ['오이', '🥒'], ['나무', '🌳'], ['바다', '🌊'], ['모자', '👒'], ['나비', '🦋'], ['가지', '🍆'],
  ['하마', '🦛'], ['고기', '🍖'], ['사자', '🦁'], ['오리', '🦆'], ['거미', '🕷️'], ['구두', '👞'], ['지도', '🗺️'],
  ['모기', '🦟'], ['고구마', '🍠'], ['바지', '👖'], ['미소', '😊'], ['다리', '🌉'], ['머리', '💇'], ['소', '🐄'],
  ['비', '🌧️'], ['가수', '🎤'], ['너구리', '🦝'], ['버스', '🚌'], ['부모', '👪'], ['하나', '☝️'],
  ['여우', '🦊'], ['요리', '🍳'], ['우유', '🥛'], ['야구', '⚾'], ['여자', '👧'], ['요가', '🧘'], ['벼', '🌾'],
  ['요요', '🪀'], ['야자수', '🌴'], ['휴지', '🧻'], ['유리', '🪟'],
  ['코', '👃'], ['포도', '🍇'], ['치마', '👗'], ['기차', '🚂'], ['고추', '🌶️'], ['피자', '🍕'], ['스키', '⛷️'],
  ['소파', '🛋️'], ['커피', '☕'], ['치즈', '🧀'], ['토마토', '🍅'], ['도토리', '🌰'], ['티셔츠', '👕'],
  ['코트', '🧥'], ['피아노', '🎹'], ['치타', '🐆'], ['오토바이', '🏍️'], ['크리스마스', '🎄'], ['차', '🚗'],
  ['공', '⚽'], ['가방', '🎒'], ['사탕', '🍬'], ['콩', '🫘'], ['용', '🐉'], ['호랑이', '🐯'], ['고양이', '🐱'],
  ['수영', '🏊'], ['상어', '🦈'], ['병아리', '🐤'], ['강아지', '🐶'], ['당근', '🥕'],
  ['눈사람', '⛄'], ['문', '🚪'], ['손', '✋'], ['산', '⛰️'], ['돈', '💰'], ['반지', '💍'], ['풍선', '🎈'],
  ['인형', '🧸'], ['기린', '🦒'], ['편지', '✉️'], ['곰', '🐻'], ['엄마', '👩'], ['사람', '🧑'],
  ['사슴', '🦌'], ['아이스크림', '🍦'], ['컴퓨터', '💻'], ['봄', '🌷'], ['선물', '🎁'],
  ['달', '🌙'], ['말', '🐴'], ['물', '💧'], ['불', '🔥'], ['발', '🦶'], ['별', '⭐'], ['얼굴', '🙂'],
  ['연필', '✏️'], ['신발', '👟'], ['할머니', '👵'], ['할아버지', '👴'], ['달걀', '🥚'], ['물고기', '🐟'], ['거울', '🪞'],
  ['수박', '🍉'], ['국', '🍲'], ['약', '💊'], ['악어', '🐊'], ['목도리', '🧣'], ['박수', '👏'], ['호박', '🎃'],
  ['밥', '🍚'], ['집', '🏠'], ['입', '👄'], ['컵', '🥤'], ['지갑', '👛'], ['옷', '👚'], ['빗', '🪮'], ['붓', '🖌️'],
  ['토끼', '🐰'], ['꽃', '🌸'], ['딸기', '🍓'], ['아빠', '👨'], ['빵', '🍞'], ['떡', '🍡'], ['꿀', '🍯'],
  ['코끼리', '🐘'], ['씨앗', '🌱'], ['찐빵', '🥟'], ['뿔', '🦏'], ['쓰레기통', '🗑️'],
  ['개', '🐕'], ['새', '🐦'], ['배', '⛵'], ['게', '🦀'], ['해', '☀️'], ['노래', '🎵'], ['시계', '⏰'],
  ['가게', '🏪'], ['책', '📕'], ['햄버거', '🍔'], ['카메라', '📷'], ['새우', '🦐'], ['모래', '🏖️'], ['텔레비전', '📺'],
  ['사과', '🍎'], ['과자', '🍪'], ['왕', '👑'], ['쥐', '🐭'], ['귀', '👂'], ['가위', '✂️'], ['의자', '🪑'],
  ['돼지', '🐷'], ['원숭이', '🐒'], ['병원', '🏥'], ['전화', '📞'], ['화분', '🪴'], ['외계인', '👽'], ['바퀴', '🛞'],
  ['샤워', '🚿'], ['스웨터', '🧶'], ['회전목마', '🎠'],
].map(([text, emoji]) => ({ text, emoji }));

export interface Sentence { text: string; emoji: string; chunks: string[] }
const Sn = (text: string, emoji: string): Sentence => ({ text, emoji, chunks: text.replace(/[.!?]$/, '').split(' ') });

export const SENTENCES: Sentence[] = [
  Sn('아기가 자요.', '👶💤'), Sn('고양이가 야옹.', '🐱'), Sn('나비가 날아요.', '🦋'), Sn('사자가 어흥!', '🦁'),
  Sn('강아지가 멍멍.', '🐶'), Sn('비가 주룩주룩.', '🌧️'), Sn('해가 쨍쨍.', '☀️'), Sn('별이 반짝반짝.', '✨⭐'),
  Sn('토끼가 깡충깡충.', '🐰'), Sn('오리가 꽥꽥.', '🦆'), Sn('곰이 꿀을 먹어요.', '🐻🍯'), Sn('물고기가 헤엄쳐요.', '🐟'),
  Sn('딸기는 달콤해요.', '🍓'), Sn('엄마 사랑해요.', '👩💕'), Sn('아빠 사랑해요.', '👨💕'), Sn('우리 함께 놀자!', '🤝'),
  Sn('나는 사과를 먹어요.', '🍎'), Sn('새가 노래해요.', '🐦🎵'), Sn('바람이 솔솔.', '🍃'), Sn('기차가 칙칙폭폭.', '🚂'),
];

// ---------- 배운 것 판정 ----------
export interface Known { jamo: Set<string>; batchim: Set<string> }

export function knownAfter(lessonIndex: number): Known {
  // lessonIndex 단계까지(포함) 배운 자모·받침
  const k: Known = { jamo: new Set(), batchim: new Set() };
  for (let i = 0; i <= lessonIndex && i < LESSONS.length; i++) {
    const l = LESSONS[i];
    if (l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons') l.items.forEach(x => k.jamo.add(x));
    if (l.kind === 'batchim') l.items.forEach(x => k.batchim.add(x));
  }
  return k;
}

export function readable(text: string, k: Known): boolean {
  for (const ch of text) {
    if (ch === ' ' || '.!?,'.includes(ch)) continue;
    const p = decompose(ch);
    if (!p) return false;
    if (!k.jamo.has(p.cho) || !k.jamo.has(p.jung)) return false;
    if (p.jong && !k.batchim.has(p.jong)) return false;
  }
  return true;
}

export function wordsFor(k: Known): Word[] { return WORDS.filter(w => readable(w.text, k)); }
export function sentencesFor(k: Known): Sentence[] { return SENTENCES.filter(s => readable(s.text, k)); }

/** 이 단계에서 처음 읽을 수 있게 된 낱말 */
export function newWordsAt(lessonIndex: number): Word[] {
  const now = wordsFor(knownAfter(lessonIndex));
  if (lessonIndex === 0) return now;
  const before = new Set(wordsFor(knownAfter(lessonIndex - 1)).map(w => w.text));
  return now.filter(w => !before.has(w.text));
}
