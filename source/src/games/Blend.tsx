// 글자 합치기: 자음 + 모음 (+ 받침) → 음절
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, toSafe } from '../art/Scene';
import { JAMO } from '../data/jamo';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { compose, vowelShape } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, praise, Dots, Speaker, spoken, gentle, useTurn, type GameProps, penalty } from './common';

type Part = 'cho' | 'jung' | 'jong';
interface Box { x: number; y: number; w: number; h: number }
const BX = 450, BY = 150, BS = 380;
const TS = 104;

const LAYOUT: Record<string, Partial<Record<Part, Box>>> = {
  V: { cho: { x: 30, y: 90, w: 150, h: 150 }, jung: { x: 200, y: 40, w: 150, h: 250 } },
  H: { cho: { x: 115, y: 25, w: 150, h: 150 }, jung: { x: 40, y: 200, w: 300, h: 150 } },
  VB: { cho: { x: 30, y: 20, w: 150, h: 150 }, jung: { x: 200, y: 20, w: 150, h: 150 }, jong: { x: 115, y: 205, w: 150, h: 150 } },
  HB: { cho: { x: 115, y: 14, w: 150, h: 110 }, jung: { x: 40, y: 130, w: 300, h: 100 }, jong: { x: 115, y: 240, w: 150, h: 125 } },
};

interface Tile { id: number; ch: string; part: Part; x: number; y: number; placed: boolean; drag: boolean; bad: boolean }

const BLEND_GENTLE = ['괜찮아~ 다른 글자를 넣어 보자!', '괜찮아, 다시 들어 보고 골라 볼까?'];

