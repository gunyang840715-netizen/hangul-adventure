// 실제 사용자 저장소 대신 합성 기록으로 잘못된 백업의 덮어쓰기 방지와 v1~v3 호환 검사.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/state-v3-before-stability.json', import.meta.url), 'utf8'));
const mem: Record<string, string> = { 'hangul-device': 'backup-test', 'hangul-adventure-v2': JSON.stringify(fixture) };
let writes = 0;
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { writes++; mem[k] = String(v); },
};
const store = await import('../src/engine/store');
store.load();
const encode = (o: any) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64');
const invalid = [
  '잘못된 코드', encode(null), encode([]), encode({ v: 3 }),
  ...[
    { lessonIdx: '1' }, { lessonIdx: -1 }, { lessonIdx: 1.5 }, { name: {} },
    { items: [] }, { items: { 'j:ㅏ': 'broken' } }, { items: { 'j:ㅏ': { last: -2 } } }, { settings: { dailyMin: '30' } },
    { owned: 'hat:crown' }, { stars: 5 }, { usage: { '20740': 3 } },
    { wear: { maltese: [] } }, { resume: { steps: 'broken' } },
    { lastPass: { lesson: 1, day: 2, items: {} } }, { hold: [] },
    { deco: { doghouse: 'broken' } }, { reviewDay: 'broken' }, { v: 999 },
  ].map(change => encode({ ...fixture, ...change })),
];
for (const code of invalid) {
  const state = JSON.stringify(store.load()), saved = mem['hangul-adventure-v2'], count = writes;
  assert.equal(store.importCode(code), false, '잘못된 백업 거절');
  assert.equal(JSON.stringify(store.load()), state, '실패한 백업이 메모리 기록을 바꾸면 안 됨');
  assert.equal(mem['hangul-adventure-v2'], saved, '실패한 백업이 저장 기록을 바꾸면 안 됨');
  assert.equal(writes, count, '실패한 백업은 저장하지 않음');
}
for (const v of [2, 3]) {
  assert.equal(store.importCode(encode({ ...fixture, v })), true);
  assert.equal(store.load().lessonIdx, fixture.lessonIdx);
  assert.deepEqual(store.load().items, fixture.items);
}
const old = { v: 1, name: '친구', lessonIdx: 1, items: fixture.items, stars: 7, adventures: 3,
  owned: [], settings: { dailyMin: 30 }, history: [{ day: 20740, ms: 12000, lessons: 1 }] };
assert.equal(store.importCode(encode(old)), true, '몽글이 v1 백업 지원');
assert.equal(store.starsTotal(), 7);
assert.equal(store.load().usage['20740']['backup-test'], 12000);
assert.equal(store.importCode(store.exportCode()), true, '현재 백업 왕복');
const unseen = { ...fixture, items: { 'j:ㅏ': { box: 0, due: 0, seen: 0, right: 0, wrong: 0, last: -1 } }, reviewDay: -1 };
assert.equal(store.importCode(encode(unseen)), true, '처음 글자·복습 전 상태의 -1 표식 호환');
assert.deepEqual(store.load().items, unseen.items);
console.log(`불완전·손상 백업 ${invalid.length}종 덮어쓰기 방지 · v1/v2/v3 복원 통과`);
