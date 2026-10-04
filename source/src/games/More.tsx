// 새 놀이: 숨은 글자 찾기, 두더지 잡기, 짝 맞추기, 먹이 주기
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { Pet } from '../art/Pet';
import { hungryLine } from '../data/voice';
import { buddy } from '../engine/bus';
import { LetterGlyph } from '../art/LetterGlyph';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { decompose, hasHangul } from '../lib/hangul';
import { JAMO } from '../data/jamo';
import { Buddies, pair } from './Buddies';
import { useScene, praise, spoken, cue, sayCue, spread, CUE_GAP, Dots, Speaker, gentle, useTurn, type GameProps, penalty } from './common';
import { askLines } from '../data/voice';

const idFor = (x: string, bat?: boolean) => bat ? 'b:' + x : JAMO[x] ? 'j:' + x : 'j:' + (decompose(x)?.cho ?? x);

// =====================================================================
// 숨은 글자 찾기: 문제를 하나씩 듣고 ("아가 들어간 글자를 찾아 줘!") 그 글자가 들어간 카드 누르기
// =====================================================================
const hasPart = (card: string, t: string, bat?: boolean) => {
  const p = decompose(card);
  if (!p) return card === t;
  if (bat) return p.jong === t;
  return p.cho === t || p.jung === t || p.jong === t || (PARTS_OF[p.jung] ?? []).includes(t) || (PARTS_OF[p.cho] ?? []).includes(t);
};
const PARTS_OF: Record<string, string[]> = {
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'], 'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'],
};

