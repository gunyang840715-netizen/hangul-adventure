// 집 짓기 그림: 강아지 집 · 고양이 집 · 놀이터 (600x440 좌표). 지은 부분까지 그리고, 다음에 지을 부분은 흐린 그림자로
import type { JSX } from 'preact';

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

/** n개 지은 모습. next=true면 다음에 지을 부분을 흐린 그림자로 미리 보여 줌 */
export function BuildArt({ id, n, next = true, name = '', size = 600, pop = -1 }: { id: string; n: number; next?: boolean; name?: string; size?: number; pop?: number }) {
  const parts = ART[id] ?? [];
  return (
    <svg viewBox="0 0 600 440" width={size} height={size * 440 / 600} style={{ overflow: 'visible' }} data-build={id} data-built={n}>
      {parts.slice(0, n).map((p, i) => <g class={i === pop ? 'build-pop' : ''} style={{ transformOrigin: '300px 300px' }}>{p(name)}</g>)}
      {next && n < parts.length && <g class="build-ghost" opacity=".22" style={{ filter: 'grayscale(1)' }}>{parts[n](name)}</g>}
    </svg>
  );
}

/** 집 짓기 재료 (나무판자 + 벽돌 + 망치) */
export function MatIcon({ size = 100 }: { size?: number }) {
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
