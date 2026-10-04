// 새 글자 소개: 한 획씩 그려지고 → 이름 → 소리 → 모양 이야기 → 예시 낱말
import { useEffect, useState } from 'preact/hooks';
import { Backdrop, burst, centerOf } from '../art/Scene';
import { LetterGlyph, drawDuration } from '../art/LetterGlyph';
import { JAMO } from '../data/jamo';
import { say, sayAll, sfx, petEx } from '../engine/audio';
import { introduce } from '../engine/srs';
import { josa } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, type GameProps } from './common';
import { introName, introSound, introExample, CUE_GAP } from '../data/voice';

export function Intro({ step, onDone, outfit }: GameProps<'intro'>) {
  const j = JAMO[step.ch];
  const pe = petEx(step.ch);
  const exWord = pe ? pe.w : j.ex.word, exEmoji = pe ? pe.e : j.ex.emoji;
  const { alive, sleep } = useScene();
  const [phase, setPhase] = useState<'draw' | 'name' | 'example' | 'tap'>('draw');
  const [text, setText] = useState('새 글자 친구를 만나 볼까?');
  const [bounce, setBounce] = useState(0);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    introduce('j:' + step.ch);
    (async () => {
      say('새 글자 친구를 만나 볼까?');
      if (!await sleep(drawDuration(step.ch) * 1000 + 700)) return;
      sfx.sparkle();
      setPhase('name'); setBounce(b => b + 1);
      setText(`이건 ${j.name}!`);
      await say(introName(step.ch)); if (!alive()) return;
      if (j.kind === 'c' && j.sound) {
        setText(`${j.name} 소리는 '${j.sound}'`);
        await sayAll(introSound(step.ch), CUE_GAP); if (!alive()) return;
      } else if (j.kind === 'v') {
        setText(`따라 해 봐! '${j.sound}'`);
        await sayAll(introSound(step.ch), CUE_GAP); if (!alive()) return;
      }
      setText(j.hint);
      await say(j.hint); if (!alive()) return;
      setPhase('example');
      setText(`${pe ? pe.w : j.ex.word}`);
      sfx.pop();
      if (pe) await say(pe.k); else await sayAll(introExample(step.ch), CUE_GAP);      // 대표 친구가 "기역, 거울의 기역"처럼 말해 줌
      if (!alive()) return;
      setPhase('tap');
      setText('글자 친구를 눌러 봐!');
      await say('글자 친구를 눌러 봐!');
      if (!await sleep(3500)) return;
      setCanNext(true);
    })();
  }, []);

  const tapLetter = (e: any) => {
    if (phase === 'draw') return;
    sfx.pop();
    setBounce(b => b + 1);
    const [x, y] = centerOf(e.currentTarget);
    burst(x, y);
    sayAll(j.kind === 'c' && j.sound ? [j.name, j.sound] : [j.name], CUE_GAP);
    if (phase === 'tap') setTimeout(() => setCanNext(true), 900);
  };

  return (
    <div class="screen">
      <Backdrop theme="library" />
      <div class="layer">
        <Buddies size={196} mood={phase === 'draw' ? 'wow' : 'happy'} reading />
        <div class="bubble-talk" key={text} style={{ left: 250, bottom: 60, fontSize: text.length > 18 ? 34 : 44 }}>{text}</div>
        <div style={{ position: 'absolute', left: 400, top: 40 }} onClick={tapLetter}>
          <div key={bounce} class={bounce ? 'glyph-bounce' : ''}>
            <div class="float"><LetterGlyph ch={step.ch} size={480} draw={phase === 'draw'} /></div>
          </div>
        </div>
        {(phase === 'example' || phase === 'tap') && (
          <div class="card slide-up" style={{ position: 'absolute', right: 40, top: 150, width: 220, height: 260, flexDirection: 'column', gap: 6 }}
            onClick={() => { sfx.tap(); if (pe) say(pe.k); else say(j.ex.word); }}>
            <div style={{ fontSize: 120 }}>{exEmoji}</div>
            <div style={{ fontSize: 44 }}><b style={{ color: j.color, fontWeight: 'normal' }}>{exWord.split(' ').pop()![0]}</b>{exWord.split(' ').pop()!.slice(1)}</div>
          </div>
        )}
        {canNext && <button class="btn big mint pulse slide-up" style={{ position: 'absolute', right: 50, bottom: 50 }} onClick={() => { sfx.tap(); onDone(); }}>다음 ▶</button>}
      </div>
    </div>
  );
}
