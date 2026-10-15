// 집 짓기 그림: 강아지 집 · 고양이 집 · 놀이터 (600x440 좌표). 지은 부분까지 그리고, 다음에 지을 부분은 흐린 그림자로
// 손그림 완성 그림(원문 H — art/builds, art_builds.py)이 있으면: 완성 그림 1장을 흐린 밑그림으로 깔고,
// 지은 부품의 영역(BUILD_MASK, 부품 순서 = data/pets.ts BUILDS)만 색을 입혀 보여 준다 — '○○을 만들었어!' 말과 그림이 맞게.
// 그림을 받기 전·못 받으면 아래 SVG 그림.
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { artSrc } from './artmap';
import { useArtReady } from './paintbg';

type Part = (name: string) => JSX.Element;

const DOG: Part[] = [
  // 바닥
  () => <g><rect x="140" y="356" width="320" height="30" rx="10" fill="#c58b52" stroke="#8f5e2c" stroke-width="5" /><path d="M200 358 v26 M260 358 v26 M320 358 v26 M380 358 v26 M440 358 v26" stroke="#8f5e2c" stroke-width="3" opacity=".5" /></g>,
  // 벽
  () => <g><rect x="180" y="196" width="240" height="164" rx="8" fill="#f4c38a" stroke="#b77b3f" stroke-width="6" /><path d="M183 236 h234 M183 276 h234 M183 316 h234" stroke="#d99a5b" stroke-width="3" opacity=".7" /></g>,
  // 지붕
  () => <g><path d="M150 214 L300 92 L450 214 Z" fill="#ff6b4a" stroke="#c9412a" stroke-width="7" stroke-linejoin="round" /><path d="M192 182 L408 182 M228 152 L372 152 M264 122 L336 122" stroke="#ffa48f" stroke-width="5" stroke-linecap="round" /><circle cx="300" cy="160" r="13" fill="#ffe8a3" stroke="#c9412a" stroke-width="4" /><path d="M293 160 l5 5 l9 -10" stroke="#c9412a" stroke-width="3" fill="none" stroke-linecap="round" /></g>,
  // 문
  () => <g><path d="M262 360 V300 a38 38 0 0 1 76 0 V360 Z" fill="#7a4520" stroke="#5a3214" stroke-width="5" /><path d="M272 360 V302 a28 28 0 0 1 56 0 V360" fill="#4a2a10" /></g>,
  // 창문
  () => <g><circle cx="382" cy="306" r="22" fill="#d0ebff" stroke="#b77b3f" stroke-width="6" /><path d="M382 284 v44 M360 306 h44" stroke="#b77b3f" stroke-width="4" /><path d="M370 296 q5 -6 12 -6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" /></g>,
  // 이름표
  (name) => <g><rect x="232" y="222" width="136" height="38" rx="10" fill="#fff4e6" stroke="#b77b3f" stroke-width="4" /><text x="300" y="250" font-size="26" text-anchor="middle" fill="#7a4520" font-family="Jua">{name}</text></g>,
  // 폭신한 방석
  () => <g><ellipse cx="196" cy="398" rx="60" ry="17" fill="#ff8fb8" stroke="#e2477f" stroke-width="4" /><ellipse cx="196" cy="393" rx="42" ry="8" fill="#ffc2d9" /></g>,
  // 뼈다귀 밥그릇
  () => <g><path d="M384 380 h84 l-11 26 h-62 z" fill="#4dabf7" stroke="#1971c2" stroke-width="4" stroke-linejoin="round" /><g transform="translate(426 376) rotate(-10)"><path d="M-17 -6 a5 5 0 1 1 5 -2 L11 -8 a5 5 0 1 1 5 2 a5 5 0 1 1 -5 8 L-12 2 a5 5 0 1 1 -5 -2 a5 5 0 0 1 0 -6 z" fill="#fff4e6" stroke="#d9a066" stroke-width="2.5" /></g></g>,
];