export function Hunt({ step, onDone }: GameProps<'hunt'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [found, setFound] = useState<number[]>([]);
  const [bad, setBad] = useState<number | null>(null);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [hint, setHint] = useState<number | null>(null);
  const [qi, setQi] = useState(0);
  const lock = useRef(true);
  const miss = useRef(0);
  const r = step.rounds[ri];
  // 이번 판 문제 순서: 목표마다 숨은 카드 수만큼, 같은 글자가 연달아 나오지 않게
  const queue = useRef<string[]>([]);
  const target = queue.current[qi];
  const kind = step.bat ? 'bat' : 'hunt';
  const [ping, setPing] = useState(0);
  const hear = () => { setPing(x => x + 1); return sayAll(askLines(queue.current[qiRef.current], kind), CUE_GAP); };
  const qiRef = useRef(0);

  const turn = useTurn();
  useEffect(() => {
    setFound([]); setHint(null); miss.current = 0; lock.current = false;   // 말하는 중에도 바로 누를 수 있게
    const per: string[] = [];
    step.targets.forEach(t => r.cards.forEach(c => { if (r.hits.includes(c) && hasPart(c, t, step.bat)) per.push(t); }));
    // 한 카드에 두 목표가 다 들어 있으면 한 번만 세도록 카드 수에 맞춤
    queue.current = spread(per).slice(0, r.hits.length);
    qiRef.current = 0; setQi(0);
    if (!queue.current.length) {   // 만들 수 있는 문제가 없으면 이 판은 건너뜀
      if (ri + 1 < step.rounds.length) setRi(ri + 1); else onDone();
      return;
    }
    (async () => {
      const my = turn.n;
      if (!await sleep(250) || !turn.mine(my)) return;
      if (ri === 0) await say('글자 카드를 잘 보고, 문제를 듣고 찾아 봐!'); else await say('또 찾아 볼까?');
      if (!alive() || !turn.mine(my)) return;
      hear();
    })();
  }, [ri]);

  const tap = async (i: number, e: any) => {
    if (lock.current || found.includes(i)) return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    const card = r.cards[i];
    const t = queue.current[qiRef.current];
    if (r.hits.includes(card) && hasPart(card, t, step.bat)) {
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.pop(); sfx.ding();
      const nf = [...found, i];
      setFound(nf); setHint(null);
      record(idFor(t, step.bat), miss.current === 0);
      miss.current = 0;
      setMood('wow'); setTimeout(() => setMood('happy'), 700);
      const next = qiRef.current + 1;
      const left = r.cards.some((c, j) => r.hits.includes(c) && !nf.includes(j));
      if (next >= queue.current.length || !left) {
        lock.current = true;          // 이 판 끝 (다음 판으로 넘어가는 잠깐만)
        await say(card); if (!alive()) return;
        await praise(); if (!alive()) return;
        if (ri + 1 >= step.rounds.length) { sfx.fanfare(); await praise(true); if (await sleep(300)) onDone(); }
        else setRi(ri + 1);
        return;
      }
      // 다음 문제의 답이 남아 있는지 확인 (없으면 남은 카드에 맞는 목표로)
      let nt = queue.current[next];
      const avail = (tt: string) => r.cards.some((c, j) => r.hits.includes(c) && !nf.includes(j) && hasPart(c, tt, step.bat));
      if (!avail(nt)) { const alt = step.targets.find(avail); if (alt) queue.current[next] = nt = alt; }
      qiRef.current = next; setQi(next);
      await say(card); if (!alive() || !turn.mine(my)) return;
      await praise(); if (!alive() || !turn.mine(my)) return;
      hear();
    } else {
      miss.current++;
      sfx.boing(); penalty(); setBad(i); setMood('think');
      setTimeout(() => { setBad(null); setMood('happy'); }, 550);
      // 두 번 틀리면 다른 친구가 킁킁 냄새 맡고 알려 줌
      if (miss.current === 2) {
        const h = r.cards.findIndex((c, j) => r.hits.includes(c) && !found.includes(j) && hasPart(c, t, step.bat));
        if (h >= 0) { setHint(h); const o = pair().other; buddy({ t: 'hint', who: o.species, text: o.species === 'dog' ? '킁킁! 여기 있는 것 같아!' : '냐옹! 여기 봐!' }); }
      }
      await say(card); if (!alive() || !turn.mine(my)) return;
      await gentle(); if (!alive() || !turn.mine(my)) return;
      hear();
    }
  };

  const cols = r.cards.length > 8 ? 4 : r.cards.length > 6 ? 4 : 3;
  const size = r.cards.length > 8 ? 150 : 170;
  return (
    <div class="screen">
      <Backdrop theme="meadow" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={queue.current.length || 1} done={qi} /></div>
        <div class="prompt" style={{ top: 64, padding: '8px 12px 8px 22px' }} data-targets={step.targets.join(',')} data-target={target}>
          <span key={ping} class="ear-ping" style={{ fontSize: 44 }}>👂</span>
          <span style={{ fontSize: 32 }}>문제를 듣고 글자 찾기</span>
          <Speaker onClick={hear} />
        </div>
        <div key={ri} class="hunt-grid" style={{ position: 'absolute', left: 250, right: 30, top: 190, display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, justifyContent: 'center', gap: 20 }}>
          {r.cards.map((c, i) => {
            const got = found.includes(i);
            return (
              <button class={`card slide-up ${bad === i ? 'shake' : ''} ${got ? 'right-glow' : ''}`} data-a={!got && target && r.hits.includes(c) && hasPart(c, target, step.bat) ? 1 : 0}
                style={{ width: size, height: size, fontSize: size * 0.56, color: '#5a3d73', animationDelay: `${i * 0.05}s`, position: 'relative' }} onPointerDown={(e) => tap(i, e)}>
                {got ? <LetterGlyph ch={c} size={size * 0.86} face={false} hi={step.targets} class="glyph-bounce" /> : c}
                {hint === i && !got && <span class="paw-hint">🐾</span>}
              </button>
            );
          })}
        </div>
        <Buddies size={170} mood={mood} />
      </div>
    </div>
  );
}

// =====================================================================
// 두더지 잡기: 문제를 하나씩 ("기역, 그! 기역 두더지를 잡아 줘!"), 하나 잡으면 다음 문제는 무작위(연달아 같은 것 없음)
// =====================================================================
// 윗줄 두더지 팻말이 위쪽 안내 문구에 가리지 않도록 구멍을 아래로
const HOLES: [number, number][] = [[430, 450], [710, 450], [990, 450], [430, 705], [710, 705], [990, 705]];
interface MoleT { id: number; hole: number; ch: string; up: boolean; hit: boolean; nope: boolean }
let moleId = 0;

/** 문제 순서: step.order가 있으면 그대로, 없으면 목표마다 perTarget번을 섞어서 */
const orderOf = (step: { targets: string[]; perTarget: number; order?: string[] }) =>
  step.order && step.order.length ? step.order : spread(step.targets.flatMap(t => Array(step.perTarget).fill(t)));

