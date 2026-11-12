// 모험 지도
import { useEffect, useRef, useState } from 'preact/hooks';
import { Buddy } from '../games/Buddies';
import { stageInfo } from '../art/Scene';
import { LESSONS, UNITS } from '../data/curriculum';
import { say, sfx } from '../engine/audio';
import { load, starsTotal, adventuresTotal, snackTotal, petView, curLesson } from '../engine/store';
import { helloLine, REVIEW_FAIL, TEST_LOCKED, GATE_HINT, GATE_SNACK_WAIT } from '../data/voice';
import { sayAll } from '../engine/audio';
import { josa } from '../lib/hangul';
import { artSrc } from '../art/artmap';
import { useArtReady } from '../art/paintbg';
import { gateLocked, peekGateOpened, takeGateOpened } from '../lib/gate';
import { GatePill, GateBanner, celebrateGate } from './GateUI';
import { SYL_GATE, SYL_UNIT, SYL_ROW_COUNT, SYL_NAME, sylIdx } from '../data/syllables';
import { sylActive, sylNext, sylRowDone, sylRedo, curTask } from '../lib/sylStage';

interface Props {
  onStart: (idx: number, replay: boolean) => void;
  onPlay: () => void;
  onBook: () => void;
  onHouse: () => void;
  onParent: () => void;
  todayDone: boolean;
  demo?: boolean;
  resumeIdx?: number;      // 이어서 할 단계 (-1: 없음)
}

const DECO: Record<number, string[]> = {
  1: ['🌼', '🌷', '🍄', '🌸'], 2: ['🌳', '🌲', '🍄', '🐿️'], 3: ['🍃', '🌾', '🪁'], 4: ['🌈', '🎈', '🌻'], 5: ['🏰', '🚩', '👑'],
  6: ['🏯', '🎏', '🌸'], 7: ['💎', '🔮', '🦇'], 8: ['🦄', '🌈', '🍭'], 9: ['📖', '⭐', '🎀'],
};

// 지도 위 자리 = 진도표 단계들 + 글자 합치기 한 자리(11-12 사용자 요청 — 첫 낱말 단계 바로 앞, 같은 단원 '낱말 다리').
// 단계 번호(진도)는 그대로이고, 그리는 자리만 한 칸씩 밀린다.
const SLOT_SYL = SYL_GATE;
const SLOTS = LESSONS.length + 1;
const slotOf = (i: number) => (i < SYL_GATE ? i : i + 1);
/** 자리 → 단원 */
const SLOT_UNIT: number[] = [];
LESSONS.forEach((l, i) => { SLOT_UNIT[slotOf(i)] = l.unit; });
SLOT_UNIT[SLOT_SYL] = SYL_UNIT;
/** 길이 오르내리는 모양은 예전 그대로(단계 번호로), 글자 합치기 자리는 앞뒤 단계의 사이 */
const waveOf = (k: number) => (k === SLOT_SYL ? SYL_GATE - 0.5 : k < SLOT_SYL ? k : k - 1);

function slotPos(k: number): [number, number] {
  const unitGap = (SLOT_UNIT[k] - 1) * 90;
  return [300 + k * 165 + unitGap, 440 + Math.sin(waveOf(k) * 0.85) * 120];
}
export function nodePos(i: number): [number, number] { return slotPos(slotOf(i)); }

// ---------- 손그림 모험 지도 (묶음 4: map-1~3, 가로로 긴 그림 3장을 이어 붙임) ----------
// 지도 한 장 = 단원 3개(1: 글자 마을·글자 숲·바람 언덕 / 2: 낱말 다리·받침 성 ①·② / 3: 쌍둥이 동굴·무지개 섬·이야기 나라).
// 단원 하나가 그림 한 장의 1/3을 차지하게 단계를 놓아, 그림 속 마을·숲·다리·성·동굴·섬·책 나라 위에 그 단원이 온다.
// 단계는 그림 가운데의 길(모래 띠) 위에. 이웃 그림은 3% 겹쳐 부드럽게 섞는다.
const MAPS = [1, 2, 3].map(n => artSrc(`map.${n}`));
const MAP_ART = MAPS.every(Boolean);
const MAP_AR = 3840 / 1200;
const MAP_OV = 0.03;
const UNIT_SLOTS: Record<number, number[]> = {};
SLOT_UNIT.forEach((u, k) => { (UNIT_SLOTS[u] ??= []).push(k); });

function artPos(k: number, H: number): [number, number] {
  const uw = MAP_AR * H * (1 - MAP_OV) / 3;
  const u = SLOT_UNIT[k] - 1;
  const idx = UNIT_SLOTS[SLOT_UNIT[k]];
  const n = idx.length, j = idx.indexOf(k);
  const lo = u === 0 ? 0.36 : 0.1, hi = 0.9;
  // 길(그림 높이의 약 64%)은 무대 높이 H에서 안전 영역 좌표로 0.14H + 400
  return [Math.round(uw * (u + lo + (hi - lo) * (j + 0.5) / n)), Math.round(0.14 * H + 395 + Math.sin(waveOf(k) * 1.3) * 32)];
}

