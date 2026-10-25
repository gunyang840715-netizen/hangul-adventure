// 수학 모드(초등 2학년 아이, 10-23) 검사:
// 1) 문제·보기가 맞는지(12단계), 항목(덧셈·뺄셈·곱셈·나눗셈·골고루)마다 그 항목 문제만 나오는지, 문제 시간
// 2) 하루 공부 시간(30분·1시간, 문제 수 제한 없음) · 항목당 하루 150문제 · 정답 10개마다 꾸미기 · 5개마다 재료 ·
//    시간이 끝날 때(또는 그 항목 150문제째) 그 항목을 20문제 이상 90% 이상 맞히면 그 항목만 다음 단계 (하루 한 단계)
// 3) 수학 집(집 짓기·집 안·마당·놀이터)·옷장·이름이 한글 쪽과 따로인지
// 4) 한글 초기화·예전 백업 불러오기에도 수학 기록 유지, 망가진 수학 칸이 한글 진도를 막지 않는지, 예전 12단계 기록 옮기기
import assert from 'node:assert/strict';
const memory: Record<string, string> = { 'hangul-device': 'math-test' };
const g = globalThis as any;
g.window = g;
g.window.setTimeout = setTimeout; g.window.clearTimeout = clearTimeout;
g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
const md = await import('../src/math/mathData');
const { STAGES, CATS, CAT, makeProblemFor, makeStageProblem, normalizeMath, freshMath, lvFromLevel, catOf, catStage, DAY_MIN, DAY_MIN_CHOICES, CAT_MAX, ITEM_EVERY, MAT_EVERY, SNACK_EVERY, UP_MIN, TIME_CHOICES } = md;
const store = await import('../src/engine/store');
const ms = await import('../src/math/mathStore');
const { ITEM, PET, BUILDS, SNACK, SNACKS } = await import('../src/data/pets');
const { FURN, FURN_BY } = await import('../src/data/home');

// ---------- 1) 문제와 보기 ----------
const ones = (n: number) => n % 10;
const carry = (a: number, b: number) => { for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) + ones(y) >= 10) return true; return false; };
const borrow = (a: number, b: number) => { for (let x = a, y = b; y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) < ones(y)) return true; return false; };
const N = 3000;
for (let st = 0; st < STAGES.length; st++) {
  assert.ok(STAGES[st].sec >= 5 && STAGES[st].sec <= 60, `문제 시간 ${st}: ${STAGES[st].sec}초`);
  for (let k = 0; k < N; k++) {
    const p = makeStageProblem(st);
    assert.equal(p.stage, st);
    assert.equal(p.cat, catOf(st), '문제의 항목');
    assert.equal(p.sec, STAGES[st].sec, '문제 시간은 단계 것');
    const m = /^(\d+) ([+−×÷]) (\d+)$/.exec(p.q);
    assert.ok(m, '문제 모양: ' + p.q);
    const a = +m![1], op = m![2], b = +m![3];
    let ans: string;
    if (op === '+') ans = String(a + b);
    else if (op === '−') ans = String(a - b);
    else if (op === '×') ans = String(a * b);
    else ans = a % b ? `${Math.floor(a / b)} … ${a % b}` : String(a / b);
    assert.equal(p.ans, ans, `정답: ${p.q} = ${p.ans}`);
    assert.equal(p.opts.length, 4, '보기 4개');
    assert.equal(new Set(p.opts).size, 4, '보기는 모두 다름: ' + p.opts);
    assert.ok(p.opts.includes(p.ans), '보기에 정답');
    for (const o of p.opts) {
      const r = /^(\d+) … (\d+)$/.exec(o);
      if (ans.includes('…')) assert.ok(r && +r[1] >= 1 && +r[2] >= 1, '나머지 보기 모양: ' + o);
      else { assert.ok(/^\d+$/.test(o), '숫자 보기: ' + o); if (op === '÷') assert.ok(+o >= 1); }
    }
    // 단계마다 문제 범위
    const two = (x: number) => x >= 10 && x <= 99, three = (x: number) => x >= 100 && x <= 999;
    const opOf: Record<string, string> = { add: '+', sub: '−', mul: '×', div: '÷' };
    assert.equal(op, opOf[p.cat], '항목과 계산 기호: ' + p.q);
    if (st === 0) assert.ok(op === '+' && two(a) && two(b) && !carry(a, b), 'S0 ' + p.q);
    if (st === 1) assert.ok(op === '+' && two(a) && two(b) && ones(a) + ones(b) >= 10, 'S1 ' + p.q);
    if (st === 2) assert.ok(op === '−' && two(a) && two(b) && a > b && !borrow(a, b), 'S2 ' + p.q);
    if (st === 3) assert.ok(op === '−' && two(a) && two(b) && a > b && borrow(a, b), 'S3 ' + p.q);
    if (st === 4) assert.ok(op === '+' && three(a) && three(b) && a + b <= 999, 'S4 ' + p.q);
    if (st === 5) assert.ok(op === '−' && three(a) && three(b) && a > b, 'S5 ' + p.q);
    if (st === 6) assert.ok(op === '×' && a >= 2 && a <= 5 && b >= 2 && b <= 9, 'S6 ' + p.q);
    if (st === 7) assert.ok(op === '×' && a >= 6 && a <= 9 && b >= 2 && b <= 9, 'S7 ' + p.q);
    if (st === 8) assert.ok(op === '×' && a >= 2 && a <= 9 && b >= 2 && b <= 9, 'S8 ' + p.q);
    if (st === 9) assert.ok(op === '×' && two(a) && ones(a) !== 0 && b >= 2 && b <= 9, 'S9 ' + p.q);
    if (st === 10) assert.ok(op === '÷' && b >= 2 && b <= 9 && a % b === 0 && a / b >= 2 && a / b <= 9, 'S10 ' + p.q);
    if (st === 11) assert.ok(op === '÷' && b >= 2 && b <= 9 && a % b >= 1 && Math.floor(a / b) >= 1 && Math.floor(a / b) <= 9, 'S11 ' + p.q);
  }
}
// 항목: 12단계가 네 항목에 한 번씩, 쉬운 것부터
{
  const all = CATS.flatMap(c => c.stages);
  assert.deepEqual([...all].sort((x, y) => x - y), STAGES.map((_, i) => i), '12단계가 항목마다 한 번씩');
  for (const c of CATS) {
    assert.deepEqual(c.stages, [...c.stages].sort((x, y) => x - y), c.name + ' 단계 순서');
    assert.equal(catStage(c.id, -3), c.stages[0]); assert.equal(catStage(c.id, 99), c.stages[c.stages.length - 1]);
  }
}
// 고른 항목 문제만 나오고, 앞 단계 복습은 다섯 문제 중 하나쯤, 첫 단계는 복습 없음
{
  const top = { add: 2, sub: 2, mul: 3, div: 1 } as const;
  for (const c of CATS) {
    const lv = { add: 0, sub: 0, mul: 0, div: 0, [c.id]: top[c.id] };
    let rev = 0; const n = 3000;
    for (let k = 0; k < n; k++) {
      const p = makeProblemFor(c.id, lv);
      assert.equal(p.cat, c.id, `${c.name}만 나옴: ${p.q}`);
      const at = c.stages.indexOf(p.stage);
      assert.ok(at >= 0 && at <= top[c.id], `${c.name} 지금 단계까지만: ${p.q}`);
      if (at < top[c.id]) rev++;
    }
    assert.ok(rev > n * 0.12 && rev < n * 0.28, `${c.name} 복습 비율 ${rev / n}`);
    for (let k = 0; k < 300; k++) assert.equal(makeProblemFor(c.id, freshMath().lv).stage, c.stages[0], c.name + ' 첫 단계는 복습 없음');
  }
  // 골고루: 네 항목이 고르게, 항목마다 그 항목의 지금 단계까지만
  const lv = { add: 1, sub: 0, mul: 2, div: 1 };
  const cnt: Record<string, number> = {};
  const n = 8000;
  for (let k = 0; k < n; k++) {
    const p = makeProblemFor('mix', lv);
    cnt[p.cat] = (cnt[p.cat] || 0) + 1;
    assert.ok(CAT[p.cat].stages.indexOf(p.stage) <= lv[p.cat], '골고루도 그 항목 단계까지만: ' + p.q);
  }
  for (const c of CATS) assert.ok(cnt[c.id] > n * 0.2 && cnt[c.id] < n * 0.3, `골고루 ${c.name} ${cnt[c.id] / n}`);
}
// 문제 시간 고르기: 끄기(0) 포함, 이상한 값은 보통(1)
assert.ok(TIME_CHOICES.some(([v]) => v === 0) && TIME_CHOICES.some(([v]) => v === 1), '시간 끄기·보통');
assert.equal(normalizeMath({ timeMul: 7 })!.timeMul, 1);
assert.equal(normalizeMath({ timeMul: 0 })!.timeMul, 0);

