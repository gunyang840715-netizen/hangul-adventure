// 시계와 시간(11-13 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이) 검사. math_check.mts 끝에서 실행된다(package.json 그대로).
// 1) 시각·바늘 각도·조사 · 사용자 예시(11시 35분 + 40분 = 12시 15분, 12시 10분 − 45분 = 11시 25분, 3시 30분이면 짧은 바늘은 3과 4 사이)
// 2) 문제 만들기: 유형·난이도마다 2000문제 — 정답 보기는 하나·보기 넷 서로 다름·정답이 실제 계산과 같음·단계 규칙(정각·15·30·45·5분·시를 넘나듦)·글꼴
// 3) 힌트가 정답을 바로 말하지 않음 · 풀이 차례(시가 바뀌면 정각에서 멈춤)
// 4) 한 판: 처음 6문제 모두 맞히면 바로 통과 · 10문제 중 9개 통과 · 8개는 '조금 더' · 틀린 유형 다시 · 난이도 자동 조절 · 복습 판
// 5) 기록·보상·저장: State.math 칸에만(lv.ck · sp 'ck:유형' · '날짜:ck') · 예전 저장과 호환 · 두 기기 합치기(merge.js 그대로) · 초기화에도 유지 · 공부 먼저에서 안 잠김
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const g = globalThis as any;
if (!g.localStorage) {   // 혼자 실행할 때 (math_check에서 부르면 이미 있음)
  const memory: Record<string, string> = { 'hangul-device': 'clock-test' };
  g.window = g; g.window.setTimeout = setTimeout; g.window.clearTimeout = clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
const C = await import('../src/math/clockData');
const sd = await import('../src/math/spellData');
const md = await import('../src/math/mathData');
const store = await import('../src/engine/store');
const ms = await import('../src/math/mathStore');
const voice = await import('../src/data/voice');
const { FONT_SYLLABLES } = await import('../src/data/fontchars');
// @ts-ignore (공용 JS)
const { mergeState } = await import('../shared/merge.js');

const hangulOf = (x: string) => [...x].filter(c => c >= '가' && c <= '힣');
const font = (s: string, where: string) => { for (const c of hangulOf(s)) assert.ok(FONT_SYLLABLES.has(c), `앱 글꼴에 없는 글자 '${c}' (${where}: ${s})`); };

// ---------- 1) 시각·바늘·조사·사용자 예시 ----------
{
  const T = (h: number, m: number) => h * 60 + m;
  assert.equal(C.hm(T(3, 25)), '3시 25분'); assert.equal(C.hm(T(15, 0)), '3시'); assert.equal(C.hm(0), '12시'); assert.equal(C.hm(T(12, 5)), '12시 5분');
  assert.equal(C.hmAP(T(15, 25)), '오후 3시 25분'); assert.equal(C.hmAP(T(9, 50)), '오전 9시 50분'); assert.equal(C.hmAP(T(12, 0)), '오후 12시');
  assert.equal(C.h24(T(15, 5)), '15:05'); assert.equal(C.h24(T(9, 50)), '9:50');
  // 바늘: 짧은 바늘은 1분에 0.5도씩 따라감 → 3시 30분이면 3(90°)과 4(120°)의 한가운데
  assert.equal(C.hourAngle(T(3, 30)), 105); assert.equal(C.minuteAngle(T(3, 30)), 180); assert.equal(C.hourAngle(T(3, 0)), 90);
  assert.ok(C.hourAngle(T(3, 25)) > 90 && C.hourAngle(T(3, 25)) < 120, '3시 25분의 짧은 바늘은 3과 4 사이');
  assert.equal(C.H12(T(3, 59)), 3, '3시 59분은 아직 3시');
  // 조사
  assert.equal(C.nEul(3), '3을'); assert.equal(C.nEul(2), '2를'); assert.equal(C.nEul(10), '10을'); assert.equal(C.nEul(25), '25를');
  assert.equal(C.nGwa(3), '3과'); assert.equal(C.nGwa(4), '4와'); assert.equal(C.nEun(40), '40은'); assert.equal(C.nEun(45), '45는');
  assert.equal(C.nRo(30), '30으로'); assert.equal(C.nRo(25), '25로'); assert.equal(C.nRo(7), '7로'); assert.equal(C.nRo(1), '1로');
  // 사용자 예시: 받아올림·빌림을 바늘 이동으로
  const ex = (start: number, delta: number, ampm = false) => ({ type: 'shift', kind: delta > 0 ? 'a2' : 'b2', step: 6, tier: 1, start, delta, end: start + delta, ampm, cross: Math.floor(start / 60) !== Math.floor((start + delta) / 60), opts: [], q: '' } as any);
  const a = ex(T(11, 35), 40);
  assert.equal(C.hm(a.end), '12시 15분', '11시 35분 + 40분 = 12시 15분 (11시 75분 X)');
  assert.deepEqual(C.shiftSteps(a).map((s: any) => [s.from, s.to]), [[T(11, 35), T(12, 0)], [T(12, 0), T(12, 15)]], '25분 가서 12시 정각 → 15분 더');
  assert.equal(C.shiftExplain(a), '35 + 40 = 75분 · 75분은 1시간 15분 → 12시 15분');
  const b = ex(T(12, 10), -45);
  assert.equal(C.hm(b.end), '11시 25분', '12시 10분 − 45분 = 11시 25분');
  assert.deepEqual(C.shiftSteps(b).map((s: any) => [s.from, s.to]), [[T(12, 10), T(12, 0)], [T(12, 0), T(11, 25)]], '10분 거꾸로 12시 정각 → 35분 더 거꾸로');
  assert.equal(C.shiftExplain(b), '12시 10분은 11시 70분과 같아요 · 70 − 45 = 25분 → 11시 25분');
  assert.equal(C.hmAP(T(9, 50) + 25), '오전 10시 15분', '오전 9시 50분에서 25분 후');
  assert.equal(C.hmAP(T(14, 5) - 30), '오후 1시 35분', '오후 2시 5분에서 30분 전');
  // 하루와 날짜
  assert.deepEqual(C.daySums(4), [24, 48, 72, 96], '4일 = 96시간');
  assert.equal(C.dayExplain({ form: 'mix', n: 3, h: 5, total: 77 } as any), '24 × 3 = 72 · 72 + 5 = 77', '3일과 5시간 = 77시간');
  // 화면 글 → 말
  assert.equal(C.speakable('7 × 5 = ?'), '7 곱하기 5는 얼마일까요');
  assert.equal(C.speakable('15:05'), '15시 5분');
}

// ---------- 2) 문제 만들기 ----------
let made = 0;
const reach: Record<string, Set<number>> = {};
{
  const rnd = C.seeded(20261113);
  for (const kd of C.CK_KINDS) {
    for (const tier of [0, 1, 2]) {
      for (const ch of [false, true]) {
        for (let i = 0; i < 700; i++) {
          const k: any = C.makeTask(kd.id, tier, rnd, ch);
          made++;
          assert.equal(k.kind, kd.id); assert.equal(k.step, kd.step, '단계 ' + kd.id);
          assert.ok(k.q && k.q.length <= 60, '문제 글 ' + k.q); font(k.q, kd.id);
          if (k.type === 'read') {
            const H = C.H12(k.t), M = C.MIN(k.t);
            (reach[kd.id] ||= new Set()).add(M);
            const want: Record<string, (m: number) => boolean> = { r0: m => m === 0, r30: m => m === 30, r15: m => m === 15, r45: m => m === 45, r5: m => m % 5 === 0 && m > 0, r1: m => m % 5 !== 0 };
            assert.ok(want[kd.id](M), `${kd.id} 분 ${M}`);
            assert.ok(C.readJudge(k, H, M) && !C.readJudge(k, C.H12(k.t + 60), M) && !C.readJudge(k, H, (M + 5) % 60), '시간 읽기 채점');
            if (k.mode === 'pick') {
              assert.equal(k.opts.length, 4, '보기 넷 ' + kd.id);
              assert.equal(new Set(k.opts.map((o: any) => o.label)).size, 4, '보기가 서로 다름');
              const ok = k.opts.filter((o: any) => o.ok);
              assert.equal(ok.length, 1, '정답 보기 하나'); assert.equal(ok[0].label, C.hm(k.t), '정답 보기 = 실제 시각');
              for (const o of k.opts) assert.ok(o.h >= 1 && o.h <= 12 && o.m >= 0 && o.m < 60 && (o.m % 5 === 0 || o.m === M / 5), '보기 시·분 (5분 단위, 또는 긴 바늘 숫자를 그대로 분으로 읽는 실수)');
            } else {
              assert.equal(k.mode, 'wheel'); assert.equal(k.minStep, kd.id === 'r1' ? 1 : 5);
            }
            assert.equal(!!k.bonus, kd.id === 'r1', '1분 단위는 도전 문제');
            // 힌트는 정답 시각을 말하지 않음 (틀린 답 몇 가지로)
            for (const [h, m] of [[C.H12(k.t + 60), M], [H, (M + 10) % 60], [C.H12(k.t + 120), (M + 25) % 60]] as [number, number][]) {
              for (const nth of [1, 2, 3]) {
                const ht = C.readHint(k, h, m, nth);
                if (M) assert.ok(!new RegExp(`(?<!\\d|칸은 )${M}분(?!씩| 눈금)`).test(ht.text), `힌트가 정답 분을 말함: ${ht.text}`);
                assert.ok(!ht.text.includes(C.hm(k.t)), '힌트가 정답을 말함 ' + ht.text);
                font(ht.text, 'readHint');
              }
            }
            font(C.readExplain(k), 'readExplain');
          } else if (k.type === 'set') {
            const M = C.MIN(k.target);
            assert.ok(kd.id === 's0' ? M === 0 || M === 30 : M % 5 === 0 && M > 0, `${kd.id} 분 ${M}`);
            assert.ok(k.target >= 60 && k.target < 1440, '밤 12시대는 내지 않음');
            assert.ok(C.H12(k.start) !== C.H12(k.target), '처음 시계는 다른 시 (두 바늘을 다 움직여야)');
            assert.ok(C.setJudge(k, k.target) && C.setJudge(k, k.target + 720) && !C.setJudge(k, k.target + 5) && !C.setJudge(k, k.target + 60), '시계 맞추기 채점(12시간 시계)');
            assert.ok(k.q.startsWith(C.hmAP(k.target)), '문제에 오전/오후');
            for (const t of [k.target + 60, k.target + 15, k.start]) for (const nth of [1, 2]) font(C.setHint(k, t, nth).text, 'setHint');
            font(C.setExplain(k) + C.setPraise(k), 'setExplain');
          } else if (k.type === 'shift') {
            const after = kd.id[0] === 'a', cross = kd.id[1] === '2';
            assert.equal(k.delta > 0, after, '후·전'); assert.equal(k.cross, cross);
            assert.equal(k.end, k.ampm ? k.start + k.delta : C.mod(k.start + k.delta, 720), '도착 시각');
            assert.ok(Math.abs(k.delta) % 5 === 0 && Math.abs(k.delta) >= 5 && Math.abs(k.delta) <= 55, '몇 분 ' + k.delta);
            const sh = Math.floor(k.start / 60), eh = Math.floor((k.start + k.delta) / 60);
            assert.equal(sh !== eh, cross, cross ? '시가 바뀜' : '같은 시 안에서');
            if (k.ampm) {
              assert.ok(k.start >= 60 && k.start + k.delta >= 60 && k.start + k.delta < 1440, '밤 12시대 피함');
              if (!k.bonus) assert.equal(k.start < 720, k.start + k.delta < 720, '오전/오후는 그대로 (도전 문제만 낮 12시를 넘음)');
            }
            if (k.bonus) assert.ok(cross && k.ampm && (k.start < 720) !== (k.start + k.delta < 720), '도전: 낮 12시를 넘음');
            assert.equal(k.opts.length, 4, '보기 넷'); assert.equal(new Set(k.opts.map((o: any) => o.label)).size, 4, '보기가 서로 다름');
            const L = (t: number) => (k.ampm ? C.hmAP(t) : C.hm(t));
            const ok = k.opts.filter((o: any) => o.ok);
            assert.equal(ok.length, 1); assert.equal(ok[0].label, L(k.start + k.delta), '정답 = 실제 계산');
            assert.ok(!k.opts.some((o: any) => o.label === L(k.start)), '시작 시각은 보기에 없음');
            for (const o of k.opts) { font(o.label + (o.why || ''), 'shift 보기'); if (!o.ok) assert.ok(!(o.why || '').includes(ok[0].label), '오답 까닭이 정답을 말함'); }
            const hint = C.shiftHint(k);
            assert.ok(!hint.includes(ok[0].label), '고르기 전 힌트가 정답을 말함 ' + hint);
            font(hint, 'shiftHint');
            // 풀이: 이어지는 걸음, 시가 바뀌면 정각에서 멈춤
            const steps = C.shiftSteps(k);
            assert.equal(steps[0].from, k.start); assert.equal(steps[steps.length - 1].to, k.start + k.delta);
            for (let j = 1; j < steps.length; j++) { assert.equal(steps[j].from, steps[j - 1].to); assert.equal(C.mod(steps[j].from, 60), 0, '중간은 정각'); }
            assert.equal(steps.reduce((s: number, x: any) => s + (x.to - x.from), 0), k.delta);
            if (!cross) assert.equal(steps.length, 1);
            font(steps.map((s: any) => s.text).join('') + C.shiftExplain(k), 'shift 풀이');
            assert.ok(C.shiftExplain(k).endsWith(L(k.start + k.delta)), '풀이 끝은 도착 시각');
          } else {
            assert.equal(k.opts.length, 4, '보기 넷 ' + kd.id + ' ' + k.form); assert.equal(new Set(k.opts.map((o: any) => o.label)).size, 4);
            const ok = k.opts.filter((o: any) => o.ok);
            assert.equal(ok.length, 1);
            const truth = k.form === 'day' ? '24시간' : k.form === 'turns' ? '2바퀴' : k.form === 'days' || k.form === 'mix' ? `${k.total}시간` : k.form === 'toDays' ? `${k.n}일` : `${k.n}일 ${k.h}시간`;
            assert.equal(ok[0].label, truth, '하루 문제 정답 ' + k.q);
            if (k.form === 'days' || k.form === 'toDays') assert.equal(k.total, 24 * k.n);
            if (k.form === 'mix' || k.form === 'toMix') { assert.equal(k.total, 24 * k.n + k.h); assert.ok(k.h >= 1 && k.h <= 23 && k.n >= 1); }
            for (const o of k.opts) { assert.ok(!/^-|^0[일시]/.test(o.label) && !/ -?0시간$/.test(o.label) && !/-/.test(o.label), '이상한 보기 ' + o.label); font(o.label + (o.why || ''), 'day 보기'); }
            for (const nth of [1, 2]) { const h = C.dayHint(k, nth); assert.ok(!h.text.includes(truth), '하루 힌트가 정답을 말함 ' + h.text); font(h.text, 'dayHint'); }
            font(C.dayExplain(k), 'dayExplain');
          }
          C.taskSig(k); C.taskAnswer(k);
        }
      }
    }
  }
  assert.deepEqual([...reach.r5].sort((a, b) => a - b), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], '5분 단위 읽기는 모든 5분');
  assert.ok(reach.r1.size >= 40, '1분 단위 읽기');
  // 부모 화면 추천 문제: 날마다 같은 씨앗이면 같은 문제
  for (const kd of C.CK_KINDS) {
    const a = C.sampleProblem(kd.id, C.seeded(7)), b = C.sampleProblem(kd.id, C.seeded(7));
    assert.deepEqual(a, b, '추천 문제는 같은 날 같음'); font(a.q + a.a + a.tip, '추천 문제');
  }
}

