// 시계와 시간 — 문제 화면 조각 (11-13 사용자 요청): 한 화면에 한 가지 과제만
//  · HandsIntro 시계 바늘 알아보기(누르면 설명 · 설명 카드를 끌어 바늘에 놓기 · 초침은 고르는 심화)
//  · ReadView 시간 읽기(보기 넷 / 시·분 돌림판) · SetView 시계 맞추기(바늘 끌기) · ShiftView 몇 분 후·전(타임라인 + '시계로 확인하기' 풀이)
//  · DayView 하루와 여러 날(달력 카드 + 24시간 막대) · DayIntro 하루는 24시간(해와 달)
// 오답: 정답을 바로 보여 주지 않고 힌트(clockData.ts) → 다시 풀기. 채점(onJudge)은 '한 번에 맞혔나' 한 번만 알린다.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { burst, centerOf, stageInfo } from '../art/Scene';
import { say, sfx, wait } from '../engine/audio';
import { ClockFace, HAND_COLOR, HAND_NAME, HAND_UNIT, type Hand } from './ClockFace';
import {
  H12, MIN, hm, hmAP, h24, ampmOf, mod, speakable, daySums,
  readJudge, readHint, readExplain, setJudge, setHint as hintForSet, setExplain, setPraise, shiftHint, shiftSteps, shiftExplain, dayHint, dayExplain,
  type ReadTask, type SetTask, type ShiftTask, type DayTask, type Hint, type TaskTag, type CkOpt,
} from '../math/clockData';
import { CLOCK_HAND, CLOCK_HAND_MORE, CLOCK_TAP_ASK, CLOCK_MATCH_ASK, CLOCK_MATCH_MISS, CLOCK_MATCH_OK, CLOCK_DAY } from '../data/voice';

/** 숫자가 든 문제·힌트 읽기: 기기 음성으로만 (서버에 녹음을 부탁하지 않음) */
export const speak = (text: string) => { void say(speakable(text), { local: true }); };
/** 정해진 말 읽기: 녹음·서버 음성이 있으면 그것으로 */
export const speakLine = (text: string) => { void say(text); };

