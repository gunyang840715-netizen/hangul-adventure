// 진도 저장: 이 기기(localStorage) + 두 기기 연동(sync.ts)
// 기기마다 따로 세는 값은 기기 번호별로 두고 합계를 쓴다 → 두 기기에서 동시에 해도 안 꼬임
// @ts-ignore  (공용 JS)
import { mergeState, sumMap } from '../../shared/merge.js';
import { PET, DEFAULT_PETS, SNACK, DROP_ORDER, OLD_ITEM, ITEM, BUILDS, BUILD, levelOf, stageOf, type Species, type Slot } from '../data/pets';
import { CURRICULUM_VER, migrateLessonIdx } from '../data/curriculum';

export interface ItemStat { box: number; due: number; seen: number; right: number; wrong: number; last: number }

export interface Settings {
  dailyMin: number;      // 0 = 무제한
  newPerDay: number;     // 하루 새 단계 수
  music: boolean;
  voiceRate: number;     // 0.8 ~ 1.2
  traceReps: number;     // 한 세트에 글자마다 쓰는 횟수
  testPass: number;      // 받아쓰기 시험 통과 기준(%)
}

/** 예전 꾸미기 (호환용) */
export interface Outfit { hat?: string; acc?: string; color?: string; buddy?: 'dog' | 'cat' }
export type Wear = Partial<Record<Slot, string>>;

type DevMap = Record<string, number>;
type DayMap = Record<string, DevMap>;

/** 쉬었다가 이어서 할 모험 */
export interface Resume { lessonIdx: number; replay: boolean; play?: boolean; stepIdx: number; steps: any[]; at: number }

export interface State {
  v: 3;
  epoch: number;
  curVer?: number;                   // 진도표 판 (바뀌면 단계 번호를 옮김)
  name: string; nameT: number;
  lessonIdx: number;                 // 다음에 할 단계
  items: Record<string, ItemStat>;
  stars: DevMap;
  adventures: DevMap;
  usage: DayMap;                     // 날짜 → 기기 → 사용 ms
  lessonsByDay: DayMap;              // 날짜 → 기기 → 새 단계 수
  extraMin: DayMap;                  // 부모가 준 추가 시간(분)
  extraLessons: DayMap;              // 부모가 준 추가 단계
  owned: string[];                   // 받은 꾸미기 아이템 ('hat:crown' …)
  settings: Settings; settingsT: number;
  lastItem?: string; lastItemT?: number;
  // 강아지·고양이
  dog: string; cat: string; lead: Species; petsT: number;
  wear: Record<string, Wear>; wearT: Record<string, number>;
  growth: DayMap;                    // 친구 id → 기기 → 먹은 간식 점수
  snacks: DayMap;                    // 간식 id → 기기 → 받은 개수
  eaten: DayMap;                     // 간식 id → 기기 → 먹인 개수
  games: DevMap;                     // 끝낸 놀이 수 (선물 순서용)
  mats: DevMap;                      // 모은 집 짓기 재료 수
  built: DayMap;                     // 짓기 id(doghouse·cathouse·park) → 기기 → 지은 부분 수
  resume: Resume | null; resumeT: number;
  outfit?: Outfit;                   // 옛 형식 (읽기만)
  // 받아쓰기 시험 (나중에 바꾼 쪽을 따름)
  lastPass: PassRec | null; lastPassT: number;   // 마지막으로 시험을 통과한 단계·날·글자 (다음날 복습 시험에 씀)
  reviewDay: number; reviewDayT: number;         // 복습 시험을 통과한 날
  hold: { lesson: number } | null; holdT: number; // 복습 시험에 떨어져 다시 공부할 단계 (통과하면 지움)
  // 틀리면 돌려받기 (기기별로 세고 합계 / 아이템은 받은 시각 > 돌려준 시각이면 가진 것)
  lostSnacks: DayMap;                // 간식 id → 기기 → 돌려준 개수
  lostMats: DevMap;                  // 돌려준 재료 수
  itemGot: Record<string, number>;   // 꾸미기 아이템 → 받은 시각
  itemLost: Record<string, number>;  // 꾸미기 아이템 → 돌려준 시각
  // 집 안·놀이터 꾸미기
  bought: Record<string, number>;    // 가구·놀이 기구 id → 산 시각 (재료 1개씩)
  deco: Record<string, Record<string, string>>; decoT: Record<string, number>;   // 장소 → 자리 → 놓은 가구
}

