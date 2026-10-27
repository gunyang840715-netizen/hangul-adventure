// 수학 간식 주기 (10-24 사용자 요청): 수학 문제 정답 5개마다 받은 간식을 수학 집의 강아지·고양이에게 먹이기
// - 한글 '우리 집' 간식과 따로 (State.math의 snacks·eaten·fed·fedPlus — 한글 간식·성장은 건드리지 않음)
// - 10-25 사용자 요청: 수학 친구도 한글처럼 다 큰 모습이 아니라 아기부터 — 간식 점수만큼 자라고(한글과 같은 점수표: Lv.1~10 · 아기·어린이·어른),
//   레벨이 오르면 한글 우리 집과 같은 '쑥쑥 컸어!' 창. 먹을 때마다 하트(먹은 횟수)도 그대로 늘어남
// - 10-27 사용자 요청: 성장 단계·레벨업 없앰 — 언제나 아기 모습, Lv·성장 막대·'쑥쑥 컸어!' 창 없음(먹은 하트는 그대로, 점수 기록도 저장에 남음)
// - 강아지 간식은 강아지, 고양이 간식은 고양이, 같이 먹는 간식은 고른 친구에게 (한글 우리 집과 같은 규칙)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, toSafe } from '../art/Scene';
import { Pet, SnackIcon } from '../art/Pet';
import { say, sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import type { PetView } from '../engine/store';
import { SNACKS, SNACK, CLASSIC_SNACKS, PET, type Species } from '../data/pets';
import { STUDY_NO_SNACK } from '../data/voice';
import { SNACK_EVERY } from '../math/mathData';
import { mathState, mathPet, mathPetView, mathSnackCount, mathSnackTotal, mathFedCount, mathFeed } from '../math/mathStore';
import '../math/math.css';

/** 간식 바구니: 가진 간식 먼저(20가지라 다 보이면 너무 많음), 6칸이 안 되면 처음부터 있던 간식을 빈 칸으로 */
function trayList() {
  const have = SNACKS.filter(sn => mathSnackCount(sn.id) > 0);
  const pad = CLASSIC_SNACKS.map(id => SNACK[id]).filter(sn => !have.includes(sn));
  return have.length >= 6 ? have : [...have, ...pad.slice(0, 6 - have.length)];
}

/** 이름표 + 먹은 횟수 하트 (10-27 사용자 요청: Lv·성장 막대 없앰) */
function Growth({ v, fed }: { v: PetView; fed: number }) {
  return (
    <div class="grow-card" data-fed={fed}>
      <div class="grow-name">{v.breed} <b>{v.name}</b></div>
      <div class="grow-lv">💗 {fed}</div>
    </div>
  );
}

const POS: Record<Species, { left: number; top: number; size: number }> = { dog: { left: 170, top: 250, size: 300 }, cat: { left: 630, top: 270, size: 280 } };

export function MathFeed({ onBack }: { onBack: () => void }) {
  const [, force] = useState(0);
  const [sel, setSel] = useState<Species>(() => PET[mathPet()]?.species ?? 'dog');
  const [fly, setFly] = useState<{ id: string; from: [number, number]; to: [number, number]; go: boolean; k: number } | null>(null);
  const [eating, setEating] = useState<Species | null>(null);
  const [bub, setBub] = useState<{ who: Species; text: string } | null>(null);
  const busy = useRef(false);
  useEffect(() => () => { syncSoon(500); }, []);
  const m = mathState();
  const view = { dog: mathPetView('dog', m), cat: mathPetView('cat', m) };
  const total = mathSnackTotal(m);

  const talk = (who: Species, text: string) => { setBub({ who, text }); setTimeout(() => setBub(b => (b && b.text === text ? null : b)), 1600); };

  const tapPet = (sp: Species) => {
    sfx.pop(); setSel(sp);
    sp === 'dog' ? sfx.bark(1) : sfx.meow();
    talk(sp, sp === 'dog' ? '멍멍!' : '야옹~');
  };

  const give = async (id: string, e: any) => {
    if (busy.current) return;
    if (mathSnackCount(id) <= 0) { sfx.boing(); say(STUDY_NO_SNACK); return; }
    const sn = SNACK[id];
    const who: Species = sn.for === 'both' ? sel : sn.for;
    if (sn.for !== 'both' && sn.for !== sel) talk(sel, sn.for === 'dog' ? '강아지 간식이네!' : '고양이 간식이네!');
    busy.current = true;
    const r = e.currentTarget.getBoundingClientRect();
    const from = toSafe(r.left + r.width / 2, r.top + r.height / 2);
    const P = POS[who];
    const to: [number, number] = [P.left + P.size / 2, P.top + P.size * 0.62];
    sfx.whoosh();
    setFly({ id, from, to, go: false, k: Date.now() });
    requestAnimationFrame(() => requestAnimationFrame(() => setFly(f => f && { ...f, go: true })));
    await new Promise(res => setTimeout(res, 560));
    setFly(null);
    const petId = view[who].id;
    const ok = mathFeed(petId, id);
    busy.current = false;
    if (!ok) return;
    sfx.pop(); burst(...to);
    setEating(who); setTimeout(() => setEating(null), 1300);
    who === 'dog' ? sfx.bark(1) : sfx.meow();
    talk(who, sn.points > 1 ? '제일 좋아! 냠냠!' : '냠냠!');
    // 10-27 사용자 요청: 레벨업 없음 — 먹어도 크지 않고 '쑥쑥 컸어!' 창도 없음
    say('냠냠! 맛있다!');
    syncSoon(3000);
    force(x => x + 1);
  };

  return (
    <div class="screen" data-math-feed="1">
      <Backdrop theme="meadow" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 30 }}>🍪 간식 주기</div>
        <div class="pill" style={{ position: 'absolute', right: 24, top: 24, fontSize: 24 }} data-snack-total={total}>
          간식 {total}개 · 수학·맞춤법 정답 {SNACK_EVERY}개마다 하나
        </div>
        {(['dog', 'cat'] as const).map(sp => {
          const v = view[sp];
          const P = POS[sp];
          return (
            <>
              <div style={{ position: 'absolute', left: P.left, top: P.top - 130, width: P.size, display: 'flex', justifyContent: 'center' }}>
                <Growth v={v} fed={mathFedCount(v.id, m)} />
              </div>
              <div class={`house-pet ${sel === sp ? 'sel' : ''}`} data-feed-pet={sp} style={{ left: P.left, top: P.top, width: P.size, height: P.size }} onClick={() => tapPet(sp)}>
                <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={P.size} mood={eating === sp ? 'love' : 'happy'} motion={eating === sp ? 'jump' : 'bob'} autoTalk={false} />
                {bub?.who === sp && <div class="bd-bubble" style={{ bottom: '92%' }}>{bub.text}</div>}
              </div>
            </>
          );
        })}
        <div style={{ position: 'absolute', left: 990, top: 290, padding: '14px 20px', borderRadius: 24, background: 'rgba(255,255,255,.9)', boxShadow: 'var(--shadow)', fontSize: 22, lineHeight: 1.55, color: '#6d3f8c' }}>
          간식을 누르면<br />먹여 줄 수 있어요<br />🐶 강아지 간식<br />🐱 고양이 간식<br />🐶🐱 같이 먹는 간식<br />먹으면 하트가 늘어요
        </div>
        {/* 간식 바구니 */}
        <div class="snack-tray">
          {trayList().map(sn => {
            const n = mathSnackCount(sn.id, m);
            return (
              <button class={`snack-slot ${n ? '' : 'empty'}`} data-snack={sn.id} data-n={n} onClick={(e) => give(sn.id, e)}>
                <SnackIcon id={sn.id} size={78} />
                <span class="snack-n">{n}</span>
                <span class="snack-for">{sn.for === 'dog' ? '🐶' : sn.for === 'cat' ? '🐱' : '🐶🐱'}</span>
              </button>
            );
          })}
        </div>
        {fly && (
          <div class="snack-fly" style={{ left: (fly.go ? fly.to : fly.from)[0] - 40, top: (fly.go ? fly.to : fly.from)[1] - 40, transform: fly.go ? 'scale(.5)' : 'scale(1)' }}>
            <SnackIcon id={fly.id} size={80} />
          </div>
        )}
      </div>
    </div>
  );
}
