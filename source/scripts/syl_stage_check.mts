// 글자 합치기 검사 (11-12 사용자 요청: 낱말 공부 전에 가, 나, 다 … 튜, 퓨, 휴까지 자음+모음 글자를 읽으면서 쓰는 단계)
// 혼자 실행: npx tsx scripts/syl_stage_check.mts — npm run check에서는 learning_rules_check.mts 끝에서 불러온다(package.json은 그대로)
// 1) 글자: 140개·사용자가 말한 순서·글꼴·녹음·그 앞 단계까지 배운 자모로만
// 2) 모험: 줄마다 14글자를 차례로 한 번씩 쓰기(부모 설정 횟수), 합치기·읽기 놀이·찾기·받아쓰기, 연습한 글자만 나옴
// 3) 진도: 새 저장 칸 없음 · 한글 단계 번호 그대로 · 낱말 단계 앞에서만 · 줄 통과 → 다음 줄 → 끝나면 낱말 단계
// 4) 규칙: 다음날 복습 시험(떨어지면 그 줄 다시, hold는 안 씀) · 기존 단계 복습 규칙 그대로
// 5) 두 기기 합치기 · 백업·연동 검사 · 아직 업데이트 안 된 기기와 섞여도 안전 · 진도 초기화 · 부모가 줄 고르기
// 6) 공부 먼저(오늘의 새 단계)·쓰기 횟수 설정·말
import assert from 'node:assert/strict';
import fs from 'node:fs';
const g = globalThis as any;
if (!g.localStorage) {
  const memory: Record<string, string> = { 'hangul-device': 'syl-test' };
  g.window = g;
  g.window.setTimeout ??= setTimeout; g.window.clearTimeout ??= clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
// 실제 음성팩 문장 목록
const VD = process.env.VOICE_DIR || '..';
const clips = new Set<string>();
for (const f of JSON.parse(fs.readFileSync(VD + '/voice-manifest.json', 'utf8')).files) Object.keys(JSON.parse(fs.readFileSync(VD + '/' + f.u, 'utf8')).voices).forEach(k => clips.add(k));

const store = await import('../src/engine/store');
const D = await import('../src/data/syllables');
const P = await import('../src/lib/sylStage');
const B = await import('../src/engine/sylLesson');
const S = await import('../src/engine/session');
const C = await import('../src/lib/studyCfg');
const V = await import('../src/data/voice');
const G = await import('../src/lib/gate');
const K = await import('../src/engine/backup');
const { LESSONS, knownAfter } = await import('../src/data/curriculum');
const { FONT_SYLLABLES } = await import('../src/data/fontchars');
const { decompose } = await import('../src/lib/hangul');
const { mergeState } = await import('../shared/merge.js') as any;

const keep = JSON.parse(JSON.stringify(store.load()));
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const ROWS = D.SYL_ROW_COUNT;
/** 새 기록을 단계 idx에 놓기 */
const at = (idx: number) => { const f = store.fresh(); f.lessonIdx = idx; store.replaceAll(f); };

// ---------- 1) 글자 ----------
assert.equal(D.SYL_ROWS.length, 10, '모음 10줄');
assert.ok(D.SYL_ROWS.every(r => r.length === 14), '줄마다 자음 14글자');
assert.equal(new Set(D.SYL_ALL).size, 140, '140글자 모두 다름');
// 사용자가 말한 순서 그대로: 가 나 다 라 마 바 사 아 자 차 카 타 파 하 / 거 너 더 러 … / … 튜 퓨 휴
assert.equal(D.SYL_ROWS[0].join(''), '가나다라마바사아자차카타파하');
assert.equal(D.SYL_ROWS[1].join(''), '거너더러머버서어저처커터퍼허');
assert.equal(D.SYL_ROWS[9].join(''), '규뉴듀류뮤뷰슈유쥬츄큐튜퓨휴');
assert.equal(D.SYL_ALL.slice(0, 18).join(''), '가나다라마바사아자차카타파하거너더러');
assert.equal(D.SYL_ALL.slice(-3).join(''), '튜퓨휴');
assert.equal(D.SYL_ROWS.map(r => r[0]).join(''), '가거고구그기갸겨교규', '줄 순서 = 모음을 배우는 순서');
assert.equal(D.SYL_GATE, 7, '첫 낱말 단계(8번째) 앞');
assert.equal(LESSONS[D.SYL_GATE].kind, 'words');
assert.ok(LESSONS.slice(0, D.SYL_GATE).every(l => l.kind === 'letters'), '그 앞은 모두 글자 단계');
const kGate = knownAfter(D.SYL_GATE - 1);
for (const s of D.SYL_ALL) {
  const p = decompose(s)!;
  assert.ok(p && !p.jong && kGate.jamo.has(p.cho) && kGate.jamo.has(p.jung), `${s}: 그 앞 단계까지 배운 자음·모음으로만`);
  assert.ok(FONT_SYLLABLES.has(s), `${s}: 앱 글꼴에 있음`);
  assert.ok(clips.has(s), `${s}: 녹음된 소리 있음`);
  assert.equal(D.SYL_ROWS[D.sylRowOf(s)].includes(s), true);
}
assert.equal(D.sylRowOf('강'), -1); assert.equal(D.sylRowOf('ㄱ'), -1);
assert.ok(D.isSylIdx(D.sylIdx(0)) && D.isSylIdx(D.sylIdx(9)) && !D.isSylIdx(D.sylIdx(10)) && !D.isSylIdx(LESSONS.length), '모험 번호는 진도표 번호와 안 겹침');
assert.ok(D.SYL_BASE > LESSONS.length + 100);

// ---------- 2) 모험 ----------
store.replaceAll(store.fresh());
assert.equal(C.sylReps(), 5, '기본: 글자마다 5번');
const textsOf = (st: any): string[] => {
  const o: string[] = [];
  const add = (...x: any[]) => x.flat(3).forEach(v => { if (typeof v === 'string' && v) o.push(v); });
  switch (st.t) {
    case 'traceSet': case 'sylread': add(st.items); break;
    case 'sylfind': case 'dictation': add(st.items, st.order); break;
    case 'bubble': case 'mole': add(st.targets, st.pool, st.order ?? []); break;
    case 'cards': case 'feed': case 'hop': st.rounds.forEach((r: any) => add(r.answer, r.options)); break;
    case 'memory': st.cards.forEach((c: any) => add(c.id, c.say, c.kind === 'text' ? c.face : '')); break;
    case 'blend': st.rounds.forEach((r: any) => add(r.cho, r.jung, r.choOpts, r.jungOpts)); break;
    case 'greet': case 'reward': break;
    default: assert.fail(`글자 합치기에 없는 단계: ${st.t}`);
  }
  return o;
};
let stepsN = 0;
const gamesSeen = new Set<string>();
for (let rep = 0; rep < 60; rep++) for (let r = 0; r < ROWS; r++) {
  const row = D.SYL_ROWS[r];
  const steps = B.buildSylLesson(r) as any[];
  stepsN += steps.length;
  assert.equal(steps[0].t, 'greet'); assert.equal(steps.at(-1).t, 'reward');
  assert.deepEqual(steps[1], { t: 'sylread', items: row }, '처음에 그 줄을 읽기');
  // 쓰기: 14글자를 순서대로 한 번씩(글자마다 설정한 횟수), 안내 → 흐린 선 → 혼자(TraceSet 기본)
  const tr = steps.filter(s => s.t === 'traceSet');
  assert.deepEqual(tr.map(s => s.items.join('')), row, `${r + 1}줄: 14글자를 차례로 쓰기`);
  assert.ok(tr.every(s => s.reps === 5 && !s.guides && s.parts == null));
  // 세 글자씩: 합치기 → 쓰기 → 놀이
  const groups = B.sylGroups(row);
  assert.deepEqual(groups.map(x => x.length), [3, 3, 3, 3, 2]);
  let i = 2;
  const practiced = new Set(D.SYL_ROWS.slice(0, r).flat());
  groups.forEach((grp, gi) => {
    const bl = steps[i++];
    assert.equal(bl.t, 'blend', '묶음 처음은 합치기');
    assert.deepEqual(bl.rounds.map((x: any) => x.cho + x.jung), grp.map(s => { const p = decompose(s)!; return p.cho + p.jung; }));
    bl.rounds.forEach((x: any, k: number) => {
      assert.equal(!!x.demo, gi === 0 && k === 0, '그날 첫 글자만 시범');
      assert.ok(x.choOpts.includes(x.cho) && x.jungOpts.includes(x.jung) && !x.jong && new Set(x.choOpts).size === 3 && new Set(x.jungOpts).size === 3);
      assert.ok([...x.choOpts, ...x.jungOpts].every((j: string) => kGate.jamo.has(j)), '합치기 보기도 배운 자모만');
    });
    for (const sy of grp) { assert.deepEqual(steps[i].items, [sy]); assert.equal(steps[i++].t, 'traceSet'); practiced.add(sy); }
    const gm = steps[i++];
    assert.ok(['cards', 'memory', 'hop', 'feed', 'mole', 'bubble'].includes(gm.t), `쓰기 뒤 읽기 놀이: ${gm.t}`);
    gamesSeen.add(gm.t);
    // 놀이에는 지금까지 연습한 글자만 (앞 줄 + 오늘 이미 쓴 글자)
    for (const x of textsOf(gm)) assert.ok(practiced.has(x) || (gm.t === 'hop' && x === gm.friend), `${r + 1}줄 ${gm.t}: 아직 연습 안 한 글자 ${x}`);
    if (gm.t === 'hop') assert.ok(kGate.jamo.has(gm.friend));
    if (gm.t === 'cards' || gm.t === 'hop' || gm.t === 'feed') {
      assert.equal(gm.rounds.length, 5);
      for (const q of gm.rounds) { assert.ok(q.options.includes(q.answer) && new Set(q.options).size === q.options.length && q.options.length >= 2, '보기에 정답·겹침 없음'); assert.equal(q.id, 'x:' + q.answer); }
      assert.ok(grp.every(sy => gm.rounds.some((q: any) => q.answer === sy)), '방금 쓴 글자는 모두 문제로');
      assert.ok(gm.rounds.every((q: any, k: number) => k === 0 || q.answer !== gm.rounds[k - 1].answer), '같은 문제 연달아 X');
    }
    if (gm.t === 'memory') { const ids = new Set(gm.cards.map((c: any) => c.id)); assert.ok(ids.size >= 3 && gm.cards.length === ids.size * 2 && grp.every(sy => ids.has(sy))); }
    if (gm.t === 'mole' || gm.t === 'bubble') { assert.ok(gm.order.length === 5 && gm.order.every((x: string) => gm.targets.includes(x)) && new Set([...gm.pool, ...gm.targets]).size >= 2 && grp.every(sy => gm.targets.includes(sy))); }
    assert.ok(S.playable(gm), '놀이가 제대로 됨');
  });
  const find = steps[i++], test = steps[i++];
  assert.equal(find.t, 'sylfind'); assert.deepEqual(find.items, row);
  assert.ok(find.order.length === B.SYL_FIND_ITEMS && new Set(find.order).size === find.order.length && find.order.every((x: string) => row.includes(x)));
  assert.ok(test.t === 'dictation' && test.mode === 'lesson', '끝에 받아쓰기 시험');
  assert.ok(test.items.length === B.SYL_TEST_ITEMS && test.items.every((x: string) => row.includes(x)) && test.order.length === 10, '그 줄에서 5글자 × 2번');
  assert.equal(i, steps.length - 1);
  // 전체: 그 줄까지의 글자와 배운 자모만
  const upTo = new Set(D.SYL_ROWS.slice(0, r + 1).flat());
  for (const st of steps) for (const x of textsOf(st)) assert.ok(upTo.has(x) || kGate.jamo.has(x), `${r + 1}줄 ${st.t}: ${x}`);
  assert.ok(steps.every(st => S.stepFits(st, kGate)), '배운 글자만(이어하기 검사와 같은 기준)');
}
assert.equal(gamesSeen.size, 6, '읽기 놀이 여섯 가지가 돌아가며');
// 쓰기 횟수 설정 1~15, 이어 하기 때 안 한 쓰기만 지금 설정으로
for (const n of [1, 3, 10, 15]) {
  C.setStudy({ sr: n });
  assert.ok((B.buildSylLesson(2) as any[]).filter(s => s.t === 'traceSet').every(s => s.reps === n), `글자마다 ${n}번`);
}
C.setStudy({ sr: 99 }); assert.equal(C.sylReps(), 5, '범위 밖은 기본값');
C.setStudy({ sr: 10 });
{
  const saved = B.buildSylLesson(0);
  C.setStudy({ sr: 3 });
  const from = saved.findIndex((s, k) => s.t === 'traceSet' && k > 6);
  const out = B.applySylSettings(saved, from) as any[];
  assert.deepEqual(out.slice(0, from), saved.slice(0, from), '이어 할 자리 앞은 그대로');
  assert.ok(out.slice(from).filter(s => s.t === 'traceSet').every(s => s.reps === 3) && out.length === saved.length);
  assert.ok((saved as any[]).slice(0, from).filter(s => s.t === 'traceSet').every(s => s.reps === 10));
  C.setStudy({ sr: 10 }); assert.deepEqual(B.applySylSettings(saved, 0), saved, '설정이 그대로면 그대로');
}
// 받아쓰기 횟수 설정을 따른다
C.setStudy({ sr: 5, dr: 1 });
assert.equal((B.buildSylLesson(4).find(s => s.t === 'dictation') as any).order.length, 5, '글자마다 1번이면 5문제');

// ---------- 3) 진도 ----------
const stateKeys = (s: any) => Object.keys(s).filter(k => k !== 'math').sort().join(',');
for (let idx = 0; idx < D.SYL_GATE; idx++) { at(idx); assert.ok(!P.sylActive(), `${idx + 1}단계(글자 단계)에서는 아직`); assert.equal(P.curTask(), idx); }
at(D.SYL_GATE);
assert.ok(P.sylActive(), '글자를 다 배우면(첫 낱말 단계) 글자 합치기 차례');
assert.equal(P.sylNext(), 0); assert.equal(P.curTask(), D.sylIdx(0)); assert.equal(P.sylDoneCount(), 0);
for (const idx of [9, 15, LESSONS.length - 1, LESSONS.length]) { at(idx); assert.ok(P.sylActive(), `이미 ${idx + 1}단계에 있어도 글자 합치기부터`); assert.equal(store.curLesson(), idx); }
at(8);
const day0 = store.today();
for (let r = 0; r < ROWS; r++) {
  assert.equal(P.sylNext(), r); assert.equal(P.curTask(), D.sylIdx(r));
  const items = D.SYL_ROWS[r].slice(0, 5);
  P.passSylRow(r, items); store.addLessonToday();
  assert.ok(P.sylRowDone(r)); assert.equal(P.sylDoneCount(), r + 1);
  assert.equal(store.load().lessonIdx, 8, '한글 단계 번호는 그대로');
  assert.equal(store.load().hold, null, 'hold를 쓰지 않음');
  assert.deepEqual(store.load().lastPass, { lesson: D.sylIdx(r), day: day0, items });
  assert.equal(P.sylPassRow(), r);
}
assert.ok(!P.sylActive() && P.sylNext() === -1, '열 줄을 다 통과하면 끝');
assert.equal(P.curTask(), 8, '끝나면 하던 낱말 단계로');
assert.equal(store.todayLessons(), ROWS, '줄 하나 = 오늘의 새 단계 하나');
assert.equal(stateKeys(store.load()), stateKeys(store.fresh()), 'State 칸은 그대로(새 칸 없음)');
assert.deepEqual(Object.keys(store.load().items).sort(), D.SYL_VOWELS.map(v => 'sy:' + v).sort(), "기록은 items의 'sy:모음' 열쇠에만");
assert.ok(K.isBackupPayload(copy(store.load())) && K.isSyncPayload(copy(store.load())), '백업·연동 검사 통과');
{
  const code = store.exportCode();
  at(8); assert.ok(P.sylActive());
  assert.ok(store.importCode(code), '백업 코드로 불러오기');
  assert.ok(!P.sylActive() && P.sylDoneCount() === ROWS, '백업에서 살아남음');
}

// ---------- 4) 복습 시험 규칙 ----------
at(D.SYL_GATE);
P.passSylRow(0, ['가', '다', '사']);
assert.equal(P.reviewKind(), null, '통과한 날에는 복습 시험 없음');
assert.equal(store.reviewDue(), false, '기존 단계 복습 판정은 글자 합치기 통과를 모름(1000번대)');
store.load().lastPass!.day = store.today() - 1;
assert.equal(P.reviewKind(), 'syl', '다음날 다음 줄을 시작하기 전에 복습 시험');
assert.equal(store.reviewDue(), false, '기존 판정은 그대로 false → hold가 생기지 않음');
store.passReview();
assert.equal(P.reviewKind(), null, '통과하면 그날은 다시 안 봄');
store.load().reviewDay = -1;
P.failSylReview();
assert.ok(!P.sylRowDone(0) && P.sylNext() === 0 && P.sylActive(), '복습 시험에 떨어지면 그 줄을 다시');
assert.ok(P.sylRedo(), '다시 공부하는 중');
assert.equal(store.load().hold, null, 'hold는 안 씀(한글 단계는 그대로)');
assert.equal(store.load().lessonIdx, D.SYL_GATE);
assert.equal(P.reviewKind(), null, '다시 공부하는 동안 복습 시험이 되풀이되지 않음');
P.passSylRow(0, ['나', '라', '마']);
assert.ok(P.sylRowDone(0) && P.sylNext() === 1 && !P.sylRedo(), '다시 통과하면 다음 줄');
assert.equal(store.load().items['sy:ㅏ'].seen, 3, '통과·다시·통과 = 3번 바뀜');
// 마지막 줄을 통과한 다음 날: 낱말 단계를 시작하기 전에 복습, 떨어지면 마지막 줄을 다시
P.setSylNext(ROWS - 1);
assert.equal(P.sylNext(), ROWS - 1);
P.passSylRow(ROWS - 1, ['규', '휴']);
assert.ok(!P.sylActive());
store.load().lastPass!.day = store.today() - 1;
assert.equal(P.reviewKind(), 'syl');
P.failSylReview();
assert.ok(P.sylActive() && P.sylNext() === ROWS - 1 && store.curLesson() === D.SYL_GATE);
P.passSylRow(ROWS - 1, ['규', '휴']);
// 그 뒤 낱말 단계를 통과하면 기존 규칙 그대로
store.passLesson(D.SYL_GATE, ['아', '기']);
assert.equal(P.sylPassRow(), -1);
store.load().lastPass!.day = store.today() - 1;
assert.equal(P.reviewKind(), 'lesson', '낱말 단계 복습은 기존 규칙');
store.failReview();
assert.deepEqual(store.load().hold, { lesson: D.SYL_GATE });
// 글자 단계(마지막 글자 단계)를 통과한 다음 날: 그 단계 복습이 먼저, 떨어지면 그 단계부터(글자 합치기는 그 뒤)
at(D.SYL_GATE - 1);
store.passLesson(D.SYL_GATE - 1, ['ㅍ', 'ㅎ']);
assert.ok(P.sylActive());
store.load().lastPass!.day = store.today() - 1;
assert.equal(P.reviewKind(), 'lesson');
store.failReview();
assert.ok(!P.sylActive() && P.curTask() === D.SYL_GATE - 1, '글자 단계를 다시 공부하는 동안은 글자 합치기 차례가 아님');
store.passLesson(D.SYL_GATE - 1, ['ㅍ', 'ㅎ']);
assert.ok(P.sylActive() && P.curTask() === D.sylIdx(0));

// ---------- 5) 두 기기 · 구버전 기기 · 초기화 · 부모가 줄 고르기 ----------
at(D.SYL_GATE);
const base = copy(store.load());
P.passSylRow(0, ['가']); P.passSylRow(1, ['거']);
const tablet = copy(store.load());                 // 태블릿: 1·2줄 통과
store.replaceAll(copy(base)); store.load().epoch = base.epoch;
const phone = copy(store.load()); phone.epoch = tablet.epoch = base.epoch;
phone.stars = { p: 3 };                            // 폰: 아직 아무 줄도 안 함 (업데이트 전 기기와 같음)
const m1 = mergeState(copy(tablet), copy(phone)), m2 = mergeState(copy(phone), copy(tablet));
assert.deepEqual(m1, m2, '합치는 순서와 무관');
assert.ok(P.sylRowDone(0, m1) && P.sylRowDone(1, m1) && P.sylNext(m1) === 2, '다른 기기에서 통과한 줄이 합쳐짐');
assert.deepEqual(mergeState(copy(m1), copy(tablet)), m1, '여러 번 합쳐도 같음');
// 한쪽에서 복습에 떨어져 줄을 다시 하게 되면(나중 기록) 그쪽을 따름
store.replaceAll(copy(tablet)); store.load().epoch = base.epoch;
store.load().lastPass!.day = store.today() - 1;
P.failSylReview();
const redo = copy(store.load()); redo.epoch = base.epoch;
const m3 = mergeState(copy(redo), copy(tablet));
assert.deepEqual(m3, mergeState(copy(tablet), copy(redo)));
assert.ok(!P.sylRowDone(1, m3) && P.sylRowDone(0, m3) && P.sylNext(m3) === 1, '다시 공부 표시(나중 기록)가 이김');
// 아직 업데이트 안 된 기기가 읽어도 안전한 모양: 단계 번호·hold·이어하기
for (const s of [tablet, redo, m1, m3]) {
  assert.ok(K.isSyncPayload(copy(s)), '연동 검사 통과');
  assert.equal(s.lessonIdx, D.SYL_GATE); assert.equal(s.hold, null);
  assert.ok(Number.isInteger(s.lastPass.lesson) && s.lastPass.lesson >= D.SYL_BASE, '복습 기록의 단계 번호는 1000번대 → 예전 판은 복습·다시 공부를 만들지 않음');
  assert.notEqual(s.lastPass.lesson + 1, s.lessonIdx);
}
{
  // 이어하기 기록: 번호가 1000번대라 예전 판의 '지금 할 단계' 비교(r.lessonIdx === curLesson)에 걸리지 않음
  const st = copy(tablet); st.resume = { lessonIdx: D.sylIdx(2), replay: false, stepIdx: 3, steps: B.buildSylLesson(2), at: 1 }; st.resumeT = 5;
  assert.ok(K.isSyncPayload(copy(st)), '글자 합치기 이어하기도 연동 검사 통과');
  assert.notEqual(st.resume.lessonIdx, st.lessonIdx);
}
// 진도 초기화: 글자 합치기도 처음부터
store.replaceAll(copy(tablet));
store.resetProgress();
assert.equal(P.sylDoneCount(), 0); assert.ok(!P.sylActive() && store.load().lessonIdx === 0);
// 부모가 줄 고르기: 앞 줄은 통과, 그 줄부터는 안 한 것, 한글 단계는 그대로, 새 epoch
at(12);
const e0 = store.load().epoch;
P.setSylNext(4);
assert.equal(P.sylNext(), 4); assert.equal(P.sylDoneCount(), 4); assert.equal(store.load().lessonIdx, 12);
assert.ok(store.load().epoch >= e0);
P.passSylRow(4, ['그']);
P.setSylNext(2);
assert.equal(P.sylNext(), 2); assert.equal(P.sylDoneCount(), 2); assert.equal(store.load().lastPass, null, '줄을 옮기면 줄 복습 기록은 지움');
assert.equal(store.todayLessons(), 0, '줄을 옮기면 오늘 새 단계 수는 0부터');
P.setSylNext(ROWS);
assert.ok(!P.sylActive() && P.sylDoneCount() === ROWS && P.curTask() === 12, "'끝'을 고르면 건너뜀");
P.setSylNext(0);
assert.ok(P.sylActive() && P.sylDoneCount() === 0, '처음부터 다시');
assert.ok(K.isSyncPayload(copy(store.load())));
// 줄을 옮긴 쪽(새 epoch)을 다른 기기가 따른다
{
  const moved = copy(store.load());
  assert.deepEqual(mergeState(copy(tablet), copy(moved)), mergeState(copy(moved), copy(tablet)));
  assert.equal(P.sylDoneCount(mergeState(copy(tablet), copy(moved))), 0, '부모가 옮긴 상태를 따름');
}

// ---------- 6) 공부 먼저 · 말 ----------
G.setGateBypass(false);
at(LESSONS.length);
store.setSettings({ gate: { h: { mode: 'amount' } } });
assert.ok(!G.gateStatus('h').met, '모험을 다 끝냈어도 글자 합치기 줄이 남았으면 오늘 분량이 남음');
store.addLessonToday();
assert.ok(G.gateStatus('h').met, '줄 하나를 마치면 오늘의 새 단계 하나');
at(LESSONS.length); P.setSylNext(ROWS); store.setSettings({ gate: { h: { mode: 'amount' } } });
assert.ok(G.gateStatus('h').met, '글자 합치기까지 끝냈으면 예전처럼 열림');
const lines = new Set(V.allLines('친구'));
assert.ok(lines.has(V.SYL_GREET), '새 말은 allLines에');
for (const l of ['같이 읽어 보자!', '글자 친구를 눌러 봐!', '잘 듣고 찾아 봐!', '이 글자 카드를 찾아 줘!', '두 친구를 합쳐 보자!', '다섯 번 써 보자!']) assert.ok(clips.has(l) && lines.has(l), `이미 녹음된 말: ${l}`);
assert.ok(C.RANGE.sr.def === 5 && C.RANGE.sr.min === 1 && C.RANGE.sr.max === 15);

store.replaceAll(keep);
store.flushSave();
console.log(`글자 합치기: 140글자(가~휴 10줄×14)·순서·글꼴·녹음 · 모험 ${stepsN}단계(연습한 글자만) · 낱말 단계 앞·한글 진도 그대로·새 저장 칸 없음 · 복습 시험·두 기기 합치기·구버전 기기·초기화·줄 고르기 · 공부 먼저 통과`);
