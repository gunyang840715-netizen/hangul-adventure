// 수학 첫 화면: 항목 고르기(덧셈·뺄셈·곱셈·나눗셈·골고루) · 수학 옷장 · 수학 집(집 짓기·집 안·마당·놀이터 — 한글 집과 따로)
// 화면에 보이는 이름은 부모 설정의 '수학 이름'(기기 저장값)만 — 저장소에는 아이 이름을 쓰지 않는다
import { Backdrop } from '../art/Scene';
import { Pet } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sfx } from '../engine/audio';
import { ITEM_LIST } from '../data/pets';
import { CATS, STAGES, catStage, type Mode } from '../math/mathData';
import { mathState, todayMath, todayCat, mathPet, mathWear, mathWho, mathName, mathMatsLeft } from '../math/mathStore';
import { TodaySummary } from './MathScreen';
import '../math/math.css';

export function MathHome({ onBack, onPlay, onCloset, onHouse }: { onBack: () => void; onPlay: (mode: Mode) => void; onCloset: () => void; onHouse: () => void }) {
  const m = mathState();
  const t = todayMath(m);
  const done = t.solved >= t.perDay;
  const who = mathWho(m), name = mathName(m);
  const pet = mathPet(m);
  const card = (mode: Mode, icon: string, label: string, sub: string, count: number) => (
    <button class={`m-cat ${done ? 'off' : ''}`} data-cat={mode} onClick={() => { if (done) { sfx.boing(); return; } sfx.tap(); onPlay(mode); }}>
      <span class="m-cat-icon">{icon}</span>
      <span class="m-cat-name">{label}</span>
      <span class="m-cat-sub">{sub}</span>
      {count > 0 && <span class="m-cat-count">오늘 {count}문제</span>}
    </button>
  );
  return (
    <div class="screen" data-math-home="1">
      <Backdrop theme="sky" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="처음 화면">🏠</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 22, fontSize: 32 }}>✏️ {name ? `${name} 수학` : '수학'}</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 22, fontSize: 26 }} data-today="1">
          📝 오늘 {t.solved}/{t.perDay} · ⭕ {t.correct} · <MatIcon size={30} /> {mathMatsLeft(m)} · 👗 {m.owned.length}/{ITEM_LIST.length}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontSize: 34, color: '#fff', textShadow: '0 3px 0 #9775fa' }}>
          {done ? '오늘 문제를 다 풀었어! 내일 또 하자 🎉' : '무엇을 풀까?'}
        </div>
        <div class="m-cats">
          {CATS.map(c => card(c.id, c.icon, c.name, `${m.lv[c.id] + 1}단계 · ${STAGES[catStage(c.id, m.lv[c.id])].sub}`, todayCat(c.id, m).solved))}
          {card('mix', '🎲', '골고루', '네 가지 섞어서', 0)}
        </div>
        {done && <div style={{ position: 'absolute', left: 0, right: 0, top: 560 }}><TodaySummary /></div>}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, display: 'flex', gap: 30, justifyContent: 'center' }}>
          <button class="btn violet" onClick={() => { sfx.tap(); onCloset(); }}>👗 {who} 옷장</button>
          <button class="btn mint" data-math-house="1" onClick={() => { sfx.tap(); onHouse(); }}>🏡 {who} 집 꾸미기</button>
        </div>
        <div style={{ position: 'absolute', left: 10, bottom: 10, pointerEvents: 'none' }}>
          <Pet pet={pet} wear={mathWear(pet, m)} size={190} motion="bob" autoTalk={false} />
        </div>
      </div>
    </div>
  );
}
