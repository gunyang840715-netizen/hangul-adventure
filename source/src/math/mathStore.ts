// 수학 모드 기록 읽기·쓰기 (State.math 한 칸만 — 한글 진도·옷장·집·시간은 건드리지 않는다)
// @ts-ignore  (공용 JS)
import { sumMap } from '../../shared/merge.js';
import { load, save, flushSave, dev, today, type Wear, type PetView } from '../engine/store';
import { randomItemFrom, randomSnack } from '../engine/gifts';
import { PET, BUILDS, BUILD, SNACK, type Slot, type Species } from '../data/pets';
import { freshMath, ITEM_EVERY, MAT_EVERY, SNACK_EVERY, PASS_RATE, UP_MIN, CAT_MAX, CATS, type Cat, type MathState } from './mathData';

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

/** 오늘 기록: 푼 수·맞힌 수(모든 항목 합계), 공부한 시간·하루 공부 시간·남은 시간(ms) — 두 기기 합계 */
export function todayMath(m = mathState()) {
  const d = dayKey();
  const ms = sumMap(m.ms[d]) as number, limitMs = m.dayMin * 60000;
  return { solved: sumMap(m.solved[d]) as number, correct: sumMap(m.correct[d]) as number, ms, limitMs, leftMs: Math.max(0, limitMs - ms) };
}
/** 오늘 그 항목 기록 */
export function todayCat(cat: Cat, m = mathState()) {
  const k = dayKey() + ':' + cat;
  return { solved: sumMap(m.solvedC[k]) as number, correct: sumMap(m.correctC[k]) as number };
}
/** 오늘 공부 시간을 다 썼나 */
export const mathTimeUp = (m = mathState()) => { const t = todayMath(m); return t.ms >= t.limitMs; };
/** 오늘 그 항목을 150문제 다 풀었나 */
export const catFull = (cat: Cat, m = mathState()) => todayCat(cat, m).solved >= CAT_MAX;
/** 오늘 더 풀 수 있는 항목 (골고루는 이 항목들만 섞어 냄) */
export const openCats = (m = mathState()): Cat[] => CATS.map(c => c.id).filter(c => !catFull(c, m));
export const mathTotalCorrect = (m = mathState()) => sumMap(m.total) as number;
/** 다음 꾸미기까지 남은 정답 수 (1~10) */
export const toNextItem = (m = mathState()) => ITEM_EVERY - (mathTotalCorrect(m) % ITEM_EVERY);

/** 그 시각이 며칠째인지 (store.ts today()와 같은 셈 — 기기 시간 자정 기준) */
const dayOf = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
/** 그날 그 항목 판정: 20문제 이상 풀고 90% 이상 맞혔으면 다음 단계.
 *  하루에 한 단계까지 — 그날 이미 단계가 바뀐 항목(시간 끝·150문제째에 오름, 부모 설정에서 바꿈)은 다음 날 다시 판정 */
function judge(m: MathState, cats: Cat[]): Cat[] {
  const ups: Cat[] = [];
  const day = today();
  for (const c of CATS) {
    if (!cats.includes(c.id)) continue;
    const r = todayCat(c.id, m);
    if (r.solved < UP_MIN || r.correct < Math.ceil(r.solved * PASS_RATE)) continue;
    if (m.lv[c.id] >= c.stages.length - 1) continue;
    const t = m.lvT[c.id];
    if (t && dayOf(t) === day) continue;
    m.lv = { ...m.lv, [c.id]: m.lv[c.id] + 1 }; m.lvT = { ...m.lvT, [c.id]: Date.now() }; ups.push(c.id);
  }
  return ups;
}

export interface AnswerResult { item: string | null; mat: boolean; snack: string | null; catDone: boolean; ups: Cat[] }
/** 한 문제를 풀었을 때(시간이 다 되면 틀린 것으로): 기록 → 정답 10개마다 꾸미기·5개마다 재료와 간식 →
 *  그 항목을 오늘 150문제째 풀었으면(그 항목은 오늘 끝) 그 항목 판정 */
export function answerMath(ok: boolean, cat: Cat): AnswerResult {
  const m = edit();
  const d = dayKey(), dc = d + ':' + cat;
  const before = todayCat(cat, m).solved;
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
  // 간식: 정답 5개마다 하나 (종류는 한글 선물과 같은 비율로 무작위, 수학 간식 칸에만)
  let snack: string | null = null;
  if (ok && mathTotalCorrect(m) % SNACK_EVERY === 0) { snack = randomSnack(); bump(m.snacks[snack] ||= {}); }
  const catDone = before < CAT_MAX && todayCat(cat, m).solved >= CAT_MAX;
  const ups = catDone ? judge(m, [cat]) : [];
  save();
  return { item, mat, snack, catDone, ups };
}

/** 문제 화면에서 공부한 시간 더하기(ms). 오늘 공부 시간을 넘는 그 순간 한 번 모든 항목 판정 → 오른 항목 */
export function addMathMs(n: number): { timeUp: boolean; ups: Cat[] } {
  if (!(n > 0)) return { timeUp: false, ups: [] };
  const m = edit();
  const was = mathTimeUp(m);
  bump(m.ms[dayKey()] ||= {}, Math.round(n));
  const timeUp = !was && mathTimeUp(m);
  const ups = timeUp ? judge(m, CATS.map(c => c.id)) : [];
  // 몇 초마다 부르므로 평소에는 조용히 저장만 (화면 다시 그리기 X), 시간이 끝난 순간에는 알림
  if (timeUp) save(true); else flushSave();
  return { timeUp, ups };
}

// ---------- 부모 설정 ----------
export function setMathLv(cat: Cat, i: number) {
  const m = edit(); const n = CATS.find(c => c.id === cat)!.stages.length;
  m.lv = { ...m.lv, [cat]: Math.max(0, Math.min(n - 1, i)) }; m.lvT = { ...m.lvT, [cat]: Date.now() }; save();
}
/** 하루 공부 시간(분). 줄여서 오늘 시간이 바로 끝나면 그때 판정 (늘리면 오늘 더 풀 수 있음) */
export function setMathDayMin(min: number) {
  const m = edit();
  const was = mathTimeUp(m);
  m.dayMin = min; m.dayMinT = Date.now();
  if (!was && mathTimeUp(m)) judge(m, CATS.map(c => c.id));
  save();
}
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

// ---------- 간식 (한글 간식과 따로) ----------
/** 그 간식이 몇 개 남았나 */
export const mathSnackCount = (id: string, m = mathState()) => Math.max(0, (sumMap(m.snacks[id]) as number) - (sumMap(m.eaten[id]) as number));
/** 남은 간식 모두 */
export const mathSnackTotal = (m = mathState()) => Object.keys(SNACK).reduce((a, k) => a + mathSnackCount(k, m), 0);
/** 그 친구가 간식을 먹은 횟수 (하트) */
export const mathFedCount = (petId: string, m = mathState()) => sumMap(m.fed[petId]) as number;
/** 간식 먹이기 — 간식이 없거나 그 친구가 못 먹는 간식(강아지 간식을 고양이에게 등)이면 false */
export function mathFeed(petId: string, snackId: string): boolean {
  const sn = SNACK[snackId], p = PET[petId];
  if (!sn || !p || mathSnackCount(snackId) <= 0) return false;
  if (sn.for !== 'both' && sn.for !== p.species) return false;
  const m = edit();
  bump(m.eaten[snackId] ||= {});
  bump(m.fed[petId] ||= {});
  save();
  return true;
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