const CAT: Part[] = [
  // 바닥
  () => <g><rect x="130" y="356" width="300" height="30" rx="12" fill="#f3b6c8" stroke="#c9728c" stroke-width="5" /><path d="M190 358 v26 M250 358 v26 M310 358 v26 M370 358 v26" stroke="#c9728c" stroke-width="3" opacity=".5" /></g>,
  // 벽
  () => <g><path d="M170 360 V232 Q170 202 200 202 H360 Q390 202 390 232 V360 Z" fill="#e5dbff" stroke="#8c6fd6" stroke-width="6" /><path d="M174 262 h212 M174 312 h212" stroke="#c9b8f5" stroke-width="3" /></g>,
  // 지붕 (고양이 귀가 달린)
  () => <g><path d="M220 160 L238 104 L262 152 Z M340 160 L322 104 L298 152 Z" fill="#9775fa" stroke="#6741d9" stroke-width="5" stroke-linejoin="round" /><path d="M229 150 L238 122 L251 148 Z M331 150 L322 122 L309 148 Z" fill="#ffc2d9" /><path d="M150 218 Q280 76 410 218 Z" fill="#b197fc" stroke="#6741d9" stroke-width="7" stroke-linejoin="round" /><circle cx="262" cy="176" r="5" fill="#3b2a4a" /><circle cx="298" cy="176" r="5" fill="#3b2a4a" /><path d="M274 186 l6 5 6 -5" fill="#ff8fab" stroke="#d6336c" stroke-width="2" stroke-linejoin="round" /><path d="M240 188 h-22 M240 194 h-20 M320 188 h22 M320 194 h20" stroke="#6741d9" stroke-width="2.5" stroke-linecap="round" /></g>,
  // 동그란 문
  () => <g><circle cx="280" cy="314" r="40" fill="#7048e8" stroke="#5f3dc4" stroke-width="5" /><circle cx="280" cy="314" r="30" fill="#3b2a6a" /><path d="M270 352 h20" stroke="#5f3dc4" stroke-width="5" /></g>,
  // 창문 (하트)
  () => <g><path d="M350 270 l-22 -22 a12 12 0 0 1 22 -16 a12 12 0 0 1 22 16 z" fill="#d0ebff" stroke="#8c6fd6" stroke-width="5" stroke-linejoin="round" /><path d="M340 240 q4 -5 9 -4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" /></g>,
  // 캣타워
  () => <g><rect x="470" y="180" width="18" height="200" rx="6" fill="#e9c891" stroke="#b08a4a" stroke-width="4" /><ellipse cx="479" cy="380" rx="56" ry="14" fill="#c5a3ff" stroke="#8c6fd6" stroke-width="4" /><ellipse cx="479" cy="276" rx="40" ry="12" fill="#ffc2d9" stroke="#e2477f" stroke-width="4" /><ellipse cx="479" cy="180" rx="46" ry="13" fill="#c5a3ff" stroke="#8c6fd6" stroke-width="4" /><path d="M450 280 v34" stroke="#adb5bd" stroke-width="2" /><circle cx="450" cy="320" r="8" fill="#ffd43b" stroke="#e0a800" stroke-width="2.5" /></g>,
  // 폭신한 방석
  () => <g><ellipse cx="186" cy="398" rx="54" ry="17" fill="#ffd8a8" stroke="#f08c00" stroke-width="4" /><ellipse cx="186" cy="393" rx="36" ry="8" fill="#ffe8cc" /></g>,
  // 물고기 밥그릇
  () => <g><path d="M372 382 h80 l-10 24 h-60 z" fill="#ff8fab" stroke="#d6336c" stroke-width="4" stroke-linejoin="round" /><g transform="translate(412 374)"><path d="M-16 0 C -8 -10, 8 -10, 12 0 C 8 10, -8 10, -16 0 Z" fill="#74c0fc" stroke="#1971c2" stroke-width="2.5" /><path d="M12 0 L 22 -8 L 22 8 Z" fill="#4dabf7" stroke="#1971c2" stroke-width="2.5" stroke-linejoin="round" /><circle cx="-8" cy="-2" r="2" fill="#222" /></g></g>,
];

