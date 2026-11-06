// 빈칸 추리 (11-07 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이): 글 속 빈칸에 알맞은 말을 보기 셋 중에서 고르기
// - 1단계 한 문장 → 한 문장 문제를 20개 맞히면 2단계 짧은 이야기도 나옴 (문제·고르기는 src/math/blankData.ts)
// - 틀리면(또는 시간 끝): 정답을 빈칸에 넣고, 글 속 단서를 노랗게 표시, 고른 보기가 왜 아닌지 + 생각하는 방법을 보여 주고 '다음 ▶'까지 기다림
// - 맞히면: 단서를 노랗게 잠깐 보여 주고 다음 문제. 짧은 이야기는 맞힐 때마다, 한 문장은 두 번에 한 번
//   '근거 찾기' — "어느 말을 보고 알았어?" 글에서 단서 어절을 누르게 함(맞든 틀리든 단서를 보여 줌, 기록·보상과 상관없음)
// - 틀린 문제는 다음에 다시 나옴(열 문제쯤 뒤·다음 날, 고치면 이틀 뒤 한 번 더) — 맞춤법과 같은 규칙, 같은 기록 칸(State.math.sp)
// - 문제 시간(글이 길수록 넉넉히, 부모 설정 배율) · 하루 공부 시간 · 하루 문제 수 · 정답 보상(10개마다 꾸미기, 5개마다 재료·간식)은 수학·맞춤법과 같이 씀
// - 기록은 State.math 칸에만 (문제별 기록 sp · 하루 기록 '날짜:bk')
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM, ITEM_LIST } from '../data/pets';
import { ITEM_EVERY, IDLE_MS, BK_CAT } from '../math/mathData';
import { catMax } from '../lib/studyCfg';
import { makeBlankQ, pickBlank, bkWords, bkFull, storyProgress, STORY_OPEN, type BkQ, type BkSeg } from '../math/blankData';
import { mathState, todayMath, todayCat, answerBlank, addMathMs, mathTimeUp, catFull, toNextItem, mathPet, mathPetInfo, mathWear, mathWho, mathMatsLeft, mathSnackTotal, blankWrong } from '../math/mathStore';
import { TodaySummary, leftText, useCountdown } from './MathScreen';
import { gateLocked } from '../lib/gate';
import '../math/math.css';

/** 이 화면을 끝낼 까닭: 오늘 공부 시간 끝 / 빈칸 추리 오늘 문제 수 끝 */
type Done = 'time' | 'cat' | null;
function doneNow(): Done {
  const m = mathState();
  if (mathTimeUp(m)) return 'time';
  if (catFull(BK_CAT, m)) return 'cat';
  return null;
}
const nowMin = () => Date.now() / 60000;
/** 글 길이에 맞춘 글자 크기 (카드 폭 안에서 다섯 줄 안쪽) */
const textSize = (len: number) => len <= 22 ? 50 : len <= 34 ? 46 : len <= 50 ? 42 : len <= 70 ? 38 : 35;
/** 보기 단추 글자 크기: 다섯 글자까지는 크게 한 줄, 그보다 길면 단추 폭(232px)에 맞춤 — 여덟 글자부터는 두 줄 */
const optSize = (opts: string[]) => {
  const L = Math.max(...opts.map(o => o.length));
  return L <= 5 ? 46 : L <= 7 ? Math.floor(232 / L) : Math.min(34, Math.floor(232 / Math.ceil(L / 2)));
};
const isClueWord = (w: BkSeg[]) => w.some(g => g.clue);

/** 'ask' 문제 푸는 중 · 'hunt' 맞힌 뒤 근거 찾기 · 'show' 답과 단서 보여 주는 중 */
type Phase = 'ask' | 'hunt' | 'show';

