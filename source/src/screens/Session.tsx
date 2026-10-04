// 모험 진행: 단계(Step)들을 차례로 보여 준다
// - 놀이·쓰기를 끝낼 때마다 선물(간식·꾸미기)
// - 매 단계마다 '이어하기' 위치 저장 → 시간이 다 되면 이번 놀이까지만 하고 쉬고, 시간이 풀리면 그 자리부터
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Step } from '../engine/session';
import { sfx, stopVoice, say } from '../engine/audio';
import { remainingMs, setResume } from '../engine/store';
import { giftFor, type Gift } from '../engine/gifts';
import { Intro } from '../games/Intro';
import { Trace, TraceSet } from '../games/Trace';
import { Hunt, Mole, Memory, Feed } from '../games/More';
import { Bubble } from '../games/Bubble';
import { Cards } from '../games/Cards';
import { Blend } from '../games/Blend';
import { Hop } from '../games/Hop';
import { Picture, Build } from '../games/Picture';
import { Greet, Batchim, SentenceGame, Rescue } from '../games/Story';
import { Reward } from '../games/Reward';
import { Recall } from '../games/Recall';
import { Dictation } from '../games/Dictation';
import { GiftPop } from '../games/Gift';
import { Backdrop } from '../art/Scene';
import { Buddy } from '../games/Buddies';
import { LESSONS, UNITS } from '../data/curriculum';

interface Props {
  steps: Step[]; lessonIdx: number; name: string;
  startAt?: number; replay?: boolean; play?: boolean; resumed?: boolean;
  onFinish: () => void; onQuit: () => void; onPause: () => void; demo?: boolean;
  onFail?: () => void;   // 받아쓰기 시험에 떨어짐 (다음 단계로 못 감)
}

const KNOWN = new Set(['greet', 'intro', 'trace', 'traceSet', 'hunt', 'mole', 'memory', 'feed', 'bubble', 'cards', 'blend', 'hop', 'picture', 'build', 'batchim', 'sentence', 'rescue', 'reward', 'recall', 'dictation']);
const GRACE = 4 * 60000;   // 시간이 다 된 뒤에도 지금 놀이는 이만큼 더 할 수 있음

