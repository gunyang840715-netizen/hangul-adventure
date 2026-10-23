// 놀이를 끝낼 때마다 받는 선물: 간식(키우기) 또는 꾸미기 아이템
import { addGame, gamesTotal, addOwned, addSnack, setLastItem, addMat, load, hasItem } from './store';
import { ITEM_LIST, ITEM } from '../data/pets';

export type Gift = { kind: 'snack' | 'item' | 'mat'; id: string };

/** 선물을 주는 놀이 */
const GAMES = new Set(['hunt', 'bubble', 'mole', 'memory', 'feed', 'hop', 'blend', 'picture', 'build', 'cards', 'sentence', 'rescue', 'recall']);
const TRACE = new Set(['traceSet', 'trace']);

/** 간식이 선물로 나올 비율 (새 간식은 여기에도 넣어야 실제로 나온다 — id_keep_check가 확인) */
export const SNACK_WEIGHT: [string, number][] = [['bone', 3], ['fish', 3], ['cookie', 2], ['milk', 2], ['meat', 1], ['churu', 1],
  // 새 간식(10-15): 1점 = 2, 2점 = 1, 케이크(3점) = 1
  ['sweetpotato', 2], ['carrot', 2], ['shrimp', 2], ['catgrass', 2], ['apple', 2], ['watermelon', 2], ['cheese', 2],
  ['jerky', 1], ['chicken', 1], ['tuna', 1], ['salmon', 1], ['egg', 1], ['dogcake', 1], ['catcake', 1]];
export function randomSnack(): string {
  const tot = SNACK_WEIGHT.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * tot;
  for (const [id, w] of SNACK_WEIGHT) { r -= w; if (r < 0) return id; }
  return 'cookie';
}

/** 받을 꾸미기 아이템: 아직 없는 것 중 무작위 (10-23 사용자 요청: 늘 같은 순서 말고 여러 가지가 섞여 나오게).
 *  종류(모자·옷·안경·목걸이·신발·장난감)를 먼저 고르게 뽑고 그 안에서 하나 — 옷이 많아도 한쪽으로 몰리지 않게,
 *  바로 전에 받은 것과 같은 종류는 되도록 피한다. 다 모았으면 null */
export function randomDrop(s = load()): string | null {
  const left = ITEM_LIST.filter(i => !hasItem(i.id, s));
  if (!left.length) return null;
  const slots = [...new Set(left.map(i => i.slot))];
  const prev = s.lastItem ? ITEM[s.lastItem]?.slot : undefined;
  const pool = slots.length > 1 ? slots.filter(sl => sl !== prev) : slots;
  const sl = pool[Math.floor(Math.random() * pool.length)];
  const inSlot = left.filter(i => i.slot === sl);
  return inSlot[Math.floor(Math.random() * inSlot.length)].id;
}
/** 꾸미기 아이템 하나 받기 (다 모았으면 null) */
function giveItem(): Gift | null {
  const it = randomDrop();
  if (!it) return null;
  addOwned(it); setLastItem(it);
  return { kind: 'item', id: it };
}

/** 이 단계를 끝냈을 때 받을 선물 (없으면 null). 받은 것은 바로 저장 */
export function giftFor(stepType: string): Gift | null {
  if (GAMES.has(stepType)) {
    addGame();
    // 놀이 3번마다 꾸미기 아이템 하나, 그다음 놀이에서는 집 짓기 재료 하나
    const n = gamesTotal();
    if (n % 3 === 0) {
      const it = giveItem();
      if (it) return it;
    }
    // 재료는 집 짓기·집 안 가구·놀이터 기구에 쓰므로 계속 받는다
    if (n % 3 === 1) { addMat(); return { kind: 'mat', id: 'mat' }; }
    const sn = randomSnack(); addSnack(sn); return { kind: 'snack', id: sn };
  }
  // 받아쓰기 시험 통과: 재료 하나 더
  if (stepType === 'dictation') { addMat(); return { kind: 'mat', id: 'mat' }; }
  // 쓰기 세트를 끝내면 4번 중 3번은 꾸미기 아이템, 1번은 간식 (10-23 사용자 요청: 간식보다 꾸미기가 더 많이 나오게)
  // 쓰기 세트 사이에는 놀이가 하나씩 있으므로 놀이 수로 순서를 정한다(새 저장 칸 없음). 꾸미기를 다 모았으면 간식
  if (TRACE.has(stepType)) {
    if (gamesTotal() % 4 !== 3) {
      const it = giveItem();
      if (it) return it;
    }
    const sn = randomSnack(); addSnack(sn); return { kind: 'snack', id: sn };
  }
  return null;
}

// ---------- 선물 뽑기 (10-23 사용자 요청: 아이가 더 자주 하고 싶어 함 → 하루 4번쯤) ----------
/** 뽑기 기계에서 나오는 것: 꾸미기 하나(무작위), 다 모았으면 간식 셋 */
export function gachaPrize(): { item: string | null; snacks: string[] } {
  const it = randomDrop();
  if (it) { addOwned(it); setLastItem(it); return { item: it, snacks: [] }; }
  const snacks = [randomSnack(), randomSnack(), randomSnack()];
  snacks.forEach(x => addSnack(x));
  return { item: null, snacks };
}
/** 모험 중 뽑기는 하루 3번까지 — 모험 끝 뽑기를 더하면 하루 4번쯤 */
export const GACHA_PER_DAY = 3;
/** 오늘 쓴 시간으로 본 뽑기 칸: 하루 공부 시간을 4로 나눈 만큼(기본 30분 → 7분 30초, 무제한이면 8분)마다 한 칸.
 *  오늘 쓴 시간(두 기기 합계)만 보므로 새 저장 칸이 없다 */
export function gachaSlot(todayMs: number, dailyMin: number): number {
  const every = Math.max(5, dailyMin > 0 ? dailyMin / 4 : 8) * 60000;
  return Math.min(GACHA_PER_DAY, Math.floor(todayMs / every));
}
/** 이 단계를 끝냈을 때 선물 대신 뽑기를 할지: 선물 주는 놀이·쓰기이고, 지난번 뽑기 뒤 다음 칸에 들어왔을 때 */
export function wantsGacha(stepType: string, slotNow: number, slotDone: number): boolean {
  return (GAMES.has(stepType) || TRACE.has(stepType)) && slotNow > slotDone;
}
/** 뽑기로 바꾼 단계도 끝낸 놀이 수는 센다 (선물 순서용) */
export function countStep(stepType: string) { if (GAMES.has(stepType)) addGame(); }
