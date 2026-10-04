// 소리 방울: 글자는 보여 주지 않고 소리만 들려준다 → 들은 글자가 적힌 방울만 톡!
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf, stageInfo } from '../art/Scene';
import { say, sayAll, sfx, wait } from '../engine/audio';
import { record } from '../engine/srs';
import { pick, hasHangul } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, praise, spoken, sayCue, spread, CUE_GAP, Dots, Speaker, gentle, useTurn, type GameProps, penalty } from './common';
import { askLines } from '../data/voice';
import { JAMO } from '../data/jamo';

interface B { id: number; ch: string; x: number; dur: number; size: number; state: 'up' | 'pop' | 'nope'; hue: number }

let uid = 0;

export function Bubble({ step, onDone }: GameProps<'bubble'>) {
  const { alive, sleep } = useScene();
  // 문제 순서: 하나 찾으면 다음 문제 (무작위, 같은 것이 연달아 나오지 않게)
  const order = useRef<string[]>(step.order && step.order.length ? step.order : spread(step.targets.flatMap(t => Array(step.perTarget).fill(t))));
  const [qi, setQi] = useState(0);
  const [list, setList] = useState<B[]>([]);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [finished, setFinished] = useState(false);
  const wrong = useRef(0);
  const ref = useRef({ qi: 0, lastX: 0, sinceTarget: 0, busy: true });
  const target = order.current[qi];
  const total = order.current.length;
  const pool = [...new Set([...step.pool, ...step.targets])];

  const [ping, setPing] = useState(0);     // 소리 낼 때 귀 모양 흔들기
  const lastHint = useRef(Date.now());
  const hear = () => { setPing(x => x + 1); lastHint.current = Date.now(); return sayAll(askLines(order.current[ref.current.qi], 'bubble'), CUE_GAP); };

  const turn = useTurn();
  useEffect(() => {
    // 말하는 중에도 바로 터뜨릴 수 있게 처음부터 누르기 허용
    ref.current.busy = false;
    (async () => {
      const my = turn.n;
      await say('소리를 잘 듣고 방울을 찾아 봐!');
      if (!alive() || !turn.mine(my)) return;
      await wait(120);
      if (!alive() || !turn.mine(my)) return;
      hear();
    })();
    const spawn = () => {
      if (!alive()) return;
      const R = ref.current;
      setList(l => {
        if (l.filter(b => b.state === 'up').length >= 7) return l;
        const tgt = order.current[R.qi];
        const wantTarget = R.sinceTarget >= 2 || Math.random() < 0.45;
        const others = pool.filter(p => p !== tgt);
        const ch = wantTarget || others.length === 0 ? tgt : pick(others);
        R.sinceTarget = ch === tgt ? 0 : R.sinceTarget + 1;
        // 화면 전체 폭을 쓴다 (안전 영역 밖 양옆까지)
        const side = stageInfo().side;
        const x0 = 170 - side, span = 1280 + side * 2 - 340;
        let x = x0 + Math.random() * span;
        if (Math.abs(x - R.lastX) < 170) x = x0 + ((x - x0 + span / 2) % span);
        R.lastX = x;
        return [...l, { id: ++uid, ch, x, dur: 7 + Math.random() * 2.5, size: 140 + Math.random() * 30, state: 'up', hue: Math.random() * 60 - 30 }];
      });
    };
    spawn();
    const t = setInterval(spawn, 950);
    // 한동안 못 찾으면 문제를 다시 들려주기
    const h = setInterval(() => {
      if (!alive() || ref.current.busy) return;
      if (Date.now() - lastHint.current > 9000) hear();
    }, 1000);
    return () => { clearInterval(t); clearInterval(h); };
  }, []);

  const tap = async (b: B, e: any) => {
    if (b.state !== 'up' || finished) return;
    const R = ref.current;
    if (R.busy) return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    const tgt = order.current[R.qi];
    lastHint.current = Date.now();
    if (b.ch === tgt) {
      const [x, y] = centerOf(e.currentTarget);
      burst(x, y);
      sfx.pop(); sfx.ding();
      setList(l => l.map(o => o.id === b.id ? { ...o, state: 'pop' } : o));
      setTimeout(() => setList(l => l.filter(o => o.id !== b.id)), 320);
      setMood('wow'); setTimeout(() => setMood('happy'), 600);
      record(JAMO[tgt] ? 'j:' + tgt : 'x:' + tgt, wrong.current === 0);
      wrong.current = 0;
      if (R.qi + 1 >= order.current.length) {
        R.busy = true;
        setFinished(true);
        sfx.fanfare();
        // 남은 방울 한꺼번에 터뜨리기
        setList(l => l.map(o => ({ ...o, state: 'pop' })));
        await praise(true);
        if (await sleep(500)) onDone();
        return;
      }
      R.qi++; setQi(R.qi);
      await praise(); if (!alive() || !turn.mine(my)) return;
      hear();
    } else {
      wrong.current++;
      sfx.boing(); penalty();
      setList(l => l.map(o => o.id === b.id ? { ...o, state: 'nope' } : o));
      setTimeout(() => setList(l => l.map(o => o.id === b.id && o.state === 'nope' ? { ...o, state: 'up' } : o)), 420);
      setMood('think'); setTimeout(() => setMood('happy'), 900);
      // 누른 방울 이름 → 부드럽게 다시 → 문제 다시 (그동안에도 계속 누를 수 있음)
      await sayCue(b.ch); if (!alive() || !turn.mine(my)) return;
      await gentle(); if (!alive() || !turn.mine(my)) return;
      hear();
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="beach" />
      <div class="layer">
        {list.map(b => (
          <div key={b.id} style={{ position: 'absolute', left: b.x - b.size / 2, top: 0, animation: `rise ${b.dur}s linear forwards`, zIndex: 3 }}
            onAnimationEnd={(e: any) => { if (e.animationName === 'rise') setList(l => l.filter(o => o.id !== b.id)); }}>
            <div style={{ animation: `sway ${2 + (b.id % 3) * 0.4}s ease-in-out infinite` }}>
              <div class={`bubble ${b.state === 'pop' ? 'popped' : b.state === 'nope' ? 'nope' : ''}`}
                style={{ width: b.size, height: b.size, fontSize: !hasHangul(b.ch) ? b.size * 0.46 : b.ch.length > 1 ? b.size * 0.3 : b.size * 0.5, filter: `hue-rotate(${b.hue}deg)` }}
                data-ch={b.ch} onPointerDown={(e) => tap(b, e)}>{b.ch}</div>
            </div>
          </div>
        ))}
        <div class="prompt" data-target={target}>
          <span key={ping} class="ear-ping" style={{ fontSize: 50 }}>👂</span>
          <span>소리 방울 찾기!</span>
          <Speaker onClick={hear} />
        </div>
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={total} done={qi} /></div>
        <Buddies size={162} style={{ zIndex: 4 }} mood={mood} motion={finished ? 'cheer' : 'bob'} />
      </div>
      <style>{`
        @keyframes rise { from { transform: translateY(calc(820px + var(--top))); } to { transform: translateY(calc(-260px - var(--top))); } }
        @keyframes sway { 50% { transform: translateX(26px); } }
      `}</style>
    </div>
  );
}
