// 카드 위치 기억하기: 카드 16장을 10초 동안 보여 주고 뒤집은 뒤, 문제를 하나씩 듣고 그 글자 카드 찾기
// (예: ㅏ 2장 · ㅓ 2장 → 보여 줄 때 "이 글자 카드를 찾을 거야! 아, 어" 하고 미리 알려 주고 반짝 표시
//  → 뒤집은 뒤 "아! 아 카드를 찾아 줘!" → 찾으면 다음 문제는 무작위)
// 뒤집은 뒤에도 "다시 보기"로 5초 동안 전체 위치를 다시 볼 수 있다 (3번까지)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { buddy } from '../engine/bus';
import { JAMO } from '../data/jamo';
import { hasHangul } from '../lib/hangul';
import { askLines, cueParts } from '../data/voice';
import { Buddies, pair } from './Buddies';
import { COUNT } from './Trace';
import { useScene, praise, sayCue, CUE_GAP, Dots, Speaker, gentle, useTurn, type GameProps, penalty } from './common';

export const PEEKS = 3;
export const PEEK_SEC = 5;
export const RECALL_LINES = ['이 글자 카드를 찾을 거야!', '어디에 있는지 잘 기억해!', '다시 볼게! 잘 봐!', '이제 다시 뒤집을게!'];