export function BlankScreen({ onBack, onCloset }: { onBack: () => void; onCloset: () => void }) {
  const recent = useRef<string[]>([]);                         // 이번에 푼 문제 열쇠 (바로 다시 안 나오게)
  const next = (): BkQ | null => makeBlankQ(pickBlank(mathState().sp, nowMin(), recent.current));
  // 화면 확인용: 주소에 ?bk=문제열쇠 가 있으면 첫 문제를 그 문제로 (예: ?screen=mathBlank&bk=bk146)
  const [q, setQ] = useState<BkQ | null>(() => makeBlankQ(new URLSearchParams(location.search).get('bk') || '') ?? next());
  const [n, setN] = useState(0);                               // 문제 번호 (시간 다시 재기용)
  const [phase, setPhase] = useState<Phase>('ask');
  const [pick, setPick] = useState<string | null>(null);      // 고른 보기, 시간 끝이면 '⏰'
  const [tap, setTap] = useState<number | null>(null);        // 근거 찾기에서 누른 어절 번호
  const [item, setItem] = useState<string | null>(null);      // 방금 받은 꾸미기
  const [done, setDone] = useState<Done>(() => doneNow() ?? (q ? null : 'cat'));
  const [pop, setPop] = useState<{ k: number; mat: boolean; snack: string | null } | null>(null);
  const [lastOne, setLastOne] = useState(false);              // 오늘 공부 시간이 끝남 — 지금 문제까지 풀고 끝
  const [opened, setOpened] = useState(false);                // 방금 짧은 이야기가 열림 (축하 한 번)
  const [, redraw] = useState(0);
  const busy = useRef(false);
  const timer = useRef(0);
  const timeUp = useRef(false);
  const gotItem = useRef<string | null>(null);                // 다음 문제로 넘어갈 때 보여 줄 꾸미기
  const rightN = useRef(0);                                   // 이번에 맞힌 수 (한 문장은 두 번에 한 번 근거 찾기)
  useEffect(() => () => { clearTimeout(timer.current); syncSoon(500); }, []);
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), 2800);
    return () => clearTimeout(t);
  }, [item]);
  useEffect(() => {
    if (!opened) return;
    const t = setTimeout(() => setOpened(false), 3200);
    return () => clearTimeout(t);
  }, [opened]);
  // 오늘 공부 시간 재기 (수학·맞춤법과 같은 규칙: 보이고 최근 3분 안에 만졌을 때만 — 수학 칸에만 기록)
  useEffect(() => {
    if (done) return;
    let last = performance.now(), pend = 0, touch = Date.now();
    const onTouch = () => { touch = Date.now(); };
    document.addEventListener('pointerdown', onTouch, true);
    const flush = () => {
      if (pend <= 0) return;
      const r = addMathMs(pend);
      pend = 0;
      if (r.timeUp) { timeUp.current = true; setLastOne(true); syncSoon(1000); }
    };
    const t = setInterval(() => {
      const now = performance.now(), dt = Math.min(now - last, 5000);
      last = now;
      if (timeUp.current || document.visibilityState !== 'visible' || Date.now() - touch >= IDLE_MS) return;
      pend += dt;
      const tm = todayMath();
      if (pend >= 5000 || tm.ms + pend >= tm.limitMs) flush();
      redraw(x => x + 1);
    }, 1000);
    return () => { clearInterval(t); document.removeEventListener('pointerdown', onTouch, true); flush(); };
  }, [done]);

  const m = mathState();
  const t = todayMath(m);
  const tc = todayCat(BK_CAT, m);
  const who = mathWho(m);
  const gl = gateLocked('m');   // 공부 먼저(10-28): 오늘 공부 분량을 채우기 전에는 옷장이 잠김 (누르면 안내)
  const pet = mathPet(m);
  const pv = mathPetInfo(pet, m);
  const wrongLeft = blankWrong(m).length;
  const story = storyProgress(m.sp);
  const allGot = m.owned.length >= ITEM_LIST.length;
  const filled = ITEM_EVERY - toNextItem(m);
  const limit = q && m.timeMul > 0 ? Math.round(q.sec * m.timeMul) * 1000 : 0;

  /** 다음 문제로 (받은 꾸미기가 있으면 먼저 보여 줌) */
  const goNext = () => {
    clearTimeout(timer.current);
    setPick(null); setTap(null); setPhase('ask');
    busy.current = false;
    const it = gotItem.current; gotItem.current = null;
    if (it) { sfx.fanfare(); burst(640, 300, 'confetti'); setItem(it); }
    const end: Done = timeUp.current ? 'time' : doneNow();
    const nq = end ? null : next();
    if (end || !nq) {
      setDone(end ?? 'cat');
      if (!it) { sfx.fanfare(); burst(640, 300, 'confetti'); }
      return;
    }
    setQ(nq); setN(x => x + 1);
  };
  const finish = (o: string | null) => {
    if (busy.current || done || item || !q || phase !== 'ask') return;
    busy.current = true;
    const ok = o === q.ans;
    setPick(o ?? '⏰');
    if (ok) sfx.ding(); else sfx.boing();
    recent.current = [...recent.current.slice(-20), q.key];
    const wasOpen = storyProgress(mathState().sp).open;
    const r = answerBlank(ok, q.key);
    if (r.mat || r.snack) setPop({ k: Date.now(), mat: r.mat, snack: r.snack });
    gotItem.current = r.item;
    if (!wasOpen && storyProgress(mathState().sp).open) { setOpened(true); sfx.fanfare(); burst(640, 200, 'confetti'); }
    syncSoon(4000);
    if (ok) {
      rightN.current++;
      // 근거 찾기: 짧은 이야기는 맞힐 때마다, 한 문장은 두 번에 한 번
      if (q.lv === 3 || rightN.current % 2 === 0) { setPhase('hunt'); return; }
      setPhase('show');
      timer.current = window.setTimeout(goNext, 1700);
      return;
    }
    setPhase('show');   // 틀림·시간 끝: 단서와 까닭을 읽고 '다음 ▶'
  };
  const tapWord = (i: number, w: BkSeg[]) => {
    if (phase !== 'hunt' || tap !== null) return;
    setTap(i);
    if (isClueWord(w)) { sfx.ding(); burst(640, 330, 'star'); timer.current = window.setTimeout(goNext, 1700); }
    else sfx.tap();
  };
  const left = useCountdown(n, limit, phase === 'ask' && !item && !done, () => finish(null));

  const live = done || pick ? 0 : 1;
  const wrong = !!pick && !!q && pick !== q.ans;
  const frac = limit ? left / limit : 1;
  const showClue = phase === 'show' || (phase === 'hunt' && tap !== null);
  const words = q ? bkWords(q.item.t) : [];
  const hit = tap !== null && !!words[tap] && isClueWord(words[tap]);
  const head = done === 'time' ? '오늘 공부 끝! 🎉' : `오늘 빈칸 추리 ${catMax()}문제 끝! 🎉`;
  const rate = tc.solved ? Math.round(tc.correct / tc.solved * 100) : 0;
  let msg = '';
  if (phase === 'ask') msg = lastOne ? '⏰ 오늘 공부 시간 끝! 이 문제까지 풀자' : '';
  else if (wrong) msg = pick === '⏰' ? `⏰ 시간 끝! 정답은 '${q!.ans}'` : `정답은 '${q!.ans}'`;
  else if (phase === 'hunt') msg = tap === null ? '⭕ 정답! 🔍 어느 말을 보고 알았어? 글에서 눌러 봐!' : hit ? '👍 맞아! 노란 말이 힌트야' : '💡 노란 말이 힌트였어!';
  else msg = '⭕ 정답! 노란 말이 힌트야';
  return (
    <div class="screen" data-blank="1">
      <Backdrop theme="library" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 25 }}>🧩 빈칸 추리</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 25 }} data-count="1">
          <span data-left={Math.ceil(t.leftMs / 1000)} style={{ color: lastOne || t.leftMs <= 0 ? '#c92a2a' : undefined }}>⏳ {lastOne ? '시간 끝' : leftText(t.leftMs)}</span>
          {' · '}📝 {Math.min(tc.solved + live, catMax())} / {catMax()} · ⭕ {tc.correct}
        </div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 86, fontSize: 22 }}>
          🎁 {allGot ? '꾸미기 다 모음!' : <span style={{ letterSpacing: 2 }}>{'●'.repeat(filled)}{'○'.repeat(ITEM_EVERY - filled)}</span>}
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MatIcon size={28} /> {mathMatsLeft(m)}</span>
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }} data-snacks={mathSnackTotal(m)}><SnackIcon id="cookie" size={30} /> {mathSnackTotal(m)}</span>
        </div>
        {pop && <div key={pop.k} class="m-pop" data-mat-pop={pop.mat ? 1 : 0} data-snack-pop={pop.snack ?? ''}>{pop.mat && <><MatIcon size={30} /> +1</>}{pop.snack && <><SnackIcon id={pop.snack} size={36} /> +1</>}</div>}
        <button class={`btn violet small ${gl ? 'gate-locked' : ''}`} style={{ position: 'absolute', left: 20, top: 112 }} data-gate-locked={gl ? '1' : undefined} onClick={() => { if (!gl) sfx.tap(); onCloset(); }}>{gl ? '🔒' : '👗'} {who} 옷장</button>
        {!story.open && <div class="pill bk-story-pill" data-story-left={story.need - story.got}>📖 이야기까지 ⭕ {story.got}/{story.need}</div>}

        {!done && q ? (
          <div class={`m-card bk-card phase-${phase}`} data-q={q.key} data-ans={q.ans} data-lv={q.lv} data-phase={phase}>
            {limit > 0 && (
              <div class="m-timer" data-left={Math.ceil(left / 1000)} style={{ visibility: phase === 'ask' ? 'visible' : 'hidden' }}>
                <div class={`m-timer-bar ${frac < 0.3 ? 'low' : ''}`} style={{ width: `${Math.max(0, frac) * 100}%` }} />
                <span class="m-timer-num">⏱ {Math.ceil(left / 1000)}초</span>
              </div>
            )}
            <div class={`bk-tag ${q.lv === 3 ? 'story' : ''}`}>{q.lv === 3 ? '📖 짧은 이야기' : '📝 한 문장'} · 빈칸에 알맞은 말은?</div>
            <div class={`bk-text ${phase === 'hunt' && tap === null ? 'hunting' : ''}`} style={{ fontSize: textSize(bkFull(q.item).length) }}>
              {words.map((w, i) => {
                const clue = isClueWord(w), isAns = w.some(g => g.blank);   // 빈칸(답) 어절은 근거가 아니라서 누를 수 없음
                const cls = ['bk-w', phase === 'hunt' && tap === null ? 'tap' : '', isAns ? 'ans' : '', tap === i ? (clue ? 'hit' : 'miss') : ''].join(' ');
                return (
                  <>
                    {i > 0 ? ' ' : ''}
                    <span class={cls} data-word={i} data-clue={clue ? '1' : undefined} onClick={() => { if (!isAns) tapWord(i, w); }}>
                      {w.map(g => g.blank
                        ? <span class={`bk-blank ${pick ? 'filled' : ''}`} data-blank="1">{pick ? q.ans : '?'}</span>
                        : <span class={g.clue && showClue ? 'bk-clue' : undefined}>{g.s}</span>)}
                    </span>
                  </>
                );
              })}
            </div>
            <div class="bk-opts">
              {q.opts.map(o => (
                <button class={`m-opt bk-opt ${pick ? (o === q.ans ? 'ok' : o === pick ? 'no' : 'dim') : ''}`} style={{ fontSize: optSize(q.opts) }} data-opt={o} onClick={() => finish(o)}>{o}</button>
              ))}
            </div>
            <div class="bk-foot">
              <div class={`m-msg bk-msg ${wrong ? 'no' : ''} ${phase === 'ask' && lastOne ? 'last' : ''} ${phase === 'hunt' && tap === null ? 'hunt' : ''}`} data-last={phase === 'ask' && lastOne ? '1' : undefined}>{msg}</div>
              {(wrong || (phase === 'hunt' && tap !== null && !hit)) && <button class="btn violet small" data-next="1" onClick={() => { sfx.tap(); goNext(); }}>다음 ▶</button>}
            </div>
            {wrong && (
              <div class="bk-why" data-why="1">
                {pick !== '⏰' && q.why[pick!] && <div><span class="bk-chip">{pick}</span> {q.why[pick!]}</div>}
                <div class="bk-tip">🔎 {q.tip}</div>
              </div>
            )}
          </div>
        ) : (
          <div class="m-card" data-done={done ?? 'none'}>
            <div style={{ fontSize: done === 'time' ? 64 : 50, color: '#4a2f63' }}>{head}</div>
            {tc.solved > 0 && <div style={{ fontSize: 36 }}>오늘 빈칸 추리 {tc.solved}문제 중 {tc.correct}개 맞혔어 ({rate}%)</div>}
            {wrongLeft > 0 && <div style={{ fontSize: 28, color: '#7048e8' }}>틀린 문제 {wrongLeft}개는 다음에 다시 나와요</div>}
            <TodaySummary />
            {done !== 'time' && <div style={{ fontSize: 30, color: '#4a2f63' }}>⏳ 오늘 공부 시간 {leftText(t.leftMs)}</div>}
            <div style={{ display: 'flex', gap: 30 }}>
              <button class={`btn violet ${gl ? 'gate-locked' : ''}`} data-gate-locked={gl ? '1' : undefined} onClick={() => { if (!gl) sfx.tap(); onCloset(); }}>{gl ? '🔒' : '👗'} {who} 옷장</button>
              <button class="btn" onClick={() => { sfx.tap(); onBack(); }}>처음 화면으로</button>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 26, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={200} autoTalk={false}
            motion={pick ? (!wrong ? 'jump' : 'none') : 'bob'} mood={wrong ? 'think' : 'happy'} />
        </div>
      </div>

      {opened && (
        <div class="bk-opened slide-up" data-story-opened="1">📖 짧은 이야기 문제가 열렸어! (한 문장 {STORY_OPEN}개 맞힘)</div>
      )}

      {item && (
        <div class="overlay fade-in" style={{ background: 'rgba(60,30,90,.35)' }} onClick={() => setItem(null)} data-gift="item">
          <div class="layer">
            <div class="gift-card slide-up">
              <div class="gift-ribbon">새 꾸미기!</div>
              <div class="gift-icon glyph-bounce"><ItemIcon id={item} size={210} /></div>
              <div class="gift-name">{ITEM[item]?.name}</div>
              <div class="pill" style={{ fontSize: 24 }}>👗 {who} 옷장에 넣었어 · 정답 {ITEM_EVERY}개마다 하나</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
