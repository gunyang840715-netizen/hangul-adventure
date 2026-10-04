// 배경 장면과 반짝이 효과
import { useEffect, useState } from 'preact/hooks';
import { LibraryBack } from './Library';

export type Theme = 'meadow' | 'river' | 'sky' | 'night' | 'castle' | 'cave' | 'beach' | 'library';

const SKY: Record<Theme, [string, string]> = {
  meadow: ['#bfe6ff', '#fff4fb'],
  river: ['#aee3ff', '#effaff'],
  sky: ['#ffd9ec', '#e8f3ff'],
  night: ['#3b2d6b', '#8b6fc7'],
  castle: ['#e5d9ff', '#fff2f8'],
  cave: ['#b8f2e6', '#f0fffb'],
  beach: ['#9fdcff', '#fff6dc'],
  library: ['#fff4e6', '#ffe8cc'],
};

const HILL: Record<Theme, [string, string]> = {
  meadow: ['#a8e6a1', '#7fd28b'],
  river: ['#9ee0a6', '#72c98a'],
  sky: ['#ffe3f1', '#ffc9e3'],
  night: ['#5a4a94', '#463a7a'],
  castle: ['#cdb8ff', '#b39cf5'],
  cave: ['#8fe3cf', '#63c9b0'],
  beach: ['#ffe8a8', '#ffd97a'],
  library: ['#e9b886', '#d9a06a'],
};

export function Backdrop({ theme = 'meadow', ground = true }: { theme?: Theme; ground?: boolean }) {
  if (theme === 'library') return <LibraryBack />;
  const [a, b] = SKY[theme];
  const [h1, h2] = HILL[theme];
  return (
    <div class="backdrop" style={{ background: `linear-gradient(180deg, ${a} 0%, ${b} 75%)` }}>
      {theme === 'night' ? <Stars /> : <div class="sun" />}
      <Cloud x={8} y={10} s={1} d={0} />
      <Cloud x={60} y={6} s={0.7} d={-12} />
      <Cloud x={82} y={20} s={0.9} d={-25} />
      <Cloud x={34} y={24} s={0.55} d={-40} />
      {ground && (
        <svg class="hills" viewBox="0 0 1280 260" preserveAspectRatio="none">
          <path d="M0 120 C 200 40, 380 70, 560 110 S 900 40, 1280 100 L1280 260 L0 260Z" fill={h1} />
          <path d="M0 180 C 240 120, 420 150, 700 170 S 1080 120, 1280 160 L1280 260 L0 260Z" fill={h2} />
          {theme === 'meadow' && [120, 300, 520, 760, 980, 1160].map((x, i) => <Flower x={x} y={200 + (i % 2) * 22} c={['#ff8fb8', '#ffd43b', '#b197fc'][i % 3]} />)}
        </svg>
      )}
    </div>
  );
}

function Flower({ x, y, c }: { x: number; y: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 v24" stroke="#4caf6a" stroke-width="4" />
      {[0, 72, 144, 216, 288].map(a => <circle cx={Math.cos(a * Math.PI / 180) * 8} cy={Math.sin(a * Math.PI / 180) * 8} r="7" fill={c} />)}
      <circle r="5" fill="#fff3bf" />
    </g>
  );
}

function Cloud({ x, y, s, d }: { x: number; y: number; s: number; d: number }) {
  return (
    <svg class="cloud" style={{ left: `${x}%`, top: `${y}%`, width: 200 * s, animationDelay: `${d}s` }} viewBox="0 0 200 90">
      <g fill="#fff" opacity=".92">
        <circle cx="50" cy="55" r="30" /><circle cx="90" cy="40" r="38" /><circle cx="135" cy="52" r="30" /><rect x="40" y="55" width="110" height="30" rx="15" />
      </g>
    </svg>
  );
}

function Stars() {
  return <div class="stars">{Array.from({ length: 40 }, (_, i) => <i style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 60}%`, animationDelay: `${(i % 7) * 0.4}s` }} />)}</div>;
}

// ---------- 반짝이 터뜨리기 ----------
interface Burst { id: number; x: number; y: number; kind: 'star' | 'confetti' }
let bid = 0;
const subs = new Set<(b: Burst) => void>();

/** 안전 영역(가운데 1280x800) 좌표에 반짝이 */
export function burst(x: number, y: number, kind: 'star' | 'confetti' = 'star') {
  const b = { id: ++bid, x, y, kind };
  subs.forEach(f => f(b));
}

export function BurstLayer() {
  const [list, setList] = useState<Burst[]>([]);
  useEffect(() => {
    const f = (b: Burst) => {
      setList(l => [...l, b]);
      setTimeout(() => setList(l => l.filter(x => x.id !== b.id)), 1600);
    };
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  return (
    <div class="burst-layer">
      <div class="burst-safe">
        {list.filter(b => b.kind === 'star').map(b => (
          <div class="burst" style={{ left: b.x, top: b.y }} key={b.id}>
            {Array.from({ length: 10 }, (_, i) => <span class="spark" style={{ '--a': `${i * 36}deg`, '--c': ['#ffd43b', '#ff8fb8', '#74c0fc', '#b197fc', '#69db7c'][i % 5] } as any}>★</span>)}
          </div>
        ))}
      </div>
      {list.filter(b => b.kind !== 'star').map(b => (
        <div class="confetti" key={b.id}>
          {Array.from({ length: 70 }, (_, i) => <i style={{ left: `${(i * 97) % 100}%`, background: ['#ffd43b', '#ff8fb8', '#74c0fc', '#b197fc', '#69db7c', '#ffa94d'][i % 6], animationDelay: `${(i % 10) * 0.05}s`, '--dx': `${((i * 31) % 120) - 60}px`, '--r': `${(i * 47) % 360}deg` } as any} />)}
        </div>
      ))}
    </div>
  );
}

export interface StageInfo { w: number; h: number; scale: number; side: number; top: number }
export function stageInfo(): StageInfo {
  return (window as any).__STAGE__ ?? { w: 1280, h: 800, scale: 1, side: 0, top: 0 };
}

/** 화면(손가락) 좌표 → 안전 영역 좌표 */
export function toSafe(clientX: number, clientY: number): [number, number] {
  const st = document.getElementById('stage');
  const { scale, side, top } = stageInfo();
  if (!st) return [clientX, clientY];
  const r = st.getBoundingClientRect();
  return [(clientX - r.left) / scale - side, (clientY - r.top) / scale - top];
}

/** 요소 가운데 좌표를 안전 영역 좌표로 */
export function centerOf(el: Element | null | undefined): [number, number] {
  if (!el) return [640, 400];
  const r = el.getBoundingClientRect();
  return toSafe(r.left + r.width / 2, r.top + r.height / 2);
}
