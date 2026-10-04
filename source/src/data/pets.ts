// 강아지 5종·고양이 5종, 꾸미기 아이템, 간식, 성장 단계
import { josa } from '../lib/hangul';

export type Species = 'dog' | 'cat';

export interface PetDef {
  id: string;
  species: Species;
  breed: string;      // 품종 이름
  name: string;       // 부르는 이름
  about: string;      // 한 줄 소개 (아이에게 읽어 줌)
}

export const PETS: PetDef[] = [
  { id: 'maltese', species: 'dog', breed: '말티즈', name: '뭉치', about: '하얀 털이 보송보송해!' },
  { id: 'poodle', species: 'dog', breed: '푸들', name: '초코', about: '털이 뽀글뽀글해!' },
  { id: 'corgi', species: 'dog', breed: '웰시코기', name: '식빵', about: '귀가 크고 다리가 짧아!' },
  { id: 'shiba', species: 'dog', breed: '시바견', name: '보리', about: '꼬리가 동그랗게 말려 있어!' },
  { id: 'schnauzer', species: 'dog', breed: '슈나우저', name: '콩이', about: '멋진 수염이 있어!' },
  { id: 'koshort', species: 'cat', breed: '코리안 숏헤어', name: '냥이', about: '노란 줄무늬 치즈 고양이야!' },
  { id: 'russian', species: 'cat', breed: '러시안 블루', name: '구름', about: '회색 털에 초록 눈이야!' },
  { id: 'siamese', species: 'cat', breed: '샴', name: '라떼', about: '얼굴이랑 귀가 갈색이야!' },
  { id: 'fold', species: 'cat', breed: '스코티시 폴드', name: '모찌', about: '귀가 폭 접혀 있어!' },
  { id: 'persian', species: 'cat', breed: '페르시안', name: '솜사탕', about: '털이 길고 복슬복슬해!' },
];

export const PET: Record<string, PetDef> = Object.fromEntries(PETS.map(p => [p.id, p]));
export const DEFAULT_PETS = { dog: 'maltese', cat: 'koshort' } as const;

/** 받침으로 끝나는 이름은 '이'를 붙여 부른다: 식빵 → 식빵이, 구름 → 구름이 */
export const call = (n: string) => josa(n, 'x', '') ? n + '이' : n;
/** "뭉치가", "식빵이가" */
export const iga = (n: string) => call(n) + '가';
/** 이름이 아닌 말: "쿠키를", "선글라스를", "왕관을" */
export const eul = (n: string) => n + josa(n, '을', '를');
/** 친구 이름: "뭉치를", "식빵이를" */
export const reul = (n: string) => call(n) + '를';
/** "뭉치야", "식빵이야" */
export const iya = (n: string) => call(n) + '야';
/** "뭉치랑", "식빵이랑" */
export const rang = (n: string) => call(n) + '랑';

// ---------------- 성장 ----------------
/** 레벨별로 필요한 누적 간식 점수 (Lv1=0) */
export const LEVELS = [0, 3, 7, 12, 18, 25, 33, 42, 52, 63];
export const MAX_LEVEL = LEVELS.length;
export type Stage = 'baby' | 'kid' | 'adult';
export function levelOf(points: number) {
  let lv = 1;
  for (let i = 0; i < LEVELS.length; i++) if (points >= LEVELS[i]) lv = i + 1;
  return lv;
}
export function stageOf(level: number): Stage { return level <= 3 ? 'baby' : level <= 6 ? 'kid' : 'adult'; }
export const STAGE_NAME: Record<Stage, string> = { baby: '아기', kid: '어린이', adult: '어른' };
/** 다음 레벨까지 진행률 0~1 */
export function levelProgress(points: number) {
  const lv = levelOf(points);
  if (lv >= MAX_LEVEL) return 1;
  const a = LEVELS[lv - 1], b = LEVELS[lv];
  return (points - a) / (b - a);
}

// ---------------- 간식 ----------------
export interface SnackDef { id: string; name: string; for: Species | 'both'; points: number }
export const SNACKS: SnackDef[] = [
  { id: 'bone', name: '뼈다귀 껌', for: 'dog', points: 1 },
  { id: 'meat', name: '고기', for: 'dog', points: 2 },
  { id: 'fish', name: '생선', for: 'cat', points: 1 },
  { id: 'churu', name: '츄르', for: 'cat', points: 2 },
  { id: 'cookie', name: '쿠키', for: 'both', points: 1 },
  { id: 'milk', name: '우유', for: 'both', points: 1 },
];
export const SNACK: Record<string, SnackDef> = Object.fromEntries(SNACKS.map(s => [s.id, s]));

