// 실제 기기 기록을 건드리지 않고 저장 지연·저장 실패·시간 기록·음성 메모리 상한 검증.
import assert from 'node:assert/strict';
import { AudioBufferCache } from '../src/engine/audioCache';
const g = globalThis as any;
const mem: Record<string, string> = {};
let failWrite = false;
g.window = g;
g.document = { visibilityState: 'visible', addEventListener() {} };
g.localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { if (failWrite) throw new Error('quota'); mem[k] = String(v); },
};
const store = await import('../src/engine/store');
store.load();
store.setName('검사용 친구');
assert.equal(mem['hangul-adventure-v2'], undefined, '지연 저장 전 상태');
store.flushSave();
assert.equal(JSON.parse(mem['hangul-adventure-v2']).name, '검사용 친구', '닫기 직전 즉시 저장');
failWrite = true;
store.setSettings({ music: false }); store.flushSave();
assert.equal(store.isStorageOk(), false, '저장 실패 상태 표시');
assert.equal(store.load().settings.music, false, '저장 실패가 메모리 진도를 지우면 안 됨');
failWrite = false; store.flushSave();
assert.equal(store.isStorageOk(), true);
assert.equal(JSON.parse(mem['hangul-adventure-v2']).settings.music, false);

const oldInterval = g.setInterval, oldClear = g.clearInterval, oldPerformance = g.performance;
let tick: () => void = () => {}, time = 0;
g.setInterval = (f: () => void) => { tick = f; return 1; };
g.clearInterval = () => {};
Object.defineProperty(g, 'performance', { configurable: true, value: { now: () => time } });
try {
  const before = store.todayMs();
  store.setClockActive(true); store.startClock();
  for (let i = 1; i <= 5; i++) { time = i * 1000; tick(); }
  assert.equal(store.todayMs(), before + 5000);
  const saved = JSON.parse(mem['hangul-adventure-v2']);
  assert.deepEqual(saved.usage, store.load().usage, '무작위에 맡기지 않고 5초마다 사용 시간 저장');
  g.document.visibilityState = 'hidden'; time += 1000; tick();
  assert.equal(store.todayMs(), before + 5000, '다른 앱을 볼 때 사용 시간 추가 금지');
  g.document.visibilityState = 'visible'; store.setClockActive(false); time += 1000; tick();
  assert.equal(store.todayMs(), before + 5000, '시간 집계 제외 화면에서는 추가 금지');
} finally {
  g.setInterval = oldInterval; g.clearInterval = oldClear;
  Object.defineProperty(g, 'performance', { configurable: true, value: oldPerformance });
  store.flushSave();
}
const b = (length: number, channels = 1) => ({ length, numberOfChannels: channels }) as AudioBuffer;
const cache = new AudioBufferCache(32, 2);
const a = b(4), c = b(4), d = b(4);
cache.set('a', a); cache.set('c', c); assert.equal(cache.get('a'), a);
cache.set('d', d);
assert.equal(cache.get('c'), undefined, '최근 안 쓴 버퍼부터 해제');
assert.equal(cache.get('a'), a);
cache.set('large', b(100));
assert.equal(cache.get('large'), undefined, '상한보다 큰 버퍼는 재생에만 쓰고 보관하지 않음');
assert.equal(cache.get('a'), a, '큰 녹음 하나가 기존 캐시를 모두 지우면 안 됨');
cache.set('stereo', b(4, 2));
assert.equal(cache.get('a'), undefined, '채널 수를 포함한 실제 PCM 바이트 상한');
assert.ok(cache.get('stereo'));
console.log('즉시 저장·저장 실패 복구·5초 시간 기록·백그라운드 제외·음성 캐시 상한 검사 통과');