export function Mole({ step, onDone }: GameProps<'mole'>) {
  const { alive, sleep } = useScene();
  const order = useRef<string[]>(orderOf(step));
  const [moles, setMoles] = useState<MoleT[]>([]);
  const [qi, setQi] = useState(0);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [done, setDone] = useState(false);
  const R = useRef({ qi: 0, since: 0, busy: true, miss: 0 });
  const target = order.current[qi];
  const total = order.current.length;
  const pool = [...new Set([...step.pool, ...step.targets])];

  const lastHear = useRef(Date.now());
  const [ping, setPing] = useState(0);
  const hear = () => { setPing(x => x + 1); lastHear.current = Date.now(); return sayAll(askLines(order.current[R.current.qi], 'mole'), CUE_GAP); };
  const turnM = useTurn();

  useEffect(() => {
    R.current.busy = false;   // 말하는 중에도 바로 잡을 수 있게
    (async () => { const my = turnM.n; await say('소리를 잘 듣고 두더지를 잡아 봐!'); if (!alive() || !turnM.mine(my)) return; hear(); })();
    // 한동안 못 잡으면 문제 다시 들려주기
    const h = setInterval(() => { if (alive() && !R.current.busy && Date.now() - lastHear.current > 9000) hear(); }, 1000);
    const spawn = () => {
      if (!alive()) return;
      setMoles(ms => {
        const busyHoles = new Set(ms.map(m => m.hole));
        const free = HOLES.map((_, i) => i).filter(i => !busyHoles.has(i));
        if (!free.length || ms.filter(m => m.up).length >= 3) return ms;
        const S = R.current;
        const tgt = order.current[S.qi];
        const others = pool.filter(p => p !== tgt);
        const wantT = S.since >= 2 || Math.random() < 0.45 || !others.length;
        const ch = wantT ? tgt : others[Math.floor(Math.random() * others.length)];
        S.since = ch === tgt ? 0 : S.since + 1;
        const m: MoleT = { id: ++moleId, hole: free[Math.floor(Math.random() * free.length)], ch, up: false, hit: false, nope: false };
        setTimeout(() => setMoles(x => x.map(o => o.id === m.id ? { ...o, up: true } : o)), 30);
        setTimeout(() => setMoles(x => x.map(o => o.id === m.id && !o.hit ? { ...o, up: false } : o)), 2900);
        setTimeout(() => setMoles(x => x.filter(o => o.id !== m.id)), 3300);
        return [...ms, m];
      });
    };
    const t = setInterval(spawn, 900);
    return () => { clearInterval(t); clearInterval(h); };
  }, []);

  const bonk = async (m: MoleT, e: any) => {
    const S = R.current;
    if (!m.up || m.hit || done || S.busy) return;
    const my = turnM.take();          // 하던 말 멈추고 바로 반응
    lastHear.current = Date.now();
    const tgt = order.current[S.qi];
    if (m.ch === tgt) {
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.pop(); sfx.ding();
      setMoles(ms => ms.map(o => o.id === m.id ? { ...o, hit: true } : o));
      setTimeout(() => setMoles(ms => ms.map(o => o.id === m.id ? { ...o, up: false } : o)), 600);
      record(idFor(tgt), S.miss === 0); S.miss = 0;
      setMood('wow'); setTimeout(() => setMood('happy'), 600);
      if (S.qi + 1 >= order.current.length) {
        S.busy = true;
        setDone(true);
        sfx.fanfare();
        await praise(true);
        if (await sleep(400)) onDone();
        return;
      }
      S.qi++; setQi(S.qi);
      await praise(); if (!alive() || !turnM.mine(my)) return;
      hear();
    } else {
      S.miss++;
      sfx.boing(); penalty();
      setMoles(ms => ms.map(o => o.id === m.id ? { ...o, nope: true } : o));
      setTimeout(() => setMoles(ms => ms.map(o => o.id === m.id ? { ...o, nope: false } : o)), 500);
      setMood('think'); setTimeout(() => setMood('happy'), 800);
      // 잡은 두더지 글자 이름 → 부드럽게 다시 → 문제 다시 (그동안에도 계속 잡을 수 있음)
      await sayCue(m.ch); if (!alive() || !turnM.mine(my)) return;
      await gentle(); if (!alive() || !turnM.mine(my)) return;
      hear();
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="meadow" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)' }}><Dots n={total} done={qi} /></div>
        <div class="prompt" style={{ top: 56, fontSize: 32, padding: '8px 12px 8px 24px' }} data-target={target}>
          <span key={ping} class="ear-ping" style={{ fontSize: 40 }}>👂</span><span>소리 듣고 두더지 잡기!</span>
          <Speaker onClick={hear} />
        </div>
        {HOLES.map(([x, y], hi) => {
          const m = moles.find(o => o.hole === hi);
          return (
            <div class="mole-slot" style={{ left: x - 110, top: y - 190 }}>
              <div class="mole-hole" />
              {m && (
                <div class={`mole ${m.up ? 'up' : ''} ${m.hit ? 'hit' : ''} ${m.nope ? 'nope' : ''}`} data-a={m.ch === target && m.up && !m.hit ? 1 : 0} onPointerDown={(e) => bonk(m, e)}>
                  <MoleArt hit={m.hit} />
                  <div class="mole-sign" style={{ fontSize: !hasHangul(m.ch) ? 58 : m.ch.length > 1 ? 40 : 62 }}>{m.ch}</div>
                </div>
              )}
              <div class="mole-front" />
            </div>
          );
        })}
        <Buddies size={150} style={{ zIndex: 6 }} mood={mood} motion={done ? 'cheer' : 'bob'} />
      </div>
    </div>
  );
}

