// 집 안 꾸미기(강아지 집·고양이 집) · 큰 놀이터 꾸미기 · 집 밖 마당 꾸미기
// - 자리를 누르면 아래에 고를 수 있는 가구·기구가 나옴. 처음 고를 때 재료 1개(한 번 사면 계속 바꿔 놓기)
// - 강아지·고양이가 침대에서 자거나 장난감으로 놀고, 놀이터에서는 그네·미끄럼틀·트램펄린을 타거나 돗자리에서 낮잠
// - 마당(원문 E): 손그림 강아지 마을·고양이 마을에 지은 집(집 짓기 완성 그림)을 두고 울타리·나무 등 12자리 + 집 색
import { useEffect, useRef, useState } from 'preact/hooks';
import { burst, centerOf } from '../art/Scene';
import { Pet, growthOf } from '../art/Pet';
import { useWander, canWander } from '../art/petbrain';
import { usePetTouch } from '../art/pettouch';
import { BuildArt, MatIcon } from '../art/Build';
import { FurnPic, tileSrc } from '../art/Home';
import { PaintedBg, useArtSwap } from '../art/paintbg';
import { artSrc } from '../art/artmap';
import { say, sfx, newScene } from '../engine/audio';
import { petView, matsLeft, onChange, decoOf, setDeco, buyFurn, isBought, type PetView } from '../engine/store';
import { ROOM_SLOTS, PARK_SLOTS, PARK_W, FURN_BY, optionsFor, DEFAULT_DECO, FULL_SLOTS, yardSlots, YARD_FULL, HOUSE_COLOR, type SlotDef, type Place } from '../data/home';
import { HOME_DECO, PARK_DECO } from '../data/voice';

function useRefresh() {
  const [, force] = useState(0);
  useEffect(() => onChange(() => force(x => x + 1)), []);
}

/** 놓인 가구 (없으면 기본) */
function placed(place: Place, slot: string) {
  const d = decoOf(place);
  return d[slot] ?? (place !== 'park' ? DEFAULT_DECO[slot] : undefined);
}

/** 자리 하나: 놓인 가구 그림, 비었으면 꾸미기 중일 때 '+' 자리 */
function SlotView({ s, id, edit, sel, onTap, dx = 0 }: { s: SlotDef; id?: string; edit: boolean; sel: boolean; onTap: () => void; dx?: number }) {
  if (!id && !edit) return null;
  return (
    <div class={`home-slot ${sel ? 'sel' : ''} ${id ? '' : 'empty'}`} data-slot={s.id} data-furn={id ?? ''}
      style={{ left: s.x + dx, top: s.y, width: s.w, height: s.h }} onPointerDown={(e) => { e.stopPropagation(); onTap(); }}>
      {id ? <svg viewBox={`0 0 ${s.vb[0]} ${s.vb[1]}`} width={s.w} height={s.h} style={{ overflow: 'visible' }}><FurnPic id={id} vb={s.vb} /></svg>
        : <div class="slot-plus">＋<small>{s.name}</small></div>}
    </div>
  );
}

