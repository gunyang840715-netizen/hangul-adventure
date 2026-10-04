// 인사, 받침 소개, 문장 읽기, 친구 구하기
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { LetterGlyph } from '../art/LetterGlyph';
import { JAMO } from '../data/jamo';
import { LESSONS, UNITS } from '../data/curriculum';
import { say, sayAll, sfx } from '../engine/audio';
import { introduce, record } from '../engine/srs';
import { adventuresTotal } from '../engine/store';
import { compose, josa, shuffle } from '../lib/hangul';
import { Buddies, Buddy } from './Buddies';
import { useScene, praise, spoken, Dots, Speaker, gentle, type GameProps, penalty } from './common';
import { batchimAsk, batchimEnd } from '../data/voice';

// ---------- 인사 ----------
export function Greet({ onDone, outfit, name, lessonIdx }: GameProps<'greet'> & { lessonIdx: number }) {
  const { alive } = useScene();
  const [ready, setReady] = useState(false);
  const l = LESSONS[lessonIdx];
  const u = UNITS[(l?.unit ?? 1) - 1];
  const n = adventuresTotal() + 1;
  useEffect(() => {
    (async () => {
      const hello = `${name}${josa(name, '아', '야')}, 안녕!`;
      const lines = [hello, `오늘은 ${u.name}에서 모험할 거야.`];
      if (l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons') lines.push('새 글자 친구들이 기다리고 있어!');
      else if (l.kind === 'batchim') lines.push('오늘은 받침 친구를 만날 거야!');
      else if (l.kind === 'sentence') lines.push('오늘은 이야기를 읽어 보자!');
      else lines.push('배운 글자로 낱말을 읽어 보자!');
      await sayAll(lines);
      if (alive()) setReady(true);
    })();
    const t = setTimeout(() => setReady(true), 1500);   // 인사 중에도 곧 눌러서 넘어갈 수 있게
    return () => clearTimeout(t);
  }, []);
  return (
    <div class="screen" onClick={() => ready && onDone()}>
      <Backdrop theme="sky" />
      <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 60 }}>
        <div style={{ position: 'relative', width: 420, height: 400 }}>
          <div style={{ position: 'absolute', left: 190, top: 150 }}><Buddy who="other" size={240} motion="bob" /></div>
          <div style={{ position: 'absolute', left: -20, top: 20 }}><Buddy who="lead" size={360} motion="jump" /></div>
        </div>
        <div class="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 76, color: '#e0488a', textShadow: '0 4px 0 #fff, 0 8px 16px rgba(200,60,120,.25)' }}>{name}{josa(name, '아', '야')}, 안녕!</div>
          <div class="pill" style={{ fontSize: 40 }}><span>{u.emoji}</span> {u.name} · {l.title}</div>
          <div class="pill" style={{ fontSize: 28, background: '#fff8d6' }}>🎒 {n}번째 모험</div>
          {ready && <button class="btn big pulse" onClick={(e) => { e.stopPropagation(); sfx.tap(); onDone(); }}>출발! ▶</button>}
        </div>
      </div>
    </div>
  );
}

// ---------- 받침 소개 ----------
const END: Record<string, string> = { 'ㅇ': '응', 'ㄴ': '은', 'ㅁ': '음', 'ㄹ': '을', 'ㄱ': '윽', 'ㅂ': '읍', 'ㅅ': '읃' };

