// 소리 듣고 고르기
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { decompose } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, praise, Dots, Speaker, spoken, cue, sayCue, gentle, useTurn, type GameProps, CUE_GAP, penalty } from './common';

export function Cards({ step, onDone, outfit }: GameProps<'cards'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [state, setState] = useState<Record<number, 'wrong' | 'right' | 'hint'>>({});
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [lock, setLock] = useState(true);
  const misses = useRef(0);
  const round = step.rounds[ri];

  const cueText = useRef<string[]>([]);
  const ask = (first = false) => sayAll(first && ri === 0 ? ['잘 듣고 찾아 봐!', ...cueText.current] : cueText.current, CUE_GAP);

  const turn = useTurn();
  useEffect(() => {
    setState({}); misses.current = 0; setLock(false);   // 말하는 중에도 바로 고를 수 있게
    cueText.current = cue(round.answer);
    (async () => {
      const my = turn.n;
      if (!await sleep(ri === 0 ? 150 : 250) || !turn.mine(my)) return;
      ask(true);
    })();
  }, [ri]);

  const choose = async (opt: string, i: number, e: any) => {
    if (lock || state[i] === 'right') return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    if (opt === round.answer) {
      setLock(true);                 // 다음 문제로 넘어가는 잠깐만
      setState(s => ({ ...s, [i]: 'right' }));
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.ding();
      setMood('wow');
      const id = round.id?.startsWith('x:') ? 'j:' + decompose(round.answer)!.cho : round.id;
      if (id) record(id, misses.current === 0);
      await praise();
      if (!alive()) return;
      setMood('happy');
      if (ri + 1 >= step.rounds.length) { sfx.fanfare(); if (await sleep(500)) onDone(); }
      else setRi(ri + 1);
    } else {
      misses.current++;
      sfx.boing(); penalty();
      setMood('think');
      setState(s => ({ ...s, [i]: 'wrong' }));
      setTimeout(() => { setState(s => { const n = { ...s }; if (n[i] === 'wrong') delete n[i]; return n; }); setMood('happy'); }, 500);
      if (misses.current >= 2) {
        const ai = round.options.indexOf(round.answer);
        setState(s => ({ ...s, [ai]: 'hint' }));
      }
      await sayCue(opt); if (!alive() || !turn.mine(my)) return;
      await gentle(); if (!alive() || !turn.mine(my)) return;
      ask();
    }
  };

  const n = round.options.length;
  const w = step.kind === 'word' ? 300 : 250;
  const fs = (s: string) => s.length >= 4 ? 70 : s.length === 3 ? 88 : s.length === 2 ? 110 : 150;

  return (
    <div class="screen">
      <Backdrop theme="sky" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.rounds.length} done={ri} /></div>
        <div class="prompt" style={{ top: 110 }}>
          <span>{spoken(round.answer).length > 0 ? '어떤 글자일까?' : ''}</span>
          <Speaker onClick={() => ask()} />
        </div>
        <div style={{ position: 'absolute', left: 250, right: 30, top: 260, display: 'flex', justifyContent: 'center', gap: 40 }} key={ri}>
          {round.options.map((o, i) => (
            <button class={`card slide-up ${state[i] === 'wrong' ? 'shake' : ''} ${state[i] === 'right' ? 'right-glow' : ''} ${state[i] === 'hint' ? 'hint-glow' : ''}`}
              style={{ width: n > 3 ? 220 : w, height: 320, fontSize: fs(o), animationDelay: `${i * 0.08}s`, color: '#5a3d73' }}
              data-a={o === round.answer ? 1 : 0} onPointerDown={(e) => choose(o, i, e)}>
              {o}
              {state[i] === 'right' && <span style={{ position: 'absolute', top: -30, right: -20, fontSize: 70 }}>⭐</span>}
            </button>
          ))}
        </div>
        <Buddies size={178} mood={mood} />
      </div>
    </div>
  );
}
