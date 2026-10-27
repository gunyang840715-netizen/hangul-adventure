// 레벨업 되살림 검사 (10-27 사용자 요청: 레벨이 올라도 크기는 그대로, 레벨이 올라야 꾸미기 착용·집 짓기·놀이터 짓기가 단계별로 열림)
// 혼자 실행: npx tsx scripts/level_unlock_check.mts — npm run check에서는 learning_rules_check.mts 끝에서 불러온다(package.json은 그대로)
// 1) 표(data/unlock.ts): 꾸미기 6종류·짓기 3가지 부품마다 레벨, Lv.1에는 아무것도 안 열림, Lv.2~10마다 무언가 열림
// 2) 잠금 판단: 집은 그 집 친구 레벨, 놀이터는 둘 중 높은 레벨, 다 지은 것·이미 지은 부분은 잠그지 않음
// 3) 레벨업 때 알려 줄 것(이미 지은 부분·다른 친구가 열어 둔 놀이터는 빼기), 말(allLines에 있음, 숫자 조사)
// 4) 저장: 레벨은 기존 간식 점수(한글 growth · 수학 fed+fedPlus)로만 셈 — 새 저장 칸 없음, 언제나 아기 모습(growthOf = 0)
import assert from 'node:assert/strict';
const g = globalThis as any;
if (!g.localStorage) {
  const memory: Record<string, string> = { 'hangul-device': 'level-test' };
  g.window = g;
  g.window.setTimeout ??= setTimeout; g.window.clearTimeout ??= clearTimeout;
  g.localStorage = { getItem: (k: string) => memory[k] ?? null, setItem: (k: string, v: string) => { memory[k] = String(v); } };
}
const U = await import('../src/data/unlock');
const P = await import('../src/data/pets');
const V = await import('../src/data/voice');
const store = await import('../src/engine/store');
const ms = await import('../src/math/mathStore');
const { WEAR_LV, BUILD_LV, partLv, canWear, buildLevel, buildLock, opensFor, nextOpens, unlockTable } = U;
const { SLOTS, BUILDS, BUILD, MAX_LEVEL, LEVELS, levelOf, SNACK } = P;

// ---------- 1) 표 ----------
for (const sl of SLOTS) {
  assert.ok(Number.isInteger(WEAR_LV[sl]) && WEAR_LV[sl] >= 2 && WEAR_LV[sl] <= MAX_LEVEL, `꾸미기 ${sl}: 레벨 2~${MAX_LEVEL}`);
  assert.ok(!canWear(sl, 1), `Lv.1에는 ${sl}을 못 입음 (레벨업을 해야 입힘)`);
  assert.ok(canWear(sl, WEAR_LV[sl]) && !canWear(sl, WEAR_LV[sl] - 1), `${sl}은 Lv.${WEAR_LV[sl]}부터`);
}
assert.deepEqual(SLOTS.map(sl => WEAR_LV[sl]), [2, 3, 4, 5, 6, 7], '옷장 칸 순서(모자·옷·안경·목걸이·신발·장난감)대로 한 레벨에 하나씩');
for (const b of BUILDS) {
  const t = BUILD_LV[b.id];
  assert.equal(t.length, b.parts.length, `${b.name}: 부품마다 레벨`);
  for (let i = 0; i < t.length; i++) {
    assert.ok(t[i] >= 2 && t[i] <= MAX_LEVEL, `${b.name} ${b.parts[i].name}: 레벨 2~${MAX_LEVEL}`);
    if (i) assert.ok(t[i] >= t[i - 1], `${b.name}: 짓는 순서대로 레벨이 같거나 높아짐`);
    assert.equal(partLv(b.id, i), t[i]);
  }
}
assert.deepEqual(BUILD_LV.doghouse, BUILD_LV.cathouse, '강아지 집·고양이 집은 같은 레벨');
assert.equal(partLv('park', 99), BUILD_LV.park.at(-1), '표 뒤에 더해진 부품은 마지막 레벨');
assert.equal(partLv('없는집', 0), 1, '모르는 짓기는 잠그지 않음');
const rows = unlockTable();
assert.deepEqual(rows.map(r => r.lv), Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2), 'Lv.2~10마다 무언가 열림');
for (let lv = 2; lv <= MAX_LEVEL; lv++) {
  const any = [...opensFor(lv - 1, lv, 'dog', 1, () => 0), ...opensFor(lv - 1, lv, 'cat', 1, () => 0)];
  assert.ok(any.length > 0, `Lv.${lv}에 열리는 것이 있음`);
}
assert.equal(opensFor(0, 1, 'dog', 1, () => 0).length, 0, 'Lv.1(처음)에는 아무것도 안 열림');

