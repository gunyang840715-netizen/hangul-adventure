// 받아쓰기 시험: 읽어 주는 글자를 보지 않고 쓰기
// - 그날 공부 끝(lesson): 통과해야 다음 단계가 열림 / 다음날 시작 전 복습(review): 떨어지면 전 단계를 다시 공부
// - 한 문제에 획을 세 번 틀리면(또는 '모르겠어') 그 문제는 틀림 → 쓰는 법을 보여 주고 다음 문제
// - 통과 기준: 맞힌 문제가 설정한 비율(기본 80%) 이상
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop } from '../art/Scene';
import { LetterGlyph, drawDuration } from '../art/LetterGlyph';
import { JAMO } from '../data/jamo';
import { say, sayAll, sfx } from '../engine/audio';
import { record } from '../engine/srs';
import { load } from '../engine/store';
import { decompose } from '../lib/hangul';
import { TraceBoard } from './Trace';
import { Buddies } from './Buddies';
import { useScene, praise, cue, CUE_GAP, Speaker, useTurn, type GameProps } from './common';
import { TEST_START, REVIEW_START, TEST_ASK, TEST_SHOW, TEST_PASS, TEST_FAIL, REVIEW_PASS, REVIEW_FAIL } from '../data/voice';

export const TEST_MISSES = 3;          // 한 문제에 획을 이만큼 틀리면 틀린 문제

/** 통과에 필요한 맞힌 문제 수 */
export function needToPass(n: number, pct = load().settings.testPass || 80) {
  return Math.min(n, Math.ceil(n * Math.max(10, Math.min(100, pct)) / 100));
}

type Mark = 'ok' | 'no' | null;

