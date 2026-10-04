// 따라 쓰기: 획순·방향을 확인하며 한 획씩 (한 번 쓰기 / 10번 쓰기 세트)
import { useEffect, useRef, useState } from 'preact/hooks';
import { Backdrop, burst, toSafe } from '../art/Scene';
import { LetterGlyph, pathOf, strokeLen, shade } from '../art/LetterGlyph';
import { JAMO, strokesOf, type Pt, type Stroke } from '../data/jamo';
import { say, sayAll, sfx } from '../engine/audio';
import { pick, decompose } from '../lib/hangul';
import { Buddies } from './Buddies';
import { useScene, praise, spoken, cue, sayCue, CUE_GAP, Speaker, useTurn, type GameProps } from './common';
import { record } from '../engine/srs';
import { REPS_START, REPS_DONE, REPS_MORE, REPS_LAST, REPS_ALL, REPS_ALL40 } from '../data/voice';
import { buddy } from '../engine/bus';

const PAD = 8, SPAN = 100 + PAD * 2;

interface Proj { s: number; d: number; p: Pt }

function project(st: Stroke, q: Pt, lo: number, hi: number): Proj | null {
  let acc = 0, best: Proj | null = null;
  for (let i = 1; i < st.length; i++) {
    const [ax, ay] = st[i - 1], [bx, by] = st[i];
    const len = Math.hypot(bx - ax, by - ay);
    const s0 = acc, s1 = acc + len;
    acc = s1;
    const a = Math.max(lo, s0), b = Math.min(hi, s1);
    if (a > b || len === 0) continue;
    let t = ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / (len * len);
    t = Math.max((a - s0) / len, Math.min((b - s0) / len, t));
    const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
    const d = Math.hypot(q[0] - px, q[1] - py);
    if (!best || d < best.d) best = { s: s0 + t * len, d, p: [px, py] };
  }
  return best;
}

function pointAt(st: Stroke, s: number): Pt {
  let acc = 0;
  for (let i = 1; i < st.length; i++) {
    const len = Math.hypot(st[i][0] - st[i - 1][0], st[i][1] - st[i - 1][1]);
    if (acc + len >= s) { const t = (s - acc) / (len || 1); return [st[i - 1][0] + (st[i][0] - st[i - 1][0]) * t, st[i - 1][1] + (st[i][1] - st[i - 1][1]) * t]; }
    acc += len;
  }
  return st[st.length - 1];
}

const RAINBOW = ['#ff6b9a', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];

export type Guide = 'full' | 'faint' | 'memory' | 'none';

interface BoardProps {
  ch: string;
  guide: Guide;
  onDone: (mistakes: number) => void;
  onMood?: (m: 'happy' | 'think') => void;
  quiet?: boolean;      // 완성해도 크게 축하하지 않음 (세트 중간)
  test?: boolean;       // 받아쓰기 시험: 틀려도 획을 보여 주지 않음 (틀린 횟수는 onMiss로)
  onMiss?: (n: number) => void;
}