// ---------------- 꾸미기 아이템 ----------------
export type Slot = 'hat' | 'clothes' | 'glasses' | 'neck' | 'shoes' | 'toy';
export const SLOTS: Slot[] = ['hat', 'clothes', 'glasses', 'neck', 'shoes', 'toy'];
export const SLOT_NAME: Record<Slot, string> = { hat: '모자', clothes: '옷', glasses: '안경', neck: '목걸이', shoes: '신발', toy: '장난감' };
export const SLOT_ICON: Record<Slot, string> = { hat: '🎩', clothes: '👕', glasses: '🕶️', neck: '📿', shoes: '👟', toy: '🧸' };

export interface ItemDef { id: string; slot: Slot; key: string; name: string; for: Species | 'both' }
const I = (slot: Slot, key: string, name: string, f: Species | 'both' = 'both'): ItemDef => ({ id: `${slot}:${key}`, slot, key, name, for: f });

// 강아지용 🐶 · 고양이용 🐱 · 둘 다 (옷장에서는 고른 친구에게 맞는 것만 보여 줌)
export const ITEM_LIST: ItemDef[] = [
  // 모자
  I('hat', 'bow', '리본', 'cat'), I('hat', 'crown', '왕관'), I('hat', 'cap', '야구 모자', 'dog'), I('hat', 'flower', '꽃 화관', 'cat'),
  I('hat', 'beanie', '털모자', 'dog'), I('hat', 'bunny', '토끼 머리띠', 'cat'), I('hat', 'straw', '밀짚모자', 'dog'), I('hat', 'party', '파티 모자'),
  I('hat', 'wizard', '마법사 모자', 'cat'), I('hat', 'chef', '요리사 모자', 'dog'), I('hat', 'fire', '소방관 모자', 'dog'), I('hat', 'berry', '딸기 모자', 'cat'),
  // 옷
  I('clothes', 'stripe', '줄무늬 티셔츠', 'dog'), I('clothes', 'dots', '땡땡이 원피스', 'cat'), I('clothes', 'raincoat', '노란 우비', 'dog'), I('clothes', 'overall', '멜빵바지', 'dog'),
  I('clothes', 'hanbok', '색동 한복'), I('clothes', 'cape', '영웅 망토', 'dog'), I('clothes', 'sweater', '털 스웨터', 'cat'), I('clothes', 'tutu', '발레 치마', 'cat'),
  // 안경
  I('glasses', 'sun', '선글라스', 'dog'), I('glasses', 'heart', '하트 안경', 'cat'), I('glasses', 'star', '별 안경', 'cat'), I('glasses', 'round', '동그란 안경', 'dog'), I('glasses', 'rainbow', '무지개 선글라스'),
  // 목걸이
  I('neck', 'bell', '방울 목걸이', 'cat'), I('neck', 'pearl', '진주 목걸이', 'cat'), I('neck', 'bowtie', '나비넥타이', 'dog'), I('neck', 'scarf', '목도리', 'dog'),
  I('neck', 'heart', '하트 목걸이', 'cat'), I('neck', 'lei', '꽃 목걸이'), I('neck', 'bandana', '빨간 반다나', 'dog'), I('neck', 'ribbon', '리본 목걸이', 'cat'),
  // 신발
  I('shoes', 'sneaker', '운동화', 'dog'), I('shoes', 'boots', '노란 장화', 'dog'), I('shoes', 'ballet', '발레 신발', 'cat'), I('shoes', 'fur', '털 부츠', 'cat'), I('shoes', 'socks', '줄무늬 양말'),
  // 장난감
  I('toy', 'ball', '공', 'dog'), I('toy', 'yarn', '털실 뭉치', 'cat'), I('toy', 'duck', '오리 인형', 'dog'), I('toy', 'mouse', '쥐 인형', 'cat'),
  I('toy', 'frisbee', '원반', 'dog'), I('toy', 'teddy', '곰 인형'), I('toy', 'feather', '깃털 낚싯대', 'cat'), I('toy', 'bone', '뼈다귀 인형', 'dog'),
  I('toy', 'rope', '밧줄 장난감', 'dog'), I('toy', 'fish', '물고기 인형', 'cat'),
];
export const itemFits = (it: ItemDef, sp: Species) => it.for === 'both' || it.for === sp;
export const ITEM: Record<string, ItemDef> = Object.fromEntries(ITEM_LIST.map(i => [i.id, i]));

