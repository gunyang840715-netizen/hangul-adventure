// 손그림 수채 배경 (원문 G · COLLAB 10-G): 겹 그림 하늘(뒤) + 풍경(가운데) + 앞쪽 풀·꽃 + 은은한 움직임
// - 그림: art/backgrounds/<장면>.<층>.<해시>.webp (art_bg.py) · 그림 키 bg.<장면>.<sky|land|front|full>
// - 무대(1280x800 ~ 2200x800 ~ 1280x1150)를 꽉 채우고(cover) 아래 기준으로 맞춘다 — 땅이 늘 아래에.
// - 그림을 받기 전·못 받으면 예전 그림(SVG·CSS)을 그대로 보여 주고, 다 받으면 살짝 밝아지며 바뀐다.
// - 움직임(동시에 25개 이하): 하늘이 아주 천천히 흐르고, 구름이 지나가고, 꽃잎·나뭇잎이 떨어지고, 앞쪽 풀이 살랑,
//   밤에는 반딧불, 도서관은 햇살 속 먼지, 동굴은 반짝임. 기기의 '움직임 줄이기'면 멈춘 그림만.
import { useEffect, useState } from 'preact/hooks';
import { artSrc } from './artmap';

export type BgScene = 'title' | 'meadow' | 'sky' | 'night' | 'castle' | 'cave' | 'beach' | 'library' | 'river' | 'park' | 'yard-dog' | 'yard-cat';

const INDOOR = new Set(['library', 'cave']);

/** 그 장면의 그림 층(뒤 → 앞). 하나라도 없으면 null(예전 그림을 씀) */
export function bgLayers(scene: string, ground = true): { k: string; src: string }[] | null {
  const ks = INDOOR.has(scene) ? ['full', 'front'] : ground ? ['sky', 'land', 'front'] : ['sky'];
  const need = INDOOR.has(scene) ? ['full'] : ground ? ['sky', 'land'] : ['sky'];
  const out: { k: string; src: string }[] = [];
  for (const k of ks) {
    const src = artSrc(`bg.${scene}.${k}`);
    if (src) out.push({ k, src });
    else if (need.includes(k)) return null;
  }
  return out;
}

// ---------- 그림 받기(한 번 받은 것은 기억 — 화면을 다시 열 때 깜빡이지 않게) ----------
const ready = new Set<string>();
const failed = new Set<string>();
const waiting = new Map<string, Promise<boolean>>();

function preload(src: string): Promise<boolean> {
  if (ready.has(src)) return Promise.resolve(true);
  if (failed.has(src)) return Promise.resolve(false);
  let p = waiting.get(src);
  if (!p) {
    p = new Promise<boolean>(res => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => {
        const done = () => { ready.add(src); waiting.delete(src); res(true); };
        (im.decode ? im.decode() : Promise.resolve()).then(done, done);
      };
      im.onerror = () => { failed.add(src); waiting.delete(src); res(false); };
      im.src = src;
    });
    waiting.set(src, p);
  }
  return p;
}

/** 그림을 모두 받았으면 true (받는 중·실패면 false) */
export function useArtReady(srcs: string[] | null | undefined): boolean {
  const key = srcs ? srcs.join('|') : '';
  const [ok, setOk] = useState(() => !!srcs && srcs.length > 0 && srcs.every(s => ready.has(s)));
  useEffect(() => {
    if (!srcs || !srcs.length) { setOk(false); return; }
    if (srcs.every(s => ready.has(s))) { setOk(true); return; }
    let alive = true;
    setOk(false);
    const check = () => Promise.all(srcs.map(preload)).then(r => { if (alive) setOk(r.every(Boolean)); });
    const retry = () => { srcs.forEach(src => failed.delete(src)); check(); };
    check();
    window.addEventListener('online', retry);
    return () => { alive = false; window.removeEventListener('online', retry); };
  }, [key]);
  return ok;
}