export function Batchim({ step, onDone, outfit }: GameProps<'batchim'>) {
  const { alive, sleep } = useScene();
  const b = step.b;
  const bases = [['ㄱ', 'ㅏ'], ['ㄱ', 'ㅗ'], ['ㅂ', 'ㅏ']];
  const [k, setK] = useState(0);
  const [drop, setDrop] = useState(false);
  const [done, setDone] = useState(false);
  const [text, setText] = useState('');
  const [c, v] = bases[k];
  const base = compose(c, v), full = compose(c, v, b);
  const first = b === 'ㅇ';

  useEffect(() => {
    introduce('b:' + b);
    (async () => {
      const intro = first
        ? ['받침은 글자 밑에서 받쳐 주는 친구야.', '받침이 붙으면 소리가 바뀌어!']
        : [`오늘의 받침 친구는 ${spoken(b)}${josa(spoken(b), '이야', '야')}.`];
      setText(intro[0]);
      await sayAll(intro);
      for (let i = 0; i < bases.length; i++) {
        if (!alive()) return;
        setK(i); setDrop(false);
        const [cc, vv] = bases[i];
        const bs = compose(cc, vv), fl = compose(cc, vv, b);
        setText(`${bs} + 받침 ${b}`);
        await say(batchimAsk(bs, b));
        if (!alive()) return;
        setDrop(true); sfx.whoosh();
        if (!await sleep(700)) return;
        sfx.sparkle(); burst(640, 360);
        setText(`${fl}!`);
        await say(fl);
        if (!await sleep(500)) return;
      }
      setText(`받침 ${b} 소리: ${END[b]}`);
      await say(batchimEnd(b));
      if (!alive()) return;
      await sayAll(['아', compose('ㅇ', 'ㅏ', b)], 420);
      setDone(true);
    })();
  }, []);

  return (
    <div class="screen">
      <Backdrop theme="castle" />
      <div class="layer">
        <div class="bubble-talk" key={text} style={{ left: 250, top: 60, fontSize: 42 }}>{text}</div>
        <div class="block" style={{ left: 480, top: 220, width: 360, height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div key={`${k}-${drop}`} class="glyph-bounce" style={{ fontSize: 280, color: '#5a3d73', lineHeight: 1 }}>{drop ? full : base}</div>
        </div>
        {!drop && (
          <div key={'b' + k} class="float" style={{ position: 'absolute', left: 900, top: 240 }}>
            <LetterGlyph ch={b} size={220} />
          </div>
        )}
        {drop && <div class="slide-up" style={{ position: 'absolute', left: 890, top: 330, fontSize: 70, color: '#7048e8' }}>{base} + {b} = {full}</div>}
        <Buddies size={178} />
        {done && <button class="btn big mint pulse slide-up" style={{ position: 'absolute', right: 50, bottom: 50 }} onClick={() => { sfx.tap(); onDone(); }}>다음 ▶</button>}
      </div>
    </div>
  );
}

// ---------- 문장 읽기 ----------
export function SentenceGame({ step, onDone, outfit }: GameProps<'sentence'>) {
  const { alive, sleep } = useScene();
  const [si, setSi] = useState(0);
  const [phase, setPhase] = useState<'read' | 'order'>('read');
  const [hl, setHl] = useState(-1);
  const [order, setOrder] = useState<string[]>([]);
  const [placed, setPlaced] = useState(0);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [bad, setBad] = useState<number | null>(null);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const lock = useRef(true);
  const miss = useRef(0);
  const s = step.items[si];

  useEffect(() => {
    if (!s) { onDone(); return; }
    setPhase('read'); setPlaced(0); setUsed(new Set()); miss.current = 0; lock.current = true;
    (async () => {
      if (!await sleep(300)) return;
      if (si === 0) { await say('같이 읽어 보자!'); }
      for (let i = 0; i < s.chunks.length; i++) {
        if (!alive()) return;
        setHl(i);
        await say(s.chunks[i]);
        await sleep(120);
      }
      setHl(-1);
      if (!await sleep(300)) return;
      await say(s.text);
      if (!alive()) return;
      // 조각을 먼저 보여 주고 바로 누를 수 있게 (안내는 그동안 들려줌)
      setOrder(shuffle(s.chunks.map((_, i) => String(i))));
      setPhase('order');
      lock.current = false;
      say('이번엔 순서대로 눌러서 문장을 만들어 봐!');
    })();
  }, [si]);

  if (!s) return null;

  const tapChunk = async (idxStr: string, i: number, e: any) => {
    if (lock.current || used.has(i)) return;
    const ci = +idxStr;
    if (s.chunks[ci] === s.chunks[placed]) {
      sfx.pop();
      const [x, y] = centerOf(e.currentTarget); burst(x, y);
      setUsed(u => new Set(u).add(i));
      say(s.chunks[ci]);
      const np = placed + 1;
      setPlaced(np);
      if (np >= s.chunks.length) {
        lock.current = true;
        record('s:' + s.text, miss.current === 0);
        setMood('wow');
        await sleep(500);
        await say(s.text);
        if (!alive()) return;
        await praise(true);
        if (!alive()) return;
        setMood('happy');
        if (si + 1 >= step.items.length) { sfx.fanfare(); onDone(); }
        else setSi(si + 1);
      }
    } else {
      miss.current++;
      sfx.boing(); penalty(); setBad(i); setMood('think');
      setTimeout(() => { setBad(null); setMood('happy'); }, 500);
      if (miss.current % 2 === 0) say(s.text);   // 두 번 틀리면 문장을 다시 들려주기
      else gentle();
    }
  };

  return (
    <div class="screen">
      <Backdrop theme="sky" />
      <div class="layer">
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.items.length} done={si} /></div>
        <div key={si} class="card slide-up" style={{ position: 'absolute', left: 470, top: 90, width: 340, height: 220 }}>
          <div style={{ fontSize: 130 }}>{s.emoji}</div>
        </div>
        {phase === 'read' ? (
          <div class="sentence" style={{ position: 'absolute', left: 240, right: 40, top: 380 }}>
            {s.chunks.map((c, i) => <span class={`chunk ${hl === i ? 'hl' : ''}`} onClick={() => { sfx.tap(); say(c); }}>{c}</span>)}
            <span style={{ opacity: .5 }}>{s.text.slice(-1)}</span>
          </div>
        ) : (
          <>
            <div class="prompt" style={{ top: 160, left: 'auto', right: 50, transform: 'none', padding: '8px 12px 8px 26px' }}><span style={{ fontSize: 32 }}>들은 문장 만들기</span><Speaker onClick={() => say(s.text)} /></div>
            <div class="sentence" style={{ position: 'absolute', left: 240, right: 40, top: 350, minHeight: 120 }}>
              {s.chunks.map((c, i) => <span class={`slot ${i < placed ? 'filled' : i === placed ? 'want' : ''}`} style={{ position: 'relative', minWidth: 120 + c.length * 40, height: 120, fontSize: 70, background: i < placed ? '#fff' : undefined, boxShadow: i < placed ? 'var(--shadow)' : undefined }}>{i < placed ? c : ''}</span>)}
            </div>
            <div style={{ position: 'absolute', left: 240, right: 40, top: 560, display: 'flex', justifyContent: 'center', gap: 24 }}>
              {order.map((o, i) => (
                <button class={`card ${bad === i ? 'shake' : ''}`} style={{ padding: '0 30px', height: 130, fontSize: 70, color: '#5a3d73', opacity: used.has(i) ? 0.2 : 1 }} data-a={s.chunks[+o] === s.chunks[placed] && !used.has(i) ? 1 : 0} onPointerDown={(e) => tapChunk(o, i, e)}>{s.chunks[+o]}</button>
              ))}
            </div>
          </>
        )}
        <Buddies size={170} mood={mood} />
      </div>
    </div>
  );
}

// ---------- 친구 구하기 ----------
export function Rescue({ step, onDone, outfit }: GameProps<'rescue'>) {
  const { alive, sleep } = useScene();
  const [freed, setFreed] = useState<Set<number>>(new Set());
  const friends = step.friends;
  useEffect(() => {
    if (!friends.length) { onDone(); return; }
    say(friends.length > 1 ? '방울 속에 글자 친구들이 갇혀 있어! 눌러서 구해 줘!' : '방울 속에 글자 친구가 갇혀 있어! 눌러서 구해 줘!');
  }, []);
  if (!friends.length) return null;
  const tap = async (i: number, e: any) => {
    if (freed.has(i)) return;
    sfx.pop();
    const [x, y] = centerOf(e.currentTarget); burst(x, y);
    const nf = new Set(freed).add(i);
    setFreed(nf);
    const f = friends[i];
    record(JAMO[f] ? 'j:' + f : 'b:' + f, true);
    await sayAll([spoken(f), '고마워!'], 380);
    if (nf.size >= friends.length && alive()) {
      sfx.fanfare();
      burst(640, 0, 'confetti');
      await say('글자 친구들이 스티커북에 들어갔어!');
      if (await sleep(600)) onDone();
    }
  };
  return (
    <div class="screen">
      <Backdrop theme="night" />
      <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
        {friends.map((f, i) => (
          <div data-rescue={freed.has(i) ? 0 : 1} style={{ position: 'relative', width: 280, height: 280 }} onPointerDown={(e) => tap(i, e)}>
            <div class={freed.has(i) ? 'glyph-bounce' : 'float'} style={{ animationDelay: `${i * 0.3}s` }}>
              <LetterGlyph ch={f} size={280} mood={freed.has(i) ? 'happy' : 'sleep'} />
            </div>
            {!freed.has(i) && <div class="bubble" style={{ position: 'absolute', left: -20, top: -20, width: 320, height: 320, pointerEvents: 'none', opacity: .75 }} />}
          </div>
        ))}
        <Buddies size={170} style={{ zIndex: 3 }} motion={freed.size >= friends.length ? 'cheer' : 'bob'} />
      </div>
    </div>
  );
}