const PARK: Part[] = [
  // 모래밭
  () => <g><rect x="40" y="332" width="180" height="70" rx="14" fill="#ffe8a3" stroke="#c99a3a" stroke-width="6" /><circle cx="84" cy="362" r="6" fill="#e6c36a" /><circle cx="164" cy="378" r="5" fill="#e6c36a" /><path d="M112 372 l6 -20 h20 l6 20 z" fill="#ff922b" stroke="#d9480f" stroke-width="3" stroke-linejoin="round" /><path d="M116 352 q12 -12 24 0" stroke="#d9480f" stroke-width="3" fill="none" /></g>,
  // 미끄럼틀
  () => <g><path d="M254 382 V198 M280 382 V198" stroke="#4dabf7" stroke-width="8" stroke-linecap="round" /><path d="M254 232 h26 M254 268 h26 M254 304 h26 M254 340 h26" stroke="#4dabf7" stroke-width="6" /><rect x="246" y="184" width="64" height="18" rx="6" fill="#ff6b6b" stroke="#c92a2a" stroke-width="4" /><path d="M302 198 C 332 232, 342 332, 402 374 L 410 364 C 354 324, 346 224, 314 188 Z" fill="#ffd43b" stroke="#e0a800" stroke-width="5" stroke-linejoin="round" /></g>,
  // 그네
  () => <g><path d="M424 402 L448 182 L548 182 L572 402" fill="none" stroke="#ff922b" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" /><path d="M472 184 V330 M500 184 V330 M522 184 V318 M548 184 V318" stroke="#868e96" stroke-width="3" /><rect x="464" y="328" width="44" height="10" rx="4" fill="#be4bdb" /><rect x="514" y="316" width="42" height="10" rx="4" fill="#20c997" /></g>,
  // 시소
  () => <g><path d="M320 432 l-20 0 l20 -26 l20 26 z" fill="#868e96" stroke="#495057" stroke-width="3" stroke-linejoin="round" /><g transform="rotate(-8 320 404)"><rect x="236" y="398" width="168" height="12" rx="6" fill="#69db7c" stroke="#2f9e44" stroke-width="4" /><path d="M250 398 v-14 M390 398 v-14" stroke="#2f9e44" stroke-width="5" stroke-linecap="round" /></g></g>,
  // 터널
  () => <g><path d="M454 432 V402 a52 40 0 0 1 104 0 V432" fill="none" stroke="#ff6b6b" stroke-width="14" /><path d="M470 432 V404 a36 26 0 0 1 72 0 V432" fill="none" stroke="#ffd43b" stroke-width="12" /><path d="M486 432 V406 a20 14 0 0 1 40 0 V432 Z" fill="#5c3d2e" /></g>,
  // 큰 공
  () => <g><circle cx="196" cy="316" r="24" fill="#fff" stroke="#495057" stroke-width="3" /><path d="M172 316 a24 24 0 0 1 24 -24 v24 z" fill="#ff6b6b" /><path d="M196 340 a24 24 0 0 1 -24 -24 h24 z" fill="#4dabf7" /><path d="M220 316 a24 24 0 0 1 -24 24 v-24 z" fill="#ffd43b" /><circle cx="196" cy="316" r="24" fill="none" stroke="#495057" stroke-width="3" /><circle cx="188" cy="306" r="4" fill="#fff" opacity=".8" /></g>,
  // 꽃밭
  () => <g>{[50, 82, 114, 146].map((x, i) => <g transform={`translate(${x} ${300 - (i % 2) * 10})`}><path d="M0 0 v26" stroke="#2f9e44" stroke-width="3" />{[0, 72, 144, 216, 288].map(a => <circle cx={Math.cos(a * Math.PI / 180) * 8} cy={Math.sin(a * Math.PI / 180) * 8} r="7" fill={['#ff8fab', '#ffd43b', '#b197fc', '#74c0fc'][i]} />)}<circle r="5" fill="#fff3bf" /></g>)}</g>,
  // 벤치
  () => <g><rect x="40" y="214" width="150" height="14" rx="5" fill="#c58b52" stroke="#8f5e2c" stroke-width="4" /><rect x="40" y="238" width="150" height="14" rx="5" fill="#c58b52" stroke="#8f5e2c" stroke-width="4" /><path d="M58 252 v24 M172 252 v24" stroke="#8f5e2c" stroke-width="7" stroke-linecap="round" /></g>,
];

const ART: Record<string, Part[]> = { doghouse: DOG, cathouse: CAT, park: PARK };

