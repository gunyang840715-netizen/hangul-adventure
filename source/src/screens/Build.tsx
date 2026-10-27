// 집 짓기: 놀이로 모은 재료(수학 모드는 정답으로 모은 재료)를 하나씩 써서 강아지 집 · 고양이 집 · 놀이터를 한 부분씩 짓기
// 10-27 사용자 요청: 레벨이 올라야 단계별로 지을 수 있음(data/unlock.ts BUILD_LV) — 강아지 집은 고른 강아지, 고양이 집은 고른 고양이,
// 놀이터는 둘 중 높은 레벨. 이미 지은 부분·다 지은 집(집 안·마당 꾸미기)은 그대로
import { useEffect, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { YardBack, YardDeco, houseFilter } from './Home';
import { Pet } from '../art/Pet';
import { BuildArt, MatIcon } from '../art/Build';
import { say, sayAll, sfx, newScene } from '../engine/audio';
import { buddy } from '../engine/bus';
import { onChange } from '../engine/store';
import { useHome } from './homeApi';
import { BUILDS, BUILD, partLine, doneBuildLine } from '../data/pets';
import { HOME_IN, HOME_LOCKED, HOME_DECO, buildLockLine, LEVEL_MORE } from '../data/voice';
import { buildLock } from '../data/unlock';

function useRefresh() {
  const [, force] = useState(0);
  useEffect(() => onChange(() => force(x => x + 1)), []);
}

export function BuildScreen({ onBack, onEnter, onYard }: { onBack: () => void; onEnter?: (place: 'doghouse' | 'cathouse' | 'park') => void; onYard?: (house: 'doghouse' | 'cathouse') => void }) {
  useRefresh();
  const H = useHome();   // 한글(동생) 또는 수학 집 기록 (App.tsx가 고름)
  // 레벨로 잠긴 부분 (0이면 지을 수 있음) — 지금 강아지·고양이 레벨로
  const lockOf = (id: string) => buildLock(id, H.builtCount(id), H.petView('dog').level, H.petView('cat').level);
  // 처음 보여 줄 것: 다 안 지은 것 중 지금 레벨로 지을 수 있는 것 → 없으면 다 안 지은 것 → 강아지 집
  const [sel, setSel] = useState<string>(() => BUILDS.find(b => H.builtCount(b.id) < b.parts.length && !lockOf(b.id))?.id ?? H.nextBuild()?.id ?? 'doghouse');
  const [pop, setPop] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [cheer, setCheer] = useState(false);
  const b = BUILD[sel];
  const n = H.builtCount(sel);
  const left = H.matsLeft();
  const done = n >= b.parts.length;
  const dog = H.petView('dog'), cat = H.petView('cat');
  const need = done ? 0 : lockOf(sel);   // 다음 부분에 필요한 레벨 (지을 수 있으면 0)
  const lockLines = (id: string) => {
    const k = H.builtCount(id), lv = lockOf(id), bd = BUILD[id];
    return [buildLockLine(id, id === 'cathouse' ? cat.name : dog.name, bd.parts[k].name, lv), LEVEL_MORE];
  };

  useEffect(() => { newScene(); if (need) sayAll(lockLines(sel)); else say(left > 0 ? '망치를 눌러서 지어 보자!' : H.noMat); }, []);

  const pick = (id: string) => {
    if (id === sel) return;
    sfx.tap(); setSel(id); setPop(-1); setCheer(false);
    if (lockOf(id)) sayAll([BUILD[id].name, ...lockLines(id)]); else say(BUILD[id].name);
  };

  const build = async () => {
    if (busy) return;
    if (done) { sfx.pop(); setCheer(true); setTimeout(() => setCheer(false), 1200); return; }
    if (lockOf(sel)) { sfx.boing(); sayAll(lockLines(sel)); return; }   // 레벨이 모자람 (재료보다 먼저 알려 줌)
    if (H.matsLeft() <= 0) { sfx.boing(); say(H.noMat); return; }
    const k = H.buildPart(sel);
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
  const house = sel === 'doghouse' || sel === 'cathouse' ? sel : null;
  // 집 밖 마당 꾸미기(원문 E): 다 지은 집에서 들어감, 꾸민 마당은 이 화면에도 보인다
  const yard = () => {
    if (!house) return;
    if (!done) { sfx.boing(); say(HOME_LOCKED); return; }
    sfx.pop(); say(HOME_DECO); onYard?.(house);
  };
  return (
    <div class="screen" data-build-screen={sel}>
      {house ? <YardBack house={house} /> : <Backdrop theme="meadow" />}
      <div class="topbar">
        <button class="iconbtn" onClick={() => { sfx.tap(); onBack(); }}>🏠</button>
        <div class="pill" style={{ fontSize: 32 }}>🔨 집 짓기</div>
        <div class="pill mat-pill" data-mats={left}><MatIcon size={44} /> 재료 {left}개</div>
      </div>
      <div class="layer">
        <div class="build-tabs">
          {BUILDS.map(x => {
            const k = H.builtCount(x.id);
            const lk = lockOf(x.id);
            return (
              <button class={`build-tab ${sel === x.id ? 'on' : ''}`} data-build-tab={x.id} data-locked={lk || undefined} onClick={() => pick(x.id)}>
                <span style={{ fontSize: 40 }}>{x.icon}</span>
                <span>{x.name}</span>
                <span class="build-prog">{k >= x.parts.length ? '완성!' : `${k}/${x.parts.length}`}{lk ? ` 🔒Lv.${lk}` : ''}</span>
              </button>
            );
          })}
        </div>
        {house && done && <YardDeco house={house} front={false} />}
        <div class="build-stage" key={sel} data-enter={done ? 1 : 0} onClick={enter}>
          <BuildArt id={sel} n={n} next={!need} name={sel === 'doghouse' ? dog.name : sel === 'cathouse' ? cat.name : ''} size={700} pop={pop} tint={house && done ? houseFilter(house, H) : undefined} />
        </div>
        {house && done && <YardDeco house={house} front />}
        {petFor.map((v, i) => (
          <div style={{ position: 'absolute', left: i === 0 ? 40 : 1040, top: 470 }}>
            <Pet pet={v.id} stage={v.stage} level={v.level} wear={v.wear} size={200} mood={done ? (nap ? 'sleep' : 'love') : 'happy'} motion={cheer ? 'cheer' : done && nap ? 'none' : 'bob'} act={done && nap ? 'sleep' : undefined} autoTalk={i === 0 && !nap} />
            {done && nap && <div class="zzz"><span>Z</span><span>z</span><span>z</span></div>}
            {!done && <div class="lv-chip pet-lv" data-pet-lv={v.level}>Lv.{v.level}</div>}
          </div>
        ))}
        {done ? (<>
          <button class="build-btn enter" data-build-enter={sel} onClick={() => enter()}>
            <span style={{ fontSize: 46 }}>{sel === 'park' ? '🎠' : '🚪'}</span><span>{sel === 'park' ? '놀이터 꾸미기' : '집 안으로'}</span>
          </button>
          {house && <button class="build-btn yard" data-build-yard={sel} onClick={yard}>
            <span style={{ fontSize: 44 }}>🌳</span><span>마당 꾸미기</span>
          </button>}
        </>) : (
          need ? (
            <button class="build-btn off locked" data-build-go={0} data-build-lock={need} onClick={build}>
              <span style={{ fontSize: 46 }}>🔒</span><span>Lv.{need} {b.parts[n].name}</span>
            </button>
          ) : (
            <button class={`build-btn ${left <= 0 ? 'off' : ''}`} data-build-go={left > 0 ? 1 : 0} onClick={build}>
              <span style={{ fontSize: 50 }}>🔨</span><span>{b.parts[n].name} 짓기</span>
            </button>
          )
        )}
      </div>
    </div>
  );
}