export function Session({ steps, lessonIdx, name, startAt = 0, replay = false, play = false, resumed = false, onFinish, onQuit, onPause, demo, onFail }: Props) {
  const [i, setI] = useState(() => Math.max(0, Math.min(startAt, steps.length - 1)));
  const [started, setStarted] = useState(!resumed);
  const [gift, setGift] = useState<Gift | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [late, setLate] = useState(false);          // 시간이 다 됨 → 이번 놀이까지만
  const overSince = useRef(0);
  const step = steps[i];
  const timeUp = () => !demo && remainingMs() <= 0;

  // 이어하기 위치 저장 (놀이터는 저장 안 함)
  const saveAt = (idx: number) => { if (!play) setResume({ lessonIdx, replay, stepIdx: idx, steps, at: Date.now() }); };
  useEffect(() => { saveAt(i); }, [i]);

  // 시간이 다 됐는지 살피기
  useEffect(() => {
    const t = setInterval(() => {
      if (!timeUp()) { overSince.current = 0; setLate(false); return; }
      if (!overSince.current) {
        overSince.current = Date.now();
        setLate(true);
        say('오늘 놀 시간이 다 됐어. 이번 놀이까지만 하자!', { interrupt: false });
      } else if (Date.now() - overSince.current > GRACE) {
        // 너무 길어지면 지금 단계부터 다음에 이어서
        stopVoice(); saveAt(i); onPause();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [i]);

  const advance = () => {
    setGift(null);
    if (i + 1 >= steps.length) { onFinish(); return; }
    if (timeUp()) { saveAt(i + 1); onPause(); return; }
    setI(i + 1);
  };
  const next = () => {
    const g = step ? giftFor(step.t) : null;
    if (g) setGift(g); else advance();
  };
  // 모르는 단계(옛 저장본)는 건너뛰기
  useEffect(() => { if (step && !KNOWN.has(step.t)) advance(); }, [i]);

  if (!step) return null;
  if (!started) return <ResumeCard lessonIdx={lessonIdx} done={i} total={steps.length} onGo={() => { sfx.tap(); setStarted(true); }} />;
  const P = { step: step as any, onDone: next, outfit: {}, name };
  const view = (() => {
    switch (step.t) {
      case 'greet': return <Greet {...P} lessonIdx={lessonIdx} />;
      case 'intro': return <Intro {...P} />;
      case 'trace': return <Trace {...P} />;
      case 'traceSet': return <TraceSet {...P} />;
      case 'hunt': return <Hunt {...P} />;
      case 'mole': return <Mole {...P} />;
      case 'memory': return <Memory {...P} />;
      case 'feed': return <Feed {...P} />;
      case 'bubble': return <Bubble {...P} />;
      case 'cards': return <Cards {...P} />;
      case 'blend': return <Blend {...P} />;
      case 'hop': return <Hop {...P} />;
      case 'picture': return <Picture {...P} />;
      case 'build': return <Build {...P} />;
      case 'batchim': return <Batchim {...P} />;
      case 'sentence': return <SentenceGame {...P} />;
      case 'rescue': return <Rescue {...P} />;
      case 'reward': return <Reward {...P} />;
      case 'recall': return <Recall {...P} />;
      // 받아쓰기 시험: 통과하면 다음으로, 떨어지면 여기서 끝 (다시 하기 모험·놀이터에서는 결과와 상관없이 계속)
      case 'dictation': return <Dictation {...P} onResult={(pass) => { if (pass || !onFail) next(); else { stopVoice(); onFail(); } }} />;
    }
    return null;
  })();
  const playable = steps.filter(s => s.t !== 'greet' && s.t !== 'reward');
  const pos = playable.indexOf(step as any);
  return (
    <div class="screen">
      <div class="screen" key={i}>{view}</div>
      {gift && <GiftPop key={'g' + i} gift={gift} onDone={advance} />}
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); setConfirmQuit(true); }} aria-label="지도로">🏠</button>
        {late && <div class="pill late-pill">🌙 이번 놀이까지만 하고 쉬어요</div>}
        {demo && <button class="iconbtn" style={{ marginLeft: 'auto', background: '#e5dbff' }} onClick={() => { stopVoice(); advance(); }} aria-label="넘기기">⏭</button>}
      </div>
      {pos >= 0 && playable.length > 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 10, background: 'rgba(255,255,255,.6)', zIndex: 25 }}>
          <div style={{ height: '100%', width: `${(pos + 0.5) / playable.length * 100}%`, background: 'linear-gradient(90deg,#ffd43b,#ff8fb8)', borderRadius: '0 8px 8px 0', transition: 'width .6s' }} />
        </div>
      )}
      {confirmQuit && (
        <div class="overlay" style={{ zIndex: 60, background: 'rgba(60,30,90,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div class="card slide-up" style={{ padding: '40px 50px', flexDirection: 'column', gap: 30 }}>
            <div style={{ fontSize: 48 }}>지도로 돌아갈까?</div>
            {!play && <div style={{ fontSize: 26, color: '#7a5b8f' }}>다음에 여기부터 이어서 할 수 있어요</div>}
            <div style={{ display: 'flex', gap: 30 }}>
              <button class="btn mint" onClick={() => { sfx.tap(); setConfirmQuit(false); }}>계속 할래</button>
              <button class="btn" onClick={() => { sfx.tap(); stopVoice(); onQuit(); }}>지도로</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 쉬었다가 다시 왔을 때: 하던 곳부터 */
function ResumeCard({ lessonIdx, done, total, onGo }: { lessonIdx: number; done: number; total: number; onGo: () => void }) {
  const l = LESSONS[Math.min(lessonIdx, LESSONS.length - 1)];
  const u = UNITS[l.unit - 1];
  useEffect(() => { say('하던 모험을 이어서 하자!'); }, []);
  return (
    <div class="screen" onClick={onGo}>
      <Backdrop theme="sky" />
      <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 50 }}>
        <div style={{ position: 'relative', width: 420, height: 400 }}>
          <div style={{ position: 'absolute', left: 190, top: 150 }}><Buddy who="other" size={240} motion="bob" /></div>
          <div style={{ position: 'absolute', left: -20, top: 20 }}><Buddy who="lead" size={360} motion="jump" /></div>
        </div>
        <div class="slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 70, color: '#e0488a', textShadow: '0 4px 0 #fff' }}>이어서 하자!</div>
          <div class="pill" style={{ fontSize: 36 }}><span>{u.emoji}</span> {u.name} · {l.title}</div>
          <div class="pill" style={{ fontSize: 28, background: '#fff8d6' }}>🚩 {Math.round(done / Math.max(1, total) * 100)}% 했어요</div>
          <button class="btn big pulse" data-resume="1" onClick={(e) => { e.stopPropagation(); onGo(); }}>이어서 하기 ▶</button>
        </div>
      </div>
    </div>
  );
}
