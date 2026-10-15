// 합성 서버 응답만 사용: 손상된 기기 기록이 정상 진도를 덮지 않아야 한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/state-v3-before-stability.json', import.meta.url), 'utf8'));
const copy = (v: any) => JSON.parse(JSON.stringify(v));
const key = 'hangul-adventure-v2';
const mem: Record<string, string> = { [key]: JSON.stringify(fixture), 'hangul-device': 'sync-check',
  'hangul-sync-code': 'test', 'hangul-sync-url': 'https://example.invalid/test-only' };
const g = globalThis as any; g.window = g;
Object.defineProperty(g, 'navigator', { configurable: true, value: { onLine: true } });
let writes = 0;
g.localStorage = { getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { writes++; mem[k] = String(v); } };
let states: any[] = [];
g.fetch = async () => ({ json: async () => ({ ok: true, ver: 3, states }) });
const store = await import('../src/engine/store');
const sync = await import('../src/engine/sync');
store.load();
const invalid = [null, [], { v: 3, epoch: fixture.epoch + 99999 },
  { v: 3, epoch: fixture.epoch + 99999, name: '친구', lessonIdx: 0, items: {} },
  ...[{ stars: 4 }, { owned: {} }, { usage: { day: 5 } }, { v: 999 }, { items: [] },
    { settings: null }, { resume: { steps: '손상' } }].map(change => ({ ...copy(fixture), ...change }))];
for (const bad of invalid) {
  const before = JSON.stringify(store.load()), saved = mem[key], count = writes;
  const valid = copy(fixture); valid.stars.tablet = 999;
  states = [valid, bad]; // 앞쪽 정상 기록도 손상 응답과 부분 병합하지 않는다.
  assert.equal(await sync.syncNow(), false, '손상된 서버 상태 거절');
  assert.equal(sync.status.error, 'bad_state');
  assert.equal(JSON.stringify(store.load()), before, '거절 시 메모리 보존');
  assert.equal(mem[key], saved, '거절 시 원본 저장 보존');
  assert.equal(writes, count, '거절 시 저장 없음');
}
const tablet = copy(fixture); tablet.v = 2; tablet.stars.tablet = 9;
states = [tablet];
assert.equal(await sync.syncNow(), true, '정상 구버전 v2 기기 기록 호환');
assert.equal(store.load().stars.tablet, 9);
assert.deepEqual(store.load().items, fixture.items);
const newer = copy(store.load()); newer.stars.tablet = 10;
states = [newer];
assert.equal(await sync.syncNow(), true, '정상 v3 기기 기록 호환');
assert.equal(store.load().stars.tablet, 10);
assert.deepEqual(store.load().resume, fixture.resume);
// 부모가 명시적으로 초기화한 정상 전체 상태는 기존 epoch 규칙대로 반영한다.
const reset = store.fresh(); reset.epoch = fixture.epoch + 100000;
states = [reset];
assert.equal(await sync.syncNow(), true);
assert.equal(store.load().lessonIdx, 0);
assert.equal(store.load().epoch, reset.epoch);
console.log(`손상 연동 ${invalid.length}종 거절·원본 보존, v2/v3·명시적 초기화 호환 통과`);