// ---------- 3) 단계·말·글꼴 ----------
{
  assert.equal(C.CK_STEPS.length, C.CK_MAX, '바늘 알아보기 + 7단계');
  assert.deepEqual(C.CK_STEPS.slice(1).map(s => s.name), ['정각 읽기', '30분, 15분, 45분 읽기', '5분 단위 읽기', '시계 직접 맞추기', '60분 이내의 시간 전후 계산', '시간을 넘나드는 전후 계산', '하루·여러 날의 시간 계산'], '단계 이름은 사용자 원문 그대로');
  for (let s = 1; s < C.CK_MAX; s++) assert.ok(C.stepKinds(s).length >= 1, s + '단계 유형');
  for (const s of C.CK_STEPS) { font(s.name + s.short + s.goal + s.learned, '단계'); assert.ok(s.learned.length <= 60 && /[.!]$/.test(s.learned), "'오늘 배운 것'은 한 문장"); }
  const lines = voice.clockLines();
  for (const l of lines) font(l, '시계 말');
  const all = new Set(voice.allLines('친구'));
  for (const l of lines) assert.ok(all.has(l), '시계 말은 allLines에 ' + l);
  assert.equal(voice.CLOCK_HAND.h, '짧은 바늘은 시를 알려줘요.'); assert.equal(voice.CLOCK_HAND.m, '긴 바늘은 분을 알려줘요.');
}

