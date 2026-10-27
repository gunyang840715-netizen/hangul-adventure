// 레벨업 (10-27 사용자 요청: 레벨업 되살림 — 레벨이 올라도 크기는 그대로(언제나 아기 모습),
// 대신 레벨이 올라야 꾸미기 착용·집 짓기·놀이터 짓기가 단계별로 열림. 표는 data/unlock.ts)
// 한글 '우리 집'과 수학 '간식 주기'가 같이 쓴다: 이름표(Lv·다음 레벨까지 막대·다음에 열릴 것) · 레벨업 창(새로 열린 것)
import { Pet } from '../art/Pet';
import { sfx } from '../engine/audio';
import type { PetView } from '../engine/store';
import { MAX_LEVEL, levelProgress } from '../data/pets';
import { unlockIcon, unlockLabel, type Unlock } from '../data/unlock';
import { levelUpLine, wearOpenLine, buildOpenLine } from '../data/voice';

export interface LevelUpInfo { v: PetView; lv: number; opens: Unlock[] }

/** 레벨업 때 하는 말: '뭉치가 레벨 3이 됐어!' + 새로 열린 것('이제 옷을 입을 수 있어!' …) */
export const levelUpSay = (u: LevelUpInfo) => [levelUpLine(u.v.name, u.lv), ...u.opens.map(o => (o.kind === 'wear' ? wearOpenLine(o.slot) : buildOpenLine(o.id, o.parts)))];

/** 이름표: 품종·이름, Lv와 다음 레벨까지 막대, 다음 레벨에 열릴 것(아이콘) — fed가 있으면 먹은 하트도(수학) */
export function LevelTag({ v, next, fed }: { v: PetView; next: Unlock[]; fed?: number }) {
  const top = v.level >= MAX_LEVEL;
  return (
    <div class="grow-card" data-lv={v.level} data-fed={fed}>
      <div class="grow-name">{v.breed} <b>{v.name}</b></div>
      <div class="grow-lv">Lv.{v.level}{top ? ' · 최고!' : ''}{fed !== undefined ? ` · 💗 ${fed}` : ''}
        {!top && next.length > 0 && <span class="grow-next" data-next={next.length}>다음 {next.map(o => unlockIcon(o)).join('')}</span>}
      </div>
      <div class="grow-bar"><i style={{ width: `${top ? 100 : Math.round(levelProgress(v.points) * 100)}%` }} /></div>
    </div>
  );
}

/** 레벨업 창: 친구(크기 그대로)·'레벨 업!'·Lv·새로 열린 것 */
export function LevelUpCard({ info, onClose }: { info: LevelUpInfo; onClose: () => void }) {
  return (
    <div class="overlay fade-in" style={{ background: 'rgba(60,30,90,.45)', zIndex: 40 }} onClick={() => { sfx.tap(); onClose(); }}>
      <div class="layer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div class="card slide-up lvup-card" data-levelup={info.lv}>
          <Pet pet={info.v.id} stage={info.v.stage} level={info.v.level} wear={info.v.wear} size={300} motion="cheer" mood="love" />
          <div class="lvup-side">
            <div class="lvup-title">레벨 업!</div>
            <div class="pill" style={{ fontSize: 40 }}>Lv.{info.lv}</div>
            {info.opens.length > 0 && (
              <div class="lvup-opens">
                <div class="lvup-new">🔓 새로 열렸어요</div>
                {info.opens.map(o => (
                  <div class="lvup-open" data-open={o.kind === 'wear' ? o.slot : o.id}>
                    <span class="lvup-ic">{unlockIcon(o)}</span><span>{unlockLabel(o)}</span>
                  </div>
                ))}
              </div>
            )}
            <button class="btn big">좋아! ▶</button>
          </div>
        </div>
      </div>
    </div>
  );
}
