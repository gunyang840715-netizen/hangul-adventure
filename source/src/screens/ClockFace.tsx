// 움직이는 아날로그 시계 (11-13 '시계와 시간' — 수학·맞춤법 모드)
// - 짧은 바늘(시·분홍) · 긴 바늘(분·파랑) · 초침(초·노랑)을 색으로 구분
// - 바늘을 끌 수 있다: 긴 바늘을 돌리면 짧은 바늘도 조금씩 따라가고(12를 지나면 '시'가 바뀜), 짧은 바늘을 끌면 '분'은 그대로 두고 '시'만 바뀐다
// - 도움 숫자(바깥의 5·10·15 … 건너뛰기 숫자) · 바늘 이름표 · 긴 바늘이 지나간 길(화살표) · 바늘 강조
// 좌표는 시계 가운데가 (0,0) — 바늘은 CSS 회전(전환 효과)으로 돌린다
import { useRef, useState } from 'preact/hooks';
import { mod } from '../math/clockData';

export type Hand = 'h' | 'm' | 's';
export const HAND_NAME: Record<Hand, string> = { h: '짧은 바늘', m: '긴 바늘', s: '초침' };
export const HAND_UNIT: Record<Hand, string> = { h: '시', m: '분', s: '초' };
export const HAND_COLOR: Record<Hand, string> = { h: '#f06595', m: '#339af0', s: '#f59f00' };
const LEN: Record<Hand, number> = { h: 92, m: 150, s: 162 };

export interface ClockArc { from: number; to: number }      // 긴 바늘이 지나간 길 (분 — 이어지는 값, to < from이면 거꾸로)
export interface ClockFaceProps {
  t: number;                        // 시각(분, 소수·넘어간 값도 됨)
  size?: number;                    // 화면 크기(px) — 바깥 여백까지
  sec?: number | null;              // 초침(초, 이어지는 값). 없으면 초침을 안 그림
  drag?: boolean;                   // 바늘을 끌 수 있나
  snap?: number;                    // 놓을 때 맞출 분 단위
  onDrag?: (t: number) => void;     // 끄는 동안 (0~720 사이 값)
  onDrop?: (t: number) => void;     // 놓았을 때 (snap에 맞춘 값)
  onTap?: (h: Hand) => void;        // 바늘을 눌렀을 때
  glow?: Hand | 'both' | null;      // 강조할 바늘
  ring?: boolean;                   // 바깥의 5분 건너뛰기 숫자
  tags?: Hand[];                    // 이름표를 붙일 바늘
  arc?: ClockArc | null;
  arcHint?: boolean;                // 지나간 길 대신 '이쪽으로 움직여요' 미리 보기 화살표(깜빡임)
  quiet?: boolean;                  // 전환 효과 없이 (풀이 애니메이션이 직접 움직일 때)
  hourOnly?: boolean;               // 짧은 바늘만 (하루 동안 짧은 바늘이 두 바퀴 도는 장면 — 긴 바늘은 너무 빨리 돌아서 숨김)
  pad?: number;                     // 바깥 여백(시계 좌표) — 이름표를 붙일 때 넓게
}

const pol = (deg: number, r: number): [number, number] => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)];
const angDist = (a: number, b: number) => { const d = Math.abs(mod(a - b, 360)); return d > 180 ? 360 - d : d; };

