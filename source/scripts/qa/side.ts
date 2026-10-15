// 별도 출처에서 실제 PaintPet의 각 칸을 고정해 시각 검수. 저장소·연동·학습 상태는 사용하지 않음.
import { PaintPet, loadBase, loadMotions, rigOf } from '../../src/art/petpaint';
import { ART_MAP, artSrc } from '../../src/art/artmap';
import { IDENTITY } from '../../src/art/petanim';
const result = document.getElementById('result')!;
async function run() {
  const q = new URLSearchParams(location.search), pid = q.get('pet') || 'persian', act = q.get('act') || 'eat';
  const n = rigOf(pid)?.motions[act]?.n;
  if (!n) throw new Error('없는 친구/동작');
  document.querySelector('h1')!.textContent = `${pid} ${act} — 실제 앱 렌더러`;
  const wear = { hat: 'straw', glasses: 'round', neck: 'scarf', clothes: 'stripe' };
  const holders: { p: PaintPet; cv: HTMLCanvasElement }[] = [];
  await loadBase(pid); loadMotions(pid);
  for (let frame = 0; frame < n; frame++) {
    const box = document.createElement('div'), label = document.createElement('p'), cv = document.createElement('canvas');
    label.textContent = `${act} ${frame}`; box.append(label, cv); document.getElementById('frames')!.append(box);
    cv.style.width = '320px'; cv.style.height = '327px';
    const p = new PaintPet({ id: pid, canvas: cv }); p.setSize(320); p.setWear(wear);
    holders.push({ p, cv });
  }
  const keys = Object.keys(ART_MAP).filter(k => k === `pet.${pid}.paint-${act}` || ['iside.hat.straw', 'iside.glasses.round', 'iside.neck.scarf', 'iside.clothes.stripe'].includes(k));
  await Promise.all(keys.map(key => new Promise<void>((resolve, reject) => {
    const im = new Image(); im.onload = () => resolve(); im.onerror = () => reject(new Error(key)); im.src = artSrc(key)!;
  })));
  // 같은 URL을 받는 실제 렌더러의 onload도 처리한 뒤 그린다.
  await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
  holders.forEach(({ p, cv }, frame) => {
    const pose = p.anim.step(0, p.inp);
    (p as any).draw({ ...pose, sprite: { key: act, frame }, root: IDENTITY, dim: 1, lift: 0, wide: 1 });
    if (!cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data.some((v, i) => i % 4 === 3 && v > 0)) throw new Error('빈 캔버스');
    p.destroy();
  });
  result.textContent = `${n}개 칸 실제 렌더링 완료 — 저장·연동 없음`;
}
run().catch(e => { result.textContent = `실패: ${e.message}`; console.error(e); });
