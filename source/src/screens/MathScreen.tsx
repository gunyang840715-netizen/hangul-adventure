// 수학 모드 (초등 2학년 아이 — 한글 모드와 따로): 게임 없이 문제 풀기
// - 고른 항목(덧셈·뺄셈·곱셈·나눗셈·골고루)의 지금 단계 문제, 보기 4개(객관식)
// - 문제마다 제한 시간(단계마다, 부모 설정 배율) — 시간이 다 되면 틀린 것으로 하고 정답을 보여 줌. 앱이 가려진 동안은 멈춤
// - 하루 공부 시간(부모 설정 30분·1시간, 10-24 — 문제 수 제한 대신): 이 문제 화면이 보이고 최근 3분 안에 만졌을 때만 셈.
//   시간이 다 되면 풀던 문제까지 풀고 '오늘 끝'. 한 항목은 하루 150문제까지(골고루는 다 푼 항목을 빼고 냄)
// - 정답 10개마다 수학 옷장에 꾸미기, 5개마다 수학 집 재료와 간식 하나씩 (틀려도 가져가지 않음, 간식은 '간식 주기'에서 먹임)
// - 공부 시간이 끝날 때(또는 그 항목 150문제째) 그날 20문제 이상 푼 항목 중 90% 이상인 항목만 다음 단계 (하루 한 단계)
// - 한글 진도·하루 사용 시간·한글 옷장·한글 집과 섞이지 않는다 (기록은 State.math 한 칸)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM, ITEM_LIST } from '../data/pets';
import { makeProblemFor, stageName, catStage, CATS, CAT, ITEM_EVERY, MAT_EVERY, PASS_RATE, UP_MIN, CAT_MAX, IDLE_MS, SP_INFO, type Problem, type Mode, type Cat, type AnyCat } from '../math/mathData';
import { mathState, todayMath, todayCat, answerMath, addMathMs, mathTimeUp, catFull, openCats, toNextItem, mathPet, mathPetInfo, mathWear, mathWho, mathMatsLeft, mathSnackTotal } from '../math/mathStore';
import '../math/math.css';

/** 남은 시간(ms): key(문제)가 바뀌면 처음부터, active가 아니면(답을 보여 주는 중·선물 창) 그 자리에서 멈춤, 앱이 가려진 동안도 멈춤
 *  (맞춤법 화면 SpellScreen도 같이 씀) */
export function useCountdown(key: number, ms: number, active: boolean, onEnd: () => void) {
  const [left, setLeft] = useState(ms);
  const rem = useRef(ms);
  const end = useRef(onEnd);
  end.current = onEnd;
  useEffect(() => { rem.current = ms; setLeft(ms); }, [key, ms]);
  useEffect(() => {
    if (!ms || !active || rem.current <= 0) return;
    let last = performance.now();
    const t = setInterval(() => {
      const now = performance.now();
      if (document.visibilityState === 'visible') rem.current -= now - last;
      last = now;
      setLeft(Math.max(0, rem.current));
      if (rem.current <= 0) { clearInterval(t); end.current(); }
    }, 100);
    return () => clearInterval(t);
  }, [key, ms, active]);
  return left;
}

/** 오늘 항목별 결과 (오늘 끝 화면·첫 화면에서 같이 씀 — 10-25부터 맞춤법 줄도) */
export function TodaySummary({ ups = [] }: { ups?: Cat[] }) {
  const m = mathState();
  const rows = [...CATS.map(c => ({ id: c.id as AnyCat, icon: c.icon, name: c.name })), SP_INFO].map(c => ({ c, ...todayCat(c.id, m) })).filter(r => r.solved > 0);
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
      {rows.map(r => (
        <div class="pill" style={{ fontSize: 24 }} data-sum={r.c.id}>
          {r.c.icon} {r.c.name} {r.correct}/{r.solved} ({Math.round(r.correct / r.solved * 100)}%){(ups as AnyCat[]).includes(r.c.id) ? ' → 다음 단계!' : ''}
        </div>
      ))}
    </div>
  );
}

/** 이 화면을 끝낼 까닭: 오늘 공부 시간 끝 / 이 항목 오늘 150문제 끝 / (골고루) 네 항목 모두 끝 */
type Done = 'time' | 'cat' | 'all' | null;
function doneNow(mode: Mode): Done {
  const m = mathState();
  if (mathTimeUp(m)) return 'time';
  if (mode === 'mix') return openCats(m).length ? null : 'all';
  return catFull(mode, m) ? 'cat' : null;
}
/** 남은 공부 시간 글자 */
export const leftText = (ms: number) => ms > 0 ? `${Math.max(1, Math.ceil(ms / 60000))}분 남음` : '시간 끝';