// ---------- 2) 하루 공부 시간(문제 수 제한 없음) · 항목당 하루 150문제 · 정답 10개마다 꾸미기 · 5개마다 재료 · 항목마다 다음 단계 ----------
store.replaceAll(store.fresh());
const hangul = () => JSON.stringify({ ...store.load(), epoch: 0, math: undefined });
const before = hangul();
assert.equal(store.load().math, undefined, '수학을 하기 전에는 수학 칸 없음 (예전과 같은 저장 모양)');
assert.deepEqual(ms.mathState().lv, { add: 0, sub: 0, mul: 0, div: 0 });
assert.equal(ms.mathMatsLeft(), 0);
assert.equal(ms.mathState().dayMin, DAY_MIN, '하루 공부 시간 기본 30분');
assert.deepEqual(DAY_MIN_CHOICES, [30, 60], '부모 설정 30분 · 1시간');
assert.equal(CAT_MAX, 150, '한 항목은 하루 150문제까지');
const LIMIT = DAY_MIN * 60000;
// 다음 날처럼: 그날 기록·공부 시간을 비우고, 단계 바꾼 시각도 예전 날로 (하루 한 단계 검사가 다음 날에는 안 막게)
const newDay = () => { const m = store.load().math!; m.solved = {}; m.correct = {}; m.solvedC = {}; m.correctC = {}; m.ms = {}; for (const k of Object.keys(m.lvT)) m.lvT[k] = 1; };
// 시간이 끝나는 순간까지 공부 시간 더하기 → 그때 오른 항목
const timeUpNow = () => { const r = ms.addMathMs(ms.todayMath().leftMs); assert.ok(r.timeUp, '하루 공부 시간이 되는 순간 끝'); return r.ups; };
// 덧셈 25문제 모두 정답 + 곱셈 25문제 중 20개 정답(80%) — 50문제를 풀어도 시간이 남으면 계속, 시간이 끝날 때 덧셈만 다음 단계
let items: string[] = [], mats = 0, ups: string[] = [];
const snacksGot: string[] = [];
for (let k = 1; k <= 50; k++) {
  const cat = k <= 25 ? 'add' : 'mul';
  const ok = cat === 'add' || k % 5 !== 0;
  const r = ms.answerMath(ok, cat);
  if (r.item) items.push(r.item);
  if (r.mat) mats++;
  if (r.snack) snacksGot.push(r.snack);
  assert.equal(!!r.snack, r.mat, '간식은 재료와 같이 정답 5개마다');
  assert.equal(r.catDone, false, '150문제 전에는 항목 끝 X');
  assert.deepEqual(r.ups, [], '시간이 끝나기 전에는 단계 그대로');
}
assert.ok(!ms.mathTimeUp(), '문제 수로는 끝나지 않음 (예전 하루 50문제 없앰)');
assert.deepEqual(ms.openCats(), ['add', 'sub', 'mul', 'div']);
assert.deepEqual(ms.addMathMs(LIMIT - 1000), { timeUp: false, ups: [] }, '시간이 남으면 계속');
assert.equal(ms.todayMath().leftMs, 1000);
assert.deepEqual(ms.addMathMs(0), { timeUp: false, ups: [] });
assert.deepEqual(ms.addMathMs(-5), { timeUp: false, ups: [] });
const r1 = ms.addMathMs(1000);
assert.ok(r1.timeUp, '30분이 되는 순간 끝'); ups = r1.ups;
assert.ok(ms.mathTimeUp());
assert.equal(ms.todayMath().leftMs, 0);
assert.deepEqual(ms.addMathMs(5000), { timeUp: false, ups: [] }, '끝난 뒤에 더해도 다시 판정 X');
const m1 = ms.mathState();
assert.equal(ms.todayMath().solved, 50);
assert.equal(ms.todayMath().correct, 45);
assert.deepEqual(ms.todayCat('add'), { solved: 25, correct: 25 });
assert.deepEqual(ms.todayCat('mul'), { solved: 25, correct: 20 });
assert.equal(items.length, Math.floor(45 / ITEM_EVERY), '정답 10개마다 꾸미기 하나');
assert.equal(new Set(items).size, items.length, '같은 꾸미기 두 번 X');
assert.ok(items.every(id => ITEM[id]), '있는 꾸미기만');
assert.deepEqual(m1.owned, [...items].sort(), '수학 옷장에만 들어감');
assert.equal(mats, Math.floor(45 / MAT_EVERY), '정답 5개마다 재료');
assert.equal(ms.mathMatsLeft(), 9);
assert.equal(snacksGot.length, Math.floor(45 / SNACK_EVERY), '정답 5개마다 간식 하나');
assert.ok(snacksGot.every(id => SNACK[id]), '있는 간식만');
assert.equal(ms.mathSnackTotal(), snacksGot.length, '받은 간식은 수학 간식 칸에');
assert.deepEqual(store.load().snacks, {}, '한글 간식은 그대로');
assert.deepEqual(ups, ['add'], '90% 이상인 항목만 다음 단계');
assert.deepEqual(m1.lv, { add: 1, sub: 0, mul: 0, div: 0 });
assert.deepEqual(store.load().owned, [], '한글 옷장은 그대로');
assert.equal(hangul(), before, '한글 진도·보상·사용 시간·집 칸은 하나도 안 바뀜 (공부 시간은 수학 칸에만)');
// 다음 날: 덧셈 19문제(다 맞음) + 뺄셈 31문제 중 28개(90.3%) → 뺄셈만 (덧셈은 20문제가 안 됨)
newDay();
assert.ok(!ms.mathTimeUp(), '다음 날은 다시 30분');
for (let k = 1; k <= 50; k++) {
  const cat = k <= 19 ? 'add' : 'sub';
  ms.answerMath(cat === 'add' || k > 22, cat);
}
assert.deepEqual(timeUpNow(), ['sub'], `그날 ${UP_MIN}문제가 안 되는 항목은 그대로, 90% 넘은 항목만`);
assert.deepEqual(ms.mathState().lv, { add: 1, sub: 1, mul: 0, div: 0 });
// 골고루 50문제를 다 맞혀도 항목마다 20문제가 안 되면 그대로 (복습용)
newDay();
for (let k = 0; k < 50; k++) ms.answerMath(true, CATS[k % 4].id);
assert.deepEqual(timeUpNow(), [], '골고루는 항목마다 13문제 이하라 단계 그대로');
assert.deepEqual(ms.mathState().lv, { add: 1, sub: 1, mul: 0, div: 0 });
// 마지막 단계에서는 더 안 오름
ms.setMathLv('div', 1);
newDay();
for (let k = 0; k < 50; k++) ms.answerMath(true, 'div');
assert.deepEqual(timeUpNow(), [], '마지막 단계는 그대로');
assert.equal(ms.mathState().lv.div, 1);
// 한 항목은 하루 150문제까지: 150문제째에 그 항목 끝 + 그 항목 판정, 골고루는 남은 항목만, 시간 끝 판정 때 같은 날 두 번 오르지 않음
newDay();
ups = [];
for (let k = 1; k <= CAT_MAX; k++) {
  const r = ms.answerMath(k % 20 !== 0, 'mul');   // 150문제 중 143개(95%)
  if (k < CAT_MAX) assert.ok(!r.catDone && !r.ups.length, '150문제 전');
  else { assert.ok(r.catDone, '150문제째에 곱셈 오늘 끝'); ups = r.ups; }
}
assert.deepEqual(ups, ['mul'], '150문제를 다 푼 항목은 그때 판정');
assert.equal(ms.mathState().lv.mul, 1);
assert.ok(ms.catFull('mul') && !ms.catFull('add'));
assert.deepEqual(ms.openCats(), ['add', 'sub', 'div']);
assert.ok(!ms.mathTimeUp(), '항목이 끝나도 다른 항목은 시간 안에 계속');
for (let k = 0; k < 2000; k++) assert.notEqual(makeProblemFor('mix', ms.mathState().lv, 0.2, ms.openCats()).cat, 'mul', '골고루에 다 푼 항목은 안 나옴');
for (let k = 0; k < 25; k++) ms.answerMath(true, 'add');
assert.deepEqual(timeUpNow(), ['add'], '시간 끝: 곱셈은 이미 오늘 올라서 또 오르지 않고(하루 한 단계), 덧셈만');
assert.deepEqual(ms.mathState().lv, { add: 2, sub: 1, mul: 1, div: 1 });
// 네 항목을 모두 150문제 풀면 골고루도 끝 (남은 항목 없음 → 아무 항목에서나 냄)
const mAll = store.load().math!;
for (const c of CATS) mAll.solvedC[String(store.today()) + ':' + c.id] = { x: CAT_MAX };
assert.deepEqual(ms.openCats(), [], '네 항목 모두 끝');
{ const pc = makeProblemFor('mix', mAll.lv, 0.2, []).cat; assert.ok(CATS.some(c => c.id === pc), '남은 항목이 없어도 문제 만들기는 멈추지 않음'); }
// 부모가 하루 공부 시간을 바꿈: 1시간이면 40분 공부해도 계속 → 30분으로 줄이면 그때 끝(판정) → 다시 1시간이면 이어서, 그날 두 번은 안 오름
newDay();
ms.setMathDayMin(60);
assert.equal(ms.mathState().dayMin, 60);
for (let k = 0; k < 25; k++) ms.answerMath(true, 'mul');
assert.deepEqual(ms.addMathMs(40 * 60000), { timeUp: false, ups: [] }, '1시간이면 40분에도 계속');
assert.equal(ms.todayMath().leftMs, 20 * 60000);
ms.setMathDayMin(30);
assert.ok(ms.mathTimeUp(), '30분으로 줄이면 오늘은 끝');
assert.equal(ms.mathState().lv.mul, 2, '줄여서 끝난 그때 판정');
ms.setMathDayMin(60);
assert.ok(!ms.mathTimeUp(), '다시 1시간이면 이어서');
for (let k = 0; k < 25; k++) ms.answerMath(true, 'mul');
assert.deepEqual(timeUpNow(), [], '1시간이 끝날 때: 곱셈은 오늘 이미 올라서 그대로');
assert.equal(ms.mathState().lv.mul, 2);
ms.setMathDayMin(30);
assert.equal(normalizeMath({ dayMin: 45 })!.dayMin, DAY_MIN, '30분·1시간이 아니면 30분');
assert.equal(normalizeMath({ dayMin: 60 })!.dayMin, 60);
assert.deepEqual(normalizeMath({ ms: { x: 1, '20700': { e: 5, f: -1 } } })!.ms, { '20700': { e: 5 } });
// 그날 부모가 단계를 직접 바꾼 항목은 그날 시간 끝에 또 오르지 않음 (다음 날 판정)
newDay();
ms.setMathLv('add', 0);
for (let k = 0; k < 25; k++) ms.answerMath(true, 'add');
assert.deepEqual(timeUpNow(), [], '부모가 오늘 바꾼 단계는 그대로');
assert.equal(ms.mathState().lv.add, 0);
newDay();
for (let k = 0; k < 25; k++) ms.answerMath(true, 'add');
assert.deepEqual(timeUpNow(), ['add'], '다음 날에는 판정');
ms.setMathLv('add', 1);
// 부모 설정
ms.setMathLv('add', 99); assert.equal(ms.mathState().lv.add, CAT.add.stages.length - 1);
ms.setMathLv('add', -5); assert.equal(ms.mathState().lv.add, 0);
ms.setMathLv('add', 1); assert.equal(ms.mathState().lv.add, 1);
ms.setMathDayMin(60); assert.equal(ms.mathState().dayMin, 60); ms.setMathDayMin(30); assert.equal(ms.mathState().dayMin, 30);
ms.setMathTime(0.75); assert.equal(ms.mathState().timeMul, 0.75);
assert.equal(ms.mathWho(), '내', '이름이 없으면 "내 옷장"');
ms.setMathName('  가나다라마바사아자차카타  '); assert.equal(ms.mathState().name, '가나다라마바사아자차', '이름은 앞뒤 빈칸 빼고 10글자까지');
assert.equal(ms.mathWho(), '가나다라마바사아자차');
ms.setMathName('   '); assert.equal(ms.mathState().name, '');
assert.equal(normalizeMath({ name: 7 })!.name, '');
assert.equal(store.load().name, store.fresh().name, '수학 이름은 한글 이름과 따로');

