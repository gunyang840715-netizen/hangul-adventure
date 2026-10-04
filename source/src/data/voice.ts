// 앱이 말하는 모든 문장 목록 → 음성팩(녹음) 만들 때 사용
import { JAMO, nameOf } from './jamo';
import { UNITS, WORDS, SENTENCES } from './curriculum';
import { CHO, JUNG, compose, josa } from '../lib/hangul';
import { FONT_SYLLABLES } from './fontchars';
import { PETS, ITEM_LIST, SNACKS, BUILDS, partLine, doneBuildLine, iga, reul, iya, eul } from './pets';

export const FIXED = [
  // 칭찬·격려
  '딩동댕!', '정답이야!', '우와, 잘했어!', '최고야!', '멋져!', '대단해!', '맞았어!', '짝짝짝!', '우와, 정말 잘했어!', '최고야, 최고!', '대단해! 짝짝짝!',
  // 소개
  '새 글자 친구를 만나 볼까?', '글자 친구를 눌러 봐!',
  // 따라 쓰기
  '따라 써 볼까? 초록 점에서 시작해!', '이번엔 혼자 써 볼까?', '초록 점에서 시작해 봐!', '선을 따라 그려 봐!', '화살표 방향으로 쭉!', '천천히 다시 해 볼까?', '끝까지 쭉 그어 봐!',
  // 놀이
  '찾아서 톡 터뜨려 봐!', '이번엔 이 글자!', '잘 듣고 찾아 봐!', '두 친구를 합쳐 보자!', '받침까지 셋을 합쳐 보자!', '이 글자를 만들어 볼까?', '이번엔 네가 해 봐!',
  '글자 돌을 밟고 강을 건너자!', '밟아 봐!', '도착! 갇힌 친구를 눌러서 구해 줘!', '친구를 구했어! 고마워!',
  '그림을 보고, 맞는 글자를 찾아 봐!', '글자를 읽고, 맞는 그림을 찾아 봐!', '이건 뭐라고 읽을까?', '그림에 맞게 글자를 차례대로 눌러 봐!', '이번 그림은 뭘까?',
  '같이 읽어 보자!', '이번엔 순서대로 눌러서 문장을 만들어 봐!',
  '방울 속에 글자 친구들이 갇혀 있어! 눌러서 구해 줘!', '방울 속에 글자 친구가 갇혀 있어! 눌러서 구해 줘!', '글자 친구들이 스티커북에 들어갔어!',
  '선물 뽑기 시간! 손잡이를 눌러 봐!', '캡슐이 나왔어! 눌러서 열어 봐!', '별을 세 개 받았어! 정말 잘했어!',
  // 인사·지도
  '새 글자 친구들이 기다리고 있어!', '오늘은 받침 친구를 만날 거야!', '오늘은 이야기를 읽어 보자!', '배운 글자로 낱말을 읽어 보자!',
  '오늘의 모험을 떠나 볼까?', '오늘 새 모험은 끝! 놀이터에서 더 놀까?', '이 모험은 내일 열려!', '아직 잠겨 있어!',
  '이제 눈을 쉬게 해 주자. 내일 또 만나!',
  // 받침 소개
  '받침은 글자 밑에서 받쳐 주는 친구야.', '받침이 붙으면 소리가 바뀌어!',
  // 스티커북·꾸미기
  '스티커북이야! 글자 친구를 눌러 봐.', '아직 못 만난 친구야.', '모험을 하면 선물로 받을 수 있어!',
  // 10번 쓰기
  '하나!', '둘!', '셋!', '넷!', '다섯!', '여섯!', '일곱!', '여덟!', '아홉!', '열!', '열하나!', '열둘!', '열셋!', '열넷!', '열다섯!',
  '열 번 써 보자!', '다섯 번 써 보자!', '열다섯 번 써 보자!', '다섯 번 다 썼어! 대단해!', '열다섯 번 다 썼어! 대단해!', '번갈아 가며 써 보자!', '이번엔 흐린 선만 보고 써 봐!', '이번엔 기억해서 써 봐!', '잘 봐, 이렇게 쓰는 거야!',
  '어디서 시작하는지 기억해 봐!', '열 번 다 썼어! 대단해!',
  // 숨은 글자 찾기
  '이 친구들이 숨어 있는 글자를 모두 찾아 봐!', '이 친구가 숨어 있는 글자를 모두 찾아 봐!', '또 찾아 볼까?',
  // 소리만 듣고 찾기 (화면에 답을 보여 주지 않음)
  '소리를 잘 듣고 방울을 찾아 봐!', '이번엔 이 소리!', '소리를 잘 듣고 두더지를 잡아 봐!',
  '이 소리가 들어간 글자를 모두 찾아 봐!', '이 소리들이 들어간 글자를 모두 찾아 봐!', '소리를 잘 듣고 글자를 만들어 봐!',
  '소리 카드와 글자 카드의 짝을 찾아 봐!', '그림과 글자의 짝을 찾아 봐!',
  // 두더지
  '이 글자를 든 두더지를 콕 잡아 봐!',
  // 짝 맞추기
  '짝 맞추기! 같은 짝을 찾아 봐!',
  // 먹이 주기
  '냠냠! 맛있다!',
  // 우리 집·꾸미기·친구 고르기
  '분홍 단추를 누르면 모험이 시작돼!', '우리 집이야! 간식을 누르면 먹여 줄 수 있어.', '간식이 없어! 놀이를 하면 받을 수 있어!',
  '이건 강아지 간식이야!', '이건 고양이 간식이야!', '같이 놀 친구를 골라 봐!', '간식이 있어! 우리 집에서 먹여 줄까?',
  '별도 세 개 받았어!', '간식을 세 개 받았어!',
  // 이어하기·쉬기
  '하던 모험을 이어서 하자!', '다시 놀 수 있어!', '오늘 놀 시간이 다 됐어. 이번 놀이까지만 하자!',
  // 다시 하기 (틀렸을 때는 상냥하고 부드럽게)
  '다시 해 볼까?', '괜찮아, 한 번 더!', '다시 찾아 볼까?',
  '괜찮아~ 다시 찾아 보자!', '괜찮아, 천천히 다시 찾아 볼까?', '아깝다~ 다시 한번 찾아 보자!',
  '괜찮아~ 다시 골라 줄래?', '음~ 다른 간식도 먹어 볼래! 다시 골라 줘!',
  '괜찮아~ 다시 밟아 보자!', '괜찮아, 천천히 다시 골라 볼까?',
  '괜찮아~ 다른 글자를 넣어 보자!', '괜찮아, 다시 들어 보고 골라 볼까?',
  // 쓰기 (한 글자 10번: 따라 쓰기 → 흐린 선 → 혼자 쓰기)
  '이제 혼자 써 봐! 그림자가 없어!', '이번엔 흐린 선만 보고 써 봐!',
  // 숨은 글자 찾기 (한 문제씩)
  '글자 카드를 잘 보고, 문제를 듣고 찾아 봐!', '또 찾아 볼까?',
  // 카드 위치 기억하기 (찾을 글자를 미리 알려 주고, 다시 보기 3번)
  '이제 카드를 뒤집을게!', '이 글자 카드를 찾을 거야!', '어디에 있는지 잘 기억해!', '다시 볼게! 잘 봐!', '이제 다시 뒤집을게!',
  // 글자당 30번 쓰기 (10번씩 세 번)
  '열 번 더 써 보자!', '마지막 열 번이야! 힘내!', '서른 번 다 썼어! 정말 대단해!',
  // 방울·두더지·간식 (소리 듣고 하나씩)
  '소리를 잘 듣고 방울을 찾아 봐!', '소리를 잘 듣고 두더지를 잡아 봐!',
  // 선물 (꾸미기는 아이가 직접)
  '우리 집에서 직접 입혀 줄 수 있어!',
];