// ---------- 2) 잠금 판단 ----------
assert.equal(buildLevel('doghouse', 3, 9), 3, '강아지 집은 강아지 레벨');
assert.equal(buildLevel('cathouse', 3, 9), 9, '고양이 집은 고양이 레벨');
assert.equal(buildLevel('park', 3, 9), 9, '놀이터는 둘 중 높은 레벨');
assert.equal(buildLevel('park', 8, 2), 8);
assert.equal(buildLock('doghouse', 0, 1, 10), 2, '처음(Lv.1) 강아지는 바닥을 못 지음 → Lv.2');
assert.equal(buildLock('doghouse', 0, 2, 1), 0, 'Lv.2면 바닥');
assert.equal(buildLock('doghouse', 2, 2, 1), 3, 'Lv.2는 지붕 못 지음 → Lv.3');
assert.equal(buildLock('cathouse', 4, 1, 4), 0, 'Lv.4 고양이는 창문');
assert.equal(buildLock('cathouse', 6, 1, 4), 5, '방석은 Lv.5');
assert.equal(buildLock('park', 0, 6, 6), 7, '놀이터는 Lv.7부터');
assert.equal(buildLock('park', 0, 7, 1), 0, '한 친구만 Lv.7이어도 놀이터');
assert.equal(buildLock('park', 7, 9, 9), 10, '벤치는 Lv.10');
assert.equal(buildLock('doghouse', 8, 1, 1), 0, '다 지은 집은 잠그지 않음(집 안·마당 꾸미기 그대로)');
assert.equal(buildLock('park', 8, 1, 1), 0, '다 지은 놀이터는 잠그지 않음');
assert.equal(buildLock('doghouse', 7, 1, 1), 5, '이미 지은 부분은 그대로, 다음 부분만 잠김');

// ---------- 3) 레벨업 때 알려 줄 것 ----------
const none = () => 0;
assert.deepEqual(opensFor(1, 2, 'dog', 1, none), [{ kind: 'wear', slot: 'hat' }, { kind: 'build', id: 'doghouse', parts: ['바닥', '벽'] }], 'Lv.2 강아지: 모자 + 강아지 집 바닥·벽');
assert.deepEqual(opensFor(1, 2, 'cat', 1, none), [{ kind: 'wear', slot: 'hat' }, { kind: 'build', id: 'cathouse', parts: ['바닥', '벽'] }], 'Lv.2 고양이: 모자 + 고양이 집 바닥·벽');
assert.deepEqual(opensFor(1, 2, 'dog', 1, id => (id === 'doghouse' ? 1 : 0)), [{ kind: 'wear', slot: 'hat' }, { kind: 'build', id: 'doghouse', parts: ['벽'] }], '이미 지은 바닥은 빼고 알려 줌');
assert.deepEqual(opensFor(4, 5, 'dog', 1, id => (id === 'doghouse' ? 8 : 0)), [{ kind: 'wear', slot: 'neck' }], '다 지은 집은 알려 주지 않음');
assert.deepEqual(opensFor(6, 7, 'dog', 3, none), [{ kind: 'wear', slot: 'toy' }, { kind: 'build', id: 'park', parts: ['모래밭', '미끄럼틀'] }], 'Lv.7: 장난감 + 놀이터');
assert.deepEqual(opensFor(6, 7, 'dog', 8, none), [{ kind: 'wear', slot: 'toy' }], '고양이가 이미 Lv.8이면 놀이터 앞부분은 벌써 열려 있음');
assert.deepEqual(opensFor(9, 10, 'cat', 1, id => (id === 'park' ? 7 : 0)), [{ kind: 'build', id: 'park', parts: ['벤치'] }], 'Lv.10: 남은 놀이터 부분만');
assert.equal(opensFor(1, 3, 'dog', 1, none).length, 4, '두 레벨을 한꺼번에 올라도 빠짐없이');
assert.deepEqual(nextOpens(MAX_LEVEL, 'dog', 1, none), [], '최고 레벨이면 다음 없음');
assert.deepEqual(nextOpens(5, 'dog', 1, none), [{ kind: 'wear', slot: 'shoes' }], 'Lv.5 다음은 신발');

