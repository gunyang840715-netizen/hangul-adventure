// 수학 모드 (초등 2학년 아이 — 한글 모드와 따로): 게임 없이 문제 풀기
// - 고른 항목(덧셈·뺄셈·곱셈·나눗셈·골고루)의 지금 단계 문제, 보기 4개(객관식)
// - 문제마다 제한 시간(단계마다, 부모 설정 배율) — 시간이 다 되면 틀린 것으로 하고 정답을 보여 줌. 앱이 가려진 동안은 멈춤
// - 하루 50문제(부모 설정) → '오늘 끝'. 정답 10개마다 수학 옷장에 꾸미기, 5개마다 수학 집 재료 (틀려도 가져가지 않음)
// - 오늘 문제를 다 풀면 그날 20문제 이상 푼 항목 중 90% 이상인 항목만 다음 단계
// - 한글 진도·하루 사용 시간·동생 옷장·동생 집과 섞이지 않는다 (기록은 State.math 한 칸)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM, ITEM_LIST } from '../data/pets';
import { makeProblemFor, stageName, catStage, CATS, CAT, ITEM_EVERY, MAT_EVERY, PASS_RATE, UP_MIN, type Problem, type Mode, type Cat } from '../math/mathData';
import { mathState, todayMath, todayCat, answerMath, toNextItem, mathPet, mathWear, mathWho, mathMatsLeft } from '../math/mathStore';
import '../math/math.css';

/** 남은 시간(ms): key(문제)가 바뀌면 처음부터, active가 아니면(답을 보여 주는 중·선물 창) 그 자리에서 멈춤, 앱이 가려진 동안도 멈춤 */
function useCountdown(key: number, ms: number, active: boolean, onEnd: () => void) {
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

/** 오늘 항목별 결과 (오늘 끝 화면·수학 첫 화면에서 같이 씀) */
export function TodaySummary({ ups = [] }: { ups?: Cat[] }) {
  const m = mathState();
  const rows = CATS.map(c => ({ c, ...todayCat(c.id, m) })).filter(r => r.solved > 0);
  if (!rows.length) return null;
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
      {rows.map(r => (
        <div class="pill" style={{ fontSize: 24 }} data-sum={r.c.id}>
          {r.c.icon} {r.c.name} {r.correct}/{r.solved} ({Math.round(r.correct / r.solved * 100)}%){ups.includes(r.c.id) ? ' → 다음 단계!' : ''}
        </div>
      ))}
    </div>
  );
}

export function MathScreen({ mode, onBack, onCloset }: { mode: Mode; onBack: () => void; onCloset: () => void }) {
  const [p, setP] = useState<Problem>(() => makeProblemFor(mode, mathState().lv));
  const [n, setN] = useState(0);                              // 문제 번호 (시간 다시 재기용)
  const [pick, setPick] = useState<string | null>(null);     // 고른 보기 (맞았는지 보여 주는 중), 시간 끝이면 '⏰'
  const [item, setItem] = useState<string | null>(null);     // 방금 받은 꾸미기
  const [done, setDone] = useState(() => { const t = todayMath(); return t.solved >= t.perDay; });
  const [ups, setUps] = useState<Cat[]>([]);                 // 오늘 다음 단계로 올라간 항목
  const [matPop, setMatPop] = useState(0);                   // 재료 하나 받음 (+1 보여 주기)
  const busy = useRef(false);
  const timer = useRef(0);
  useEffect(() => () => { clearTimeout(timer.current); syncSoon(500); }, []);
  // 꾸미기 창은 잠깐 보여 주고 저절로 닫힘 (누르면 바로)
  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setItem(null), 2800);
    return () => clearTimeout(t);
  }, [item]);

  const m = mathState();
  const t = todayMath(m);
  const who = mathWho(m);
  const pet = mathPet(m);
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
    if (r.mat) setMatPop(x => x + 1);
    syncSoon(4000);
    timer.current = window.setTimeout(() => {
      setPick(null);
      busy.current = false;
      if (r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); setItem(r.item); }
      if (r.finished) {
        setDone(true); setUps(r.ups);
        if (!r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); }
      }
      setP(makeProblemFor(mode, mathState().lv));
      setN(x => x + 1);
    }, ok ? 650 : 1700);
  };
  const left = useCountdown(n, limit, !pick && !item && !done, () => finish(null));

  const lvNow = mode === 'mix' ? -1 : m.lv[mode];
  const title = mode === 'mix' ? '🎲 골고루' : `${CAT[mode].icon} ${CAT[mode].name} ${lvNow + 1}단계 · ${stageName(catStage(mode, lvNow))}`;
  const rate = t.solved ? Math.round(t.correct / t.solved * 100) : 0;
  const isRem = p.ans.includes('…');
  const frac = limit ? left / limit : 1;
  return (
    <div class="screen" data-math="1" data-mode={mode}>
      <Backdrop theme="library" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="수학 처음으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 25 }} data-stage={mode}>{title}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 26 }} data-count="1">📝 {Math.min(t.solved + (done || pick ? 0 : 1), t.perDay)} / {t.perDay} · ⭕ {t.correct}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 86, fontSize: 22 }}>
          🎁 {allGot ? '꾸미기 다 모음!' : <span style={{ letterSpacing: 2 }}>{'●'.repeat(filled)}{'○'.repeat(ITEM_EVERY - filled)}</span>}
          <span style={{ marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MatIcon size={28} /> {mathMatsLeft(m)}</span>
        </div>
        {matPop > 0 && <div key={matPop} class="m-pop" data-mat-pop={matPop}><MatIcon size={30} /> +1</div>}
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
            <div class={`m-msg ${pick && pick !== p.ans ? 'no' : ''}`}>
              {pick ? (pick === p.ans ? '⭕ 정답!' : pick === '⏰' ? `⏰ 시간 끝! 정답은 ${p.ans}` : `정답은 ${p.ans}`) : ''}
            </div>
          </div>
        ) : (
          <div class="m-card" data-done="1">
            <div style={{ fontSize: 64, color: '#4a2f63' }}>오늘 문제 끝! 🎉</div>
            <div style={{ fontSize: 38 }}>{t.solved}문제 중 {t.correct}개 맞혔어 ({rate}%)</div>
            <TodaySummary ups={ups} />
            <div style={{ fontSize: 22, color: '#7a5b8f', padding: '0 40px', lineHeight: 1.5 }}>
              그날 {Math.min(UP_MIN, t.perDay)}문제 이상 푼 항목을 {Math.round(PASS_RATE * 100)}% 이상 맞히면 그 항목은 다음 단계로 가요<br />
              꾸미기는 정답 {ITEM_EVERY}개마다, 집 재료는 정답 {MAT_EVERY}개마다
            </div>
            <div style={{ display: 'flex', gap: 30 }}>
              <button class="btn violet" onClick={() => { sfx.tap(); onCloset(); }}>👗 {who} 옷장</button>
              <button class="btn" onClick={() => { sfx.tap(); onBack(); }}>수학 처음으로</button>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 26, pointerEvents: 'none' }}>
          <Pet pet={pet} wear={mathWear(pet, m)} size={200} autoTalk={false}
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
