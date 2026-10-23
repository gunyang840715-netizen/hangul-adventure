// 놀이를 끝낼 때마다 받는 선물: 간식(키우기) 또는 꾸미기 아이템
import { addGame, gamesTotal, nextDrop, addOwned, addSnack, setLastItem, addMat } from './store';

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

/** 이 단계를 끝냈을 때 받을 선물 (없으면 null). 받은 것은 바로 저장 */
export function giftFor(stepType: string): Gift | null {
  if (GAMES.has(stepType)) {
    addGame();
    // 놀이 3번마다 꾸미기 아이템 하나, 그다음 놀이에서는 집 짓기 재료 하나
    const n = gamesTotal();
    if (n % 3 === 0) {
      const it = nextDrop();
      if (it) { addOwned(it); setLastItem(it); return { kind: 'item', id: it }; }
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
      const it = nextDrop();
      if (it) { addOwned(it); setLastItem(it); return { kind: 'item', id: it }; }
    }
    const sn = randomSnack(); addSnack(sn); return { kind: 'snack', id: sn };
  }
  return null;
}