// 말: 숫자 조사·allLines에 다 있음·빈 말 없음
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(V.lvGa), ['레벨 1이', '레벨 2가', '레벨 3이', '레벨 4가', '레벨 5가', '레벨 6이', '레벨 7이', '레벨 8이', '레벨 9가', '레벨 10이']);
assert.equal(V.levelUpLine('뭉치', 3), '뭉치가 레벨 3이 됐어!');
assert.equal(V.levelUpLine('식빵', 2), '식빵이가 레벨 2가 됐어!');
assert.equal(V.wearLockLine('냥이', 'clothes', 3), '냥이가 레벨 3이 되면 옷을 입을 수 있어!');
assert.equal(V.buildLockLine('doghouse', '뭉치', '지붕', 3), '뭉치가 레벨 3이 되면 지붕을 만들 수 있어!');
assert.equal(V.buildLockLine('park', '뭉치', '그네', 8), '강아지나 고양이가 레벨 8이 되면 그네를 만들 수 있어!');
assert.equal(V.buildOpenLine('doghouse', ['바닥', '벽']), '이제 바닥이랑 벽을 만들 수 있어!');
assert.equal(V.buildOpenLine('park', ['그네', '시소']), '이제 놀이터에 그네랑 시소를 만들 수 있어!');
assert.equal(V.buildOpenLine('park', ['터널', '큰 공']), '이제 놀이터에 터널이랑 큰 공을 만들 수 있어!');
const all = new Set(V.allLines('친구'));
const lvl = V.levelLines();
for (const l of lvl) {
  assert.ok(all.has(l), 'allLines에 있음: ' + l);
  assert.ok(!/undefined|NaN|null/.test(l) && l.trim() === l && l.length > 4, '말이 비거나 깨지지 않음: ' + l);
}
// 레벨업·잠김 때 실제로 하는 말이 모두 목록에 있는지 (모든 친구·모든 레벨·지은 부분 수)
for (const p of P.PETS) {
  const sp = p.species, house = sp === 'dog' ? 'doghouse' : 'cathouse';
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    assert.ok(all.has(V.levelUpLine(p.name, lv)), `레벨업 말: ${p.name} ${lv}`);
    for (let n = 0; n <= 8; n++) for (const other of [1, 6, 10]) for (const o of opensFor(lv - 1, lv, sp, other, id => (id === house || id === 'park' ? n : 0)))
      assert.ok(all.has(o.kind === 'wear' ? V.wearOpenLine(o.slot) : V.buildOpenLine(o.id, o.parts)), '열림 말이 목록에 있음');
  }
  for (const sl of SLOTS) assert.ok(all.has(V.wearLockLine(p.name, sl, WEAR_LV[sl])), '꾸미기 잠김 말');
  BUILD[house].parts.forEach((pt, i) => assert.ok(all.has(V.buildLockLine(house, p.name, pt.name, partLv(house, i))), '집 짓기 잠김 말'));
}
assert.ok(all.has(V.LEVEL_MORE));