// ---------- 손그림 완성 그림 ----------
// 영역: 완성 그림 캔버스 0~1 좌표의 다각형 또는 ['e', 가운데x, 가운데y, 반지름x, 반지름y](타원). 부품 순서는 BUILDS와 같다.
type Shape = [number, number][] | ['e', number, number, number, number];
interface BMask { base?: Shape[]; parts: Shape[][]; sign?: [number, number, number]; body?: number }   // body: 앞에서부터 이만큼이 집 건물(집 색이 입혀지는 곳)
const BUILD_MASK: Record<string, BMask> = {
  doghouse: {
    parts: [
      [[[0.19, 0.585], [0.37, 0.56], [0.885, 0.56], [0.89, 0.62], [0.70, 0.715], [0.60, 0.715], [0.21, 0.665]]],            // 바닥
      [[[0.27, 0.31], [0.43, 0.165], [0.625, 0.345], [0.66, 0.365], [0.845, 0.385], [0.835, 0.605], [0.27, 0.605]]],         // 벽
      [[[0.185, 0.385], [0.43, 0.07], [0.72, 0.115], [0.89, 0.375], [0.865, 0.435], [0.66, 0.39], [0.62, 0.36], [0.43, 0.17], [0.26, 0.38], [0.22, 0.41]]], // 지붕
      [[[0.33, 0.585], [0.33, 0.42], [0.355, 0.37], [0.40, 0.335], [0.45, 0.322], [0.50, 0.335], [0.545, 0.37], [0.57, 0.42], [0.57, 0.585]]], // 문
      [[[0.65, 0.405], [0.795, 0.40], [0.795, 0.56], [0.65, 0.565]]],                                                       // 창문
      [[[0.33, 0.262], [0.55, 0.255], [0.555, 0.33], [0.33, 0.335]]],                                                       // 이름표
      [['e', 0.29, 0.815, 0.24, 0.135]],                                                                                   // 방석
      [[[0.625, 0.785], [0.935, 0.785], [0.935, 0.935], [0.625, 0.935]]],                                                   // 밥그릇
    ],
    sign: [0.443, 0.297, 0.19],
    body: 6,
  },
  cathouse: {
    body: 5,
    parts: [
      [[[0.005, 0.595], [0.10, 0.58], [0.715, 0.58], [0.72, 0.65], [0.66, 0.705], [0.15, 0.705], [0.005, 0.665]]],
      [[[0.09, 0.35], [0.70, 0.35], [0.705, 0.60], [0.09, 0.60]]],
      [[[0.03, 0.36], [0.13, 0.23], [0.155, 0.19], [0.16, 0.065], [0.27, 0.065], [0.275, 0.14], [0.345, 0.105], [0.52, 0.22], [0.73, 0.355], [0.71, 0.405], [0.47, 0.33], [0.30, 0.31], [0.14, 0.37], [0.06, 0.40]]],
      [['e', 0.355, 0.49, 0.105, 0.105]],
      [[[0.51, 0.38], [0.66, 0.38], [0.66, 0.565], [0.51, 0.565]]],
      [[[0.71, 0.165], [0.99, 0.165], [0.99, 0.80], [0.71, 0.80]]],                                                        // 캣타워
      [['e', 0.285, 0.86, 0.245, 0.125]],
      [[[0.585, 0.815], [0.915, 0.815], [0.915, 0.97], [0.585, 0.97]]],
    ],
  },
  park: {
    base: [['e', 0.495, 0.51, 0.49, 0.445]],                                                                               // 놀이터 땅은 처음부터
    parts: [
      [[[0.065, 0.455], [0.27, 0.405], [0.47, 0.43], [0.475, 0.535], [0.27, 0.60], [0.065, 0.55]]],                         // 모래밭
      [[[0.62, 0.06], [0.84, 0.06], [0.90, 0.33], [0.70, 0.36], [0.60, 0.44], [0.50, 0.43], [0.52, 0.32], [0.62, 0.20]]],   // 미끄럼틀
      [[[0.15, 0.13], [0.47, 0.12], [0.47, 0.40], [0.15, 0.40]]],                                                         // 그네
      [[[0.06, 0.575], [0.18, 0.575], [0.43, 0.66], [0.43, 0.75], [0.14, 0.745], [0.06, 0.66]]],                           // 시소
      [['e', 0.765, 0.47, 0.15, 0.095]],                                                                                   // 터널
      [['e', 0.538, 0.69, 0.088, 0.088]],                                                                                  // 큰 공
      [[[0.56, 0.75], [0.66, 0.70], [0.82, 0.69], [0.90, 0.73], [0.87, 0.86], [0.58, 0.86]]],                              // 꽃밭
      [[[0.71, 0.53], [0.94, 0.525], [0.96, 0.62], [0.93, 0.71], [0.72, 0.71]]],                                          // 벤치
    ],
  },
};
/** 600x440 판에서 완성 그림(정사각형)이 놓이는 자리 */
export const BUILD_IMG = { x: 40, y: -54, s: 520 };
const bx = (u: number) => BUILD_IMG.x + BUILD_IMG.s * u, by = (v: number) => BUILD_IMG.y + BUILD_IMG.s * v;

