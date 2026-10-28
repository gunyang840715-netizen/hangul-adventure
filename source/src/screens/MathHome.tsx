// 수학·맞춤법 첫 화면: 수학 항목 고르기(덧셈·뺄셈·곱셈·나눗셈·골고루) · 맞춤법(10-25 — 새 문제 / 틀린 문제 다시 풀기) · 옷장 · 집(집 짓기·집 안·마당·놀이터 — 한글 집과 따로) · 간식 주기
// 하루 공부 시간(부모 설정 30분·1시간)이 다 되면 오늘은 못 고름, 한 항목은 하루 150문제까지 (맞춤법도 150문제)
// 공부 먼저(10-28): 오늘 공부 분량을 채우기 전에는 옷장·집 꾸미기·간식 주기가 잠김(문제·맞춤법은 그대로) — lib/gate.ts
// 화면 이름은 부모 설정의 이름(기기 저장값)만 — 10-25 사용자 요청으로 '○○ 수학' 대신 이름만(없으면 '수학·맞춤법'). 저장소에는 아이 이름을 쓰지 않는다
import { useEffect, useState } from 'preact/hooks';
import { Backdrop } from '../art/Scene';
import { Pet } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { ITEM_LIST } from '../data/pets';
import { CATS, STAGES, CAT_MAX, SP_CAT, catStage, type Mode } from '../math/mathData';
import { mathState, todayMath, todayCat, mathTimeUp, openCats, mathPet, mathPetInfo, mathWear, mathWho, modeTitle, mathMatsLeft, mathSnackTotal, spellWrong, spellStats } from '../math/mathStore';
import { TodaySummary, leftText } from './MathScreen';
import { gateLocked, takeGateOpened } from '../lib/gate';
import { GatePill, GateBanner, celebrateGate } from './GateUI';
import '../math/math.css';

