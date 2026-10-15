// 모험 지도
import { useEffect, useRef, useState } from 'preact/hooks';
import { Buddy } from '../games/Buddies';
import { stageInfo } from '../art/Scene';
import { LESSONS, UNITS } from '../data/curriculum';
import { say, sfx } from '../engine/audio';
import { load, starsTotal, adventuresTotal, snackTotal, petView, curLesson } from '../engine/store';
import { helloLine, REVIEW_FAIL, TEST_LOCKED } from '../data/voice';
import { sayAll } from '../engine/audio';
import { josa } from '../lib/hangul';
import { artSrc } from '../art/artmap';
import { useArtReady } from '../art/paintbg';

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

export function nodePos(i: number): [number, number] {
  const unitGap = (LESSONS[i].unit - 1) * 90;
  return [300 + i * 165 + unitGap, 440 + Math.sin(i * 0.85) * 120];
}

// ---------- 손그림 모험 지도 (묶음 4: map-1~3, 가로로 긴 그림 3장을 이어 붙임) ----------
// 지도 한 장 = 단원 3개(1: 글자 마을·글자 숲·바람 언덕 / 2: 낱말 다리·받침 성 ①·② / 3: 쌍둥이 동굴·무지개 섬·이야기 나라).
// 단원 하나가 그림 한 장의 1/3을 차지하게 단계를 놓아, 그림 속 마을·숲·다리·성·동굴·섬·책 나라 위에 그 단원이 온다.
// 단계는 그림 가운데의 길(모래 띠) 위에. 이웃 그림은 3% 겹쳐 부드럽게 섞는다.
const MAPS = [1, 2, 3].map(n => artSrc(`map.${n}`));
const MAP_ART = MAPS.every(Boolean);
const MAP_AR = 3840 / 1200;
const MAP_OV = 0.03;
const UNIT_IDX: Record<number, number[]> = {};
LESSONS.forEach((l, i) => { (UNIT_IDX[l.unit] ??= []).push(i); });

function artPos(i: number, H: number): [number, number] {
  const uw = MAP_AR * H * (1 - MAP_OV) / 3;
  const u = LESSONS[i].unit - 1;
  const idx = UNIT_IDX[LESSONS[i].unit];
  const n = idx.length, j = idx.indexOf(i);
  const lo = u === 0 ? 0.36 : 0.1, hi = 0.9;
  // 길(그림 높이의 약 64%)은 무대 높이 H에서 안전 영역 좌표로 0.14H + 400
  return [Math.round(uw * (u + lo + (hi - lo) * (j + 0.5) / n)), Math.round(0.14 * H + 395 + Math.sin(i * 1.3) * 32)];
}

