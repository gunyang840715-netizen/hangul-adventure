// 빈칸 추리(11-07 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이) 검사. math_check.mts 끝에서 실행된다(package.json 그대로).
// 1) 문제 은행: 빈칸 하나·단서·보기 셋(서로 다름)·오답마다 까닭·글꼴·길이·열쇠 기준표(id·정답 바꾸지 않기)
// 2) 글 나누기(어절·단서·빈칸)가 글을 그대로 보존 · 보기 섞기 · 문제 시간
// 3) 문제 고르기: 처음엔 한 문장만(쉬운 것 먼저) → 한 문장 20개 맞히면 짧은 이야기 · 틀린 문제 다시 · 이틀 뒤 확인 · 최근 문제 안 겹침
// 4) 기록·보상: 맞춤법과 같은 칸(sp)에 다른 열쇠 · 하루 기록 '날짜:bk' · 정답 보상은 수학과 같이 · 수학 단계·맞춤법·한글 칸 그대로
// 5) 저장 모양(모르는 열쇠 버림)·두 기기 합치기(열쇠마다 큰 값, 순서 상관없음)·한글 초기화에도 유지 · 공부 먼저에서 안 잠김
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const g = globalThis as any;
if (!g.localStorage) {   // 혼자 실행할 때 (math_check에서 부르면 이미 있음)
  const memory: Record<string, string> = { 'hangul-device': 'blank-test' };
  g.window = g; g.window.setTimeout = setTimeout; g.window.clearTimeout = clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
const bd = await import('../src/math/blankData');
const { BANK, BK_KEYS, BK_KEY_SET, BK_BY, BK_TIP, BK_TYPE_NAME, STORY_OPEN, bkSegs, bkWords, bkFull, bkClues, bkSec, BK_SEC_RANGE, makeBlankQ, pickBlank, storyProgress, blankWrongKeys } = bd;
const sd = await import('../src/math/spellData');
const { SP_KEYS, spCode, spOf, SP_RIGHT, SP_WRONG, SP_FIX1, SP_RECHECK_MIN } = sd;
const md = await import('../src/math/mathData');
const store = await import('../src/engine/store');
const ms = await import('../src/math/mathStore');
const { FONT_SYLLABLES } = await import('../src/data/fontchars');
const { ITEM_LIST } = await import('../src/data/pets');
const { catMax } = await import('../src/lib/studyCfg');
// @ts-ignore (공용 JS)
const { mergeState } = await import('../shared/merge.js');

// ---------- 1) 문제 은행 ----------
const hangulOf = (x: string) => [...x].filter(c => c >= '가' && c <= '힣');
const ids = new Set<string>();
const byLv: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
for (const b of BANK) {
  assert.match(b.id, /^bk\d{1,4}$/, '문제 id 모양 ' + b.id);
  assert.ok(!ids.has(b.id), '문제 id 중복 ' + b.id); ids.add(b.id);
  assert.ok([1, 2, 3].includes(b.lv), '단계 ' + b.id); byLv[b.lv]++;
  assert.ok(BK_TIP[b.ty] && BK_TYPE_NAME[b.ty], '생각하는 방법 ' + b.id);
  // 괄호 짝·겹침 없음, 빈칸은 단서 밖에 하나
  let depth = 0;
  for (const c of b.t) { if (c === '{') depth++; if (c === '}') depth--; assert.ok(depth === 0 || depth === 1, '단서 괄호 ' + b.id); }
  assert.equal(depth, 0, '단서 괄호 짝 ' + b.id);
  const segs = bkSegs(b.t);
  assert.equal(segs.filter(x => x.blank).length, 1, '빈칸은 하나 ' + b.id);
  assert.equal((b.t.match(/_/g) || []).length, 1, '빈칸 표시 하나 ' + b.id);
  assert.ok(bkClues(b).length >= 1 && bkClues(b).every(c => c.trim()), '단서 하나 이상 ' + b.id);
  // 보기 셋: 서로 다름, 비지 않음, 표시 글자 없음, 너무 길지 않음 · 오답마다 다른 까닭
  const opts = [b.a, ...b.w];
  assert.equal(new Set(opts).size, 3, '보기 셋이 서로 다름 ' + b.id);
  for (const o of opts) { assert.ok(o.trim() && o === o.trim() && !/[_{}]/.test(o), '보기 모양 ' + b.id); assert.ok(o.length <= 14, '보기가 너무 김 ' + b.id + ' ' + o); }
  assert.ok(b.why.every(w => w.trim().length >= 4 && w.length <= 60), '오답 까닭 ' + b.id);
  assert.notEqual(b.why[0], b.why[1], '오답 둘의 까닭이 같지 않게 ' + b.id);
  assert.ok(bkFull(b).length <= 100, '글이 너무 김 ' + b.id);
  for (const c of hangulOf(b.t + opts.join('') + b.why.join(''))) assert.ok(FONT_SYLLABLES.has(c), `앱 글꼴에 없는 글자 '${c}' (${b.id}) — 다른 글자로 바꾸기`);
}
for (const v of Object.values(BK_TIP)) for (const c of hangulOf(v)) assert.ok(FONT_SYLLABLES.has(c), `도움말 글꼴 '${c}'`);
assert.ok(BANK.length >= 300, '문제 수 ' + BANK.length);   // 11-08 사용자 요청으로 180 → 316
assert.ok(byLv[1] + byLv[2] >= STORY_OPEN * 4, '한 문장 문제가 넉넉히');
assert.ok(byLv[3] >= 100, '짧은 이야기 문제 ' + byLv[3]);
// 같은 글이 두 번 들어가지 않게 (문제를 늘릴 때 겹침 막기)
assert.equal(new Set(BANK.map(bkFull)).size, BANK.length, '같은 글의 문제가 둘');
// 열쇠: 맞춤법 열쇠('문장id.번호')와 절대 겹치지 않음 · 예전 문제의 id·정답은 그대로(뒤에 추가만)
assert.ok(BK_KEYS.every(k => !k.includes('.')) && SP_KEYS.every(k => k.includes('.')), '빈칸 추리 열쇠와 맞춤법 열쇠가 겹치지 않음');
const base = JSON.parse(readFileSync(new URL('./blank_keys_baseline.json', import.meta.url), 'utf8')) as Record<string, string>;
for (const [k, a] of Object.entries(base)) { assert.ok(BK_KEY_SET.has(k), '예전 문제 열쇠가 사라짐: ' + k); assert.equal(BK_BY[k].a, a, '예전 문제의 정답이 바뀜: ' + k); }
assert.ok(Object.keys(base).length >= 316, '기준표');
assert.ok(BANK.every(b => b.id in base), '새 문제는 열쇠 기준표에도 (blank_keys_baseline.json — 뒤에 추가만)');

// ---------- 2) 글 나누기 · 보기 섞기 · 문제 시간 ----------
for (const b of BANK) {
  const words = bkWords(b.t);
  assert.equal(words.map(w => w.map(x => (x.blank ? '_' : x.s)).join('')).join(' '), b.t.replace(/[{}]/g, ''), '어절로 나눠도 글 그대로 ' + b.id);
  assert.ok(words.some(w => w.some(x => x.clue)), '누를 수 있는 단서 어절 ' + b.id);
  assert.ok(!words.every(w => w.some(x => x.clue)), '단서가 아닌 어절도 있음(근거 찾기) ' + b.id);
  assert.ok(bkSec(b) >= 24 && bkSec(b) <= 60, '문제 시간 ' + b.id);
}
assert.ok(BK_SEC_RANGE[0] >= 24 && BK_SEC_RANGE[1] <= 60);
{
  const pos = [0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    const q = makeBlankQ(BANK[i % BANK.length].id)!;
    assert.deepEqual([...q.opts].sort(), [q.item.a, ...q.item.w].sort(), '보기 셋');
    assert.equal(q.ans, q.item.a);
    for (const w of q.item.w) assert.ok(q.why[w], '오답마다 까닭');
    pos[q.opts.indexOf(q.ans)]++;
  }
  assert.ok(pos.every(p => p > 800), '정답 자리가 골고루 섞임 ' + pos.join(','));
  assert.equal(makeBlankQ('bk99999'), null);
  assert.equal(makeBlankQ('k1.1'), null, '맞춤법 열쇠는 빈칸 추리 문제가 아님');
}

// ---------- 3) 문제 고르기 ----------
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const NOW = 30000000;
{
  // 처음: 한 문장만, 쉬운 것(lv1)이 더 자주
  const c: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 2000; i++) c[BK_BY[pickBlank({}, NOW, [], rnd)].lv]++;
  assert.equal(c[3], 0, '처음에는 짧은 이야기가 안 나옴');
  assert.ok(c[1] > c[2], '쉬운 한 문장이 더 자주');
  // 한 문장 19개 맞힘 → 아직, 20개 → 열림 (틀린 것·이야기는 안 셈)
  const sent = BANK.filter(b => b.lv < 3).map(b => b.id);
  const sp: Record<string, number> = {};
  for (let i = 0; i < STORY_OPEN - 1; i++) sp[sent[i]] = spCode(NOW - 100, SP_RIGHT);
  sp[sent[40]] = spCode(NOW - 100, SP_WRONG);
  assert.equal(storyProgress(sp).open, false);
  assert.equal(storyProgress(sp).got, STORY_OPEN - 1);
  for (let i = 0; i < 500; i++) assert.ok(BK_BY[pickBlank(sp, NOW, [], rnd)].lv < 3, '열리기 전에는 이야기 X');
  sp[sent[STORY_OPEN]] = spCode(NOW - 100, SP_FIX1);   // 틀렸다가 고친 것도 맞힌 것으로 셈
  assert.equal(storyProgress(sp).open, true, '한 문장 20개 맞히면 열림');
  const c2: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < 2000; i++) c2[BK_BY[pickBlank(sp, NOW, [], rnd)].lv]++;
  assert.ok(c2[3] > 700, '열린 뒤에는 짧은 이야기가 자주 ' + c2[3]);
  // 틀린 문제: 최근 8문제 안에 없으면 다시 나옴(30% 안쪽), 있으면 안 나옴 · 3분 안에 푼 문제는 안 나옴
  const w = sent[40];
  let again = 0;
  for (let i = 0; i < 1000; i++) if (pickBlank(sp, NOW, [], rnd) === w) again++;
  assert.ok(again > 200 && again < 400, '틀린 문제가 다시 나옴 ' + again);
  for (let i = 0; i < 300; i++) assert.notEqual(pickBlank(sp, NOW, [w], rnd), w, '방금 나온 틀린 문제는 바로 안 나옴');
  for (let i = 0; i < 300; i++) assert.notEqual(pickBlank({ ...sp, [w]: spCode(NOW - 1, SP_WRONG) }, NOW, [], rnd), w, '3분 안에 푼 문제는 안 나옴');
  // 이틀 지난 고친 문제는 가끔 다시 확인
  const fx = sent[STORY_OPEN];
  const old = { ...sp, [fx]: spCode(NOW - SP_RECHECK_MIN - 10, SP_FIX1) };
  let re = 0;
  for (let i = 0; i < 1000; i++) if (pickBlank(old, NOW, [], rnd) === fx) re++;
  assert.ok(re > 50, '이틀 지난 고친 문제 다시 확인 ' + re);
  // 최근 12문제 안에서는 같은 문제가 안 겹침
  const recent: string[] = [];
  for (let i = 0; i < 300; i++) {
    const k = pickBlank(sp, NOW, recent, rnd);
    assert.ok(!recent.slice(-12).includes(k), '최근 문제와 겹침 ' + k);
    recent.push(k);
  }
  // 다 풀어 봤어도 계속 나옴 (오래전에 푼 것부터)
  const all: Record<string, number> = {};
  BANK.forEach((b, i) => { all[b.id] = spCode(NOW - 5000 + i, SP_RIGHT); });
  for (let i = 0; i < 200; i++) assert.ok(BK_KEY_SET.has(pickBlank(all, NOW, [], rnd)));
  assert.deepEqual(blankWrongKeys({ ...all, [w]: spCode(NOW - 9, SP_WRONG), 'k1.1': spCode(NOW, SP_WRONG) }), [w], '틀린 빈칸 문제만 (맞춤법 열쇠 X)');
}