// ---- 강아지·고양이 친구가 하는 말 ----
export const helloLine = (name: string) => `안녕! 나는 ${iya(name)}.`;
export const breedLine = (breed: string, name: string) => `${breed} ${iya(name)}!`;
export const hungryLine = (name: string) => `${iga(name)} 배고프대! 이 글자 간식을 줘!`;
export const dressLine = (name: string) => `${reul(name)} 꾸며 줘!`;
export const growLine = (name: string) => `${iga(name)} 쑥쑥 컸어!`;
// ---- 집 짓기 ----
export const MAT_NAME = '집 짓기 재료';
export const MAT_LINE = '집 짓기 재료를 받았어!';
export const BUILD_LINES = ['집 짓기 재료를 받았어!', '우리 집에서 집을 지어 줄 수 있어!', '재료가 없어! 놀이를 하면 받을 수 있어!', '망치를 눌러서 지어 보자!', '뭘 지어 볼까?'];
export function buildLines(): string[] {
  const L = new Set<string>(BUILD_LINES);
  for (const b of BUILDS) { L.add(b.name); b.parts.forEach(p => L.add(partLine(p.name))); L.add(doneBuildLine(b)); }
  return [...L];
}
export const stageLine = (name: string, stage: 'kid' | 'adult') => `${iga(name)} ${stage === 'kid' ? '어린이가' : '어른이'} 됐어!`;
export const gotLine = (thing: string) => `${eul(thing)} 받았어!`;
export function petLines(): string[] {
  const L: string[] = [];
  for (const p of PETS) L.push(helloLine(p.name), breedLine(p.breed, p.name), p.about, hungryLine(p.name), dressLine(p.name), growLine(p.name), stageLine(p.name, 'kid'), stageLine(p.name, 'adult'));
  for (const it of ITEM_LIST) L.push(gotLine(it.name));
  for (const sn of SNACKS) L.push(gotLine(sn.name));
  return L;
}

