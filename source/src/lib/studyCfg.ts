// 공부량 자세히 (2026-11-07 사용자 요청: "진도랑 하루 공부량이랑 다 디테일하게 내가 일일이 수정할 수 있게 —
//  한글이랑 수학이랑 횟수랑 시간이랑 다"). 부모 설정에서 고치는 값과 그 범위·기본값을 한곳에 둔다.
//  · 저장: 새 State 칸 없이 기존 settings 주머니 안의 선택 칸 study 하나(공부 먼저의 settings.gate와 같은 방식).
//    store.ts의 State 구조·shared/merge.js·저장 키는 그대로이고, 두 기기 연동은 settings와 함께(settingsT 나중에 바꾼 쪽) 따라간다.
//    칸이 없으면(예전 저장 데이터) 아래 기본값 = 지금까지의 규칙 그대로(새 글자 10번×4세트, 받아쓰기 글자마다 2번,
//    수학 한 항목 하루 150문제, 20문제 이상·90%면 다음 단계).
//  · 이미 있던 설정은 원래 자리를 그대로 쓰고 범위만 넓힌다:
//    한글 하루 사용 시간(settings.dailyMin) · 하루 새 단계(newPerDay) · 받침·낱말 쓰기 횟수(traceReps) · 받아쓰기 통과 기준(testPass),
//    수학 하루 공부 시간(State.math.dayMin) · 문제 시간 배율(State.math.timeMul).
import { load, setSettings, type State } from '../engine/store';

export interface StudyStored {
  ls?: number;            // 새 글자 쓰기 세트 수 (세트마다 끝나면 놀이 한 판)
  lr?: number;            // 새 글자 쓰기 한 세트의 횟수
  dr?: number;            // 받아쓰기 시험: 글자마다 몇 번 묻나
  sr?: number;            // 글자 합치기(가~휴): 글자마다 쓰는 횟수 (11-12)
  cm?: number;            // 수학·맞춤법: 한 항목 하루 최대 문제 수
  um?: number;            // 수학: 다음 단계 판정에 필요한 그날 최소 문제 수
  up?: number;            // 수학: 다음 단계 정답률(%)
}

// settings 주머니에 선택 칸 하나만 더한다 (store.ts의 State 구조는 그대로)
declare module '../engine/store' {
  interface Settings { study?: StudyStored }
}

export interface Range { min: number; max: number; step: number; def: number }
/** 부모 설정에서 고를 수 있는 범위 (기본값 = 지금까지의 규칙) */
export const RANGE = {
  // 한글
  dailyMin: { min: 5, max: 180, step: 5, def: 30 },       // 하루 사용 시간(분) — 0은 '제한 없음'
  newPerDay: { min: 1, max: 10, step: 1, def: 1 },        // 하루 새 단계
  ls: { min: 1, max: 8, step: 1, def: 4 },                // 새 글자 세트 수
  lr: { min: 1, max: 15, step: 1, def: 10 },              // 새 글자 세트당 횟수 (숫자 세기 말이 15까지)
  traceReps: { min: 1, max: 15, step: 1, def: 10 },       // 받침·낱말 한 세트 횟수
  dr: { min: 1, max: 4, step: 1, def: 2 },                // 받아쓰기 글자마다
  sr: { min: 1, max: 15, step: 1, def: 5 },               // 글자 합치기: 글자마다 쓰는 횟수 (하루 한 줄 14글자)
  testPass: { min: 10, max: 100, step: 10, def: 80 },     // 받아쓰기 통과 기준(%)
  // 수학·맞춤법
  dayMin: { min: 5, max: 180, step: 5, def: 30 },         // 하루 공부 시간(분)
  cm: { min: 10, max: 500, step: 10, def: 150 },          // 한 항목 하루 최대 문제
  um: { min: 5, max: 200, step: 5, def: 20 },             // 다음 단계: 그날 최소 문제
  up: { min: 50, max: 100, step: 5, def: 90 },            // 다음 단계: 정답률(%)
  timeMul: { min: 0.25, max: 3, step: 0.25, def: 1 },     // 문제 시간 배율 — 0은 '끄기'
} as const satisfies Record<string, Range>;

/** 범위 안의 값으로 (이상한 값은 기본값) */
export function fit(v: unknown, r: Range): number {
  if (typeof v !== 'number' || !isFinite(v)) return r.def;
  if (v < r.min - 1e-9 || v > r.max + 1e-9) return r.def;
  return +(Math.round(v / r.step) * r.step).toFixed(2);
}

const stored = (s: State): StudyStored => {
  const g = (s.settings as { study?: unknown }).study;
  return g && typeof g === 'object' ? (g as StudyStored) : {};
};
const get = (k: keyof StudyStored, s: State = load()) => fit(stored(s)[k], RANGE[k]);

/** 새 글자 쓰기: 세트 수 · 세트당 횟수 */
export const letterSetCount = (s?: State) => get('ls', s);
export const letterReps = (s?: State) => get('lr', s);
/** 받아쓰기: 글자마다 몇 번 */
export const dictReps = (s?: State) => get('dr', s);
/** 글자 합치기(가~휴): 글자마다 쓰는 횟수 */
export const sylReps = (s?: State) => get('sr', s);
/** 수학·맞춤법: 한 항목 하루 최대 문제 수 */
export const catMax = (s?: State) => get('cm', s);
/** 수학 다음 단계: 그날 최소 문제 수 · 정답률(0~1) */
export const upMin = (s?: State) => get('um', s);
export const passRate = (s?: State) => get('up', s) / 100;

/** 부모 설정 쓰기 (settings.study 한 칸만 바꿈 — 나머지 설정은 그대로) */
export function setStudy(p: StudyStored) {
  const cur = stored(load());
  setSettings({ study: { ...cur, ...p } });
}
