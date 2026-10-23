// 수학 모드(초등 2학년 언니, 10-23) 검사: 문제·보기가 맞는지, 하루 50문제·정답 10개마다 꾸미기·90%면 다음 단계,
// 한글 진도·옷장과 따로인지(한글 초기화·예전 백업 불러오기에도 수학 기록 유지), 망가진 수학 칸이 한글 진도를 막지 않는지
import assert from 'node:assert/strict';
const memory: Record<string, string> = { 'hangul-device': 'math-test' };
const g = globalThis as any;
g.window = g;
g.window.setTimeout = setTimeout; g.window.clearTimeout = clearTimeout;
g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
const { STAGES, makeProblem, normalizeMath, freshMath, PER_DAY, ITEM_EVERY } = await import('../src/math/mathData');
const store = await import('../src/engine/store');
const ms = await import('../src/math/mathStore');
const { ITEM } = await import('../src/data/pets');

// ---------- 1) 문제와 보기 ----------
const ones = (n: number) => n % 10, tens = (n: number) => Math.floor(n / 10) % 10;
const carry = (a: number, b: number) => { for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) + ones(y) >= 10) return true; return false; };
const borrow = (a: number, b: number) => { for (let x = a, y = b; y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (ones(x) < ones(y)) return true; return false; };
const digits = (n: number) => String(n).length;
const N = 3000;
for (let st = 0; st < STAGES.length; st++) {
  for (let k = 0; k < N; k++) {
    const p = makeProblem(st, 0);
    assert.equal(p.stage, st);
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
// 앞 단계 복습은 다섯 문제 중 하나쯤
{
  const n = 4000;
  let rev = 0;
  for (let k = 0; k < n; k++) { const p = makeProblem(5); assert.ok(p.stage <= 5); if (p.stage < 5) rev++; }
  assert.ok(rev > n * 0.12 && rev < n * 0.28, '복습 비율 ' + rev / n);
  for (let k = 0; k < 300; k++) assert.equal(makeProblem(0).stage, 0, '첫 단계는 복습 없음');
}
void tens; void digits;

// ---------- 2) 하루 50문제 · 정답 10개마다 꾸미기 · 90%면 다음 단계 ----------
store.replaceAll(store.fresh());
const before = JSON.stringify({ ...store.load(), epoch: 0, math: undefined });
assert.equal(ms.mathState().level, 0);
assert.equal(store.load().math, undefined, '수학을 하기 전에는 수학 칸 없음 (예전과 같은 저장 모양)');
let items: string[] = [], fin = 0, ups = 0;
for (let k = 1; k <= PER_DAY; k++) {
  const ok = k % 12 !== 0;                       // 50문제 중 46개 정답 (92%)
  const r = ms.answerMath(ok);
  if (r.item) items.push(r.item);
  if (r.finished) { fin++; assert.equal(k, PER_DAY, '50번째에 오늘 끝'); }
  if (r.leveledUp) ups++;
}
const m1 = ms.mathState();
assert.equal(ms.todayMath().solved, PER_DAY);
assert.equal(ms.todayMath().correct, 46);
assert.equal(items.length, Math.floor(46 / ITEM_EVERY), '정답 10개마다 하나');
assert.equal(new Set(items).size, items.length, '같은 꾸미기 두 번 X');
assert.ok(items.every(id => ITEM[id]), '있는 꾸미기만');
assert.deepEqual(m1.owned, [...items].sort(), '언니 옷장에만 들어감');
assert.ok(fin === 1 && ups === 1 && m1.level === 1, '90% 이상이면 다음 단계');
assert.deepEqual(store.load().owned, [], '동생 옷장은 그대로');
assert.equal(JSON.stringify({ ...store.load(), epoch: 0, math: undefined }), before, '한글 진도·보상·시간 칸은 하나도 안 바뀜');
// 오늘 다 풀었으면 더 안 늘어남(화면이 막음) — 90% 미만이면 단계 그대로
store.load().math!.solved = {}; store.load().math!.correct = {};
for (let k = 1; k <= PER_DAY; k++) ms.answerMath(k % 5 !== 0);   // 40개 (80%)
assert.equal(ms.mathState().level, 1, '90% 미만이면 단계 그대로');
// 부모 설정
ms.setMathLevel(99); assert.equal(ms.mathState().level, STAGES.length - 1);
ms.setMathLevel(3); assert.equal(ms.mathState().level, 3);
ms.setMathPerDay(30); assert.equal(ms.mathState().perDay, 30);
// 옷장: 입히기·벗기기 (언니 것만)
const it0 = ms.mathState().owned[0];
const [slot, key] = it0.split(':') as any;
ms.toggleMathWear('maltese', slot, key);
assert.equal((ms.mathWear('maltese') as any)[slot], key);
assert.deepEqual(store.load().wear, {}, '동생 꾸미기는 그대로');
ms.toggleMathWear('maltese', slot, key);
assert.equal((ms.mathWear('maltese') as any)[slot], undefined);
ms.setMathPet('koshort'); assert.equal(ms.mathPet(), 'koshort');

// ---------- 3) 한글 초기화·예전 백업·망가진 칸 ----------
const keep = JSON.stringify(store.load().math);
store.reset();
assert.equal(JSON.stringify(store.load().math), keep, '전체 초기화에도 수학 기록 유지');
store.resetProgress();
assert.equal(JSON.stringify(store.load().math), keep, '진도 초기화에도 수학 기록 유지');
const old = store.fresh(); delete (old as any).math;
const code = btoa(unescape(encodeURIComponent(JSON.stringify({ ...old, name: '예전' }))));
assert.ok(store.importCode(code));
assert.equal(store.load().name, '예전');
assert.equal(JSON.stringify(store.load().math), keep, '수학이 없는 예전 백업을 불러와도 수학 기록 유지');
assert.equal(normalizeMath(null), undefined);
assert.equal(normalizeMath([1, 2]), undefined);
const bad = normalizeMath({ level: 'x', perDay: 9999, solved: { abc: 1, '20700': { d: -3, e: 4 } }, owned: ['hat:nope', 'hat:crown', 'hat:crown', 7], wear: { nobody: { hat: 'crown' }, maltese: { hat: 'nope', glasses: 'sun' } } })!;
assert.equal(bad.level, 0); assert.equal(bad.perDay, freshMath().perDay);
assert.deepEqual(bad.solved, { '20700': { e: 4 } });
assert.deepEqual(bad.owned, ['hat:crown']);
assert.deepEqual(bad.wear, { maltese: { glasses: 'sun' } });
// 수학 칸이 망가진 연동 상태도 한글 진도는 받아들인다
const remote: any = JSON.parse(JSON.stringify(store.load()));
remote.lessonIdx = 4; remote.math = 'broken';
assert.ok(store.absorb(remote), '수학 칸이 이상해도 한글 연동은 됨');
assert.equal(store.load().lessonIdx, 4);
assert.equal(JSON.stringify(store.load().math), keep, '이상한 수학 칸은 무시하고 내 기록 유지');
store.flushSave();
console.log(`수학 모드: ${STAGES.length}단계 문제·보기 각 ${N}개, 하루 ${PER_DAY}문제·정답 ${ITEM_EVERY}개마다 꾸미기·90%면 다음 단계, 한글과 따로(초기화·예전 백업·망가진 칸) 통과`);
