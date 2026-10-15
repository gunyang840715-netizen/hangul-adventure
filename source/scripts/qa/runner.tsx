// 실제 컴포넌트를 브라우저에 올려 입력 취소·여러 손가락·쓰다듬기·끌기·이미지 복구를 확인.
import { render } from 'preact';
import { usePetTouch } from '../../src/art/pettouch';
import { useWander } from '../../src/art/petbrain';
import { TraceBoard } from '../../src/games/Trace';
import { useArtReady } from '../../src/art/paintbg';
import { AppBoundary } from '../../src/screens/Recovery';
import '../../src/styles.css';
const w = window as any;
w.__FAST__ = true; w.__SAID__ = [];
w.__STAGE__ = { w: 1280, h: 800, scale: .6, side: 0, top: 0 };
const stage = document.getElementById('stage')!;
stage.style.transform = 'scale(.6)';
const mount = document.getElementById('mount')!, report = document.getElementById('report')!;
const lines: string[] = [];
const wait = (ms = 100) => new Promise(r => setTimeout(r, ms));
const check = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); lines.push('통과: ' + msg); report.textContent = lines.join('\n'); };
let taps = 0, completed = 0, misses = 0;
function Touch() {
  const t = usePetTouch({ area: { x0: 0, x1: 400, y0: 0, y1: 300 }, onTap: () => taps++ });
  const p = useWander({ pet: 'maltese', size: 170, mode: 'play', home: { x: 100, y: 100 }, bed: { x: 100, y: 100 }, area: { x0: 0, x1: 400, y0: 0, y1: 300 }, touch: t.target });
  return <div data-touch="1" data-petting={t.petting ? 1 : 0} data-dragging={t.dragging ? 1 : 0} {...t.bind} style={{ position: 'absolute', left: p.x, top: p.y, width: 170, height: 170, ...p.style }}>친구</div>;
}
function ImageCase() { const ok = useArtReady(['./test-retry.webp']); return <div data-image-ready={String(ok)}>그림 {String(ok)}</div>; }
function Broken(): never { throw new Error('검사용 화면 오류'); }
function pointer(el: HTMLElement, type: string, x: number, y: number, id = 1, primary = true) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, clientX: x, clientY: y, button: 0, buttons: 1, isPrimary: primary }));
}
async function run() {
  render(<Touch />, mount); await wait();
  let el = mount.querySelector('[data-touch]') as HTMLElement;
  // 합성 이벤트에는 브라우저가 실제 포인터를 등록하지 않으므로 캡처만 대체. 앱 코드는 그대로 검사.
  el.setPointerCapture = () => {};
  let r = el.getBoundingClientRect();
  pointer(el, 'pointerdown', r.x + 20, r.y + 20); pointer(el, 'pointerup', r.x + 20, r.y + 20); await wait();
  check(taps === 1, '짧게 누르면 기존 반응 1번');
  r = el.getBoundingClientRect(); pointer(el, 'pointerdown', r.x + 20, r.y + 20); await wait(620);
  check(el.dataset.petting === '1', '길게 누르면 쓰다듬기');
  pointer(el, 'pointerup', r.x + 20, r.y + 20); await wait(); check(taps === 1, '쓰다듬기 후 짧은 누르기 중복 없음');
  r = el.getBoundingClientRect(); pointer(el, 'pointerdown', r.x + 20, r.y + 20);
  pointer(el, 'pointermove', r.x + 120, r.y + 80); await wait();
  check(el.dataset.dragging === '1' && parseFloat(el.style.left) > 220, '축소 화면에서도 손가락 이동량에 맞게 따라오기');
  pointer(el, 'pointermove', 5000, 5000); await wait();
  check(parseFloat(el.style.left) === 400 && parseFloat(el.style.top) === 300, '친구가 허용 영역 밖으로 나가지 않음');
  pointer(el, 'pointercancel', 5000, 5000); await wait(); check(el.dataset.dragging === '0' && taps === 1, '끌기 취소 때 누르기 오작동 없음');

  render(<TraceBoard ch="ㄴ" guide="full" test onMiss={() => misses++} onDone={() => completed++} />, mount); await wait();
  el = mount.querySelector('.trace-box canvas') as HTMLCanvasElement; el.setPointerCapture = () => {};
  const pos = (x: number, y: number) => { const b = el.getBoundingClientRect(); return [b.x + (x + 8) / 116 * b.width, b.y + (y + 8) / 116 * b.height]; };
  const draw = (type: string, x: number, y: number, id = 1, primary = true) => { const p = pos(x, y); pointer(el, type, p[0], p[1], id, primary); };
  draw('pointerdown', 26, 18);
  draw('pointerdown', 95, 95, 2, false); draw('pointermove', 95, 95, 2, false);
  for (let y = 23; y <= 78; y += 5) draw('pointermove', 26, y);
  for (let x = 31; x <= 66; x += 5) draw('pointermove', x, 78);
  draw('pointercancel', 66, 78); await wait();
  check(completed === 0 && misses === 0, '두 번째 손가락 무시·시스템 취소는 정답/오답에 포함하지 않음');
  draw('pointerdown', 26, 18);
  for (let y = 23; y <= 78; y += 5) draw('pointermove', 26, y);
  for (let x = 31; x <= 81; x += 5) draw('pointermove', x, 78);
  draw('pointerup', 80, 78); await wait();
  check(completed === 1, '취소 후 같은 획부터 다시 쓰면 정상 완료');

  const NativeImage = window.Image; let attempts = 0;
  (window as any).Image = class {
    onload: (() => void) | null = null; onerror: (() => void) | null = null;
    decode() { return Promise.resolve(); }
    set src(_: string) { const n = ++attempts; setTimeout(() => n === 1 ? this.onerror?.() : this.onload?.(), 0); }
  };
  try {
    render(<ImageCase />, mount); await wait(); check(mount.querySelector('[data-image-ready="false"]'), '그림 실패 시 대체 화면 유지');
    window.dispatchEvent(new Event('online')); await wait(); check(mount.querySelector('[data-image-ready="true"]'), '인터넷 복구 후 실패한 그림 다시 받기');
  } finally { (window as any).Image = NativeImage; }
  render(<AppBoundary><Broken /></AppBoundary>, mount); await wait();
  check(mount.querySelector('[role="alert"] button')?.textContent?.includes('다시 열기'), '화면 오류 때 기록 초기화 없이 다시 열기 제공');
  render(null, mount); report.dataset.status = 'pass'; lines.push('전체 브라우저 회귀 검사 통과'); report.textContent = lines.join('\n');
}
run().catch(e => { report.dataset.status = 'fail'; report.textContent = lines.join('\n') + '\n실패: ' + e.message; });