/** 글자 한 번 쓰는 판 */
export function TraceBoard({ ch, guide, onDone, onMood, quiet, test, onMiss }: BoardProps) {
  const strokes = strokesOf(ch);
  const isSyl = !JAMO[ch];
  const color = JAMO[ch]?.color ?? JAMO[decompose(ch)?.cho ?? 'ㄱ']?.color ?? '#ff7eb6';
  const W = isSyl ? 8.5 : 13;
  const TOL = (isSyl ? 11 : 15) + (guide === 'memory' ? 2 : guide === 'none' ? 7 : 0);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false);
  const [hint, setHint] = useState(false);        // 기억 모드에서 두 번 틀리면 시작점 보여 주기
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef({ active: false, s: 0, last: null as Pt | null, hue: 0, lastWarn: 0, miss: 0, strokeMiss: 0 });

  useEffect(() => {
    const c = cv.current!;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
  }, []);

  const toLetter = (e: PointerEvent): Pt => {
    const r = cv.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SPAN - PAD, ((e.clientY - r.top) / r.height) * SPAN - PAD];
  };
  const toCanvas = (p: Pt): Pt => {
    const c = cv.current!;
    return [((p[0] + PAD) / SPAN) * c.width, ((p[1] + PAD) / SPAN) * c.height];
  };
  const clear = () => { const c = cv.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); };

  const warn = (msg: string) => {
    const now = Date.now();
    const S = st.current;
    S.miss++; S.strokeMiss++;
    setShake(true); setTimeout(() => setShake(false), 450);
    onMood?.('think'); setTimeout(() => onMood?.('happy'), 1200);
    sfx.boing();
    if (test) { onMiss?.(S.miss); if (now - S.lastWarn > 2500) { S.lastWarn = now; say(msg); } return; }
    if (guide !== 'full' && S.strokeMiss >= 2 && !hint) { setHint(true); say('잘 봐, 이렇게 쓰는 거야!'); S.lastWarn = now; return; }
    if (now - S.lastWarn > 2500) { S.lastWarn = now; say(msg); }
  };

  const finishStroke = () => {
    const s = strokes[idx];
    const S = st.current;
    S.active = false; S.strokeMiss = 0;
    clear();
    sfx.stroke();
    const end = s[s.length - 1];
    const box = cv.current!.getBoundingClientRect();
    burst(...toSafe(box.left + ((end[0] + PAD) / SPAN) * box.width, box.top + ((end[1] + PAD) / SPAN) * box.height));
    const next = idx + 1;
    setIdx(next); setHint(false);
    if (next >= strokes.length) {
      setDone(true);
      if (!quiet) sfx.fanfare();
      onDone(S.miss);
    }
  };

  const down = (e: PointerEvent) => {
    if (done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const s = strokes[idx];
    const L = strokeLen(s);
    const q = toLetter(e);
    const pr = project(s, q, 0, Math.min(L * 0.25, 18));
    if (!pr || pr.d > TOL + (guide === 'none' ? 10 : 4)) { warn(guide === 'full' ? '초록 점에서 시작해 봐!' : '어디서 시작하는지 기억해 봐!'); return; }
    st.current.active = true; st.current.s = pr.s; st.current.last = q;
    sfx.scribble();
  };

  const move = (e: PointerEvent) => {
    const S = st.current;
    if (!S.active || done) return;
    const s = strokes[idx];
    const L = strokeLen(s);
    const q = toLetter(e);
    const pr = project(s, q, Math.max(0, S.s - 10), Math.min(L, S.s + 28));
    if (!pr || pr.d > TOL) {
      S.active = false; clear();
      warn(pick(['선을 따라 그려 봐!', '화살표 방향으로 쭉!', '천천히 다시 해 볼까?']));
      return;
    }
    const ctx = cv.current!.getContext('2d')!;
    const a = toCanvas(S.last!), b = toCanvas(q);
    const scale = cv.current!.width / SPAN;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = RAINBOW[Math.floor(S.hue) % RAINBOW.length];
    ctx.lineWidth = W * scale * 0.85;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.arc(b[0] - W * scale * 0.15, b[1] - W * scale * 0.15, W * scale * 0.12, 0, Math.PI * 2); ctx.fill();
    S.hue += 0.08;
    S.last = q;
    S.s = Math.max(S.s, pr.s);
    if (S.s >= L - Math.min(6, L * 0.08)) finishStroke();
  };

  const up = () => {
    const S = st.current;
    if (!S.active || done) return;
    const L = strokeLen(strokes[idx]);
    if (S.s >= L * 0.82) { finishStroke(); return; }
    S.active = false; clear();
    warn('끝까지 쭉 그어 봐!');
  };

  const cur = strokes[idx];
  const dark = shade(color, -0.28);
  const showArrow = guide === 'full' || hint;
  const showStart = guide === 'full' || hint;          // 흐린 선(그림자) 단계는 시작점도 안 보여 줌
  const guideCol = guide === 'full' ? '#e9e1f3' : guide === 'faint' ? '#ece4f5' : '#f7f4fb';
  // 혼자 쓰기: 그림자(흐린 글자)를 아예 안 보여 줌. 두 번 틀리면 지금 획만 살짝 보여 줌
  const guideStrokes = guide === 'none' ? (hint && cur ? [cur] : []) : strokes;

  return (
    <div class={`trace-box ${shake ? 'shake' : ''}`}>
      <svg viewBox={`${-PAD} ${-PAD} ${SPAN} ${SPAN}`} data-stroke={idx} data-guide-mode={guide} data-paths={JSON.stringify(strokes.map(pathOf))}>
        <path d="M50 -8 V108 M-8 50 H108" stroke="#ffd6e8" stroke-width=".8" stroke-dasharray="3 3" />
        {guideStrokes.map(s => <path data-guide="1" d={pathOf(s)} stroke={guideCol} stroke-width={W + 6} fill="none" stroke-linecap="round" stroke-linejoin="round" />)}
        {strokes.slice(0, idx).map(s => (
          <g>
            <path d={pathOf(s)} stroke={dark} stroke-width={W + 4} fill="none" stroke-linecap="round" stroke-linejoin="round" />
            <path d={pathOf(s)} stroke={color} stroke-width={W} fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </g>
        ))}
        {!done && cur && (
          <g>
            {showArrow && <path d={pathOf(cur)} stroke="#c9b6e4" stroke-width="1.6" fill="none" stroke-dasharray="3 3" stroke-linecap="round" />}
            {showArrow && <Arrow s={cur} />}
            {showArrow && (
              <circle r="3.2" fill="#ff7eb6" stroke="#fff" stroke-width="1.2">
                <animateMotion {...({ dur: `${Math.max(1.2, strokeLen(cur) / 45)}s`, repeatCount: 'indefinite', path: pathOf(cur) } as any)} />
              </circle>
            )}
            {showStart && (
              <g class="start-dot">
                <circle cx={cur[0][0]} cy={cur[0][1]} r={guide === 'full' ? 6.5 : 5} fill="#40c057" stroke="#fff" stroke-width="1.6" />
                {guide === 'full' && <text x={cur[0][0]} y={cur[0][1] + 2.4} font-size="7" text-anchor="middle" fill="#fff" font-family="Jua">{idx + 1}</text>}
              </g>
            )}
          </g>
        )}
      </svg>
      {done && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div class="glyph-bounce"><LetterGlyph ch={ch} size={579} face={!isSyl} color={color} width={W} /></div></div>}
      <canvas ref={cv} onPointerDown={down as any} onPointerMove={move as any} onPointerUp={up} onPointerCancel={up} />
    </div>
  );
}