/** 아래 고르기 판 */
function Tray({ place, slot, onClose }: { place: Place; slot: SlotDef; onClose: () => void }) {
  const park = place === 'park';
  const opts = optionsFor(slot.id, park);
  const cur = placed(place, slot.id);
  const left = matsLeft();
  const choose = (id: string, e: any) => {
    const f = FURN_BY[id];
    if (!f.free && !isBought(id)) {
      if (left <= 0) { sfx.boing(); say('재료가 없어! 놀이를 하면 받을 수 있어!'); return; }
      buyFurn(id);
      sfx.drum(); setTimeout(() => sfx.pop(), 200);
    } else sfx.pop();
    const [x, y] = centerOf(e.currentTarget); burst(x, y);
    // 같은 것을 다시 누르면 빼기 (벽지·창문·집 색은 빼지 않음)
    if (cur === id && !FULL_SLOTS.includes(slot.id) && slot.id !== 'window' && !YARD_FULL.includes(slot.id)) setDeco(place, slot.id, null);
    else setDeco(place, slot.id, id);
  };
  return (
    <div class="home-tray slide-up" onPointerDown={e => e.stopPropagation()}>
      <div class="tray-head"><b>{slot.name}</b><span class="tray-mats"><MatIcon size={34} /> {left}</span><button class="iconbtn" style={{ width: 64, height: 64, fontSize: 30 }} onClick={() => { sfx.tap(); onClose(); }}>✕</button></div>
      <div class="tray-list">
        {opts.map(o => {
          const own = o.free || isBought(o.id);
          const on = cur === o.id;
          const full = FULL_SLOTS.includes(slot.id) || YARD_FULL.includes(slot.id);
          const vb: [number, number] = full ? [120, 90] : slot.vb;
          return (
            <button class={`tray-item ${on ? 'on' : ''} ${own ? 'own' : ''}`} data-opt={o.id} data-own={own ? 1 : 0} onClick={(e) => choose(o.id, e)}>
              <svg viewBox={`0 0 ${vb[0]} ${vb[1]}`} width="150" height="110" style={{ overflow: 'visible' }}>
                {YARD_FULL.includes(slot.id) ? <HouseSwatch id={o.id} place={place} /> : full ? <TileSwatch id={o.id} /> : <FurnPic id={o.id} vb={vb} />}
              </svg>
              <span class="tray-name">{o.name}</span>
              {!own && <span class="tray-cost"><MatIcon size={30} />1</span>}
              {on && <span class="tray-on">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 집 색 고르기 칸: 지은 집 그림에 그 색조 */
function HouseSwatch({ id, place }: { id: string; place: Place }) {
  const house = place.startsWith('cat') ? 'cathouse' : 'doghouse';
  const src = artSrc(`build.${house}.complete`);
  const f = HOUSE_COLOR[id] ?? 'none';
  if (!src) return <g style={{ filter: f }}><rect x="20" y="30" width="80" height="55" rx="6" fill="#f4c38a" /><path d="M12 36 L60 4 L108 36 Z" fill="#ff6b4a" /></g>;
  // 집 건물만(방석·밥그릇은 잘라 냄): 완성 그림 위쪽 72%
  const cid = `hs-${house}-${id.replace(':', '-')}`;
  return <g><clipPath id={cid}><rect x="0" y="-20" width="120" height={-14 + 120 * 0.705 + 20} /></clipPath>
    <image href={src} x="0" y="-14" width="120" height="120" style={{ filter: f }} clip-path={`url(#${cid})`} /></g>;
}

/** 벽지·바닥 고르기 칸: 새 무늬 그림, 없으면 예전 무늬 */
function TileSwatch({ id }: { id: string }) {
  const src = tileSrc(id);
  if (!src) return id.startsWith('floor:') ? <rect width="120" height="90" rx="10" fill="#e9b886" /> : <WallSwatch id={id} />;
  return <g><clipPath id={`ts-${id.replace(':', '-')}`}><rect width="120" height="90" rx="10" /></clipPath>
    <image href={src} width="120" height="90" preserveAspectRatio="xMidYMid slice" clip-path={`url(#ts-${id.replace(':', '-')})`} />
    <rect width="120" height="90" rx="10" fill="none" stroke="#00000018" stroke-width="2" /></g>;
}

function WallSwatch({ id }: { id: string }) {
  if (id === 'wall:mint') return <g><rect width="120" height="90" rx="10" fill="#e6fcf5" />{[0, 30, 60, 90].map(x => <rect x={x} y="0" width="15" height="90" fill="#c3fae8" />)}</g>;
  if (id === 'wall:night') return <g><rect width="120" height="90" rx="10" fill="#3b2d6b" />{[[20, 20], [60, 40], [96, 18], [40, 70], [90, 66]].map(([x, y]) => <circle cx={x} cy={y} r="4" fill="#ffe066" />)}</g>;
  return <g><rect width="120" height="90" rx="10" fill="#fff6fa" />{[[20, 20], [60, 20], [100, 20], [40, 50], [80, 50], [20, 78], [60, 78], [100, 78]].map(([x, y]) => <circle cx={x} cy={y} r="7" fill="#ffd6e7" />)}</g>;
}

/** 잠자기·놀기를 번갈아 (누르면 바로 바꿈) */
function useActivity(ms = 9000) {
  const [act, setAct] = useState<'play' | 'sleep'>('play');
  useEffect(() => { const t = setInterval(() => setAct(a => (a === 'play' ? 'sleep' : 'play')), ms); return () => clearInterval(t); }, []);
  return [act, setAct] as const;
}

function Zzz({ low }: { low?: boolean }) { return <div class="zzz" style={low ? { top: '42%', right: '14%' } : undefined}><span>Z</span><span>z</span><span>z</span></div>; }

// =====================================================================
// 집 안
// =====================================================================
export function RoomScreen({ place, onBack }: { place: 'doghouse' | 'cathouse'; onBack: () => void }) {
  useRefresh();
  const [sel, setSel] = useState<string | null>(null);
  const [act, setAct] = useActivity();
  const pet: PetView = petView(place === 'doghouse' ? 'dog' : 'cat');
  useEffect(() => { newScene(); say(HOME_DECO); }, []);
  const wall = placed(place, 'wall') ?? 'wall:dots';
  const floor = placed(place, 'floor') ?? 'floor:wood';
  const wallT = tileSrc(wall), floorT = tileSrc(floor);
  const bed = placed(place, 'bed'), toy = placed(place, 'toy'), rug = placed(place, 'rug');
  const S = (id: string) => ROOM_SLOTS.find(s => s.id === id)!;
  // 자는 곳: 침대 > 깔개 > 바닥 / 노는 곳: 장난감 옆 > 가운데
  const sleepAt = bed ? [S('bed').x + 120, S('bed').y - 30] : rug ? [S('rug').x + 160, S('rug').y - 60] : [430, 470];
  const playAt = toy ? [S('toy').x - 170, S('toy').y - 120] : [560, 420];
  const bowl = placed(place, 'bowl');
  // 새 그림 친구는 방 안을 스스로 돌아다닌다(걷기·달리기·쉬기·밥그릇·장난감), 잘 때는 잠자리로 걸어가 엎드려 잔다
  const live = canWander(pet.id);
  const touch = usePetTouch({ area: { x0: 110, x1: 860, y0: 380, y1: 468 }, onTap: () => tapPet() });
  const w = useWander({
    pet: pet.id, size: 230, mode: act, home: { x: playAt[0], y: playAt[1] }, bed: { x: sleepAt[0], y: sleepAt[1] },
    touch: touch.target,
    area: { x0: 110, x1: 860, y0: 380, y1: 468 },
    spots: [{ x: playAt[0], y: playAt[1] }],
    bowl: bowl ? { x: S('bowl').x, y: S('bowl').y, w: S('bowl').w, h: S('bowl').h } : null,
    grow: 0.6 + 0.4 * growthOf(pet.level, pet.stage),
  });
  const slotSel = sel ? ROOM_SLOTS.find(s => s.id === sel)! : null;
  const tapPet = () => { sfx.tap(); pet.species === 'dog' ? sfx.bark(1) : sfx.meow(); setAct(a => (a === 'play' ? 'sleep' : 'play')); };
  const order = [...ROOM_SLOTS.filter(s => !FULL_SLOTS.includes(s.id) && !s.front), ...ROOM_SLOTS.filter(s => s.front)];
  return (
    <div class="screen" onPointerDown={() => setSel(null)} data-room={place}>
      <div class={`room-wall ${wall.replace(':', '-')}`}>{wallT && <div class="room-tile" style={{ backgroundImage: `url(${wallT})` }} />}</div>
      <div class="room-floor">{floorT && <div class="room-tile floor" style={{ backgroundImage: `url(${floorT})` }} />}</div>
      <div class="layer">
        {order.filter(s => !s.front).map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        <button class="pill home-wall-btn" onPointerDown={(e) => { e.stopPropagation(); sfx.tap(); setSel('wall'); }}>🎨 벽지</button>
        <button class="pill home-floor-btn" onPointerDown={(e) => { e.stopPropagation(); sfx.tap(); setSel('floor'); }}>🪵 바닥</button>
        {order.filter(s => s.front && s.id === 'rug').map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        {order.filter(s => s.front && s.id === 'bed').map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        <div class={`home-pet ${act}`} style={{ left: w.x, top: w.y, ...w.style }} onTransitionEnd={w.onArrive} {...touch.bind} role="button" tabIndex={0} aria-label={`${pet.name}와 놀기`} data-petting={touch.petting ? 1 : 0} data-dragging={touch.dragging ? 1 : 0} data-act={act} data-move={w.act}>
          <Pet pet={pet.id} stage={pet.stage} level={pet.level} wear={pet.wear} size={230} mood={touch.petting ? 'love' : act === 'sleep' ? 'sleep' : 'happy'}
            motion={live ? 'none' : act === 'sleep' ? 'none' : 'jump'} act={live ? w.act : undefined} flip={live ? w.flip : undefined} poke={w.poke} autoTalk={false} />
          {!touch.active && (live ? w.act === 'sleep' : act === 'sleep') && <Zzz low={live} />}
        </div>
        {order.filter(s => s.front && s.id !== 'rug' && s.id !== 'bed').map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
      </div>
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 30 }}>{place === 'doghouse' ? '🐶' : '🐱'} {pet.name}네 집 안</div>
        <div class="pill mat-pill"><MatIcon size={44} /> 재료 {matsLeft()}개</div>
      </div>
      {slotSel && <Tray place={place} slot={slotSel} onClose={() => setSel(null)} />}
    </div>
  );
}

// =====================================================================
// 큰 놀이터 (가로로 밀어서 보기)
// =====================================================================
export function ParkScreen({ onBack }: { onBack: () => void }) {
  useRefresh();
  const [sel, setSel] = useState<string | null>(null);
  const [act, setAct] = useActivity(10000);
  const dog = petView('dog'), cat = petView('cat');
  const scroller = useRef<HTMLDivElement>(null);
  const [art, onReady] = useArtSwap();
  useEffect(() => { newScene(); say(PARK_DECO); }, []);
  const P = (id: string) => placed('park', id);
  const S = (id: string) => PARK_SLOTS.find(s => s.id === id)!;
  const slotSel = sel ? PARK_SLOTS.find(s => s.id === sel)! : null;
  const OFF = 0;
  // 강아지·고양이가 있을 곳과 모습
  type Spot = { x: number; y: number; cls: string; sleep?: boolean };
  const spots = (): [Spot, Spot] => {
    if (act === 'sleep') {
      const at = P('picnic') ? S('picnic') : S('tree');
      const bx = at.x + (P('picnic') ? 40 : 60), by = P('picnic') ? at.y - 120 : 470;
      return [{ x: bx, y: by, cls: 'nap', sleep: true }, { x: bx + 160, y: by + 10, cls: 'nap', sleep: true }];
    }
    // 그네: 의자 위에 앉아 앞뒤로 / 트램펄린: 통통 / 미끄럼틀: 위에서 아래로 쭉 / 회전목마: 들썩들썩
    const d: Spot = P('swing') ? { x: S('swing').x + 88, y: S('swing').y + 92, cls: 'on-swing' }
      : P('tramp') ? { x: S('tramp').x + 50, y: S('tramp').y - 120, cls: 'on-tramp' } : { x: 640, y: 470, cls: 'walk' };
    const c: Spot = P('slide') ? { x: S('slide').x + 36, y: S('slide').y - 34, cls: 'on-slide' }
      : P('carousel') ? { x: S('carousel').x + 100, y: S('carousel').y + 70, cls: 'on-carousel' } : { x: 820, y: 480, cls: 'walk' };
    return [d, c];
  };
  const [sd, sc] = spots();
  const tapPet = (sp: 'dog' | 'cat') => { sfx.tap(); sp === 'dog' ? sfx.bark(1) : sfx.meow(); setAct(a => (a === 'play' ? 'sleep' : 'play')); };
  const PetAt = ({ v, s }: { v: PetView; s: Spot }) => <ParkPet v={v} s={s} off={OFF} onTap={() => tapPet(v.species)} />;
  return (
    <div class="screen" onPointerDown={() => setSel(null)} data-park="1">
      <div class="park-scroll" ref={scroller}>
        <div class="park-world" style={{ width: PARK_W }}>
          {!art && <><div class="park-sky" /><div class="park-hills" /><div class="park-grass" />
          <svg class="park-fence" viewBox={`0 0 ${PARK_W} 60`} width={PARK_W} height="60">{Array.from({ length: Math.floor(PARK_W / 40) }, (_, i) => <path d={`M${i * 40 + 8} 60 V14 l12 -12 12 12 V60`} fill="#fff" stroke="#e9ecef" stroke-width="3" />)}<path d={`M0 30 H${PARK_W} M0 50 H${PARK_W}`} stroke="#e9ecef" stroke-width="6" /></svg></>}
          <div class="park-bg"><PaintedBg scene="park" onReady={onReady} /></div>
          {PARK_SLOTS.filter(s => !s.front).map(s => <SlotView s={s} id={P(s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
          {PetAt({ v: dog, s: sd })}
          {PetAt({ v: cat, s: sc })}
          {PARK_SLOTS.filter(s => s.front).map(s => <SlotView s={s} id={P(s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        </div>
      </div>
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 30 }}>🎠 우리 놀이터</div>
        <div class="pill mat-pill"><MatIcon size={44} /> 재료 {matsLeft()}개</div>
      </div>
      <div class="park-hint pill">👉 옆으로 밀면 더 있어요</div>
      {slotSel && <Tray place="park" slot={slotSel} onClose={() => setSel(null)} />}
    </div>
  );
}

/** 놀이터의 친구 하나: 놀이 기구가 있으면 달려가서 타고, 없으면 놀이터를 돌아다니며 놀고, 낮잠 때는 걸어가서 잔다 */
function ParkPet({ v, s, off, onTap }: { v: PetView; s: { x: number; y: number; cls: string; sleep?: boolean }; off: number; onTap: () => void }) {
  const ride = s.cls !== 'walk' && s.cls !== 'nap';
  const live = canWander(v.id);
  const touch = usePetTouch({ area: { x0: 240, x1: 1160, y0: 420, y1: 505 }, onTap, offsetX: off });
  const w = useWander({
    pet: v.id, size: 170, mode: s.sleep ? 'sleep' : 'play', home: { x: s.x, y: s.y }, bed: { x: s.x, y: s.y },
    touch: touch.target,
    area: { x0: 240, x1: 1160, y0: 420, y1: 505 }, hold: ride ? { x: s.x, y: s.y } : null,
  });
  // 놀이 기구 움직임(그네·트램펄린 등)은 도착한 뒤에
  const arrived = !live || (w.act !== 'walk' && w.act !== 'run' && Math.abs(w.x - s.x) < 2 && Math.abs(w.y - s.y) < 2);
  const cls = touch.active ? '' : ride ? (arrived ? s.cls : '') : live ? '' : s.cls;
  return (
    <div class={`park-pet ${cls}`} style={{ left: w.x + off, top: w.y, ...w.style }} onTransitionEnd={w.onArrive} data-act={s.cls} data-move={w.act} {...touch.bind} role="button" tabIndex={0} aria-label={`${v.name}와 놀기`} data-petting={touch.petting ? 1 : 0} data-dragging={touch.dragging ? 1 : 0}>
      <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={170} mood={touch.petting ? 'love' : s.sleep ? 'sleep' : 'happy'}
        motion={live ? 'none' : s.sleep ? 'none' : s.cls === 'walk' ? 'bob' : 'none'} act={live ? w.act : undefined} flip={live ? w.flip : undefined} poke={w.poke} autoTalk={false} />
      {!touch.active && (live ? w.act === 'sleep' : s.sleep) && <Zzz low={live} />}
    </div>
  );
}

// =====================================================================
// 집 밖 마당 (원문 E) — 장소 'doghouse-out'·'cathouse-out'
// =====================================================================
const yardScene = (house: 'doghouse' | 'cathouse') => (house === 'doghouse' ? 'yard-dog' : 'yard-cat');
/** 집 색(마당 'y-color' 자리) → CSS 필터 */
export const houseFilter = (house: 'doghouse' | 'cathouse') => HOUSE_COLOR[placed(`${house}-out` as Place, 'y-color') ?? 'y-color:base'] ?? 'none';

/** 마당 배경(손그림 마을, 받기 전·없으면 예전 하늘·풀밭) — 집 짓기 화면도 같이 씀 */
export function YardBack({ house }: { house: 'doghouse' | 'cathouse' }) {
  const [art, onReady] = useArtSwap();
  return <div class="backdrop yard">{!art && <><div class="yard-sky" /><div class="yard-grass" /></>}<PaintedBg scene={yardScene(house)} onReady={onReady} /></div>;
}

/** 마당에 놓인 것(누를 수 없음) — 꾸민 마당을 집 짓기 화면에도 보여 준다(원문 E). front: 집 앞에 놓는 것 */
export function YardDeco({ house, front }: { house: 'doghouse' | 'cathouse'; front: boolean }) {
  const place = `${house}-out` as Place;
  return <>{yardSlots(house).filter(sl => !YARD_FULL.includes(sl.id) && !!sl.front === front).map(sl => {
    const id = placed(place, sl.id);
    return id ? <div class="home-slot yard-deco" data-slot={sl.id} style={{ left: sl.x, top: sl.y, width: sl.w, height: sl.h }}>
      <svg viewBox={`0 0 ${sl.vb[0]} ${sl.vb[1]}`} width={sl.w} height={sl.h} style={{ overflow: 'visible' }}><FurnPic id={id} vb={sl.vb} /></svg></div> : null;
  })}</>;
}

export function YardScreen({ house, onBack }: { house: 'doghouse' | 'cathouse'; onBack: () => void }) {
  useRefresh();
  const place = `${house}-out` as Place;
  const [sel, setSel] = useState<string | null>(null);
  const [act, setAct] = useActivity();
  const pet: PetView = petView(house === 'doghouse' ? 'dog' : 'cat');
  useEffect(() => { newScene(); say(HOME_DECO); }, []);
  const slots = yardSlots(house);
  const slotSel = sel ? slots.find(sl => sl.id === sel)! : null;
  // 잠은 집 앞 방석 위에서, 놀 때는 마당 잔디를 돌아다님(집 짓기 화면과 같은 자리라 방석 위치가 같다)
  const bed = house === 'doghouse' ? { x: 418, y: 452 } : { x: 412, y: 482 };
  const live = canWander(pet.id);
  const touch = usePetTouch({ area: { x0: 120, x1: 1050, y0: 548, y1: 612 }, onTap: () => tapPet() });
  const w = useWander({
    pet: pet.id, size: 200, mode: act, home: { x: 560, y: 560 }, bed,
    touch: touch.target,
    area: { x0: 120, x1: 1050, y0: 548, y1: 612 },
    spots: [{ x: 880, y: 560 }, { x: 240, y: 560 }],
    grow: 0.6 + 0.4 * growthOf(pet.level, pet.stage),
  });
  const tapPet = () => { sfx.tap(); pet.species === 'dog' ? sfx.bark(1) : sfx.meow(); setAct(a => (a === 'play' ? 'sleep' : 'play')); };
  const tap = (id: string) => () => { sfx.tap(); setSel(id); };
  return (
    <div class="screen" onPointerDown={() => setSel(null)} data-yard={place}>
      <YardBack house={house} />
      <div class="layer">
        {slots.filter(sl => !sl.front && !YARD_FULL.includes(sl.id)).map(sl => <SlotView s={sl} id={placed(place, sl.id)} edit sel={sel === sl.id} onTap={tap(sl.id)} />)}
        <div class="yard-house" data-color={placed(place, 'y-color') ?? 'y-color:base'}>
          <BuildArt id={house} n={8} next={false} name={pet.name} size={700} tint={houseFilter(house)} />
        </div>
        <button class="pill home-wall-btn" data-yard-color="1" onPointerDown={(e) => { e.stopPropagation(); sfx.tap(); setSel('y-color'); }}>🎨 집 색</button>
        {slots.filter(sl => sl.front && !YARD_FULL.includes(sl.id)).map(sl => <SlotView s={sl} id={placed(place, sl.id)} edit sel={sel === sl.id} onTap={tap(sl.id)} />)}
        <div class={`home-pet ${act}`} style={{ left: w.x, top: w.y, ...w.style }} onTransitionEnd={w.onArrive} {...touch.bind} role="button" tabIndex={0} aria-label={`${pet.name}와 놀기`} data-petting={touch.petting ? 1 : 0} data-dragging={touch.dragging ? 1 : 0} data-act={act} data-move={w.act}>
          <Pet pet={pet.id} stage={pet.stage} level={pet.level} wear={pet.wear} size={200} mood={touch.petting ? 'love' : act === 'sleep' ? 'sleep' : 'happy'}
            motion={live ? 'none' : act === 'sleep' ? 'none' : 'bob'} act={live ? w.act : undefined} flip={live ? w.flip : undefined} poke={w.poke} autoTalk={false} />
          {!touch.active && (live ? w.act === 'sleep' : act === 'sleep') && <Zzz low={live} />}
        </div>
      </div>
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 30 }}>{house === 'doghouse' ? '🐶' : '🐱'} {pet.name}네 마당</div>
        <div class="pill mat-pill"><MatIcon size={44} /> 재료 {matsLeft()}개</div>
      </div>
      {slotSel && <Tray place={place} slot={slotSel} onClose={() => setSel(null)} />}
    </div>
  );
}
