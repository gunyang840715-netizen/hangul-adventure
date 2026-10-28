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
// 선물 비율 (10-23 사용자 요청): 꾸미기 아이템이 간식보다 많이 나온다. 꾸미기를 다 모았으면 간식으로 대신
{
  const { giftFor } = await import('../src/engine/gifts');
  const { ITEM_LIST } = await import('../src/data/pets');
  store.replaceAll(store.fresh());
  const cnt = { snack: 0, item: 0, mat: 0 };
  for (const st of buildLesson(0)) { const gf = giftFor(st.t); if (gf) cnt[gf.kind]++; }
  assert.ok(cnt.item > cnt.snack, `선물은 꾸미기가 간식보다 많이: 꾸미기 ${cnt.item} · 간식 ${cnt.snack}`);
  for (const it of ITEM_LIST) store.addOwned(it.id);
  for (let i = 0; i < 4; i++) assert.equal(giftFor('traceSet')?.kind, 'snack', '꾸미기를 다 모으면 쓰기 선물은 간식');
  console.log(`선물 비율: 첫 단계 꾸미기 ${cnt.item} · 간식 ${cnt.snack} · 재료 ${cnt.mat}, 다 모으면 간식`);
}
// 꾸미기는 무작위·여러 종류로 (10-23 사용자 요청: 늘 야구 모자부터 같은 순서 X), 뽑기는 하루 4번쯤
{
  const { randomDrop, gachaPrize, gachaSlot, wantsGacha, GACHA_PER_DAY } = await import('../src/engine/gifts');
  const { ITEM_LIST, ITEM } = await import('../src/data/pets');
  store.replaceAll(store.fresh());
  const first = Array.from({ length: 60 }, () => randomDrop()!);
  assert.ok(new Set(first).size >= 15, `처음 받는 꾸미기가 매번 달라야 함: ${new Set(first).size}가지`);
  assert.ok(new Set(first.map(id => ITEM[id].slot)).size >= 5, '처음 받는 꾸미기 종류가 골고루');
  const got: string[] = [];
  for (let n = 0; n <= ITEM_LIST.length; n++) {
    const before = new Set(store.ownedNow());
    const left = ITEM_LIST.filter(i => !before.has(i.id));
    const pr = gachaPrize();
    if (!left.length) { assert.equal(pr.item, null, '다 모았으면 뽑기는 간식'); assert.equal(pr.snacks.length, 3); break; }
    assert.ok(pr.item && !before.has(pr.item), '아직 없는 꾸미기만');
    const prev = got.at(-1);
    if (prev && new Set(left.map(i => i.slot)).size > 1) assert.notEqual(ITEM[pr.item!].slot, ITEM[prev].slot, '바로 전과 다른 종류');
    got.push(pr.item!);
  }
  assert.equal(new Set(got).size, ITEM_LIST.length, '꾸미기를 빠짐없이 다 받을 수 있음');
  const m = 60000;
  assert.deepEqual([0, 7.4, 7.6, 15.1, 22.6, 29.9, 40].map(x => gachaSlot(x * m, 30)), [0, 0, 1, 2, 3, 3, GACHA_PER_DAY], '30분이면 7분 30초마다, 하루 3번까지');
  assert.equal(gachaSlot(8.1 * m, 0), 1, '시간 제한 없음이면 8분마다');
  assert.equal(gachaSlot(4.9 * m, 12), 0, '아무리 짧아도 5분마다');
  assert.ok(wantsGacha('hunt', 1, 0) && wantsGacha('traceSet', 2, 1), '놀이·쓰기를 끝냈을 때 뽑기');
  assert.ok(!wantsGacha('hunt', 1, 1) && !wantsGacha('dictation', 1, 0) && !wantsGacha('reward', 1, 0) && !wantsGacha('greet', 1, 0), '같은 칸·시험·끝 뽑기·인사에는 X');
  console.log(`꾸미기 무작위: 처음 60번 ${new Set(first).size}가지·${new Set(first.map(id => ITEM[id].slot)).size}종류, 140개 모두 받음 · 모험 중 뽑기 하루 ${GACHA_PER_DAY}번 + 모험 끝`);
}
store.flushSave();
console.log(`새 글자 ${letters}개 40회·혼자 쓰기·${LESSONS.length}레슨 시험·다음날 복습·오답 보상 규칙 통과`);
// 레벨업 되살림(10-27): 레벨이 올라야 꾸미기 착용·집 짓기·놀이터 짓기가 단계별로 열림 — 검사는 따로 파일(package.json은 그대로 두려고 여기서 불러옴)
await import('./level_unlock_check.mts');
// 공부 먼저(10-28): 오늘 공부 분량을 채워야 꾸미기·집 짓기 같은 공부 아닌 화면이 열림(분량은 부모 설정에서 시간 또는 학습량) — 검사는 따로 파일
await import('./gate_check.mts');