export const BATCHIMS = ['ㅇ', 'ㄴ', 'ㅁ', 'ㄹ', 'ㄱ', 'ㅂ', 'ㅅ'];

// ---- 소리로 문제 내기: 글자 이름과 소리를 한 번씩 ----
const nm = (x: string) => JAMO[x]?.name ?? x;
/** "기역이", "아가" */
export const nameIga = (x: string) => nm(x) + josa(nm(x), '이', '가');
/** "기역을", "아를" */
export const nameEul = (x: string) => nm(x) + josa(nm(x), '을', '를');
/**
 * 글자 이름과 소리를 따로 녹음한 조각으로 (붙여 녹음하면 "기역그"처럼 이어져 들림)
 * 자음: ["기역", "그"] → 사이를 띄워 재생 / 모음: ["아"] / 음절·낱말: 그대로
 */
export function cueParts(x: string): string[] {
  const j = JAMO[x];
  if (!j) return [x];
  return j.kind === 'c' && j.sound ? [j.name, j.sound] : [j.name];
}
/** (예전 호환) 한 줄로: "기역, 그" */
export function cueLine(x: string): string { return cueParts(x).join(', '); }
/** 조각 사이 쉬는 시간(ms): 이름과 소리가 또렷이 나뉘게 */
export const CUE_GAP = 420;
export type Ask = 'hunt' | 'bat' | 'bubble' | 'mole' | 'feed' | 'recall';
const ASK_TAIL: Record<Ask, (x: string) => string> = {
  hunt: x => `${nameIga(x)} 들어간 글자를 찾아 줘!`,
  bat: x => `받침 ${nameIga(x)} 들어간 글자를 찾아 줘!`,
  bubble: x => `${nm(x)} 방울을 톡 터뜨려 줘!`,
  mole: x => `${nm(x)} 두더지를 잡아 줘!`,
  feed: x => `${nm(x)} 간식을 줘!`,
  recall: x => `${nm(x)} 카드를 찾아 줘!`,
};
const ASK_GENERIC: Record<Ask, string> = {
  hunt: '이 소리가 들어간 글자를 찾아 줘!', bat: '이 받침이 들어간 글자를 찾아 줘!', bubble: '이 글자 방울을 톡 터뜨려 줘!',
  mole: '이 글자 두더지를 잡아 줘!', feed: '이 글자 간식을 줘!', recall: '이 글자 카드를 찾아 줘!',
};
/** 문제로 들려줄 말: [이름, 소리, 질문 문장] — 이름·소리는 짧고 또렷한 녹음, 질문은 문장 녹음 */
export function askLines(x: string, kind: Ask): string[] {
  if (kind === 'bat') return [ASK_TAIL.bat(x)];
  if (JAMO[x]) return [...cueParts(x), ASK_TAIL[kind](x)];
  return [x, ASK_GENERIC[kind]];
}
export function askAll(): string[] {
  const L: string[] = Object.values(ASK_GENERIC);
  for (const j of Object.values(JAMO)) {
    (['hunt', 'bubble', 'mole', 'feed', 'recall'] as Ask[]).forEach(k => L.push(...askLines(j.ch, k)));
  }
  for (const b of BATCHIMS) L.push(...askLines(b, 'bat'));
  return L;
}

