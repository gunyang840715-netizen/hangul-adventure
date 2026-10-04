// 우리 집(간식 먹이며 키우기), 옷장(꾸미기), 친구 고르기(강아지 5종·고양이 5종)
import { useEffect, useRef, useState } from 'preact/hooks';
import { burst, centerOf, toSafe } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { say, sayAll, sfx, newScene } from '../engine/audio';
import { buddy } from '../engine/bus';
import {
  load, petView, petInfo, feed, snackCount, choosePet, setLead, setWear, onChange, matsLeft, type PetView,
} from '../engine/store';
import { PETS, SNACKS, SNACK, SLOTS, SLOT_NAME, SLOT_ICON, ITEM_LIST, ITEM, STAGE_NAME, levelProgress, stageOf, itemFits, MAX_LEVEL, type Species, type Slot } from '../data/pets';
import { helloLine, breedLine, dressLine, growLine, stageLine } from '../data/voice';

function Room() {
  return (
    <div class="backdrop room">
      <div class="room-wall" />
      <div class="room-floor" />
    </div>
  );
}

function useRefresh() {
  const [, force] = useState(0);
  useEffect(() => onChange(() => force(x => x + 1)), []);
}

/** 성장 막대 */
function Growth({ v }: { v: PetView }) {
  const pr = levelProgress(v.points);
  return (
    <div class="grow-card">
      <div class="grow-name">{v.breed} <b>{v.name}</b></div>
      <div class="grow-lv">Lv.{v.level} · {STAGE_NAME[v.stage]}</div>
      <div class="grow-bar"><i style={{ width: `${v.level >= MAX_LEVEL ? 100 : Math.round(pr * 100)}%` }} /></div>
    </div>
  );
}

