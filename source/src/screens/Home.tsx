// 집 안 꾸미기(강아지 집·고양이 집) · 큰 놀이터 꾸미기
// - 자리를 누르면 아래에 고를 수 있는 가구·기구가 나옴. 처음 고를 때 재료 1개(한 번 사면 계속 바꿔 놓기)
// - 강아지·고양이가 침대에서 자거나 장난감으로 놀고, 놀이터에서는 그네·미끄럼틀·트램펄린을 타거나 돗자리에서 낮잠
import { useEffect, useRef, useState } from 'preact/hooks';
import { burst, centerOf } from '../art/Scene';
import { Pet } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { FurnArt } from '../art/Home';
import { say, sfx, newScene } from '../engine/audio';
import { petView, matsLeft, onChange, decoOf, setDeco, buyFurn, isBought, type PetView } from '../engine/store';
import { ROOM_SLOTS, PARK_SLOTS, PARK_W, FURN_BY, optionsFor, DEFAULT_DECO, type SlotDef, type Place } from '../data/home';
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
      {id ? <svg viewBox={`0 0 ${s.vb[0]} ${s.vb[1]}`} width={s.w} height={s.h} style={{ overflow: 'visible' }}><FurnArt id={id} /></svg>
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
    // 같은 것을 다시 누르면 빼기 (벽지·창문은 빼지 않음)
    if (cur === id && slot.id !== 'wall' && slot.id !== 'window') setDeco(place, slot.id, null);
    else setDeco(place, slot.id, id);
  };
  return (
    <div class="home-tray slide-up" onPointerDown={e => e.stopPropagation()}>
      <div class="tray-head"><b>{slot.name}</b><span class="tray-mats"><MatIcon size={34} /> {left}</span><button class="iconbtn" style={{ width: 64, height: 64, fontSize: 30 }} onClick={() => { sfx.tap(); onClose(); }}>✕</button></div>
      <div class="tray-list">
        {opts.map(o => {
          const own = o.free || isBought(o.id);
          const on = cur === o.id;
          const vb = slot.id === 'wall' ? [120, 90] : slot.vb;
          return (
            <button class={`tray-item ${on ? 'on' : ''} ${own ? 'own' : ''}`} data-opt={o.id} data-own={own ? 1 : 0} onClick={(e) => choose(o.id, e)}>
              <svg viewBox={`0 0 ${vb[0]} ${vb[1]}`} width="150" height="110" style={{ overflow: 'visible' }}>
                {slot.id === 'wall' ? <WallSwatch id={o.id} /> : <FurnArt id={o.id} />}
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

function Zzz() { return <div class="zzz"><span>Z</span><span>z</span><span>z</span></div>; }

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
  const bed = placed(place, 'bed'), toy = placed(place, 'toy'), rug = placed(place, 'rug');
  const S = (id: string) => ROOM_SLOTS.find(s => s.id === id)!;
  // 자는 곳: 침대 > 깔개 > 바닥 / 노는 곳: 장난감 옆 > 가운데
  const sleepAt = bed ? [S('bed').x + 120, S('bed').y - 30] : rug ? [S('rug').x + 160, S('rug').y - 60] : [430, 470];
  const playAt = toy ? [S('toy').x - 170, S('toy').y - 120] : [560, 420];
  const [px, py] = act === 'sleep' ? sleepAt : playAt;
  const slotSel = sel ? ROOM_SLOTS.find(s => s.id === sel)! : null;
  const tapPet = () => { sfx.tap(); pet.species === 'dog' ? sfx.bark(1) : sfx.meow(); setAct(a => (a === 'play' ? 'sleep' : 'play')); };
  const order = [...ROOM_SLOTS.filter(s => s.id !== 'wall' && !s.front), ...ROOM_SLOTS.filter(s => s.front)];
  return (
    <div class="screen" onPointerDown={() => setSel(null)} data-room={place}>
      <div class={`room-wall ${wall.replace(':', '-')}`} />
      <div class="room-floor" />
      <div class="layer">
        {order.filter(s => !s.front).map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        <button class="pill home-wall-btn" onPointerDown={(e) => { e.stopPropagation(); sfx.tap(); setSel('wall'); }}>🎨 벽지</button>
        {order.filter(s => s.front && s.id === 'rug').map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        {order.filter(s => s.front && s.id === 'bed').map(s => <SlotView s={s} id={placed(place, s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
        <div class={`home-pet ${act}`} style={{ left: px, top: py }} onPointerDown={(e) => { e.stopPropagation(); tapPet(); }} data-act={act}>
          <Pet pet={pet.id} stage={pet.stage} level={pet.level} wear={pet.wear} size={230} mood={act === 'sleep' ? 'sleep' : 'happy'} motion={act === 'sleep' ? 'none' : 'jump'} autoTalk={false} />
          {act === 'sleep' && <Zzz />}
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
  const PetAt = ({ v, s }: { v: PetView; s: Spot }) => (
    <div class={`park-pet ${s.cls}`} style={{ left: s.x + OFF, top: s.y }} data-act={s.cls} onPointerDown={(e) => { e.stopPropagation(); tapPet(v.species); }}>
      <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={170} mood={s.sleep ? 'sleep' : 'happy'} motion={s.sleep ? 'none' : s.cls === 'walk' ? 'bob' : 'none'} autoTalk={false} />
      {s.sleep && <Zzz />}
    </div>
  );
  return (
    <div class="screen" onPointerDown={() => setSel(null)} data-park="1">
      <div class="park-scroll" ref={scroller}>
        <div class="park-world" style={{ width: PARK_W }}>
          <div class="park-sky" /><div class="park-hills" /><div class="park-grass" />
          <svg class="park-fence" viewBox={`0 0 ${PARK_W} 60`} width={PARK_W} height="60">{Array.from({ length: Math.floor(PARK_W / 40) }, (_, i) => <path d={`M${i * 40 + 8} 60 V14 l12 -12 12 12 V60`} fill="#fff" stroke="#e9ecef" stroke-width="3" />)}<path d={`M0 30 H${PARK_W} M0 50 H${PARK_W}`} stroke="#e9ecef" stroke-width="6" /></svg>
          {PARK_SLOTS.filter(s => !s.front).map(s => <SlotView s={s} id={P(s.id)} edit sel={sel === s.id} onTap={() => { sfx.tap(); setSel(s.id); }} />)}
          <PetAt v={dog} s={sd} />
          <PetAt v={cat} s={sc} />
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