export function Blend({ step, onDone, outfit }: GameProps<'blend'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [merged, setMerged] = useState(false);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const busy = useRef(true);
  const miss = useRef(0);
  const turn = useTurn();
  const drag = useRef<{ id: number; dx: number; dy: number; sx: number; sy: number } | null>(null);

  const r = step.rounds[ri];
  const syl = compose(r.cho, r.jung, r.jong ?? '');
  const shape = (vowelShape(r.jung) === 'H' ? 'H' : 'V') + (r.jong ? 'B' : '');
  const lay = LAYOUT[shape];
  const parts: Part[] = r.jong ? ['cho', 'jung', 'jong'] : ['cho', 'jung'];
  const want = (p: Part) => (p === 'cho' ? r.cho : p === 'jung' ? r.jung : r.jong!);

  const slotAbs = (p: Part) => { const b = lay[p]!; return { x: BX + b.x, y: BY + b.y, w: b.w, h: b.h }; };

  // 만들 글자는 화면에 안 보이고 소리로만 (🔊로 다시 듣기)
  const [ping, setPing] = useState(0);
  const hear = () => { setPing(x => x + 1); return say(syl); };
  const ask = async () => { const my = turn.n; await say('소리를 잘 듣고 글자를 만들어 봐!'); if (!alive() || !turn.mine(my)) return; await hear(); };

  useEffect(() => {
    // 타일 깔기
    const groups: [Part, string[]][] = [['cho', r.choOpts], ['jung', r.jungOpts]];
    if (r.jong && r.jongOpts) groups.push(['jong', r.jongOpts]);
    const T = TS, G = 12, GG = 44;
    const totalW = groups.reduce((a, [, o]) => a + o.length * T + (o.length - 1) * G, 0) + GG * (groups.length - 1);
    let x = 200 + (1070 - totalW) / 2;
    const list: Tile[] = [];
    let id = 0;
    for (const [part, opts] of groups) {
      for (const ch of opts) { list.push({ id: id++, ch, part, x, y: 610, placed: false, drag: false, bad: false }); x += T + G; }
      x += GG - G;
    }
    setTiles(list); setMerged(false); miss.current = 0; busy.current = true;
    (async () => {
      if (!await sleep(300)) return;
      if (r.demo) {
        await say(r.jong ? '받침까지 셋을 합쳐 보자!' : '두 친구를 합쳐 보자!');
        for (const p of parts) {
          if (!alive()) return;
          const t = list.find(t => t.part === p && t.ch === want(p))!;
          placeTile(t.id, p);
          await say(spoken(want(p)));
          if (!await sleep(250)) return;
        }
        await doMerge(true);
      } else {
        busy.current = false;          // 말하는 중에도 바로 옮길 수 있게
        ask();
      }
    })();
  }, [ri]);

  const placeTile = (id: number, p: Part) => {
    sfx.pop();
    setTiles(ts => ts.map(t => t.id === id ? { ...t, placed: true, drag: false, x: slotAbs(p).x + slotAbs(p).w / 2 - TS / 2, y: slotAbs(p).y + slotAbs(p).h / 2 - TS / 2 } : t));
  };

  const doMerge = async (demo = false) => {
    busy.current = true;
    if (!await sleep(350)) return;
    setMerged(true);
    sfx.sparkle();
    burst(BX + BS / 2, BY + BS / 2);
    setMood('wow');
    const cs = JAMO[r.cho]?.sound;
    const base = compose(r.cho, r.jung);
    await sayAll(r.jong ? [base, `${spoken(r.jong)} 받침`, syl] : [...(cs ? [cs] : []), JAMO[r.jung].sound, syl], 380);
    if (!alive()) return;
    if (!demo) {
      record('j:' + r.cho, miss.current === 0);
      if (r.jong) record('b:' + r.jong, miss.current === 0);
      await praise();
    } else {
      await say('이번엔 네가 해 봐!');
    }
    if (!alive()) return;
    setMood('happy');
    if (!await sleep(400)) return;
    if (ri + 1 >= step.rounds.length) { sfx.fanfare(); onDone(); }
    else setRi(ri + 1);
  };

  const reject = async (t: Tile) => {
    miss.current++;
    const my = turn.take();
    sfx.boing(); penalty(); setMood('think');
    setTiles(ts => ts.map(o => o.id === t.id ? { ...o, bad: true, drag: false, x: (o as any).hx ?? o.x, y: 610 } : o));
    setTimeout(() => { setTiles(ts => ts.map(o => o.id === t.id ? { ...o, bad: false } : o)); setMood('happy'); }, 500);
    // 그동안에도 다른 글자를 바로 옮길 수 있음
    await say(spoken(t.ch)); if (!alive() || !turn.mine(my)) return;
    await gentle(BLEND_GENTLE); if (!alive() || !turn.mine(my)) return;
    hear();
  };

  const tryPlace = (t: Tile) => {
    if (t.ch === want(t.part) && !tiles.some(o => o.placed && o.part === t.part)) {
      turn.take();
      placeTile(t.id, t.part);
      say(spoken(t.ch));
      const placedParts = new Set([...tiles.filter(o => o.placed).map(o => o.part), t.part]);
      if (parts.every(p => placedParts.has(p))) doMerge();
      return true;
    }
    reject(t);
    return false;
  };

  const stageXY = (e: PointerEvent) => toSafe(e.clientX, e.clientY);

  const down = (t: Tile, e: PointerEvent) => {
    if (busy.current || t.placed) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = stageXY(e);
    drag.current = { id: t.id, dx: x - t.x, dy: y - t.y, sx: x, sy: y };
    (t as any).hx = t.x;
    setTiles(ts => ts.map(o => o.id === t.id ? { ...o, drag: true, hx: o.x } as any : o));
    sfx.tap();
  };
  const move = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    const [x, y] = stageXY(e);
    setTiles(ts => ts.map(o => o.id === d.id ? { ...o, x: x - d.dx, y: y - d.dy } : o));
  };
  const up = (e: PointerEvent) => {
    const d = drag.current; if (!d) return;
    drag.current = null;
    const [x, y] = stageXY(e);
    const t = tiles.find(o => o.id === d.id)!;
    const moved = Math.hypot(x - d.sx, y - d.sy);
    const inBlock = x > BX - 40 && x < BX + BS + 40 && y > BY - 40 && y < BY + BS + 40;
    if (moved < 14 || inBlock) tryPlace({ ...t, hx: (t as any).hx } as any);
    else setTiles(ts => ts.map(o => o.id === d.id ? { ...o, drag: false, x: (o as any).hx, y: 610 } : o));
  };

  const color = (p: Part) => p === 'cho' ? '#1c7ed6' : p === 'jung' ? '#e64980' : '#7048e8';

  return (
    <div class="screen" onPointerMove={move as any} onPointerUp={up as any}>
      <Backdrop theme="meadow" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.rounds.length} done={ri} /></div>
        <div class="prompt" style={{ top: 18, left: 'auto', right: 30, transform: 'none', padding: '10px 12px 10px 28px' }} data-target={syl}>
          <span key={ping} class="ear-ping" style={{ fontSize: 44 }}>👂</span><span style={{ fontSize: 34 }}>들은 글자 만들기</span>
          <Speaker onClick={hear} />
        </div>
        {/* 글자 상자 */}
        <div class="block" style={{ left: BX, top: BY, width: BS, height: BS }}>
          {!merged && parts.map(p => {
            const b = lay[p]!;
            const filled = tiles.some(t => t.placed && t.part === p);
            return <div class={`slot ${filled ? 'filled' : ''}`} style={{ left: b.x, top: b.y, width: b.w, height: b.h, borderColor: filled ? undefined : color(p) + '66' }} />;
          })}
          {merged && <div class="glyph-bounce" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 300, color: '#5a3d73', lineHeight: 1 }}>{syl}</div>}
        </div>
        {/* 공식 */}
        <div style={{ position: 'absolute', left: BX + BS + 30, top: BY + 120, fontSize: 60, color: '#7a5b8f', display: 'flex', gap: 10, alignItems: 'center' }}>
          {merged && <span class="slide-up" style={{ background: '#fff', borderRadius: 24, padding: '8px 22px', boxShadow: 'var(--shadow)' }}>
            <b style={{ color: '#1c7ed6', fontWeight: 'normal' }}>{r.cho}</b>+<b style={{ color: '#e64980', fontWeight: 'normal' }}>{r.jung}</b>{r.jong && <>+<b style={{ color: '#7048e8', fontWeight: 'normal' }}>{r.jong}</b></>}
          </span>}
        </div>
        {tiles.map(t => (
          <div class={`tile ${t.part === 'cho' ? 'c' : t.part === 'jung' ? 'v' : 'b'} ${t.drag ? 'dragging' : ''} ${t.bad ? 'shake' : ''} ${merged && t.placed ? 'gone' : ''}`}
            style={{ left: t.x, top: t.y, width: TS, height: TS, transition: t.drag ? 'none' : 'left .3s, top .3s, transform .2s, opacity .3s', background: t.placed ? 'transparent' : '#fff', boxShadow: t.placed ? 'none' : undefined, fontSize: t.placed ? (t.part === 'jung' && shape.startsWith('H') ? 100 : 84) : 70 }}
            data-a={!t.placed && t.ch === want(t.part) ? 1 : 0} onPointerDown={(e) => down(t, e as any)}>
            {t.ch}
          </div>
        ))}
        <Buddies size={144} style={{ bottom: 190 }} mood={mood} motion={merged ? 'jump' : 'bob'} />
      </div>
    </div>
  );
}