// ---------- 4) 한 판 ----------
{
  const rnd = C.seeded(99);
  const play = (cfg: any, answers: (i: number, it: any) => boolean) => {
    const st = C.roundStart(cfg); const items: any[] = [];
    for (let i = 0; i < 60; i++) { const it = C.roundNext(st, rnd); if (!it) break; items.push(it); C.roundAnswer(st, it, answers(i, it)); }
    return { st, items };
  };
  // 처음 6문제를 모두 한 번에 → 바로 통과
  let r = play({ mode: 'level', step: 3, frontier: true, tier: 1 }, () => true);
  assert.equal(r.st.done, 'fast'); assert.equal(r.st.main, C.CK_FAST); assert.ok(C.roundPassed(r.st));
  // 통과할 단계가 아니면(다시 하기) 바로 통과 없이 10문제
  r = play({ mode: 'level', step: 3, frontier: false, tier: 1 }, () => true);
  assert.equal(r.st.main, C.CK_ROUND); assert.equal(r.st.done, 'pass');
  // 본 문제 10개 중 9개 → 통과 / 8개 → 조금 더
  for (const [miss, want] of [[[2], 'pass'], [[2, 7], 'end']] as [number[], string][]) {
    let mi = 0;
    r = play({ mode: 'level', step: 5, frontier: true, tier: 1 }, (_i, it) => { if (it.tag !== 'main') return true; const ok = !miss.includes(mi); mi++; return ok; });
    assert.equal(r.st.main, C.CK_ROUND); assert.equal(r.st.done, want, `오답 ${miss.length}개 → ${want}`);
    // 틀린 유형은 두 문제 뒤에 한 번 더 (본 문제 수·통과 판정에 안 셈)
    // (판 끝 무렵에 틀린 것은 이번 판 대신 다음 판 처음 복습으로 — 기록의 '틀림' 상태)
    assert.equal(r.items.filter(x => x.tag === 'again').length, miss.filter(i => i + 3 <= C.CK_ROUND - 1).length, '틀린 유형 다시');
  }
  // 난이도 자동 조절: 연속 2번 틀리면 쉽게, 연속 3번 맞히면 어렵게
  let st = C.roundStart({ mode: 'level', step: 2, frontier: true, tier: 1 });
  let it = C.roundNext(st, rnd)!; C.roundAnswer(st, it, false); it = C.roundNext(st, rnd)!; C.roundAnswer(st, it, false);
  assert.equal(st.tier, 0, '연속 2번 틀리면 쉽게');
  for (let i = 0; i < 3; i++) { it = C.roundNext(st, rnd)!; C.roundAnswer(st, it, true); }
  assert.equal(st.tier, 1, '연속 3번 맞히면 한 칸 어렵게');
  // 지난번에 틀린 유형은 판 처음에 짧게 복습 (쉽게)
  st = C.roundStart({ mode: 'level', step: 6, frontier: true, tier: 2, review: ['r15', 'b1'] });
  const first = [C.roundNext(st, rnd)!, C.roundNext(st, rnd)!];
  assert.deepEqual(first.map(x => [x.tag, x.task.kind]), [['review', 'r15'], ['review', 'b1']]);
  assert.ok(first.every(x => x.task.tier === 1), '복습은 한 칸 쉽게');
  // 복습 판: 유형마다 두 문제, 틀리면 바로 한 번 더, 끝나면 'end'
  r = play({ mode: 'review', step: 1, review: ['a2'] }, (i) => i !== 0);
  assert.equal(r.st.done, 'end'); assert.deepEqual(r.items.map(x => x.tag), ['review', 'review', 'again'], '틀린 유형은 그 판 안에서 한 번 더');
  assert.equal(C.roundStart({ mode: 'review', step: 1, review: [] }).done, 'end');
  // 같은 판에 같은 문제 두 번 X · 도전 문제는 어렵게 풀 때만, 판에 3개까지
  for (let s = 1; s <= 7; s++) for (let rep = 0; rep < 30; rep++) {
    r = play({ mode: 'level', step: s, frontier: false, tier: rep % 3 }, () => rnd() < 0.8);
    const sigs = r.items.filter(x => x.tag === 'main').map(x => C.taskSig(x.task));
    // 정각 읽기(12문제뿐)·하루 문제(종류가 적음)는 다시 풀기까지 합치면 겹칠 수 있음
    if (s !== 1 && s !== 7) assert.equal(new Set(sigs).size, sigs.length, `${s}단계 같은 문제 두 번`);
    assert.ok(r.items.filter(x => x.tag === 'bonus').length <= C.CK_BONUS_MAX);
    for (const x of r.items) if (x.tag === 'main') assert.equal(x.task.step, s, '본 문제는 그 단계 유형만');
    assert.ok(r.items.every(x => x.tag !== 'main' || !x.task.bonus), '도전 문제는 본 문제로 안 셈');
  }
  // 골고루 복습 (모두 통과 뒤): 2~7단계가 섞임
  const steps = new Set<number>();
  for (let rep = 0; rep < 20; rep++) for (const x of play({ mode: 'mix', step: 0, tier: 1, weak: ['b2'] }, () => true).items) steps.add(x.task.step);
  for (const s of [2, 3, 4, 5, 6, 7]) assert.ok(steps.has(s), '골고루 복습에 ' + s + '단계');
  // 정답률로 시작 난이도
  const ks = (solved: number, correct: number) => C.CK_KINDS.map(k => ({ kind: k.id, solved: k.id === 'a1' ? solved : 0, correct: k.id === 'a1' ? correct : 0, wrongNow: false, rate: solved ? correct / solved : 1 }));
  assert.equal(C.startTier(ks(2, 2), 5), 0, '처음엔 쉽게'); assert.equal(C.startTier(ks(10, 10), 5), 2); assert.equal(C.startTier(ks(10, 8), 5), 1); assert.equal(C.startTier(ks(10, 5), 5), 0);
  assert.deepEqual(C.weakKinds(ks(10, 5)).map(w => w.kind), ['a1'], '어려워하는 유형');
}