function shapeEl(sh: Shape, fill: string) {
  if (sh[0] === 'e') {
    const [, cx, cy, rx, ry] = sh as ['e', number, number, number, number];
    return <ellipse cx={bx(cx)} cy={by(cy)} rx={rx * BUILD_IMG.s} ry={ry * BUILD_IMG.s} fill={fill} />;
  }
  return <polygon points={(sh as [number, number][]).map(([u, v]) => `${bx(u).toFixed(1)},${by(v).toFixed(1)}`).join(' ')} fill={fill} />;
}
function center(shapes: Shape[]): [number, number] {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const sh of shapes) {
    let pts: [number, number][];
    if (sh[0] === 'e') { const [, cx, cy, rx, ry] = sh as ['e', number, number, number, number]; pts = [[cx - rx, cy - ry], [cx + rx, cy + ry]]; }
    else pts = sh as [number, number][];
    for (const [u, v] of pts) { x0 = Math.min(x0, u); y0 = Math.min(y0, v); x1 = Math.max(x1, u); y1 = Math.max(y1, v); }
  }
  return [bx((x0 + x1) / 2), by((y0 + y1) / 2)];
}

let bseq = 0;
function BuildPic({ id, src, n, next, name, size, pop, M, tint }: { id: string; src: string; n: number; next: boolean; name: string; size: number; pop: number; M: BMask; tint?: string }) {
  const [u] = useState(() => `b${++bseq}`);
  const N = M.parts.length;
  const built = M.parts.slice(0, n), rest = M.parts.slice(n);
  // 집 색(마당 'y-color' — 원문 E): 집 건물 부품에만 색조, 방석·밥그릇·캣타워는 그대로
  const T = tint && tint !== 'none' && M.body ? M.body : 0;
  const bodyBuilt = built.slice(0, T), otherBuilt = built.slice(T);
  const img = (extra: Record<string, any> = {}) => <image href={src} x={BUILD_IMG.x} y={BUILD_IMG.y} width={BUILD_IMG.s} height={BUILD_IMG.s} {...extra} />;
  const MU = { maskUnits: 'userSpaceOnUse', x: -200, y: -200, width: 1000, height: 840 } as any;
  const showPop = pop >= 0 && pop < n;
  const [pcx, pcy] = showPop ? center(M.parts[pop]) : [300, 300];
  return (
    <svg viewBox="0 0 600 440" width={size} height={size * 440 / 600} style={{ overflow: 'visible' }} data-build={id} data-built={n} data-art="1">
      <defs>
        <filter id={`${u}-s`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5" /></filter>
        <mask id={`${u}-on`} {...MU}>
          <g filter={`url(#${u}-s)`}>
            {(M.base ?? []).map(sh => shapeEl(sh, '#fff'))}
            {(T ? otherBuilt : built).flat().map(sh => shapeEl(sh, '#fff'))}
            {rest.flat().map(sh => shapeEl(sh, '#000'))}
          </g>
        </mask>
        {T > 0 && <mask id={`${u}-bd`} {...MU}><g filter={`url(#${u}-s)`}>{bodyBuilt.flat().map(sh => shapeEl(sh, '#fff'))}{[...otherBuilt, ...rest].flat().map(sh => shapeEl(sh, '#000'))}</g></mask>}
        {next && n < N && <mask id={`${u}-nx`} {...MU}><g filter={`url(#${u}-s)`}>{M.parts[n].map(sh => shapeEl(sh, '#fff'))}{M.parts.slice(n + 1).flat().map(sh => shapeEl(sh, '#000'))}</g></mask>}
        {showPop && <mask id={`${u}-pp`} {...MU}><g filter={`url(#${u}-s)`}>{M.parts[pop].map(sh => shapeEl(sh, '#fff'))}{rest.flat().map(sh => shapeEl(sh, '#000'))}</g></mask>}
      </defs>
      {n < N && img({ class: 'bld-ghost' })}
      {img(n < N || M.base || T ? { mask: `url(#${u}-on)` } : {})}
      {T > 0 && img({ mask: `url(#${u}-bd)`, style: { filter: tint } })}
      {next && n < N && img({ class: 'bld-next', mask: `url(#${u}-nx)` })}
      {showPop && img({ class: 'build-pop-img', mask: `url(#${u}-pp)`, style: { transformOrigin: `${pcx}px ${pcy}px` } })}
      {M.sign && name && n > 5 && (
        <text x={bx(M.sign[0])} y={by(M.sign[1]) + 9} font-size={Math.min(28, (M.sign[2] * BUILD_IMG.s) / Math.max(2, name.length) * 0.95)} text-anchor="middle" fill="#6b3a12" font-family="Jua" style={{ pointerEvents: 'none' }}>{name}</text>
      )}
    </svg>
  );
}

/** n개 지은 모습. next=true면 다음에 지을 부분을 흐린 그림자로 미리 보여 줌 */
export function BuildArt({ id, n, next = true, name = '', size = 600, pop = -1, tint }: { id: string; n: number; next?: boolean; name?: string; size?: number; pop?: number; tint?: string }) {
  const src = artSrc(`build.${id}.complete`);
  const ok = useArtReady(src ? [src] : null);
  const M = BUILD_MASK[id];
  if (src && ok && M) return <BuildPic id={id} src={src} n={n} next={next} name={name} size={size} pop={pop} M={M} tint={tint} />;
  const parts = ART[id] ?? [];
  return (
    <svg viewBox="0 0 600 440" width={size} height={size * 440 / 600} style={{ overflow: 'visible', filter: tint && tint !== 'none' ? tint : undefined }} data-build={id} data-built={n}>
      {parts.slice(0, n).map((p, i) => <g class={i === pop ? 'build-pop' : ''} style={{ transformOrigin: '300px 300px' }}>{p(name)}</g>)}
      {next && n < parts.length && <g class="build-ghost" opacity=".22" style={{ filter: 'grayscale(1)' }}>{parts[n](name)}</g>}
    </svg>
  );
}

/** 집 짓기 재료 (나무판자 + 벽돌 + 망치) — 손그림(build.mat)이 있으면 그것 */
export function MatIcon({ size = 100 }: { size?: number }) {
  const src = artSrc('build.mat');
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img class="mat-icon" src={src} width={size} height={size} alt="" draggable={false} style={{ objectFit: 'contain', verticalAlign: 'middle' }} onError={() => setBad(true)} />;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size}>
      <rect x="14" y="62" width="92" height="22" rx="5" fill="#c58b52" stroke="#8f5e2c" stroke-width="4" />
      <path d="M38 64 v18 M62 64 v18 M86 64 v18" stroke="#8f5e2c" stroke-width="2.5" opacity=".5" />
      <rect x="22" y="86" width="36" height="20" rx="4" fill="#ff8787" stroke="#c92a2a" stroke-width="4" />
      <rect x="62" y="86" width="36" height="20" rx="4" fill="#ff8787" stroke="#c92a2a" stroke-width="4" />
      <g transform="rotate(-35 70 34)"><rect x="66" y="22" width="8" height="46" rx="3" fill="#e9c891" stroke="#b08a4a" stroke-width="3" /><rect x="52" y="12" width="36" height="16" rx="4" fill="#868e96" stroke="#495057" stroke-width="3" /></g>
    </svg>
  );
}