export function MapScreen({ onStart, onPlay, onBook, onHouse, onParent, todayDone, demo, resumeIdx = -1 }: Props) {
  const s = load();
  const L = curLesson(s);                 // 지금 할 단계 (복습 시험에 떨어졌으면 다시 공부할 단계)
  const cur = Math.min(L, LESSONS.length - 1);
  const allDone = L >= LESSONS.length;
  const scroller = useRef<HTMLDivElement>(null);
  const [wig, setWig] = useState<number | null>(null);
  const H = stageInfo().h;
  const pos = MAP_ART ? (i: number) => artPos(i, H) : nodePos;
  const width = MAP_ART ? Math.round(MAP_AR * H * (3 - 2 * MAP_OV)) : pos(LESSONS.length - 1)[0] + 400;
  const artOk = useArtReady(MAP_ART ? (MAPS as string[]) : null);

  useEffect(() => {
    const el = scroller.current!;
    el.scrollLeft = pos(cur)[0] - stageInfo().w * 0.4;
    const nm = s.name;
    if (allDone) say(`${nm}${josa(nm, '아', '야')}, 모든 모험을 끝냈어! 놀이터에서 더 놀자!`);
    else if (s.hold && !todayDone) say(REVIEW_FAIL);
    else if (todayDone) say('오늘 새 모험은 끝! 놀이터에서 더 놀까?');
    else if (adventuresTotal() === 0) sayAll([helloLine(petView(s.lead).name), '분홍 단추를 누르면 모험이 시작돼!']);
    else if (resumeIdx === L) say('하던 모험을 이어서 하자!');
    else if (snackTotal() >= 3) sayAll(['오늘의 모험을 떠나 볼까?', '간식이 있어! 우리 집에서 먹여 줄까?']);
    else say('오늘의 모험을 떠나 볼까?');
  }, []);

  // 경로
  let d = '';
  LESSONS.forEach((_, i) => {
    const [x, y] = pos(i);
    if (i === 0) d = `M${x - 200} ${y + 100} Q ${x - 100} ${y + 60} ${x} ${y}`;
    else { const [px, py] = pos(i - 1); d += ` C ${px + 70} ${py}, ${x - 70} ${y}, ${x} ${y}`; }
  });

  const tapNode = (i: number) => {
    if (demo) { sfx.tap(); onStart(i, i !== L); return; }
    if (i < L) { sfx.tap(); onStart(i, true); return; }
    if (i === L && !todayDone) { sfx.tap(); onStart(i, false); return; }
    sfx.boing(); setWig(i); setTimeout(() => setWig(null), 500);
    say(i === L ? '이 모험은 내일 열려!' : s.hold && i <= s.lessonIdx ? TEST_LOCKED : '아직 잠겨 있어!');
  };

  const [mx, my] = pos(cur);

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
              const idx = LESSONS.map((l, i) => [l, i] as const).filter(([l]) => l.unit === u.id).map(([, i]) => i);
              const x0 = pos(idx[0])[0] - 110, x1 = pos(idx[idx.length - 1])[0] + 110;
              return <g>
                <rect x={x0} y={170} width={x1 - x0} height={560} rx={140} fill={u.color} opacity=".28" />
                <rect x={x0 + 20} y={640} width={x1 - x0 - 40} height={120} rx={60} fill={u.color} opacity=".35" />
              </g>;
            })}
            <path d={d} stroke="#fff" stroke-width={artOk ? 20 : 34} fill="none" stroke-linecap="round" opacity={artOk ? 0.72 : 1} />
            <path d={d} stroke={artOk ? '#ff9ec7' : '#ffd6e8'} stroke-width={artOk ? 9 : 12} fill="none" stroke-dasharray="2 26" stroke-linecap="round" />
          </svg>
          {UNITS.map(u => {
            const first = LESSONS.findIndex(l => l.unit === u.id);
            const last = LESSONS.length - 1 - [...LESSONS].reverse().findIndex(l => l.unit === u.id);
            const x = (pos(first)[0] + pos(last)[0]) / 2;
            return <div class="unit-label" style={{ left: x }}><b>{u.emoji}</b>{u.name}</div>;
          })}
          {LESSONS.map((l, i) => {
            const [x, y] = pos(i);
            const u = UNITS[l.unit - 1];
            const done = i < L;
            const locked = i > L || (i === L && todayDone);
            const label = l.kind === 'letters' || l.kind === 'vowel' || l.kind === 'cons' ? l.items.join('') : l.kind === 'batchim' ? `받침${l.items[0]}` : l.kind === 'sentence' ? '📖' : l.kind === 'review' ? '복습' : '낱말';
            return (
              <button class={`node ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${i === L && !todayDone ? 'current' : ''} ${wig === i ? 'shake' : ''}`}
                style={{ left: x, top: y, background: `linear-gradient(135deg, ${u.color}, ${shadeHex(u.color)})`, fontSize: label.length > 3 ? 24 : label.length > 2 ? 30 : 38 }}
                onClick={() => tapNode(i)}>
                {i === L && todayDone ? '🌙' : label}
                {locked && i !== L && <span style={{ position: 'absolute', right: -10, bottom: -8, fontSize: 26 }}>🔒</span>}
              </button>
            );
          })}
          {!artOk && UNITS.map(u => {
            const idx = LESSONS.map((l, i) => [l, i] as const).filter(([l]) => l.unit === u.id).map(([, i]) => i);
            const deco = DECO[u.id] ?? ['✨'];
            return idx.map((li, k) => {
              const [x, y] = pos(li);
              const e = deco[k % deco.length];
              const below = y < 440;
              return <div style={{ position: 'absolute', left: x + (k % 2 ? 30 : -70), top: below ? y + 110 + (k % 3) * 20 : y - 190 - (k % 2) * 20, fontSize: 54 + (k % 3) * 10, opacity: .9, pointerEvents: 'none' }}>{e}</div>;
            });
          })}
          {/* 성 (끝) */}
          {!artOk && <div style={{ position: 'absolute', left: pos(LESSONS.length - 1)[0] + 120, top: 250, fontSize: 180 }}>🏰</div>}
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
        <HoldGear onOpen={onParent} />
      </div>
      <div class="map-left">
        <button class="fab" onClick={() => { sfx.tap(); onBook(); }}>📒<span>스티커북</span></button>
        <button class={`fab ${snackTotal() > 0 ? 'has-snack' : ''}`} data-house="1" onClick={() => { sfx.tap(); onHouse(); }}>🏠<span>우리 집</span>{snackTotal() > 0 && <i class="fab-badge">{snackTotal()}</i>}</button>
        {s.lessonIdx > 0 && <button class="fab" onClick={() => { sfx.tap(); onPlay(); }}>🎪<span>놀이터</span></button>}
      </div>
      <div class="map-actions">
        {!todayDone && !allDone && <button class="btn big pulse" onClick={() => { sfx.tap(); onStart(L, false); }}>{resumeIdx === L ? '이어서 하기 ▶' : '모험 시작 ▶'}</button>}
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