/** 손그림 배경이 다 보이면(살짝 밝아지는 0.5초 뒤) 예전 그림은 치운다 → [다 바뀜, PaintedBg의 onReady] */
export function useArtSwap(): [boolean, (ok: boolean) => void] {
  const [art, setArt] = useState(false);
  const [t] = useState<{ id: number }>({ id: 0 });
  useEffect(() => () => clearTimeout(t.id), []);
  return [art, (ok: boolean) => { clearTimeout(t.id); if (ok) t.id = window.setTimeout(() => setArt(true), 520); else setArt(false); }];
}

/** 앱이 켜진 뒤 조용히 미리 받아 두기(인터넷이 없을 때도 다음에 바로 나오게 — 서비스워커가 저장) */
export function prefetchArt(keys: string[], delay = 15000) {
  const nav = navigator as any;
  if (nav.connection?.saveData) return;
  const list = keys.map(k => artSrc(k)).filter((s): s is string => !!s);
  let i = 0;
  const w = window as any;
  const idle = (f: () => void) => (w.requestIdleCallback ? w.requestIdleCallback(f, { timeout: 5000 }) : setTimeout(f, 800));
  const next = () => {
    if (i >= list.length) return;
    const src = list[i++];
    fetch(src).catch(() => { /* 무시 */ }).finally(() => idle(next));
  };
  setTimeout(() => idle(next), delay);
}

// ---------- 은은한 움직임 ----------
type DriftFx = 'butterfly' | 'seed' | 'bubble';
interface Fx { clouds?: number; fall?: string[]; rays?: boolean; flies?: number; twinkle?: number; motes?: number; night?: boolean; drift?: DriftFx[] }
const FX: Record<string, Fx> = {
  title: { clouds: 3, fall: ['petal1', 'petal2', 'petal3', 'petal1', 'petal2'], rays: true },
  meadow: { clouds: 3, fall: ['petal1', 'leaf2', 'petal3', 'petal2', 'leaf1'], rays: true, drift: ['butterfly', 'seed'] },
  sky: { clouds: 3, fall: ['petal2', 'petal3', 'petal1', 'petal2'], rays: true },
  castle: { clouds: 2, fall: ['petal1', 'petal3', 'leaf2', 'petal2'] },
  beach: { clouds: 3, twinkle: 4 },
  night: { clouds: 2, flies: 10, twinkle: 4, night: true },
  river: { clouds: 2, fall: ['leaf1', 'leaf2', 'leaf3', 'leaf4'], drift: ['seed'] },
  library: { motes: 7 },
  cave: { twinkle: 7, motes: 4 },
  park: { clouds: 3, fall: ['petal1', 'petal2', 'leaf2', 'petal3'], drift: ['bubble', 'butterfly'] },
  'yard-dog': { clouds: 2, fall: ['petal1', 'leaf2', 'petal3'] },
  'yard-cat': { clouds: 2, fall: ['petal2', 'leaf1', 'petal1'] },
};

const fxSrc = (k: string) => artSrc(`fx.${k}`);