// ---- 말투를 한곳에서 관리 (앱과 음성팩이 같은 문장을 쓰도록) ----
/** "이건 기역이야." / "이 글자는 아라고 읽어." ('아야'로 들리는 문제 피하기) */
export function introName(ch: string) {
  const j = JAMO[ch];
  return j.kind === 'c' ? `이건 ${j.name}${josa(j.name, '이야', '야')}.` : `이 글자는 ${j.name}${josa(j.name, '이라고', '라고')} 읽어.`;
}
/** ["기역 소리는", "그", "그"] / ["따라 해 봐.", "아"] — 소리 부분은 따로 녹음한 또렷한 조각 */
export function introSound(ch: string): string[] {
  const j = JAMO[ch];
  return j.kind === 'c' ? [`${j.name} 소리는`, j.sound, j.sound] : ['따라 해 봐.', j.name];
}
/** 예시 낱말: ["그", "그", "거북이"] / ["아기"] */
export function introExample(ch: string): string[] {
  const j = JAMO[ch];
  return j.kind === 'c' && j.sound ? [j.sound, j.sound, j.ex.word] : [j.ex.word];
}
export function batchimAsk(base: string, b: string) { return `${base}에 ${nameOf(b)} 받침을 붙이면?`; }
export function batchimEnd(b: string) { const n = nameOf(b); return `받침 ${n}${josa(n, '은', '는')} ${END_[b]} 소리로 끝나.`; }
const END_: Record<string, string> = { 'ㅇ': '응', 'ㄴ': '은', 'ㅁ': '음', 'ㄹ': '을', 'ㄱ': '윽', 'ㅂ': '읍', 'ㅅ': '읃' };
const END: Record<string, string> = { 'ㅇ': '응', 'ㄴ': '은', 'ㅁ': '음', 'ㄹ': '을', 'ㄱ': '윽', 'ㅂ': '읍', 'ㅅ': '읃' };
export { END as BATCHIM_END };

/** 말할 수 있는 음절 전체: 모든 초성×중성, 그리고 기본 모음에 받침 7개 */
export function spokenSyllables(): string[] {
  const out = new Set<string>();
  for (const c of CHO) for (const v of JUNG) {
    const s = compose(c, v); if (FONT_SYLLABLES.has(s)) out.add(s);
    if ('ㅏㅓㅗㅜㅡㅣ'.includes(v)) for (const b of BATCHIMS) { const t = compose(c, v, b); if (FONT_SYLLABLES.has(t)) out.add(t); }
  }
  for (const w of WORDS) for (const ch of w.text) out.add(ch);
  return [...out];
}


/** 아이 이름이 들어간 말 (공개 음성팩에는 넣지 않고, 기기에서 따로 받는다) */
export function nameLines(name: string): string[] {
  const hi = name + josa(name, '아', '야');
  return [`${hi}, 안녕!`, `${hi}, 모든 모험을 끝냈어! 놀이터에서 더 놀자!`, `${hi}, 오늘도 정말 잘했어!`];
}

/** 쓰기 횟수에 맞는 말 */
export const REPS_START: Record<number, string> = { 5: '다섯 번 써 보자!', 10: '열 번 써 보자!', 15: '열다섯 번 써 보자!' };
export const REPS_DONE: Record<number, string> = { 5: '다섯 번 다 썼어! 대단해!', 10: '열 번 다 썼어! 대단해!', 15: '열다섯 번 다 썼어! 대단해!' };
/** 글자당 30번(10번씩 세 세트): 둘째 세트 시작, 마지막 세트 시작, 모두 끝 */
export const REPS_MORE = '열 번 더 써 보자!';
export const REPS_LAST = '마지막 열 번이야! 힘내!';
export const REPS_ALL = '서른 번 다 썼어! 정말 대단해!';
/** 글자당 40번(10번씩 네 세트) 다 썼을 때 */
export const REPS_ALL40 = '마흔 번 다 썼어! 정말 대단해!';

// ---- 받아쓰기 시험 (그날 끝 · 다음날 복습) ----
export const TEST_START = '받아쓰기 시험을 볼 거야! 내가 말하는 글자를 안 보고 써 봐!';
export const REVIEW_START = '어제 배운 글자를 잘 기억하는지 볼까? 내가 말하는 글자를 써 봐!';
export const TEST_ASK = '이 글자를 써 봐!';
export const TEST_SHOW = '잘 봐, 이렇게 쓰는 거야!';
export const TEST_PASS = '시험 통과! 정말 잘했어!';
export const TEST_FAIL = '아쉽다~ 오늘 배운 글자를 한 번 더 공부하고 다시 보자!';
export const REVIEW_PASS = '잘 기억하고 있구나! 오늘 공부를 시작하자!';
export const REVIEW_FAIL = '어제 배운 글자를 한 번 더 공부하자!';
export const TEST_LOCKED = '시험을 통과해야 다음 모험이 열려!';
// ---- 집 안·놀이터 꾸미기 ----
export const HOME_IN = '집 안으로 들어가 볼까?';
export const HOME_DECO = '가구를 눌러서 예쁘게 꾸며 봐!';
export const PARK_DECO = '놀이터를 크게 꾸며 보자!';
export const HOME_LOCKED = '집을 다 지으면 안으로 들어갈 수 있어!';
/** 11차에 새로 녹음한 문장 */
export const NEW11 = [REPS_ALL40, TEST_START, REVIEW_START, TEST_ASK, TEST_PASS, TEST_FAIL, REVIEW_PASS, REVIEW_FAIL, TEST_LOCKED,
  HOME_IN, HOME_DECO, PARK_DECO, HOME_LOCKED];

