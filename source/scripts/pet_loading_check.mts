// 실제 PaintPet: 동작 그림을 기다리거나 다운로드 실패 때 정면 꾸미기를 유지해야 함.
import assert from 'node:assert/strict';
const g = globalThis as any; g.window = g;
g.devicePixelRatio = 1;
const pending: FakeImage[] = [], drawn: string[] = [];
class FakeImage {
  src = ''; decoding = ''; onload?: () => void; onerror?: () => void;
  constructor() { pending.push(this); }
}
g.Image = FakeImage;
const ctx: any = new Proxy({}, { get: (_target, key) => key === 'drawImage' ? (im: FakeImage) => drawn.push(im.src) : () => {}, set: () => true });
const canvas = () => ({ width: 0, height: 0, getContext: (kind: string) => kind === '2d' ? ctx : null });
g.document = { createElement: () => canvas() };
const { PaintPet, loadBase, loadMotions, retryPaintImages } = await import('../src/art/petpaint');
const base = loadBase('persian');
pending.splice(0).forEach(im => im.onload?.());
assert.equal(await base, true);
let shown: any;
const p = new PaintPet({ id: 'persian', canvas: canvas() as any, onPose: pose => { shown = pose; } });
p.setSize(220);
const pose = p.anim.step(0, p.inp);
p.anim.step = () => ({ ...pose, sprite: { key: 'eat', frame: 1 } });
loadMotions('persian');
p.frame(1 / 30);
assert.ok(drawn.some(src => src.includes('.paint-front.')), '동작 로딩 중 기존 정면 그림 표시');
assert.equal(shown.sprite, null, '정면 그림일 때 정면 꾸미기를 숨기면 안 됨');
const failed = pending.find(im => im.src.includes('.paint-eat.'))!;
failed.onerror?.(); drawn.length = 0;
p.frame(1 / 30);
assert.equal(shown.sprite, null, '다운로드 실패 중에도 정면 꾸미기 유지');
retryPaintImages();
const recovered = pending.filter(im => im.src.includes('.paint-eat.')).at(-1)!;
assert.notEqual(recovered, failed); recovered.onload?.();
drawn.length = 0; p.frame(1 / 30);
assert.equal(shown.sprite.key, 'eat', '복구 후 실제 동작이 그려지면 옆모습 꾸미기로 전환');
assert.ok(drawn.some(src => src.includes('.paint-eat.')));
p.destroy();
console.log('동작 그림 로딩·실패 중 정면 꾸미기 보존, 복구 후 동작 꾸미기 전환 통과');