export interface PassRec { lesson: number; day: number; items: string[] }

const KEY = 'hangul-adventure-v2';
const OLD_KEY = 'geulja-friends-v1';

export function today(): number {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

export const DEFAULT_SETTINGS: Settings = { dailyMin: 30, newPerDay: 1, music: true, voiceRate: 1, traceReps: 10, testPass: 80 };

export function dev(): string {
  let id = '';
  try { id = localStorage.getItem('hangul-device') || ''; } catch { /* 없음 */ }
  if (!id) {
    id = 'd' + Math.random().toString(36).slice(2, 8);
    try { localStorage.setItem('hangul-device', id); } catch { /* 없음 */ }
  }
  return id;
}

export function fresh(): State {
  return {
    v: 3, epoch: 0, curVer: CURRICULUM_VER, name: (typeof window !== 'undefined' && (window as any).__VOICE_NAME__) || '친구', nameT: 0, lessonIdx: 0, items: {},
    stars: {}, adventures: {}, usage: {}, lessonsByDay: {}, extraMin: {}, extraLessons: {},
    owned: [], settings: { ...DEFAULT_SETTINGS }, settingsT: 0,
    dog: DEFAULT_PETS.dog, cat: DEFAULT_PETS.cat, lead: 'dog', petsT: 0,
    wear: {}, wearT: {}, growth: {}, snacks: {}, eaten: {}, games: {}, mats: {}, built: {},
    resume: null, resumeT: 0,
    lastPass: null, lastPassT: 0, reviewDay: -1, reviewDayT: 0, hold: null, holdT: 0,
    lostSnacks: {}, lostMats: {}, itemGot: {}, itemLost: {},
    bought: {}, deco: {}, decoT: {},
  };
}

let mem: State | null = null;
let storageOk = true;
const listeners = new Set<() => void>();
export function onChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
function emit() { listeners.forEach(f => f()); }

/** 옛 꾸미기(몽글이·v2) → 새 아이템 */
function migrateOutfit(s: State, o?: Outfit) {
  s.owned = [...new Set((s.owned || []).map(it => OLD_ITEM[it] ?? it).filter(it => !!ITEM[it]))].sort();
  if (!o) return;
  const pet = o.buddy === 'cat' ? s.cat : s.dog;
  const w: Wear = {};
  if (o.hat && OLD_ITEM['hat:' + o.hat]) w.hat = OLD_ITEM['hat:' + o.hat].split(':')[1];
  if (o.acc && OLD_ITEM['acc:' + o.acc]) { const [slot, key] = OLD_ITEM['acc:' + o.acc].split(':'); (w as any)[slot] = key; }
  if (Object.keys(w).length && !s.wear[pet]) { s.wear = { ...s.wear, [pet]: w }; s.wearT = { ...s.wearT, [pet]: 1 }; }
  if (o.buddy === 'cat') s.lead = 'cat';
}

/** 예전 형식(v1, 한 기기용)을 새 형식으로 */
function fromV1(o: any): State {
  const s = fresh();
  const d = dev();
  s.name = o.name || s.name; s.nameT = 1;
  s.lessonIdx = migrateLessonIdx(o.lessonIdx || 0);
  s.items = o.items || {};
  if (o.stars) s.stars[d] = o.stars;
  if (o.adventures) s.adventures[d] = o.adventures;
  s.owned = o.owned || [];
  s.settings = { ...DEFAULT_SETTINGS, ...(o.settings || {}) };
  if (s.settings.dailyMin === 20) s.settings.dailyMin = 30; // 쓰기가 늘어서 기본 30분
  s.settingsT = 1;
  const days = [...(o.history || []), ...(o.daily ? [o.daily] : [])];
  for (const h of days) {
    if (!h || h.day == null) continue;
    if (h.ms) s.usage[h.day] = { ...(s.usage[h.day] || {}), [d]: h.ms };
    if (h.lessons) s.lessonsByDay[h.day] = { ...(s.lessonsByDay[h.day] || {}), [d]: h.lessons };
  }
  migrateOutfit(s, o.outfit);
  return s;
}

function normalize(o: any): State {
  if (!o) return fresh();
  if (o.v === 1) return fromV1(o);
  const f = fresh();
  const s: State = { ...f, ...o, v: 3, settings: { ...DEFAULT_SETTINGS, ...(o.settings || {}) } };
  if (!PET[s.dog] || PET[s.dog].species !== 'dog') s.dog = f.dog;
  if (!PET[s.cat] || PET[s.cat].species !== 'cat') s.cat = f.cat;
  if (s.lead !== 'dog' && s.lead !== 'cat') s.lead = 'dog';
  if (o.v === 2) { migrateOutfit(s, o.outfit); delete s.outfit; delete (s as any).outfitT; }
  // 진도표가 바뀌었으면 배운 글자 기준으로 단계 번호를 옮기고, 예전 이어하기는 버림
  if ((o.curVer || 1) !== CURRICULUM_VER) {
    s.lessonIdx = migrateLessonIdx(s.lessonIdx || 0);
    s.resume = null;
    s.curVer = CURRICULUM_VER;
  }
  return s;
}

export function load(): State {
  if (mem) return mem;
  let o: any = null;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (raw) o = JSON.parse(raw);
  } catch { storageOk = false; }
  mem = normalize(o);
  return mem;
}