// =====================================================================
// 우리 집
// =====================================================================
export function House({ onBack, onDress, onAdopt, onBuild }: { onBack: () => void; onDress: () => void; onAdopt: () => void; onBuild: () => void }) {
  useRefresh();
  const s = load();
  const dog = petView('dog'), cat = petView('cat');
  const [sel, setSel] = useState<Species>(s.lead);
  const [fly, setFly] = useState<{ id: string; from: [number, number]; to: [number, number]; go: boolean; k: number } | null>(null);
  const [eating, setEating] = useState<Species | null>(null);
  const [bub, setBub] = useState<{ who: Species; text: string } | null>(null);
  const [grow, setGrow] = useState<{ v: PetView; stageUp: boolean } | null>(null);
  const busy = useRef(false);
  const POS: Record<Species, { left: number; top: number; size: number }> = { dog: { left: 150, top: 250, size: 300 }, cat: { left: 610, top: 270, size: 280 } };

  useEffect(() => { newScene(); say('우리 집이야! 간식을 누르면 먹여 줄 수 있어.'); }, []);

  const talk = (who: Species, text: string) => { setBub({ who, text }); setTimeout(() => setBub(b => (b && b.text === text ? null : b)), 1600); };

  const tapPet = (sp: Species, e: any) => {
    sfx.pop(); const [x, y] = centerOf(e.currentTarget); burst(x, y - 60);
    setSel(sp); setLead(sp);
    const v = sp === 'dog' ? dog : cat;
    sp === 'dog' ? sfx.bark(1) : sfx.meow();
    talk(sp, sp === 'dog' ? '멍멍!' : '야옹~');
    say(helloLine(v.name));
  };

  const giveSnack = async (id: string, e: any) => {
    if (busy.current) return;
    if (snackCount(id) <= 0) { sfx.boing(); say('간식이 없어! 놀이를 하면 받을 수 있어!'); return; }
    const sn = SNACK[id];
    // 먹을 수 있는 친구에게 (둘 다 먹는 간식은 고른 친구에게)
    let who: Species = sn.for === 'both' ? sel : sn.for;
    if (sn.for !== 'both' && sn.for !== sel) talk(sel, sn.for === 'dog' ? '강아지 간식이네!' : '고양이 간식이네!');
    const v = who === 'dog' ? dog : cat;
    busy.current = true;
    const r = e.currentTarget.getBoundingClientRect();
    const from = toSafe(r.left + r.width / 2, r.top + r.height / 2);
    const P = POS[who];
    const to: [number, number] = [P.left + P.size / 2, P.top + P.size * 0.62];
    sfx.whoosh();
    setFly({ id, from, to, go: false, k: Date.now() });
    requestAnimationFrame(() => requestAnimationFrame(() => setFly(f => f && { ...f, go: true })));
    await new Promise(res => setTimeout(res, 560));
    setFly(null);
    const res = feed(v.id, id);
    busy.current = false;
    if (!res) return;
    sfx.pop(); burst(...to);
    setEating(who); setTimeout(() => setEating(null), 1300);
    who === 'dog' ? sfx.bark(1) : sfx.meow();
    talk(who, sn.points > 1 ? '제일 좋아! 냠냠!' : '냠냠!');
    buddy({ t: 'eat', who });
    if (res.after > res.before) {
      const nv = petInfo(v.id);
      const stageUp = stageOf(res.after) !== stageOf(res.before);
      setTimeout(() => {
        setGrow({ v: nv, stageUp });
        sfx.fanfare(); burst(640, 300, 'confetti');
        sayAll(stageUp ? [growLine(nv.name), stageLine(nv.name, nv.stage === 'adult' ? 'adult' : 'kid')] : [growLine(nv.name)]);
      }, 700);
    } else {
      say('냠냠! 맛있다!');
    }
  };

  const Card = ({ v, sp }: { v: PetView; sp: Species }) => {
    const P = POS[sp];
    return (
      <div style={{ position: 'absolute', left: P.left, top: P.top - 130, width: P.size, display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Growth v={v} />
          {s.lead === sp && <div class="lead-badge">👑 주인공</div>}
        </div>
      </div>
    );
  };

  return (
    <div class="screen">
      <Room />
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🗺️</button>
        <div class="pill" style={{ fontSize: 32 }}>🏠 우리 집</div>
      </div>
      <div class="layer">
        {/* 창문 */}
        <div class="room-window" style={{ left: 1010, top: 110 }}><div class="sun" style={{ position: 'absolute', left: 120, top: 18, width: 60, height: 60 }} /></div>
        <div class="room-rug" />
        {(['dog', 'cat'] as const).map(sp => {
          const v = sp === 'dog' ? dog : cat;
          const P = POS[sp];
          return (
            <>
              <Card v={v} sp={sp} />
              <div class={`house-pet ${sel === sp ? 'sel' : ''}`} data-house-pet={sp} style={{ left: P.left, top: P.top, width: P.size, height: P.size }} onClick={(e) => tapPet(sp, e)}>
                <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={P.size} mood={eating === sp ? 'love' : 'happy'} motion={eating === sp ? 'jump' : 'bob'} autoTalk={s.lead === sp} />
                {bub?.who === sp && <div class="bd-bubble" style={{ bottom: '92%' }}>{bub.text}</div>}
              </div>
            </>
          );
        })}
        {/* 오른쪽 단추 */}
        <div style={{ position: 'absolute', left: 1000, top: 330, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <button class="btn yellow" style={{ fontSize: 34, padding: '16px 26px' }} onClick={() => { sfx.tap(); onDress(); }}>👗 꾸미기</button>
          <button class="btn mint" style={{ fontSize: 34, padding: '16px 26px' }} onClick={() => { sfx.tap(); onAdopt(); }}>🐾 친구 고르기</button>
          <button class="btn violet" style={{ fontSize: 34, padding: '16px 26px' }} data-go-build="1" onClick={() => { sfx.tap(); onBuild(); }}>🔨 집 짓기{matsLeft() > 0 ? ` (${matsLeft()})` : ''}</button>
        </div>
        {/* 간식 바구니 */}
        <div class="snack-tray">
          {SNACKS.map(sn => {
            const n = snackCount(sn.id);
            return (
              <button class={`snack-slot ${n ? '' : 'empty'}`} data-snack={sn.id} data-n={n} onClick={(e) => giveSnack(sn.id, e)}>
                <SnackIcon id={sn.id} size={78} />
                <span class="snack-n">{n}</span>
                <span class="snack-for">{sn.for === 'dog' ? '🐶' : sn.for === 'cat' ? '🐱' : '🐶🐱'}</span>
              </button>
            );
          })}
        </div>
        {fly && (
          <div class="snack-fly" style={{ left: (fly.go ? fly.to : fly.from)[0] - 40, top: (fly.go ? fly.to : fly.from)[1] - 40, transform: fly.go ? 'scale(.5)' : 'scale(1)' }}>
            <SnackIcon id={fly.id} size={80} />
          </div>
        )}
      </div>
      {grow && (
        <div class="overlay fade-in" style={{ background: 'rgba(60,30,90,.45)', zIndex: 40 }} onClick={() => { sfx.tap(); setGrow(null); }}>
          <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div class="card slide-up" style={{ padding: '30px 50px', gap: 40 }} data-grow="1">
              <Pet pet={grow.v.id} stage={grow.v.stage} level={grow.v.level} wear={grow.v.wear} size={330} motion="cheer" mood="love" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: 60, color: '#e0488a' }}>쑥쑥 컸어!</div>
                <div class="pill" style={{ fontSize: 40 }}>Lv.{grow.v.level}</div>
                {grow.stageUp && <div style={{ fontSize: 40, color: '#7048e8' }}>{grow.v.stage === 'adult' ? '어른이' : '어린이가'} 됐어요!</div>}
                <button class="btn big">좋아! ▶</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 옷장: 친구를 골라 모자·옷·안경·목걸이·신발·장난감 입히기
// =====================================================================
export function Dress({ onBack }: { onBack: () => void }) {
  useRefresh();
  const s = load();
  const [sp, setSp] = useState<Species>(s.lead);
  const [slot, setSlot] = useState<Slot>('hat');
  const v = petView(sp);
  useEffect(() => { newScene(); say(dressLine(v.name)); }, []);
  // 고른 친구에게 맞는 것만 (강아지용 · 고양이용 · 둘 다)
  const items = ITEM_LIST.filter(i => i.slot === slot && itemFits(i, sp));
  const mine = ITEM_LIST.filter(i => itemFits(i, sp));
  const owned = (id: string) => s.owned.includes(id);
  const choose = (id: string, e: any) => {
    if (!owned(id)) { sfx.boing(); say('모험을 하면 선물로 받을 수 있어!'); return; }
    const it = ITEM[id];
    sfx.pop(); const [x, y] = centerOf(e.currentTarget); burst(x, y);
    const on = v.wear[slot] === it.key;
    setWear(v.id, { ...v.wear, [slot]: on ? undefined : it.key });
    if (!on) say(it.name);
  };
  const pickPet = (x: Species) => {
    if (x === sp) return;
    sfx.tap(); setSp(x); setLead(x);
    say(dressLine(petView(x).name));
  };
  return (
    <div class="screen">
      <Room />
      <div class="topbar"><button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button></div>
      <div class="layer">
        <div style={{ position: 'absolute', left: 60, top: 110, display: 'flex', gap: 14 }}>
          {(['dog', 'cat'] as const).map(x => (
            <button class={`btn small ${sp === x ? 'violet' : 'yellow'}`} data-dress-pet={x} onClick={() => pickPet(x)}>{x === 'dog' ? '🐶' : '🐱'} {petView(x).name}</button>
          ))}
        </div>
        <div key={v.id} class="slide-up" style={{ position: 'absolute', left: 50, top: 220 }}>
          <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={440} motion="bob" />
        </div>
        <div style={{ position: 'absolute', left: 530, top: 110, right: 20, display: 'flex', gap: 8 }}>
          {SLOTS.map(k => (
            <button class={`btn small ${slot === k ? 'violet' : 'yellow'}`} style={{ padding: '10px 12px', fontSize: 23, gap: 4 }} data-slot={k} onClick={() => { sfx.tap(); setSlot(k); }}>
              {SLOT_ICON[k]} {SLOT_NAME[k]}
            </button>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 540, top: 200, display: 'grid', gridTemplateColumns: 'repeat(4, 160px)', gap: 16 }}>
          {items.map(it => {
            const has = owned(it.id);
            const on = v.wear[slot] === it.key;
            return (
              <button class="card wardrobe-cell" data-item={it.id} data-owned={has ? 1 : 0} style={{ width: 160, height: 160, flexDirection: 'column', outline: on ? '6px solid #ffd43b' : undefined, background: has ? '#fff' : '#efe7f7' }} onClick={(e) => choose(it.id, e)}>
                {has ? <ItemIcon id={it.id} size={104} /> : <div style={{ fontSize: 70, color: '#c5b5d6', lineHeight: '104px' }}>?</div>}
                <div style={{ fontSize: 19 }}>{has ? it.name : '???'}</div>
                {it.for !== 'both' && <span class="item-for">{it.for === 'dog' ? '🐶' : '🐱'}</span>}
              </button>
            );
          })}
        </div>
        <div class="pill" style={{ position: 'absolute', left: 540, top: 730, fontSize: 22 }}>{sp === 'dog' ? '🐶 강아지' : '🐱 고양이'} 선물 {mine.filter(i => s.owned.includes(i.id)).length}/{mine.length} · 놀이를 하면 새 선물이 와요</div>
      </div>
    </div>
  );
}

// =====================================================================
// 친구 고르기: 강아지 5종 · 고양이 5종
// =====================================================================
export function Adopt({ onBack }: { onBack: () => void }) {
  useRefresh();
  const s = load();
  const [jump, setJump] = useState<string | null>(null);
  useEffect(() => { newScene(); say('같이 놀 친구를 골라 봐!'); }, []);
  const pick = (id: string, e: any) => {
    const d = PETS.find(p => p.id === id)!;
    sfx.pop(); const [x, y] = centerOf(e.currentTarget); burst(x, y);
    choosePet(id);
    setJump(id); setTimeout(() => setJump(j => (j === id ? null : j)), 1400);
    d.species === 'dog' ? sfx.bark(2) : sfx.meow();
    sayAll([breedLine(d.breed, d.name), d.about]);
  };
  return (
    <div class="screen">
      <Room />
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 30 }}>🐾 같이 놀 친구를 골라요</div>
      </div>
      <div class="layer">
        {(['dog', 'cat'] as const).map((sp, row) => (
          <div style={{ position: 'absolute', left: 30, right: 30, top: 110 + row * 340, display: 'flex', justifyContent: 'center', gap: 14 }}>
            {PETS.filter(p => p.species === sp).map(p => {
              const info = petInfo(p.id);
              const chosen = (sp === 'dog' ? s.dog : s.cat) === p.id;
              return (
                <button class={`card adopt-card ${chosen ? 'chosen' : ''}`} data-adopt={p.id} onClick={(e) => pick(p.id, e)}>
                  {chosen && <div class="adopt-tag">❤ 함께해요</div>}
                  <Pet pet={p.id} stage={info.stage} level={info.level} wear={info.wear} size={196} motion={jump === p.id ? 'jump' : 'none'} autoTalk={false} />
                  <div style={{ fontSize: 30, color: '#5a3d73' }}>{p.name}</div>
                  <div style={{ fontSize: 18, color: '#8a6aa0' }}>{p.breed} · Lv.{info.level}</div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