export function allLines(name: string): string[] {
  const L = new Set<string>([...FIXED, ...NEW11, TEST_SHOW]);
  // 자모
  for (const j of Object.values(JAMO)) {
    L.add(j.name);
    if (j.sound) L.add(j.sound);
    L.add(introName(j.ch));
    introSound(j.ch).forEach(x => L.add(x));
    introExample(j.ch).forEach(x => L.add(x));
    L.add(j.hint);
    L.add(j.ex.word);
  }
  L.add('고마워!');
  // 받침
  for (const b of BATCHIMS) {
    const n = nameOf(b);
    L.add(`오늘의 받침 친구는 ${n}${josa(n, '이야', '야')}.`);
    for (const [c, v] of [['ㄱ', 'ㅏ'], ['ㄱ', 'ㅗ'], ['ㅂ', 'ㅏ']]) L.add(batchimAsk(compose(c, v), b));
    L.add(batchimEnd(b));
    L.add(`${n} 받침`);
    L.add('아'); L.add(compose('ㅇ', 'ㅏ', b));
  }
  spokenSyllables().forEach(s => L.add(s));
  WORDS.forEach(w => L.add(w.text));
  SENTENCES.forEach(s => { L.add(s.text); s.chunks.forEach(c => L.add(c)); });
  UNITS.forEach(u => L.add(`오늘은 ${u.name}에서 모험할 거야.`));
  askAll().forEach(l => L.add(l));
  petLines().forEach(l => L.add(l));
  buildLines().forEach(l => L.add(l));
  ITEM_LIST.forEach(it => L.add(it.name));
  SNACKS.forEach(sn => L.add(sn.name));
  nameLines(name).forEach(l => L.add(l));
  L.delete('');
  return [...L];
}

/**
 * 글자·음절·낱말처럼 "읽기"를 가르치는 짧은 말 → 감정 없이 또박또박 읽는 표준 음성으로 녹음
 * (나머지 안내 문장은 자연스러운 고품질 음성)
 */
export function crispLines(): string[] {
  const L = new Set<string>();
  for (const j of Object.values(JAMO)) {
    L.add(j.name); if (j.sound) L.add(j.sound); L.add(j.ex.word);
    // 글자 이름이 들어간 설명·문제 문장도 발음이 정확해야 하므로 같은 음성으로
    L.add(introName(j.ch)); introSound(j.ch).forEach(x => L.add(x)); introExample(j.ch).forEach(x => L.add(x)); L.add(j.hint);
    (['hunt', 'bubble', 'mole', 'feed', 'recall'] as Ask[]).forEach(k => L.add(ASK_TAIL[k](j.ch)));
  }
  for (const b of BATCHIMS) {
    const n = nameOf(b);
    L.add(ASK_TAIL.bat(b)); L.add(batchimEnd(b)); L.add(`${n} 받침`); L.add(`오늘의 받침 친구는 ${n}${josa(n, '이야', '야')}.`);
    for (const [c, v] of [['ㄱ', 'ㅏ'], ['ㄱ', 'ㅗ'], ['ㅂ', 'ㅏ']]) L.add(batchimAsk(compose(c, v), b));
  }
  Object.values(ASK_GENERIC).forEach(x => L.add(x));
  spokenSyllables().forEach(x => L.add(x));
  WORDS.forEach(w => L.add(w.text));
  SENTENCES.forEach(s => { L.add(s.text); s.chunks.forEach(c => L.add(c)); });
  Object.values(END).forEach(x => L.add(x));
  REPS_COUNT.forEach(x => L.add(x));
  return [...L];
}
export const REPS_COUNT = ['하나!', '둘!', '셋!', '넷!', '다섯!', '여섯!', '일곱!', '여덟!', '아홉!', '열!', '열하나!', '열둘!', '열셋!', '열넷!', '열다섯!'];