let saveTimer = 0;
export function save(now = false) {
  if (!mem) return;
  const doSave = () => {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); storageOk = true; } catch { storageOk = false; }
  };
  clearTimeout(saveTimer);
  if (now) doSave(); else saveTimer = window.setTimeout(doSave, 300);
  emit();
}

export function isStorageOk() { return storageOk; }

/** 다른 기기에서 받은 상태(들)를 합치기 */
export function absorb(...remote: any[]) {
  const before = JSON.stringify(load());
  let m: any = load();
  for (const r of remote) if (r && (r.v === 2 || r.v === 3)) m = mergeState(m, normalize(r));
  mem = normalize(m);
  if (JSON.stringify(mem) !== before) save(true);
}

/** 부모 조작(초기화·단계 이동·백업 불러오기): 새 epoch로 두 기기 모두 이 상태를 따르게 */
export function replaceAll(s: State) {
  mem = normalize(s);
  mem.epoch = Date.now();
  save(true);
}

/** 전체 초기화: 진도·꾸미기·간식·친구까지 처음으로 (이름·설정·연동은 그대로) */
export function reset() {
  const cur = load();
  const s = fresh();
  s.name = cur.name; s.nameT = Date.now();
  s.settings = { ...cur.settings }; s.settingsT = Date.now();
  replaceAll(s);
}

/** 공부 진도만 처음으로: 단계·글자 기록·이어하기만 지우고 강아지·고양이·꾸미기·간식·별은 그대로 */
export function resetProgress() {
  const n: State = JSON.parse(JSON.stringify(load()));
  n.lessonIdx = 0; n.items = {}; n.lessonsByDay = {}; n.extraLessons = {};
  n.resume = null; n.resumeT = Date.now();
  replaceAll(n);
}

export function exportCode(): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(load()))));
}

export function importCode(code: string): boolean {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (o && (o.v === 1 || o.v === 2 || o.v === 3)) { replaceAll(normalize(o)); return true; }
  } catch { /* 무시 */ }
  return false;
}

// ---------- 합계·기록 도우미 ----------
const dayKey = (d = today()) => String(d);
export const starsTotal = (s = load()) => sumMap(s.stars);
export const adventuresTotal = (s = load()) => sumMap(s.adventures);
export const todayMs = (s = load()) => sumMap(s.usage[dayKey()]);
export const todayLessons = (s = load()) => sumMap(s.lessonsByDay[dayKey()]);
export const todayExtraMin = (s = load()) => sumMap(s.extraMin[dayKey()]);
export const todayExtraLessons = (s = load()) => sumMap(s.extraLessons[dayKey()]);

