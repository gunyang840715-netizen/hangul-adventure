// 공부량 자세히 검사 (11-07 사용자 요청: 진도·하루 공부량을 부모가 자세히 고침 — 한글·수학 횟수·시간)
// 혼자 실행: npx tsx scripts/study_cfg_check.mts — npm run check에서는 learning_rules_check.mts 끝에서 불러온다(package.json은 그대로)
// 1) 기본값 = 예전 규칙 그대로(새 글자 10번×4세트=40번, 받아쓰기 글자마다 2번, 수학 150문제·20문제·90%)
// 2) 저장: 새 State 칸 없음 — settings 안의 선택 칸 study 하나, 망가진 값은 기본값, 백업·두 기기 합치기에서 살아남음
// 3) 세트 수·횟수를 바꾸면 레슨의 새 글자 쓰기·놀이 수가 그만큼, 처음 세트는 따라 쓰기·마지막은 혼자, 안 배운 글자 없음
// 4) 받아쓰기 횟수 · 수학 하루 최대·다음 단계 조건 · 하루 공부 시간·문제 시간 범위 · 말(allLines)
import assert from 'node:assert/strict';
const g = globalThis as any;
if (!g.localStorage) {
  const memory: Record<string, string> = { 'hangul-device': 'study-test' };
  g.window = g;
  g.window.setTimeout ??= setTimeout; g.window.clearTimeout ??= clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
const store = await import('../src/engine/store');
const C = await import('../src/lib/studyCfg');
const S = await import('../src/engine/session');
const V = await import('../src/data/voice');
const ms = await import('../src/math/mathStore');
const { LESSONS, knownAfter } = await import('../src/data/curriculum');
const { freshMath, normalizeMath, CATS } = await import('../src/math/mathData');
const { mergeState } = await import('../shared/merge.js') as any;
const B = await import('../src/engine/backup');

const keep = JSON.parse(JSON.stringify(store.load()));
const reset = () => { const f = store.fresh(); f.settings = { ...keep.settings }; delete (f.settings as any).study; store.replaceAll(f); };

// ---------- 1) 기본값 ----------
reset();
assert.ok(!('study' in store.fresh().settings), '새 기록의 settings에는 study 칸이 없음(기본값은 코드에)');
assert.equal(C.letterSetCount(), 4); assert.equal(C.letterReps(), 10); assert.equal(C.dictReps(), 2);
assert.equal(C.catMax(), 150); assert.equal(C.upMin(), 20); assert.equal(C.passRate(), 0.9);
assert.equal(S.letterSets(), S.LETTER_SETS, '기본 4세트×10번은 예전 표 그대로');
for (const [k, r] of Object.entries(C.RANGE)) assert.ok(r.def >= r.min && r.def <= r.max, `${k} 기본값이 범위 안`);

const letterIdx = LESSONS.findIndex(l => l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons');
const traceOf = (steps: any[], ch: string) => steps.filter(s => s.t === 'traceSet' && s.items.length === 1 && s.items[0] === ch && s.guides);
const firstCh = LESSONS[letterIdx].items[0];
const sum = (xs: any[]) => xs.reduce((n, s) => n + s.reps, 0);
assert.equal(sum(traceOf(S.buildLesson(letterIdx), firstCh)), 40, '기본: 새 글자 40번');

// ---------- 2) 세트 수·횟수 바꾸기 ----------
const allSets: [number, number][] = [];
for (let n = C.RANGE.ls.min; n <= C.RANGE.ls.max; n++) for (let r = C.RANGE.lr.min; r <= C.RANGE.lr.max; r++) allSets.push([n, r]);
for (const [n, r] of allSets) {
  const sets = S.letterSets(n, r);
  assert.equal(sets.length, n, `${n}세트`);
  sets.forEach(gs => assert.equal(gs.length, r, `${n}세트×${r}번: 세트마다 ${r}번`));
  assert.ok(sets[0].every(x => x === 'full') || n === 1, '처음 세트는 따라 쓰기만');
  if (n >= 2) assert.ok(sets[n - 1].every(x => x === 'none'), '마지막 세트는 혼자 쓰기');
  // 한 세트 안에서는 따라 쓰기 → 흐린 선 → 혼자 순서
  const ord = { full: 0, faint: 1, none: 2, memory: 1 } as const;
  sets.forEach(gs => gs.forEach((x, i) => assert.ok(i === 0 || ord[x] >= ord[gs[i - 1]], '안내가 점점 줄어듦')));
}
store.setSettings({ study: { ls: 2, lr: 6 } });
assert.equal(C.letterSetCount(), 2); assert.equal(C.letterReps(), 6);
{
  const steps = S.buildLesson(letterIdx);
  for (const ch of LESSONS[letterIdx].items) {
    const tr = traceOf(steps, ch);
    assert.equal(tr.length, 2, `${ch}: 2세트`); assert.equal(sum(tr), 12, `${ch}: 2×6=12번`);
    assert.ok(tr.every((t: any) => t.parts === 2), 'parts = 세트 수');
    // 세트마다 바로 뒤에 놀이 한 판
    tr.forEach((t: any) => { const i = steps.indexOf(t); assert.ok(steps[i + 1] && !['traceSet', 'intro', 'dictation'].includes(steps[i + 1].t), '세트 뒤에 놀이'); });
  }
  const k = knownAfter(letterIdx);
  assert.ok(steps.every(st => S.stepFits(st, k)), '세트를 바꿔도 안 배운 글자 없음');
}
store.setSettings({ study: { ls: 8, lr: 15 } });
assert.equal(sum(traceOf(S.buildLesson(letterIdx), firstCh)), 120, '8세트×15번 = 120번');
store.setSettings({ study: { ls: 99, lr: -3 } });
assert.equal(C.letterSetCount(), 4); assert.equal(C.letterReps(), 10, '범위 밖 값은 기본값');
store.setSettings({ study: { ls: 'x', lr: null } as any });
assert.equal(C.letterSetCount(), 4); assert.equal(C.letterReps(), 10, '망가진 값은 기본값');
store.setSettings({ study: 'broken' as any });
assert.equal(C.letterSetCount(), 4, 'study 칸이 객체가 아니어도 안 깨짐');

// 받침·낱말 쓰기 횟수 1~15
reset();
const batIdx = LESSONS.findIndex(l => l.kind === 'batchim');
for (const r of [1, 3, 15]) {
  store.setSettings({ traceReps: r });
  const tr = S.buildLesson(batIdx).filter(s => s.t === 'traceSet');
  assert.ok(tr.length && tr.every((t: any) => t.reps === r), `받침 쓰기 세트마다 ${r}번`);
}
store.setSettings({ traceReps: 10 });

// ---------- 3) 받아쓰기 횟수 ----------
for (const per of [1, 2, 3, 4]) {
  store.setSettings({ study: { dr: per } });
  const d = S.dictationStep(['ㄱ', 'ㄴ', 'ㅏ'], 'lesson') as any;
  assert.equal(d.order.length, 3 * per, `글자마다 ${per}번`);
}
store.setSettings({ study: { dr: 1 } });
assert.equal((S.dictationStep(['ㄱ'], 'review') as any).order.length, 1, '1번이면 그대로 1문제');
store.setSettings({ study: { dr: 2 } });
assert.equal((S.dictationStep(['ㄱ'], 'review') as any).order.length, 4, '기본(2번)은 적어도 4문제 그대로');

// ---------- 4) 수학 ----------
reset();
const day = String(store.today()), dev = store.dev();
const mathOf = () => { const s = store.load(); s.math ??= freshMath() as any; return s.math!; };
store.setSettings({ study: { cm: 30 } });
mathOf().solvedC[day + ':add'] = { [dev]: 29 };
assert.ok(!ms.catFull('add'), '29문제는 아직');
mathOf().solvedC[day + ':add'] = { [dev]: 30 };
assert.ok(ms.catFull('add'), '하루 최대 30문제로 바꾸면 30문제에서 끝');
assert.deepEqual(ms.openCats().includes('add'), false);
// 다음 단계 조건: 10문제·70%
store.setSettings({ study: { cm: 150, um: 10, up: 70 } });
mathOf().solvedC[day + ':add'] = {}; mathOf().correctC[day + ':add'] = {};
ms.setMathLv('sub', 0);
mathOf().lvT = {};
const lv0 = ms.mathState().lv.sub;
for (let i = 0; i < 10; i++) ms.answerMath(i < 7, 'sub');
ms.setMathDayMin(5); // 줄여서 오늘 시간이 바로 끝나면 판정 — 시간 기록을 채워 둠
mathOf().ms[day] = { [dev]: 6 * 60000 };
ms.setMathDayMin(10); ms.setMathDayMin(5);
assert.equal(ms.mathState().lv.sub, lv0 + 1, '10문제·70%로 바꾸면 그 조건에서 다음 단계');
assert.equal(ms.mathState().dayMin, 5, '하루 공부 시간 5분도 저장');
ms.setMathTime(2.5); assert.equal(ms.mathState().timeMul, 2.5);
assert.equal(normalizeMath({ ...ms.mathState() })!.timeMul, 2.5, '다시 읽어도 그대로');
assert.equal(normalizeMath({ dayMin: 175 })!.dayMin, 175);
ms.setMathTime(1); ms.setMathDayMin(30);
store.setSettings({ study: { up: 101 } }); assert.equal(C.passRate(), 0.9, '범위 밖 정답률은 기본값');

// ---------- 5) 저장·백업·합치기 ----------
store.setSettings({ study: { ls: 3, lr: 7, dr: 3, cm: 80, um: 15, up: 85 }, newPerDay: 7, dailyMin: 95, testPass: 70 });
const keys = Object.keys(store.load()).filter(k => k !== 'math').sort().join(',');   // math는 원래 있는 선택 칸
assert.equal(keys, Object.keys(store.fresh()).filter(k => k !== 'math').sort().join(','), 'State 칸은 그대로(새 칸 없음)');
const code = store.exportCode();
reset();
assert.ok(store.importCode(code), '백업 코드로 불러오기');
assert.deepEqual(store.load().settings.study, { ls: 3, lr: 7, dr: 3, cm: 80, um: 15, up: 85 }, '백업에서 살아남음');
assert.equal(store.load().settings.newPerDay, 7); assert.equal(store.load().settings.dailyMin, 95);
assert.ok(B.isSyncPayload(store.load()), '연동 검사 통과');
const A = JSON.parse(JSON.stringify(store.load())); A.settingsT = 50;
const Bs = JSON.parse(JSON.stringify(store.load())); Bs.settings = { ...Bs.settings, study: { ls: 1, lr: 4 } }; Bs.settingsT = 90;
assert.deepEqual(mergeState(A, Bs).settings.study, { ls: 1, lr: 4 }, '두 기기: 나중에 바꾼 설정');
assert.deepEqual(mergeState(Bs, A).settings.study, { ls: 1, lr: 4 }, '합치는 순서와 무관');
// 예전 기록(칸 없음)
const old = store.fresh() as any; delete old.settings.study;
store.replaceAll(old);
assert.equal(C.letterReps(), 10); assert.equal(C.catMax(), 150);

// ---------- 6) 말 ----------
const lines = new Set(V.allLines('친구'));
for (let n = 1; n <= 15; n++) { assert.ok(lines.has(V.repsStartLine(n)), `${n}번 써 보자`); assert.ok(lines.has(V.repsDoneLine(n)), `${n}번 다 썼어`); }
assert.ok(lines.has(V.REPS_ALL_ANY));
assert.equal(V.repsStartLine(10), V.REPS_START[10], '10번은 녹음된 말 그대로');
assert.equal(V.repsStartLine(3), '세 번 써 보자!');
assert.ok(CATS.length === 4);

// ---------- 7) 이어 하기 (11-10 사용자 지적: 5번×3세트로 바꿔도 하던 모험은 10번×4세트 그대로) ----------
reset();
const lt = (st: any[]) => st.filter((x: any) => x.t === 'traceSet' && x.parts != null);
const lIdx = LESSONS.findIndex(l => l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons');
const saved = S.buildLesson(lIdx);                 // 기본 10번×4세트로 저장된 모험
assert.ok(lt(saved).every((x: any) => x.reps === 10 && x.parts === 4));
C.setStudy({ ls: 3, lr: 5 });
// 처음부터 이어 하기: 모든 글자가 5번×3세트, 세트마다 놀이, 놀이는 저장된 그 글자 놀이에서
const a0 = S.applyStudySettings(saved, 1);
const per = (st: any[]) => { const m: Record<string, any[]> = {}; for (const x of lt(st)) (m[x.items[0]] ??= []).push(x); return m; };
for (const [ch, xs] of Object.entries(per(a0))) {
  assert.equal(xs.length, 3, `${ch}: 3세트`); assert.ok(xs.every((x: any, i: number) => x.reps === 5 && x.guides.length === 5 && x.part === i && x.parts === 3), `${ch}: 5번씩`);
  const i0 = a0.indexOf(xs[0]); assert.equal(a0[i0 - 1].t, 'intro', `${ch}: 만나기 다음 첫 세트`);
  xs.forEach((x: any) => { const n = a0[a0.indexOf(x) + 1]; assert.ok(n && n.t !== 'traceSet' && n.t !== 'intro', `${ch}: 세트 뒤 놀이`); assert.ok(saved.includes(n), `${ch}: 놀이는 저장된 것`); });
}
assert.ok(a0.some(x => x.t === 'dictation') && a0.some(x => x.t === 'rescue'), '시험·마무리 그대로');
// 첫 글자 2세트(10번)까지 끝낸 뒤 이어 하기: 끝낸 것과 이어 할 자리 앞은 그대로, 남은 건 3세트째 하나만(5번)
const f0 = lt(saved)[0], ch0 = f0.items[0];
const from = saved.indexOf(lt(saved)[2]);          // 첫 글자 3세트째에서 멈춤
const a1 = S.applyStudySettings(saved, from);
assert.deepEqual(a1.slice(0, from), saved.slice(0, from), '이어 할 자리 앞은 그대로');
const c0 = per(a1)[ch0];
assert.equal(c0.length, 3); assert.equal(c0[0].reps, 10); assert.equal(c0[1].reps, 10); assert.equal(c0[2].reps, 5); assert.equal(a1[from], c0[2], '이어 할 자리 = 남은 세트');
// 세트를 늘리면(6세트) 남은 세트가 늘고, 놀이는 저장된 놀이를 돌려 씀
C.setStudy({ ls: 6, lr: 5 });
assert.equal(per(S.applyStudySettings(saved, from))[ch0].length, 6);
// 받침·낱말 쓰기: 안 한 것만 지금 횟수
const bIdx = LESSONS.findIndex(l => l.kind === 'batchim');
store.setSettings({ study: {}, traceReps: 10 });
const bs = S.buildLesson(bIdx); const bt = bs.filter(x => x.t === 'traceSet');
store.setSettings({ traceReps: 4 });
const ba = S.applyStudySettings(bs, bs.indexOf(bt[1]));
const bb = ba.filter(x => x.t === 'traceSet') as any[];
assert.deepEqual(bb.map(x => x.reps), [10, 4, 4], '받침 쓰기: 끝낸 것 10번, 남은 것 4번');
// 설정 그대로면 아무것도 안 바뀜
store.setSettings({ study: {}, traceReps: 10 });
assert.deepEqual(S.applyStudySettings(saved, 5), saved); assert.deepEqual(S.applyStudySettings(bs, 0), bs);
// 안 배운 글자 없음: 바꾼 뒤 남은 단계도 배운 글자만 (refreshSteps 검사를 그대로 통과)
C.setStudy({ ls: 2, lr: 7 });
const a2 = S.applyStudySettings(saved, 1);
assert.deepEqual(S.refreshSteps(a2, lIdx, 1).length, a2.length, '남은 놀이 다시 만들 것 없음');

store.replaceAll(keep);
store.flushSave();
console.log(`공부량 자세히: 새 글자 ${allSets.length}가지 세트×횟수 · 받아쓰기 1~4번 · 받침 쓰기 1~15번 · 수학 하루 최대·다음 단계 조건·시간 범위 · 저장·백업·합치기·이어 하기 통과`);
