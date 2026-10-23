// 수학 모드 기록 읽기·쓰기 (State.math 한 칸만 — 한글 진도·옷장·시간은 건드리지 않는다)
// @ts-ignore  (공용 JS)
import { sumMap } from '../../shared/merge.js';
import { load, save, dev, today, type Wear } from '../engine/store';
import { randomItemFrom } from '../engine/gifts';
import { PET, type Slot } from '../data/pets';
import { freshMath, ITEM_EVERY, PASS_RATE, STAGES, type MathState } from './mathData';

/** 읽기용 (아직 수학을 안 했으면 처음 상태) */
export function mathState(): MathState { return load().math ?? freshMath(); }
/** 고치기용: 없으면 이때 만든다 */
function edit(): MathState {
  const s = load();
  if (!s.math) s.math = freshMath();
  return s.math;
}
const dayKey = () => String(today());
const bump = (m: Record<string, number>, n = 1) => { const d = dev(); m[d] = (m[d] || 0) + n; };

export function todayMath(m = mathState()) {
  const d = dayKey();
  return { solved: sumMap(m.solved[d]), correct: sumMap(m.correct[d]), perDay: m.perDay };
}
export const mathTotalCorrect = (m = mathState()) => sumMap(m.total) as number;
/** 다음 꾸미기까지 남은 정답 수 (1~10) */
export const toNextItem = (m = mathState()) => ITEM_EVERY - (mathTotalCorrect(m) % ITEM_EVERY);

export interface AnswerResult { item: string | null; finished: boolean; leveledUp: boolean }
/** 한 문제를 풀었을 때: 기록 → 정답 10개마다 꾸미기 하나 → 오늘 문제를 다 풀었으면 90% 이상일 때 다음 단계 */
export function answerMath(ok: boolean): AnswerResult {
  const m = edit();
  const d = dayKey();
  const before = todayMath(m).solved;
  bump(m.solved[d] ||= {});
  if (ok) { bump(m.correct[d] ||= {}); bump(m.total); }
  let item: string | null = null;
  // 합친 기록 기준으로 받을 개수만큼 (두 기기에서 따로 받아도 모자라거나 넘치지 않게)
  if (ok && Math.floor(mathTotalCorrect(m) / ITEM_EVERY) > m.owned.length) {
    item = randomItemFrom(id => m.owned.includes(id), m.lastItem);
    if (item) { m.owned = [...m.owned, item].sort(); m.lastItem = item; m.lastItemT = Date.now(); }
  }
  const t = todayMath(m);
  const finished = before < m.perDay && t.solved >= m.perDay;
  let leveledUp = false;
  if (finished && t.correct >= Math.ceil(m.perDay * PASS_RATE) && m.level < STAGES.length - 1) {
    m.level += 1; m.levelT = Date.now(); leveledUp = true;
  }
  save();
  return { item, finished, leveledUp };
}

// ---------- 부모 설정 ----------
export function setMathLevel(i: number) { const m = edit(); m.level = Math.max(0, Math.min(STAGES.length - 1, i)); m.levelT = Date.now(); save(); }
export function setMathPerDay(n: number) { const m = edit(); m.perDay = n; m.perDayT = Date.now(); save(); }

// ---------- 언니 옷장 ----------
export const mathPet = (m = mathState()) => (m.pet && PET[m.pet] ? m.pet : 'maltese');
export function setMathPet(id: string) { if (!PET[id]) return; const m = edit(); m.pet = id; m.petT = Date.now(); save(); }
export const mathWear = (pet: string, m = mathState()): Wear => m.wear[pet] || {};
/** 입히기·벗기기 (같은 종류는 하나만) */
export function toggleMathWear(pet: string, slot: Slot, key: string) {
  const m = edit();
  const w: Wear = { ...(m.wear[pet] || {}) };
  if (w[slot] === key) delete w[slot]; else w[slot] = key;
  m.wear = { ...m.wear, [pet]: w };
  m.wearT = { ...m.wearT, [pet]: Date.now() };
  save();
}
