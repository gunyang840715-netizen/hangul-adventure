import { useEffect, useState } from 'preact/hooks';
import { BurstLayer } from './art/Scene';
import { TakeToast } from './games/TakeToast';
import { MapScreen } from './screens/MapScreen';
import { Session } from './screens/Session';
import { Title, Book, Parent, Sleep } from './screens/Extras';
import { House, Dress, Adopt } from './screens/House';
import { BuildScreen } from './screens/Build';
import { RoomScreen, ParkScreen } from './screens/Home';
import { BuildArt } from './art/Build';
import { buildLesson, buildPlay, refreshSteps, dictationStep, LETTER_SETS, type Step } from './engine/session';
import { load, remainingMs, startClock, onChange, addLessonToday, addAdventure, addStars, todayDoneLessons, getResume, setResume, setClockActive, today, curLesson, passLesson, reviewDue, passReview, failReview } from './engine/store';
import { unlock, music, newScene } from './engine/audio';
import { syncSoon } from './engine/sync';
import { LESSONS } from './data/curriculum';
import { Pet, ItemIcon, SnackIcon } from './art/Pet';
import { PETS, ITEM_LIST, SNACKS } from './data/pets';

function Gallery() {
  const g = new URLSearchParams(location.search).get('gallery');
  const box = { background: '#e8f3ff', display: 'flex', flexWrap: 'wrap', gap: 6, padding: 12, alignContent: 'flex-start', width: 1280, height: 800, position: 'fixed', left: 0, top: 0 } as any;
  const lab = (t: string) => <div style={{ fontSize: 16, textAlign: 'center', fontFamily: 'sans-serif' }}>{t}</div>;
  if (g === '2') return (
    <div style={box}>{PETS.map(p => (['baby', 'kid', 'adult'] as const).map(st => <div><Pet pet={p.id} stage={st} size={118} motion="none" autoTalk={false} />{lab(`${p.breed} ${st}`)}</div>))}</div>
  );
  if (g === '3') {
    const outfits: any[] = [
      { hat: 'crown', neck: 'bell', clothes: 'stripe', shoes: 'sneaker', toy: 'ball' },
      { hat: 'bow', glasses: 'heart', clothes: 'dots', neck: 'pearl', shoes: 'ballet' },
      { hat: 'cap', glasses: 'sun', clothes: 'overall', shoes: 'boots', toy: 'frisbee' },
      { hat: 'beanie', clothes: 'sweater', neck: 'scarf', shoes: 'fur', toy: 'teddy' },
      { hat: 'straw', glasses: 'round', clothes: 'raincoat', shoes: 'boots', toy: 'duck' },
      { hat: 'bunny', clothes: 'tutu', neck: 'heart', shoes: 'ballet', toy: 'yarn' },
      { hat: 'wizard', glasses: 'star', clothes: 'cape', neck: 'bowtie', toy: 'feather' },
      { hat: 'flower', clothes: 'hanbok', neck: 'lei', shoes: 'socks', toy: 'mouse' },
      { hat: 'party', glasses: 'rainbow', clothes: 'stripe', neck: 'bell', toy: 'bone' },
      { hat: 'chef', clothes: 'sweater', neck: 'bowtie', shoes: 'sneaker', toy: 'ball' },
    ];
    return <div style={box}>{PETS.map((p, i) => <div><Pet pet={p.id} wear={outfits[i]} size={230} motion="none" autoTalk={false} mood={(['happy', 'wow', 'love', 'think', 'happy'] as const)[i % 5]} />{lab(p.breed)}</div>)}</div>;
  }
  if (g === '5') return (
    <div style={box}>{['maltese', 'koshort', 'shiba', 'fold'].map(id => <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv => <div><Pet pet={id} level={lv} size={118} motion="none" autoTalk={false} />{lab(`Lv${lv}`)}</div>)}</div>)}</div>
  );
  if (g === '6') return (
    <div style={box}>{(['doghouse', 'cathouse', 'park'] as const).map(id => <div style={{ display: 'flex', gap: 6 }}><div style={{ background: '#dff3ff' }}><BuildArt id={id} n={3} name="뭉치" size={300} /></div><div style={{ background: '#dff3ff' }}><BuildArt id={id} n={8} name="뭉치" size={300} /></div></div>)}</div>
  );
  if (g === '4') return (
    <div style={box}>
      {ITEM_LIST.map(it => <div style={{ width: 118, height: 130, background: '#fff', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><ItemIcon id={it.id} size={84} />{lab(it.name)}</div>)}
      {SNACKS.map(sn => <div style={{ width: 118, height: 130, background: '#fff8e6', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><SnackIcon id={sn.id} size={80} />{lab(sn.name)}</div>)}
    </div>
  );
  return (
    <div style={box}>
      {PETS.map(p => <div><Pet pet={p.id} size={240} motion="none" autoTalk={false} />{lab(`${p.breed} · ${p.name}`)}</div>)}
    </div>
  );
}

/** 앱 아이콘 그리기용 (?icon=512, 가장자리 여백을 두려면 &mask=1) */
function Icon() {
  const q = new URLSearchParams(location.search);
  const S = +(q.get('icon') || 512);
  const k = q.get('mask') === '1' ? 0.78 : 1;   // 마스크 아이콘은 가운데 80% 안에
  const u = S / 512 * k;
  return (
    <div id="icon" style={{ width: S, height: S, position: 'fixed', left: 0, top: 0, overflow: 'hidden', background: 'radial-gradient(circle at 50% 38%, #fff7fb 0%, #ffd6e8 55%, #ffb3d1 100%)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 512 * u, height: 512 * u, transform: 'translate(-50%,-50%)' }}>
        <div style={{ position: 'absolute', left: 250 * u, top: 18 * u, width: 150 * u, height: 150 * u, borderRadius: '50%', background: '#fff', boxShadow: `0 ${6 * u}px 0 #ff8fb8`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Jua', fontSize: 104 * u, color: '#ff5c93', lineHeight: 1 }}>가</div>
        <div style={{ position: 'absolute', left: 205 * u, top: 150 * u }}><Pet pet="koshort" size={300 * u} motion="none" autoTalk={false} /></div>
        <div style={{ position: 'absolute', left: -10 * u, top: 120 * u }}><Pet pet="maltese" size={345 * u} motion="none" autoTalk={false} /></div>
      </div>
    </div>
  );
}

type Screen = 'title' | 'map' | 'session' | 'book' | 'house' | 'dress' | 'adopt' | 'build' | 'room' | 'park' | 'parent' | 'sleep';
const GALLERY = /[?&]gallery=/.test(location.search);
const ICON = /[?&]icon=/.test(location.search);
/** 사용 시간을 세는 화면 */
const COUNTED: Screen[] = ['map', 'session', 'book', 'house', 'dress', 'adopt'];
/** 시간이 다 되면 바로 잠자기로 가는 화면 */
const IDLE: Screen[] = ['map', 'book', 'house', 'dress', 'adopt', 'build', 'room', 'park'];

interface Sess { steps: Step[]; idx: number; replay: boolean; play?: boolean; startAt?: number; resumed?: boolean; review?: boolean; after?: () => void }

export function App() {
  if (GALLERY) return <Gallery />;
  if (ICON) return <Icon />;
  const [screen, setScreen] = useState<Screen>('title');
  const [back, setBack] = useState<Screen>('map');
  const [sess, setSess] = useState<Sess | null>(null);
  const [room, setRoom] = useState<'doghouse' | 'cathouse'>('doghouse');
  const [demo, setDemo] = useState(() => /[?&]demo=1/.test(location.search));
  const [ver, tick] = useState(0);
  const s = load();

  const timeOver = () => !demo && remainingMs(load()) <= 0;
  const todayDone = !demo && todayDoneLessons(s);

  /** 이어서 할 모험이 있나 (다른 기기에서 이미 끝낸 단계면 버림) */
  const validResume = () => {
    const r = getResume();
    if (!r || !Array.isArray(r.steps) || !r.steps.length || r.stepIdx >= r.steps.length) return null;
    if (!r.replay && r.lessonIdx !== curLesson()) return null;
    return r;
  };

  // 시험용: ?screen=room&place=cathouse / ?screen=park / ?screen=build → 그 화면 바로 열기
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const sc = q.get('screen');
    if (!sc) return;
    if (sc === 'room') setRoom(q.get('place') === 'cathouse' ? 'cathouse' : 'doghouse');
    if (['room', 'park', 'build', 'house'].includes(sc)) setScreen(sc as Screen);
  }, []);

  // 시험용: ?play=feed&lesson=6 → 그 놀이를 바로 열기
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const k = q.get('play');
    if (!k) return;
    const li = +(q.get('lesson') || 6);
    const part = q.get('part');
    const steps: Step[] = k === 'dictation' ? [dictationStep([...(q.get('items') || 'ㄱㄴ')], q.get('mode') === 'review' ? 'review' : 'lesson')] : k === 'traceSet'
      ? [part != null ? { t: 'traceSet', items: [q.get('ch') || 'ㅓ'], reps: 10, level: +part + 1, guides: LETTER_SETS[+part], part: +part, parts: LETTER_SETS.length } : { t: 'traceSet', items: ['ㄱ', 'ㄴ'], reps: +(q.get('reps') || 10), level: +(q.get('level') || 1) }]
      : k === 'lesson' ? buildLesson(li) : buildPlay(li, k);
    setSess({ steps, idx: li, replay: true, play: true });
    setScreen('session');
  }, []);

  // 화면마다 사용 시간을 셀지
  useEffect(() => { setClockActive(COUNTED.includes(screen)); }, [screen]);
  // 새 버전이 설치돼 있으면 지도·첫 화면에서 새로 불러오기 (하던 모험은 이어하기로 저장돼 있음)
  useEffect(() => { if ((window as any).__UPDATE__ && (screen === 'map' || screen === 'title')) location.reload(); }, [screen]);

  useEffect(() => {
    let day = today();
    startClock(() => {
      // 노는 화면에서 시간이 다 되면 잠자기 (모험 중에는 이번 놀이까지 하고)
      if (timeOver()) setScreen(sc => IDLE.includes(sc) ? 'sleep' : sc);
      // 날짜가 바뀌면 지도 새로 그리기 (새 단계 열림)
      if (today() !== day) { day = today(); tick(x => x + 1); }
    });
    // 다른 기기에서 진도가 들어오면 다시 그리기
    const off = onChange(() => tick(x => x + 1));
    return () => { off(); };
  }, [demo]);

  const go = (sc: Screen) => { newScene(); setScreen(sc); };

  /** 다음날 공부를 시작하기 전 복습 시험을 볼 차례인가 */
  const needReview = (idx: number, replay: boolean) => !demo && !replay && idx === curLesson() && reviewDue();
  /** 복습 시험(어제 통과한 단계의 글자 받아쓰기) → 통과하면 after, 떨어지면 그 단계를 다시 공부 */
  const runReview = (after: () => void) => {
    const lp = load().lastPass!;
    setSess({ steps: [dictationStep(lp.items, 'review')], idx: curLesson(), replay: true, play: true, review: true, after });
    go('session');
  };

  const resumeSession = (): boolean => {
    const r = validResume();
    if (!r) return false;
    if (needReview(r.lessonIdx, r.replay)) { runReview(() => { if (!resumeSession()) go('map'); }); return true; }
    // 예전 판에서 저장된 남은 놀이에 안 배운 글자가 있으면 그 자리만 배운 글자로 다시 만든다
    let steps = r.steps as Step[];
    try { steps = refreshSteps(steps, r.lessonIdx, r.stepIdx); } catch { /* 그대로 */ }
    // 시험이 없던 예전 판에서 저장된 모험이면, 끝나기 전에 받아쓰기 시험을 넣는다 (시험 없이 다음 단계로 못 가게)
    if (!r.replay && !steps.some(x => x.t === 'dictation')) {
      try {
        const test = buildLesson(r.lessonIdx).find(x => x.t === 'dictation');
        if (test) {
          let at = steps.findIndex((x, k) => k >= r.stepIdx && (x.t === 'rescue' || x.t === 'reward'));
          if (at < 0) at = steps.length;
          steps = [...steps.slice(0, at), test, ...steps.slice(at)];
        }
      } catch { /* 그대로 */ }
    }
    setSess({ steps, idx: r.lessonIdx, replay: r.replay, startAt: Math.min(r.stepIdx, steps.length - 1), resumed: true });
    go('session');
    return true;
  };

  const start = () => {
    unlock();
    wantFull = true;
    goFull();
    if (load().settings.music) music(true);
    if (timeOver()) { go('sleep'); return; }
    if (!resumeSession()) go('map');
  };

  const startLesson = (idx: number, replay: boolean) => {
    if (timeOver()) { go('sleep'); return; }
    if (needReview(idx, replay)) { runReview(() => startLesson(idx, replay)); return; }
    const r = validResume();
    if (r && r.lessonIdx === idx && r.replay === replay) { resumeSession(); return; }
    setSess({ steps: buildLesson(idx), idx, replay });
    go('session');
  };

  const startPlay = () => {
    if (timeOver()) { go('sleep'); return; }
    const steps = [...buildPlay(load().lessonIdx), ...buildPlay(load().lessonIdx)].filter(st => st.t !== 'dictation');
    if (!steps.length) return;
    setSess({ steps, idx: load().lessonIdx, replay: true, play: true });
    go('session');
  };

  const finish = () => {
    // 복습 시험 통과 → 하려던 공부로
    if (sess?.review) { passReview(); syncSoon(300); const after = sess.after; setSess(null); if (after) after(); else go('map'); return; }
    const st = load();
    if (sess && !sess.play) setResume(null);
    if (sess && !sess.replay && sess.idx === curLesson(st)) {
      // 받아쓰기 시험까지 통과해야 여기로 옴 → 다음 단계 (다시 공부하던 단계면 묶음 풀기) + 내일 복습할 글자 기록
      const test = sess.steps.find(x => x.t === 'dictation') as Extract<Step, { t: 'dictation' }> | undefined;
      passLesson(sess.idx, test ? test.items : []);
      addLessonToday();
    }
    if (sess && !sess.play) addAdventure();
    if (sess?.play) addStars(1);
    syncSoon(500);
    setSess(null);
    go(timeOver() ? 'sleep' : 'map');
  };

  /** 받아쓰기 시험에 떨어짐: 그날 시험이면 다음 단계로 못 감(처음부터 다시 공부), 복습 시험이면 전 단계를 다시 공부 */
  const failTest = () => {
    if (sess?.review) failReview();
    else setResume(null);
    syncSoon(300);
    setSess(null);
    go(timeOver() ? 'sleep' : 'map');
  };

  // 시간이 다 돼서 쉬기 (이어하기 위치는 Session이 저장해 둠)
  const pause = () => { syncSoon(300); setSess(null); go('sleep'); };
  // 시간이 풀리면 자동으로 이어서
  const wake = () => { if (!resumeSession()) go('map'); };

  const openParent = () => { setBack(screen === 'parent' ? 'map' : screen); go('parent'); };

  let view;
  switch (screen) {
    case 'title': view = <Title onStart={start} />; break;
    case 'map': view = <MapScreen key={`${s.lessonIdx}:${todayDone}:${demo}:${ver > 0 ? s.epoch : 0}`} onStart={startLesson} onPlay={startPlay} onBook={() => go('book')} onHouse={() => go('house')} onParent={openParent} todayDone={todayDone} demo={demo} resumeIdx={validResume()?.lessonIdx ?? -1} />; break;
    case 'session': view = sess && <Session key={sess.steps.length + ':' + (sess.startAt ?? 0) + ':' + sess.idx} steps={sess.steps} lessonIdx={sess.idx} name={s.name} startAt={sess.startAt} resumed={sess.resumed} replay={sess.replay} play={sess.play} onFinish={finish} onPause={pause} onQuit={() => { setSess(null); syncSoon(500); go('map'); }} demo={demo} onFail={sess.review || !sess.replay ? failTest : undefined} />; break;
    case 'book': view = <Book onBack={() => go('map')} />; break;
    case 'house': view = <House onBack={() => { syncSoon(500); go('map'); }} onDress={() => go('dress')} onAdopt={() => go('adopt')} onBuild={() => go('build')} />; break;
    case 'build': view = <BuildScreen onBack={() => { syncSoon(500); go('house'); }} onEnter={(pl) => { if (pl === 'park') go('park'); else { setRoom(pl); go('room'); } }} />; break;
    case 'room': view = <RoomScreen key={room} place={room} onBack={() => { syncSoon(500); go('build'); }} />; break;
    case 'park': view = <ParkScreen onBack={() => { syncSoon(500); go('build'); }} />; break;
    case 'dress': view = <Dress onBack={() => { syncSoon(500); go('house'); }} />; break;
    case 'adopt': view = <Adopt onBack={() => { syncSoon(500); go('house'); }} />; break;
    case 'sleep': view = <Sleep onParent={openParent} onWake={wake} demo={demo} />; break;
    case 'parent': view = <Parent demo={demo} onDemo={(on) => { setDemo(on); tick(x => x + 1); }} onClose={() => { music(load().settings.music); syncSoon(300); if (back === 'sleep' && !timeOver()) wake(); else go(back === 'parent' ? 'map' : back); }} />; break;
  }

  useEffect(() => { (window as any).__FIT__?.(); });

  return (
    <>
      <div id="stage">
        {view}
        <BurstLayer />
        <TakeToast />
      </div>
      <div class="rotate-hint"><div class="phone" /><div>화면을 가로로 돌려 주세요</div></div>
    </>
  );
}

// ---------- 전체 화면 ----------
let wantFull = false;
function goFull() {
  const el: any = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  // 홈 화면 앱으로 실행 중이면 이미 전체 화면
  if (matchMedia('(display-mode: fullscreen)').matches) return;
  try {
    const p = el.requestFullscreen({ navigationUI: 'hide' });
    p?.then?.(() => { try { (window.screen as any).orientation?.lock?.('landscape').catch(() => { }); } catch { /* 무시 */ } }).catch?.(() => { });
  } catch { /* 무시: 앱 속 미리보기 등에서는 안 될 수 있음 */ }
}
// 전체 화면이 풀렸으면(뒤로 가기 제스처 등) 다음 터치 때 다시
document.addEventListener('pointerup', () => { if (wantFull && !document.fullscreenElement) goFull(); }, true);
