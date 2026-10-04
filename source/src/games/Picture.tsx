// 그림 ↔ 낱말 맞추기, 낱말 만들기
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { say, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { shuffle } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, praise, Dots, Speaker, gentle, useTurn, type GameProps, penalty } from './common';

export function Picture({ step, onDone, outfit }: GameProps<'picture'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [st, setSt] = useState<Record<number, 'wrong' | 'right' | 'hint'>>({});
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const lock = useRef(true);
  const miss = useRef(0);
  const helped = useRef(false);
  const r = step.rounds[ri];
  const p2w = step.mode === 'pic2word';

  const turn = useTurn();
  useEffect(() => {
    setSt({}); miss.current = 0; helped.current = false; lock.current = false;   // 말하는 중에도 바로 고를 수 있게
    (async () => {
      const my = turn.n;
      if (!await sleep(200) || !turn.mine(my)) return;
      if (ri === 0) say(p2w ? '그림을 보고, 맞는 글자를 찾아 봐!' : '글자를 읽고, 맞는 그림을 찾아 봐!');
      else if (!p2w) say('이건 뭐라고 읽을까?');
    })();
  }, [ri]);

  const choose = async (i: number, e: any) => {
    if (lock.current || st[i] === 'right') return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    const w = r.options[i];
    if (w.text === r.word.text) {
      lock.current = true;           // 다음 문제로 넘어가는 잠깐만
      setSt(s => ({ ...s, [i]: 'right' }));
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      setMood('wow');
      record('w:' + w.text, miss.current === 0 && !helped.current);
      sfx.ding();
      await say(w.text);
      if (!alive()) return;
      await praise();
      if (!alive()) return;
      setMood('happy');
      if (ri + 1 >= step.rounds.length) { sfx.fanfare(); if (await sleep(400)) onDone(); }
      else setRi(ri + 1);
    } else {
      miss.current++;
      sfx.boing(); penalty(); setMood('think');
      setSt(s => ({ ...s, [i]: 'wrong' }));
      setTimeout(() => { setSt(s => { const n = { ...s }; if (n[i] === 'wrong') delete n[i]; return n; }); setMood('happy'); }, 500);
      if (miss.current >= 2) setSt(s => ({ ...s, [r.options.indexOf(r.word)]: 'hint' }));
      await say(w.text); if (!alive() || !turn.mine(my)) return;
      gentle();
    }
  };

  const help = () => { helped.current = true; say(r.word.text); };

  return (
    <div class="screen">
      <Backdrop theme="meadow" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.rounds.length} done={ri} /></div>
        <div key={ri} class="card slide-up" style={{ position: 'absolute', left: 250, top: 150, width: 420, height: 440, flexDirection: 'column' }}>
          {p2w ? <div class="emoji-big">{r.word.emoji}</div>
            : <div style={{ fontSize: r.word.text.length > 3 ? 100 : 140, color: '#5a3d73' }}>{r.word.text}</div>}
          {!p2w && <Speaker style={{ position: 'absolute', right: -30, bottom: -30, width: 80, height: 80, fontSize: 36 }} onClick={help} />}
        </div>
        <div key={'o' + ri} style={{ position: 'absolute', left: 730, top: 130, display: 'flex', flexDirection: 'column', gap: 26 }}>
          {r.options.map((w, i) => (
            <button class={`card slide-up ${st[i] === 'wrong' ? 'shake' : ''} ${st[i] === 'right' ? 'right-glow' : ''} ${st[i] === 'hint' ? 'hint-glow' : ''}`}
              style={{ width: 460, height: 150, fontSize: p2w ? (w.text.length > 4 ? 60 : 78) : 100, color: '#5a3d73', animationDelay: `${i * 0.08}s` }}
              data-a={w.text === r.word.text ? 1 : 0} onPointerDown={(e) => choose(i, e)}>
              {p2w ? w.text : w.emoji}
            </button>
          ))}
        </div>
        <Buddies size={170} mood={mood} />
      </div>
    </div>
  );
}

// ---------- 낱말 만들기: 그림 보고 글자 조각을 순서대로 ----------
export function Build({ step, onDone, outfit }: GameProps<'build'>) {
  const { alive, sleep } = useScene();
  const [wi, setWi] = useState(0);
  const [filled, setFilled] = useState(0);
  const [bad, setBad] = useState<number | null>(null);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const lock = useRef(true);
  const miss = useRef(0);
  const w = step.words[wi];
  const [tiles, setTiles] = useState<string[]>([]);

  useEffect(() => {
    if (!w) { onDone(); return; }
    const extra = step.extra.filter(x => !w.text.includes(x)).slice(0, 2);
    setTiles(shuffle([...w.text, ...extra]));
    setFilled(0); setUsed(new Set()); miss.current = 0; lock.current = false;   // 말하는 중에도 바로 누를 수 있게
    (async () => {
      if (!await sleep(200)) return;
      say(wi === 0 ? '그림에 맞게 글자를 차례대로 눌러 봐!' : '이번 그림은 뭘까?');
    })();
  }, [wi]);

  if (!w) return null;

  const tap = async (i: number, ch: string, e: any) => {
    if (lock.current || used.has(i)) return;
    if (ch === w.text[filled]) {
      sfx.pop();
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      setUsed(u => new Set(u).add(i));
      const nf = filled + 1;
      setFilled(nf);
      say(ch);
      if (nf >= w.text.length) {
        lock.current = true;
        setMood('wow');
        record('w:' + w.text, miss.current === 0);
        await sleep(500);
        sfx.sparkle();
        await say(w.text);
        if (!alive()) return;
        await praise();
        if (!alive()) return;
        setMood('happy');
        if (wi + 1 >= step.words.length) { sfx.fanfare(); onDone(); }
        else setWi(wi + 1);
      }
    } else {
      miss.current++;
      sfx.boing(); penalty(); setBad(i); setMood('think');
      setTimeout(() => { setBad(null); setMood('happy'); }, 500);
      say(ch);
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="beach" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.words.length} done={wi} /></div>
        <div key={wi} class="card slide-up" style={{ position: 'absolute', left: 280, top: 110, width: 300, height: 300 }}>
          <div class="emoji-big" style={{ fontSize: 170 }}>{w.emoji}</div>
        </div>
        <div style={{ position: 'absolute', left: 620, top: 170, display: 'flex', gap: 18 }}>
          {[...w.text].map((ch, i) => (
            <div class={`slot ${i < filled ? 'filled' : i === filled ? 'want' : ''}`} style={{ position: 'relative', width: 150, height: 170, fontSize: 110, color: '#5a3d73', background: i < filled ? '#fff' : undefined, boxShadow: i < filled ? 'var(--shadow)' : undefined }}>
              {i < filled ? <span class="glyph-bounce">{ch}</span> : ''}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 260, right: 40, top: 520, display: 'flex', justifyContent: 'center', gap: 22 }}>
          {tiles.map((ch, i) => (
            <button class={`card ${bad === i ? 'shake' : ''}`} style={{ width: 150, height: 150, fontSize: 96, color: '#5a3d73', opacity: used.has(i) ? 0.2 : 1 }} data-a={ch === w.text[filled] && !used.has(i) ? 1 : 0} onPointerDown={(e) => tap(i, ch, e)}>{ch}</button>
          ))}
        </div>
        <Buddies size={170} mood={mood} />
      </div>
    </div>
  );
}