function MoleArt({ hit }: { hit: boolean }) {
  return (
    <svg viewBox="0 0 160 170" width="160" height="170">
      <ellipse cx="80" cy="110" rx="62" ry="70" fill="#a9785a" stroke="#7a5238" stroke-width="5" />
      <ellipse cx="80" cy="128" rx="40" ry="42" fill="#d9b193" />
      {hit ? (
        <g stroke="#3b2a2a" stroke-width="4" stroke-linecap="round"><path d="M50 78 l14 12 M64 78 l-14 12" /><path d="M96 78 l14 12 M110 78 l-14 12" /></g>
      ) : (
        <g><circle cx="58" cy="84" r="8" fill="#2b1f1f" /><circle cx="102" cy="84" r="8" fill="#2b1f1f" /><circle cx="55" cy="81" r="3" fill="#fff" /><circle cx="99" cy="81" r="3" fill="#fff" /></g>
      )}
      <ellipse cx="80" cy="102" rx="13" ry="10" fill="#ff8fab" stroke="#d6557a" stroke-width="3" />
      <ellipse cx="46" cy="104" rx="9" ry="5" fill="#ff7fb0" opacity=".45" /><ellipse cx="114" cy="104" rx="9" ry="5" fill="#ff7fb0" opacity=".45" />
      <path d="M72 116 q8 8 16 0" stroke="#3b2a2a" stroke-width="3" fill="none" stroke-linecap="round" />
      {hit && <g fill="#ffd43b"><path d="M30 40 l5 10 11 2 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -2z" /><path d="M124 36 l4 8 9 1 -6 6 1 9 -8 -4 -8 4 1 -9 -6 -6 9 -1z" /></g>}
    </svg>
  );
}