/** 받는 순서: 종류가 골고루, 강아지용·고양이용이 번갈아 나오도록 */
export const DROP_ORDER: string[] = (() => {
  const slots: Slot[] = ['hat', 'glasses', 'neck', 'clothes', 'toy', 'shoes'];
  const q: Record<string, ItemDef[]> = { dog: [], cat: [], both: [] };
  for (let r = 0; r < 20; r++) slots.forEach(sl => { (['dog', 'cat', 'both'] as const).forEach(f => { const x = ITEM_LIST.filter(i => i.slot === sl && i.for === f)[r]; if (x) q[f].push(x); }); });
  const order: string[] = [];
  const turn = ['dog', 'cat', 'dog', 'cat', 'both'];
  for (let i = 0; order.length < ITEM_LIST.length; i++) {
    const f = turn[i % turn.length];
    const x = q[f].shift() ?? q.dog.shift() ?? q.cat.shift() ?? q.both.shift();
    if (x) order.push(x.id);
  }
  return order;
})();

// ---------------- 집 짓기: 재료를 하나씩 모아 강아지 집·고양이 집·놀이터 만들기 ----------------
export interface BuildPart { key: string; name: string }
export interface BuildDef { id: 'doghouse' | 'cathouse' | 'park'; name: string; icon: string; parts: BuildPart[] }
export const BUILDS: BuildDef[] = [
  { id: 'doghouse', name: '강아지 집', icon: '🐶', parts: [
    { key: 'floor', name: '바닥' }, { key: 'wall', name: '벽' }, { key: 'roof', name: '지붕' }, { key: 'door', name: '문' },
    { key: 'window', name: '창문' }, { key: 'sign', name: '이름표' }, { key: 'cushion', name: '폭신한 방석' }, { key: 'bowl', name: '뼈다귀 밥그릇' },
  ] },
  { id: 'cathouse', name: '고양이 집', icon: '🐱', parts: [
    { key: 'floor', name: '바닥' }, { key: 'wall', name: '벽' }, { key: 'roof', name: '지붕' }, { key: 'door', name: '동그란 문' },
    { key: 'window', name: '창문' }, { key: 'tower', name: '캣타워' }, { key: 'cushion', name: '폭신한 방석' }, { key: 'bowl', name: '물고기 밥그릇' },
  ] },
  { id: 'park', name: '놀이터', icon: '🛝', parts: [
    { key: 'sand', name: '모래밭' }, { key: 'slide', name: '미끄럼틀' }, { key: 'swing', name: '그네' }, { key: 'seesaw', name: '시소' },
    { key: 'tunnel', name: '터널' }, { key: 'ball', name: '큰 공' }, { key: 'flower', name: '꽃밭' }, { key: 'bench', name: '벤치' },
  ] },
];
export const BUILD: Record<string, BuildDef> = Object.fromEntries(BUILDS.map(b => [b.id, b]));
export const partLine = (part: string) => `${eul(part)} 만들었어!`;
export const doneBuildLine = (b: BuildDef) => `${b.name}${josa(b.name, '이', '가')} 다 지어졌어!`;

/** 예전 버전(몽글이) 아이템 → 새 아이템 */
export const OLD_ITEM: Record<string, string> = {
  'hat:bow': 'hat:bow', 'hat:crown': 'hat:crown', 'hat:flower': 'hat:flower', 'hat:wizard': 'hat:wizard', 'hat:party': 'hat:party',
  'hat:chef': 'hat:chef', 'hat:cat': 'hat:bunny', 'hat:sprout': 'hat:straw',
  'acc:starglass': 'glasses:star', 'acc:heartglass': 'glasses:heart', 'acc:bowtie': 'neck:bowtie', 'acc:pearl': 'neck:pearl', 'acc:scarf': 'neck:scarf', 'acc:wand': 'toy:feather',
};
