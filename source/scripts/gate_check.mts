// 공부 먼저 검사 (10-28 사용자 요청: 하루 공부 분량을 채워야 꾸미기·집 짓기 등을 할 수 있고, 분량은 설정에서 시간 또는 학습량으로 정함)
// 혼자 실행: npx tsx scripts/gate_check.mts — npm run check에서는 learning_rules_check.mts 끝에서 불러온다(package.json은 그대로)
// 1) 기본값·저장: 새 저장 칸 없음(settings 안의 선택 칸 gate 하나), 예전 저장 데이터·망가진 값에도 안 깨짐, 백업·두 기기 합치기에서 살아남음
// 2) 판정: 한글(시간·학습량) · 수학·맞춤법(시간·맞힌 문제) · 끄기 · 오늘만 열어 주기 · 어제 기록은 안 셈
// 3) 잠그는 화면: 꾸미기·집 짓기 쪽만, 공부 화면(모험·놀이·문제·맞춤법)과 처음 화면·부모 설정·잠자기는 절대 안 잠김 (App.tsx의 모든 화면을 대조)
// 4) 열린 순간 알아채기(축하) · 체험 모드 건너뛰기 · 말(allLines에 있음)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const g = globalThis as any;
if (!g.localStorage) {
  const memory: Record<string, string> = { 'hangul-device': 'gate-test' };
  g.window = g;
  g.window.setTimeout ??= setTimeout; g.window.clearTimeout ??= clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
const store = await import('../src/engine/store');
const G = await import('../src/lib/gate');
const V = await import('../src/data/voice');
const { LESSONS } = await import('../src/data/curriculum');
const { freshMath } = await import('../src/math/mathData');
const { mergeState } = await import('../shared/merge.js') as any;
const B = await import('../src/engine/backup');

const MIN = 60000;
const day = () => String(store.today());
const dev = store.dev();
const reset = () => { store.replaceAll(store.fresh()); G.resetGateWatch(); G.setGateBypass(false); };
const setUsage = (ms: number) => { store.load().usage[day()] = { [dev]: ms }; };
const setLessons = (n: number) => { store.load().lessonsByDay[day()] = { [dev]: n }; };
const mathOf = () => { const s = store.load(); s.math ??= freshMath() as any; return s.math!; };
const setMathMs = (ms: number) => { mathOf().ms[day()] = { [dev]: ms }; };
const setMathCorrect = (n: number, solved = n) => { mathOf().correct[day()] = { [dev]: n }; mathOf().solved[day()] = { [dev]: solved }; };

// ---------- 1) 기본값·저장 ----------
reset();
const keysBefore = Object.keys(store.fresh()).sort().join(',');
assert.ok(!('gate' in store.fresh().settings), '새 기록의 settings에는 gate 칸이 없음(기본값은 코드에) — 예전 기록과 같은 모양');
assert.deepEqual(G.gateRule('h'), { mode: 'amount', min: 15, n: 1 }, '한글 기본: 오늘의 새 단계를 끝내면 열림');
assert.deepEqual(G.gateRule('m'), { mode: 'time', min: 10, n: 10 }, '수학·맞춤법 기본: 10분 공부하면 열림');
assert.equal(G.GATE_DEFAULT.h.mode, 'amount'); assert.equal(G.GATE_DEFAULT.m.mode, 'time');

// 설정 쓰기는 gate 칸만 바꾸고 다른 설정·새 저장 칸은 건드리지 않음, 나중에 바꾼 쪽 시각(settingsT)을 찍어 연동에 실림
const before = { ...store.load().settings }; const t0 = store.load().settingsT;
await new Promise(r => setTimeout(r, 3));
G.setGate('m', { mode: 'amount', n: 20 });
const after = store.load();
assert.deepEqual({ ...after.settings, gate: undefined }, { ...before, gate: undefined }, 'gate 말고 다른 설정은 그대로');
assert.ok(after.settingsT > t0, '설정 바꾼 시각이 새로 찍힘 → 두 기기 연동에 실림');
assert.deepEqual(G.gateRule('m'), { mode: 'amount', min: 10, n: 20 });
G.setGate('m', { min: 15 });
assert.deepEqual(G.gateRule('m'), { mode: 'amount', min: 15, n: 20 }, '일부만 바꿔도 나머지는 유지');
assert.deepEqual(G.gateRule('h'), { mode: 'amount', min: 15, n: 1 }, '한글 쪽은 영향 없음');
assert.equal(Object.keys(store.load()).filter(k => !keysBefore.split(',').includes(k)).length, 0, '새 저장 칸(State 최상위) 없음');

// 망가진 값이 와도(연동·백업) 기본값으로 — 던지지 않음
for (const bad of ['x', 5, null, [], { h: null, m: 'zz' }, { h: { mode: 'zzz', min: 'a', n: -5 } }, { h: { mode: 'time', min: 99999, n: 1e9 } }, { h: [], m: 3 }]) {
  reset();
  (store.load().settings as any).gate = bad;
  for (const k of ['h', 'm'] as const) {
    const r = G.gateRule(k);
    assert.ok(['off', 'time', 'amount'].includes(r.mode) && r.min >= 1 && r.min <= 180 && r.n >= 1 && r.n <= 500, `이상한 값 ${JSON.stringify(bad)}도 안전한 값으로`);
    assert.doesNotThrow(() => G.gateStatus(k));
  }
}
reset();
(store.load().settings as any).gate = { h: { mode: 'zzz', min: 'a', n: -5 } };
assert.deepEqual(G.gateRule('h'), { mode: 'amount', min: 15, n: 1 }, '알 수 없는 방식·글자·음수는 기본값');

// ---------- 2) 판정 ----------
// 2-1) 한글 학습량 = 오늘의 새 단계 (하루 새 단계와 같은 수)
reset();
let st = G.gateStatus('h');
assert.deepEqual([st.mode, st.open, st.met, st.free, st.unit, st.have, st.need, st.pct], ['amount', false, false, false, 'lesson', 0, 1, 0], '처음엔 잠김: 오늘의 새 단계 0/1');
assert.equal(G.gateProgressText(st), '0/1개'); assert.equal(G.gateLabel(st), '오늘의 모험'); assert.equal(G.gateNeedText(st), '오늘의 모험을 마치면');
store.addLessonToday();
st = G.gateStatus('h');
assert.deepEqual([st.open, st.met, st.have, st.need, st.pct], [true, true, 1, 1, 100], '새 단계 1개를 끝내면 열림');
store.setSettings({ newPerDay: 2 });
st = G.gateStatus('h');
assert.deepEqual([st.open, st.have, st.need, st.pct], [false, 1, 2, 50], '하루 새 단계가 2개면 2개를 끝내야 함(1개 끝냈으면 50%)');
assert.equal(G.gateNeedText(st), '오늘의 모험을 마치면');
store.setSettings({ newPerDay: 3 });
assert.equal(G.gateNeedText(G.gateStatus('h')), '오늘의 모험을 2개 더 마치면');
store.addLessonToday(); store.addLessonToday();
assert.ok(G.gateStatus('h').open, '2개 더 끝내면(3개) 열림');
// 부모가 준 추가 단계는 분량을 늘리지 않고, 열린 문을 다시 잠그지 않음
store.giveExtraLesson();
st = G.gateStatus('h');
assert.ok(st.open && st.need === 3, '부모가 새 단계를 더 줘도 분량·열림은 그대로');
// 모험을 다 끝낸 아이는 더 할 새 단계가 없으니 막지 않음
reset();
store.load().lessonIdx = LESSONS.length;
assert.ok(G.gateStatus('h').open, '모든 모험을 끝냈으면 안 잠김');
reset();
store.load().lessonIdx = LESSONS.length - 1;
assert.ok(!G.gateStatus('h').open, '마지막 단계가 남았으면 잠김');
// 어제 기록은 안 셈
reset();
store.load().lessonsByDay[String(store.today() - 1)] = { [dev]: 5 };
store.load().usage[String(store.today() - 1)] = { [dev]: 300 * MIN };
assert.ok(!G.gateStatus('h').open, '어제 끝낸 단계는 오늘 분량이 아님 → 하루가 지나면 다시 채워야 함');
G.setGate('h', { mode: 'time', min: 10 });
assert.ok(!G.gateStatus('h').open, '어제 쓴 시간도 안 셈');

// 2-2) 한글 시간 = 오늘 앱 사용 시간
reset();
G.setGate('h', { mode: 'time', min: 10 });
setUsage(9 * MIN + 59000);
st = G.gateStatus('h');
assert.deepEqual([st.mode, st.unit, st.open, st.have, st.need], ['time', 'min', false, 9, 10], '9분 59초는 아직');
assert.equal(G.gateNeedText(st), '1분 더 공부하면'); assert.equal(G.gateProgressText(st), '9/10분'); assert.equal(G.gateLabel(st), '오늘 공부');
setUsage(5 * MIN);
assert.equal(G.gateNeedText(G.gateStatus('h')), '5분 더 공부하면'); assert.equal(G.gateStatus('h').pct, 50);
setUsage(10 * MIN);
st = G.gateStatus('h');
assert.deepEqual([st.open, st.met, st.have, st.pct], [true, true, 10, 100], '10분이면 열림');
setUsage(2 * MIN); store.addLessonToday();
assert.ok(!G.gateStatus('h').open, '시간 방식에서는 단계를 끝내도 시간을 채워야 함(방식마다 따로)');
G.setGate('h', { mode: 'amount' });
assert.ok(G.gateStatus('h').open, '방식을 학습량으로 바꾸면 단계 1개로 열림');

// 2-3) 수학·맞춤법 시간 = 문제를 푼 시간 (한글 사용 시간과 섞이지 않음)
reset();
setUsage(60 * MIN); store.addLessonToday();
st = G.gateStatus('m');
assert.deepEqual([st.mode, st.open, st.have, st.need, st.unit], ['time', false, 0, 10, 'min'], '한글을 아무리 해도 수학 문은 안 열림');
setMathMs(9 * MIN + 59000);
assert.ok(!G.gateStatus('m').open);
setMathMs(10 * MIN);
assert.ok(G.gateStatus('m').open, '문제를 10분 풀면 열림');
assert.ok(G.gateStatus('h').open, '(한글은 한글대로 — 단계를 끝냈으니 열려 있음)');
reset();
setMathMs(60 * MIN);
assert.ok(!G.gateStatus('h').open, '수학을 아무리 풀어도 한글 문은 안 열림');

// 2-4) 수학·맞춤법 학습량 = 오늘 맞힌 문제 (푼 문제가 아니라)
reset();
G.setGate('m', { mode: 'amount', n: 10 });
setMathCorrect(3, 50);
st = G.gateStatus('m');
assert.deepEqual([st.mode, st.unit, st.open, st.have, st.need, st.pct], ['amount', 'problem', false, 3, 10, 30], '푼 문제 50개라도 맞힌 것이 3개면 3/10');
assert.equal(G.gateNeedText(st), '문제를 7개 더 맞히면'); assert.equal(G.gateProgressText(st), '3/10개'); assert.equal(G.gateLabel(st), '맞힌 문제');
setMathCorrect(9, 9);
assert.ok(!G.gateStatus('m').open);
setMathCorrect(10, 12);
assert.ok(G.gateStatus('m').open, '10개를 맞히면 열림');
G.setGate('m', { n: 50 });
assert.ok(!G.gateStatus('m').open && G.gateStatus('m').need === 50, '분량을 50개로 올리면 다시 잠김');

// 2-5) 끄기
reset();
G.setGate('h', { mode: 'off' }); G.setGate('m', { mode: 'off' });
for (const k of ['h', 'm'] as const) { st = G.gateStatus(k); assert.deepEqual([st.mode, st.open, st.met, st.pct], ['off', true, true, 100], '끄면 늘 열림'); }
assert.equal(G.gateBlock('house'), null); assert.equal(G.gateBlock('mathCloset'), null); assert.ok(!G.gateLocked('h') && !G.gateLocked('m'));

// 2-6) 오늘만 열어 주기 (한글·수학 따로, 내일은 다시)
reset();
assert.ok(G.gateBlock('house') && G.gateBlock('mathCloset'));
G.openGateToday('h');
st = G.gateStatus('h');
assert.deepEqual([st.open, st.met, st.free], [true, false, true], '부모가 오늘 열어 줌: 열림이지만 분량은 아직');
assert.equal(G.gateBlock('house'), null);
assert.ok(G.gateBlock('mathCloset'), '수학 쪽은 그대로 잠김(따로)');
G.closeGateToday('h');
assert.ok(G.gateBlock('house'), '열어 준 것을 취소하면 다시 잠김');
G.openGateToday('m');
assert.equal(G.gateBlock('mathCloset'), null); assert.ok(G.gateBlock('house'));
// 어제 열어 준 것은 오늘 효과 없음
reset();
(store.load().settings as any).gate = { h: { free: store.today() - 1 }, m: { free: store.today() + 1 } };
assert.ok(G.gateBlock('house') && G.gateBlock('mathCloset'), '어제(또는 미래) 날짜로 열어 준 것은 오늘 안 열림');
// 방식·분량을 바꿔도 열어 준 것은 유지
reset(); G.openGateToday('h'); G.setGate('h', { mode: 'time', min: 45 });
assert.ok(G.gateStatus('h').free && G.gateStatus('h').open, '분량을 바꿔도 오늘 열어 준 것은 그대로');

// ---------- 3) 잠그는 화면 ----------
const HANGUL_DECO = ['book', 'house', 'dress', 'adopt', 'build', 'room', 'park', 'yard'];
const MATH_DECO = ['mathCloset', 'mathBuild', 'mathRoom', 'mathPark', 'mathYard', 'mathFeed'];
const ALWAYS_OPEN = ['title', 'map', 'session', 'parent', 'sleep', 'math', 'mathPlay', 'mathSpell'];
reset();
for (const sc of HANGUL_DECO) { const b = G.gateBlock(sc); assert.ok(b && b.kind === 'h', `${sc}: 한글 분량 전에는 잠김`); }
for (const sc of MATH_DECO) { const b = G.gateBlock(sc); assert.ok(b && b.kind === 'm', `${sc}: 수학 분량 전에는 잠김`); }
for (const sc of ALWAYS_OPEN) assert.equal(G.gateBlock(sc), null, `${sc}(공부·처음·부모·잠자기)는 절대 안 잠김`);
for (const bad of ['', 'constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) assert.equal(G.gateBlock(bad), null, '모르는 화면 이름은 안 잠김: ' + bad);
assert.deepEqual(Object.keys(G.GATE_SCREENS).sort(), [...HANGUL_DECO, ...MATH_DECO].sort(), '잠그는 화면 목록');
assert.deepEqual(G.GATE_HOME, { h: 'map', m: 'math' }, '잠겼을 때 돌아갈 곳은 공부가 있는 화면');
assert.ok(ALWAYS_OPEN.includes(G.GATE_HOME.h) && ALWAYS_OPEN.includes(G.GATE_HOME.m), '돌아갈 곳은 잠그지 않는 화면');
// App.tsx의 모든 화면이 '잠금' 또는 '항상 열림' 중 하나로 분류돼 있어야 함 (새 화면을 더하고 빠뜨리는 일 방지)
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const union = app.slice(app.indexOf('type Screen ='), app.indexOf('const GALLERY'));
const screens = [...union.matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]);
assert.ok(screens.length >= 20, '화면 목록을 읽음: ' + screens.length);
for (const sc of screens) assert.ok(Object.keys(G.GATE_SCREENS).includes(sc) || ALWAYS_OPEN.includes(sc), `화면 ${sc}가 잠금/항상 열림 어느 쪽인지 정해지지 않음 — lib/gate.ts GATE_SCREENS 또는 이 검사의 ALWAYS_OPEN에 넣기`);
// 연결: 화면 이동은 go()를 거치며 잠금 확인, 체험 모드 건너뛰기, 부모 설정을 닫고 돌아갈 때·1초마다 잠긴 곳에서 내보냄
assert.ok(/const go = \(sc: Screen\) => \{\s*const g = gateBlock\(sc\);/.test(app), 'go()가 잠금을 확인');
assert.ok(app.includes('setGateBypass(demo || TEST_NAV)'), '체험 모드·시험용 주소는 잠그지 않음');
assert.ok(app.includes('go(leave('), '부모 설정을 닫고 돌아갈 곳이 잠겼으면 지도·수학 첫 화면으로');
assert.ok(app.includes('gateWatch()') && app.includes('GATE_HOME[g.kind]'), '1초마다 열림·닫힘을 지켜보고 잠긴 곳에 있으면 내보냄');
const mapSrc = readFileSync(new URL('../src/screens/MapScreen.tsx', import.meta.url), 'utf8');
assert.ok(mapSrc.includes("gateLocked('h')") && mapSrc.includes('<GatePill kind="h"') && mapSrc.includes("takeGateOpened('h')"), '지도: 🔒 표시·진행 막대·열림 축하');
const mathHomeSrc = readFileSync(new URL('../src/screens/MathHome.tsx', import.meta.url), 'utf8');
assert.ok(mathHomeSrc.includes("gateLocked('m')") && mathHomeSrc.includes('<GatePill kind="m"') && mathHomeSrc.includes("takeGateOpened('m')"), '수학 첫 화면: 🔒 표시·진행 막대·열림 축하');
const parentSrc = readFileSync(new URL('../src/screens/Extras.tsx', import.meta.url), 'utf8');
assert.ok(parentSrc.includes('<GateParent onSaved={done} />'), '부모 설정에 공부 먼저 칸');

// ---------- 4) 연동·백업에서 살아남기 ----------
reset();
G.setGate('h', { mode: 'time', min: 20 }); G.setGate('m', { mode: 'amount', n: 30 }); G.openGateToday('m');
const saved = JSON.parse(JSON.stringify(store.load()));
assert.ok(B.isBackupPayload(saved) && B.isSyncPayload(saved), '백업·연동 검사를 통과');
const code = store.exportCode();
reset();
assert.deepEqual(G.gateRule('h'), { mode: 'amount', min: 15, n: 1 });
assert.equal(store.importCode(code), true);
assert.deepEqual(G.gateRule('h'), { mode: 'time', min: 20, n: 1 }, '백업 코드로 옮겨도 분량 설정이 따라옴');
assert.deepEqual(G.gateRule('m'), { mode: 'amount', min: 10, n: 30 });
assert.ok(G.gateStatus('m').free, '오늘 열어 준 것도 따라옴');
// 예전 기록(gate 칸이 없는 설정)을 불러와도 기본값
const old = JSON.parse(JSON.stringify(saved)); delete old.settings.gate;
assert.equal(store.importCode(btoa(unescape(encodeURIComponent(JSON.stringify(old))))), true);
assert.deepEqual(G.gateRule('h'), { mode: 'amount', min: 15, n: 1 }, 'gate 칸이 없는 예전 기록은 기본값');
// 두 기기 합치기: 설정은 나중에 바꾼 쪽이 통째로 이김 (순서와 상관없이)
const A = JSON.parse(JSON.stringify(store.fresh())), Bst = JSON.parse(JSON.stringify(store.fresh()));
A.settings.gate = { h: { mode: 'time', min: 30 } }; A.settingsT = 200;
Bst.settings = { ...Bst.settings, dailyMin: 45 }; Bst.settingsT = 100;
for (const [x, y] of [[A, Bst], [Bst, A]]) {
  const merged = mergeState(x, y);
  assert.deepEqual(merged.settings.gate, { h: { mode: 'time', min: 30 } }, '더 나중에 바꾼 기기의 분량 설정이 이김');
  assert.equal(merged.settingsT, 200);
}
Bst.settingsT = 300;
for (const [x, y] of [[A, Bst], [Bst, A]]) {
  const merged = mergeState(x, y);
  assert.equal(merged.settings.gate, undefined, '반대로 gate가 없는 쪽이 더 나중이면 그쪽 설정(= 기본값)');
  assert.equal(merged.settings.dailyMin, 45);
}

// ---------- 5) 열린 순간 알아채기(축하) · 체험 모드 ----------
reset();
assert.equal(G.gateWatch(), false, '처음 지켜볼 때는 바뀐 것이 없음'); assert.ok(!G.peekGateOpened('h') && !G.peekGateOpened('m'));
store.addLessonToday();                                  // 지켜보는 중에 분량을 채움
assert.equal(G.gateWatch(), true, '열림이 바뀌면 true(화면을 다시 그리라는 뜻)');
assert.ok(G.peekGateOpened('h'), '축하할 것이 있음'); assert.ok(G.peekGateOpened('h'), 'peek은 지우지 않음');
assert.ok(!G.peekGateOpened('m'), '수학은 아님');
assert.ok(G.takeGateOpened('h'), '가져가면'); assert.ok(!G.takeGateOpened('h'), '한 번만');
assert.equal(G.gateWatch(), false, '바뀐 것 없으면 false');
// 앱을 켰을 때 이미 열려 있던 것은 축하하지 않음
G.resetGateWatch();
assert.equal(G.gateWatch(), false); assert.ok(!G.peekGateOpened('h'), '이미 열려 있던 것은 축하 X');
// 부모가 끄거나 방식을 바꾼 것·오늘 열어 준 것은 축하하지 않음
reset(); G.gateWatch(); G.setGate('h', { mode: 'off' });
assert.equal(G.gateWatch(), true, '열림은 바뀜(화면 다시 그림)'); assert.ok(!G.peekGateOpened('h'), '부모가 끈 것은 축하 X');
reset(); G.gateWatch(); G.openGateToday('h');
assert.equal(G.gateWatch(), true); assert.ok(!G.peekGateOpened('h'), '오늘 열어 준 것은 축하 X');
store.addLessonToday(); G.gateWatch();
assert.ok(!G.peekGateOpened('h'), '열어 준 뒤에 분량이 차도 축하 X (이미 열려 있었음)');
reset(); G.gateWatch(); G.setGate('h', { mode: 'time', min: 10 }); G.gateWatch(); setUsage(11 * MIN);
assert.equal(G.gateWatch(), true); assert.ok(G.takeGateOpened('h'), '방식을 바꾼 뒤 지켜보던 중에 채우면 축하');
// 다시 잠기고(분량을 올림) 또 채우면 또 축하
G.setGate('h', { min: 20 }); assert.equal(G.gateWatch(), true); assert.ok(!G.gateStatus('h').open);
setUsage(21 * MIN); G.gateWatch(); assert.ok(G.takeGateOpened('h'));
// 체험 모드·시험용 주소: 안 잠그고 축하도 없음
reset(); G.gateWatch(); G.setGateBypass(true);
assert.equal(G.gateBlock('house'), null); assert.equal(G.gateBlock('mathCloset'), null); assert.ok(!G.gateLocked('h') && !G.gateLocked('m'), '체험 모드는 안 잠김');
store.addLessonToday(); G.gateWatch();
assert.ok(!G.takeGateOpened('h'), '체험 모드에서는 축하 X');
G.setGateBypass(false);
assert.ok(!G.gateBlock('house'), '(한글은 단계를 끝냈으니 열려 있음)'); assert.ok(G.gateBlock('mathCloset'), '체험 모드를 끄면 다시 잠금');

// ---------- 6) 말 ----------
const all = new Set(V.allLines('친구'));
for (const l of V.gateLines()) {
  assert.ok(all.has(l), 'allLines에 있음: ' + l);
  assert.ok(!/undefined|NaN|null/.test(l) && l.trim() === l && l.length > 6, '말이 비거나 깨지지 않음: ' + l);
}
assert.deepEqual(V.gateLines(), [V.GATE_LOCKED, V.GATE_OPENED, V.GATE_HINT, V.GATE_SNACK_WAIT]);
assert.ok(V.GATE_LOCKED.length <= 24 && V.GATE_OPENED.length <= 24, '아이에게 하는 짧은 말');

reset();
console.log(`공부 먼저: 기본값·저장(새 칸 없음)·망가진 값 8종 · 한글(학습량·시간)/수학(시간·맞힌 문제)/끄기/오늘 열어 주기 판정 · 잠그는 화면 ${Object.keys(G.GATE_SCREENS).length}개(공부·처음·부모·잠자기는 안 잠금, App 화면 ${screens.length}개 모두 분류) · 백업·두 기기 합치기 · 열린 순간 축하·체험 모드 · 말 ${V.gateLines().length}개 통과`);