/** 읽어 주기 단추 (모든 문제·힌트에) */
export function Spk({ text, line, small }: { text: string; line?: boolean; small?: boolean }) {
  return <button class={`ck-spk ${small ? 'small' : ''}`} aria-label="읽어 주기" data-spk={small ? 'hint' : 'q'} onClick={(e) => { e.stopPropagation(); sfx.tap(); if (line) speakLine(text); else speak(text); }}>🔊</button>;
}
type Tone = 'hint' | 'good' | 'show' | 'info';
const TONE_ICON: Record<Tone, string> = { hint: '💡', good: '⭕', show: '📖', info: '👀' };
/** 힌트·풀이 말풍선 */
export function Bubble({ tone, text, line, children }: { tone: Tone; text: string; line?: boolean; children?: ComponentChildren }) {
  return (
    <div class={`ck-bubble ${tone}`} data-bubble={tone}>
      <span class="ck-bubble-ic">{TONE_ICON[tone]}</span>
      <span class="ck-bubble-t">{text}{children}</span>
      <Spk small text={text} line={line} />
    </div>
  );
}
/** '오후 3시 25분' — 시는 짧은 바늘 색, 분은 긴 바늘 색 */
export function TimeText({ t, ampm, big }: { t: number; ampm?: boolean; big?: boolean }) {
  return (
    <span class={`ck-time ${big ? 'big' : ''}`}>
      {ampm && <span class={`ck-ampm ${ampmOf(t) === '오전' ? 'am' : 'pm'}`}>{ampmOf(t)}</span>}
      <b class="h">{H12(t)}시</b>{MIN(t) > 0 && <> <b class="m">{MIN(t)}분</b></>}
    </span>
  );
}
const TAG_TEXT: Partial<Record<TaskTag, string>> = { review: '🔁 복습', again: '🔁 다시 한 번', bonus: '⭐ 도전 문제' };
/** 문제 줄: 읽어 주기 + 문제 글 */
export function QBar({ q, tag, children }: { q: string; tag?: TaskTag; children?: ComponentChildren }) {
  return (
    <div class="ck-q" data-ck-q={q}>
      <Spk text={q} />
      <div class="ck-q-text">{children ?? q}</div>
      {tag && TAG_TEXT[tag] && <span class={`ck-tagchip ${tag}`}>{TAG_TEXT[tag]}</span>}
    </div>
  );
}
export interface TaskProps<T> { task: T; tag: TaskTag; onJudge: (ok: boolean) => void; onNext: () => void }
const NextBtn = ({ onNext, label = '다음 ▶' }: { onNext: () => void; label?: string }) => <button class="btn violet ck-next" data-ck-next="1" onClick={() => { sfx.tap(); onNext(); }}>{label}</button>;
/** 맞혔을 때: 소리 + 별 */
function celebrate(el: Element | null) {
  sfx.ding();
  const [x, y] = centerOf(el);
  burst(x, y, 'star');
}
/** 값을 시간에 따라 부드럽게 바꾸기 (풀이 애니메이션) — 멈추려면 alive.current = false */
function tween(from: number, to: number, ms: number, alive: { current: boolean }, on: (v: number) => void): Promise<void> {
  return new Promise(res => {
    const t0 = performance.now();
    const step = (now: number) => {
      if (!alive.current) { res(); return; }
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      on(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
/** 같은 시계 모양 중 지금 값에 가장 가까운 값 (바늘이 가까운 쪽으로 돌게) */
const nearT = (target: number, cur: number) => { const base = mod(target, 720); return base + Math.round((cur - base) / 720) * 720; };

// ---------------- 돌림판 ----------------
function Wheel({ value, values, onChange, unit, hand, disabled, id }: { value: number; values: number[]; onChange: (v: number) => void; unit: string; hand: Hand; disabled?: boolean; id: string }) {
  const i = Math.max(0, values.indexOf(value));
  const at = (d: number) => values[mod(i + d, values.length)];
  const drag = useRef<{ y: number; acc: number } | null>(null);
  const rep = useRef(0);
  const [roll, setRoll] = useState(0);                       // 굴러가는 방향 (애니메이션 다시 시작용)
  const go = (d: number) => { if (disabled) return; sfx.tap(); onChange(at(d)); setRoll(r => (d > 0 ? Math.abs(r) + 1 : -Math.abs(r) - 1)); };
  const goRef = useRef(go); goRef.current = go;
  const stop = () => { clearTimeout(rep.current); clearInterval(rep.current); };
  useEffect(() => stop, []);
  // 길게 누르면 계속 굴러감
  const hold = (d: number) => (e: PointerEvent) => {
    e.preventDefault(); stop(); go(d);
    rep.current = window.setTimeout(() => { rep.current = window.setInterval(() => goRef.current(d), 110); }, 380);
  };
  const scale = () => stageInfo().scale || 1;
  return (
    <div class={`ck-wheel ${disabled ? 'off' : ''}`} data-wheel={id} data-value={value}>
      <button class="ck-wheel-btn" aria-label={`${unit} 늘리기`} data-wheel-up={id} onPointerDown={hold(1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>▲</button>
      <div class="ck-wheel-win" style={{ borderColor: HAND_COLOR[hand] }}
        onPointerDown={(e) => { if (disabled) return; drag.current = { y: e.clientY, acc: 0 }; try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* 무시 */ } }}
        onPointerMove={(e) => {
          const g = drag.current; if (!g) return;
          g.acc += (g.y - e.clientY) / scale(); g.y = e.clientY;
          while (g.acc >= 34) { g.acc -= 34; go(1); }
          while (g.acc <= -34) { g.acc += 34; go(-1); }
        }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <span class="ck-wheel-side">{at(-1)}</span>
        <span key={roll} class={`ck-wheel-cur ${roll > 0 ? 'up' : roll < 0 ? 'down' : ''}`} style={{ color: HAND_COLOR[hand] }}>{value}</span>
        <span class="ck-wheel-side">{at(1)}</span>
      </div>
      <button class="ck-wheel-btn" aria-label={`${unit} 줄이기`} data-wheel-down={id} onPointerDown={hold(-1)} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>▼</button>
      <div class="ck-wheel-unit" style={{ color: HAND_COLOR[hand] }}>{unit}</div>
    </div>
  );
}

// ---------------- 시간 읽기 ----------------
export function ReadView({ task, tag, onJudge, onNext }: TaskProps<ReadTask>) {
  const [wrong, setWrong] = useState<string[]>([]);          // 잘못 고른 보기
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<'ask' | 'right' | 'show'>('ask');
  const [hint, setHint] = useState<Hint | null>(null);
  const [h, setH] = useState(12);
  const [m, setM] = useState(0);
  const judged = useRef(false);
  const timer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const H = H12(task.t), M = MIN(task.t);
  const maxTries = task.mode === 'pick' ? 2 : 3;
  const right = () => {
    const first = !judged.current;
    if (first) { judged.current = true; onJudge(true); }
    setStatus('right'); setHint(null);
    celebrate(box.current);
    if (first) timer.current = window.setTimeout(onNext, 1800);
  };
  const miss = (ph: number, pm: number) => {
    if (!judged.current) { judged.current = true; onJudge(false); }
    const n = tries + 1;
    setTries(n);
    sfx.boing();
    if (n >= maxTries) { setStatus('show'); setHint(null); setH(H); setM(M); return; }
    setHint(readHint(task, ph, pm, n));
  };
  const pick = (o: CkOpt) => {
    if (status !== 'ask' || wrong.includes(o.label)) return;
    if (o.ok) { right(); return; }
    setWrong(w => [...w, o.label]);
    miss(o.h ?? 0, o.m ?? 0);
  };
  const check = () => { if (status !== 'ask') return; if (readJudge(task, h, m)) right(); else miss(h, m); };
  const minutes = useMemo(() => Array.from({ length: 60 / task.minStep }, (_x, i) => i * task.minStep), [task.minStep]);
  const hoursList = useMemo(() => Array.from({ length: 12 }, (_x, i) => i + 1), []);
  const answer = `${hm(task.t)}${M ? '이에요' : '예요'}`;
  return (
    <div class="ck-task ck-read" data-ck-task="read" data-kind={task.kind} data-mode={task.mode} data-ans={hm(task.t)} data-status={status}>
      <QBar q={task.q} tag={tag} />
      <div class="ck-body">
        <div class="ck-clockbox" ref={box}>
          <ClockFace t={task.t} size={520} ring={task.ring || !!hint?.ring || (status === 'show' && M > 0)} glow={status === 'ask' ? hint?.glow ?? null : null} />
        </div>
        <div class="ck-side">
          {task.mode === 'pick' ? (
            <div class="ck-opts">
              {task.opts.map(o => {
                const cls = status !== 'ask' ? (o.ok ? 'ok' : 'dim') : wrong.includes(o.label) ? 'no' : '';
                return <button class={`ck-opt ${cls}`} data-opt={o.label} data-ok={o.ok ? '1' : undefined} onClick={() => pick(o)}>{o.label}</button>;
              })}
            </div>
          ) : (
            <div class="ck-wheels">
              <div class="ck-wheels-row">
                <Wheel id="h" value={h} values={hoursList} onChange={setH} unit="시" hand="h" disabled={status !== 'ask'} />
                <Wheel id="m" value={m} values={minutes} onChange={setM} unit="분" hand="m" disabled={status !== 'ask'} />
              </div>
              {status === 'ask' && <button class="btn mint ck-check" data-ck-check="1" onClick={() => { sfx.tap(); check(); }}>확인 ✓</button>}
            </div>
          )}
          {status === 'ask' && hint && <Bubble tone="hint" text={hint.text} />}
          {status === 'right' && <Bubble tone="good" text={`정답! ${readExplain(task)}`} />}
          {status === 'show' && <Bubble tone="show" text={`정답은 ${answer}. ${readExplain(task)}`} />}
          {status !== 'ask' && <NextBtn onNext={onNext} />}
        </div>
      </div>
    </div>
  );
}

// ---------------- 시계 맞추기 ----------------
export function SetView({ task, tag, onJudge, onNext }: TaskProps<SetTask>) {
  const [t, setT] = useState(task.start);
  const [tries, setTries] = useState(0);
  const [status, setStatus] = useState<'ask' | 'right' | 'show'>('ask');
  const [hint, setHint] = useState<Hint | null>(null);
  const [touched, setTouched] = useState(false);
  const judged = useRef(false);
  const timer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const M = MIN(task.target);
  const check = () => {
    if (status !== 'ask') return;
    if (setJudge(task, t)) {
      const first = !judged.current;
      if (first) { judged.current = true; onJudge(true); }
      setStatus('right'); setHint(null);
      celebrate(box.current);
      if (first) timer.current = window.setTimeout(onNext, 2600);
      return;
    }
    if (!judged.current) { judged.current = true; onJudge(false); }
    const n = tries + 1;
    setTries(n);
    sfx.boing();
    if (n >= 3) { setStatus('show'); setHint(null); setT(nearT(task.target, t)); return; }   // 풀이: 바늘이 정답으로 움직임
    setHint(hintForSet(task, t, n));
  };
  return (
    <div class="ck-task ck-set" data-ck-task="set" data-kind={task.kind} data-target={mod(task.target, 720)} data-status={status}>
      <QBar q={task.q} tag={tag}><TimeText t={task.target} ampm />{M ? '으로' : '로'} 시계를 맞춰 보세요.</QBar>
      <div class="ck-body">
        <div class="ck-clockbox" ref={box}>
          <ClockFace t={t} size={520} drag={status === 'ask'} snap={task.snap} ring={task.ring || !!hint?.ring || (status === 'show' && M > 0)} glow={status === 'ask' ? hint?.glow ?? null : null}
            onDrag={(v) => { setT(v); if (!touched) setTouched(true); }} onDrop={(v) => { setT(v); sfx.stroke(); }} />
          {status === 'ask' && !touched && <div class="ck-draghint">👆 바늘을 끌어서 움직여요</div>}
        </div>
        <div class="ck-side">
          <div class="ck-target">
            <div class="ck-target-cap">이 시각으로 맞춰요</div>
            <TimeText t={task.target} ampm big />
            <div class="ck-target-24" data-h24={h24(task.target)}>24시간 표기 <b>{h24(task.target)}</b></div>
          </div>
          {status === 'ask' && <button class="btn mint ck-check" data-ck-check="1" onClick={() => { sfx.tap(); check(); }}>다 맞췄어요! ✓</button>}
          {status === 'ask' && hint && <Bubble tone="hint" text={hint.text} />}
          {status === 'right' && <Bubble tone="good" text={`정답! ${setPraise(task)}`} />}
          {status === 'show' && <Bubble tone="show" text={`이렇게 맞춰요. ${setExplain(task)}`} />}
          {status !== 'ask' && <NextBtn onNext={onNext} />}
        </div>
      </div>
    </div>
  );
}

// ---------------- 몇 분 후·전 ----------------
/** 타임라인: 시작 → (정각) → 도착. 풀이 때 바늘과 같이 움직인다 */
function Timeline({ task, tNow, stepIdx, phase, aim }: { task: ShiftTask; tNow: number; stepIdx: number; phase: 'ask' | 'anim' | 'done'; aim?: boolean }) {
  const steps = useMemo(() => shiftSteps(task), [task]);
  const s = task.start, e = task.start + task.delta, after = task.delta > 0;
  const lo = Math.floor(Math.min(s, e) / 60) * 60;
  let hi = Math.ceil(Math.max(s, e) / 60) * 60;
  if (hi === lo) hi = lo + 60;
  const W = 940, X0 = 40, Y = 104;
  const x = (t: number) => X0 + (t - lo) / (hi - lo) * W;
  const wide = hi - lo > 60;
  const ticks = [];
  for (let t = lo; t <= hi; t += 5) ticks.push(t);
  const d = Math.abs(task.delta);
  const hop = (from: number, to: number, label: string, done: boolean, key: number) => {
    const x1 = x(from), x2 = x(to), top = Math.min(62, Math.abs(x2 - x1) / 2 + 16);
    return (
      <g key={key} class="ck-hop" data-hop={label}>
        <path d={`M${x1} ${Y - 6} Q${(x1 + x2) / 2} ${Y - 6 - top * 1.5} ${x2} ${Y - 6}`} fill="none" stroke={after ? '#4dabf7' : '#ff922b'} stroke-width="6" stroke-linecap="round" />
        {done && <text x={(x1 + x2) / 2} y={Math.min(Y - 14 - top * 0.75, Y - 64)} text-anchor="middle" font-size="24" fill={after ? '#1971c2' : '#d9480f'}>{label}</text>}
      </g>
    );
  };
  const flag = (t: number, label: string, color: string, below: string) => (
    <g class="ck-flag" data-flag={label}>
      <line x1={x(t)} y1={Y - 26} x2={x(t)} y2={Y + 8} stroke={color} stroke-width="5" stroke-linecap="round" />
      <circle cx={x(t)} cy={Y} r="10" fill={color} stroke="#fff" stroke-width="3" />
      <rect x={x(t) - 34} y={Y - 56} width="68" height="30" rx="15" fill={color} />
      <text x={x(t)} y={Y - 40} text-anchor="middle" dominant-baseline="middle" font-size="20" fill="#fff">{label}</text>
      <text x={x(t)} y={Y + 62} text-anchor="middle" font-size="22" fill={color}>{below}</text>
    </g>
  );
  const ax = x(s), dir = after ? 1 : -1;
  return (
    <svg class="ck-timeline" width="1012" height="176" viewBox="0 0 1020 176" data-timeline={`${lo}-${hi}`}>
      <line x1={X0 - 16} y1={Y} x2={X0 + W + 16} y2={Y} stroke="#b8a7c9" stroke-width="6" stroke-linecap="round" />
      {ticks.map(t => {
        const hour = mod(t, 60) === 0, mm = mod(t, 60);
        const lab = hour ? `${H12(t)}시` : wide ? (mm % 15 === 0 ? String(mm) : '') : String(mm);
        return (
          <g>
            <line x1={x(t)} y1={Y - (hour ? 16 : 8)} x2={x(t)} y2={Y + (hour ? 16 : 8)} stroke={hour ? '#4a2d5e' : '#b8a7c9'} stroke-width={hour ? 5 : 3} stroke-linecap="round" />
            {lab && <text x={x(t)} y={Y + (hour ? 40 : 30)} text-anchor="middle" font-size={hour ? 24 : 17} fill={hour ? '#4a2d5e' : '#8f7aa6'}>{lab}</text>}
          </g>
        );
      })}
      {(phase === 'ask' || aim) && (
        <g class={`ck-dir ${aim ? 'hint' : ''}`}>
          <line x1={ax} y1={Y - 74} x2={ax + dir * 96} y2={Y - 74} stroke={after ? '#4dabf7' : '#ff922b'} stroke-width="7" stroke-linecap="round" stroke-dasharray="2 12" />
          <path d={`M${ax + dir * 118} ${Y - 74} l${-dir * 20} -12 v24 Z`} fill={after ? '#4dabf7' : '#ff922b'} />
          <text x={ax + dir * 60} y={Y - 86} text-anchor="middle" font-size="22" fill={after ? '#1971c2' : '#d9480f'}>{d}분 {after ? '후' : '전'}</text>
        </g>
      )}
      {phase !== 'ask' && steps.map((st, i) => (i < stepIdx || phase === 'done' ? hop(st.from, st.to, st.hop, true, i) : i === stepIdx ? hop(st.from, tNow, st.hop, false, i) : null))}
      {flag(s, '시작', '#f06595', hm(s))}
      {phase === 'done' ? flag(e, '도착', '#37b24d', hm(e)) : phase === 'anim' && <circle cx={x(tNow)} cy={Y} r="9" fill={after ? '#4dabf7' : '#ff922b'} stroke="#fff" stroke-width="3" />}
    </svg>
  );
}
export function ShiftView({ task, tag, onJudge, onNext }: TaskProps<ShiftTask>) {
  const [pick, setPick] = useState<number | null>(null);
  const [phase, setPhase] = useState<'ask' | 'anim' | 'done'>('ask');
  const [tNow, setTNow] = useState(task.start);
  const [stepIdx, setStepIdx] = useState(-1);
  const [aim, setAim] = useState(false);                     // 풀이 ②: 긴 바늘이 움직일 방향을 화살표로 미리 보여 주는 중
  const [atHour, setAtHour] = useState(false);               // 풀이 ③: 정각을 지나는 순간 — 다음 '시'로 넘어간 짧은 바늘을 강조
  const [hintOn, setHintOn] = useState(false);
  const alive = useRef(true);
  const timer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const steps = useMemo(() => shiftSteps(task), [task]);
  useEffect(() => () => { alive.current = false; clearTimeout(timer.current); }, []);
  const end = task.start + task.delta, after = task.delta > 0, d = Math.abs(task.delta);
  const L = (t: number) => (task.ampm ? hmAP(t) : hm(t));
  const chosen = pick !== null ? task.opts[pick] : null;
  /** 시계로 확인하기: 바늘이 실제로 움직이며 풀이를 보여 준다 → 고른 답 채점
   *  ① 시작 시각(시계에 표시돼 있음) → ② 긴 바늘이 움직일 방향을 화살표로 → ③ 60분이 되면 '시'가 넘어가는 모습(정각에서 멈춤) → ④ 도착 시각 강조 */
  const run = async () => {
    if (phase !== 'ask' || pick === null) return;
    sfx.tap();
    setPhase('anim'); setHintOn(false);
    setAim(true);
    await wait(1700);
    if (!alive.current) return;
    setAim(false);
    for (let i = 0; i < steps.length && alive.current; i++) {
      setStepIdx(i); setAtHour(false);
      sfx.whoosh();
      await tween(steps[i].from, steps[i].to, Math.max(1000, Math.min(2600, Math.abs(steps[i].to - steps[i].from) * 60)), alive, setTNow);
      if (!alive.current) return;
      setTNow(steps[i].to);
      if (task.cross && mod(steps[i].to, 60) === 0) { setAtHour(true); sfx.sparkle(); } else sfx.stroke();
      await wait(i < steps.length - 1 ? 1500 : 700);
    }
    if (!alive.current) return;
    setAtHour(false);
    setPhase('done');
    const ok = !!task.opts[pick].ok;
    onJudge(ok);
    if (ok) { celebrate(box.current); timer.current = window.setTimeout(onNext, 3200); } else sfx.boing();
  };
  const aimText = after ? `'후'는 시계 방향! 긴 바늘이 앞으로 ${d}분 가요.` : `'전'은 시계 반대 방향! 긴 바늘이 뒤로 ${d}분 가요.`;
  const caption = phase !== 'anim' ? '' : aim ? aimText : stepIdx >= 0 ? steps[stepIdx].text : '';
  const arc = aim ? { from: task.start, to: task.start + (after ? 1 : -1) * Math.min(d, 12) } : phase !== 'ask' ? { from: task.start, to: tNow } : null;
  return (
    <div class="ck-task ck-shift" data-ck-task="shift" data-kind={task.kind} data-ans={L(end)} data-phase={phase} data-aim={aim ? '1' : undefined}>
      <QBar q={task.q} tag={tag}>
        <TimeText t={task.start} ampm={task.ampm} />에서 <b class={after ? 'ck-fwd' : 'ck-back'}>{d}분 {after ? '후' : '전'}</b>{after ? '는' : '은'} 몇 시 몇 분일까요?
      </QBar>
      <div class="ck-body ck-shift-body">
        <div class="ck-shift-top">
          <div class="ck-clockbox small" ref={box}>
            <ClockFace t={tNow} size={350} quiet={phase === 'anim'} arc={arc} arcHint={aim} glow={phase === 'anim' ? (atHour ? 'h' : 'm') : null} />
          </div>
          <div class="ck-side">
            <div class="ck-opts">
              {task.opts.map((o, i) => {
                const cls = phase === 'done' ? (o.ok ? 'ok' : i === pick ? 'no' : 'dim') : i === pick ? 'sel' : '';
                return <button class={`ck-opt ${cls}`} data-opt={o.label} data-ok={o.ok ? '1' : undefined} onClick={() => { if (phase !== 'ask') return; sfx.tap(); setPick(i); }}>{o.label}</button>;
              })}
            </div>
            {phase === 'ask' && (
              <div class="ck-shift-btns">
                <button class={`btn sky ck-verify ${pick !== null ? 'pulse' : 'wait'}`} data-ck-verify="1" disabled={pick === null} onClick={run}>🕒 시계로 확인하기</button>
                <button class="ck-hintbtn" data-ck-hint="1" onClick={() => { sfx.tap(); setHintOn(true); }}>💡 힌트</button>
              </div>
            )}
            {phase === 'ask' && pick === null && !hintOn && <div class="ck-note">먼저 답을 고른 다음, 시계로 확인해요</div>}
            {phase === 'ask' && hintOn && <Bubble tone="hint" text={shiftHint(task)} />}
            {phase === 'anim' && caption && <Bubble tone="info" text={caption} />}
            {phase === 'done' && (
              <div class="ck-arrive" data-arrive={L(end)}>
                <span class="ck-arrive-cap">🏁 도착</span>
                <TimeText t={end} ampm={task.ampm} big />
                {task.ampm && <span class="ck-arrive-24" data-h24={h24(end)}>24시간 표기 {h24(end)}</span>}
              </div>
            )}
            {phase === 'done' && (
              <div class="ck-foot">
                {chosen?.ok ? <Bubble tone="good" text={`정답! ${shiftExplain(task)}`} /> : <Bubble tone="show" text={chosen?.why || shiftExplain(task)} />}
                <NextBtn onNext={onNext} />
              </div>
            )}
          </div>
        </div>
        <Timeline task={task} tNow={tNow} stepIdx={stepIdx} phase={phase} aim={aim} />
      </div>
    </div>
  );
}

// ---------------- 하루와 여러 날 ----------------
/** 24시간 막대: 오전 12칸(노랑) + 오후 12칸(남색) — lit칸까지 켜짐 */
function DayBar({ lit = 24, small }: { lit?: number; small?: boolean }) {
  return (
    <div class={`ck-daybar ${small ? 'small' : ''}`} data-lit={lit}>
      {Array.from({ length: 24 }, (_x, i) => <i class={`${i < 12 ? 'am' : 'pm'} ${i < lit ? 'on' : ''}`} />)}
    </div>
  );
}
/** 달력 카드 n장(+ 남는 시간 카드) — sums: 카드 아래에 24, 48, 72 … (shown장까지 보임, 나머지는 '?') */
function DayCards({ n, h, sums, shown, total }: { n: number; h: number; sums: boolean; shown: number; total?: number }) {
  const acc = daySums(n);
  return (
    <div class={`ck-days n${Math.min(8, n + (h ? 1 : 0))}`} data-days={n} data-hours={h}>
      {acc.map((v, i) => (
        <div class="ck-daycard" data-daycard={i + 1}>
          <div class="ck-daycard-top">{i + 1}일째</div>
          <div class="ck-daycard-ic">🌞🌙</div>
          <DayBar small />
          <div class="ck-daycard-cap">24시간</div>
          {sums && <div class={`ck-sum ${i < shown ? 'on' : ''}`} data-sum={i < shown ? v : '?'}>{i < shown ? v : '?'}</div>}
        </div>
      ))}
      {h > 0 && (
        <div class="ck-daycard more" data-daycard="h">
          <div class="ck-daycard-top">더하기</div>
          <div class="ck-daycard-ic">⏰</div>
          <DayBar small lit={h} />
          <div class="ck-daycard-cap">{h}시간</div>
          {sums && <div class={`ck-sum ${shown > n ? 'on' : ''}`} data-sum={shown > n ? total : '?'}>{shown > n ? total : '?'}</div>}
        </div>
      )}
    </div>
  );
}
export function DayView({ task, tag, onJudge, onNext, onIntro }: TaskProps<DayTask> & { onIntro?: () => void }) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [status, setStatus] = useState<'ask' | 'right' | 'show'>('ask');
  const [why, setWhy] = useState('');
  const [nth, setNth] = useState(0);
  const [shown, setShown] = useState(0);                     // 아래 합계를 몇 장째까지 보여 주나
  const [spin, setSpin] = useState(0);                       // '몇 바퀴' 문제: 짧은 바늘이 도는 풀이(시)
  const judged = useRef(false);
  const alive = useRef(true);
  const timer = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => () => { alive.current = false; clearTimeout(timer.current); }, []);
  const hint = nth > 0 ? dayHint(task, nth) : null;
  const cards = task.form === 'days' || task.form === 'mix' || task.form === 'toDays' || task.form === 'toMix';
  const reverse = task.form === 'toDays' || task.form === 'toMix';
  const showCards = cards && (!reverse || status !== 'ask' || nth >= 2);   // 거꾸로 묻는 문제는 힌트·풀이 때에만 카드
  const steps = task.n + (task.h ? 1 : 0);
  const eqOn = task.eq || !!hint?.eq || status !== 'ask';
  const sumsOn = !!hint?.sums || status !== 'ask';
  /** 풀이: 24, 48, 72 … 를 하나씩 세어 보여 준다 */
  const count = async (from: number) => {
    for (let i = from + 1; i <= steps && alive.current; i++) { await wait(520); if (!alive.current) return; setShown(i); sfx.stroke(); }
  };
  const turn = async () => { await tween(0, 24, 3600, alive, setSpin); };
  const finish = (ok: boolean) => {
    setStatus(ok ? 'right' : 'show'); setWhy('');
    if (cards) void count(shown);
    if (task.form === 'turns' || task.form === 'day') void turn();
  };
  const pick = (o: CkOpt) => {
    if (status !== 'ask' || wrong.includes(o.label)) return;
    if (o.ok) {
      const first = !judged.current;
      if (first) { judged.current = true; onJudge(true); }
      finish(true);
      celebrate(box.current);
      if (first) timer.current = window.setTimeout(onNext, 2600);
      return;
    }
    if (!judged.current) { judged.current = true; onJudge(false); }
    sfx.boing();
    const n = nth + 1;
    setWrong(w => [...w, o.label]);
    if (n >= 2) { setNth(n); finish(false); return; }
    setNth(n); setWhy(o.why ?? '');
    if (dayHint(task, n).sums && cards) setShown(Math.max(0, steps - 1));
  };
  useEffect(() => { if (hint?.sums && status === 'ask' && cards) setShown(s => Math.max(s, steps - 1)); }, [nth]);
  const ans = task.opts.find(o => o.ok)!.label;
  const eq = task.form === 'days' ? `${Array(task.n).fill(24).join(' + ')} = ${status === 'ask' ? '?' : task.total}`
    : task.form === 'mix' ? `${[...Array(task.n).fill(24), task.h].join(' + ')} = ${status === 'ask' ? '?' : task.total}` : '';
  return (
    <div class="ck-task ck-day" data-ck-task="day" data-kind={task.kind} data-form={task.form} data-ans={ans} data-status={status}>
      <QBar q={task.q} tag={tag} />
      <div class="ck-body ck-day-body" ref={box}>
        <div class="ck-day-vis">
          {(task.form === 'day' || task.form === 'turns') && (
            <div class="ck-oneday">
              <ClockFace t={spin * 60} size={250} quiet hourOnly glow={status !== 'ask' ? 'h' : null} />
              <div class="ck-oneday-bar">
                <div class="ck-oneday-lab"><span class="am">오전 🌞</span><span class="pm">오후 🌙</span></div>
                <DayBar lit={status === 'ask' ? (nth ? 24 : 0) : Math.round(spin)} />
                <div class="ck-oneday-num"><span>0시</span><span>낮 12시</span><span>24시</span></div>
              </div>
            </div>
          )}
          {reverse && <div class="ck-total" data-total={task.total}><b>{task.total}</b>시간 <span>= 하루 24시간씩 묶으면?</span></div>}
          {showCards && <DayCards n={task.n} h={task.h} sums={sumsOn} shown={shown} total={task.total} />}
          {eqOn && eq && <div class="ck-eq" data-eq={eq}>{eq}{status !== 'ask' && task.form === 'days' && <span class="ck-eq-x"> · 24 × {task.n} = {task.total}</span>}</div>}
        </div>
        <div class="ck-day-opts">
          {task.opts.map(o => {
            const cls = status !== 'ask' ? (o.ok ? 'ok' : 'dim') : wrong.includes(o.label) ? 'no' : '';
            return <button class={`ck-opt ${cls}`} data-opt={o.label} data-ok={o.ok ? '1' : undefined} onClick={() => pick(o)}>{o.label}</button>;
          })}
        </div>
        <div class="ck-day-foot">
          {status === 'ask' && hint && <Bubble tone="hint" text={why || hint.text} />}
          {status === 'right' && <Bubble tone="good" text={`정답! ${dayExplain(task)}`} />}
          {status === 'show' && <Bubble tone="show" text={`정답은 ${ans}. ${dayExplain(task)}`} />}
          {status !== 'ask' && <NextBtn onNext={onNext} />}
          {status === 'ask' && !hint && onIntro && <button class="ck-hintbtn" data-ck-dayintro="1" onClick={() => { sfx.tap(); onIntro(); }}>🌞🌙 하루 다시 보기</button>}
        </div>
      </div>
    </div>
  );
}

// ---------------- 하루는 24시간 (해와 달이 바뀌는 장면) ----------------
const SKY: [number, [number, number, number]][] = [[0, [27, 38, 89]], [4.5, [45, 58, 120]], [6.5, [255, 183, 150]], [9, [143, 211, 255]], [15, [143, 211, 255]], [17.5, [255, 170, 120]], [19.5, [58, 60, 125]], [24, [27, 38, 89]]];
function skyColor(p: number): string {
  for (let i = 1; i < SKY.length; i++) {
    if (p <= SKY[i][0]) {
      const [p0, c0] = SKY[i - 1], [p1, c1] = SKY[i];
      const f = (p - p0) / (p1 - p0);
      return `rgb(${c0.map((v, k) => Math.round(v + (c1[k] - v) * f)).join(',')})`;
    }
  }
  return 'rgb(27,38,89)';
}
/** 장면마다: 시(0~24)의 어디부터 어디까지 · 걸리는 시간(ms) */
const DAY_SCENES: [number, number, number][] = [[0, 6, 3600], [6, 12, 4600], [12, 24, 6200], [24, 24, 3800]];
export function DayIntro({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  const [scene, setScene] = useState(0);
  const [ended, setEnded] = useState(false);
  const [runId, setRunId] = useState(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const me = { current: true };
    setEnded(false);
    (async () => {
      for (let i = 0; i < DAY_SCENES.length && me.current && alive.current; i++) {
        const [a, b, ms] = DAY_SCENES[i];
        setScene(i);
        const talk = say(CLOCK_DAY[i]);
        await Promise.all([tween(a, b, ms, me, setP), Promise.race([talk, wait(ms + 5000)])]);
        if (!me.current) return;
        await wait(350);
      }
      if (me.current && alive.current) { setEnded(true); sfx.sparkle(); }
    })();
    return () => { me.current = false; };
  }, [runId]);
  const W = 640, HH = 250;
  const arc = (f: number): [number, number] => [40 + f * (W - 80), HH - 20 - Math.sin(Math.PI * f) * (HH - 70)];
  const sunF = (p - 6) / 12, moonF = (mod(p + 6, 24)) / 12;
  const night = p < 5 || p > 19.5 ? 1 : p < 7 ? (7 - p) / 2 : p > 17.5 ? (p - 17.5) / 2 : 0;
  const hour = Math.min(24, Math.floor(p + 0.0001));
  const label = hour === 0 || hour === 24 ? '밤 12시' : hour === 12 ? '낮 12시' : hour < 12 ? `오전 ${hour}시` : `오후 ${hour - 12}시`;
  return (
    <div class="ck-task ck-dayintro" data-ck-task="dayintro" data-scene={scene} data-ended={ended ? '1' : undefined}>
      <div class="ck-q"><Spk text={CLOCK_DAY[scene]} line /><div class="ck-q-text">하루는 몇 시간일까요? 해와 달을 따라가 봐요.</div></div>
      <div class="ck-body ck-dayintro-body">
        <div class="ck-sky" style={{ background: `linear-gradient(${skyColor(p)}, ${skyColor(Math.max(0, p - 1.5))} 120%)` }}>
          <div class="ck-sky-stars" style={{ opacity: night }}>{Array.from({ length: 18 }, (_x, i) => <i style={{ left: `${(i * 53 + 7) % 100}%`, top: `${(i * 37 + 5) % 62}%` }} />)}</div>
          {sunF > -0.06 && sunF < 1.06 && <div class="ck-sun" style={{ left: arc(sunF)[0], top: arc(sunF)[1] }}>🌞</div>}
          {moonF > -0.06 && moonF < 1.06 && <div class="ck-moon" style={{ left: arc(moonF)[0], top: arc(moonF)[1] }}>🌙</div>}
          <div class="ck-sky-ground" />
          <div class="ck-sky-time" data-hour={hour}>{label} <small>({hour}시)</small></div>
        </div>
        <div class="ck-dayintro-clock">
          <ClockFace t={p * 60} size={236} quiet hourOnly glow="h" />
          <div class="ck-turns">짧은 바늘 <b>{p >= 24 ? 2 : p >= 12 ? 1 : 0}</b>바퀴</div>
        </div>
        <div class="ck-oneday-bar wide">
          <div class="ck-oneday-lab"><span class="am">오전 🌞 12시간</span><span class="pm">오후 🌙 12시간</span></div>
          <DayBar lit={Math.floor(p + 0.0001)} />
          <div class="ck-oneday-num"><span>0시</span><span>6시</span><span>낮 12시</span><span>18시</span><span>24시</span></div>
        </div>
        <div class="ck-dayintro-foot">
          <Bubble tone="info" text={CLOCK_DAY[scene]} line>{ended && <b class="ck-eq-inline"> 12 + 12 = 24</b>}</Bubble>
          <div class="ck-dayintro-btns">
            {ended && <button class="ck-hintbtn" data-ck-replay="1" onClick={() => { sfx.tap(); setP(0); setRunId(x => x + 1); }}>↺ 다시 보기</button>}
            <button class={`btn ${ended ? 'mint pulse' : 'violet small'} ck-next`} data-ck-next="1" onClick={() => { sfx.tap(); onDone(); }}>{ended ? '문제 풀기 ▶' : '건너뛰기 ▶'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- 시계 바늘 알아보기 ----------------
const HANDS2: Hand[] = ['h', 'm'], HANDS3: Hand[] = ['h', 'm', 's'];
/** 짝 맞추기 판: [시각(분), 초침 위치(초)] — 바늘끼리 멀리 떨어진 모양 */
const MATCH_BOARDS: [number, number][] = [[610, 30], [165, 20]];
const handDeg = (h: Hand, t: number, sec: number) => (h === 'h' ? mod(t, 720) * 0.5 : h === 'm' ? mod(t, 60) * 6 : mod(sec, 60) * 6);
export function HandsIntro({ onDone }: { onDone: () => void }) {
  const [part, setPart] = useState<'look' | 'match'>('look');
  const [seen, setSeen] = useState<Hand[]>([]);
  const [cur, setCur] = useState<Hand | null>(null);         // 방금 누른 바늘
  const [secOn, setSecOn] = useState(false);                 // 초침(심화)
  const [sec, setSec] = useState(30);
  const [board, setBoard] = useState(0);
  const [matched, setMatched] = useState<Hand[]>([]);
  const [sel, setSel] = useState<Hand | null>(null);         // 눌러서 고른 카드 (끌기 대신 눌러서도 됨)
  const [miss, setMiss] = useState<Hand | null>(null);
  const [dragAt, setDragAt] = useState<{ h: Hand; dx: number; dy: number } | null>(null);
  const [hover, setHover] = useState<Hand | null>(null);     // 끌고 있는 카드 아래의 바늘 (놓으면 여기에 붙음 — 카드에 가려도 보이게 강조)
  const clock = useRef<HTMLDivElement>(null);
  const grab = useRef<{ h: Hand; x: number; y: number; moved: boolean } | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  // 초침은 1초에 한 칸씩 (알아보는 동안만)
  useEffect(() => {
    if (!secOn || part !== 'look') return;
    const t = setInterval(() => setSec(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [secOn, part]);
  const hands = secOn ? HANDS3 : HANDS2;
  const tap = (h: Hand) => {
    sfx.tap();
    setCur(h);
    if (!seen.includes(h)) setSeen(s => [...s, h]);
    void (async () => { await say(CLOCK_HAND[h]); })();
  };
  const ready = seen.includes('h') && seen.includes('m');
  // ---- 짝 맞추기 ----
  const [bt, bs] = MATCH_BOARDS[board];
  const order = useMemo(() => (board === 0 ? ['m', 's', 'h'] : ['s', 'h', 'm']).filter(h => hands.includes(h as Hand)) as Hand[], [board, secOn]);
  const tryMatch = (card: Hand, onHand: Hand | null) => {
    setSel(null);
    if (!onHand) return;
    if (onHand !== card) { sfx.boing(); setMiss(card); return; }
    sfx.ding(); setMiss(null);
    const [x, y] = centerOf(clock.current);
    burst(x, y, 'star');
    const next = [...matched, card];
    setMatched(next);
    if (next.length < hands.length) return;
    timer.current = window.setTimeout(() => {
      if (board + 1 < MATCH_BOARDS.length) { setBoard(board + 1); setMatched([]); setMiss(null); }
      else onDone();
    }, 1300);
  };
  /** 놓은 곳에서 가장 가까운 바늘 (시계 밖이면 null) */
  const handAt = (cx: number, cy: number): Hand | null => {
    const svg = clock.current?.querySelector('svg');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
    const rad = Math.hypot(dx, dy) / (r.width / 2);
    if (rad > 0.8) return null;
    const ang = mod(Math.atan2(dx, -dy) * 180 / Math.PI, 360);
    let best: Hand | null = null, bd = 999;
    for (const h of hands) {
      const d0 = Math.abs(mod(ang - handDeg(h, bt, bs), 360)), d = d0 > 180 ? 360 - d0 : d0;
      if (d < bd) { bd = d; best = h; }
    }
    return bd <= 40 ? best : null;
  };
  const cardDown = (h: Hand) => (e: PointerEvent) => {
    if (matched.includes(h)) return;
    grab.current = { h, x: e.clientX, y: e.clientY, moved: false };
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  };
  const cardMove = (e: PointerEvent) => {
    const g = grab.current; if (!g) return;
    const sc = stageInfo().scale || 1;
    const dx = (e.clientX - g.x) / sc, dy = (e.clientY - g.y) / sc;
    if (!g.moved && Math.hypot(dx, dy) > 8) g.moved = true;
    if (g.moved) { setDragAt({ h: g.h, dx, dy }); setHover(handAt(e.clientX, e.clientY)); }
  };
  const cardUp = (e: PointerEvent) => {
    const g = grab.current; if (!g) return;
    grab.current = null; setDragAt(null); setHover(null);
    if (!g.moved) { sfx.tap(); setSel(s => (s === g.h ? null : g.h)); setMiss(null); return; }
    tryMatch(g.h, handAt(e.clientX, e.clientY));
  };
  if (part === 'look') {
    return (
      <div class="ck-task ck-hands" data-ck-task="hands" data-part="look" data-seen={seen.join('')}>
        <div class="ck-q"><Spk text={CLOCK_TAP_ASK} line /><div class="ck-q-text">{CLOCK_TAP_ASK} 바늘마다 하는 일이 달라요.</div></div>
        <div class="ck-body">
          <div class="ck-clockbox wide">
            <ClockFace t={610} size={580} pad={96} sec={secOn ? sec : null} tags={hands} glow={cur === 's' ? 's' : cur} onTap={tap} />
          </div>
          <div class="ck-side">
            {hands.map(h => (
              <button class={`ck-handcard ${seen.includes(h) ? 'open' : ''} ${cur === h ? 'cur' : ''}`} style={{ borderColor: HAND_COLOR[h] }} data-handcard={h} onClick={() => tap(h)}>
                <span class="ck-handcard-dot" style={{ background: HAND_COLOR[h] }} />
                <span class="ck-handcard-name" style={{ color: HAND_COLOR[h] }}>{HAND_NAME[h]}</span>
                <span class="ck-handcard-say">{seen.includes(h) ? <>{CLOCK_HAND[h]}<small>{CLOCK_HAND_MORE[h]}</small></> : '눌러 보세요'}</span>
              </button>
            ))}
            {!secOn && <button class="ck-hintbtn" data-ck-sec="1" onClick={() => { sfx.tap(); setSecOn(true); }}>⏱ 초침도 알아볼래요 (심화)</button>}
            {ready && <button class="btn mint pulse ck-next" data-ck-next="1" onClick={() => { sfx.tap(); setPart('match'); setCur(null); }}>짝 맞추기 놀이 ▶</button>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div class="ck-task ck-hands" data-ck-task="hands" data-part="match" data-board={board} data-matched={matched.join('')}>
      <div class="ck-q"><Spk text={CLOCK_MATCH_ASK} line /><div class="ck-q-text">{CLOCK_MATCH_ASK}</div><span class="ck-tagchip">{board + 1} / {MATCH_BOARDS.length}</span></div>
      <div class="ck-body">
        <div class="ck-clockbox wide" ref={clock}>
          <ClockFace key={board} t={bt} size={580} pad={96} sec={secOn ? bs : null} tags={matched} glow={hover ?? (sel ? 'both' : null)} onTap={(h) => { if (sel) tryMatch(sel, h); }} />
        </div>
        <div class="ck-side">
          {order.map(h => {
            const done = matched.includes(h), drag = dragAt?.h === h;
            return (
              <div class={`ck-matchcard ${done ? 'done' : ''} ${sel === h ? 'sel' : ''} ${drag ? 'drag' : ''}`} data-matchcard={h} data-done={done ? '1' : undefined}
                style={{ transform: drag ? `translate(${dragAt!.dx}px, ${dragAt!.dy}px) scale(1.06)` : undefined, borderColor: done ? HAND_COLOR[h] : undefined }}
                onPointerDown={cardDown(h)} onPointerMove={cardMove} onPointerUp={cardUp} onPointerCancel={() => { grab.current = null; setDragAt(null); setHover(null); }}>
                <span class="ck-matchcard-t"><b>'{HAND_UNIT[h]}'</b>{h === 'm' ? '을' : '를'} 알려줘요</span>
                <span class="ck-matchcard-s" style={{ color: done ? HAND_COLOR[h] : undefined }}>{done ? `✓ ${HAND_NAME[h]}` : '✋ 끌어서 바늘에 놓기'}</span>
              </div>
            );
          })}
          {miss && <Bubble tone="hint" text={CLOCK_MATCH_MISS[miss]} line />}
          {!miss && matched.length === hands.length && <Bubble tone="good" text={CLOCK_MATCH_OK} line />}
          {!miss && sel && matched.length < hands.length && <div class="ck-note">이제 알맞은 바늘을 눌러요</div>}
        </div>
      </div>
    </div>
  );
}
