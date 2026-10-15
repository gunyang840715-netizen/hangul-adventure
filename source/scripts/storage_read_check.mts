// 읽기 실패 때 자동 저장·기기 연동으로 기존 기록이 초기 상태로 덮이지 않는지 검사.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const scenario = process.argv[2];
if (!scenario) {
  for (const value of ['json', 'denied', 'normalize', 'reset', 'partial', 'null', 'wrong_type', 'valid_v1', 'valid_v2', 'valid_v3', 'empty']) {
    const r = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), value], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  }
  console.log('읽기/구조 오류 7종 원본·연동 보호, 정상 v1/v2/v3·새 설치·백업 복구 통과');
} else {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/state-v3-before-stability.json', import.meta.url), 'utf8'));
  const raw = scenario === 'json' || scenario === 'reset' ? '{"v":3,'
    : scenario === 'partial' ? JSON.stringify({ v: 3, epoch: 99999 })
    : scenario === 'null' ? 'null'
    : scenario === 'wrong_type' ? JSON.stringify({ ...fixture, usage: { '20740': 2 } })
    : scenario === 'normalize' ? JSON.stringify({ v: 1, name: '친구', lessonIdx: 0, items: {}, owned: 4 })
    : scenario === 'valid_v1' ? JSON.stringify({ v: 1, name: '친구', lessonIdx: 1, items: fixture.items, stars: 7, settings: { dailyMin: 20 } })
    : scenario === 'valid_v2' ? JSON.stringify({ ...fixture, v: 2 }) : JSON.stringify(fixture);
  const mem: Record<string, string> = { 'hangul-adventure-v2': raw, 'hangul-device': 'read-check', 'hangul-sync-code': 'test', 'hangul-sync-url': 'https://example.invalid/test-only' };
  let denied = scenario === 'denied', writes = 0, requests = 0;
  const g = globalThis as any; g.window = g;
  Object.defineProperty(g, 'navigator', { configurable: true, value: { onLine: true } });
  g.localStorage = { getItem: (k: string) => { if (denied) throw new Error('read denied'); return mem[k] ?? null; },
    setItem: (k: string, v: string) => { writes++; mem[k] = String(v); } };
  g.fetch = async () => { requests++; return { json: async () => ({ ok: true, ver: 3, states: [] }) }; };
  const store = await import('../src/engine/store');
  if (scenario.startsWith('valid_') || scenario === 'empty') {
    if (scenario === 'empty') delete mem['hangul-adventure-v2'];
    const s = store.load();
    assert.equal(store.storageNeedsRecovery(), false, '정상 구버전/새 설치는 복구 모드에 들어가지 않음');
    assert.equal(writes, 0, '읽기만 할 때 기존 원본을 바꾸지 않음');
    if (scenario !== 'empty') assert.deepEqual(s.items, fixture.items);
    if (scenario === 'valid_v1') { assert.equal(store.starsTotal(), 7); assert.equal(s.settings.dailyMin, 30); }
    if (scenario === 'valid_v3') assert.deepEqual(s, fixture);
    store.save(true); assert.equal(writes, 1, '정상 기록은 기존처럼 저장 가능');
    assert.equal(store.isStorageOk(), true);
  } else {
  assert.doesNotThrow(() => store.load());
  denied = false;
  store.setName('검사 중'); store.save(true); store.flushSave();
  assert.equal(mem['hangul-adventure-v2'], raw, '읽지 못한 기록 원본 보존');
  assert.equal(writes, 0, '읽기 실패 후 자동 덮어쓰기 금지');
  assert.equal(store.isStorageOk(), false);
  assert.equal(store.exportCode(), '', '초기 대체 상태를 정상 백업으로 내보내지 않음');
  store.resetProgress(); store.replaceAll(store.fresh());
  assert.equal(mem['hangul-adventure-v2'], raw, '읽기 실패 중 진도만 초기화·단계 이동도 원본 보존');
  assert.equal(writes, 0);
  const sync = await import('../src/engine/sync');
  assert.equal(await sync.syncNow(), false, '초기 대체 상태를 다른 기기로 전송하지 않음');
  assert.equal(requests, 0);
  if (scenario === 'reset') store.reset();
  else assert.equal(store.importCode(Buffer.from(JSON.stringify(fixture)).toString('base64')), true);
  assert.equal(store.isStorageOk(), true);
  assert.equal(store.load().lessonIdx, scenario === 'reset' ? 0 : fixture.lessonIdx);
  assert.deepEqual(JSON.parse(mem['hangul-adventure-v2']).items, scenario === 'reset' ? {} : fixture.items);
  assert.equal(await sync.syncNow(), true, '정상 백업 복원 후 기존 연동 재개');
  assert.equal(requests, 1);
  }
}
