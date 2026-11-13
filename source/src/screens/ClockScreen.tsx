// 시계와 시간 (2026-11-13 사용자 요청 — 수학·맞춤법 모드, 초등 2학년 아이): 단계 지도 → 한 판 → '오늘 배운 것' 한 문장
// - 단계: 시계 바늘 알아보기 → 1 정각 읽기 → 2 30·15·45분 읽기 → 3 5분 단위 읽기 → 4 시계 직접 맞추기
//         → 5 60분 이내의 시간 전후 계산 → 6 시간을 넘나드는 전후 계산 → 7 하루·여러 날의 시간 계산 (문제·한 판 규칙은 math/clockData.ts)
// - 한 판 = 본 문제 10개(한 화면에 한 가지 과제). 한 번에 맞힌 것이 9개 이상이면 통과 → 다음 단계가 열리고 단계 스티커를 받음.
//   정답률에 따라 난이도 자동 조절(쉽게·보통·어렵게), 틀린 유형은 두 문제 뒤와 다음 판 처음에 짧게 다시.
// - 문제마다 제한 시간은 없다(바늘을 움직이며 이해하는 학습이라). 하루 공부 시간·하루 문제 수·정답 보상(10개마다 꾸미기, 5개마다 재료·간식)은 수학·맞춤법과 같이 씀.
// - 기록은 State.math 칸에만 (단계 lv.ck · 유형별 상태 sp['ck:유형'] · 하루 기록 '날짜:ck'·'날짜:ck.유형' · 이 학습에 쓴 시간 ms['날짜:ck'])
// - 화면 확인용 주소: ?screen=mathClock&ckstep=4(그 단계 한 판) · &ck=a2(그 유형만) · &ckview=hands|dayintro|mix · &cktier=0~2(난이도)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst } from '../art/Scene';
import { Pet, ItemIcon, SnackIcon } from '../art/Pet';
import { MatIcon } from '../art/Build';
import { sayAll, sfx, stopVoice } from '../engine/audio';
import { syncSoon } from '../engine/sync';
import { ITEM } from '../data/pets';
import { ITEM_EVERY, IDLE_MS, CK_CAT } from '../math/mathData';
import { catMax } from '../lib/studyCfg';
import {
  CK_STEPS, CK_MAX, CK_ROUND, CK_PASS, CK_KIND, CK_MIX_LEARNED, CK_REVIEW_LEARNED,
  roundStart, roundNext, roundAnswer, roundPassed, startTier, stepStat, isCkKind,
  type RoundState, type RoundItem, type RoundMode, type RoundCfg, type CkKind, type TaskTag,
} from '../math/clockData';
import { mathState, todayMath, todayCat, answerClock, addMathMs, mathTimeUp, catFull, clockLv, passClockStep, clockStats, clockDue, mathPet, mathPetInfo, mathWear, mathWho } from '../math/mathStore';
import { leftText } from './MathScreen';
import { gateLocked } from '../lib/gate';
import { ReadView, SetView, ShiftView, DayView, DayIntro, HandsIntro, Spk, speakLine } from './ClockTasks';
import { CLOCK_LOCKED, CLOCK_PASS, CLOCK_FAST, CLOCK_MORE, CLOCK_ALL } from '../data/voice';
import '../math/math.css';
import '../math/clock.css';

type View = 'map' | 'hands' | 'dayintro' | 'task' | 'result';
interface Mark { tag: TaskTag; ok: boolean }
/** 한 판(또는 알아보기)이 끝난 뒤 보여 줄 것 */
interface Result {
  mode: RoundMode | 'hands'; step: number;
  how: 'pass' | 'fast' | 'more' | 'done' | 'stop';   // 통과 · 바로 통과 · 조금 더 · (통과 판정이 없는 판) 끝 · 오늘 시간·문제 수 끝
  opened: number | null;                             // 새로 열린 단계 (CK_MAX이면 일곱 단계 모두 통과)
  main: number; right: number; stars: number; solved: number;
  learned: string;                                   // 오늘 배운 것 한 문장
  stop: null | 'time' | 'cat';                       // 끝났을 때 오늘 더 풀 수 없는 까닭 (공부 시간·문제 수)
}
const stepLabel = (step: number) => (step === 0 ? '첫걸음' : `${step}단계`);
const clampStep = (n: number) => Math.max(0, Math.min(CK_MAX - 1, Math.floor(n) || 0));

