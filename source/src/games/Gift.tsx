// 놀이를 끝내면 잠깐 나오는 선물 창: 간식 또는 꾸미기 아이템
import { useEffect, useRef } from 'preact/hooks';
import { burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { say, sfx, wait, sceneId } from '../engine/audio';
import { buddy } from '../engine/bus';
import { snackTotal, matsLeft } from '../engine/store';
import { SNACK, ITEM, eul } from '../data/pets';
import type { Gift } from '../engine/gifts';
import { pair } from './Buddies';
import { MatIcon } from '../art/Build';
import { MAT_LINE, MAT_NAME } from '../data/voice';

export const giftLine = (g: Gift) => g.kind === 'mat' ? MAT_LINE : `${eul(g.kind === 'snack' ? SNACK[g.id].name : ITEM[g.id].name)} 받았어!`;

export function GiftPop({ gift, onDone }: { gift: Gift; onDone: () => void }) {
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onDone(); } };
  const p = pair();
  // 꾸미기 아이템은 자동으로 입히지 않는다 → 아이가 우리 집에서 강아지·고양이에게 직접 입혀 줌
  const item = gift.kind === 'item' ? ITEM[gift.id] : null;
  useEffect(() => {
    const sc = sceneId();
    (async () => {
      sfx.sparkle(); burst(640, 330, 'star');
      buddy({ t: 'big' });
      await wait(250);
      await say(giftLine(gift));
      if (item && sc === sceneId()) await say('우리 집에서 직접 입혀 줄 수 있어!');
      if (gift.kind === 'mat' && sc === sceneId()) await say('우리 집에서 집을 지어 줄 수 있어!');
      await wait(700);
      if (sc === sceneId()) finish();
    })();
    const t = setTimeout(finish, 8000);
    return () => clearTimeout(t);
  }, []);
  const name = gift.kind === 'snack' ? SNACK[gift.id].name : gift.kind === 'mat' ? MAT_NAME : ITEM[gift.id].name;
  return (
    <div class="overlay gift-pop fade-in" onClick={finish} data-gift={gift.kind}>
      <div class="layer">
        <div style={{ position: 'absolute', left: 90, top: 330 }}><Pet pet={p.lead.id} stage={p.lead.stage} level={p.lead.level} wear={p.lead.wear} size={280} motion="cheer" mood="love" /></div>
        <div style={{ position: 'absolute', left: 930, top: 360 }}><Pet pet={p.other.id} stage={p.other.stage} level={p.other.level} wear={p.other.wear} size={250} motion="cheer" mood="love" autoTalk={false} /></div>
        <div class="gift-card slide-up">
          <div class="gift-ribbon">{gift.kind === 'snack' ? '간식 선물!' : gift.kind === 'mat' ? '집 짓기 재료!' : '새 선물!'}</div>
          <div class="gift-icon glyph-bounce">{gift.kind === 'snack' ? <SnackIcon id={gift.id} size={210} /> : gift.kind === 'mat' ? <MatIcon size={210} /> : <ItemIcon id={gift.id} size={210} />}</div>
          <div class="gift-name">{name}</div>
          {gift.kind === 'snack'
            ? <div class="pill" style={{ fontSize: 26 }}>🎒 간식 {snackTotal()}개 · 우리 집에서 먹여 줘요</div>
            : gift.kind === 'mat'
              ? <div class="pill" style={{ fontSize: 26 }}>🧱 재료 {matsLeft()}개 · 우리 집에서 집을 지어요</div>
              : <div class="pill" style={{ fontSize: 26 }}>👗 옷장에 넣었어요 · 우리 집에서 입혀 줘요</div>}
        </div>
      </div>
    </div>
  );
}