function bump(map: DevMap, n: number) { const d = dev(); map[d] = (map[d] || 0) + n; }
function bumpIn(map: DayMap, key: string, n: number) { map[key] = map[key] || {}; bump(map[key], n); }
function bumpDay(map: DayMap, n: number) { bumpIn(map, dayKey(), n); }

export function addStars(n: number) { bump(load().stars, n); save(); }
export function addAdventure() { bump(load().adventures, 1); save(); }
export function addLessonToday() { bumpDay(load().lessonsByDay, 1); save(); }
export function giveExtraMinutes(n: number) { bumpDay(load().extraMin, n); save(); }
export function giveExtraLesson() { bumpDay(load().extraLessons, 1); save(); }

export function setName(n: string) { const s = load(); s.name = n; s.nameT = Date.now(); save(); }
export function setSettings(p: Partial<Settings>) { const s = load(); s.settings = { ...s.settings, ...p }; s.settingsT = Date.now(); save(); }
export function setLastItem(it: string) { const s = load(); s.lastItem = it; s.lastItemT = Date.now(); save(); }
export function addOwned(it: string) {
  const s = load();
  if (!s.owned.includes(it)) { s.owned.push(it); s.owned.sort(); }
  s.itemGot = { ...s.itemGot, [it]: Date.now() };
  save();
}
/** 지금 가진 꾸미기 아이템인가 (돌려준 뒤 다시 받으면 다시 가짐) */
export function hasItem(it: string, s = load()) { return s.owned.includes(it) && (s.itemGot[it] || 1) > (s.itemLost[it] || 0); }
export function ownedNow(s = load()) { return s.owned.filter(it => hasItem(it, s)); }
export function advanceLesson(to: number) { const s = load(); s.lessonIdx = Math.max(s.lessonIdx, to); save(); }

// ---------- 지금 할 단계 · 받아쓰기 시험 ----------
/** 지금 할 단계: 복습 시험에 떨어졌으면 그 단계(다시 공부), 아니면 다음 단계 */
export function curLesson(s = load()) { return s.hold ? Math.min(s.hold.lesson, s.lessonIdx) : s.lessonIdx; }
/** 단계 시험 통과: 다시 공부 중이던 단계면 묶음을 풀고, 아니면 다음 단계로 */
export function passLesson(lesson: number, items: string[]) {
  const s = load();
  const now = Date.now();
  if (s.hold && s.hold.lesson === lesson) { s.hold = null; s.holdT = now; }
  s.lessonIdx = Math.max(s.lessonIdx, lesson + 1);
  if (items.length) { s.lastPass = { lesson, day: today(), items: items.slice(0, 12) }; s.lastPassT = now; }
  save();
}
/** 다음날 공부 시작 전 복습 시험을 볼 차례인가 (어제 이전에 통과한 단계의 바로 다음 단계를 시작할 때, 하루 한 번) */
export function reviewDue(s = load()) {
  const lp = s.lastPass;
  if (!lp || !lp.items || !lp.items.length) return false;
  if (lp.day >= today() || s.reviewDay === today()) return false;
  return curLesson(s) === lp.lesson + 1;
}
export function passReview() { const s = load(); s.reviewDay = today(); s.reviewDayT = Date.now(); save(); }
/** 복습 시험에 떨어짐 → 그 단계를 다시 공부 */
export function failReview() {
  const s = load();
  if (!s.lastPass) return;
  s.hold = { lesson: s.lastPass.lesson }; s.holdT = Date.now();
  s.resume = null; s.resumeT = Date.now();
  save();
}