export function Dictation({ step, onDone, onResult }: GameProps<'dictation'> & { onResult?: (pass: boolean) => void }) {
  const { alive, sleep } = useScene();
  const order = step.order;
  const review = step.mode === 'review';
  const [qi, setQi] = useState(0);
  const [marks, setMarks] = useState<Mark[]>(() => order.map(() => null));
  const [phase, setPhase] = useState<'intro' | 'write' | 'show' | 'end'>('intro');
  const [miss, setMiss] = useState(0);
  const [mood, setMood] = useState<'happy' | 'think' | 'wow'>('happy');
  const [boardKey, setBoardKey] = useState(0);
  const S = useRef({ qi: 0, marks: order.map(() => null) as Mark[], busy: false });
  const turn = useTurn();
  const ch = order[Math.min(qi, order.length - 1)];
  const ask = (x: string) => sayAll([...cue(x), TEST_ASK], CUE_GAP);

  useEffect(() => {
    (async () => {
      const my = turn.n;
      await say(review ? REVIEW_START : TEST_START);
      if (!alive() || !turn.mine(my)) { if (alive()) setPhase('write'); return; }
      setPhase('write');
      ask(order[0]);
    })();
  }, []);

  const recordOf = (x: string, ok: boolean) => {
    if (JAMO[x]) record('j:' + x, ok);
    else { const p = decompose(x); if (p) record('j:' + p.cho, ok); }
  };

  const nextQ = async (my: number) => {
    const k = S.current.qi + 1;
    if (k >= order.length) { finish(); return; }
    S.current.qi = k; setQi(k); setMiss(0); setBoardKey(b => b + 1);
    setPhase('write'); setMood('happy');
    S.current.busy = false;
    if (!turn.mine(my)) return;
    ask(order[k]);
  };

  const mark = (m: Mark) => {
    const arr = [...S.current.marks]; arr[S.current.qi] = m; S.current.marks = arr; setMarks(arr);
  };

  const right = async () => {
    if (S.current.busy) return;
    S.current.busy = true;
    const my = turn.take();
    mark('ok'); recordOf(ch, true);
    setMood('wow');
    await praise(); if (!alive()) return;
    if (!await sleep(350)) return;
    nextQ(my);
  };

  const wrong = async () => {
    if (S.current.busy) return;
    S.current.busy = true;
    const my = turn.take();
    mark('no'); recordOf(ch, false);
    sfx.boing(); setMood('think');
    setPhase('show');
    // 쓰는 법 보여 주기 (한 획씩 그려짐)
    await say(TEST_SHOW); if (!alive()) return;
    await sayAll(cue(ch), CUE_GAP); if (!alive()) return;
    if (!await sleep(Math.max(600, drawDuration(ch) * 1000 - 1200))) return;
    nextQ(my);
  };

  const finish = async () => {
    setPhase('end');
    const n = order.length;
    const ok = S.current.marks.filter(m => m === 'ok').length;
    const pass = ok >= needToPass(n);
    const my = turn.take();
    if (pass) { sfx.fanfare(); setMood('wow'); } else { setMood('think'); }
    await say(pass ? (review ? REVIEW_PASS : TEST_PASS) : (review ? REVIEW_FAIL : TEST_FAIL));
    if (!alive() || !turn.mine(my)) return;
    if (!await sleep(900)) return;
    if (onResult) onResult(pass); else onDone();
  };

  const onMiss = (n: number) => {
    setMiss(n);
    if (n >= TEST_MISSES) wrong();
  };

  const n = order.length;
  const okCount = marks.filter(m => m === 'ok').length;
  const need = needToPass(n);
  return (
    <div class="screen" data-test={step.mode}>
      <Backdrop theme="library" />
      <div class="layer">
        <Buddies size={150} mood={mood} motion={mood === 'wow' ? 'jump' : 'bob'} reading />
        <div class="pill test-head" style={{ position: 'absolute', left: 120, top: 26, fontSize: 30 }}>
          📝 {review ? '복습 시험' : '받아쓰기 시험'} <b style={{ color: '#e0488a', marginLeft: 8 }}>{Math.min(qi + 1, n)}/{n}</b>
          {phase === 'write' && <Speaker style={{ width: 60, height: 60, fontSize: 30 }} onClick={() => ask(ch)} />}
        </div>
        <div class="test-marks" style={{ position: 'absolute', left: 30, top: 118, display: 'flex', flexWrap: 'wrap', gap: 6, width: 300 }}>
          {marks.map((m, i) => <span class={`test-mark ${m ?? ''} ${i === qi && phase !== 'end' ? 'cur' : ''}`}>{m === 'ok' ? '⭐' : m === 'no' ? '✖' : i + 1}</span>)}
        </div>
        <div class="pill" style={{ position: 'absolute', left: 30, top: 236, fontSize: 20, background: '#fff8d6' }}>통과: {need}개 이상 맞히기</div>
        {phase === 'write' && (
          <>
            <div key={boardKey}><TraceBoard ch={ch} guide="none" test onMiss={onMiss} onDone={right} onMood={m => setMood(m)} /></div>
            <div class="pill test-miss" style={{ position: 'absolute', left: 30, top: 300, fontSize: 22, gap: 4 }}>틀린 획 {Array.from({ length: TEST_MISSES }, (_, i) => <span style={{ opacity: i < miss ? 1 : 0.22, fontSize: 28 }}>💧</span>)}</div>
            <button class="btn" data-test-skip="1" style={{ position: 'absolute', right: 40, bottom: 40, fontSize: 28, background: '#e7f5ff', color: '#1864ab' }} onClick={() => { sfx.tap(); wrong(); }}>🤔 모르겠어</button>
          </>
        )}
        {phase === 'show' && (
          <div class="trace-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-show={ch}>
            <LetterGlyph ch={ch} size={500} draw face={!!JAMO[ch]} />
          </div>
        )}
        {phase === 'end' && (
          <div class="card slide-up" data-test-result={okCount >= need ? 'pass' : 'fail'} style={{ position: 'absolute', left: 380, top: 170, width: 560, padding: '36px 40px', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 56 }}>{okCount >= need ? '🎉 통과!' : '📚 다시 공부해요'}</div>
            <div style={{ fontSize: 34 }}>⭐ {okCount} / {n}</div>
            <div style={{ fontSize: 22, color: '#7a5b8f' }}>{okCount >= need ? (review ? '오늘 공부를 시작해요' : '다음 모험이 열렸어요') : (review ? '어제 배운 글자를 다시 공부해요' : '오늘 배운 글자를 한 번 더 공부하고 다시 봐요')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
