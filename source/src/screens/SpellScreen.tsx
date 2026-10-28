// 맞춤법 (10-25 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이): 게임 없이 문제 풀기
// - 명언·속담·좋은 말 문장 속 괄호 ( 바른말 , 틀린말 ) 에서 바른 것 고르기 — 보기 둘
// - 같은 문장도 괄호 자리를 바꿔 다른 문제로 나옴(바로 이어서는 안 나옴). 문제는 src/math/spellData.ts
// - 틀린 문제는 다음에 다시 나오고(열 문제쯤 지나서·다음 날), '틀린 문제 다시 풀기'(review)로 따로 풀 수 있다
// - 틀리면 바른 문장과 도움말을 보여 주고 '다음 ▶'을 누를 때까지 기다림 (맞히면 잠깐 보여 주고 다음 문제)
// - 문제 시간(문장이 길수록 넉넉히, 부모 설정 배율) · 하루 공부 시간 · 하루 150문제 · 정답 보상(10개마다 꾸미기, 5개마다 재료·간식)은 수학과 같이 씀
// - 기록은 State.math 칸에만 (맞춤법 문제별 기록 sp · 하루 기록 '날짜:sp')
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM, ITEM_LIST } from '../data/pets';
import { ITEM_EVERY, CAT_MAX, IDLE_MS, SP_CAT } from '../math/mathData';
import { makeSpellQ, pickSpell, type SpQ } from '../math/spellData';
import { mathState, todayMath, todayCat, answerSpell, addMathMs, mathTimeUp, catFull, toNextItem, mathPet, mathPetInfo, mathWear, mathWho, mathMatsLeft, mathSnackTotal, spellWrong } from '../math/mathStore';
import { TodaySummary, leftText, useCountdown } from './MathScreen';
import { gateLocked } from '../lib/gate';
import '../math/math.css';

/** 이 화면을 끝낼 까닭: 오늘 공부 시간 끝 / 맞춤법 오늘 150문제 끝 / (틀린 문제 다시 풀기) 틀린 문제를 다 고침 */
type Done = 'time' | 'cat' | 'fixed' | null;
function doneNow(review: boolean): Done {
  const m = mathState();
  if (mathTimeUp(m)) return 'time';
  if (catFull(SP_CAT, m)) return 'cat';
  if (review && !spellWrong(m).length) return 'fixed';
  return null;
}
const nowMin = () => Date.now() / 60000;
/** 문장 길이에 맞춘 글자 크기 (카드 폭 안에서 세 줄 안쪽) */
const sentSize = (len: number) => len <= 16 ? 60 : len <= 24 ? 54 : len <= 34 ? 48 : len <= 46 ? 42 : 38;
/** 보기 단추 글자 크기 (긴 낱말도 단추 안에) */
const optSize = (opts: string[]) => Math.min(56, Math.floor(310 / Math.max(...opts.map(o => o.length))));