// ---------- 강아지·고양이 ----------
export interface PetView { id: string; species: Species; name: string; breed: string; wear: Wear; points: number; level: number; stage: ReturnType<typeof stageOf> }
export function petInfo(id: string, s = load()): PetView {
  const d = PET[id];
  const points = sumMap(s.growth[id]);
  const level = levelOf(points);
  return { id, species: d.species, name: d.name, breed: d.breed, wear: s.wear[id] || {}, points, level, stage: stageOf(level) };
}
export function petView(sp: Species, s = load()): PetView { return petInfo(sp === 'dog' ? s.dog : s.cat, s); }
export function choosePet(id: string) {
  const s = load(); const d = PET[id]; if (!d) return;
  if (d.species === 'dog') s.dog = id; else s.cat = id;
  s.lead = d.species; s.petsT = Date.now(); save();
}
export function setLead(sp: Species) { const s = load(); if (s.lead !== sp) { s.lead = sp; s.petsT = Date.now(); save(); } }
export function setWear(petId: string, w: Wear) { const s = load(); s.wear = { ...s.wear, [petId]: w }; s.wearT = { ...s.wearT, [petId]: Date.now() }; save(); }

export function snackCount(id: string, s = load()) { return Math.max(0, sumMap(s.snacks[id]) - sumMap(s.eaten[id]) - sumMap(s.lostSnacks[id])); }
export function snackTotal(s = load()) { return Object.keys(SNACK).reduce((a, k) => a + snackCount(k, s), 0); }
export function addSnack(id: string, n = 1) { bumpIn(load().snacks, id, n); save(); }
/** 간식 먹이기 → 전·후 레벨 (간식이 없으면 null) */
export function feed(petId: string, snackId: string) {
  const s = load();
  if (snackCount(snackId, s) <= 0) return null;
  const before = levelOf(sumMap(s.growth[petId]));
  bumpIn(s.eaten, snackId, 1);
  bumpIn(s.growth, petId, SNACK[snackId].points);
  const after = levelOf(sumMap(s.growth[petId]));
  save();
  return { before, after };
}
export function gamesTotal(s = load()) { return sumMap(s.games); }
export function addGame() { bump(load().games, 1); save(); }
// ---------- 집 짓기 (재료를 하나씩 모아 강아지 집·고양이 집·놀이터) ----------
export const matsTotal = (s = load()) => sumMap(s.mats);
export function builtCount(id: string, s = load()) { return Math.min(BUILD[id]?.parts.length ?? 0, sumMap(s.built[id])); }
export function matsLeft(s = load()) {
  const built = BUILDS.reduce((a, b) => a + sumMap(s.built[b.id]), 0);
  const spent = Object.keys(s.bought).length;          // 가구·놀이 기구 하나에 재료 1개
  return Math.max(0, matsTotal(s) - built - spent - sumMap(s.lostMats));
}
export function addMat(n = 1) { bump(load().mats, n); save(); }
/** 재료 하나로 다음 부분 짓기 → 지은 부분 수 (재료가 없거나 다 지었으면 null) */
export function buildPart(id: string) {
  const s = load();
  const b = BUILD[id];
  if (!b || matsLeft(s) <= 0 || builtCount(id, s) >= b.parts.length) return null;
  bumpIn(s.built, id, 1);
  save();
  return builtCount(id, s);
}
/** 아직 다 안 지은 것 중 처음 것 (다 지었으면 null) */
export function nextBuild(s = load()) { return BUILDS.find(b => builtCount(b.id, s) < b.parts.length) ?? null; }

/** 다음에 받을 꾸미기 아이템 (다 받았으면 null) — 돌려준 아이템도 다시 받을 수 있음 */
export function nextDrop(s = load()) { return DROP_ORDER.find(id => !hasItem(id, s)) ?? null; }