/** 한 번 쓰기 (낱말 단원 등) */
export function Trace({ step, onDone, outfit }: GameProps<'trace'>) {
  const { alive, sleep } = useScene();
  const [mood, setMood] = useState<'happy' | 'think'>('happy');
  const [done, setDone] = useState(false);
  const guide: Guide = step.guide === 'full' ? 'full' : 'faint';
  useEffect(() => {
    const nm = spoken(step.ch);
    sayAll(guide === 'full' ? [nm, '따라 써 볼까? 초록 점에서 시작해!'] : ['이번엔 혼자 써 볼까?', nm]);
  }, []);
  const finished = async () => {
    setDone(true);
    await praise(true); if (!alive()) return;
    await say(spoken(step.ch));
    if (await sleep(900)) onDone();
  };
  return (
    <div class="screen">
      <Backdrop theme="library" />
      <div class="layer">
        <Buddies size={170} mood={mood} motion={done ? 'cheer' : 'bob'} reading />
        <TraceBoard ch={step.ch} guide={guide} onDone={finished} onMood={setMood} />
      </div>
    </div>
  );
}

// ---------- 10번 쓰기 세트 ----------
export const COUNT = ['하나!', '둘!', '셋!', '넷!', '다섯!', '여섯!', '일곱!', '여덟!', '아홉!', '열!', '열하나!', '열둘!', '열셋!', '열넷!', '열다섯!'];

/**
 * 몇 번째 쓰기에 안내를 얼마나 보여 줄지 (한 글자 reps번):
 * 처음 몇 번은 따라 쓰기(화살표·번호) → 흐린 선만 → 마지막 3번은 그림자 없이 혼자 쓰기
 */
export function guideFor(r: number, reps: number): Guide {
  const alone = Math.min(3, Math.max(1, reps - 2));
  if (r >= reps - alone) return 'none';
  const guided = reps - alone;
  return r < Math.ceil(guided * 0.45) ? 'full' : 'faint';
}

const GUIDE_LINE: Partial<Record<Guide, string>> = { faint: '이번엔 흐린 선만 보고 써 봐!', none: '이제 혼자 써 봐! 그림자가 없어!' };

/**
 * 한 글자를 reps번 쓰기 (한 세트). 글자 공부에서는 세 세트(10번씩, 사이사이 놀이)로 모두 30번:
 *  1세트: 10번 모두 위치·순서 안내 / 2세트: 안내 5 + 그림자 5 / 3세트: 안내 1 + 그림자 6 + 혼자 3
 * 말하는 동안에도 바로 쓸 수 있다 (쓰기 시작하면 하던 말은 그대로 두고, 한 번 다 쓰면 말을 끊고 숫자 세기)
 */
