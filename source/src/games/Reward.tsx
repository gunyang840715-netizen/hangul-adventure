// 모험을 끝내면 선물 뽑기: 꾸미기 아이템(다 모았으면 간식 세 개) + 별 세 개
import { useEffect, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { say, sayAll, sfx } from '../engine/audio';
import { buddy } from '../engine/bus';
import { addStars, addOwned, setLastItem, starsTotal, nextDrop, addSnack } from '../engine/store';
import { ITEM } from '../data/pets';
import { gotLine } from '../data/voice';
import { randomSnack } from '../engine/gifts';
import { useScene, type GameProps } from './common';
import { pair } from './Buddies';

export function Reward({ onDone }: GameProps<'reward'>) {
  const { sleep } = useScene();
  const [phase, setPhase] = useState<'machine' | 'shake' | 'capsule' | 'open'>('machine');
  const [item, setItem] = useState<string | null>(null);
  const [snacks, setSnacks] = useState<string[]>([]);

  useEffect(() => {
    addStars(3);
    const next = nextDrop();
    if (next) { addOwned(next); setLastItem(next); setItem(next); }
    else { const sn = [randomSnack(), randomSnack(), randomSnack()]; sn.forEach(x => addSnack(x)); setSnacks(sn); }
    say('선물 뽑기 시간! 손잡이를 눌러 봐!');
  }, []);

  const turn = async () => {
    if (phase !== 'machine') return;
    setPhase('shake'); sfx.drum();
    if (!await sleep(1100)) return;
    setPhase('capsule'); sfx.pop();
    await say('캡슐이 나왔어! 눌러서 열어 봐!');
  };

  const open = async () => {
    if (phase !== 'capsule') return;
    setPhase('open'); sfx.fanfare(); burst(640, 0, 'confetti'); burst(640, 380);
    buddy({ t: 'big' });
    if (item) {
      const it = ITEM[item];
      // 자동으로 입히지 않음: 아이가 우리 집에서 직접 꾸며 줌
      await sayAll([gotLine(it.name), '우리 집에서 직접 입혀 줄 수 있어!', '별도 세 개 받았어!']);
    } else {
      await sayAll(['간식을 세 개 받았어!', '별도 세 개 받았어!']);
    }
  };

  const p = pair();
  return (
    <div class="screen">
      <Backdrop theme="castle" />
      <div class="layer">
        <div class="pill" style={{ position: 'absolute', right: 30, top: 24, fontSize: 36 }}>⭐ {starsTotal()}</div>
        {phase !== 'open' ? (
          <>
            <div class={phase === 'shake' ? 'shake-loop' : ''} data-machine="1" style={{ position: 'absolute', left: 440, top: 70 }} onClick={turn}>
              <svg viewBox="0 0 400 620" width={400} height={620}>
                <rect x="70" y="330" width="260" height="250" rx="30" fill="#ff7eb6" stroke="#d9548e" stroke-width="8" />
                <circle cx="200" cy="200" r="170" fill="#e8f6ff" stroke="#fff" stroke-width="10" opacity=".95" />
                {[[130, 250, '#ffd43b'], [200, 280, '#74c0fc'], [270, 250, '#69db7c'], [160, 180, '#b197fc'], [240, 190, '#ff8787'], [200, 120, '#ffa94d'], [110, 150, '#63e6be'], [290, 150, '#f783ac']].map(([x, y, c]) => (
                  <g><circle cx={x} cy={y} r="36" fill={c as string} /><path d={`M${+x - 36} ${y} a36 36 0 0 0 72 0 z`} fill="#fff" opacity=".85" /></g>
                ))}
                <ellipse cx="140" cy="110" rx="40" ry="22" fill="#fff" opacity=".7" transform="rotate(-30 140 110)" />
                <rect x="150" y="480" width="100" height="70" rx="16" fill="#5a3d73" />
                <g class={phase === 'machine' ? 'pulse' : ''} style={{ transformOrigin: '200px 410px', transformBox: 'view-box' } as any}>
                  <circle cx="200" cy="410" r="48" fill="#ffd43b" stroke="#e0a800" stroke-width="8" />
                  <rect x="190" y="370" width="20" height="80" rx="10" fill="#fff" />
                </g>
              </svg>
              {phase === 'capsule' && (
                <div data-capsule="1" class="slide-up" style={{ position: 'absolute', left: 115, top: 470 }} onClick={(e) => { e.stopPropagation(); open(); }}>
                  <div class="capsule pulse" style={{ '--c1': '#ff8fb8' } as any} />
                </div>
              )}
            </div>
            <div style={{ position: 'absolute', left: 60, top: 450 }}><Pet pet={p.lead.id} stage={p.lead.stage} level={p.lead.level} wear={p.lead.wear} size={250} motion="jump" /></div>
            <div style={{ position: 'absolute', left: 930, top: 480 }}><Pet pet={p.other.id} stage={p.other.stage} level={p.other.level} wear={p.other.wear} size={220} motion="bob" autoTalk={false} /></div>
          </>
        ) : (
          <div class="slide-up" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
            <div style={{ position: 'relative', width: 480, height: 440 }}>
              <div style={{ position: 'absolute', left: 230, top: 170 }}><Pet pet={p.other.id} stage={p.other.stage} level={p.other.level} wear={p.other.wear} size={260} motion="cheer" mood="love" autoTalk={false} /></div>
              <div style={{ position: 'absolute', left: 0, top: 40 }}><Pet pet={p.lead.id} stage={p.lead.stage} level={p.lead.level} wear={p.lead.wear} size={380} motion="cheer" /></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}>
              <div class="gift-icon glyph-bounce" style={{ background: '#fff', borderRadius: 40, padding: 16 }}>
                {item ? <ItemIcon id={item} size={180} /> : <div style={{ display: 'flex' }}>{snacks.map(sn => <SnackIcon id={sn} size={90} />)}</div>}
              </div>
              <div style={{ fontSize: 56, color: '#fff', textShadow: '0 4px 0 #9775fa' }}>{item ? ITEM[item].name : '간식 세 개'}</div>
              <div class="pill" style={{ fontSize: 34 }}>⭐ +3</div>
              <button class="btn big" onClick={() => { sfx.tap(); onDone(); }}>지도로 ▶</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
