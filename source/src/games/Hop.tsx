// 징검다리: 들려주는 글자 돌을 밟고 강을 건너 갇힌 글자 친구 구하기
import { useEffect, useRef, useState } from 'preact/hooks';
import { burst } from '../art/Scene';
import { Buddy } from './Buddies';
import { buddy } from '../engine/bus';
import { LetterGlyph } from '../art/LetterGlyph';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { decompose } from '../lib/hangul';
import { useScene, praise, spoken, cue, sayCue, gentle, useTurn, Dots, Speaker, type GameProps, CUE_GAP, penalty } from './common';

const LANES = [330, 490, 650];
const COL_X = 700;
const ME_X = 250;

const HOP_GENTLE = ['괜찮아~ 다시 밟아 보자!', '괜찮아, 천천히 다시 골라 볼까?'];

export function Hop({ step, onDone, outfit }: GameProps<'hop'>) {
  const { alive, sleep } = useScene();
  const [ri, setRi] = useState(0);
  const [me, setMe] = useState({ x: ME_X - 150, y: 300, jump: 0 });
  // 다른 친구는 한 발 뒤에서 따라온다 (돌 위에는 절대 서지 않음)
  const [pal, setPal] = useState({ x: ME_X - 290, y: 330, jump: 0 });
  useEffect(() => {
    // 주인공이 강 가운데 돌에 있으면 → 방금 떠난 자리(왼쪽 돌/언덕), 아니면 주인공 바로 뒤
    const onColumn = me.x > ME_X + 100;
    const target = onColumn ? { x: ME_X - 120, y: me.y + 40 } : { x: me.x - 150, y: me.y + 40 };
    const t = setTimeout(() => setPal(p => (p.x === target.x && p.y === target.y ? p : { ...target, jump: p.jump + 1 })), 300);
    return () => clearTimeout(t);
  }, [me.x, me.y]);
  const [sunk, setSunk] = useState<number | null>(null);
  const [scroll, setScroll] = useState(false);
  const [mood, setMood] = useState<'happy' | 'wow' | 'think'>('happy');
  const [arrived, setArrived] = useState(false);
  const [freed, setFreed] = useState(false);
  const [showStones, setShowStones] = useState(true);
  const busy = useRef(true);
  const miss = useRef(0);
  const round = step.rounds[Math.min(ri, step.rounds.length - 1)];
  const last = ri >= step.rounds.length;

  const cueText = useRef<string[]>([]);
  const ask = () => sayAll([...(cueText.current.length ? cueText.current : [spoken(round.answer)]), '밟아 봐!'], CUE_GAP);

  const turn = useTurn();
  useEffect(() => {
    miss.current = 0;
    if (last) return;
    busy.current = false;            // 말하는 중에도 바로 밟을 수 있게
    cueText.current = cue(round.answer);
    (async () => {
      const my = turn.n;
      if (ri === 0) { await say('글자 돌을 밟고 강을 건너자!'); if (!alive() || !turn.mine(my)) return; }
      ask();
    })();
  }, [ri]);

  const jumpTo = (x: number, y: number) => {
    sfx.hop();
    setMe(m => ({ x, y, jump: m.jump + 1 }));
  };

  const choose = async (opt: string, i: number) => {
    if (busy.current) return;
    const my = turn.take();          // 하던 말 멈추고 바로 반응
    if (opt === round.answer) {
      busy.current = true;           // 건너가는 동안만
      jumpTo(COL_X - 95, LANES[i] - 195);
      setMood('wow');
      sfx.ding();
      const id = round.id?.startsWith('x:') ? 'j:' + decompose(round.answer)!.cho : round.id;
      if (id) record(id, miss.current === 0);
      await sleep(380);
      burst(COL_X, LANES[i] - 20);
      praise();
      if (!alive()) return;
      setMood('happy');
      // 화면 흘러가기
      setShowStones(false);
      setScroll(true);
      setMe(m => ({ x: ME_X - 95, y: LANES[i] - 195, jump: m.jump }));
      await sleep(600);
      if (!alive()) return;
      setScroll(false);
      if (ri + 1 >= step.rounds.length) {
        // 도착!
        setArrived(true);
        await sleep(400);
        jumpTo(790, 150);
        await sleep(500);
        busy.current = false;
        setRi(ri + 1);
        say('도착! 갇힌 친구를 눌러서 구해 줘!');
        return;
      }
      setShowStones(true);
      setRi(ri + 1);
    } else {
      miss.current++;
      sfx.splash(); penalty();
      setSunk(i); setMood('think');
      setTimeout(() => { setSunk(s => (s === i ? null : s)); setMood('happy'); }, 700);
      await sayCue(opt); if (!alive() || !turn.mine(my)) return;
      await gentle(HOP_GENTLE); if (!alive() || !turn.mine(my)) return;
      ask();
    }
  };

  const free = async () => {
    if (freed || !last || busy.current) return;
    setFreed(true);
    buddy({ t: 'big' });
    sfx.pop(); burst(1120, 380, 'star');
    sfx.fanfare();
    await say(`친구를 구했어! 고마워!`);
    if (await sleep(700)) onDone();
  };

  return (
    <div class="screen">
      <div class="backdrop" style={{ background: 'linear-gradient(180deg,#bfe6ff,#effaff 60%)' }} />
      <div class="river" style={{ height: 'calc(520px + var(--top))' }} />
      <div class="layer">
        {/* 출발 언덕 (화면 왼쪽 끝까지) */}
        <div class="bank" style={{ left: 'calc(-60px - var(--side))', bottom: 'calc(-1 * var(--top))', width: ri === 0 && !scroll ? 'calc(260px + var(--side))' : 0, borderRadius: '0 120px 0 0', transition: 'width .6s', height: 'calc(330px + var(--top))' }} />
        {/* 도착 섬 (화면 오른쪽 끝까지) */}
        <div class="bank" style={{ right: 'calc(-1 * var(--side))', bottom: 'calc(-1 * var(--top))', width: `calc(${arrived ? 520 : 150 + ri * 20}px + var(--side))`, borderRadius: '160px 0 0 0', transition: 'width .8s, height .8s', height: `calc(${arrived ? 470 : 380}px + var(--top))` }}>
          {(

            <div data-rescue={freed || !arrived ? 0 : 1} style={{ position: 'absolute', left: arrived ? 250 : 20, top: arrived ? -150 : -110, transform: arrived ? 'none' : 'scale(.6)', transformOrigin: 'left bottom', transition: 'all .8s' }} onPointerDown={free}>
              <div class={freed ? 'glyph-bounce' : 'float'}>
                <LetterGlyph ch={step.friend} size={220} mood={freed ? 'happy' : 'sleep'} />
              </div>
              {!freed && <div class="bubble" style={{ position: 'absolute', left: -20, top: -20, width: 260, height: 260, pointerEvents: 'none' }} />}
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)' }}><Dots n={step.rounds.length} done={ri} /></div>
        {!last && <div class="prompt" style={{ top: 110 }}><span>어떤 돌일까?</span><Speaker onClick={ask} /></div>}
        {/* 지나온 돌 */}
        {ri > 0 && !arrived && <div class="stone" style={{ left: ME_X - 95, top: me.y + 195 - 65, transition: 'none' }} />}
        {!last && showStones && round.options.map((o, i) => (
          <button key={`${ri}-${i}`} class={`stone slide-up ${sunk === i ? 'sink' : ''}`}
            style={{ left: COL_X - 95, top: LANES[i] - 65, fontSize: o.length > 2 ? 44 : 64, animationDelay: `${i * 0.1}s` }}
            data-a={o === round.answer ? 1 : 0} onPointerDown={() => choose(o, i)}>{o}</button>
        ))}
        {/* 따라오는 친구가 딛고 선 작은 돌 */}
        {ri > 0 && !arrived && <div class="stone" style={{ left: pal.x - 5, top: pal.y + 118, transform: 'scale(.8)', transition: 'left .45s, top .45s', pointerEvents: 'none', zIndex: 4 }} />}
        <div style={{ position: 'absolute', left: pal.x, top: pal.y, transition: 'left .45s ease-out, top .45s cubic-bezier(.2,-0.8,.6,1)', zIndex: 5, pointerEvents: 'none' }}>
          <div key={pal.jump} class={pal.jump ? 'glyph-bounce' : ''}>
            <Buddy who="other" size={160} mood={mood === 'think' ? 'think' : 'happy'} motion={freed ? 'cheer' : 'bob'} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: me.x, top: me.y, transition: scroll ? 'left .6s ease-in-out' : 'left .45s ease-out, top .45s cubic-bezier(.2,-0.8,.6,1)', zIndex: 6, pointerEvents: 'none' }}>
          <div key={me.jump} class={me.jump ? 'glyph-bounce' : ''}>
            <Buddy who="lead" size={190} mood={mood} motion={freed ? 'cheer' : 'bob'} />
          </div>
        </div>
      </div>
    </div>
  );
}