export function TraceSet({ step, onDone, outfit }: GameProps<'traceSet'>) {
  const { alive, sleep } = useScene();
  const reps = step.reps;
  const part = step.part ?? 0, parts = step.parts ?? 1;
  const total = reps * parts;
  const guideAt = (r: number): Guide => (step.guides?.[r] as Guide | undefined) ?? guideFor(r, reps);
  // 한 글자를 reps번 다 쓰고 나서 다음 글자 (번갈아 쓰지 않음)
  const order = (() => {
    const out: { ch: string; r: number }[] = [];
    step.items.forEach(ch => { for (let r = 0; r < reps; r++) out.push({ ch, r }); });
    return out;
  })();
  const [k, setK] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mood, setMood] = useState<'happy' | 'think' | 'wow'>('happy');
  const [fresh, setFresh] = useState(true);
  const lastGuide = useRef<Guide | null>(null);
  const mistakes = useRef<Record<string, number>>({});
  const turn = useTurn();
  const cur = order[Math.min(k, order.length - 1)];
  const guide = guideAt(cur.r);
  const startLine = part === 0 || reps !== 10 ? (REPS_START[reps] ?? '열 번 써 보자!') : part >= parts - 1 ? REPS_LAST : REPS_MORE;
  const doneLine = parts > 1 && part >= parts - 1 && total === 40 ? REPS_ALL40 : parts > 1 && part >= parts - 1 && total === 30 ? REPS_ALL : (REPS_DONE[reps] ?? '열 번 다 썼어! 대단해!');

  // 쓸 때마다 글자 이름과 소리를 한 번씩 ("기역" "그"), 새 세트·새 단계면 안내 한마디 — 말하는 중에도 바로 쓸 수 있음
  useEffect(() => {
    setFresh(true); const t = setTimeout(() => setFresh(false), 350);
    const lines: string[] = [];
    if (cur.r === 0) lines.push(...cue(cur.ch), startLine);
    else {
      if (lastGuide.current && lastGuide.current !== guide && GUIDE_LINE[guide]) lines.push(GUIDE_LINE[guide]!);
      lines.push(...cue(cur.ch));
    }
    lastGuide.current = guide;
    sayAll(lines, CUE_GAP);
    return () => clearTimeout(t);
  }, [k]);

  const done1 = async (miss: number) => {
    const ch = cur.ch;
    turn.take();                      // 한 번 다 쓰면 하던 말은 끊고 숫자 세기
    mistakes.current[ch] = (mistakes.current[ch] || 0) + miss;
    const n = (counts[ch] || 0) + 1;
    setCounts(c => ({ ...c, [ch]: n }));
    setMood('wow');
    say(COUNT[Math.min(COUNT.length - 1, n - 1)]);
    buddy({ t: 'count', text: COUNT[Math.min(COUNT.length - 1, n - 1)] });
    if (!await sleep(650)) return;
    setMood('happy');
    const lastOfCh = k + 1 >= order.length || order[k + 1].ch !== ch;
    if (lastOfCh && JAMO[ch]) record('j:' + ch, (mistakes.current[ch] || 0) <= reps);
    if (k + 1 >= order.length) {
      sfx.fanfare();
      await say(doneLine);
      if (await sleep(400)) onDone();
      return;
    }
    if (lastOfCh) { sfx.fanfare(); await say(doneLine); if (!alive()) return; }
    setK(k + 1);
  };

  return (
    <div class="screen">
      <Backdrop theme="library" />
      <div class="layer">
        <Buddies size={162} mood={mood} motion={mood === 'wow' ? 'jump' : 'bob'} reading />
        {/* 글자별 도장판 (세 세트면 30칸: 앞 세트에서 쓴 만큼 채워져 있음) */}
        <div style={{ position: 'absolute', left: 950, top: total > 15 ? 96 : 120, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {step.items.map(ch => (
            <div class="stamp-card" data-current={ch === cur.ch ? 1 : 0}>
              <div class="stamp-ch">{ch}{parts > 1 && <small class="stamp-part">{part + 1}/{parts}</small>}</div>
              <div class={`stamps ${total > 30 ? 'lots' : total > 15 ? 'many' : ''}`}>{Array.from({ length: total }, (_, i) => <i class={i < part * reps + (counts[ch] || 0) ? 'on' : ''} />)}</div>
            </div>
          ))}
        </div>
        <div class="pill" style={{ position: 'absolute', left: 36, top: 120, fontSize: 30 }}>
          {guide === 'full' ? '✏️ 따라 쓰기' : guide === 'faint' ? '👀 그림자 보고 쓰기' : '🧠 혼자 쓰기'}
          <Speaker style={{ width: 60, height: 60, fontSize: 30 }} onClick={() => sayCue(cur.ch)} />
        </div>
        <div key={k} class={fresh ? 'fade-in' : ''}>
          <TraceBoard ch={cur.ch} guide={guide} onDone={done1} onMood={m => setMood(m)} quiet />
        </div>
      </div>
    </div>
  );
}

function Arrow({ s }: { s: Stroke }) {
  const L = strokeLen(s);
  const [x, y] = pointAt(s, L);
  const [px, py] = pointAt(s, Math.max(0, L - 4));
  const ang = Math.atan2(y - py, x - px) * 180 / Math.PI;
  return <path d="M-3 -3.5 L3 0 L-3 3.5" transform={`translate(${x} ${y}) rotate(${ang})`} stroke="#c9b6e4" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />;
}
