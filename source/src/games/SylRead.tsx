// 글자 합치기 (11-12 사용자 요청: 낱말 공부 전에 가~휴를 읽으면서 쓰는 연습)
//  · 글자 줄 읽기(SylRead): 오늘의 한 줄(가 나 다 … 하)을 차례로 읽어 주고(듣고 따라 읽기) → 아이가 하나씩 눌러서 읽기
//  · 글자 줄에서 찾기(SylFind): 소리를 듣고 그 줄에서 글자 찾기 (틀리면 다른 놀이처럼 받은 것 하나를 돌려받음)
// 말하는 중에도 바로 누를 수 있다. 글자 아래 작은 'ㄱ+ㅏ'로 자음과 모음이 합쳐진 글자임을 보여 준다.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { decompose } from '../lib/hangul';
import { askLines } from '../data/voice';
import { Buddies } from './Buddies';
import { useScene, praise, Dots, Speaker, sayCue, gentle, useTurn, CUE_GAP, penalty, type GameProps } from './common';

function Tile({ ch, i, cls = '', star, onTap, a }: { ch: string; i: number; cls?: string; star?: boolean; onTap: (e: any) => void; a?: number }) {
  const p = decompose(ch);
  return (
    <button class={`card syl-tile slide-up ${cls}`} style={{ animationDelay: `${i * 0.03}s` }} data-syl={ch} data-a={a} onPointerDown={onTap}>
      <span class="syl-ch">{ch}</span>
      {p && <span class="syl-parts"><b class="c">{p.cho}</b>+<b class="v">{p.jung}</b></span>}
      {star && <span class="syl-star">⭐</span>}
    </button>
  );
}

// ---------- 글자 줄 읽기 ----------
export function SylRead({ step, onDone }: GameProps<'sylread'>) {
  const { alive, sleep } = useScene();
  const items = step.items;
  const [now, setNow] = useState(-1);                 // 지금 읽어 주는 글자
  const [phase, setPhase] = useState<'listen' | 'tap' | 'end'>('listen');
  const [read, setRead] = useState<number[]>([]);     // 아이가 눌러서 읽은 글자
  const [hint, setHint] = useState(-1);
  const S = useRef({ read: [] as number[], done: false, last: Date.now() });
  const turn = useTurn();

  /** 차례로 읽어 주기: 한 글자씩 짚으며 읽고, 따라 읽을 틈을 둔다 */
  const listen = async () => {
    const my = turn.take();
    setPhase('listen');
    await say('같이 읽어 보자!');
    for (let i = 0; i < items.length; i++) {
      if (!alive() || !turn.mine(my)) return;         // 아이가 누르기 시작하면 멈춤
      setNow(i);
      await say(items[i]);
      if (!await sleep(420) || !turn.mine(my)) return;
    }
    setNow(-1);
    if (S.current.done) return;
    setPhase('tap'); S.current.last = Date.now();
    say('글자 친구를 눌러 봐!');
  };

  useEffect(() => {
    (async () => { if (await sleep(350)) listen(); })();
    // 한동안 안 누르면 아직 안 읽은 글자를 알려 준다
    const h = setInterval(() => {
      const st = S.current;
      if (!alive() || st.done) return;
      setHint(Date.now() - st.last > 6000 ? items.findIndex((_, i) => !st.read.includes(i)) : -1);
    }, 1000);
    return () => clearInterval(h);
  }, []);

  const tap = async (i: number, e: any) => {
    const st = S.current;
    if (st.done) return;
    turn.take();                                       // 하던 말 멈추고 바로 반응 (차례로 읽어 주던 것도 멈춤)
    setPhase('tap'); setNow(-1); setHint(-1); st.last = Date.now();
    sfx.pop();
    const [x, y] = centerOf(e.currentTarget); burst(x, y);
    if (!st.read.includes(i)) { st.read = [...st.read, i]; setRead(st.read); }
    const all = st.read.length >= items.length;
    if (all) st.done = true;
    await say(items[i]);
    if (!alive() || !all) return;
    setPhase('end');
    sfx.fanfare();
    await praise(true);
    if (await sleep(400)) onDone();
  };

  return (
    <div class="screen">
      <Backdrop theme="sky" />
      <div class="layer">
        <div class="prompt" style={{ top: 56 }}>
          <span>📖 {phase === 'listen' ? '듣고 따라 읽기' : '하나씩 눌러서 읽기'}</span>
          <b class="syl-count" data-read={read.length}>{read.length}/{items.length}</b>
          <Speaker onClick={() => { if (!S.current.done) listen(); }} />
        </div>
        <div class="syl-grid" data-phase={phase}>
          {items.map((ch, i) => (
            <Tile ch={ch} i={i} cls={`${now === i ? 'now' : ''} ${read.includes(i) ? 'read' : ''} ${hint === i ? 'hint-glow' : ''}`} star={read.includes(i)} onTap={(e) => tap(i, e)} />
          ))}
        </div>
        <Buddies size={170} mood={phase === 'end' ? 'wow' : 'happy'} motion={phase === 'end' ? 'cheer' : 'bob'} />
      </div>
    </div>
  );
}

