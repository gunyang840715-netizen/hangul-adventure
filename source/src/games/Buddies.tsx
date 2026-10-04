// 강아지·고양이 친구가 놀이를 함께 한다: 맞히면 같이 뛰고, 틀리면 걱정하고, 말풍선으로 응원
import { useEffect, useRef, useState } from 'preact/hooks';
import { Pet, type Mood, type Motion } from '../art/Pet';
import { load, petView, type PetView } from '../engine/store';
import { onBuddy } from '../engine/bus';
import { sfx } from '../engine/audio';
import type { Species } from '../data/pets';
import { ReadingDesk } from '../art/Library';

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const CHEER: Record<Species, string[]> = {
  dog: ['멍멍!', '왈왈! 최고!', '멍! 잘했어!', '멍멍! 멋져!', '꼬리가 신나!'],
  cat: ['야옹~', '냐옹! 맞았어!', '야옹! 최고!', '골골골~', '냥! 대단해!'],
};
const BIG: Record<Species, string[]> = { dog: ['왈왈! 해냈다!', '멍멍멍! 최고야!'], cat: ['야옹~ 멋지다냥!', '냐옹! 해냈어!'] };
const OOPS: Record<Species, string[]> = { dog: ['킁킁… 다시!', '괜찮아, 멍!'], cat: ['냥…? 다시 해 봐!', '괜찮아냥!'] };

/** 지금 고른 친구 둘 (주인공이 앞) */
export function pair(): { lead: PetView; other: PetView } {
  const s = load();
  const lead = s.lead === 'cat' ? 'cat' : 'dog';
  return { lead: petView(lead), other: petView(lead === 'dog' ? 'cat' : 'dog') };
}

/** 친구 한 마리 (주인공 또는 다른 친구, 또는 강아지/고양이 지정) */
export function Buddy({ who = 'lead', size = 200, mood, motion = 'bob', autoTalk, style, class: cls }: { who?: 'lead' | 'other' | Species; size?: number; mood?: Mood; motion?: Motion; autoTalk?: boolean; style?: any; class?: string }) {
  const p = pair();
  const v = who === 'lead' ? p.lead : who === 'other' ? p.other : petView(who);
  return <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={size} mood={mood} motion={motion} autoTalk={autoTalk ?? who === 'lead'} style={style} class={cls} />;
}

interface Props { mood?: Mood; motion?: Motion; size?: number; style?: any; class?: string; reading?: boolean }

/** 놀이 화면 왼쪽 아래의 두 친구 */
export function Buddies({ mood = 'happy', motion = 'bob', size = 170, style, class: cls = '', reading = false }: Props) {
  const { lead, other } = pair();
  const [r, setR] = useState<{ lm?: Mood; lmo?: Motion; om?: Mood; omo?: Motion }>({});
  const [bub, setBub] = useState<{ lead?: string; other?: string; k: number }>({ k: 0 });
  const t1 = useRef(0), t2 = useRef(0);
  const turn = useRef(0);

  useEffect(() => {
    const react = (p: typeof r, ms: number) => { setR(p); clearTimeout(t1.current); t1.current = window.setTimeout(() => setR({}), ms); };
    const say = (b: { lead?: string; other?: string }, ms: number) => { setBub(x => ({ ...b, k: x.k + 1 })); clearTimeout(t2.current); t2.current = window.setTimeout(() => setBub(x => ({ k: x.k })), ms); };
    return onBuddy(e => {
      const who = (turn.current++ % 2) ? 'other' : 'lead';
      const sp = who === 'lead' ? lead.species : other.species;
      switch (e.t) {
        case 'cheer':
          react({ lm: 'wow', lmo: 'jump', om: 'happy', omo: 'jump' }, 800);
          say({ [who]: pick(CHEER[sp]) }, 1300);
          if (Math.random() < 0.5) sp === 'dog' ? sfx.bark(1) : sfx.meow();
          break;
        case 'big':
          react({ lm: 'love', lmo: 'cheer', om: 'love', omo: 'cheer' }, 1800);
          say({ lead: pick(BIG[lead.species]), other: pick(BIG[other.species]) }, 1900);
          lead.species === 'dog' ? sfx.bark(2) : sfx.meow();
          setTimeout(() => { other.species === 'dog' ? sfx.bark(2) : sfx.meow(); }, 450);
          break;
        case 'oops':
          react({ lm: 'think', lmo: 'none', om: 'think', omo: 'none' }, 1000);
          say({ other: pick(OOPS[other.species]) }, 1200);
          break;
        case 'count':
          react({ omo: 'hop' }, 500);
          say({ other: e.text }, 900);
          break;
        case 'hint': case 'say':
          say({ [e.who === lead.species ? 'lead' : 'other']: e.text }, 2200);
          break;
        case 'eat': {
          const w = e.who === lead.species ? 'lead' : 'other';
          react(w === 'lead' ? { lm: 'love', lmo: 'jump' } : { om: 'love', omo: 'jump' }, 1200);
          say({ [w]: '냠냠!' }, 1100);
          break;
        }
        case 'wave':
          react({ lmo: 'jump', omo: 'jump' }, 700);
          break;
      }
    });
  }, [lead.id, other.id]);

  const W = size * 1.55;
  return (
    <div class={`game-mascot buddies ${cls}`} style={{ width: W, height: size, ...style }}>
      <div style={{ position: 'absolute', left: size * 0.62, bottom: 0 }} data-buddy="other">
        <Pet pet={other.id} stage={other.stage} level={other.level} wear={other.wear} size={size * 0.86} mood={r.om ?? 'happy'} motion={r.omo ?? 'bob'} autoTalk={false} />
        {bub.other && <div class="bd-bubble" key={'o' + bub.k}>{bub.other}</div>}
      </div>
      <div style={{ position: 'absolute', left: 0, bottom: 0 }} data-buddy="lead">
        <Pet pet={lead.id} stage={lead.stage} level={lead.level} wear={lead.wear} size={size} mood={r.lm ?? mood} motion={r.lmo ?? motion} />
        {bub.lead && <div class="bd-bubble" key={'l' + bub.k}>{bub.lead}</div>}
      </div>
      {/* 도서관: 책상에 앉아 책을 펴고 공부하는 모습 */}
      {reading && <ReadingDesk w={W} h={size * 0.36} />}
    </div>
  );
}