// ---------- 4) 기록·보상 (State.math 한 칸 — 맞춤법과 같은 sp에 다른 열쇠) ----------
{
  const s = store.load();
  s.math = md.freshMath();
  store.save(true);
  const hangul = () => JSON.stringify({ ...store.load(), math: undefined, savedAt: undefined });
  const hangul0 = hangul();
  const lv0 = JSON.stringify(ms.mathState().lv);
  const k = BK_KEYS[0];
  ms.answerBlank(false, k);
  assert.equal(spOf(ms.mathState().sp[k])!.st, SP_WRONG);
  assert.deepEqual(ms.blankWrong(), [k]);
  assert.deepEqual(ms.spellWrong(), [], '맞춤법 틀린 문제에는 안 섞임');
  assert.equal(ms.spellStats().seen, 0, '맞춤법 기록 요약에도 안 섞임');
  assert.deepEqual(ms.todayCat('bk'), { solved: 1, correct: 0 });
  assert.deepEqual(ms.todayCat('sp'), { solved: 0, correct: 0 });
  ms.answerBlank(true, k);
  assert.equal(spOf(ms.mathState().sp[k])!.st, SP_FIX1, '고치면 이틀 뒤 한 번 더');
  assert.deepEqual(ms.blankWrong(), []);
  assert.equal(ms.blankStats().seen, 1);
  let items = 0, mats = 0, snacks = 0;
  for (let i = 1; i <= 49; i++) { const x = ms.answerBlank(true, BK_KEYS[i]); if (x.item) items++; if (x.mat) mats++; if (x.snack) snacks++; assert.deepEqual(x.ups, []); }
  assert.equal(ms.mathTotalCorrect(), 50);
  assert.equal(items, Math.min(5, ITEM_LIST.length), '정답 10개마다 꾸미기 (수학과 같이)'); assert.equal(mats, 10); assert.equal(snacks, 10);
  assert.deepEqual(ms.todayCat('bk'), { solved: 51, correct: 50 });
  assert.equal(ms.todayMath().solved, 51, '하루 기록에도 같이');
  assert.equal(JSON.stringify(ms.mathState().lv), lv0, '빈칸 추리는 수학 단계를 바꾸지 않음');
  assert.ok(ms.blankStats().open, '한 문장 20개 넘게 맞혀서 이야기 열림');
  for (let i = 51; i < catMax() - 1; i++) assert.equal(ms.answerBlank(true, BK_KEYS[i % BK_KEYS.length]).catDone, false);
  assert.ok(!ms.catFull('bk'));
  assert.equal(ms.answerBlank(true, BK_KEYS[3]).catDone, true, '빈칸 추리도 하루 문제 수에서 오늘 끝');
  assert.ok(ms.catFull('bk')); assert.ok(!ms.catFull('sp'), '맞춤법은 그대로 풀 수 있음');
  assert.deepEqual(ms.openCats(), ['add', 'sub', 'mul', 'div'], '수학 항목은 그대로 풀 수 있음');
  assert.equal(hangul(), hangul0, '빈칸 추리를 풀어도 한글 칸은 하나도 안 바뀜');
  // 열쇠는 정렬 (저장했다 다시 읽은 모양과 같게)
  const keys = Object.keys(ms.mathState().sp);
  assert.deepEqual(keys, [...keys].sort());
}