// ---------- 글자 줄에서 찾기 ----------
export function SylFind({ step, onDone }: GameProps<'sylfind'>) {
  const { alive, sleep } = useScene();
  const items = step.items;
  const order = step.order;
  const [qi, setQi] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [bad, setBad] = useState(-1);
  const [hint, setHint] = useState(false);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [ping, setPing] = useState(0);
  const S = useRef({ qi: 0, miss: 0, busy: false });
  const turn = useTurn();
  const target = order[Math.min(qi, order.length - 1)];
  const hear = () => { setPing(x => x + 1); return sayAll(askLines(order[S.current.qi], 'recall'), CUE_GAP); };

  useEffect(() => {
    (async () => {
      const my = turn.n;
      if (!await sleep(300) || !turn.mine(my)) return;
      await say('잘 듣고 찾아 봐!');
      if (!alive() || !turn.mine(my)) return;
      hear();
    })();
  }, []);

  const tap = async (i: number, e: any) => {
    const st = S.current;
    const ch = items[i];
    if (st.busy || found.includes(ch)) return;
    const my = turn.take();                            // 하던 말 멈추고 바로 반응
    if (ch === order[st.qi]) {
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.pop(); sfx.ding();
      setFound(f => [...f, ch]); setHint(false);
      const p = decompose(ch);
      if (p) record('j:' + p.cho, st.miss === 0);
      st.miss = 0;
      setMood('wow'); setTimeout(() => setMood('happy'), 700);
      if (st.qi + 1 >= order.length) {
        st.busy = true;
        sfx.fanfare();
        await praise(true);
        if (await sleep(400)) onDone();
        return;
      }
      st.qi++; setQi(st.qi);
      await praise(); if (!alive() || !turn.mine(my)) return;
      hear();
    } else {
      st.miss++;
      sfx.boing(); penalty(); setBad(i); setMood('think');
      setTimeout(() => { setBad(-1); setMood('happy'); }, 500);
      if (st.miss >= 2) setHint(true);                 // 두 번 틀리면 답을 반짝여 알려 줌
      await sayCue(ch); if (!alive() || !turn.mine(my)) return;
      await gentle(); if (!alive() || !turn.mine(my)) return;
      hear();
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="meadow" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)' }}><Dots n={order.length} done={qi} /></div>
        <div class="prompt" style={{ top: 66, padding: '8px 12px 8px 24px' }} data-target={target}>
          <span key={ping} class="ear-ping" style={{ fontSize: 44 }}>👂</span>
          <span style={{ fontSize: 32 }}>소리를 듣고 글자 찾기</span>
          <Speaker onClick={hear} />
        </div>
        <div class="syl-grid">
          {items.map((ch, i) => {
            const got = found.includes(ch);
            return <Tile ch={ch} i={i} a={!got && ch === target ? 1 : 0} star={got}
              cls={`${got ? 'read' : ''} ${bad === i ? 'shake' : ''} ${hint && !got && ch === target ? 'hint-glow' : ''}`} onTap={(e) => tap(i, e)} />;
          })}
        </div>
        <Buddies size={170} mood={mood} />
      </div>
    </div>
  );
}