// ---------- 5) 기록·보상·저장 ----------
{
  store.reset();
  const hangul = () => { const s: any = store.load(); return JSON.stringify({ ...s, math: undefined, settings: undefined, settingsT: undefined }); };
  const h0 = hangul();
  const before = ms.mathState();
  const lvBefore = JSON.stringify({ add: before.lv.add, sub: before.lv.sub, mul: before.lv.mul, div: before.lv.div });
  assert.equal(ms.clockLv(), 0, '처음엔 바늘 알아보기부터');
  assert.equal(ms.passClockStep(2), false, '지금 할 단계가 아니면 안 열림');
  assert.equal(ms.passClockStep(0), true); assert.equal(ms.clockLv(), 1);
  assert.equal(ms.passClockStep(0), false, '이미 통과한 단계를 다시 해도 그대로');
  const t0 = ms.todayMath().solved, c0 = ms.todayMath().correct;
  let gotItem = 0;
  for (let i = 0; i < 10; i++) if (ms.answerClock(true, 'r0').item) gotItem++;
  assert.equal(gotItem, 1, '정답 10개마다 꾸미기 하나 (수학과 같이 셈)');
  ms.answerClock(false, 'r30');
  const m = ms.mathState();
  assert.equal(ms.todayMath().solved, t0 + 11); assert.equal(ms.todayMath().correct, c0 + 10, '하루 문제 수·정답은 수학과 같이 셈');
  assert.equal(ms.todayCat('ck', m).solved, 11);
  assert.equal(sd.spOf(m.sp['ck:r30'])!.st, sd.SP_WRONG, '틀린 유형은 틀림 상태');
  assert.deepEqual(ms.clockWrong(m), ['r30']); assert.deepEqual(ms.clockDue(m), ['r30'], '다음 판 처음에 복습');
  const day = Object.keys(m.solvedC).find(k => k.endsWith(':ck.r0'))!;
  assert.ok(day, "유형별 하루 기록 '날짜:ck.유형'");
  ms.answerClock(true, 'r30');
  assert.equal(sd.spOf(ms.mathState().sp['ck:r30'])!.st, sd.SP_FIX1, '다시 맞히면 고침 → 이틀 뒤 한 번 더');
  const cs = ms.clockStats();
  assert.equal(cs.solved, 12); assert.equal(cs.correct, 11); assert.equal(cs.lv, 1);
  ms.addMathMs(4000, 'ck'); ms.addMathMs(1000);
  assert.equal(ms.clockStats().msToday, 4000, '이 학습에 쓴 시간');
  const after = ms.mathState();
  assert.equal(JSON.stringify({ add: after.lv.add, sub: after.lv.sub, mul: after.lv.mul, div: after.lv.div }), lvBefore, '수학 단계는 그대로');
  assert.equal(hangul(), h0, '한글 칸은 하나도 안 바뀜');
  // 부모 설정: 단계 바꾸기 (0이면 칸을 지움)
  ms.setClockLv(5); assert.equal(ms.clockLv(), 5); ms.setClockLv(99); assert.equal(ms.clockLv(), C.CK_MAX); ms.setClockLv(0); assert.equal(ms.mathState().lv.ck, undefined); ms.setClockLv(3);
  // 저장 모양: 모르는 열쇠·이상한 값은 버림, 예전 기록(칸 없음)은 처음부터
  const good = sd.spCode(29500000, sd.SP_WRONG);
  const nm = md.normalizeMath({ lv: { add: 1, ck: 4 }, lvT: { ck: 5, zz: 1 }, sp: { 'ck:a1': good, 'ck:zz': good, 'ck:r1': -3 }, solvedC: { '20000:ck': { a: 2 }, '20000:ck.d3': { a: 1 }, '20000:ck.zz': { a: 1 } }, ms: { '20000': { a: 5 }, '20000:ck': { a: 3 }, '20000:zz': { a: 1 } } })!;
  assert.equal(nm.lv.ck, 4); assert.deepEqual(nm.lvT, { ck: 5 }); assert.deepEqual(nm.sp, { 'ck:a1': good });
  assert.deepEqual(Object.keys(nm.solvedC).sort(), ['20000:ck', '20000:ck.d3']); assert.deepEqual(Object.keys(nm.ms).sort(), ['20000', '20000:ck']);
  for (const bad of [0, -1, 'x', 2.5]) assert.equal(md.normalizeMath({ lv: { ck: bad } })!.lv.ck, bad === 2.5 ? 2 : undefined, '이상한 단계 ' + bad);
  assert.equal(md.normalizeMath({ lv: { ck: 99 } })!.lv.ck, C.CK_MAX);
  assert.equal(md.normalizeMath({})!.lv.ck, undefined, '예전 기록에는 칸 없음');
  assert.ok(!('ck' in md.freshMath().lv), '새 기록에도 칸 없음 (예전 모양 그대로)');
  // 두 기기 합치기 (shared/merge.js 그대로): 단계는 나중에 바꾼 쪽, 유형 상태는 큰 값, 하루 기록은 기기별 합계
  const A = store.fresh(), B = store.fresh();
  (A as any).math = { ...md.freshMath(), lv: { ...md.freshMath().lv, ck: 3 }, lvT: { ck: 100 }, sp: { 'ck:a1': sd.spCode(100, sd.SP_WRONG) }, solvedC: { '9:ck': { d1: 3 } } };
  (B as any).math = { ...md.freshMath(), lv: { ...md.freshMath().lv, ck: 5 }, lvT: { ck: 200 }, sp: { 'ck:a1': sd.spCode(300, sd.SP_FIX1), 'ck:d2': sd.spCode(5, sd.SP_WRONG) }, solvedC: { '9:ck': { d2: 4 } } };
  const ab = mergeState(A, B), ba = mergeState(B, A);
  assert.equal(JSON.stringify(ab.math), JSON.stringify(ba.math), '합치는 순서와 상관없음');
  assert.equal(ab.math.lv.ck, 5, '단계는 나중에 바꾼 쪽');
  assert.deepEqual(ab.math.sp, { 'ck:a1': sd.spCode(300, sd.SP_FIX1), 'ck:d2': sd.spCode(5, sd.SP_WRONG) });
  assert.deepEqual(ab.math.solvedC['9:ck'], { d1: 3, d2: 4 });
  // 처음부터로 되돌린 기기(칸 지움, 나중 시각)가 이김
  const Cc = store.fresh(); (Cc as any).math = { ...md.freshMath(), lvT: { ck: 300 } };
  assert.equal(mergeState(ab, Cc).math.lv.ck, undefined, '처음부터로 바꾼 것이 나중이면 처음부터');
  // 예전 앱(시계 칸을 모름)과 합쳐도 시계 기록이 남음
  const Old = store.fresh(); (Old as any).math = { ...md.freshMath() };
  assert.equal(mergeState(ab, Old).math.lv.ck, 5); assert.equal(mergeState(Old, ab).math.sp['ck:d2'], sd.spCode(5, sd.SP_WRONG));
  // 한글 전체 초기화·예전 백업에도 시계 기록 유지
  const keep = JSON.stringify({ lv: ms.mathState().lv, sp: ms.mathState().sp });
  store.reset();
  assert.equal(JSON.stringify({ lv: ms.mathState().lv, sp: ms.mathState().sp }), keep, '전체 초기화에도 시계 기록 유지');
  // 공부 먼저: 시계와 시간은 공부 화면이라 안 잠김 · 첫 화면 → 시계 화면 연결
  const gate = await import('../src/lib/gate');
  assert.ok(!('mathClock' in gate.GATE_SCREENS) && gate.gateBlock('mathClock') === null, '시계와 시간 화면은 안 잠김');
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes("case 'mathClock'") && app.includes("onClock={() => go('mathClock')}"), '첫 화면 → 시계와 시간 화면');
  assert.ok(!/COUNTED[^\n]*mathClock/.test(app), '한글 사용 시간에 안 셈');
}
console.log(`시계와 시간: 바늘 알아보기+7단계·유형 ${C.CK_KINDS.length}개·문제 ${made}개(정답 보기 하나·보기 서로 다름·실제 계산과 같음·힌트가 정답을 말하지 않음·글꼴), 사용자 예시(11:35+40=12:15·12:10−45=11:25·3시 30분 바늘)`
  + `, 한 판(6문제 바로 통과·10문제 중 9개·틀린 유형 다시·난이도 조절·복습 판·골고루), 기록·보상·저장·합치기(merge.js 그대로)·초기화·공부 먼저 통과`);