export function ClockFace({ t, size = 420, sec = null, drag = false, snap = 5, onDrag, onDrop, onTap, glow = null, ring = false, tags, arc = null, arcHint = false, quiet = false, hourOnly = false, pad = 34 }: ClockFaceProps) {
  const ref = useRef<SVGSVGElement>(null);
  const grab = useRef<{ hand: Hand; lastMp: number; t: number; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<Hand | null>(null);
  const R = 200 + pad;                                       // 시계 좌표에서 그림 반쪽 크기
  const ha = t * 0.5, ma = t * 6;                            // 이어지는 각도 (전환 효과가 가까운 쪽으로 돌게)
  const hasSec = sec !== null && sec !== undefined;

  const polar = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    return { ang: mod(Math.atan2(dx, -dy) * 180 / Math.PI, 360), rad: Math.hypot(dx, dy) / (r.width / 2) * R };
  };
  /** 손가락에 가까운 바늘 (두 바늘이 겹쳐 있으면 바깥쪽은 긴 바늘, 안쪽은 짧은 바늘) */
  const nearHand = (ang: number, rad: number, withSec: boolean): Hand | null => {
    const dm = angDist(ang, ma), dh = angDist(ang, ha), ds = withSec && hasSec ? angDist(ang, (sec as number) * 6) : 999;
    if (withSec && ds < 14 && ds <= dm && ds <= dh) return 's';
    if (Math.abs(dm - dh) < 16) return rad > 104 ? 'm' : 'h';
    return dm < dh ? 'm' : 'h';
  };
  const down = (e: PointerEvent) => {
    if (!drag && !onTap) return;
    const { ang, rad } = polar(e);
    if (rad > 236) return;
    const hand = nearHand(ang, rad, !drag);
    if (!hand) return;
    // 누르기만 받는 시계(바늘 알아보기)는 바늘 가까이를 눌렀을 때만
    if (!drag) {
      const d = angDist(ang, hand === 'h' ? ha : hand === 'm' ? ma : (sec as number) * 6);
      if (d > 30 || rad > LEN[hand] + 40) return;
    }
    grab.current = { hand, lastMp: ang / 6, t: mod(t, 720), x: e.clientX, y: e.clientY, moved: false };
    try { ref.current!.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    if (drag) setDragging(hand);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 7) g.moved = true;
    if (!drag || !g.moved) return;
    const { ang } = polar(e);
    if (g.hand === 'm') {
      // 긴 바늘: 움직인 만큼 시간을 더한다 (12를 지나면 저절로 다음 '시'로)
      const mp = ang / 6;
      let d = mp - g.lastMp;
      if (d > 30) d -= 60; else if (d < -30) d += 60;
      g.lastMp = mp;
      g.t = mod(g.t + d, 720);
    } else if (g.hand === 'h') {
      // 짧은 바늘: '분'은 그대로, 손가락에 가장 가까운 '시'로
      const m = mod(g.t, 60);
      g.t = mod(Math.round(ang / 30 - m / 60), 12) * 60 + m;
    }
    onDrag?.(g.t);
  };
  const up = (e: PointerEvent) => {
    const g = grab.current;
    if (!g) return;
    grab.current = null;
    try { ref.current!.releasePointerCapture(e.pointerId); } catch { /* 무시 */ }
    setDragging(null);
    if (!g.moved) { onTap?.(g.hand); return; }
    if (drag) onDrop?.(mod(Math.round(g.t / snap) * snap, 720));
  };

  const isGlow = (h: Hand) => glow === h || (glow === 'both' && h !== 's');
  const hand = (h: Hand, deg: number, w: number, tail: number) => (
    <g class={`ck-hand ck-hand-${h} ${isGlow(h) ? 'glow' : ''} ${dragging === h ? 'held' : ''}`} style={{ transform: `rotate(${deg}deg)` }} data-hand={h} data-deg={Math.round(mod(deg, 360) * 10) / 10}>
      {isGlow(h) && <line class="ck-halo" x1="0" y1={tail} x2="0" y2={-LEN[h]} stroke-width={w + 18} />}
      <line x1="0" y1={tail} x2="0" y2={-LEN[h]} stroke={HAND_COLOR[h]} stroke-width={w} stroke-linecap="round" />
      {h !== 's' && <circle cx="0" cy={-LEN[h]} r={w / 2 + 3} fill={HAND_COLOR[h]} stroke="#fff" stroke-width="3" />}
    </g>
  );
  // 긴 바늘이 지나간 길: 숫자 안쪽의 둥근 화살표
  let arcEl = null;
  if (arc && Math.abs(arc.to - arc.from) > 0.2) {
    const a0 = arc.from * 6, a1 = arc.to * 6, back = a1 < a0, r = 112;
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 4));
    const pts = Array.from({ length: n + 1 }, (_x, i) => pol(a0 + (a1 - a0) * i / n, r));
    const [ex, ey] = pts[n];
    const dir = a1 + (back ? -90 : 90);                      // 끝점에서 나아가는 방향
    const [tx, ty] = pol(dir, 20), [nx, ny] = pol(a1, 13);
    const color = back ? '#ff922b' : '#4dabf7';
    arcEl = (
      <g class={`ck-arc ${arcHint ? 'hint' : ''}`} data-arc={back ? 'back' : 'fwd'} data-arc-hint={arcHint ? '1' : undefined}>
        <path d={'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')} fill="none" stroke={color} stroke-width="14" stroke-linecap="round" opacity=".55" />
        <path d={`M${(ex + tx).toFixed(1)} ${(ey + ty).toFixed(1)} L${(ex + nx).toFixed(1)} ${(ey + ny).toFixed(1)} L${(ex - nx).toFixed(1)} ${(ey - ny).toFixed(1)} Z`} fill={color} />
      </g>
    );
  }
  const tagEl = (h: Hand, deg: number) => {
    const [x, y] = pol(deg, 252), [lx, ly] = pol(deg, LEN[h] + 8), [ox, oy] = pol(deg, 224);
    return (
      <g class="ck-tag" data-tag={h}>
        <line x1={lx} y1={ly} x2={ox} y2={oy} stroke={HAND_COLOR[h]} stroke-width="4" stroke-dasharray="3 9" stroke-linecap="round" />
        <rect x={x - 62} y={y - 24} width="124" height="48" rx="24" fill={HAND_COLOR[h]} stroke="#fff" stroke-width="4" />
        <text x={x} y={y + 2} text-anchor="middle" dominant-baseline="middle" font-size="27" fill="#fff">{HAND_NAME[h]}</text>
      </g>
    );
  };
  return (
    <svg ref={ref} class={`ck-face ${drag ? 'can-drag' : ''} ${dragging ? 'dragging' : ''} ${quiet ? 'quiet' : ''}`} width={size} height={size} viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
      data-clock={Math.round(mod(t, 720) * 100) / 100} data-drag={drag ? '1' : undefined}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <circle r="190" fill="#fff" stroke="#ffb3d3" stroke-width="12" />
      <circle r="178" fill="#fffdf6" />
      {Array.from({ length: 60 }, (_x, i) => {
        const big = i % 5 === 0;
        const [x1, y1] = pol(i * 6, big ? 160 : 168), [x2, y2] = pol(i * 6, 177);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={big ? '#7a5b8f' : '#cdbfdb'} stroke-width={big ? 5 : 2.5} stroke-linecap="round" />;
      })}
      {Array.from({ length: 12 }, (_x, i) => {
        const n = i + 1, [x, y] = pol(n * 30, 132);
        return <text x={x} y={y + 2} text-anchor="middle" dominant-baseline="middle" font-size="44" fill="#4a2d5e">{n}</text>;
      })}
      {ring && Array.from({ length: 12 }, (_x, i) => {
        const [x, y] = pol(i * 30, 212);
        return (
          <g class="ck-ring" data-ring={i * 5}>
            <circle cx={x} cy={y} r="19" fill="#e7f5ff" stroke="#74c0fc" stroke-width="3" />
            <text x={x} y={y + 1.5} text-anchor="middle" dominant-baseline="middle" font-size="21" fill="#1971c2">{i * 5}</text>
          </g>
        );
      })}
      {arcEl}
      {hand('h', ha, 17, 16)}
      {!hourOnly && hand('m', ma, 11, 20)}
      {hasSec && hand('s', (sec as number) * 6, 4, 34)}
      <circle r="13" fill="#4a2d5e" /><circle r="5" fill="#fff" />
      {tags?.includes('h') && tagEl('h', ha)}
      {tags?.includes('m') && tagEl('m', ma)}
      {tags?.includes('s') && hasSec && tagEl('s', (sec as number) * 6)}
    </svg>
  );
}
