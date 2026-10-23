// 수학 모드 (초등 2학년 언니 — 한글 모드와 따로): 게임 없이 문제 풀기
// - 문제 하나에 보기 4개(객관식), 하루 50문제(부모 설정에서 바꿈) → '오늘 끝'
// - 정답 10개마다 언니 옷장에 꾸미기 하나 (틀려도 가져가지 않음)
// - 하루 문제의 90% 이상 맞히면 다음 날 다음 단계 (부모 설정에서 단계를 직접 바꿀 수도 있음)
// - 한글 진도·하루 사용 시간·동생 옷장과 섞이지 않는다 (기록은 State.math 한 칸)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon } from '../art/Pet';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM, ITEM_LIST } from '../data/pets';
import { makeProblem, stageName, STAGES, ITEM_EVERY, PASS_RATE, type Problem } from '../math/mathData';
import { mathState, todayMath, answerMath, toNextItem, mathPet, mathWear } from '../math/mathStore';
import '../math/math.css';

export function MathScreen({ onBack, onCloset }: { onBack: () => void; onCloset: () => void }) {
  const [p, setP] = useState<Problem>(() => makeProblem(mathState().level));
  const [pick, setPick] = useState<string | null>(null);    // 고른 보기 (맞았는지 보여 주는 중)
  const [item, setItem] = useState<string | null>(null);    // 방금 받은 꾸미기
  const [done, setDone] = useState(() => { const t = todayMath(); return t.solved >= t.perDay; });
  const [up, setUp] = useState(false);                       // 오늘 다음 단계로 올라감
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
  const lv = m.level;
  const pet = mathPet(m);
  const allGot = m.owned.length >= ITEM_LIST.length;
  const filled = ITEM_EVERY - toNextItem(m);

  const choose = (o: string) => {
    if (busy.current || done || item) return;
    busy.current = true;
    const ok = o === p.ans;
    setPick(o);
    if (ok) sfx.ding(); else sfx.boing();
    const r = answerMath(ok);
    syncSoon(4000);
    timer.current = window.setTimeout(() => {
      setPick(null);
      busy.current = false;
      if (r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); setItem(r.item); }
      if (r.finished) {
        setDone(true); setUp(r.leveledUp);
        if (!r.item) { sfx.fanfare(); burst(640, 300, 'confetti'); }
      }
      setP(makeProblem(mathState().level));
    }, ok ? 650 : 1700);
  };

  const rate = t.solved ? Math.round(t.correct / t.solved * 100) : 0;
  const isRem = p.ans.includes('…');
  return (
    <div class="screen" data-math="1">
      <Backdrop theme="library" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="처음 화면">🏠</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 26 }} data-stage={lv}>✏️ {lv + 1}단계 · {stageName(lv)}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 26 }} data-count="1">📝 {Math.min(t.solved + (done ? 0 : 1), t.perDay)} / {t.perDay} · ⭕ {t.correct}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 86, fontSize: 22 }}>
          🎁 {allGot ? '꾸미기를 모두 모았어!' : <span style={{ letterSpacing: 2 }}>{'●'.repeat(filled)}{'○'.repeat(ITEM_EVERY - filled)}</span>}
        </div>
        <button class="btn violet small" style={{ position: 'absolute', left: 20, top: 112 }} onClick={() => { sfx.tap(); onCloset(); }}>👗 언니 옷장</button>

        {!done ? (
          <div class="m-card" data-q={p.q}>
            <div class="m-q">{p.q} = {isRem ? '? … ?' : '?'}</div>
            <div class="m-opts">
              {p.opts.map(o => (
                <button class={`m-opt ${pick ? (o === p.ans ? 'ok' : o === pick ? 'no' : 'dim') : ''}`} data-opt={o} onClick={() => choose(o)}>{o}</button>
              ))}
            </div>
            <div class={`m-msg ${pick && pick !== p.ans ? 'no' : ''}`}>{pick ? (pick === p.ans ? '⭕ 정답!' : `정답은 ${p.ans}`) : ''}</div>
          </div>
        ) : (
          <div class="m-card" data-done="1">
            <div style={{ fontSize: 66, color: '#4a2f63' }}>오늘 문제 끝! 🎉</div>
            <div style={{ fontSize: 40 }}>{t.solved}문제 중 {t.correct}개 맞혔어 ({rate}%)</div>
            <div style={{ fontSize: 30, color: '#7a5b8f', padding: '0 40px' }}>
              {up ? `내일부터 ${lv + 1}단계: ${stageName(lv)}`
                : lv >= STAGES.length - 1 ? '마지막 단계야! 계속 연습해서 더 빨라지자.'
                : `하루 문제의 ${Math.round(PASS_RATE * 100)}% 넘게 맞히면 다음 단계로 가요`}
            </div>
            <div style={{ display: 'flex', gap: 30 }}>
              <button class="btn violet" onClick={() => { sfx.tap(); onCloset(); }}>👗 언니 옷장</button>
              <button class="btn" onClick={() => { sfx.tap(); onBack(); }}>처음 화면</button>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', left: 14, bottom: 26 }}>
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
              <div class="pill" style={{ fontSize: 24 }}>👗 언니 옷장에 넣었어 · 정답 {ITEM_EVERY}개마다 하나</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
