// 수학 모드 기록 읽기·쓰기 (State.math 한 칸만 — 한글 진도·옷장·집·시간은 건드리지 않는다)
// @ts-ignore  (공용 JS)
import { sumMap } from '../../shared/merge.js';
import { load, save, dev, today, type Wear, type PetView } from '../engine/store';
import { randomItemFrom } from '../engine/gifts';
import { PET, BUILDS, BUILD, type Slot, type Species } from '../data/pets';
import { freshMath, ITEM_EVERY, MAT_EVERY, PASS_RATE, UP_MIN, CATS, type Cat, type MathState } from './mathData';

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

/** 화면에 보일 이름 (부모 설정에서 넣은 것, 없으면 '') */
export const mathName = (m = mathState()) => m.name;
/** '○○ 옷장'처럼 쓸 앞말: 이름이 있으면 이름, 없으면 '내' */
export const mathWho = (m = mathState()) => m.name || '내';

export function todayMath(m = mathState()) {
  const d = dayKey();
  return { solved: sumMap(m.solved[d]) as number, correct: sumMap(m.correct[d]) as number, perDay: m.perDay };
}
/** 오늘 그 항목 기록 */
export function todayCat(cat: Cat, m = mathState()) {
  const k = dayKey() + ':' + cat;
  return { solved: sumMap(m.solvedC[k]) as number, correct: sumMap(m.correctC[k]) as number };
}
export const mathTotalCorrect = (m = mathState()) => sumMap(m.total) as number;
/** 다음 꾸미기까지 남은 정답 수 (1~10) */
export const toNextItem = (m = mathState()) => ITEM_EVERY - (mathTotalCorrect(m) % ITEM_EVERY);

export interface AnswerResult { item: string | null; mat: boolean; finished: boolean; ups: Cat[] }
/** 한 문제를 풀었을 때(시간이 다 되면 틀린 것으로): 기록 → 정답 10개마다 꾸미기·5개마다 재료 →
 *  오늘 문제를 다 풀었으면 그날 20문제 이상 푼 항목 중 90% 이상인 항목을 다음 단계로 */
export function answerMath(ok: boolean, cat: Cat): AnswerResult {
  const m = edit();
  const d = dayKey(), dc = d + ':' + cat;
  const before = todayMath(m).solved;
  bump(m.solved[d] ||= {});
  bump(m.solvedC[dc] ||= {});
  if (ok) { bump(m.correct[d] ||= {}); bump(m.correctC[dc] ||= {}); bump(m.total); }
  let item: string | null = null;
  // 합친 기록 기준으로 받을 개수만큼 (두 기기에서 따로 받아도 모자라거나 넘치지 않게)
  if (ok && Math.floor(mathTotalCorrect(m) / ITEM_EVERY) > m.owned.length) {
    item = randomItemFrom(id => m.owned.includes(id), m.lastItem);
    if (item) { m.owned = [...m.owned, item].sort(); m.lastItem = item; m.lastItemT = Date.now(); }
  }
  const mat = ok && mathTotalCorrect(m) % MAT_EVERY === 0;
  const t = todayMath(m);
  const finished = before < m.perDay && t.solved >= m.perDay;
  const ups: Cat[] = [];
  if (finished) {
    const need = Math.min(UP_MIN, m.perDay);
    for (const c of CATS) {
      const r = todayCat(c.id, m);
      if (r.solved >= need && r.correct >= Math.ceil(r.solved * PASS_RATE) && m.lv[c.id] < c.stages.length - 1) {
        m.lv = { ...m.lv, [c.id]: m.lv[c.id] + 1 }; m.lvT = { ...m.lvT, [c.id]: Date.now() }; ups.push(c.id);
      }
    }
  }
  save();
  return { item, mat, finished, ups };
}

// ---------- 부모 설정 ----------
export function setMathLv(cat: Cat, i: number) {
  const m = edit(); const n = CATS.find(c => c.id === cat)!.stages.length;
  m.lv = { ...m.lv, [cat]: Math.max(0, Math.min(n - 1, i)) }; m.lvT = { ...m.lvT, [cat]: Date.now() }; save();
}
export function setMathPerDay(n: number) { const m = edit(); m.perDay = n; m.perDayT = Date.now(); save(); }
export function setMathTime(mul: number) { const m = edit(); m.timeMul = mul; m.timeMulT = Date.now(); save(); }
export function setMathName(name: string) { const m = edit(); m.name = name.trim().slice(0, 10); m.nameT = Date.now(); save(); }

// ---------- 옷장 · 집에 사는 친구 ----------
export const mathPet = (m = mathState()) => (m.pet && PET[m.pet] ? m.pet : 'maltese');
/** 옷장에서 고른 친구 — 강아지면 강아지 집, 고양이면 고양이 집에 산다 */
export function setMathPet(id: string) {
  const d = PET[id]; if (!d) return;
  const m = edit(); const now = Date.now();
  m.pet = id; m.petT = now;
  if (d.species === 'dog') m.dog = id; else m.cat = id;
  if (!m.dog) m.dog = 'maltese';
  if (!m.cat) m.cat = 'koshort';
  m.petsT = now;
  save();
}
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
/** 수학 집의 강아지·고양이 (다 자란 모습, 수학 옷장에서 입힌 것) */
export function mathPetView(sp: Species, m = mathState()): PetView {
  const id = sp === 'dog' ? (m.dog && PET[m.dog] ? m.dog : 'maltese') : (m.cat && PET[m.cat] ? m.cat : 'koshort');
  const d = PET[id];
  return { id, species: d.species, name: d.name, breed: d.breed, wear: m.wear[id] || {}, points: 63, level: 10, stage: 'adult' };
}

// ---------- 집 짓기·집 안·마당·놀이터 (한글 집과 따로) ----------
/** 재료: 정답 5개마다 하나 (지은 부분·산 가구만큼 씀) */
export function mathMatsLeft(m = mathState()) {
  const got = Math.floor(mathTotalCorrect(m) / MAT_EVERY);
  const built = BUILDS.reduce((a, b) => a + (sumMap(m.built[b.id]) as number), 0);
  return Math.max(0, got - built - Object.keys(m.bought).length);
}
export function mathBuiltCount(id: string, m = mathState()) { return Math.min(BUILD[id]?.parts.length ?? 0, sumMap(m.built[id]) as number); }
export function mathBuildPart(id: string) {
  const m = edit();
  const b = BUILD[id];
  if (!b || mathMatsLeft(m) <= 0 || mathBuiltCount(id, m) >= b.parts.length) return null;
  bump(m.built[id] ||= {});
  save();
  return mathBuiltCount(id, m);
}
export function mathNextBuild(m = mathState()) { return BUILDS.find(b => mathBuiltCount(b.id, m) < b.parts.length) ?? null; }
export function mathDecoOf(place: string, m = mathState()) { return m.deco[place] || {}; }
export function mathSetDeco(place: string, slot: string, id: string | null) {
  const m = edit();
  const d = { ...(m.deco[place] || {}) };
  if (id) d[slot] = id; else delete d[slot];
  m.deco = { ...m.deco, [place]: d }; m.decoT = { ...m.decoT, [place]: Date.now() };
  save();
}
export const mathIsBought = (id: string, m = mathState()) => !!m.bought[id];
export function mathBuyFurn(id: string) {
  const m = edit();
  if (m.bought[id]) return true;
  if (mathMatsLeft(m) <= 0) return false;
  m.bought = { ...m.bought, [id]: Date.now() };
  save();
  return true;
}