export function Recall({ step, onDone }: GameProps<'recall'>) {
  const { alive, sleep } = useScene();
  const [phase, setPhase] = useState<'show' | 'play' | 'peek' | 'end'>('show');
  const [left, setLeft] = useState(step.showSec);
  const [found, setFound] = useState<number[]>([]);
  const [peek, setPeek] = useState<number | null>(null);
  const [hint, setHint] = useState<number | null>(null);
  const [qi, setQi] = useState(0);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [ping, setPing] = useState(0);
  const [peeks, setPeeks] = useState(PEEKS);
  const [peekLeft, setPeekLeft] = useState(0);
  const S = useRef({ phase: 'show' as 'show' | 'play' | 'peek' | 'end', found: [] as number[], qi: 0, miss: 0 });
  const turn = useTurn();
  const order = step.order;
  const hear = () => { setPing(x => x + 1); return sayAll(askLines(order[S.current.qi], 'recall'), CUE_GAP); };
  const go = (p: typeof S.current.phase) => { S.current.phase = p; setPhase(p); };

  useEffect(() => {
    (async () => {
      // 뒤집기 전에: 찾을 글자를 미리 읽어 주고(반짝 표시) 위치를 기억하게
      const lines = [RECALL_LINES[0], ...step.targets.flatMap(t => cueParts(t)), RECALL_LINES[1]];
      sayAll(lines, CUE_GAP);
      for (let s = step.showSec; s > 0; s--) {
        setLeft(s);
        if (s <= 3) say(COUNT[s - 1], { interrupt: false });
        if (!await sleep(1000)) return;
      }
      setLeft(0);
      sfx.whoosh();
      go('play');                       // 뒤집자마자 누를 수 있음
      const my = turn.n;
      await say('이제 카드를 뒤집을게!'); if (!alive() || !turn.mine(my)) return;
      hear();
    })();
  }, []);

  // 다시 보기: 5초 동안 전체 카드 위치를 다시 보여 준다 (3번까지)
  const doPeek = async () => {
    if (S.current.phase !== 'play' || peeks <= 0) return;
    turn.take();
    setPeeks(n => n - 1);
    go('peek');
    sfx.whoosh();
    say(RECALL_LINES[2]);
    for (let s = PEEK_SEC; s > 0; s--) {
      setPeekLeft(s);
      if (!await sleep(1000)) return;
    }
    setPeekLeft(0);
    sfx.whoosh();
    go('play');
    const my = turn.n;
    await say(RECALL_LINES[3]); if (!alive() || !turn.mine(my)) return;
    hear();
  };

  const tap = async (i: number, e: any) => {
    const st = S.current;
    if (st.phase !== 'play' || st.found.includes(i)) return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    const t = order[st.qi];
    const face = step.cards[i];
    sfx.tap();
    if (face === t) {
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      sfx.ding();
      st.found = [...st.found, i];
      setFound(st.found); setHint(null); setPeek(null);
      if (JAMO[t]) record('j:' + t, st.miss === 0);
      st.miss = 0;
      setMood('wow'); setTimeout(() => setMood('happy'), 700);
      const next = st.qi + 1;
      if (next >= order.length) {
        go('end');
        await sayCue(t); if (!alive()) return;
        sfx.fanfare();
        await praise(true);
        if (await sleep(500)) onDone();
        return;
      }
      st.qi = next; setQi(next);
      await sayCue(t); if (!alive() || !turn.mine(my)) return;
      await praise(); if (!alive() || !turn.mine(my)) return;
      hear();
    } else {
      st.miss++;
      setPeek(i); setMood('think');
      sfx.boing(); penalty();
      setTimeout(() => { setPeek(p => (p === i ? null : p)); setMood('happy'); }, 900);
      // 두 번 틀리면 친구가 킁킁 냄새 맡고 알려 줌
      if (st.miss === 2) {
        const h = step.cards.findIndex((c, j) => c === t && !st.found.includes(j));
        if (h >= 0) { setHint(h); const o = pair().other; buddy({ t: 'hint', who: o.species, text: o.species === 'dog' ? '킁킁! 여기 있는 것 같아!' : '냐옹! 여기 봐!' }); }
      }
      await sayCue(face); if (!alive() || !turn.mine(my)) return;
      await gentle(); if (!alive() || !turn.mine(my)) return;
      hear();
    }
  };

  const size = 132;
  const showing = phase === 'show' || phase === 'peek';
  return (
    <div class="screen">
      <Backdrop theme="castle" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)' }}><Dots n={order.length} done={phase === 'show' ? 0 : qi} /></div>
        <div class="prompt" style={{ top: 40, fontSize: 30, padding: '6px 10px 6px 24px' }} data-target={phase === 'play' ? order[qi] : ''}>
          {phase === 'show'
            ? <span>👀 찾을 글자: <b style={{ color: '#e0488a' }}>{step.targets.join(' ')}</b> · 위치 기억하기 <b style={{ color: '#e0488a' }}>{left}</b></span>
            : phase === 'peek'
              ? <span>👀 다시 보기 <b style={{ color: '#e0488a' }}>{peekLeft}</b></span>
              : <><span key={ping} class="ear-ping" style={{ fontSize: 40 }}>👂</span><span>들은 글자 카드 찾기</span><Speaker onClick={hear} /></>}
        </div>
        {(phase === 'play' || phase === 'peek') && (
          <button class={`peek-btn ${peeks <= 0 || phase === 'peek' ? 'off' : ''}`} data-peek={peeks} onPointerDown={doPeek} aria-label="다시 보기">
            <span style={{ fontSize: 44 }}>👀</span>
            <span>다시 보기</span>
            <span class="peek-dots">{Array.from({ length: PEEKS }, (_, k) => <i class={k < peeks ? 'on' : ''} />)}</span>
          </button>
        )}
        <div style={{ position: 'absolute', left: 300, right: 40, top: 172, display: 'grid', gridTemplateColumns: `repeat(4, ${size}px)`, justifyContent: 'center', gap: 14 }}>
          {step.cards.map((c, i) => {
            const up = showing || found.includes(i) || peek === i || phase === 'end';
            const isT = step.targets.includes(c);
            return (
              <div class={`flip ${up ? 'up' : ''} ${found.includes(i) ? 'done' : ''} ${phase === 'show' && isT ? 'target-glow' : ''}`} style={{ width: size, height: size }} data-recall={c} data-up={up ? 1 : 0}
                data-a={phase === 'play' && c === order[qi] && !found.includes(i) ? 1 : 0} onPointerDown={(e) => tap(i, e)}>
                <div class="flip-in">
                  <div class="flip-back"><span>🐾</span>{hint === i && <span class="paw-hint">🐾</span>}</div>
                  <div class="flip-face" style={{ fontSize: !hasHangul(c) ? 74 : c.length > 1 ? 52 : 76, color: found.includes(i) || (phase === 'show' && isT) ? '#e0488a' : undefined }}>{c}</div>
                </div>
              </div>
            );
          })}
        </div>
        <Buddies size={160} mood={mood} />
      </div>
    </div>
  );
}