// =====================================================================
// 짝 맞추기
// =====================================================================
export function Memory({ step, onDone, outfit }: GameProps<'memory'>) {
  const { alive, sleep } = useScene();
  const cards = step.cards;
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  // 화면 상태와 별개로 바로 판단하기 위한 값 (누르자마자 반응)
  const S = useRef({ open: [] as number[], matched: [] as number[], closeT: 0 as any, done: false });
  const turn = useTurn();

  // 소리 카드마다 들려줄 소리 (자음은 이름/소리 번갈아)
  const sounds = useRef<string[][]>(cards.map(c => (c.kind === 'sound' ? cue(c.say) : c.say ? [c.say] : [])));
  const hasSound = cards.some(c => c.kind === 'sound');
  const lastSound = useRef<string[]>([]);

  useEffect(() => {
    say(hasSound ? '소리 카드와 글자 카드의 짝을 찾아 봐!' : '그림과 글자의 짝을 찾아 봐!');
    return () => clearTimeout(S.current.closeT);
  }, []);

  const flip = (i: number, e: any) => {
    const st = S.current;
    if (st.done || st.matched.includes(i) || st.open.includes(i)) return;
    const my = turn.take();          // 하던 말 멈추고 바로 뒤집기
    sfx.tap();
    // 짝이 아닌 두 장이 아직 열려 있으면 바로 덮고 새로 시작
    if (st.open.length >= 2) { clearTimeout(st.closeT); st.open = []; setMood('happy'); }
    st.open = [...st.open, i];
    setOpen(st.open);
    // 글자 카드는 조용히 (스스로 읽기), 소리·그림 카드만 소리
    if (sounds.current[i].length) { lastSound.current = sounds.current[i]; sayAll(sounds.current[i], CUE_GAP); }
    if (st.open.length < 2) return;
    const [a, b] = st.open;
    if (cards[a].id === cards[b].id) {
      // 짝! 바로 반짝
      st.matched = [...st.matched, a, b]; st.open = [];
      setMatched(st.matched); setOpen([]);
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.ding();
      setMood('wow'); setTimeout(() => setMood('happy'), 700);
      if (cards[a].kind === 'pic' || cards[b].kind === 'pic') record('w:' + cards[a].id, true);
      else if (JAMO[cards[a].id]) record('j:' + cards[a].id, true);
      const all = st.matched.length >= cards.length;
      if (all) st.done = true;
      (async () => {
        await sleep(250);
        if (!alive() || (!all && !turn.mine(my))) return;
        await sayCue(cards[a].id);                 // 맞힌 글자 이름과 소리
        if (!alive()) return;
        if (all) { sfx.fanfare(); await praise(true); if (await sleep(400)) onDone(); return; }
        if (!turn.mine(my)) return;
        praise();
      })();
    } else {
      // 짝이 아니면 잠깐 보여 주고 덮기 (그 사이 다른 카드를 누르면 바로 덮고 넘어감)
      setMood('think');
      st.closeT = setTimeout(() => {
        if (st.open.length === 2 && st.open[0] === a && st.open[1] === b) { st.open = []; setOpen([]); }
        setMood('happy');
      }, 900);
    }
  };

  const cols = cards.length > 8 ? 5 : 4;
  return (
    <div class="screen">
      <Backdrop theme="castle" />
      <div class="layer">
        <div class="prompt" style={{ top: 40 }}><span>🃏 짝 맞추기</span>{hasSound && <Speaker onClick={() => { if (lastSound.current.length) sayAll(lastSound.current, CUE_GAP); }} />}</div>
        <div style={{ position: 'absolute', left: 240, right: 40, top: 150, display: 'grid', gridTemplateColumns: `repeat(${cols}, 170px)`, justifyContent: 'center', gap: 20 }}>
          {cards.map((c, i) => {
            const up = open.includes(i) || matched.includes(i);
            return (
              <div class={`flip ${up ? 'up' : ''} ${matched.includes(i) ? 'done' : ''}`} data-pair={c.id} data-up={up ? 1 : 0} onPointerDown={(e) => flip(i, e)}>
                <div class="flip-in">
                  <div class="flip-back"><span>🐾</span></div>
                  <div class={`flip-face ${c.kind === 'sound' ? 'sound' : ''}`} style={{ fontSize: c.kind === 'pic' || c.kind === 'sound' ? 96 : c.face.length > 2 ? 52 : 86 }}>{c.face}</div>
                </div>
              </div>
            );
          })}
        </div>
        <Buddies size={162} mood={mood} />
      </div>
    </div>
  );
}

// =====================================================================
// 먹이 주기: 강아지·고양이가 말하는 글자 간식 주기
// =====================================================================
const FEED_GENTLE = ['괜찮아~ 다시 골라 줄래?', '음~ 다른 간식도 먹어 볼래! 다시 골라 줘!'];

