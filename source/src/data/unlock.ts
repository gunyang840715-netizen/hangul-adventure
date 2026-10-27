// 레벨업으로 열리는 것 (10-27 사용자 요청: 레벨업 되살림 — 레벨이 올라도 크기는 그대로, 언제나 아기 모습(Pet.tsx growthOf = 0).
// 대신 레벨이 올라야 꾸미기 착용·집 짓기·놀이터 짓기를 단계별로 할 수 있다). 한글·수학 모드가 같은 표를 쓴다.
// - 레벨 = 그 친구가 먹은 간식 점수(한글 growth / 수학 fed+fedPlus) → pets.ts levelOf (점수표 LEVELS 그대로, Lv.1~10). 저장 칸은 그대로.
// - 꾸미기 착용: 그 친구의 레벨 (친구마다 따로)
// - 강아지 집·고양이 집 짓기: 지금 그 집에 사는 친구(고른 강아지·고른 고양이)의 레벨
// - 놀이터 짓기: 지금 강아지·고양이 중 높은 레벨
// - 이미 입힌 것·이미 지은 부분·다 지은 집의 꾸미기는 그대로 둔다(기록을 바꾸지 않음).
//   잠긴 동안 못 하는 것은 그 종류를 새로 입히기·벗기기와 다음 부분 짓기뿐.
import { BUILD, SLOTS, SLOT_ICON, SLOT_NAME, MAX_LEVEL, type Slot, type Species } from './pets';

export type BuildId = 'doghouse' | 'cathouse' | 'park';

/** 꾸미기 종류마다 입힐 수 있게 되는 레벨 — 옷장 칸 순서(모자·옷·안경·목걸이·신발·장난감)대로 한 레벨에 하나씩 */
export const WEAR_LV: Record<Slot, number> = { hat: 2, clothes: 3, glasses: 4, neck: 5, shoes: 6, toy: 7 };

/** 집 짓기 부품(BUILDS의 부품 순서)마다 지을 수 있게 되는 레벨 — 집은 Lv.2~5에 두 부분씩, 놀이터는 Lv.7~10에 두 부분씩 */
export const BUILD_LV: Record<BuildId, number[]> = {
  doghouse: [2, 2, 3, 3, 4, 4, 5, 5],   // 바닥·벽 / 지붕·문 / 창문·이름표 / 방석·밥그릇
  cathouse: [2, 2, 3, 3, 4, 4, 5, 5],   // 바닥·벽 / 지붕·동그란 문 / 창문·캣타워 / 방석·밥그릇
  park: [7, 7, 8, 8, 9, 9, 10, 10],     // 모래밭·미끄럼틀 / 그네·시소 / 터널·큰 공 / 꽃밭·벤치
};

/** 그 부품(0부터)을 짓는 데 필요한 레벨 (모르는 짓기는 잠그지 않음, 표 뒤에 더해진 부품은 마지막 값) */
export function partLv(id: string, i: number): number {
  const t = BUILD_LV[id as BuildId];
  if (!t || !t.length) return 1;
  return t[Math.min(Math.max(0, i), t.length - 1)];
}

/** 그 친구 레벨로 이 종류를 입힐 수 있나 */
export const canWear = (slot: Slot, level: number) => level >= (WEAR_LV[slot] ?? 1);

/** 짓기에 쓰는 레벨: 강아지 집은 강아지, 고양이 집은 고양이, 놀이터는 둘 중 높은 레벨 */
export function buildLevel(id: string, dogLv: number, catLv: number) {
  return id === 'doghouse' ? dogLv : id === 'cathouse' ? catLv : Math.max(dogLv, catLv);
}

/** 다음 부분(이미 지은 수 n → n번째 부품)이 잠겼으면 필요한 레벨, 지을 수 있거나 다 지었으면 0 */
export function buildLock(id: string, n: number, dogLv: number, catLv: number): number {
  const b = BUILD[id];
  if (!b || n >= b.parts.length) return 0;
  const need = partLv(id, n);
  return buildLevel(id, dogLv, catLv) >= need ? 0 : need;
}

export type Unlock = { kind: 'wear'; slot: Slot } | { kind: 'build'; id: BuildId; parts: string[] };

/** 레벨이 from → to로 오를 때 새로 열리는 것.
 *  sp: 레벨이 오른 친구가 강아지인지 고양이인지 · otherLv: 다른 쪽(고양이·강아지) 친구 레벨(놀이터는 둘 중 높은 레벨이라 이미 열린 것은 뺌)
 *  built: 짓기마다 지은 부분 수(이미 지은 부분은 빼고 알려 줌) */
export function opensFor(from: number, to: number, sp: Species, otherLv: number, built: (id: string) => number): Unlock[] {
  const out: Unlock[] = [];
  const house: BuildId = sp === 'dog' ? 'doghouse' : 'cathouse';
  for (let lv = Math.max(1, from) + 1; lv <= Math.min(to, MAX_LEVEL); lv++) {
    for (const sl of SLOTS) if (WEAR_LV[sl] === lv) out.push({ kind: 'wear', slot: sl });
    for (const id of [house, 'park'] as BuildId[]) {
      if (id === 'park' && lv <= otherLv) continue;          // 다른 친구가 이미 열어 둔 놀이터 부분
      const b = BUILD[id];
      if (!b) continue;
      const n = built(id);
      const parts = b.parts.filter((_, i) => i >= n && partLv(id, i) === lv).map(p => p.name);
      if (parts.length) out.push({ kind: 'build', id, parts });
    }
  }
  return out;
}

/** 이름표에 '다음'으로 보여 줄 것: 다음 레벨에 열릴 것 (최고 레벨이면 없음) */
export function nextOpens(level: number, sp: Species, otherLv: number, built: (id: string) => number): Unlock[] {
  return level >= MAX_LEVEL ? [] : opensFor(level, level + 1, sp, otherLv, built);
}

/** 화면에 보일 아이콘·이름 (아이는 글을 못 읽으니 아이콘이 먼저) */
export const unlockIcon = (u: Unlock) => (u.kind === 'wear' ? SLOT_ICON[u.slot] : u.id === 'park' ? '🛝' : '🏠');
export const unlockLabel = (u: Unlock) => (u.kind === 'wear' ? SLOT_NAME[u.slot] : u.parts.join('·'));

/** 부모 설정 안내용: 레벨마다 열리는 것 (짓기 상태와 상관없이) — '모자 · 집(바닥·벽)' 꼴.
 *  강아지 집·고양이 집은 같은 레벨이라 '집' 하나로(부품 이름이 다르면 '이름표/캣타워') */
export function unlockTable(): { lv: number; text: string }[] {
  const short = (n: string) => n.split(' ').pop() || n;   // '폭신한 방석' → '방석', '동그란 문' → '문'
  const rows: { lv: number; text: string }[] = [];
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    const t: string[] = [];
    for (const sl of SLOTS) if (WEAR_LV[sl] === lv) t.push(SLOT_NAME[sl]);
    const dog = BUILD.doghouse, cat = BUILD.cathouse, park = BUILD.park;
    const house = dog.parts.map((p, i) => ({ i, name: [...new Set([short(p.name), short(cat.parts[i]?.name ?? p.name)])].join('/') }))
      .filter(x => partLv('doghouse', x.i) === lv).map(x => x.name);
    if (house.length) t.push(`집(${house.join('·')})`);
    const pk = park.parts.filter((_, i) => partLv('park', i) === lv).map(p => p.name);
    if (pk.length) t.push(`놀이터(${pk.join('·')})`);
    if (t.length) rows.push({ lv, text: t.join(' · ') });
  }
  return rows;
}
