// 수학 옷장: 수학 모드에서 받은 꾸미기를 강아지·고양이에게 입혀 보기 (동생 한글나라 옷장과 따로 저장)
// 고른 강아지는 수학 강아지 집에, 고른 고양이는 수학 고양이 집에 산다. 이름은 부모 설정의 '수학 이름'(기기 저장값)
import { useState } from 'preact/hooks';
import { Backdrop } from '../art/Scene';
import { Pet, ItemIcon } from '../art/Pet';
import { sfx } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { PETS, PET, ITEM, ITEM_LIST, SLOT_NAME, SLOT_ICON, itemFits, type Slot } from '../data/pets';
import { mathState, mathPet, mathWear, setMathPet, toggleMathWear, mathWho } from '../math/mathStore';
import { ITEM_EVERY } from '../math/mathData';
import '../math/math.css';

const SLOTS: Slot[] = ['hat', 'clothes', 'glasses', 'neck', 'shoes', 'toy'];

export function MathCloset({ onBack }: { onBack: () => void }) {
  const [, force] = useState(0);
  const [slot, setSlot] = useState<Slot>('hat');
  const [poke, setPoke] = useState(0);
  const m = mathState();
  const pet = mathPet(m);
  const sp = PET[pet].species;
  const wear = mathWear(pet, m);
  const mine = m.owned.map(id => ITEM[id]).filter(it => it && itemFits(it, sp));
  const list = mine.filter(it => it.slot === slot);
  return (
    <div class="screen" data-closet="1">
      <Backdrop theme="meadow" />
      <div class="layer">
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); syncSoon(300); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill" style={{ position: 'absolute', left: 112, top: 24, fontSize: 28 }}>👗 {mathWho(m)} 옷장 · 꾸미기 {m.owned.length}/{ITEM_LIST.length}</div>
        {/* 왼쪽: 친구 고르기 + 그 아래 친구 (버튼 높이가 기기마다 달라도 겹치지 않게 세로로 쌓음) */}
        <div style={{ position: 'absolute', left: 20, top: 100, width: 470, bottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div class="m-pets" style={{ position: 'relative', zIndex: 2 }}>
            {PETS.map(p => (
              <button class={`m-tab ${p.id === pet ? 'on' : ''}`} onClick={() => { sfx.tap(); setMathPet(p.id); setPoke(x => x + 1); force(x => x + 1); }}>
                {p.species === 'dog' ? '🐶' : '🐱'} {p.name}
              </button>
            ))}
          </div>
          {/* 친구 그림(모자 자리까지 위로 넉넉한 그림)이 친구 고르기 버튼을 가리지 않게 누르기는 막음 */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
            <Pet pet={pet} wear={wear} size={340} motion="bob" autoTalk={false} poke={poke} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 500, top: 100, width: 760, bottom: 20, background: 'rgba(255,255,255,.92)', borderRadius: 30, padding: 18, boxSizing: 'border-box', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SLOTS.map(sl => (
              <button class={`m-tab ${sl === slot ? 'on' : ''}`} onClick={() => { sfx.tap(); setSlot(sl); }}>
                {SLOT_ICON[sl]} {SLOT_NAME[sl]} {mine.filter(it => it.slot === sl).length}
              </button>
            ))}
          </div>
          <div class="m-items">
            {list.map(it => (
              <button class={`m-item ${wear[it.slot] === it.key ? 'on' : ''}`} data-item={it.id} aria-label={it.name}
                onClick={() => { sfx.pop(); toggleMathWear(pet, it.slot, it.key); setPoke(x => x + 1); force(x => x + 1); }}>
                <ItemIcon id={it.id} size={104} />
              </button>
            ))}
            {!list.length && (
              <div style={{ gridColumn: '1 / -1', fontSize: 28, color: '#7a5b8f', padding: 30 }}>
                {m.owned.length ? `${PET[pet].name}에게 맞는 ${SLOT_NAME[slot]} 꾸미기는 아직 없어요.` : `수학·맞춤법 문제를 맞히면 정답 ${ITEM_EVERY}개마다 꾸미기가 하나씩 생겨요!`}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
