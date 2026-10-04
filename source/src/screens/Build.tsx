// 집 짓기: 놀이로 모은 재료를 하나씩 써서 강아지 집 · 고양이 집 · 놀이터를 한 부분씩 짓기
import { useEffect, useState } from 'preact/hooks';
import { burst } from '../art/Scene';
import { Pet } from '../art/Pet';
import { BuildArt, MatIcon } from '../art/Build';
import { say, sayAll, sfx, newScene } from '../engine/audio';
import { buddy } from '../engine/bus';
import { petView, matsLeft, builtCount, buildPart, nextBuild, onChange } from '../engine/store';
import { BUILDS, BUILD, partLine, doneBuildLine } from '../data/pets';
import { HOME_IN, HOME_LOCKED } from '../data/voice';

function useRefresh() {
  const [, force] = useState(0);
  useEffect(() => onChange(() => force(x => x + 1)), []);
}

export function BuildScreen({ onBack, onEnter }: { onBack: () => void; onEnter?: (place: 'doghouse' | 'cathouse' | 'park') => void }) {
  useRefresh();
  const [sel, setSel] = useState<string>(() => nextBuild()?.id ?? 'doghouse');
  const [pop, setPop] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [cheer, setCheer] = useState(false);
  const b = BUILD[sel];
  const n = builtCount(sel);
  const left = matsLeft();
  const done = n >= b.parts.length;
  const dog = petView('dog'), cat = petView('cat');

  useEffect(() => { newScene(); say(left > 0 ? '망치를 눌러서 지어 보자!' : '재료가 없어! 놀이를 하면 받을 수 있어!'); }, []);

  const pick = (id: string) => {
    if (id === sel) return;
    sfx.tap(); setSel(id); setPop(-1); setCheer(false);
    say(BUILD[id].name);
  };

  const build = async () => {
    if (busy) return;
    if (done) { sfx.pop(); setCheer(true); setTimeout(() => setCheer(false), 1200); return; }
    if (matsLeft() <= 0) { sfx.boing(); say('재료가 없어! 놀이를 하면 받을 수 있어!'); return; }
    const k = buildPart(sel);
    if (k == null) return;
    setBusy(true);
    sfx.drum(); setTimeout(() => sfx.pop(), 220);
    setPop(k - 1);
    burst(640, 430, 'star');
    const part = b.parts[k - 1];
    if (k >= b.parts.length) {
      setCheer(true);
      sfx.fanfare(); burst(640, 0, 'confetti'); buddy({ t: 'big' });
      await sayAll([partLine(part.name), doneBuildLine(b)]);
    } else {
      buddy({ t: 'cheer' });
      await say(partLine(part.name));
    }
    setBusy(false);
  };

  const petFor = sel === 'doghouse' ? [dog] : sel === 'cathouse' ? [cat] : [dog, cat];
  // 다 지은 집(놀이터)을 누르면 안으로 들어가 꾸미기
  const enter = () => {
    if (!done) { sfx.boing(); say(HOME_LOCKED); return; }
    sfx.pop(); say(HOME_IN);
    onEnter?.(sel as 'doghouse' | 'cathouse' | 'park');
  };
  // 다 지었으면 강아지·고양이가 집 앞에서 낮잠 자다가 놀다가
  const [nap, setNap] = useState(false);
  useEffect(() => { if (!done) return; const t = setInterval(() => setNap(x => !x), 8000); return () => clearInterval(t); }, [done, sel]);
  return (
    <div class="screen">
      <div class="backdrop yard"><div class="yard-sky" /><div class="yard-grass" /></div>
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 32 }}>🔨 집 짓기</div>
        <div class="pill mat-pill" data-mats={left}><MatIcon size={44} /> 재료 {left}개</div>
      </div>
      <div class="layer">
        <div class="build-tabs">
          {BUILDS.map(x => {
            const k = builtCount(x.id);
            return (
              <button class={`build-tab ${sel === x.id ? 'on' : ''}`} data-build-tab={x.id} onClick={() => pick(x.id)}>
                <span style={{ fontSize: 40 }}>{x.icon}</span>
                <span>{x.name}</span>
                <span class="build-prog">{k >= x.parts.length ? '완성!' : `${k}/${x.parts.length}`}</span>
              </button>
            );
          })}
        </div>
        <div class="build-stage" key={sel} data-enter={done ? 1 : 0} onClick={enter}>
          <BuildArt id={sel} n={n} name={sel === 'doghouse' ? dog.name : sel === 'cathouse' ? cat.name : ''} size={700} pop={pop} />
        </div>
        {petFor.map((v, i) => (
          <div style={{ position: 'absolute', left: i === 0 ? 40 : 1040, top: 470 }}>
            <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={200} mood={done ? (nap ? 'sleep' : 'love') : 'happy'} motion={cheer ? 'cheer' : done && nap ? 'none' : 'bob'} autoTalk={i === 0 && !nap} />
            {done && nap && <div class="zzz"><span>Z</span><span>z</span><span>z</span></div>}
          </div>
        ))}
        {done ? (
          <button class="build-btn enter" data-build-enter={sel} onClick={() => enter()}>
            <span style={{ fontSize: 46 }}>{sel === 'park' ? '🎠' : '🚪'}</span><span>{sel === 'park' ? '놀이터 꾸미기' : '집 안으로'}</span>
          </button>
        ) : (
          <button class={`build-btn ${left <= 0 ? 'off' : ''}`} data-build-go={left > 0 ? 1 : 0} onClick={build}>
            <span style={{ fontSize: 50 }}>🔨</span><span>{b.parts[n].name} 짓기</span>
          </button>
        )}
      </div>
    </div>
  );
}