/** part: 'sky' = 하늘 층과 풍경 층 사이(구름) / 'mid' = 풍경 층과 앞 층 사이(꽃잎·햇살·반딧불·반짝임·먼지) */
function Effects({ scene, part }: { scene: string; part: 'sky' | 'mid' }) {
  const f = FX[scene];
  if (!f) return null;
  // 놀이터처럼 무대보다 훨씬 넓은 그림(가로 3200)에서는 크기는 줄이고 구름은 천천히
  const k = scene === 'park' ? 0.4 : 1;
  const out = [];
  const clouds = ['cloud1', 'cloud2', 'cloud3'].map(fxSrc).filter(Boolean) as string[];
  if (part === 'sky') {
    for (let i = 0; i < (f.clouds ?? 0) && clouds.length; i++) {
    out.push(
      <div class={`fx-lane ${f.night ? 'night' : ''}`} style={{ top: `${4 + i * 9 + (i % 2) * 3}%`, animationDuration: `${(110 + i * 37) / k}s`, animationDelay: `${-(i * 47 + 13) / k}s` }}>
        <img src={clouds[i % clouds.length]} alt="" style={{ width: `${(19 - i * 3) * k}%` }} />
      </div>,
    );
    }
    return <>{out}</>;
  }
  (f.fall ?? []).forEach((name, i) => {
    const src = fxSrc(name);
    if (!src) return;
    out.push(
      <div class="fx-fall" style={{ left: `${12 + ((i * 37) % 80)}%`, animationDuration: `${13 + (i % 3) * 4}s`, animationDelay: `${-(i * 4.3 + 1)}s` }}>
        <img src={src} alt="" style={{ width: `${(2.2 + (i % 2) * 0.8) * k}%`, animationDuration: `${2.8 + (i % 3) * 0.9}s` }} />
      </div>,
    );
  });
  const ray = fxSrc('ray1');
  if (f.rays && ray) out.push(<img class="fx-ray" src={ray} alt="" />);
  const fly = ['firefly1', 'firefly2', 'firefly3'].map(fxSrc).filter(Boolean) as string[];
  for (let i = 0; i < (f.flies ?? 0) && fly.length; i++) {
    out.push(
      <div class="fx-fly" style={{ left: `${6 + ((i * 41) % 88)}%`, top: `${52 + ((i * 23) % 36)}%`, animationDuration: `${7 + (i % 4) * 2.5}s`, animationDelay: `${-i * 1.7}s` }}>
        <img src={fly[i % fly.length]} alt="" style={{ animationDuration: `${2.2 + (i % 3) * 0.8}s`, animationDelay: `${-i * 0.6}s` }} />
      </div>,
    );
  }
  const sp = ['sparkle1', 'sparkle2'].map(fxSrc).filter(Boolean) as string[];
  for (let i = 0; i < (f.twinkle ?? 0) && sp.length; i++) {
    out.push(<img class="fx-twinkle" src={sp[i % sp.length]} alt="" style={{ left: `${8 + ((i * 29) % 84)}%`, top: `${scene === 'night' ? 6 + ((i * 17) % 30) : 30 + ((i * 19) % 40)}%`, animationDuration: `${2.6 + (i % 3)}s`, animationDelay: `${-i * 0.9}s` }} />);
  }
  const mote = fxSrc('glow2') ?? fxSrc('firefly3');
  for (let i = 0; i < (f.motes ?? 0) && mote; i++) {
    out.push(
      <div class="fx-mote" style={{ left: `${10 + ((i * 13) % 34)}%`, top: `${40 + ((i * 17) % 40)}%`, animationDuration: `${14 + (i % 4) * 3}s`, animationDelay: `${-i * 2.9}s` }}>
        <img src={mote!} alt="" />
      </div>,
    );
  }
  (f.drift ?? []).forEach((key, i) => {
    const src = fxSrc(key);
    if (!src) return;
    out.push(<div class={`fx-drift ${key}`} data-fx={key} style={{
      left: `${i === 0 ? 8 : 84}%`, top: `${key === 'bubble' ? 66 : 48 + i * 12}%`,
      width: `${(key === 'seed' ? 2 : key === 'bubble' ? 3.4 : 3) * k}%`, animationDelay: `${-i * 5}s`,
    }}><img src={src} alt="" draggable={false} /></div>);
  });
  return <>{out}</>;
}

/** 그림 배경 층. 그림을 다 받았을 때만 보이고(그 전에는 예전 배경이 보임), 앞쪽 풀은 살랑 */
export function PaintedBg({ scene, ground = true, fx = true, onReady }: { scene: string; ground?: boolean; fx?: boolean; onReady?: (ok: boolean) => void }) {
  const layers = bgLayers(scene, ground);
  const ok = useArtReady(layers?.map(l => l.src));
  useEffect(() => { onReady?.(ok); }, [ok]);
  if (!layers) return null;
  const L = (k: string) => layers.find(l => l.k === k);
  const img = (l?: { k: string; src: string }) => l && <img class={`pbg-l pbg-${l.k}`} src={l.src} alt="" draggable={false} />;
  return (
    <div class={`pbg ${ok ? 'on' : ''}`} data-bg={scene} data-ready={ok ? 1 : 0}>
      {img(L('sky') ?? L('full'))}
      {ok && fx && <div class="pbg-fx"><Effects scene={scene} part="sky" /></div>}
      {img(L('land'))}
      {ok && fx && <div class="pbg-fx"><Effects scene={scene} part="mid" /></div>}
      {img(L('front'))}
    </div>
  );
}
