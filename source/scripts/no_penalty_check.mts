// 오답을 여러 번 내도 진도·간식·아이템·재료가 그대로인지 검사한다.
import assert from 'node:assert/strict';
const g: any = globalThis;
const mem: Record<string, string> = {};
g.window = g;
g.localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); } };
const { load } = await import('../src/engine/store');
const { penalty } = await import('../src/games/common');
const s = load();
s.lessonIdx = 5;
s.snacks = { cookie: { test: 5 } }; s.mats = { test: 4 }; s.stars = { test: 8 };
s.owned = ['hat:crown']; s.itemGot = { 'hat:crown': 10 };
const before = JSON.stringify(s);
for (let i = 0; i < 20; i++) penalty();
assert.equal(JSON.stringify(load()), before);
console.log('오답 후 진도·보상 보존 검사 통과');
