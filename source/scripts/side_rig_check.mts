// 움직이는 친구와 꾸미기 좌표의 프레임 수·숫자·변환 일관성 검사.
import assert from 'node:assert/strict';
import { PAINT_RIG } from '../src/art/petpaint.gen';
import { PET_SIDE } from '../src/art/petside.gen';
import { ART_MAP } from '../src/art/artmap';
import { sideFrame, placeM, sideArt } from '../src/art/petside';
import { ITEM_SIDE } from '../src/art/itemside.gen';
let motions = 0, frames = 0;
const finite = (a: number[], n: number) => a.length === n && a.every(Number.isFinite);
for (const [pid, r] of Object.entries(PET_SIDE)) {
  assert.ok(PAINT_RIG[pid], `친구 정보 누락 ${pid}`);
  assert.ok(r.hr > 0 && r.cb[2] > r.cb[0] && r.cb[3] > r.cb[1]);
  for (const [key, motion] of Object.entries(r.m)) {
    const source = PAINT_RIG[pid].motions[key];
    assert.ok(source && ART_MAP[`pet.${pid}.paint-${key}`], `동작 그림 누락 ${pid}/${key}`);
    assert.equal(motion.h.length, source.n - (key === 'sitstand' ? 1 : 0), `머리 프레임 수 ${pid}/${key}`);
    if (motion.b) assert.equal(motion.b.length, motion.h.length, `옷 프레임 수 ${pid}/${key}`);
    if (motion.a) assert.equal(motion.a.length, motion.h.length, `직접 검수한 기준점 프레임 수 ${pid}/${key}`);
    for (let i = 0; i < motion.h.length; i++) {
      assert.ok(finite(motion.h[i], 4) && motion.h[i][0] > 0, `머리 좌표 ${pid}/${key}/${i}`);
      if (motion.b) assert.ok(finite(motion.b[i], 3));
      const frame = sideFrame(pid, key, i)!;
      assert.equal(frame.r.cb, r.cb, '직접 검수한 머리 기준점이 기존 몸통 상자를 바꾸지 않음');
      const a = motion.a?.[i];
      if (a) {
        assert.ok(finite(a.hc, 2) && finite(a.e, 2) && (!a.f || finite(a.f, 2)) && a.hr > 0);
        assert.ok(finite(a.k1, 2) && finite(a.k2, 2) && a.p.length >= 6 && a.p.length % 2 === 0 && a.p.every(Number.isFinite));
        for (let p = 0; p < a.p.length; p += 2) assert.ok(a.p[p] >= 0 && a.p[p] <= source.w && a.p[p + 1] >= 0 && a.p[p + 1] <= source.h);
        assert.deepEqual(frame.h, [1, 0, -0, 1, 0, 0], '실제 칸 좌표에 변환을 이중 적용하지 않음');
        assert.deepEqual(frame.r.e, a.e);
      } else assert.equal(frame.r, r, '기존 동작은 기존 기준점 객체를 그대로 사용');
      assert.ok(finite(frame.h, 6));
      if (frame.b) assert.ok(finite(frame.b, 6));
      frames++;
    }
    assert.equal(sideFrame(pid, key, -1), null);
    assert.equal(sideFrame(pid, key, source.n), null);
    motions++;
  }
  for (const [id, box] of Object.entries(ITEM_SIDE)) {
    const slot = id.split(':')[0] as 'hat' | 'glasses' | 'neck' | 'clothes';
    assert.ok(sideArt(id), `꾸미기 그림 누락 ${id}`);
    assert.ok(box[2] > box[0] && box[3] > box[1]);
    assert.ok(finite(placeM(slot, r, box), 6), `꾸미기 변환 ${pid}/${id}`);
  }
}
for (let i = 0; i < PAINT_RIG.shiba.motions.eat.n; i++) assert.ok(sideFrame('shiba', 'eat', i)?.b, '보리 먹기 꾸미기는 모든 칸에서 유지');
for (let i = 0; i < PAINT_RIG.persian.motions.eat.n; i++) assert.ok(sideFrame('persian', 'eat', i)?.b, '페르시안 먹기 꾸미기는 모든 칸에서 유지');
const closedEyes = sideFrame('persian', 'eat', 1)!;
assert.deepEqual(closedEyes.r.e, [366, 275], '눈을 감는 칸의 안경은 이마 대신 실제 눈 위치를 사용');
for (const id of ['hat:straw', 'glasses:round', 'neck:scarf']) assert.ok(finite(placeM(id.split(':')[0] as any, closedEyes.r, ITEM_SIDE[id]), 6));
for (const pid of ['corgi', 'russian', 'siamese', 'fold']) {
  for (let i = 0; i < PAINT_RIG[pid].motions.scratch.n; i++) assert.ok(sideFrame(pid, 'scratch', i)?.b, `귀 긁기 꾸미기 ${pid}/${i}`);
}
console.log(`꾸미기 좌표 ${Object.keys(PET_SIDE).length}마리 · ${motions}동작 · ${frames}프레임 검사 통과`);
