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
    for (let i = 0; i < motion.h.length; i++) {
      assert.ok(finite(motion.h[i], 4) && motion.h[i][0] > 0, `머리 좌표 ${pid}/${key}/${i}`);
      if (motion.b) assert.ok(finite(motion.b[i], 3));
      const frame = sideFrame(pid, key, i)!;
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
console.log(`꾸미기 좌표 ${Object.keys(PET_SIDE).length}마리 · ${motions}동작 · ${frames}프레임 검사 통과`);