export function ClockScreen({ onBack, onCloset }: { onBack: () => void; onCloset: () => void }) {
  const [view, setView] = useState<View>('map');
  const [item, setItem] = useState<RoundItem | null>(null);
  const [n, setN] = useState(0);                              // 문제 번호 (문제 화면을 새로 그리기용)
  const [marks, setMarks] = useState<Mark[]>([]);             // 이번 판에 푼 문제 (스티커 줄)
  const [res, setRes] = useState<Result | null>(null);
  const [gift, setGift] = useState<string | null>(null);      // 방금 받은 꾸미기
  const [pop, setPop] = useState<{ k: number; mat: boolean; snack: string | null } | null>(null);
  const [lastOne, setLastOne] = useState(false);              // 오늘 공부 시간이 끝남 — 지금 문제까지 풀고 끝
  const [note, setNote] = useState('');                       // 단계 지도 아래 안내 (잠긴 단계를 눌렀을 때)
  const [, redraw] = useState(0);
  const round = useRef<RoundState | null>(null);
  const cur = useRef<{ item: RoundItem | null; n: number }>({ item: null, n: 0 });
  cur.current = { item, n };
  const judgedN = useRef(-1);                                 // 채점한 문제 번호 (한 문제에 한 번만)
  const nextN = useRef(-1);                                   // '다음'으로 넘어간 문제 번호 (한 번만)
  const gotItem = useRef<string | null>(null);                // 다음 문제로 넘어갈 때 보여 줄 꾸미기
  const timeUp = useRef(false);
  const introBack = useRef(false);                            // 하루는 24시간 장면을 문제 풀다가 다시 본 것인가
  const forceTier = useRef<number | null>(null);              // 화면 확인용: 처음 난이도
  const noteTimer = useRef(0);
  useEffect(() => () => { clearTimeout(noteTimer.current); syncSoon(500); }, []);
  // 화면이 바뀌면 하던 말은 멈춤
  useEffect(() => () => stopVoice(), [view]);
  useEffect(() => {
    if (!gift) return;
    const t = setTimeout(() => setGift(null), 2800);
    return () => clearTimeout(t);
  }, [gift]);

  // 오늘 공부 시간 재기 (수학·맞춤법과 같은 규칙: 보이고 최근 3분 안에 만졌을 때만 — 수학 칸에만 기록, 이 학습에 쓴 시간은 '날짜:ck'에도)
  const learning = view === 'hands' || view === 'dayintro' || view === 'task';
  useEffect(() => {
    if (!learning) return;
    let last = performance.now(), pend = 0, touch = Date.now();
    const onTouch = () => { touch = Date.now(); };
    document.addEventListener('pointerdown', onTouch, true);
    const flush = () => {
      if (pend <= 0) return;
      const r = addMathMs(pend, CK_CAT);
      pend = 0;
      if (r.timeUp) { timeUp.current = true; setLastOne(true); syncSoon(1000); }
    };
    const t = setInterval(() => {
      const now = performance.now(), dt = Math.min(now - last, 5000);
      last = now;
      if (timeUp.current || document.visibilityState !== 'visible' || Date.now() - touch >= IDLE_MS) return;
      pend += dt;
      const tm = todayMath();
      if (pend >= 5000 || tm.ms + pend >= tm.limitMs) flush();
      redraw(x => x + 1);
    }, 1000);
    return () => { clearInterval(t); document.removeEventListener('pointerdown', onTouch, true); flush(); };
  }, [learning]);

  /** 오늘 더 풀 수 없는 까닭 (없으면 null) */
  const stopNow = (): 'time' | 'cat' | null => (timeUp.current || mathTimeUp() ? 'time' : catFull(CK_CAT) ? 'cat' : null);

  /** 한 판 끝 — 다 풀었거나(통과 판정), 오늘 공부 시간·문제 수가 끝나서 멈춤('stop') */
  const finish = () => {
    const st = round.current!;
    const { mode, step, frontier } = st.cfg;
    const stop = stopNow();
    let how: Result['how'] = st.done || !stop ? 'done' : 'stop';
    let opened: number | null = null;
    if (mode === 'level' && frontier) {
      if (roundPassed(st)) { how = st.done === 'fast' ? 'fast' : 'pass'; if (passClockStep(step)) opened = step + 1; }
      else if (how === 'done') how = 'more';
    }
    const learned = mode === 'mix' ? CK_MIX_LEARNED : mode === 'review' ? CK_REVIEW_LEARNED : CK_STEPS[step].learned;
    setRes({ mode, step, how, opened, main: st.main, right: st.right, stars: st.stars, solved: st.solved, learned, stop });
    setItem(null); setView('result');
    syncSoon(1000);
  };
  /** 다음 문제 (판이 끝났거나 오늘 더 못 풀면 끝 화면으로) */
  const nextTask = () => {
    const st = round.current!;
    if (st.done || stopNow()) { finish(); return; }
    const it = roundNext(st);
    if (!it) { finish(); return; }
    setItem(it); setN(x => x + 1); setView('task');
  };
  /** 한 판 시작 (only: 화면 확인용 — 그 유형만) */
  const begin = (mode: RoundMode, step: number, only?: CkKind[]) => {
    const m = mathState();
    const lv = clockLv(m);
    const stats = clockStats(m);
    // 짧게 복습할 유형: 지금 틀린 유형 + 고친 지 이틀 지난 유형 (아직 안 배운 단계의 것은 빼고, 그 단계 판에서는 그 단계 유형도 뺌 — 본 문제로 나오니까)
    const due = clockDue(m).filter(k => CK_KIND[k].step <= Math.max(step, lv));
    let cfg: RoundCfg;
    if (mode === 'review') cfg = { mode, step, review: only ?? due };
    else if (mode === 'mix') cfg = { mode, step: 0, review: due, tier: 1, weak: stats.weak.map(w => w.kind) };
    else cfg = { mode, step, frontier: lv === step, review: due.filter(k => CK_KIND[k].step !== step), tier: startTier(stats.kinds, step) };
    if (forceTier.current !== null) cfg.tier = forceTier.current;
    round.current = roundStart(cfg);
    setMarks([]); setRes(null);
    judgedN.current = -1; nextN.current = -1;
    nextTask();
  };
  /** 단계 열기: 0 바늘 알아보기 · 7단계를 처음 할 때는 '하루는 24시간' 장면부터 */
  const openStep = (step: number, force = false) => {
    const m = mathState();
    if (!force) {
      if (stopNow()) { sfx.boing(); return; }
      if (step > clockLv(m)) {
        sfx.boing(); speakLine(CLOCK_LOCKED); setNote(CLOCK_LOCKED);
        clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 3000);
        return;
      }
    }
    if (!force) sfx.tap();
    setRes(null); setMarks([]);
    if (step === 0) { setView('hands'); return; }
    if (step === 7 && !['d1', 'd2', 'd3'].some(k => m.sp['ck:' + k])) { introBack.current = false; setView('dayintro'); return; }
    begin('level', step);
  };
  const handsDone = () => {
    const opened = passClockStep(0) ? 1 : null;
    setRes({ mode: 'hands', step: 0, how: opened ? 'pass' : 'done', opened, main: 0, right: 0, stars: 0, solved: 0, learned: CK_STEPS[0].learned, stop: stopNow() });
    setView('result');
    syncSoon(1000);
  };
  const dayIntroDone = () => {
    if (introBack.current) { introBack.current = false; setN(x => x + 1); setView('task'); return; }   // 풀던 문제로 (새로 그림)
    begin('level', 7);
  };

  /** 한 문제 채점 (ok = 힌트를 보기 전에 한 번에 맞혔나) — 문제마다 한 번만 */
  const judge = (ok: boolean) => {
    const st = round.current, c = cur.current;
    if (!st || !c.item || judgedN.current === c.n) return;
    judgedN.current = c.n;
    const r = answerClock(ok, c.item.task.kind);
    roundAnswer(st, c.item, ok);
    const tag = c.item.tag;
    setMarks(ms => [...ms, { tag, ok }]);
    if (r.mat || r.snack) setPop({ k: Date.now(), mat: r.mat, snack: r.snack });
    if (r.item) gotItem.current = r.item;
    syncSoon(4000);
  };
  const next = () => {
    const c = cur.current;
    if (nextN.current === c.n) return;
    nextN.current = c.n;
    stopVoice();
    const it = gotItem.current; gotItem.current = null;
    if (it) { sfx.fanfare(); burst(640, 300, 'confetti'); setGift(it); }
    nextTask();
  };

  // 끝 화면: 축하 + 오늘 배운 것 읽어 주기 (화면이 바뀐 뒤에 — 앞 화면의 말 멈추기보다 나중에)
  useEffect(() => {
    if (view !== 'result' || !res) return;
    const pass = res.how === 'pass' || res.how === 'fast';
    if (pass) { sfx.fanfare(); burst(640, 300, 'confetti'); } else if (res.how !== 'stop') sfx.sparkle();
    const head = res.opened === CK_MAX ? CLOCK_ALL : res.how === 'fast' ? CLOCK_FAST : pass ? CLOCK_PASS : res.how === 'more' ? CLOCK_MORE : '';
    void sayAll([head, res.learned].filter(Boolean));
  }, [res]);

  // 화면 확인용 주소 (?screen=mathClock&…) — 평소 주소에는 없음
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const v = q.get('ckview'), sp = q.get('ckstep'), kd = q.get('ck'), tr = q.get('cktier');
    if (tr !== null && tr !== '') forceTier.current = Math.max(0, Math.min(2, +tr || 0));
    if (v === 'hands') setView('hands');
    else if (v === 'dayintro') setView('dayintro');
    else if (v === 'mix') begin('mix', 0);
    else if (kd && isCkKind(kd)) begin('review', CK_KIND[kd].step, [kd]);
    else if (sp !== null && sp !== '') openStep(clampStep(+sp), true);
  }, []);

  const m = mathState();
  const t = todayMath(m);
  const tc = todayCat(CK_CAT, m);
  const who = mathWho(m);
  const gl = gateLocked('m');   // 공부 먼저(10-28): 오늘 공부 분량을 채우기 전에는 옷장이 잠김 (누르면 안내)
  const pet = mathPet(m);
  const pv = mathPetInfo(pet, m);
  const st = round.current;
  const toMap = () => { sfx.tap(); setItem(null); setView('map'); };
  const closetBtn = (small = false) => (
    <button class={`btn violet ${small ? 'small' : ''} ${gl ? 'gate-locked' : ''}`} data-gate-locked={gl ? '1' : undefined} onClick={() => { if (!gl) sfx.tap(); onCloset(); }}>{gl ? '🔒' : '👗'} {who} 옷장</button>
  );
  const leftPill = (
    <div class="pill ck-left" data-ck-left={Math.ceil(t.leftMs / 1000)}>
      <span class={lastOne || t.leftMs <= 0 ? 'up' : ''}>⏳ {lastOne ? '시간 끝' : leftText(t.leftMs)}</span>
    </div>
  );

  let body;
  if (view === 'map') {
    const lv = clockLv(m);
    const stats = clockStats(m);
    const due = clockDue(m).filter(k => CK_KIND[k].step <= lv);
    const stop = stopNow();
    const head = stop === 'time' ? '오늘 공부 시간이 끝났어요! 내일 또 해요 🎉'
      : stop === 'cat' ? `오늘 시계와 시간 ${catMax()}문제를 다 풀었어요! 🎉`
        : lv >= CK_MAX ? CLOCK_ALL
          : lv === 0 ? '시계 바늘부터 알아봐요! 👆'
            : `지금은 ${lv}단계! ${CK_ROUND}문제 중 ${CK_PASS}문제를 한 번에 맞히면 통과`;
    body = (
      <>
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={() => { sfx.tap(); onBack(); }} aria-label="고르는 화면으로">◀</button>
        <div class="pill ck-title" style={{ fontSize: 30 }}>🕒 시계와 시간</div>
        <div class="pill ck-left" data-ck-today={tc.solved}>
          <span class={t.leftMs <= 0 ? 'up' : ''}>⏳ {leftText(t.leftMs)}</span> · 📝 오늘 {tc.solved}문제 · ⭐ {tc.correct}
        </div>
        <div class="ck-map-head" data-ck-head={stop ?? 'go'}>{head}</div>
        <div class="ck-steps" data-ck-lv={lv}>
          {CK_STEPS.map(sd => {
            const state = sd.step < lv ? 'done' : sd.step === lv ? 'now' : 'locked';
            const r = stepStat(stats.kinds, sd.step);
            const sub = state === 'locked' ? '앞 단계를 통과하면 열려요' : state === 'now' ? `▶ ${sd.goal}` : r.solved ? `최근 ${Math.round(r.rate * 100)}% · 다시 하기` : '다시 보기';
            return (
              <button class={`ck-step ${state} ${stop ? 'off' : ''}`} data-ck-step={sd.step} data-state={state} onClick={() => openStep(sd.step)}>
                <span class="ck-step-no">{stepLabel(sd.step)}</span>
                <span class="ck-step-icon">{sd.icon}</span>
                <span class="ck-step-name">{sd.name}</span>
                <span class="ck-step-goal">{sub}</span>
                {state === 'done' && <span class="ck-sticker" data-ck-sticker={sd.step}>⭐</span>}
                {state === 'locked' && <span class="ck-lock">🔒</span>}
              </button>
            );
          })}
        </div>
        {note && <div class="ck-map-note" data-ck-note="1"><span>🔒 {note}</span></div>}
        <div class="ck-map-foot">
          {due.length > 0 && <button class={`btn mint ${stop ? 'off' : ''}`} data-ck-review={due.length} onClick={() => { if (stop) { sfx.boing(); return; } sfx.tap(); begin('review', lv); }}>🔁 틀린 유형 복습 ({due.length})</button>}
          <button class={`btn sky ${lv < CK_MAX || stop ? 'off' : ''}`} data-ck-mix={lv >= CK_MAX ? '1' : '0'}
            onClick={() => { if (lv < CK_MAX || stop) { sfx.boing(); if (lv < CK_MAX) { setNote('일곱 단계를 모두 통과하면 열려요.'); clearTimeout(noteTimer.current); noteTimer.current = window.setTimeout(() => setNote(''), 3000); } return; } sfx.tap(); begin('mix', 0); }}>
            {lv < CK_MAX ? '🔒' : '🎲'} 골고루 복습
          </button>
          {closetBtn()}
        </div>
        <div style={{ position: 'absolute', left: 10, bottom: 10, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={170} motion="bob" autoTalk={false} />
        </div>
      </>
    );
  } else if (view === 'result' && res) {
    const pass = res.how === 'pass' || res.how === 'fast';
    const all = res.opened === CK_MAX;
    const nextStep = res.opened !== null && res.opened < CK_MAX ? res.opened : null;
    const stopped = res.stop !== null;
    const stopText = res.stop === 'time' ? '⏰ 오늘 공부 시간이 끝났어요. 내일 이어서 해요!' : `오늘 시계와 시간 ${catMax()}문제를 다 풀었어요. 내일 이어서 해요!`;
    const head = res.how === 'stop' ? (res.stop === 'time' ? '⏰ 오늘 공부 시간 끝!' : `오늘 ${catMax()}문제 끝! 🎉`)
      : all ? '🏆 모두 통과!' : res.how === 'fast' ? '🚀 벌써 잘하네요!' : pass ? '🎉 통과!' : res.how === 'more' ? '💪 조금만 더!' : '👏 잘했어요!';
    const sub = res.how === 'stop' ? '내일 이어서 해요.'
      : all ? CLOCK_ALL
        : pass && nextStep !== null ? `${stepLabel(nextStep)}가 열렸어요 · ${CK_STEPS[nextStep].name}`
          : res.how === 'more' ? `${CK_ROUND}문제 중 ${CK_PASS}문제를 한 번에 맞히면 통과예요. 이번에는 ${res.right}문제!`
            : res.mode === 'review' ? '틀렸던 유형을 다시 풀어 봤어요.' : res.mode === 'mix' ? '골고루 복습 한 판 끝!' : res.mode === 'hands' ? '바늘의 이름과 하는 일을 다시 봤어요.' : `${CK_STEPS[res.step].name} 연습 한 판 끝!`;
    const again = () => { if (res.mode === 'hands') openStep(0); else if (res.mode === 'level') openStep(res.step); else { sfx.tap(); begin(res.mode, res.step); } };
    body = (
      <>
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={toMap} aria-label="단계 고르기">◀</button>
        <div class="pill ck-title">🕒 시계와 시간</div>
        {leftPill}
        <div class="ck-result slide-up" data-ck-result={res.how} data-opened={res.opened ?? ''} data-right={res.right} data-main={res.main}>
          <div class="ck-result-row">
            {pass && <span class="ck-sticker big" data-ck-sticker-new={res.step}>{CK_STEPS[res.step].icon}</span>}
            <div>
              <div class="ck-result-head">{head}</div>
              <div class="ck-result-sub">{sub}</div>
            </div>
          </div>
          {marks.length > 0 && (
            <div class="ck-marks" data-ck-marks={marks.length}>
              {marks.map(k => <i class={`${k.ok ? '' : 'help'} ${k.tag === 'main' ? '' : 'extra'}`}>{k.ok ? '⭐' : '🔹'}</i>)}
            </div>
          )}
          {res.solved > 0 && (
            <div class="ck-score">
              {res.mode === 'review' ? <>한 번에 맞힌 문제 <b>{res.stars}</b> / {res.solved}</> : <>한 번에 맞힌 문제 <b>{res.right}</b> / {res.main}{res.solved > res.main ? ` · 복습·도전까지 ⭐ ${res.stars}개` : ''}</>}
            </div>
          )}
          <div class="ck-learned" data-ck-learned={res.learned}>
            <span class="ck-learned-cap">📒 오늘 배운 것</span>
            <span class="ck-learned-t">{res.learned}</span>
            <Spk small line text={res.learned} />
          </div>
          {stopped && res.how !== 'stop' && <div class="ck-result-sub" data-ck-stopped={res.stop ?? ''}>{stopText}</div>}
          <div class="ck-result-btns">
            {stopped ? <><button class="btn" data-ck-home="1" onClick={() => { sfx.tap(); onBack(); }}>처음 화면으로</button>{closetBtn()}</>
              : (
                <>
                  {nextStep !== null && <button class="btn mint pulse" data-ck-go-next={nextStep} onClick={() => openStep(nextStep)}>{stepLabel(nextStep)} 시작 ▶</button>}
                  {all && <button class="btn sky pulse" data-ck-go-mix="1" onClick={() => { sfx.tap(); begin('mix', 0); }}>🎲 골고루 복습 ▶</button>}
                  {!pass && <button class={`btn mint ${res.how === 'more' ? 'pulse' : ''}`} data-ck-again="1" onClick={again}>한 판 더 ▶</button>}
                  <button class="btn violet" data-ck-to-map="1" onClick={toMap}>단계 고르기</button>
                </>
              )}
          </div>
        </div>
        <div style={{ position: 'absolute', left: 14, bottom: 26, pointerEvents: 'none' }}>
          <Pet pet={pet} stage={pv.stage} level={pv.level} wear={mathWear(pet, m)} size={180} autoTalk={false} motion={pass ? 'cheer' : 'bob'} mood={pass ? 'love' : 'happy'} />
        </div>
      </>
    );
  } else {
    const mode = st?.cfg.mode;
    const title = view === 'hands' ? CK_STEPS[0].name : view === 'dayintro' ? '하루는 24시간' : mode === 'mix' ? '골고루 복습' : mode === 'review' ? '틀린 유형 복습' : st ? `${st.cfg.step}단계 · ${CK_STEPS[st.cfg.step].short}` : '';
    const mains = marks.filter(k => k.tag === 'main');
    const extra = marks.length - mains.length;
    // 지금 풀고 있는 칸: 이미 채점했으면(틀려서 힌트를 보고 다시 푸는 중) 마지막 스티커 칸
    const nowIdx = item?.tag === 'main' ? (judgedN.current === n ? mains.length - 1 : mains.length) : -1;
    const task = item?.task;
    body = (
      <>
        <button class="iconbtn" style={{ position: 'absolute', left: 20, top: 18 }} onClick={toMap} aria-label="단계 고르기">◀</button>
        <div class="pill ck-title" data-ck-title={title}>🕒 {title}</div>
        {view === 'task' && st && (
          <div class="ck-prog" data-ck-prog={mains.length} data-ck-tier={st.tier}>
            {mode === 'review'
              ? marks.map(k => <i class={k.ok ? 'star' : 'help'}>{k.ok ? '⭐' : '🔹'}</i>)
              : Array.from({ length: CK_ROUND }, (_x, i) => {
                const k = mains[i];
                return <i class={`${k ? (k.ok ? 'star' : 'help') : ''} ${i === nowIdx ? 'now' : ''}`}>{k ? (k.ok ? '⭐' : '🔹') : ''}</i>;
              })}
            {mode === 'review' ? <span class="ck-prog-x">남은 문제 {st.pending.length + (judgedN.current === n ? 0 : 1)}</span> : extra > 0 && <span class="ck-prog-x">+{extra}</span>}
          </div>
        )}
        {leftPill}
        {lastOne && view === 'task' && <div class="ck-lastone" data-ck-lastone="1">⏰ 오늘 공부 시간 끝! 이 문제까지 풀어요</div>}
        {pop && <div key={pop.k} class="m-pop" data-mat-pop={pop.mat ? 1 : 0} data-snack-pop={pop.snack ?? ''}>{pop.mat && <><MatIcon size={30} /> +1</>}{pop.snack && <><SnackIcon id={pop.snack} size={36} /> +1</>}</div>}
        <div class="ck-card" data-ck-view={view} data-ck-n={n}>
          {view === 'hands' && <HandsIntro onDone={handsDone} />}
          {view === 'dayintro' && <DayIntro onDone={dayIntroDone} />}
          {view === 'task' && task && item && (
            task.type === 'read' ? <ReadView key={n} task={task} tag={item.tag} onJudge={judge} onNext={next} />
              : task.type === 'set' ? <SetView key={n} task={task} tag={item.tag} onJudge={judge} onNext={next} />
                : task.type === 'shift' ? <ShiftView key={n} task={task} tag={item.tag} onJudge={judge} onNext={next} />
                  : <DayView key={n} task={task} tag={item.tag} onJudge={judge} onNext={next} onIntro={() => { introBack.current = true; setView('dayintro'); }} />
          )}
        </div>
      </>
    );
  }

  return (
    <div class="screen" data-clock-screen={view}>
      <Backdrop theme="sky" />
      <div class="layer">{body}</div>
      {gift && (
        <div class="overlay fade-in" style={{ background: 'rgba(60,30,90,.35)' }} onClick={() => setGift(null)} data-gift="item">
          <div class="layer">
            <div class="gift-card slide-up">
              <div class="gift-ribbon">새 꾸미기!</div>
              <div class="gift-icon glyph-bounce"><ItemIcon id={gift} size={210} /></div>
              <div class="gift-name">{ITEM[gift]?.name}</div>
              <div class="pill" style={{ fontSize: 24 }}>👗 {who} 옷장에 넣었어요 · 정답 {ITEM_EVERY}개마다 하나</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