export function MathScreen({ mode, onBack, onCloset }: { mode: Mode; onBack: () => void; onCloset: () => void }) {
  const [p, setP] = useState<Problem>(() => makeProblemFor(mode, mathState().lv, 0.2, openCats()));
  const [n, setN] = useState(0);                              // 문제 번호 (시간 다시 재기용)
  const [pick, setPick] = useState<string | null>(null);     // 고른 보기 (맞았는지 보여 주는 중), 시간 끝이면 '⏰'
  const [item, setItem] = useState<string | null>(null);     // 방금 받은 꾸미기
  const [done, setDone] = useState<Done>(() => doneNow(mode));
  const [ups, setUps] = useState<Cat[]>([]);                 // 오늘 다음 단계로 올라간 항목
  const [pop, setPop] = useState<{ k: number; mat: boolean; snack: string | null } | null>(null);   // 재료·간식 하나 받음 (+1 보여 주기)
  const [lastOne, setLastOne] = useState(false);             // 오늘 공부 시간이 끝남 — 지금 문제까지 풀고 끝
  const [, redraw] = useState(0);                            // 남은 공부 시간 글자 다시 그리기
  const busy = useRef(false);
  const timer = useRef(0);
  const timeUp = useRef(false);
  const upsRef = useRef<Cat[]>([]);
  useEffect(() => () => { clearTimeout(timer.current); syncSoon(500); }, []);
  // 꾸미기 창은 잠깐 보여 주고 저절로 닫힘 (누르면 바로)
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), 2800);
    return () => clearTimeout(t);
  }, [item]);
  // 오늘 공부 시간 재기: 이 화면이 보이고 최근 3분 안에 만졌을 때만 (한글 사용 시간과 따로 — 수학 칸에만 기록)
  useEffect(() => {
    if (done) return;
    let last = performance.now(), pend = 0, touch = Date.now();
    const onTouch = () => { touch = Date.now(); };
    document.addEventListener('pointerdown', onTouch, true);
    const flush = () => {
      if (pend <= 0) return;
      const r = addMathMs(pend);
      pend = 0;
      if (r.timeUp) { timeUp.current = true; upsRef.current = [...upsRef.current, ...r.ups]; setLastOne(true); syncSoon(1000); }
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
  const tc = mode === 'mix' ? null : todayCat(mode, m);
  const who = mathWho(m);
  const pet = mathPet(m);
  const pv = mathPetInfo(pet, m);   // 간식 먹은 만큼 자란 모습 (10-25 — 처음엔 아기)
  const allGot = m.owned.length >= ITEM_LIST.length;
  const filled = ITEM_EVERY - toNextItem(m);
  const limit = m.timeMul > 0 ? Math.round(p.sec * m.timeMul) * 1000 : 0;

  const finish = (o: string | null) => {
    if (busy.current || done || item) return;
    busy.current = true;
    const ok = o === p.ans;
    setPick(o ?? '⏰');
    if (ok) sfx.ding(); else sfx.boing();
    const r = answerMath(ok, p.cat);
    if (r.mat || r.snack) setPop({ k: Date.now(), mat: r.mat, snack: r.snack });
    if (r.ups.length) upsRef.current = [...upsRef.current, ...r.ups];
    syncSoon(4000);
    timer.current = window.setTimeout(() => {
      setPick(null);
      busy.current = false;
      if (r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); setItem(r.item); }
      // 공부 시간이 끝났거나(이 문제까지) 이 항목을 오늘 다 풀었으면 끝
      const end: Done = timeUp.current ? 'time' : doneNow(mode);
      if (end) {
        setDone(end); setUps(upsRef.current);
        if (!r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); }
        return;
      }
      setP(makeProblemFor(mode, mathState().lv, 0.2, openCats()));
      setN(x => x + 1);
    }, ok ? 650 : 1700);
  };
  const left = useCountdown(n, limit, !pick && !item && !done, () => finish(null));

  const lvNow = mode === 'mix' ? -1 : m.lv[mode];
  const title = mode === 'mix' ? '🎲 골고루' : `${CAT[mode].icon} ${CAT[mode].name} ${lvNow + 1}단계 · ${stageName(catStage(mode, lvNow))}`;
  const live = done || pick ? 0 : 1;                         // 지금 풀고 있는 문제
  const count = tc ? `📝 ${Math.min(tc.solved + live, CAT_MAX)} / ${CAT_MAX} · ⭕ ${tc.correct}` : `📝 ${t.solved + live}번째 · ⭕ ${t.correct}`;
  const res = done === 'time' || !tc ? t : tc;               // 끝 화면에 보일 결과 (시간 끝은 오늘 전체, 항목 끝은 그 항목)
  const rate = res.solved ? Math.round(res.correct / res.solved * 100) : 0;
  const isRem = p.ans.includes('…');
  const frac = limit ? left / limit : 1;
  const head = done === 'time' ? '오늘 공부 끝! 🎉'
    : done === 'all' ? `네 가지 모두 오늘 ${CAT_MAX}문제씩 끝! 🎉`
    : mode !== 'mix' ? `오늘 ${CAT[mode].name} ${CAT_MAX}문제 끝! 🎉` : '';
  return (
    <div class="screen" data-math="1" data-mode={mode}>
      <Backdrop theme="library" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 25 }} data-stage={mode}>{title}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 25 }} data-count="1">
          <span data-left={Math.ceil(t.leftMs / 1000)} style={{ color: lastOne || t.leftMs <= 0 ? '#c92a2a' : undefined }}>⏳ {lastOne ? '시간 끝' : leftText(t.leftMs)}</span> · {count}
        </div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 86, fontSize: 22 }}>
          🎁 {allGot ? '꾸미기 다 모음!' : <span style={{ letterSpacing: 2 }}>{'●'.repeat(filled)}{'○'.repeat(ITEM_EVERY - filled)}</span>}
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MatIcon size={28} /> {mathMatsLeft(m)}</span>
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }} data-snacks={mathSnackTotal(m)}><SnackIcon id="cookie" size={30} /> {mathSnackTotal(m)}</span>
        </div>
        {pop && <div key={pop.k} class="m-pop" data-mat-pop={pop.mat ? 1 : 0} data-snack-pop={pop.snack ?? ''}>{pop.mat && <><MatIcon size={30} /> +1</>}{pop.snack && <><SnackIcon id={pop.snack} size={36} /> +1</>}</div>}
        <button class="btn violet small" style={{ position: 'absolute', left: 20, top: 112 }} onClick={() => { sfx.tap(); onCloset(); }}>👗 {who} 옷장</button>

        {!done ? (
          <div class="m-card" data-q={p.q}>
            {limit > 0 && (
              <div class="m-timer" data-left={Math.ceil(left / 1000)}>
                <div class={`m-timer-bar ${frac < 0.3 ? 'low' : ''}`} style={{ width: `${Math.max(0, frac) * 100}%` }} />
                <span class="m-timer-num">⏱ {Math.ceil(left / 1000)}초</span>
              </div>
            )}
            <div class="m-q">{p.q} = {isRem ? '? … ?' : '?'}</div>
            <div class="m-opts">
              {p.opts.map(o => (
                <button class={`m-opt ${pick ? (o === p.ans ? 'ok' : o === pick ? 'no' : 'dim') : ''}`} data-opt={o} onClick={() => finish(o)}>{o}</button>
              ))}
            </div>
            <div class={`m-msg ${pick && pick !== p.ans ? 'no' : ''} ${!pick && lastOne ? 'last' : ''}`} data-last={!pick && lastOne ? '1' : undefined}>
              {pick ? (pick === p.ans ? '⭕ 정답!' : pick === '⏰' ? `⏰ 시간 끝! 정답은 ${p.ans}` : `정답은 ${p.ans}`) : lastOne ? '⏰ 오늘 공부 시간 끝! 이 문제까지 풀자' : ''}
            </div>
          </div>
        ) : (
          <div class="m-card" data-done={done}>
            <div style={{ fontSize: done === 'time' ? 64 : 52, color: '#4a2f63' }}>{head}</div>
            <div style={{ fontSize: 38 }}>{res.solved}문제 중 {res.correct}개 맞혔어 ({rate}%)</div>
            <TodaySummary ups={ups} />
            {done !== 'time' && <div style={{ fontSize: 30, color: '#4a2f63' }} data-left-today="1">⏳ 오늘 공부 시간 {leftText(t.leftMs)}{done === 'cat' ? ' · 다른 항목도 풀어 볼까?' : ''}</div>}
            <div style={{ fontSize: 22, color: '#7a5b8f', padding: '0 40px', lineHeight: 1.5, wordBreak: 'keep-all' }}>
              공부 시간이 끝나거나 한 항목을 {CAT_MAX}문제 다 풀면, 그날 {UP_MIN}문제 이상 푼 항목을 {Math.round(PASS_RATE * 100)}% 이상 맞혔을 때 그 항목은 다음 단계로 가요<br />
              꾸미기는 정답 {ITEM_EVERY}개마다, 집 재료와 간식은 정답 {MAT_EVERY}개마다
            </div>
            <div style={{ display: 'flex', gap: 30 }}>
              <button class="btn violet" onClick={() => { sfx.tap(); onCloset(); }}>👗 {who} 옷장</button>
              <button class="btn" onClick={() => { sfx.tap(); onBack(); }}>{done === 'cat' ? '다른 항목 고르기' : '처음 화면으로'}</button>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 26, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={200} autoTalk={false}
            motion={pick ? (pick === p.ans ? 'jump' : 'none') : 'bob'} mood={pick && pick !== p.ans ? 'think' : 'happy'} />
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
