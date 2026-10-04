// 획 데이터로 그리는 '글자 친구' (얼굴 달린 글자)
import { JAMO, strokesOf, faceAnchor, type Stroke } from '../data/jamo';
import { decompose } from '../lib/hangul';

export function pathOf(s: Stroke) {
  return s.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
}

export function strokeLen(s: Stroke) {
  let l = 0;
  for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
  return l;
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

interface Props {
  ch: string;
  size?: number;
  color?: string;
  face?: boolean;
  draw?: boolean;        // 한 획씩 그려지는 애니메이션
  shown?: number;        // 보여줄 획 수 (나머지는 숨김)
  width?: number;        // 획 굵기 (0~100 좌표 기준)
  mood?: 'happy' | 'wow' | 'sleep';
  class?: string;
  onClick?: () => void;
  hi?: string[];         // 음절 속에서 강조할 자모 (숨은 글자 찾기)
}

// 겹모음·쌍자음 속에 들어 있는 자모
export const PARTS: Record<string, string[]> = {
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ', 'ㅏ'], 'ㅚ': ['ㅗ', 'ㅣ'], 'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ', 'ㅓ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'],
  'ㅐ': ['ㅏ'], 'ㅔ': ['ㅓ'], 'ㅒ': ['ㅑ'], 'ㅖ': ['ㅕ'],
  'ㄲ': ['ㄱ'], 'ㄸ': ['ㄷ'], 'ㅃ': ['ㅂ'], 'ㅆ': ['ㅅ'], 'ㅉ': ['ㅈ'],
};

/** 음절의 획마다 어느 자모인지 */
function strokeOwners(ch: string): string[] {
  const p = decompose(ch);
  if (!p) return strokesOf(ch).map(() => ch);
  const out: string[] = [];
  const add = (j: string) => { const n = JAMO[j]?.strokes.length ?? 0; for (let i = 0; i < n; i++) out.push(j); };
  add(p.cho); add(p.jung); if (p.jong) add(p.jong);
  return out;
}

export function LetterGlyph({ ch, size = 200, color, face = true, draw = false, shown, width, mood = 'happy', class: cls = '', onClick, hi }: Props) {
  const strokes = strokesOf(ch);
  const owners = hi ? strokeOwners(ch) : null;
  const isHi = (i: number) => !!owners && hi!.some(t => owners[i] === t || (PARTS[owners[i]] ?? []).includes(t));
  const c = color ?? JAMO[ch]?.color ?? '#ff7eb6';
  const w = width ?? (strokes.length > 6 ? 9 : 13);
  const dark = shade(c, -0.28);
  const light = shade(c, 0.55);
  const n = shown ?? strokes.length;
  const [fx, fy] = faceAnchor(ch);
  const faceScale = w >= 12 ? 1.45 : 1.1;
  let delay = 0;
  const timings = strokes.map(s => { const d = Math.max(0.35, strokeLen(s) / 110); const t = { delay, dur: d }; delay += d + 0.15; return t; });
  const faceDelay = draw ? delay : 0;
  return (
    <svg class={`glyph ${cls}`} viewBox="-6 -6 112 112" width={size} height={size} onClick={onClick} style="overflow:visible">
      {/* 그림자 */}
      <g transform="translate(0 3.5)" opacity=".18">
        {strokes.slice(0, n).map((s, i) => <path d={pathOf(s)} stroke="#2b1a3a" stroke-width={w + 5} fill="none" stroke-linecap="round" stroke-linejoin="round"
          style={draw ? anim(s, timings[i]) : undefined} pathLength={draw ? 1 : undefined} />)}
      </g>
      {strokes.slice(0, n).map((s, i) => {
        const cc = owners ? (isHi(i) ? '#ff5c93' : '#c9bdd8') : c;
        const dk = owners ? shade(cc, -0.28) : dark, lt = owners ? shade(cc, 0.55) : light;
        return (
          <g>
            <path d={pathOf(s)} stroke={dk} stroke-width={w + 5} fill="none" stroke-linecap="round" stroke-linejoin="round" style={draw ? anim(s, timings[i]) : undefined} pathLength={draw ? 1 : undefined} />
            <path d={pathOf(s)} stroke={cc} stroke-width={w} fill="none" stroke-linecap="round" stroke-linejoin="round" style={draw ? anim(s, timings[i]) : undefined} pathLength={draw ? 1 : undefined} />
            <path d={pathOf(s)} transform={`translate(${-w * 0.14} ${-w * 0.16})`} stroke={lt} stroke-width={w * 0.28} fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".85" style={draw ? anim(s, timings[i]) : undefined} pathLength={draw ? 1 : undefined} />
          </g>
        );
      })}
      {face && n >= strokes.length && (
        <g transform={`translate(${fx} ${fy}) scale(${faceScale}) translate(${-fx} ${-fy})`}><g class={`glyph-face ${draw ? 'pop-late' : ''}`} style={{ animationDelay: `${faceDelay}s`, transformOrigin: `${fx}px ${fy}px` }}>
          {mood === 'sleep' ? (
            <g stroke="#2b1a3a" stroke-width="1.6" fill="none" stroke-linecap="round"><path d={`M${fx - 7} ${fy - 1} q2.5 2 5 0`} /><path d={`M${fx + 2} ${fy - 1} q2.5 2 5 0`} /></g>
          ) : (
            <g class="glyph-eyes" style={{ transformOrigin: `${fx}px ${fy - 1}px` }}>
              <ellipse cx={fx - 4.6} cy={fy - 1.2} rx="2.6" ry={mood === 'wow' ? 3.6 : 3.1} fill="#2b1a3a" />
              <ellipse cx={fx + 4.6} cy={fy - 1.2} rx="2.6" ry={mood === 'wow' ? 3.6 : 3.1} fill="#2b1a3a" />
              <circle cx={fx - 5.4} cy={fy - 2.6} r="1.05" fill="#fff" />
              <circle cx={fx + 3.8} cy={fy - 2.6} r="1.05" fill="#fff" />
            </g>
          )}
          <ellipse cx={fx - 8.6} cy={fy + 2.4} rx="2.2" ry="1.3" fill="#ff5c93" opacity=".5" />
          <ellipse cx={fx + 8.6} cy={fy + 2.4} rx="2.2" ry="1.3" fill="#ff5c93" opacity=".5" />
          {mood === 'wow'
            ? <ellipse cx={fx} cy={fy + 3.2} rx="1.6" ry="1.9" fill="#2b1a3a" />
            : <path d={`M${fx - 2.2} ${fy + 2} q2.2 2.6 4.4 0`} stroke="#2b1a3a" stroke-width="1.3" fill="none" stroke-linecap="round" />}
        </g></g>
      )}
    </svg>
  );
}

function anim(_s: Stroke, t: { delay: number; dur: number }) {
  return { strokeDasharray: 1, strokeDashoffset: 1, animation: `drawStroke ${t.dur}s ease-in-out ${t.delay}s forwards` } as any;
}

/** 전체 그리기 시간(초) */
export function drawDuration(ch: string) {
  return strokesOf(ch).reduce((a, s) => a + Math.max(0.35, strokeLen(s) / 110) + 0.15, 0);
}
