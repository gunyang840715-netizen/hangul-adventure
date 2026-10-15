// 진도·받은 물건 보호 검사: 예전 id가 그대로 있는지, 새 id가 규칙에 맞는지
// (친구·아이템·간식·가구·자리·집 짓기 부품은 이 id로 저장되므로 지우거나 바꾸면 아이가 받은 것이 사라진다)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const g: any = globalThis;
const mem: Record<string, string> = {};
g.window = g;
g.localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: () => {} };
const base = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./ids_baseline.json', import.meta.url)), 'utf8'));
const P = await import('../src/data/pets');
const H = await import('../src/data/home');
const { SNACK_WEIGHT } = await import('../src/engine/gifts');

const has = (list: string[], what: string) => { const s = new Set(list); for (const id of base[what]) assert.ok(s.has(id), `예전 ${what} id가 없어짐: ${id}`); };
const uniq = (list: string[], what: string) => assert.equal(new Set(list).size, list.length, `${what} id 중복`);

const pets = P.PETS.map(p => p.id), items = P.ITEM_LIST.map(i => i.id), snacks = P.SNACKS.map(s => s.id);
const furn = H.FURN.map(f => f.id), room = H.ROOM_SLOTS.map(s => s.id), park = H.PARK_SLOTS.map(s => s.id);
has(pets, 'pets'); has(items, 'items'); has(snacks, 'snacks'); has(furn, 'furn'); has(room, 'roomSlots'); has(park, 'parkSlots');
uniq(pets, '친구'); uniq(items, '아이템'); uniq(snacks, '간식'); uniq(furn, '가구'); uniq(room, '집 안 자리'); uniq(park, '놀이터 자리');

// 집 짓기: 부품 key와 순서는 그대로 (지은 부품 수로 저장됨)
for (const [id, parts] of Object.entries<string[]>(base.builds)) {
  const b = P.BUILD[id];
  assert.ok(b, '집 짓기 없어짐: ' + id);
  assert.deepEqual(b.parts.map(x => x.key), parts, '집 짓기 부품·순서가 바뀜: ' + id);
}
for (const [slot, id] of Object.entries<string>(base.defaultDeco)) assert.equal(H.DEFAULT_DECO[slot], id, '처음 놓인 가구가 바뀜: ' + slot);

// 아이템: id = slot:key, 받는 순서(DROP_ORDER)에 모두 한 번씩
for (const it of P.ITEM_LIST) assert.equal(it.id, `${it.slot}:${it.key}`, '아이템 id 형식: ' + it.id);
assert.equal(P.DROP_ORDER.length, P.ITEM_LIST.length, '받는 순서에 빠진 아이템');
assert.deepEqual([...P.DROP_ORDER].sort(), [...items].sort(), '받는 순서와 아이템 목록이 다름');
const combo: Record<string, number> = {};
for (const it of P.ITEM_LIST) combo[it.slot + '/' + it.for] = (combo[it.slot + '/' + it.for] || 0) + 1;
// 받는 순서는 개수와 상관없이 끝난다(위 검사). 옷장은 스크롤 — 사용자 요청(10-15)으로 옷을 강아지·고양이 20개씩 더해 상한 30
for (const [k, n] of Object.entries(combo)) assert.ok(n <= 30, `한 종류(${k})가 30개를 넘음: ${n}`);

// 간식: 점수 1~3, 선물 비율표에 들어 있어야 실제로 나온다
const w = new Map(SNACK_WEIGHT);
for (const s of P.SNACKS) {
  assert.ok(s.points >= 1 && s.points <= 3, '간식 점수 1~3: ' + s.id);
  assert.ok((w.get(s.id) || 0) > 0, '선물 비율표(SNACK_WEIGHT)에 없는 간식: ' + s.id);
}
for (const id of w.keys()) assert.ok(P.SNACK[id], '없는 간식이 선물 비율표에 있음: ' + id);

// 가구: 놓을 자리가 있어야 함
const slots = new Set([...room, ...park, ...((H as any).YARD_SLOTS || []).map((s: any) => s.id)]);
for (const f of H.FURN) assert.ok(slots.has(f.slot), '놓을 자리가 없는 가구: ' + f.id);

console.log(`id 보호 검사 통과: 친구 ${pets.length} · 아이템 ${items.length} · 간식 ${snacks.length} · 가구 ${furn.length} · 자리 ${room.length}+${park.length}`);
