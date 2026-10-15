// 사용자가 유지하도록 지정한 학습·보상 규칙을 실제 세션 구성과 저장 엔진으로 확인.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const memory: Record<string, string> = { 'hangul-device': 'rules-test' };
const g = globalThis as any;
g.window = g;
g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
g.__VOICE__ = {};
const manifest = JSON.parse(fs.readFileSync('../voice-manifest.json', 'utf8'));
for (const f of manifest.files) for (const key of Object.keys(JSON.parse(fs.readFileSync('../' + f.u, 'utf8')).voices)) g.__VOICE__[key] = 'test';
const { buildLesson } = await import('../src/engine/session');
const { LESSONS } = await import('../src/data/curriculum');
const store = await import('../src/engine/store');
let letters = 0;
for (let i = 0; i < LESSONS.length; i++) {
  const steps = buildLesson(i);
  const exam = steps.findIndex(s => s.t === 'dictation' && s.mode === 'lesson');
  assert.ok(exam >= 0, `모든 새 학습은 받아쓰기 시험 포함: ${i}`);
  for (const [k, s] of steps.entries()) if (s.t === 'rescue' || s.t === 'reward') assert.ok(k > exam, `시험 뒤에 학습 마무리: ${i}`);
  if (!['letters', 'vowel', 'cons'].includes(LESSONS[i].kind)) continue;
  for (const ch of LESSONS[i].items) {
    const sets = steps.filter(s => s.t === 'traceSet' && s.items.length === 1 && s.items[0] === ch);
    assert.equal(sets.reduce((n, s) => n + (s.t === 'traceSet' ? s.reps : 0), 0), 40, `${ch} 새 글자 40회 쓰기`);
    const last = sets.at(-1)!;
    assert.ok(last.t === 'traceSet' && last.reps === 10 && last.guides?.length === 10 && last.guides.every(x => x === 'none'), `${ch} 마지막 10회는 혼자 쓰기`);
    letters++;
  }
}
store.replaceAll(store.fresh());
store.passLesson(0, ['ㅏ']);
assert.equal(store.curLesson(), 1);
assert.equal(store.reviewDue(), false, '당일 복습 시험 중복 없음');
store.load().lastPass!.day = store.today() - 1;
assert.equal(store.reviewDue(), true, '다음날 복습 시험');
store.failReview();
assert.equal(store.curLesson(), 0, '복습 실패 때 전 단계 재학습');
store.passLesson(0, ['ㅏ']);
assert.equal(store.curLesson(), 1, '재학습 시험 통과 후 진도 복구');
store.passReview();
assert.equal(store.reviewDue(), false);
for (const kind of ['snack', 'item', 'mat']) {
  store.replaceAll(store.fresh());
  if (kind === 'snack') store.addSnack('churu');
  if (kind === 'item') { store.addOwned('hat:crown'); store.setWear('maltese', { hat: 'crown' }); }
  if (kind === 'mat') store.addMat();
  assert.equal(store.takeBack()?.kind, kind, '오답 때 보상 하나 회수');
  assert.equal(store.snackTotal() + store.ownedNow().length + store.matsLeft(), 0);
  assert.equal(store.takeBack(), null, '보상이 없을 때 추가 차감 없음');
  if (kind === 'item') assert.equal(store.load().wear.maltese.hat, undefined, '회수한 꾸미기는 벗기기');
}
store.flushSave();
console.log(`새 글자 ${letters}개 40회·혼자 쓰기·${LESSONS.length}레슨 시험·다음날 복습·오답 보상 규칙 통과`);