// ---------- 놀이에서 틀리면: 받은 것 하나를 무작위로 돌려받기 ----------
export interface Taken { kind: 'snack' | 'item' | 'mat'; id: string }
type TakeListener = (t: Taken) => void;
const takeSubs = new Set<TakeListener>();
export function onTake(f: TakeListener) { takeSubs.add(f); return () => { takeSubs.delete(f); }; }
/** 간식·꾸미기 아이템·남은 재료를 한 개씩 모두 늘어놓고 그중 하나를 무작위로 돌려받는다 (없으면 null) */
export function takeBack(): Taken | null {
  const s = load();
  const pool: Taken[] = [];
  for (const id of Object.keys(SNACK)) for (let n = snackCount(id, s); n > 0; n--) pool.push({ kind: 'snack', id });
  for (const it of ownedNow(s)) pool.push({ kind: 'item', id: it });
  for (let n = matsLeft(s); n > 0; n--) pool.push({ kind: 'mat', id: 'mat' });
  if (!pool.length) return null;
  const t = pool[Math.floor(Math.random() * pool.length)];
  if (t.kind === 'snack') bumpIn(s.lostSnacks, t.id, 1);
  if (t.kind === 'mat') bump(s.lostMats, 1);
  if (t.kind === 'item') {
    s.itemLost = { ...s.itemLost, [t.id]: Date.now() };
    // 입고 있던 것이면 벗기기
    const [slot, key] = t.id.split(':');
    for (const pid of Object.keys(s.wear)) {
      const w = s.wear[pid] as any;
      if (w && w[slot] === key) { const nw = { ...w }; delete nw[slot]; s.wear = { ...s.wear, [pid]: nw }; s.wearT = { ...s.wearT, [pid]: Date.now() }; }
    }
  }
  save();
  takeSubs.forEach(f => f(t));
  return t;
}

// ---------- 집 안·놀이터 꾸미기 ----------
export const isBought = (id: string, s = load()) => !!s.bought[id];
/** 재료 1개로 가구·놀이 기구 사기 (재료가 없으면 false) */
export function buyFurn(id: string) {
  const s = load();
  if (s.bought[id]) return true;
  if (matsLeft(s) <= 0) return false;
  s.bought = { ...s.bought, [id]: Date.now() };
  save();
  return true;
}
export function decoOf(place: string, s = load()) { return s.deco[place] || {}; }
export function setDeco(place: string, slot: string, id: string | null) {
  const s = load();
  const d = { ...(s.deco[place] || {}) };
  if (id) d[slot] = id; else delete d[slot];
  s.deco = { ...s.deco, [place]: d }; s.decoT = { ...s.decoT, [place]: Date.now() };
  save();
}

// ---------- 이어하기 ----------
export function getResume(s = load()) { return s.resume; }
export function setResume(r: Resume | null) { const s = load(); s.resume = r; s.resumeT = Date.now(); save(); }

/** 최근 n일 기록 (두 기기 합계) */
export function history(n = 14) {
  const s = load();
  const t = today();
  const out: { day: number; ms: number; lessons: number }[] = [];
  for (let d = t - n + 1; d <= t; d++) out.push({ day: d, ms: sumMap(s.usage[String(d)]), lessons: sumMap(s.lessonsByDay[String(d)]) });
  return out;
}

/** 오늘 남은 시간(ms). 무제한이면 Infinity */
export function remainingMs(s = load()): number {
  if (!s.settings.dailyMin) return Infinity;
  return (s.settings.dailyMin + todayExtraMin(s)) * 60000 - todayMs(s);
}

export function todayDoneLessons(s = load()) {
  return todayLessons(s) >= s.settings.newPerDay + todayExtraLessons(s);
}

// 사용 시간 누적: 노는 화면이 보이고, 최근 3분 안에 만진 적이 있을 때만
let tick = 0;
let active = false;
let lastTouch = Date.now();
export function setClockActive(on: boolean) { active = on; }
if (typeof document !== 'undefined') document.addEventListener('pointerdown', () => { lastTouch = Date.now(); }, true);
export function startClock(onTick?: () => void) {
  let lastT = performance.now();
  clearInterval(tick);
  tick = window.setInterval(() => {
    const now = performance.now();
    const dt = Math.min(now - lastT, 5000);
    lastT = now;
    if (document.visibilityState === 'visible' && active && Date.now() - lastTouch < 180000) {
      const s = load();
      bumpDay(s.usage, Math.round(dt));
      if (Math.random() < 0.1) { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* 없음 */ } }
    }
    onTick?.();
  }, 1000);
}
