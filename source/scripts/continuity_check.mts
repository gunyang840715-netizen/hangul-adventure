// 실제 기기 대신 가상 v3 기록으로 업데이트·이어하기·구버전 기기 연동을 검사.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { mergeState } = require('../shared/merge.js');
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/state-v3-before-stability.json', import.meta.url), 'utf8'));
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const KEY = 'hangul-adventure-v2';
const setup = {
  'hangul-device': 'phone',
  'hangul-sync-code': 'test-only',
  'hangul-sync-url': 'https://example.invalid/test-only',
};
const mem: Record<string, string> = { ...setup, [KEY]: JSON.stringify(fixture) };
const writes: string[] = [];
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => { writes.push(k); mem[k] = String(v); },
};
const store = await import('../src/engine/store');
const { refreshSteps } = await import('../src/engine/session');

// 일반 실행에서 epoch가 바뀌면 미업데이트 기기의 기록을 잃을 수 있음. 읽기만 하면 그대로여야 함.
assert.deepEqual(store.load(), fixture, '기존 진도·설정·친구·꾸미기·시험·이어하기를 그대로 읽어야 함');
assert.equal(writes.length, 0, '업데이트 후 읽기만 했을 때 기존 기록을 덮어쓰면 안 됨');
assert.equal(store.dev(), 'phone', '기기 번호를 새로 만들면 연동 합계가 달라짐');
const r = store.getResume()!;
assert.equal(r.lessonIdx, store.curLesson());
assert.deepEqual(refreshSteps(r.steps, r.lessonIdx, r.stepIdx), r.steps, '이미 배운 글자로 된 이어하기 위치·단계 유지');
store.save(true);
assert.deepEqual(JSON.parse(mem[KEY]), fixture, '다시 저장해도 데이터 형식·내용 유지');

// 태블릿은 구버전, 폰만 새 버전이어도 기존 합치기 규칙으로 서로의 기록을 보존.
const tablet = copy(fixture);
tablet.stars.tablet = 9;
tablet.snacks.churu.tablet = 5;
tablet.usage['20740'].tablet = 360000;
tablet.deco['doghouse-out'] = { 'y-color': 'y-color:mint' };
tablet.decoT['doghouse-out'] = 180;
const expected = mergeState(fixture, tablet);
assert.deepEqual(mergeState(tablet, fixture), expected, '신구 버전 기기 연동 순서 무관');
store.absorb(tablet);
assert.deepEqual(store.load(), expected);
assert.equal(store.load().epoch, fixture.epoch, '일반 업데이트·연동은 초기화 세대를 올리지 않음');
assert.equal(store.starsTotal(), 21);
assert.equal(store.snackCount('churu'), 5);
assert.deepEqual(store.load().wear, fixture.wear);
assert.deepEqual(store.load().built, fixture.built);
assert.deepEqual(store.getResume(), fixture.resume);
store.absorb(fixture, tablet);
assert.deepEqual(store.load(), expected, '여러 번 연동해도 진도·보상 중복 없음');
const code = store.exportCode();
assert.deepEqual(JSON.parse(Buffer.from(code, 'base64').toString('utf8')), expected, '기존 백업 코드 형식 유지');

// 부모가 직접 진도 초기화를 실행한 경우에만 시험 상태를 지움. 일반 업데이트와 분리.
const before = copy(store.load());
store.resetProgress();
const reset = copy(store.load());
const cleared = new Set([
  'epoch', 'lessonIdx', 'items', 'lessonsByDay', 'extraLessons', 'resume', 'resumeT',
  'lastPass', 'lastPassT', 'reviewDay', 'reviewDayT', 'hold', 'holdT',
]);
for (const key of Object.keys(before) as (keyof typeof before)[]) {
  if (!cleared.has(key)) assert.deepEqual(reset[key], before[key], `진도 초기화가 보존해야 할 항목: ${key}`);
}
assert.equal(reset.lessonIdx, 0);
assert.deepEqual(reset.items, {});
assert.deepEqual(reset.lessonsByDay, {});
assert.deepEqual(reset.extraLessons, {});
assert.equal(reset.resume, null);
assert.equal(reset.lastPass, null);
assert.equal(reset.hold, null);
assert.equal(reset.reviewDay, -1);
assert.equal(store.reviewDue(), false);
for (const key of ['resumeT', 'lastPassT', 'reviewDayT', 'holdT'] as const) assert.ok(reset[key] > before[key]);
assert.ok(reset.epoch > before.epoch);
assert.deepEqual(mergeState(reset, tablet), reset, '초기화 후 구버전 기기가 예전 시험 상태를 되살리면 안 됨');
assert.deepEqual(mergeState(tablet, reset), reset);
store.passLesson(0, ['ㅏ']);
assert.equal(store.curLesson(), 1, '초기화 후 첫 단계를 마치면 다음 단계로');
assert.equal(store.load().hold, null);
store.save(true);
for (const [k, v] of Object.entries(setup)) assert.equal(mem[k], v, '기기·연동 설정 유지');
assert.ok(writes.every(k => k === KEY), '새 저장 키나 다른 기기 설정에 쓰지 않음');
console.log('기존 v3 기록·이어하기·백업·신구 기기 연동·반복 연동·진도 초기화 보존 검사 통과');