// ---------- 3) 수학 옷장 · 수학 집 (한글과 따로) ----------
const it0 = ms.mathState().owned[0];
const [slot, key] = it0.split(':') as any;
ms.toggleMathWear('maltese', slot, key);
assert.equal((ms.mathWear('maltese') as any)[slot], key);
assert.deepEqual(store.load().wear, {}, '한글 꾸미기는 그대로');
ms.toggleMathWear('maltese', slot, key);
assert.equal((ms.mathWear('maltese') as any)[slot], undefined);
// 옷장에서 고른 친구: 강아지면 강아지 집, 고양이면 고양이 집에 산다
ms.setMathPet('poodle');
assert.equal(ms.mathPet(), 'poodle');
assert.equal(ms.mathPetView('dog').id, 'poodle'); assert.equal(ms.mathPetView('cat').id, 'koshort');
ms.setMathPet('persian');
assert.equal(ms.mathPetView('dog').id, 'poodle'); assert.equal(ms.mathPetView('cat').id, 'persian');
ms.toggleMathWear('persian', slot, key);
assert.equal((ms.mathPetView('cat').wear as any)[slot], key, '수학 집 친구는 수학 옷장 꾸미기를 입음');
assert.equal(store.load().dog, store.fresh().dog, '한글 강아지는 그대로'); assert.equal(store.load().cat, store.fresh().cat, '한글 고양이는 그대로');
// 수학 간식 먹이기 (10-24): 강아지 간식은 강아지, 고양이 간식은 고양이, 같이 먹는 간식은 둘 다 — 한글 간식·성장과 따로
{
  const sid = Object.keys(SNACK).find(k => ms.mathSnackCount(k) > 0)!;
  assert.ok(sid, '먹일 간식 있음');
  const sp = SNACK[sid].for === 'cat' ? 'cat' : 'dog';
  const eater = ms.mathPetView(sp).id, other = ms.mathPetView(sp === 'dog' ? 'cat' : 'dog').id;
  const n0 = ms.mathSnackCount(sid), t0 = ms.mathSnackTotal();
  if (SNACK[sid].for !== 'both') assert.equal(ms.mathFeed(other, sid), false, '강아지 간식은 고양이가(고양이 간식은 강아지가) 못 먹음');
  assert.equal(ms.mathSnackCount(sid), n0, '못 먹이면 그대로');
  assert.ok(ms.mathFeed(eater, sid));
  assert.equal(ms.mathSnackCount(sid), n0 - 1); assert.equal(ms.mathSnackTotal(), t0 - 1);
  assert.equal(ms.mathFedCount(eater), 1, '먹은 횟수(하트)');
  while (ms.mathSnackCount(sid) > 0) assert.ok(ms.mathFeed(eater, sid));
  assert.equal(ms.mathFeed(eater, sid), false, '간식이 없으면 못 먹임');
  assert.equal(ms.mathFedCount(eater), n0);
  assert.equal(ms.mathFeed(eater, 'nope'), false); assert.equal(ms.mathFeed('ghost', sid), false);
  const both = SNACKS.find(x => x.for === 'both' && ms.mathSnackCount(x.id) > 0);
  if (both) { assert.ok(ms.mathFeed(ms.mathPetView('cat').id, both.id), '같이 먹는 간식은 고양이도'); }
  assert.deepEqual(store.load().snacks, {}, '한글 간식은 그대로'); assert.deepEqual(store.load().eaten, {}, '한글 먹인 기록은 그대로');
  assert.deepEqual(store.load().growth, {}, '한글 친구 성장은 그대로');
}
// 집 짓기: 재료 하나로 한 부분, 재료가 없으면 못 지음
const matsBefore = ms.mathMatsLeft();
assert.ok(matsBefore > 3, '재료 있음 ' + matsBefore);
assert.equal(ms.mathNextBuild()!.id, BUILDS[0].id);
assert.equal(ms.mathBuildPart(BUILDS[0].id), 1);
assert.equal(ms.mathBuildPart(BUILDS[0].id), 2);
assert.equal(ms.mathMatsLeft(), matsBefore - 2);
assert.equal(ms.mathBuiltCount(BUILDS[0].id), 2);
assert.equal(store.builtCount(BUILDS[0].id), 0, '한글 집은 그대로');
assert.equal(store.matsLeft(), 0, '한글 재료는 그대로');
// 가구 사기(재료 1개, 한 번 사면 계속) · 놓기
const furn = FURN.find(f => !f.free && f.slot === 'bed')!;
assert.ok(ms.mathBuyFurn(furn.id));
assert.equal(ms.mathMatsLeft(), matsBefore - 3);
assert.ok(ms.mathBuyFurn(furn.id), '산 것은 다시 사도 재료 안 씀');
assert.equal(ms.mathMatsLeft(), matsBefore - 3);
assert.ok(ms.mathIsBought(furn.id)); assert.ok(!store.isBought(furn.id), '한글 쪽은 안 산 것');
ms.mathSetDeco('doghouse', 'bed', furn.id);
assert.equal(ms.mathDecoOf('doghouse').bed, furn.id);
assert.deepEqual(store.decoOf('doghouse'), {}, '한글 집 안은 그대로');
ms.mathSetDeco('doghouse-out', 'y-color', 'y-color:base');
assert.equal(ms.mathDecoOf('doghouse-out')['y-color'], 'y-color:base', '마당도 수학 기록에');
ms.mathSetDeco('doghouse', 'bed', null);
assert.equal(ms.mathDecoOf('doghouse').bed, undefined);
// 재료를 다 쓰면 못 짓고 못 삼
const parts = BUILDS.reduce((n, b) => n + b.parts.length, 0);
while (ms.mathMatsLeft() > 0 && ms.mathNextBuild()) assert.ok(ms.mathBuildPart(ms.mathNextBuild()!.id));
if (!ms.mathNextBuild()) {
  assert.equal(BUILDS.reduce((n, b) => n + ms.mathBuiltCount(b.id), 0), parts, '다 지음');
  assert.equal(ms.mathBuildPart(BUILDS[0].id), null, '다 지은 것은 더 못 지음');
}
for (const f of FURN) { if (ms.mathMatsLeft() <= 0) break; if (!f.free && !ms.mathIsBought(f.id)) assert.ok(ms.mathBuyFurn(f.id)); }
assert.equal(ms.mathMatsLeft(), 0, '재료를 다 씀');
const unbuilt = BUILDS.find(b => ms.mathBuiltCount(b.id) < b.parts.length);
if (unbuilt) assert.equal(ms.mathBuildPart(unbuilt.id), null, '재료가 없으면 못 지음');
const furn2 = FURN.find(f => !f.free && !ms.mathIsBought(f.id))!;
assert.equal(ms.mathBuyFurn(furn2.id), false, '재료가 없으면 못 삼');
assert.equal(hangul(), before, '수학 집을 지어도 한글 칸은 하나도 안 바뀜');