// ---------- 5) 저장 모양 · 두 기기 합치기 · 초기화 · 공부 먼저 ----------
{
  const good = spCode(29500000, SP_WRONG);
  assert.deepEqual(md.normalizeMath({ sp: { bk3: good, bk99999: good, 'bk3.1': good, 'k2.1': good, bk4: -1, bk5: 'x', bk6: 1e12 } })!.sp, { bk3: good, 'k2.1': good }, '모르는 열쇠·이상한 값은 버림');
  assert.deepEqual(Object.keys(md.normalizeMath({ solvedC: { '20000:bk': { a: 3 }, '20000:zz': { a: 1 } } })!.solvedC), ['20000:bk'], "하루 기록 '날짜:bk'");
  // 합치기: 열쇠마다 큰 값(나중에 푼 쪽), 합치는 순서와 상관없이 같음, 몇 번 합쳐도 같음 (shared/merge.js는 그대로)
  const A = store.fresh(), Bs = store.fresh();
  (A as any).math = { ...md.freshMath(), sp: { bk1: spCode(100, SP_WRONG), bk2: spCode(200, SP_RIGHT), 'k1.1': spCode(50, SP_RIGHT) }, solvedC: { '9:bk': { d1: 3 } } };
  (Bs as any).math = { ...md.freshMath(), sp: { bk1: spCode(300, SP_FIX1), bk7: spCode(10, SP_WRONG) }, solvedC: { '9:bk': { d2: 4 } } };
  const ab = mergeState(A, Bs), ba = mergeState(Bs, A);
  assert.equal(JSON.stringify(ab.math), JSON.stringify(ba.math), '합치는 순서와 상관없이 같음');
  assert.deepEqual(ab.math.sp, { bk1: spCode(300, SP_FIX1), bk2: spCode(200, SP_RIGHT), bk7: spCode(10, SP_WRONG), 'k1.1': spCode(50, SP_RIGHT) });
  assert.deepEqual(ab.math.solvedC['9:bk'], { d1: 3, d2: 4 }, '하루 기록은 기기별로 세고 합계');
  assert.equal(JSON.stringify(mergeState(ab, Bs).math), JSON.stringify(ab.math), '몇 번 합쳐도 같음');
  // 한글 전체 초기화에도 빈칸 추리 기록 유지
  const keep = JSON.stringify(ms.mathState().sp);
  store.reset();
  assert.equal(JSON.stringify(ms.mathState().sp), keep, '전체 초기화에도 빈칸 추리 기록 유지');
  // 공부 먼저(10-28): 빈칸 추리는 공부 화면이라 안 잠김
  const gate = await import('../src/lib/gate');
  assert.ok(!('mathBlank' in gate.GATE_SCREENS) && gate.gateBlock('mathBlank') === null, '빈칸 추리 화면은 안 잠김');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes("case 'mathBlank'") && app.includes("onBlank={() => go('mathBlank')}"), '첫 화면 → 빈칸 추리 화면');
}
console.log(`빈칸 추리: 문제 ${BANK.length}개(한 문장 ${byLv[1] + byLv[2]} · 짧은 이야기 ${byLv[3]}, 빈칸·단서·보기 셋·오답 까닭·글꼴·열쇠 유지), 어절 나누기·보기 섞기·문제 시간 ${BK_SEC_RANGE.join('~')}초,`
  + ` 처음엔 한 문장(쉬운 것 먼저)→${STORY_OPEN}개 맞히면 짧은 이야기·틀린 문제 다시·이틀 뒤 확인·최근 문제 안 겹침, 보상·하루 문제 수·수학 단계/맞춤법/한글 칸 그대로·저장·합치기·초기화·공부 먼저 통과`);
