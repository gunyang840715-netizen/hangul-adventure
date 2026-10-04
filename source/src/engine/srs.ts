// 간격 반복(라이트너 상자). 첫 시도에 맞히면 상자 올라가고, 틀리면 내려간다.
import { load, save, today, type ItemStat } from './store';

const INTERVAL = [0, 1, 2, 4, 7, 15];

export function stat(id: string): ItemStat {
  const s = load();
  return s.items[id] ?? { box: 0, due: 0, seen: 0, right: 0, wrong: 0, last: -1 };
}

export function introduce(id: string) {
  const s = load();
  if (!s.items[id]) s.items[id] = { box: 1, due: today() + 1, seen: 0, right: 0, wrong: 0, last: today() };
  save();
}

/** 이미 익힌 것으로 처리 (부모가 단계 건너뛸 때) */
export function markKnown(id: string) {
  const s = load();
  if (!s.items[id] || s.items[id].box < 3) s.items[id] = { box: 3, due: today() + 4, seen: 1, right: 1, wrong: 0, last: today() - 1 };
}

export function record(id: string, firstTry: boolean) {
  const s = load();
  const t = today();
  const it = s.items[id] ?? { box: 1, due: t, seen: 0, right: 0, wrong: 0, last: -1 };
  it.seen++;
  if (firstTry) {
    it.right++;
    if (it.last !== t) { it.box = Math.min(5, it.box + 1); it.due = t + INTERVAL[it.box]; }
  } else {
    it.wrong++;
    it.box = Math.max(1, it.box - 1);
    it.due = t;
  }
  it.last = t;
  s.items[id] = it;
  save();
}

/** 복습할 때가 된 것 (가장 급한 순) */
export function dueItems(ids: string[]): string[] {
  const t = today();
  return ids
    .filter(id => load().items[id] && stat(id).due <= t)
    .sort((a, b) => stat(a).box - stat(b).box || stat(a).due - stat(b).due);
}

/** 약한 순으로 가중치 뽑기 */
export function weighted(ids: string[], n: number): string[] {
  const pool = ids.map(id => ({ id, w: 1 / (0.6 + stat(id).box) + Math.random() * 0.4 }));
  pool.sort((a, b) => b.w - a.w);
  return pool.slice(0, n).map(p => p.id);
}