// 공부 먼저(10-28): 오늘 공부 분량 안내 말은 앱을 켜고 한 번만
let gateHinted = false;

export function MapScreen({ onStart, onPlay, onBook, onHouse, onParent, todayDone, demo, resumeIdx = -1 }: Props) {
  const s = load();
  const locked = gateLocked('h');         // 오늘 공부를 마치기 전: 스티커북·우리 집(꾸미기·집 짓기)이 잠김 (체험 모드는 안 잠김)
  const [cele, setCele] = useState(false);
  const L = curLesson(s);                 // 지금 할 단계 (복습 시험에 떨어졌으면 다시 공부할 단계)
  const cur = Math.min(L, LESSONS.length - 1);
  // 글자 합치기(11-12): 자음·모음을 다 배웠고 안 끝낸 줄이 있으면 낱말 단계보다 먼저 — 그동안 지금 할 단계(L)는 잠겨 보인다
  const sylOn = sylActive(s);
  const sylRow = sylNext(s);              // 다음에 할 줄 (-1: 다 끝냄)
  const task = curTask(s);                // 지금 할 모험 번호 (글자 합치기면 1000 + 줄)
  const allDone = L >= LESSONS.length && !sylOn;
  const scroller = useRef<HTMLDivElement>(null);
  const [wig, setWig] = useState<number | null>(null);
  const H = stageInfo().h;
  const spos = MAP_ART ? (k: number) => artPos(k, H) : slotPos;   // 자리 → 좌표
  const pos = (i: number) => spos(slotOf(i));                     // 단계 번호 → 좌표
  const width = MAP_ART ? Math.round(MAP_AR * H * (3 - 2 * MAP_OV)) : spos(SLOTS - 1)[0] + 400;
  const here = sylOn ? spos(SLOT_SYL) : pos(cur);                 // 친구들이 서 있는 곳 = 지금 할 모험
  const artOk = useArtReady(MAP_ART ? (MAPS as string[]) : null);

  useEffect(() => {
    const el = scroller.current!;
    el.scrollLeft = here[0] - stageInfo().w * 0.4;
    const nm = s.name;
    if (peekGateOpened('h')) { /* 분량을 채워 방금 열림 — 아래 축하 말이 대신 나옴 */ }
    else if (allDone) say(`${nm}${josa(nm, '아', '야')}, 모든 모험을 끝냈어! 놀이터에서 더 놀자!`);
    else if ((s.hold || sylRedo(s)) && !todayDone) say(REVIEW_FAIL);
    else if (todayDone) say('오늘 새 모험은 끝! 놀이터에서 더 놀까?');
    else if (adventuresTotal() === 0) sayAll([helloLine(petView(s.lead).name), '분홍 단추를 누르면 모험이 시작돼!']);
    else if (resumeIdx === task) say('하던 모험을 이어서 하자!');
    else if (snackTotal() >= 3) sayAll(['오늘의 모험을 떠나 볼까?', locked ? GATE_SNACK_WAIT : '간식이 있어! 우리 집에서 먹여 줄까?']);
    else if (locked && !gateHinted) sayAll(['오늘의 모험을 떠나 볼까?', GATE_HINT]);
    else say('오늘의 모험을 떠나 볼까?');
    if (locked) gateHinted = true;
  }, []);
  // 분량을 채워서 문이 열린 순간 축하 (시간으로 정했으면 지도에 있는 동안에도, 모험을 끝내고 돌아왔을 때도)
  useEffect(() => {
    if (demo || !takeGateOpened('h')) return;
    setCele(true); celebrateGate();
  });

  // 경로
  let d = '';
  for (let k = 0; k < SLOTS; k++) {
    const [x, y] = spos(k);
    if (k === 0) d = `M${x - 200} ${y + 100} Q ${x - 100} ${y + 60} ${x} ${y}`;
    else { const [px, py] = spos(k - 1); d += ` C ${px + 70} ${py}, ${x - 70} ${y}, ${x} ${y}`; }
  }

  const tapNode = (i: number) => {
    if (demo) { sfx.tap(); onStart(i, i !== L || sylOn); return; }
    if (i < L) { sfx.tap(); onStart(i, true); return; }
    if (i === L && !todayDone && !sylOn) { sfx.tap(); onStart(i, false); return; }
    sfx.boing(); setWig(i); setTimeout(() => setWig(null), 500);
    say(i === L && !sylOn ? '이 모험은 내일 열려!' : s.hold && i <= s.lessonIdx ? TEST_LOCKED : '아직 잠겨 있어!');
  };
  /** 글자 합치기 자리: 차례면 다음 줄 시작, 다 끝낸 뒤에는 아무 줄이나 다시 하기, 아직이면 잠김 */
  const anyRow = () => sylIdx(Math.floor(Math.random() * SYL_ROW_COUNT));
  const tapSyl = () => {
    if (demo) { sfx.tap(); onStart(sylRow >= 0 ? sylIdx(sylRow) : anyRow(), !sylOn); return; }
    if (sylOn && !todayDone) { sfx.tap(); onStart(task, false); return; }
    if (sylRow < 0) { sfx.tap(); onStart(anyRow(), true); return; }
    sfx.boing(); setWig(-1); setTimeout(() => setWig(null), 500);
    say(sylOn ? '이 모험은 내일 열려!' : '아직 잠겨 있어!');
  };

  const [mx, my] = here;

  return (
    <div class="screen" style={{ background: 'linear-gradient(180deg,#c9ecff,#fff3fb 70%)' }}>
      <div class="map-scroll" ref={scroller}>
        <div class="map-inner" style={{ width }}>
          {MAP_ART && <div class={`map-art ${artOk ? 'on' : ''}`} style={{ width }}>
            {MAPS.map((src, k) => <img src={src!} alt="" draggable={false} style={{ left: Math.round(k * MAP_AR * H * (1 - MAP_OV)), width: Math.round(MAP_AR * H), height: H }} />)}
          </div>}
          <div class="map-safe" style={{ width }}>
          {/* 단원 땅 */}
          <svg style={{ position: 'absolute', left: 0, top: 0 }} width={width} height={800}>
            {!artOk && UNITS.map(u => {
              const idx = UNIT_SLOTS[u.id];
              const x0 = spos(idx[0])[0] - 110, x1 = spos(idx[idx.length - 1])[0] + 110;
              return <g>
                <rect x={x0} y={170} width={x1 - x0} height={560} rx={140} fill={u.color} opacity=".28" />
                <rect x={x0 + 20} y={640} width={x1 - x0 - 40} height={120} rx={60} fill={u.color} opacity=".35" />
              </g>;
            })}
            <path d={d} stroke="#fff" stroke-width={artOk ? 20 : 34} fill="none" stroke-linecap="round" opacity={artOk ? 0.72 : 1} />
            <path d={d} stroke={artOk ? '#ff9ec7' : '#ffd6e8'} stroke-width={artOk ? 9 : 12} fill="none" stroke-dasharray="2 26" stroke-linecap="round" />
          </svg>
          {UNITS.map(u => {
            const idx = UNIT_SLOTS[u.id];
            const x = (spos(idx[0])[0] + spos(idx[idx.length - 1])[0]) / 2;
            return <div class="unit-label" style={{ left: x }}><b>{u.emoji}</b>{u.name}</div>;
          })}
          {LESSONS.map((l, i) => {
            const [x, y] = pos(i);
            const u = UNITS[l.unit - 1];
            const done = i < L;
            const locked = i > L || (i === L && (todayDone || sylOn));
            const label = l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons' ? l.items.join('') : l.kind === 'batchim' ? `받침${l.items[0]}` : l.kind === 'sentence' ? '📖' : l.kind === 'review' ? '복습' : '낱말';
            return (
              <button class={`node ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${i === L && !todayDone && !sylOn ? 'current' : ''} ${wig === i ? 'shake' : ''}`}
                style={{ left: x, top: y, background: `linear-gradient(135deg, ${u.color}, ${shadeHex(u.color)})`, fontSize: label.length > 3 ? 24 : label.length > 2 ? 30 : 38 }}
                onClick={() => tapNode(i)}>
                {i === L && todayDone && !sylOn ? '🌙' : label}
                {locked && (i !== L || sylOn) && <span style={{ position: 'absolute', right: -10, bottom: -8, fontSize: 26 }}>🔒</span>}
              </button>
            );
          })}
          {(() => {
            // 글자 합치기(가~휴 열 줄): 한 자리에 줄 수만큼 점 — 통과한 줄은 노랑, 지금 할 줄은 분홍
            const [x, y] = spos(SLOT_SYL);
            const u = UNITS[SYL_UNIT - 1];
            const done = sylRow < 0, night = sylOn && todayDone;
            const locked = !done && (!sylOn || night);
            return (
              <button class={`node ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${sylOn && !todayDone ? 'current' : ''} ${wig === -1 ? 'shake' : ''}`} data-syl-node={sylOn ? sylRow : done ? 'done' : 'locked'} aria-label={SYL_NAME}
                style={{ left: x, top: y, background: `linear-gradient(135deg, ${u.color}, ${shadeHex(u.color)})`, fontSize: 30 }} onClick={tapSyl}>
                {night ? '🌙' : '가나다'}
                {locked && !night && <span style={{ position: 'absolute', right: -10, bottom: -8, fontSize: 26 }}>🔒</span>}
                <span class="node-syl-dots">{Array.from({ length: SYL_ROW_COUNT }, (_, r) => <i class={sylRowDone(r, s) ? 'on' : sylOn && r === sylRow ? 'now' : ''} />)}</span>
              </button>
            );
          })()}
          {!artOk && UNITS.map(u => {
            const idx = UNIT_SLOTS[u.id];
            const deco = DECO[u.id] ?? ['✨'];
            return idx.map((li, k) => {
              const [x, y] = spos(li);
              const e = deco[k % deco.length];
              const below = y < 440;
              return <div style={{ position: 'absolute', left: x + (k % 2 ? 30 : -70), top: below ? y + 110 + (k % 3) * 20 : y - 190 - (k % 2) * 20, fontSize: 54 + (k % 3) * 10, opacity: .9, pointerEvents: 'none' }}>{e}</div>;
            });
          })}
          {/* 성 (끝) */}
          {!artOk && <div style={{ position: 'absolute', left: spos(SLOTS - 1)[0] + 120, top: 250, fontSize: 180 }}>🏰</div>}
          <div style={{ position: 'absolute', left: mx + 30, top: my - 190, pointerEvents: 'none' }}>
            <Buddy who="other" size={135} motion="bob" />
          </div>
          <div style={{ position: 'absolute', left: mx - 105, top: my - 230, pointerEvents: 'none' }}>
            <Buddy who="lead" size={170} motion={todayDone ? 'bob' : 'jump'} />
          </div>
        </div>
      </div>
      </div>
      <div class="topbar">
        <div class="pill" style={{ fontSize: 34 }}>⭐ {starsTotal()}</div>
        <div class="pill" style={{ fontSize: 28 }}>🔤 {countLetters()}개 글자 친구</div>
        <GatePill kind="h" />
        <HoldGear onOpen={onParent} />
      </div>
      {cele && <GateBanner onDone={() => setCele(false)} />}
      <div class="map-left">
        <button class={`fab ${locked ? 'gate-locked' : ''}`} data-gate-locked={locked ? '1' : undefined} onClick={() => { if (!locked) sfx.tap(); onBook(); }}>📒<span>스티커북</span>{locked && <i class="fab-lock">🔒</i>}</button>
        <button class={`fab ${snackTotal() > 0 && !locked ? 'has-snack' : ''} ${locked ? 'gate-locked' : ''}`} data-house="1" data-gate-locked={locked ? '1' : undefined} onClick={() => { if (!locked) sfx.tap(); onHouse(); }}>🏠<span>우리 집</span>{snackTotal() > 0 && <i class="fab-badge">{snackTotal()}</i>}{locked && <i class="fab-lock">🔒</i>}</button>
        {s.lessonIdx > 0 && <button class="fab" onClick={() => { sfx.tap(); onPlay(); }}>🎪<span>놀이터</span></button>}
      </div>
      <div class="map-actions">
        {!todayDone && !allDone && <button class="btn big pulse" onClick={() => { sfx.tap(); onStart(task, false); }}>{resumeIdx === task ? '이어서 하기 ▶' : '모험 시작 ▶'}</button>}
        {(todayDone || allDone) && s.lessonIdx > 0 && <button class="btn big yellow pulse" onClick={() => { sfx.tap(); onPlay(); }}>놀이터 🎪</button>}
      </div>
    </div>
  );
}

function countLetters() {
  const s = load();
  return Object.keys(s.items).filter(k => k.startsWith('j:')).length;
}

function shadeHex(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * 0.8);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 톱니바퀴를 2초 눌러야 열리는 부모 메뉴 */
export function HoldGear({ onOpen }: { onOpen: () => void }) {
  const [p, setP] = useState(0);
  const t = useRef(0);
  const start = () => {
    const t0 = Date.now();
    clearInterval(t.current);
    t.current = window.setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 2000);
      setP(v);
      if (v >= 1) { clearInterval(t.current); setP(0); onOpen(); }
    }, 50);
  };
  const stop = () => { clearInterval(t.current); setP(0); };
  return (
    <button class="iconbtn" style={{ marginLeft: 'auto', position: 'relative', fontSize: 30, width: 64, height: 64, opacity: 0.8 }}
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} aria-label="부모 설정(2초 누르기)">
      ⚙️
      {p > 0 && <svg style={{ position: 'absolute', inset: -4 }} viewBox="0 0 72 72" width={72} height={72}><circle cx="36" cy="36" r="33" fill="none" stroke="#9775fa" stroke-width="5" stroke-dasharray={`${p * 207} 207`} transform="rotate(-90 36 36)" /></svg>}
    </button>
  );
}