// ---------- 4) 한글 초기화·예전 백업·망가진 칸·예전 기록 옮기기 ----------
// 열쇠 순서와 상관없이 비교 (저장했다 다시 읽으면 normalizeMath 순서로 바뀜)
const canon = (o: any) => JSON.stringify(o, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((r: any, x) => (r[x] = v[x], r), {}) : v);
const keep = canon(store.load().math);
store.reset();
assert.equal(canon(store.load().math), keep, '전체 초기화에도 수학 기록 유지');
store.resetProgress();
assert.equal(canon(store.load().math), keep, '진도 초기화에도 수학 기록 유지');
const old = store.fresh(); delete (old as any).math;
const code = btoa(unescape(encodeURIComponent(JSON.stringify({ ...old, name: '예전' }))));
assert.ok(store.importCode(code));
assert.equal(store.load().name, '예전');
assert.equal(canon(store.load().math), keep, '수학이 없는 예전 백업을 불러와도 수학 기록 유지');
assert.equal(normalizeMath(null), undefined);
assert.equal(normalizeMath([1, 2]), undefined);
const bad = normalizeMath({
  level: 'x', perDay: 9999, dayMin: 'x', ms: { '20700': { e: 7 }, y: 3 }, solved: { abc: 1, '20700': { d: -3, e: 4 } }, owned: ['hat:nope', 'hat:crown', 'hat:crown', 7],
  wear: { nobody: { hat: 'crown' }, maltese: { hat: 'nope', glasses: 'sun' } },
  lv: { add: 9, sub: -2, mul: 'x', zzz: 1 }, lvT: { add: 3, zzz: 4 }, solvedC: { '20700:add': { e: 3 }, '20700:zzz': { e: 1 }, 'x:add': { e: 1 } },
  dog: 'koshort', cat: 'persian', built: { doghouse: { e: 2 }, nope: { e: 1 } }, bought: { [furn.id]: 5, 'nope:x': 3 },
  snacks: { bone: { e: 2 }, nope: { e: 1 } }, eaten: { bone: { e: 1, f: -2 }, zz: { e: 1 } }, fed: { maltese: { e: 3 }, ghost: { e: 1 } },
  deco: { doghouse: { bed: furn.id, rug: 'nope:x' }, mars: { bed: furn.id } }, decoT: { doghouse: 1, mars: 2 },
})!;
assert.equal(bad.level, 0); assert.equal(bad.perDay, freshMath().perDay); assert.equal(bad.dayMin, DAY_MIN); assert.deepEqual(bad.ms, { '20700': { e: 7 } });
assert.deepEqual(bad.solved, { '20700': { e: 4 } });
assert.deepEqual(bad.owned, ['hat:crown']);
assert.deepEqual(bad.wear, { maltese: { glasses: 'sun' } });
assert.deepEqual(bad.lv, { add: CAT.add.stages.length - 1, sub: 0, mul: 0, div: 0 });
assert.deepEqual(bad.lvT, { add: 3 });
assert.deepEqual(bad.solvedC, { '20700:add': { e: 3 } });
assert.equal(bad.dog, undefined, '강아지 자리에 고양이 X'); assert.equal(bad.cat, 'persian');
assert.deepEqual(bad.built, { doghouse: { e: 2 } });
assert.deepEqual(bad.bought, { [furn.id]: 5 });
assert.deepEqual(bad.deco, { doghouse: { bed: furn.id } }); assert.deepEqual(bad.decoT, { doghouse: 1 });
assert.deepEqual(bad.snacks, { bone: { e: 2 } }); assert.deepEqual(bad.eaten, { bone: { e: 1 } }); assert.deepEqual(bad.fed, { maltese: { e: 3 } });
assert.ok(FURN_BY[furn.id] && PET.persian);
// 예전(항목 나누기 전) 12단계 기록 → 항목마다 단계로 (앞 단계는 끝낸 것으로)
assert.deepEqual(lvFromLevel(0), { add: 0, sub: 0, mul: 0, div: 0 });
assert.deepEqual(lvFromLevel(1), { add: 1, sub: 0, mul: 0, div: 0 });
assert.deepEqual(lvFromLevel(7), { add: 2, sub: 2, mul: 1, div: 0 });
assert.deepEqual(lvFromLevel(11), { add: 2, sub: 2, mul: 3, div: 1 });
assert.deepEqual(normalizeMath({ level: 3 })!.lv, { add: 2, sub: 1, mul: 0, div: 0 });
assert.deepEqual(normalizeMath({ level: 7, lv: { add: 0 } })!.lv, { add: 0, sub: 2, mul: 1, div: 0 }, '새 기록(lv)이 있으면 그것을');
// 수학 칸이 망가진 연동 상태도 한글 진도는 받아들인다
const remote: any = JSON.parse(JSON.stringify(store.load()));
remote.lessonIdx = 4; remote.math = 'broken';
assert.ok(store.absorb(remote), '수학 칸이 이상해도 한글 연동은 됨');
assert.equal(store.load().lessonIdx, 4);
assert.equal(canon(store.load().math), keep, '이상한 수학 칸은 무시하고 내 기록 유지');
// 저장·다시 읽기 해도 그대로 (칸 순서·값)
store.flushSave();
assert.equal(canon(normalizeMath(JSON.parse(JSON.stringify(store.load().math)))), keep, '저장 모양 그대로 다시 읽힘');
const once = normalizeMath(store.load().math);
assert.equal(JSON.stringify(normalizeMath(JSON.parse(JSON.stringify(once)))), JSON.stringify(once), '다시 읽어도 칸 순서까지 같음');
// ---------- 5) 맞춤법 (10-25 사용자 요청): 문장 은행 · 문제 고르기 · 틀린 문제 다시 · 기록·보상 · 저장·합치기 ----------
{
  const sp = await import('../src/math/spellData');
  const { SENTS, TIPS, parseSent, tipText, SP_KEYS, SP_KEY_SET, makeSpellQ, pickSpell, spNext, spCode, spOf, spWrongKeys, SP_RIGHT, SP_WRONG, SP_FIX1, SP_DONE, SP_RECHECK_MIN, sidOf } = sp;
  const { FONT_SYLLABLES } = await import('../src/data/fontchars');
  const { readFileSync } = await import('node:fs');
  const hangulOf = (x: string) => [...x].filter(c => c >= '가' && c <= '힣');
  // 은행: id·괄호·도움말·글꼴·정답이 문장 다른 곳에 그대로 보이지 않기
  const ids = new Set<string>();
  for (const st of SENTS) {
    assert.match(st.id, /^[a-z]\d{1,4}$/, '문장 id 모양 ' + st.id);
    assert.ok(!ids.has(st.id), '문장 id 중복 ' + st.id); ids.add(st.id);
    assert.ok([1, 2, 3].includes(st.lv), '난이도 ' + st.id);
    const bs = parseSent(st.t).filter(x => typeof x !== 'string') as { a: string; w: string; tip: string }[];
    assert.ok(bs.length >= 1, '괄호 하나 이상 ' + st.id);
    assert.ok(!st.t.replace(/\[[^\]]*\]/g, '').match(/[\[\]|]/), '괄호 모양 ' + st.id);
    for (const b of bs) {
      assert.ok(b.a && b.w && b.a !== b.w && !/\s/.test(b.a + b.w), '보기 둘 ' + st.id);
      assert.ok(b.tip.startsWith('=') ? b.tip.length > 1 : !!TIPS[b.tip], '도움말 ' + st.id + ' ' + b.tip);
      for (const c of hangulOf(b.a + b.w + tipText(b))) assert.ok(FONT_SYLLABLES.has(c), `앱 글꼴에 없는 글자 '${c}' (${st.id}) — 다른 글자로 바꾸기`);
    }
    for (const c of hangulOf(st.t + st.src + (st.who || ''))) assert.ok(FONT_SYLLABLES.has(c), `앱 글꼴에 없는 글자 '${c}' (${st.id})`);
  }
  for (const [k, v] of Object.entries(TIPS)) for (const c of hangulOf(v)) assert.ok(FONT_SYLLABLES.has(c), `도움말 글꼴 '${c}' (${k})`);
  assert.equal(SP_KEYS.length, new Set(SP_KEYS).size, '문제 열쇠 중복 없음');
  assert.ok(SP_KEYS.length >= 400, '문제 수 ' + SP_KEYS.length);
  for (const k of SP_KEYS) {
    const q = makeSpellQ(k)!;
    assert.equal(q.before + q.ans + q.after, q.full);
    assert.ok(q.opts.includes(q.ans) && q.opts.includes(q.wrong) && q.opts.length === 2, '보기 둘 ' + k);
    assert.ok(q.sec >= 18 && q.sec <= 40, '문제 시간 ' + k);
    const rest = q.before + ' ' + q.after;
    const seen = q.ans.length >= 2 ? rest.includes(q.ans) : new RegExp(`(^|[\\s,.!?])${q.ans}([\\s,.!?]|$)`).test(rest);
    assert.ok(!seen, `정답이 문장 다른 곳에 보임 ${k}: ${q.full}`);
  }
  assert.equal(makeSpellQ('k1.9'), null); assert.equal(makeSpellQ('zz.1'), null);
  // 같은 문장 다른 괄호: 낫 (놓고, 노코) 기역 자도 모른다 / 낫 놓고 (기역, 기억) 자도 모른다
  { const a = makeSpellQ('k1.1')!, b = makeSpellQ('k1.2')!;
    assert.deepEqual([a.before, a.ans, a.wrong, a.after], ['낫 ', '놓고', '노코', ' 기역 자도 모른다.']);
    assert.deepEqual([b.before, b.ans, b.wrong, b.after], ['낫 놓고 ', '기역', '기억', ' 자도 모른다.']); }
  // 문제 열쇠는 뒤에 추가만: 예전 열쇠는 그대로 있고 정답도 같아야 함 (기록이 다른 문제를 가리키지 않게)
  const base = JSON.parse(readFileSync(new URL('./spell_keys_baseline.json', import.meta.url), 'utf8')) as Record<string, string>;
  for (const [k, a] of Object.entries(base)) { assert.ok(SP_KEY_SET.has(k), '예전 문제 열쇠가 사라짐: ' + k); assert.equal(makeSpellQ(k)!.ans, a, '예전 문제의 정답이 바뀜: ' + k); }

  // 상태 바뀜: 틀림 → 고침(이틀 뒤 한 번 더) → 다시 확인까지 맞힘, 다시 틀리면 틀림
  assert.equal(spNext(undefined, true), SP_RIGHT); assert.equal(spNext(undefined, false), SP_WRONG);
  assert.equal(spNext(spCode(100, SP_WRONG), true), SP_FIX1); assert.equal(spNext(spCode(100, SP_FIX1), true), SP_DONE);
  assert.equal(spNext(spCode(100, SP_DONE), true), SP_DONE); assert.equal(spNext(spCode(100, SP_RIGHT), true), SP_RIGHT);
  assert.equal(spNext(spCode(100, SP_DONE), false), SP_WRONG);
  assert.deepEqual(spOf(spCode(29500000.7, 2)), { min: 29500000, st: 2 });

  // 문제 고르기: 처음에는 안 본 문제, 같은 문장은 최근 6문제 안에 다시 안 나옴, 쉬운 문제가 먼저 나오기 쉬움
  // (무작위는 씨앗을 정해 여러 판 돌림 — 검사 결과가 그때그때 달라지지 않게)
  const seeded = (s: number) => () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (const seed of [1, 7, 42, 2025, 31337, 99991, 123457, 777]) {
    const rnd = seeded(seed);
    const rec: Record<string, number> = {}; const recent: string[] = []; let now = 29500000;
    const lvOf = (k: string) => SENTS.find(x => x.id === sidOf(k))!.lv;
    const first: number[] = [];
    for (let n = 0; Object.keys(rec).length < SP_KEYS.length; n++) {
      assert.ok(n < SP_KEYS.length + 60, '모든 문제가 한 번씩 나옴 (같은 문장 다른 괄호 포함)');
      const k = pickSpell(rec, now, recent, false, rnd)!;
      assert.ok(SP_KEY_SET.has(k));
      const recentSent = recent.slice(-6).map(sidOf);
      assert.ok(!recentSent.includes(sidOf(k)), '같은 문장이 바로 다시 나옴 ' + k);
      // 안 본 문제가 먼저 — 남은 안 본 문제가 모두 방금 나온 문장일 때만 오래전에 푼 문제를 낸다
      if (rec[k]) assert.ok(SP_KEYS.every(x => rec[x] || recentSent.includes(sidOf(x))), '다 보기 전에는 안 본 문제만 ' + k);
      if (n < 100) first.push(lvOf(k));
      rec[k] = spCode(now, SP_RIGHT); recent.push(k); now += 1;
    }
    assert.ok(first.filter(x => x === 1).length > first.filter(x => x === 3).length * 3, '처음에는 쉬운 문제가 더 많이');
    // 다 본 뒤에는 오래전에 푼 것부터
    const k2 = pickSpell(rec, now + 10, recent, false, rnd)!;
    assert.ok(spOf(rec[k2])!.min <= 29500000 + 60, '다 본 뒤에는 오래된 것부터 ' + k2);
  }
  // 틀린 문제: 열 문제 안에는 다시 안 나오고, 그 뒤에는 열 번에 세 번쯤 먼저 나옴 · 다시 풀기는 틀린 문제만
  {
    const now = 29600000;
    const rec: Record<string, number> = { 'k1.1': spCode(now - 60, SP_WRONG), 'g1.2': spCode(now - 30, SP_WRONG), 'l7.1': spCode(now - 50, SP_RIGHT) };
    assert.equal(pickSpell(rec, now, [], false, () => 0.1), 'k1.1', '틀린 문제(오래된 것부터)');
    assert.equal(pickSpell(rec, now, ['k1.1'], false, () => 0.1), 'g1.2', '방금 나온 문제는 피함');
    assert.ok(!['k1.1', 'g1.2'].includes(pickSpell(rec, now, [], false, () => 0.5)!), '나머지는 새 문제');
    assert.deepEqual(spWrongKeys(rec), ['k1.1', 'g1.2']);
    assert.equal(pickSpell(rec, now, [], true), 'k1.1', '다시 풀기: 오래전에 틀린 것부터');
    assert.equal(pickSpell(rec, now, ['k1.1'], true), 'g1.2');
    assert.equal(pickSpell({ 'k1.1': spCode(now, SP_WRONG) }, now, ['k1.1'], true), 'k1.1', '하나 남으면 그것');
    assert.equal(pickSpell({ 'l7.1': spCode(now, SP_RIGHT) }, now, [], true), null, '틀린 문제가 없으면 다시 풀기 끝');
    // 고친 문제는 이틀 뒤 한 번 더
    const fix = { 'k2.1': spCode(now - SP_RECHECK_MIN - 5, SP_FIX1), 'k3.1': spCode(now - 60, SP_FIX1) };
    assert.equal(pickSpell(fix, now, [], false, () => 0.35), 'k2.1', '이틀 지난 고친 문제');
    assert.ok(pickSpell(fix, now, [], false, () => 0.35) !== 'k3.1');
  }
  // 기록·보상 (수학과 같이 셈) · 한글 칸은 그대로 · 하루 150문제
  store.replaceAll(store.fresh());
  const hangul0 = hangul();
  const lv0 = JSON.stringify(ms.mathState().lv);
  const k = SP_KEYS[0];
  let r = ms.answerSpell(false, k);
  assert.equal(spOf(ms.mathState().sp[k])!.st, SP_WRONG);
  assert.deepEqual(ms.spellWrong(), [k]); assert.equal(ms.spellStats().wrong, 1); assert.equal(ms.spellStats().seen, 1);
  assert.deepEqual(ms.todayCat('sp'), { solved: 1, correct: 0 });
  r = ms.answerSpell(true, k);
  assert.equal(spOf(ms.mathState().sp[k])!.st, SP_FIX1, '틀린 문제를 맞히면 고침');
  assert.deepEqual(ms.spellWrong(), [], '고치면 틀린 문제에서 빠짐');
  let items2 = 0, mats2 = 0, snacks2 = 0;
  for (let i = 1; i <= 48; i++) { const x = ms.answerSpell(true, SP_KEYS[i]); if (x.item) items2++; if (x.mat) mats2++; if (x.snack) snacks2++; assert.deepEqual(x.ups, []); }
  assert.equal(ms.mathTotalCorrect(), 49);
  assert.equal(items2, 4, '맞춤법 정답 10개마다 꾸미기 (수학과 같이)'); assert.equal(mats2, 9); assert.equal(snacks2, 9);
  assert.deepEqual(ms.todayCat('sp'), { solved: 50, correct: 49 });
  assert.equal(ms.todayMath().solved, 50, '하루 기록에도 같이');
  assert.equal(JSON.stringify(ms.mathState().lv), lv0, '맞춤법은 수학 단계를 바꾸지 않음');
  for (let i = 50; i < CAT_MAX - 1; i++) assert.equal(ms.answerSpell(true, SP_KEYS[i % SP_KEYS.length]).catDone, false);
  assert.ok(!ms.catFull('sp'));
  assert.equal(ms.answerSpell(true, SP_KEYS[200]).catDone, true, '맞춤법도 하루 150문제째에 오늘 끝');
  assert.ok(ms.catFull('sp')); assert.deepEqual(ms.openCats(), ['add', 'sub', 'mul', 'div'], '수학 항목은 그대로 풀 수 있음');
  assert.equal(hangul(), hangul0, '맞춤법을 풀어도 한글 칸은 하나도 안 바뀜');
  assert.equal(ms.modeTitle(), '수학·맞춤법', '이름이 없으면 첫 화면 버튼은 수학·맞춤법');
  ms.setMathName('가나'); assert.equal(ms.modeTitle(), '가나', '이름이 있으면 이름만 (수학 X)'); ms.setMathName('');
  // 저장 모양: 모르는 열쇠·이상한 값은 버리고, 열쇠는 정렬 · 한글 초기화·예전 백업에도 남음
  const good = spCode(29500000, SP_WRONG);
  assert.deepEqual(normalizeMath({ sp: { 'k2.1': good, 'zz.1': good, 'k1.9': good, 'k1.1': -5, 'k1.2': 'x', 'g1.1': 295000009, 'g1.2': 1e12 } })!.sp, { 'k2.1': good });
  assert.deepEqual(Object.keys(normalizeMath({ sp: { 'l7.1': good, 'g1.1': good, 'k1.1': good } })!.sp), ['g1.1', 'k1.1', 'l7.1']);
  assert.deepEqual(normalizeMath({})!.sp, {}, '예전 기록에는 빈 칸');
  const keepSp = JSON.stringify(ms.mathState().sp);
  store.reset();
  assert.equal(JSON.stringify(ms.mathState().sp), keepSp, '전체 초기화에도 맞춤법 기록 유지');
  const oldB = store.fresh(); delete (oldB as any).math;
  assert.ok(store.importCode(btoa(unescape(encodeURIComponent(JSON.stringify(oldB))))));
  assert.equal(JSON.stringify(ms.mathState().sp), keepSp, '예전 백업을 불러와도 맞춤법 기록 유지');
  console.log(`맞춤법: 문장 ${SENTS.length}개·문제 ${SP_KEYS.length}개(글꼴·도움말·정답 숨김·열쇠 유지), 같은 문장 다른 괄호·쉬운 것 먼저·틀린 문제 다시(열 문제 뒤·다시 풀기·이틀 뒤 확인), 보상·하루 150문제·수학 단계 그대로·한글 칸 그대로·저장·초기화 통과`);
}
console.log(`수학 모드: ${STAGES.length}단계 문제·보기 각 ${N}개, 항목 ${CATS.length}개(+골고루)·문제 시간, 하루 공부 시간(${DAY_MIN_CHOICES.join('·')}분)·항목당 하루 ${CAT_MAX}문제·정답 ${ITEM_EVERY}개마다 꾸미기·${MAT_EVERY}개마다 재료·${SNACK_EVERY}개마다 간식(먹이기)·항목마다 다음 단계,`
  + ` 수학 옷장·집(짓기·가구·마당)·이름이 한글과 따로, 초기화·예전 백업·망가진 칸·예전 기록 옮기기 통과`);