export function Feed({ step, onDone }: GameProps<'feed'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think' | 'love'>('happy');
  const [flying, setFlying] = useState<number | null>(null);
  const [bad, setBad] = useState<number | null>(null);
  const [eaten, setEaten] = useState(0);
  const lock = useRef(true);
  const miss = useRef(0);
  const r = step.rounds[ri];
  // 강아지와 고양이가 번갈아 배고파한다
  const p = pair();
  const hungry = ri % 2 === 0 ? p.lead : p.other;
  const waiting = hungry === p.lead ? p.other : p.lead;

  const ask = (first = false) => sayAll(first ? [hungryLine(hungry.name), ...askLines(r.answer, 'feed')] : askLines(r.answer, 'feed'), CUE_GAP);

  const turn = useTurn();
  useEffect(() => {
    setFlying(null); miss.current = 0; lock.current = false;   // 말하는 중에도 바로 줄 수 있게
    (async () => {
      const my = turn.n;
      if (!await sleep(200) || !turn.mine(my)) return;
      ask(true);
    })();
  }, [ri]);

  const give = async (o: string, i: number) => {
    if (lock.current) return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    if (o === r.answer) {
      lock.current = true;           // 간식이 날아가는 동안만
      sfx.whoosh();
      setFlying(i);
      if (!await sleep(450)) return;
      sfx.pop();
      setMood('love'); setEaten(x => x + 1);
      buddy({ t: 'eat', who: hungry.species });
      hungry.species === 'dog' ? sfx.bark(1) : sfx.meow();
      record(idFor(o), miss.current === 0);
      await say('냠냠! 맛있다!'); if (!alive()) return;
      setMood('happy');
      if (ri + 1 >= step.rounds.length) { sfx.fanfare(); await praise(true); if (await sleep(300)) onDone(); }
      else setRi(ri + 1);
    } else {
      miss.current++;
      sfx.boing(); penalty(); setBad(i); setMood('think');
      setTimeout(() => { setBad(null); setMood('happy'); }, 500);
      await sayCue(o); if (!alive() || !turn.mine(my)) return;
      await gentle(FEED_GENTLE); if (!alive() || !turn.mine(my)) return;
      ask();
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="sky" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.rounds.length} done={ri} /></div>
        <div class="prompt" style={{ top: 70 }}><span>{hungry.species === 'dog' ? '🦴' : '🐟'} {hungry.name} 간식 주기</span><Speaker onClick={() => ask()} /></div>
        <div style={{ position: 'absolute', left: 16, top: 360 }}>
          <Pet pet={waiting.id} stage={waiting.stage} level={waiting.level} wear={waiting.wear} size={220} mood={mood === 'love' ? 'love' : 'happy'} motion="bob" autoTalk={false} />
        </div>
        <div key={hungry.id} class="slide-up" style={{ position: 'absolute', left: 150, top: 250 }}>
          <Pet pet={hungry.id} stage={hungry.stage} level={hungry.level} wear={hungry.wear} size={330} mood={mood} motion={mood === 'love' ? 'jump' : 'bob'} />
        </div>
        <div class="bowl"><span>{'💕'.repeat(Math.min(eaten, 5))}</span></div>
        <div key={ri} style={{ position: 'absolute', left: 520, top: 330, display: 'flex', gap: 36 }}>
          {r.options.map((o, i) => (
            <button class={`treat ${flying === i ? 'fly' : 'slide-up'} ${bad === i ? 'shake' : ''}`} data-a={o === r.answer ? 1 : 0}
              style={{ animationDelay: `${i * 0.08}s`, ...(flying === i ? { transform: `translate(${-(215 + i * 256)}px, -40px) scale(.25)` } : {}) }} onPointerDown={() => give(o, i)}>
              <TreatArt kind={hungry.species} />
              <span style={{ fontSize: o.length > 1 ? 84 : 118 }}>{o}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TreatArt({ kind }: { kind: 'dog' | 'cat' }) {
  // 동그란 쿠키 + 위에 뼈다귀/생선 모양
  return (
    <svg viewBox="0 0 220 240" width="220" height="240" class="treat-bg">
      <circle cx="110" cy="130" r="100" fill="#f5c77e" stroke="#c98b45" stroke-width="7" />
      <circle cx="110" cy="130" r="80" fill="#fff4dc" />
      <g fill="#e8a95c" opacity=".7"><circle cx="46" cy="104" r="5" /><circle cx="170" cy="92" r="5" /><circle cx="176" cy="170" r="5" /><circle cx="52" cy="176" r="5" /><circle cx="110" cy="214" r="5" /></g>
      {kind === 'dog' ? (
        <path d="M78 22 a13 13 0 1 1 15 15 L127 37 a13 13 0 1 1 15 -15 a13 13 0 1 1 0 34 a13 13 0 1 1 -15 -15 L93 41 a13 13 0 1 1 -15 15 a13 13 0 1 1 0 -34z" fill="#fffaf0" stroke="#c98b45" stroke-width="5" stroke-linejoin="round" />
      ) : (
        <g><path d="M72 38 C 90 14, 130 14, 146 38 C 130 62, 90 62, 72 38 Z" fill="#dff1ff" stroke="#5f9fd6" stroke-width="5" />
          <path d="M146 38 L 166 22 L 163 38 L 166 54 Z" fill="#dff1ff" stroke="#5f9fd6" stroke-width="5" stroke-linejoin="round" /><circle cx="88" cy="35" r="4" fill="#3b4a5a" /></g>
      )}
    </svg>
  );
}