export function SpellScreen({ review, onBack, onCloset, onMore }: { review: boolean; onBack: () => void; onCloset: () => void; onMore?: () => void }) {
  const recent = useRef<string[]>([]);                         // 이번에 푼 문제 열쇠 (같은 문장 바로 다시 안 나오게)
  const next = (): SpQ | null => {
    const k = pickSpell(mathState().sp, nowMin(), recent.current, review);
    return k ? makeSpellQ(k) : null;
  };
  const [q, setQ] = useState<SpQ | null>(() => next());
  const [n, setN] = useState(0);                               // 문제 번호 (시간 다시 재기용)
  const [pick, setPick] = useState<string | null>(null);      // 고른 보기 (맞았는지 보여 주는 중), 시간 끝이면 '⏰'
  const [item, setItem] = useState<string | null>(null);      // 방금 받은 꾸미기
  const [done, setDone] = useState<Done>(() => doneNow(review) ?? (q ? null : review ? 'fixed' : 'cat'));
  const [pop, setPop] = useState<{ k: number; mat: boolean; snack: string | null } | null>(null);
  const [lastOne, setLastOne] = useState(false);              // 오늘 공부 시간이 끝남 — 지금 문제까지 풀고 끝
  const [, redraw] = useState(0);
  const busy = useRef(false);
  const timer = useRef(0);
  const timeUp = useRef(false);
  const gotItem = useRef<string | null>(null);                // 다음 문제로 넘어갈 때 보여 줄 꾸미기
  useEffect(() => () => { clearTimeout(timer.current); syncSoon(500); }, []);
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), 2800);
    return () => clearTimeout(t);
  }, [item]);
  // 오늘 공부 시간 재기 (수학 문제 화면과 같은 규칙: 보이고 최근 3분 안에 만졌을 때만 — 수학 칸에만 기록)
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
  const tc = todayCat(SP_CAT, m);
  const who = mathWho(m);
  const gl = gateLocked('m');   // 공부 먼저(10-28): 오늘 공부 분량을 채우기 전에는 옷장이 잠김 (누르면 안내)
  const pet = mathPet(m);
  const pv = mathPetInfo(pet, m);   // 간식 먹은 만큼 자란 모습 (10-25 — 처음엔 아기)
  const wrongLeft = spellWrong(m).length;
  const allGot = m.owned.length >= ITEM_LIST.length;
  const filled = ITEM_EVERY - toNextItem(m);
  const limit = q && m.timeMul > 0 ? Math.round(q.sec * m.timeMul) * 1000 : 0;

  /** 다음 문제로 (받은 꾸미기가 있으면 먼저 보여 줌) */
  const goNext = () => {
    clearTimeout(timer.current);
    setPick(null);
    busy.current = false;
    const it = gotItem.current; gotItem.current = null;
    if (it) { sfx.fanfare(); burst(640, 300, 'confetti'); setItem(it); }
    const end: Done = timeUp.current ? 'time' : doneNow(review);
    const nq = end ? null : next();
    if (end || !nq) {
      setDone(end ?? (review ? 'fixed' : 'cat'));
      if (!it) { sfx.fanfare(); burst(640, 300, 'confetti'); }
      return;
    }
    setQ(nq); setN(x => x + 1);
  };
  const finish = (o: string | null) => {
    if (busy.current || done || item || !q) return;
    busy.current = true;
    const ok = o === q.ans;
    setPick(o ?? '⏰');
    if (ok) sfx.ding(); else sfx.boing();
    recent.current = [...recent.current.slice(-20), q.key];
    const r = answerSpell(ok, q.key);
    if (r.mat || r.snack) setPop({ k: Date.now(), mat: r.mat, snack: r.snack });
    gotItem.current = r.item;
    syncSoon(4000);
    // 맞히면 바른 문장을 잠깐 보여 주고 다음, 틀리면 도움말을 읽고 '다음 ▶'을 누를 때까지
    if (ok) timer.current = window.setTimeout(goNext, 1100);
  };
  const left = useCountdown(n, limit, !pick && !item && !done, () => finish(null));

  const live = done || pick ? 0 : 1;
  const wrong = !!pick && !!q && pick !== q.ans;
  const frac = limit ? left / limit : 1;
  const shown = q ? q.before + `(${q.opts[0]}, ${q.opts[1]})` + q.after : '';   // 글자 크기는 괄호까지 넣은 길이로 (답한 뒤에도 같은 크기)
  const title = review ? '🔁 틀린 문제 다시 풀기' : '✍️ 맞춤법';
  const head = done === 'time' ? '오늘 공부 끝! 🎉' : done === 'fixed' ? '틀린 문제를 모두 고쳤어! 🎉' : `오늘 맞춤법 ${CAT_MAX}문제 끝! 🎉`;
  const rate = tc.solved ? Math.round(tc.correct / tc.solved * 100) : 0;
  return (
    <div class="screen" data-spell={review ? 'review' : 'all'}>
      <Backdrop theme="library" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 25 }}>{title}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 25 }} data-count="1">
          <span data-left={Math.ceil(t.leftMs / 1000)} style={{ color: lastOne || t.leftMs <= 0 ? '#c92a2a' : undefined }}>⏳ {lastOne ? '시간 끝' : leftText(t.leftMs)}</span>
          {' · '}📝 {Math.min(tc.solved + live, CAT_MAX)} / {CAT_MAX} · ⭕ {tc.correct}{review ? ` · 남은 틀린 문제 ${wrongLeft}` : ''}
        </div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 86, fontSize: 22 }}>
          🎁 {allGot ? '꾸미기 다 모음!' : <span style={{ letterSpacing: 2 }}>{'●'.repeat(filled)}{'○'.repeat(ITEM_EVERY - filled)}</span>}
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MatIcon size={28} /> {mathMatsLeft(m)}</span>
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }} data-snacks={mathSnackTotal(m)}><SnackIcon id="cookie" size={30} /> {mathSnackTotal(m)}</span>
        </div>
        {pop && <div key={pop.k} class="m-pop" data-mat-pop={pop.mat ? 1 : 0} data-snack-pop={pop.snack ?? ''}>{pop.mat && <><MatIcon size={30} /> +1</>}{pop.snack && <><SnackIcon id={pop.snack} size={36} /> +1</>}</div>}
        <button class={`btn violet small ${gl ? 'gate-locked' : ''}`} style={{ position: 'absolute', left: 20, top: 112 }} data-gate-locked={gl ? '1' : undefined} onClick={() => { if (!gl) sfx.tap(); onCloset(); }}>{gl ? '🔒' : '👗'} {who} 옷장</button>

        {!done && q ? (
          <div class="m-card sp-card" data-q={q.key} data-ans={q.ans}>
            {limit > 0 && !wrong && (
              <div class="m-timer" data-left={Math.ceil(left / 1000)}>
                <div class={`m-timer-bar ${frac < 0.3 ? 'low' : ''}`} style={{ width: `${Math.max(0, frac) * 100}%` }} />
                <span class="m-timer-num">⏱ {Math.ceil(left / 1000)}초</span>
              </div>
            )}
            <div class="sp-src">{q.src}{q.who ? ` · ${q.who}` : ''}</div>
            <div class="sp-sent" style={{ fontSize: sentSize(shown.length) }}>
              {q.before}
              <span class={`sp-blank ${pick ? 'ok' : ''}`} data-blank="1">{pick ? q.ans : `(${q.opts[0]}, ${q.opts[1]})`}</span>
              {q.after}
            </div>
            <div class="sp-opts">
              {q.opts.map(o => (
                <button class={`m-opt sp-opt ${pick ? (o === q.ans ? 'ok' : o === pick ? 'no' : 'dim') : ''}`} style={{ fontSize: optSize(q.opts) }} data-opt={o} onClick={() => finish(o)}>{o}</button>
              ))}
            </div>
            <div class="sp-foot">
              <div class={`m-msg ${wrong ? 'no' : ''} ${!pick && lastOne ? 'last' : ''}`} data-last={!pick && lastOne ? '1' : undefined}>
                {pick ? (!wrong ? '⭕ 정답!' : pick === '⏰' ? `⏰ 시간 끝! 정답은 '${q.ans}'` : `정답은 '${q.ans}'`) : lastOne ? '⏰ 오늘 공부 시간 끝! 이 문제까지 풀자' : ''}
              </div>
              {wrong && <button class="btn violet small" data-next="1" onClick={() => { sfx.tap(); goNext(); }}>다음 ▶</button>}
            </div>
            {wrong && q.tip && <div class="sp-tip" data-tip="1">💡 {q.tip}</div>}
          </div>
        ) : (
          <div class="m-card" data-done={done ?? 'none'}>
            <div style={{ fontSize: done === 'time' ? 64 : 50, color: '#4a2f63' }}>{head}</div>
            {tc.solved > 0 && <div style={{ fontSize: 36 }}>오늘 맞춤법 {tc.solved}문제 중 {tc.correct}개 맞혔어 ({rate}%)</div>}
            {done !== 'fixed' && wrongLeft > 0 && <div style={{ fontSize: 28, color: '#7048e8' }}>틀린 문제 {wrongLeft}개는 다음에 다시 나와요</div>}
            <TodaySummary />
            {done !== 'time' && <div style={{ fontSize: 30, color: '#4a2f63' }}>⏳ 오늘 공부 시간 {leftText(t.leftMs)}</div>}
            <div style={{ display: 'flex', gap: 30 }}>
              <button class={`btn violet ${gl ? 'gate-locked' : ''}`} data-gate-locked={gl ? '1' : undefined} onClick={() => { if (!gl) sfx.tap(); onCloset(); }}>{gl ? '🔒' : '👗'} {who} 옷장</button>
              {done === 'fixed' && onMore && <button class="btn mint" data-spell-more="1" onClick={() => { sfx.tap(); onMore(); }}>✍️ 새 문제 풀기</button>}
              <button class="btn" onClick={() => { sfx.tap(); onBack(); }}>처음 화면으로</button>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 26, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={200} autoTalk={false}
            motion={pick ? (!wrong ? 'jump' : 'none') : 'bob'} mood={wrong ? 'think' : 'happy'} />
        </div>
      </div>

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