// ---------- 4) 저장: 레벨은 기존 간식 점수로만, 새 칸 없음, 크기 그대로 ----------
const keysBefore = Object.keys(store.fresh()).sort().join(',');
store.replaceAll(store.fresh());
const s = store.load();
assert.equal(store.petView('dog').level, 1, '처음 친구는 Lv.1');
// 간식 점수 3점(케이크) → Lv.2, 모자·바닥/벽 열림
store.addSnack('dogcake', 1);
const r = store.feed(s.dog, 'dogcake')!;
assert.deepEqual([r.before, r.after], [1, 2], '3점 간식으로 Lv.2');
assert.ok(canWear('hat', store.petView('dog').level) && !canWear('clothes', store.petView('dog').level));
assert.equal(buildLock('doghouse', store.builtCount('doghouse'), store.petView('dog').level, store.petView('cat').level), 0, 'Lv.2 강아지 → 강아지 집 바닥을 지을 수 있음');
assert.equal(buildLock('cathouse', store.builtCount('cathouse'), store.petView('dog').level, store.petView('cat').level), 2, '고양이는 아직 Lv.1 → 고양이 집은 잠김');
assert.equal(Object.keys(store.fresh()).sort().join(','), keysBefore, '저장 칸 그대로');
assert.equal(Object.keys(store.load()).filter(k => !keysBefore.split(',').includes(k)).length, 0, '새 저장 칸 없음');
// 점수표 그대로: Lv.10은 63점
assert.deepEqual(LEVELS, [0, 3, 7, 12, 18, 25, 33, 42, 52, 63], '점수표(LEVELS) 그대로');
assert.equal(levelOf(63), MAX_LEVEL);
// 크기 그대로(언제나 아기): Pet.tsx growthOf = 0
const { readFileSync } = await import('node:fs');
const petSrc = readFileSync(new URL('../src/art/Pet.tsx', import.meta.url), 'utf8');
assert.ok(/export function growthOf\([^)]*\)\s*\{\s*return 0;\s*\}/.test(petSrc), '레벨이 올라도 크기는 그대로(growthOf = 0)');
// 수학: 같은 표를 수학 친구 레벨(fed + fedPlus)로
store.replaceAll(store.fresh());
assert.equal(ms.mathPetView('dog').level, 1, '수학 친구도 처음엔 Lv.1');
const m = store.load();
m.math = { ...(await import('../src/math/mathData')).freshMath() } as any;
const M = m.math!;
M.snacks = { churu: { d: 3 } } as any;
for (let k = 0; k < 3; k++) assert.ok(ms.mathFeed('koshort', 'churu'));
assert.equal(ms.mathPetInfo('koshort').points, 6); assert.equal(ms.mathPetInfo('koshort').level, levelOf(6));
assert.equal(ms.mathPetView('cat').level, 2, '츄르 3개(6점) → 수학 고양이 Lv.2');
assert.equal(buildLock('cathouse', ms.mathBuiltCount('cathouse'), ms.mathPetView('dog').level, ms.mathPetView('cat').level), 0, '수학 고양이 집 바닥을 지을 수 있음');
assert.equal(buildLock('doghouse', ms.mathBuiltCount('doghouse'), ms.mathPetView('dog').level, ms.mathPetView('cat').level), 2, '수학 강아지 집은 잠김');
assert.ok(SNACK.churu.points === 2);
store.flushSave();
console.log(`레벨업 되살림: 크기 그대로(growthOf 0) · 꾸미기 ${SLOTS.map(sl => `${P.SLOT_NAME[sl]} Lv.${WEAR_LV[sl]}`).join('·')} · 집 Lv.2~5 · 놀이터 Lv.7~10(둘 중 높은 레벨) · 레벨업 말 ${lvl.length}개 allLines · 저장 칸 그대로 · 한글·수학 같은 표 — 통과`);
