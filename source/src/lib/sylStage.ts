// 글자 합치기 진도 (2026-11-12 사용자 요청 — data/syllables.ts)
//  · 첫 '낱말' 단계 바로 앞에서 한다: 자음·모음을 다 배운 뒤(지금 할 단계가 첫 낱말 단계 이후)이고 안 끝낸 줄이 있으면 낱말 단계보다 먼저.
//  · 새 저장 칸 없음 — 이미 있는 칸만 쓴다 (store.ts의 State 구조·shared/merge.js·저장 키·진도표 curriculum.ts는 그대로):
//      줄 통과 표시   State.items['sy:' + 모음]  (글자별 기록과 같은 모양, box ≥ 1 = 통과. 두 기기 합치기는 기존 규칙대로 '더 많이 한 쪽')
//      다음날 복습    State.lastPass(lesson = 1000 + 줄, items = 시험 본 글자) · reviewDay — 기존 복습 시험 칸 그대로
//      하루 새 단계   lessonsByDay (줄 하나 = 새 단계 하나)
//    한글 단계 번호(lessonIdx)와 hold(다시 공부할 단계)는 건드리지 않는다 → 낱말·받침 단계 진도는 그대로 남는다.
//  · 아직 업데이트 안 된 기기: 'sy:' 기록은 모르는 열쇠라 그냥 지나가고, lastPass.lesson이 1000번대라 복습 시험·다시 공부(hold)를 만들지 않는다.
//  · 규칙은 다른 단계와 같다: 그날 끝 받아쓰기 시험을 통과해야 그 줄 통과 / 다음날 복습 시험에 떨어지면 그 줄을 다시.
import { load, save, today, curLesson, reviewDue, replaceAll, type State, type ItemStat } from '../engine/store';
import { SYL_VOWELS, SYL_ROW_COUNT, SYL_GATE, sylIdx, isSylIdx, sylRowOfIdx } from '../data/syllables';

const keyOf = (r: number) => 'sy:' + SYL_VOWELS[r];

/** 그 줄을 통과했나 */
export function sylRowDone(r: number, s: State = load()): boolean { return (s.items[keyOf(r)]?.box ?? 0) >= 1; }
/** 통과한 줄 수 */
export function sylDoneCount(s: State = load()): number { let n = 0; for (let r = 0; r < SYL_ROW_COUNT; r++) if (sylRowDone(r, s)) n++; return n; }
/** 다음에 할 줄 (다 끝냈으면 -1) */
export function sylNext(s: State = load()): number { for (let r = 0; r < SYL_ROW_COUNT; r++) if (!sylRowDone(r, s)) return r; return -1; }
/** 지금 글자 합치기를 할 차례인가 */
export function sylActive(s: State = load()): boolean { return curLesson(s) >= SYL_GATE && sylNext(s) >= 0; }
/** 지금 할 모험 번호: 글자 합치기 차례면 1000 + 줄, 아니면 한글 단계 번호 */
export function curTask(s: State = load()): number { return sylActive(s) ? sylIdx(sylNext(s)) : curLesson(s); }

function stamp(s: State, r: number, pass: boolean) {
  const t = today();
  const cur = s.items[keyOf(r)];
  const it: ItemStat = cur ? { ...cur } : { box: 0, due: t, seen: 0, right: 0, wrong: 0, last: -1 };
  it.seen++;   // 통과·다시 공부가 바뀔 때마다 하나씩 → 두 기기를 합칠 때 나중 것이 이김
  if (pass) { it.right++; it.box = Math.max(1, Math.min(5, it.box + 1)); it.due = t + 1; }
  else { it.wrong++; it.box = 0; it.due = t; }
  it.last = t;
  s.items = { ...s.items, [keyOf(r)]: it };
}

/** 줄 시험 통과: 그 줄을 통과로 표시하고, 내일 복습할 글자를 적어 둔다 (한글 단계 번호는 그대로) */
export function passSylRow(r: number, items: string[]) {
  const s = load();
  stamp(s, r, true);
  if (items.length) { s.lastPass = { lesson: sylIdx(r), day: today(), items: items.slice(0, 12) }; s.lastPassT = Date.now(); }
  save();
}

/** 마지막으로 통과한 것이 글자 합치기 줄이면 그 줄 번호, 아니면 -1 */
export function sylPassRow(s: State = load()): number {
  const lp = s.lastPass;
  return lp && isSylIdx(lp.lesson) ? sylRowOfIdx(lp.lesson) : -1;
}

/** 어제(이전에) 통과한 줄의 복습 시험을 볼 차례인가 — 그 줄 바로 다음 것을 시작할 때, 하루 한 번 */
export function sylReviewDue(s: State = load()): boolean {
  const lp = s.lastPass;
  const r = sylPassRow(s);
  if (r < 0 || !lp || !lp.items || !lp.items.length) return false;
  if (lp.day >= today() || s.reviewDay === today()) return false;
  if (!sylRowDone(r, s) || curLesson(s) < SYL_GATE) return false;
  const next = sylNext(s);
  return (next < 0 ? SYL_ROW_COUNT : next) === r + 1;
}

/** 다음날 공부 전 복습 시험: 'syl' = 어제 통과한 글자 합치기 줄 / 'lesson' = 어제 통과한 단계(기존 규칙) / null = 볼 것 없음 */
export function reviewKind(s: State = load()): 'syl' | 'lesson' | null {
  if (sylPassRow(s) >= 0) return sylReviewDue(s) ? 'syl' : null;
  return reviewDue(s) ? 'lesson' : null;
}

/** 줄 복습 시험에 떨어짐 → 그 줄을 다시 공부 (통과 표시를 거둠) */
export function failSylReview() {
  const s = load();
  const r = sylPassRow(s);
  if (r < 0) return;
  stamp(s, r, false);
  s.resume = null; s.resumeT = Date.now();
  save();
}

/** 복습 시험에 떨어져 줄을 다시 공부하는 중인가 (지도에서 '한 번 더 공부하자' 말하기) */
export function sylRedo(s: State = load()): boolean {
  const r = sylPassRow(s);
  return r >= 0 && !sylRowDone(r, s) && sylActive(s) && sylNext(s) === r;
}

/**
 * 부모 설정: 다음에 할 줄을 고른다 — 그 앞 줄은 통과한 것으로, 그 줄부터는 안 한 것으로. k가 줄 수(10)면 모두 통과(건너뛰기).
 * 통과 표시를 지우는 일은 두 기기 합치기로 전해지지 않으므로, 단계 옮기기처럼 새 epoch로 두 기기가 이 상태를 따르게 한다.
 */
export function setSylNext(k: number) {
  const n: State = JSON.parse(JSON.stringify(load()));
  const t = today();
  for (let r = 0; r < SYL_ROW_COUNT; r++) {
    const key = keyOf(r);
    if (r < k) {
      if ((n.items[key]?.box ?? 0) < 1) n.items[key] = { box: 3, due: t + 4, seen: (n.items[key]?.seen ?? 0) + 1, right: 1, wrong: 0, last: t - 1 };
    } else delete n.items[key];
  }
  // 고른 줄부터 바로 시작: 줄 복습 기록·하던 줄 모험은 지우고, 오늘 새 단계 수는 0부터
  if (n.lastPass && isSylIdx(n.lastPass.lesson)) { n.lastPass = null; n.lastPassT = Date.now(); }
  if (n.resume && isSylIdx(n.resume.lessonIdx)) { n.resume = null; n.resumeT = Date.now(); }
  n.lessonsByDay[String(t)] = {};
  n.extraLessons[String(t)] = {};
  replaceAll(n);
}