export function MathHome({ onBack, onPlay, onSpell, onCloset, onHouse, onFeed }: {
  onBack: () => void; onPlay: (mode: Mode) => void; onSpell: (review: boolean) => void; onCloset: () => void; onHouse: () => void; onFeed?: () => void;
}) {
  const m = mathState();
  const t = todayMath(m);
  const locked = gateLocked('m');         // 오늘 공부를 마치기 전: 옷장·집 꾸미기·간식 주기 잠김
  const [cele, setCele] = useState(false);
  // 분량을 채워서 문이 열린 순간 축하 (문제를 풀다가 채웠으면 이 첫 화면으로 돌아왔을 때)
  useEffect(() => {
    if (!takeGateOpened('m')) return;
    setCele(true); celebrateGate();
  });
  const done = mathTimeUp(m);
  const open = openCats(m);
  const who = mathWho(m);
  const pet = mathPet(m);
  const pv = mathPetInfo(pet, m);   // 간식 먹은 만큼 자란 모습 (10-25 — 처음엔 아기)
  const sp = todayCat(SP_CAT, m).solved;
  const spFull = sp >= CAT_MAX;
  const wrongN = spellWrong(m).length;
  const st = spellStats(m);
  const card = (mode: Mode, icon: string, label: string, sub: string, count: number | null, off: boolean) => (
    <button class={`m-cat ${off ? 'off' : ''}`} data-cat={mode} data-off={off ? '1' : undefined} onClick={() => { if (off) { sfx.boing(); return; } sfx.tap(); onPlay(mode); }}>
      <span class="m-cat-icon">{icon}</span>
      <span class="m-cat-name">{label}</span>
      <span class="m-cat-sub">{sub}</span>
      {count !== null && count >= CAT_MAX ? <span class="m-cat-count">오늘 {CAT_MAX}문제 끝!</span>
        : count ? <span class="m-cat-count">오늘 {count}/{CAT_MAX}</span> : null}
    </button>
  );
  const spOff = done || spFull;
  const reviewOff = spOff || !wrongN;
  return (
    <div class="screen" data-math-home="1">
      <Backdrop theme="sky" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="처음 화면">🏠</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 22, fontSize: 32 }} data-mode-title="1">✏️ {modeTitle(m)}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 22, fontSize: 26 }} data-today="1">
          ⏳ {leftText(t.leftMs)} · 📝 {t.solved} · ⭕ {t.correct} · <MatIcon size={30} /> {mathMatsLeft(m)} · 👗 {m.owned.length}/{ITEM_LIST.length}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 104, textAlign: 'center', fontSize: 32, color: '#fff', textShadow: '0 3px 0 #9775fa' }}>
          {done ? '오늘 공부 시간이 끝났어! 내일 또 하자 🎉' : !open.length && spFull ? `오늘 수학·맞춤법 모두 ${CAT_MAX}문제씩 풀었어! 🎉` : `무엇을 풀까? (오늘 공부 시간 ${m.dayMin}분)`}
        </div>
        <div class="m-cats">
          {CATS.map(c => { const k = todayCat(c.id, m).solved; return card(c.id, c.icon, c.name, `${m.lv[c.id] + 1}단계 · ${STAGES[catStage(c.id, m.lv[c.id])].sub}`, k, done || k >= CAT_MAX); })}
          {card('mix', '🎲', '골고루', '네 가지 섞어서', null, done || !open.length)}
        </div>
        {/* 맞춤법 (10-25): 새 문제(틀린 문제도 가끔 섞임) · 틀린 문제만 다시 풀기 */}
        <div class="sp-row">
          <button class={`sp-home ${spOff ? 'off' : ''}`} data-spell-go="1" data-off={spOff ? '1' : undefined}
            onClick={() => { if (spOff) { sfx.boing(); return; } sfx.tap(); onSpell(false); }}>
            <span class="sp-home-icon">✍️</span>
            <span class="sp-home-text">
              <span class="sp-home-name">맞춤법</span>
              <span class="sp-home-sub">속담·명언 속 바른 말 고르기</span>
              <span class="sp-home-sub" data-spell-seen={st.seen}>풀어 본 문제 {st.seen}/{st.total}</span>
            </span>
            {spFull ? <span class="m-cat-count">오늘 {CAT_MAX}문제 끝!</span> : sp ? <span class="m-cat-count">오늘 {sp}/{CAT_MAX}</span> : null}
          </button>
          <button class={`sp-home review ${reviewOff ? 'off' : ''}`} data-spell-review="1" data-off={reviewOff ? '1' : undefined}
            onClick={() => { if (reviewOff) { sfx.boing(); return; } sfx.tap(); onSpell(true); }}>
            <span class="sp-home-icon">🔁</span>
            <span class="sp-home-text">
              <span class="sp-home-name">틀린 문제</span>
              <span class="sp-home-sub">{wrongN ? `${wrongN}개 다시 풀기` : '지금은 없어 👍'}</span>
            </span>
          </button>
        </div>
        {(done || (!open.length && spFull)) && <div style={{ position: 'absolute', left: 0, right: 0, top: 572 }}><TodaySummary /></div>}
        <div class="gate-math-pill"><GatePill kind="m" /></div>
        {cele && <GateBanner onDone={() => setCele(false)} />}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', gap: 30, justifyContent: 'center' }}>
          <button class={`btn violet ${locked ? 'gate-locked' : ''}`} data-gate-locked={locked ? '1' : undefined} onClick={() => { if (!locked) sfx.tap(); onCloset(); }}>{locked ? '🔒' : '👗'} {who} 옷장</button>
          <button class={`btn mint ${locked ? 'gate-locked' : ''}`} data-math-house="1" data-gate-locked={locked ? '1' : undefined} onClick={() => { if (!locked) sfx.tap(); onHouse(); }}>{locked ? '🔒' : '🏡'} {who} 집 꾸미기</button>
          {onFeed && <button class={`btn yellow ${locked ? 'gate-locked' : ''}`} data-math-feed-go="1" data-gate-locked={locked ? '1' : undefined} onClick={() => { if (!locked) sfx.tap(); onFeed(); }}>{locked ? '🔒' : '🍪'} 간식 주기{mathSnackTotal(m) ? ` (${mathSnackTotal(m)})` : ''}</button>}
        </div>
        <div style={{ position: 'absolute', left: 10, bottom: 10, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={190} motion="bob" autoTalk={false} />
        </div>
      </div>
    </div>
  );
}
