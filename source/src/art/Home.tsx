// 집 안 가구 · 큰 놀이터 기구 그림 (자리마다 viewBox 안에 그림. data/home.ts의 SlotDef.vb와 같은 크기)
import type { JSX } from 'preact';

const O = '#7a5238';       // 나무 테두리
const ART: Record<string, () => JSX.Element> = {
  // ---------- 창문 [240,210] ----------
  'win:pink': () => <g>
    <rect x="30" y="20" width="180" height="170" rx="14" fill="#d0ebff" stroke="#c58b52" stroke-width="10" />
    <circle cx="160" cy="62" r="20" fill="#fff3bf" /><path d="M60 140 q20 -16 40 0 q20 -16 40 0" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round" />
    <path d="M120 20 v170 M30 105 h180" stroke="#c58b52" stroke-width="7" />
    <path d="M14 8 h212" stroke="#c58b52" stroke-width="8" stroke-linecap="round" />
    <path d="M18 10 C 40 60, 26 130, 52 196 L 18 196 Z" fill="#ff9ec7" stroke="#e2477f" stroke-width="4" stroke-linejoin="round" />
    <path d="M222 10 C 200 60, 214 130, 188 196 L 222 196 Z" fill="#ff9ec7" stroke="#e2477f" stroke-width="4" stroke-linejoin="round" />
  </g>,
  'win:blue': () => <g>
    <rect x="30" y="20" width="180" height="170" rx="14" fill="#e3fafc" stroke="#74c0fc" stroke-width="10" />
    <path d="M50 160 q30 -50 60 0 q30 -60 70 0" fill="#b2f2bb" />
    <path d="M120 20 v170 M30 105 h180" stroke="#74c0fc" stroke-width="7" />
    <path d="M14 8 h212" stroke="#4dabf7" stroke-width="8" stroke-linecap="round" />
    {[0, 1].map(s => <path d={s ? 'M222 10 C 200 60, 214 130, 188 196 L 222 196 Z' : 'M18 10 C 40 60, 26 130, 52 196 L 18 196 Z'} fill="#a5d8ff" stroke="#1c7ed6" stroke-width="4" stroke-linejoin="round" />)}
    {[40, 80, 120, 160].map(y => <circle cx="30" cy={y} r="4" fill="#fff" />)}
  </g>,
  'win:round': () => <g>
    <circle cx="120" cy="105" r="88" fill="#fff9db" stroke="#c58b52" stroke-width="12" />
    <circle cx="150" cy="75" r="22" fill="#ffd43b" />
    <path d="M120 17 v176 M32 105 h176" stroke="#c58b52" stroke-width="7" />
    <path d="M60 150 q20 -20 40 0" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" />
    {[0, 60, 120, 180, 240, 300].map(a => <circle cx={120 + Math.cos(a * Math.PI / 180) * 96} cy={105 + Math.sin(a * Math.PI / 180) * 96} r="7" fill="#ff8fb8" />)}
  </g>,
  // ---------- 액자 [160,150] ----------
  'frame:paw': () => <g>
    <rect x="10" y="10" width="140" height="130" rx="10" fill="#fff4e6" stroke="#c58b52" stroke-width="10" />
    <g fill="#ff8fab"><ellipse cx="80" cy="92" rx="26" ry="22" /><circle cx="50" cy="60" r="11" /><circle cx="70" cy="46" r="11" /><circle cx="92" cy="46" r="11" /><circle cx="112" cy="60" r="11" /></g>
  </g>,
  'frame:rainbow': () => <g>
    <rect x="10" y="10" width="140" height="130" rx="10" fill="#e7f5ff" stroke="#f08c00" stroke-width="10" />
    {['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].map((c, i) => <path d={`M${30 + i * 7} 112 a${50 - i * 7} ${50 - i * 7} 0 0 1 ${100 - i * 14} 0`} stroke={c} stroke-width="7" fill="none" />)}
    <circle cx="36" cy="112" r="11" fill="#fff" /><circle cx="124" cy="112" r="11" fill="#fff" />
  </g>,
  'frame:flower': () => <g>
    <rect x="10" y="10" width="140" height="130" rx="10" fill="#fff0f6" stroke="#9775fa" stroke-width="10" />
    <path d="M80 122 v-46" stroke="#2f9e44" stroke-width="5" /><path d="M80 104 q-18 -4 -24 -16 q18 0 24 16 M80 98 q18 -4 24 -16 q-18 0 -24 16" fill="#51cf66" />
    {[0, 72, 144, 216, 288].map(a => <circle cx={80 + Math.cos(a * Math.PI / 180) * 16} cy={62 + Math.sin(a * Math.PI / 180) * 16} r="12" fill="#ff8fb8" />)}
    <circle cx="80" cy="62" r="10" fill="#ffd43b" />
  </g>,
  // ---------- 큰 가구 [140,300] ----------
  'tower:cat': () => <g>
    <rect x="62" y="40" width="16" height="250" rx="5" fill="#e9c891" stroke="#b08a4a" stroke-width="4" />
    <ellipse cx="70" cy="290" rx="62" ry="10" fill="#c5a3ff" stroke="#8c6fd6" stroke-width="4" />
    <ellipse cx="70" cy="196" rx="54" ry="11" fill="#c5a3ff" stroke="#8c6fd6" stroke-width="4" />
    <rect x="20" y="20" width="100" height="44" rx="20" fill="#d0bfff" stroke="#8c6fd6" stroke-width="4" /><ellipse cx="70" cy="44" rx="28" ry="14" fill="#5f3dc4" />
    <path d="M60 120 l-24 30 M80 120 l24 26" stroke="#b08a4a" stroke-width="5" stroke-linecap="round" /><circle cx="34" cy="154" r="9" fill="#ffd43b" stroke="#f08c00" stroke-width="3" />
  </g>,
  'tower:box': () => <g>
    <rect x="12" y="170" width="116" height="120" rx="10" fill="#ffa8a8" stroke="#e03131" stroke-width="5" />
    <rect x="6" y="150" width="128" height="30" rx="8" fill="#ff8787" stroke="#e03131" stroke-width="5" transform="rotate(-8 70 165)" />
    <circle cx="44" cy="146" r="18" fill="#74c0fc" stroke="#1971c2" stroke-width="4" /><rect x="66" y="112" width="36" height="36" rx="6" fill="#ffd43b" stroke="#f08c00" stroke-width="4" />
    <text x="70" y="250" font-size="40" text-anchor="middle" fill="#fff" font-family="Jua">★</text>
  </g>,
  'tower:shelf': () => <g>
    <rect x="8" y="30" width="124" height="262" rx="8" fill="#e9b886" stroke={O} stroke-width="6" />
    {[100, 170, 240].map(y => <rect x="8" y={y} width="124" height="10" fill="#c58b52" />)}
    {[[20, 50, '#ff8fab'], [42, 46, '#74c0fc'], [62, 52, '#ffd43b'], [84, 44, '#8ce99a'], [104, 50, '#b197fc'], [24, 118, '#ffa94d'], [48, 122, '#63e6be'], [74, 116, '#f783ac'], [98, 120, '#91a7ff'], [22, 188, '#ffd43b'], [46, 190, '#ff8fab'], [72, 186, '#74c0fc'], [96, 192, '#b197fc']].map(([x, y, c]) =>
      <rect x={x as number} y={y as number} width="18" height={(y as number) < 100 ? 50 : (y as number) < 170 ? 48 : 50} rx="3" fill={c as string} stroke="#8f5e2c" stroke-opacity=".3" stroke-width="2" />)}
  </g>,
  // ---------- 화분 [110,230] ----------
  'plant:pot': () => <g>
    <path d="M24 160 h62 l-8 64 h-46 z" fill="#ff922b" stroke="#c45f0a" stroke-width="5" stroke-linejoin="round" />
    {[[-40, 1], [-15, 1.1], [15, 1.1], [40, 1]].map(([a, k]) => <ellipse cx="55" cy={96} rx={16 * (k as number)} ry={48 * (k as number)} fill="#51cf66" stroke="#2b8a3e" stroke-width="4" transform={`rotate(${a} 55 158)`} />)}
  </g>,
  'plant:cactus': () => <g>
    <path d="M24 170 h62 l-8 54 h-46 z" fill="#f783ac" stroke="#c2255c" stroke-width="5" stroke-linejoin="round" />
    <rect x="38" y="60" width="34" height="114" rx="17" fill="#69db7c" stroke="#2b8a3e" stroke-width="5" />
    <path d="M38 120 h-14 a10 10 0 0 1 -10 -10 v-26 a8 8 0 0 1 16 0 v20 M72 104 h14 a10 10 0 0 0 10 -10 v-20 a8 8 0 0 0 -16 0 v16" fill="#69db7c" stroke="#2b8a3e" stroke-width="5" />
    <circle cx="55" cy="54" r="10" fill="#ff8fb8" />
  </g>,
  'plant:sun': () => <g>
    <path d="M24 176 h62 l-8 48 h-46 z" fill="#74c0fc" stroke="#1971c2" stroke-width="5" stroke-linejoin="round" />
    <path d="M55 176 V70" stroke="#2f9e44" stroke-width="7" /><path d="M55 140 q-30 -4 -34 -24 q26 2 34 24 M55 120 q28 -6 32 -26 q-26 4 -32 26" fill="#51cf66" />
    {Array.from({ length: 12 }, (_, i) => <ellipse cx="55" cy="34" rx="9" ry="20" fill="#ffd43b" stroke="#f08c00" stroke-width="2" transform={`rotate(${i * 30} 55 54)`} />)}
    <circle cx="55" cy="54" r="17" fill="#8f5e2c" />
  </g>,
  // ---------- 조명 [130,260] ----------
  'lamp:mush': () => <g>
    <rect x="58" y="110" width="14" height="136" rx="5" fill="#fff4e6" stroke="#c58b52" stroke-width="4" /><ellipse cx="65" cy="248" rx="40" ry="10" fill="#e9b886" stroke="#c58b52" stroke-width="4" />
    <path d="M10 112 a55 60 0 0 1 110 0 z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="5" />
    {[[40, 80], [72, 64], [96, 92]].map(([x, y]) => <circle cx={x} cy={y} r="9" fill="#fff" />)}
    <ellipse cx="65" cy="120" rx="44" ry="10" fill="#fff3bf" opacity=".9" />
  </g>,
  'lamp:moon': () => <g>
    <path d="M65 250 V118" stroke="#adb5bd" stroke-width="6" /><ellipse cx="65" cy="250" rx="36" ry="9" fill="#ced4da" stroke="#868e96" stroke-width="4" />
    <path d="M90 30 a52 52 0 1 0 0 90 a42 42 0 1 1 0 -90 z" fill="#ffe066" stroke="#f08c00" stroke-width="5" />
    <circle cx="45" cy="70" r="5" fill="#f08c00" opacity=".5" /><circle cx="56" cy="96" r="4" fill="#f08c00" opacity=".5" />
  </g>,
  'lamp:star': () => <g>
    <path d="M65 250 V130" stroke="#b197fc" stroke-width="6" /><ellipse cx="65" cy="250" rx="36" ry="9" fill="#d0bfff" stroke="#7048e8" stroke-width="4" />
    <path d="M65 22 l18 38 42 5 -31 29 8 41 -37 -20 -37 20 8 -41 -31 -29 42 -5 z" fill="#ffd43b" stroke="#f08c00" stroke-width="5" stroke-linejoin="round" />
    <circle cx="65" cy="80" r="40" fill="#fff3bf" opacity=".35" />
  </g>,
  // ---------- 깔개 [480,160] ----------
  'rug:round': () => <g>
    <ellipse cx="240" cy="80" rx="232" ry="72" fill="#b2f2bb" stroke="#40c057" stroke-width="5" />
    <ellipse cx="240" cy="80" rx="170" ry="50" fill="#d3f9d8" /><ellipse cx="240" cy="80" rx="104" ry="30" fill="#8ce99a" /><ellipse cx="240" cy="80" rx="42" ry="12" fill="#ebfbee" />
  </g>,
  'rug:heart': () => <g>
    <path d="M240 152 C 120 112, 20 72, 70 30 C 110 0, 190 12, 240 50 C 290 12, 370 0, 410 30 C 460 72, 360 112, 240 152 Z" fill="#ffc9de" stroke="#f06595" stroke-width="5" />
    <path d="M240 128 C 160 100, 96 70, 128 46 C 156 26, 206 36, 240 62 C 274 36, 324 26, 352 46 C 384 70, 320 100, 240 128 Z" fill="#ffdeeb" />
  </g>,
  'rug:star': () => <g>
    <ellipse cx="240" cy="80" rx="232" ry="72" fill="#d0bfff" stroke="#7950f2" stroke-width="5" />
    {[[120, 70], [240, 50], [360, 74], [180, 110], [300, 108]].map(([x, y]) => <path d={`M${x} ${y - 16} l6 11 13 2 -10 9 3 13 -12 -6 -12 6 3 -13 -10 -9 13 -2 z`} fill="#ffd43b" />)}
  </g>,
  // ---------- 침대 [400,230] ----------
  'bed:cushion': () => <g>
    <ellipse cx="200" cy="170" rx="186" ry="54" fill="#ff8fb8" stroke="#e2477f" stroke-width="6" />
    <ellipse cx="200" cy="156" rx="140" ry="30" fill="#ffc2d9" />
    {[110, 200, 290].map(x => <circle cx={x} cy="186" r="6" fill="#fff" opacity=".8" />)}
  </g>,
  'bed:basket': () => <g>
    <path d="M30 120 h340 l-24 96 h-292 z" fill="#e9b886" stroke={O} stroke-width="6" stroke-linejoin="round" />
    {[70, 110, 150, 190, 230, 270, 310].map(x => <path d={`M${x} 124 v88`} stroke="#c58b52" stroke-width="5" />)}
    <path d="M38 150 h324 M46 182 h308" stroke="#c58b52" stroke-width="5" />
    <ellipse cx="200" cy="120" rx="170" ry="26" fill="#a5d8ff" stroke="#1c7ed6" stroke-width="5" />
  </g>,
  'bed:canopy': () => <g>
    <path d="M60 30 C 120 -6, 280 -6, 340 30" stroke="#f06595" stroke-width="8" fill="none" />
    <path d="M70 30 C 60 90, 80 150, 50 200 L 100 200 C 110 140, 100 80, 110 32 Z M330 30 C 340 90, 320 150, 350 200 L 300 200 C 290 140, 300 80, 290 32 Z" fill="#fcc2d7" stroke="#f06595" stroke-width="4" opacity=".9" />
    <rect x="50" y="150" width="300" height="60" rx="18" fill="#e5dbff" stroke="#9775fa" stroke-width="6" />
    <ellipse cx="200" cy="150" rx="140" ry="22" fill="#fff" stroke="#d0bfff" stroke-width="4" />
    <path d="M190 4 l10 -14 10 14" fill="#ffd43b" stroke="#f08c00" stroke-width="3" />
  </g>,
  // ---------- 밥그릇 [140,80] ----------
  'bowl:bone': () => <g>
    <path d="M14 30 h112 l-14 44 h-84 z" fill="#4dabf7" stroke="#1971c2" stroke-width="5" stroke-linejoin="round" />
    <path d="M44 22 a7 7 0 1 1 6 -4 L 90 18 a7 7 0 1 1 6 4 a7 7 0 1 1 -6 4 L 50 26 a7 7 0 1 1 -6 -4 z" fill="#fff" stroke="#adb5bd" stroke-width="3" />
  </g>,
  'bowl:fish': () => <g>
    <path d="M14 34 h112 l-14 40 h-84 z" fill="#ff8fab" stroke="#d6336c" stroke-width="5" stroke-linejoin="round" />
    <path d="M44 22 C 56 6, 80 6, 92 22 C 80 38, 56 38, 44 22 Z M92 22 l14 -10 v20 z" fill="#74c0fc" stroke="#1971c2" stroke-width="3" stroke-linejoin="round" /><circle cx="58" cy="20" r="3" fill="#1971c2" />
  </g>,
  'bowl:milk': () => <g>
    <path d="M14 36 h112 l-14 38 h-84 z" fill="#ffd43b" stroke="#f08c00" stroke-width="5" stroke-linejoin="round" />
    <ellipse cx="70" cy="36" rx="54" ry="10" fill="#fff" stroke="#e9ecef" stroke-width="3" />
    <rect x="96" y="2" width="24" height="30" rx="5" fill="#fff" stroke="#74c0fc" stroke-width="3" /><rect x="96" y="2" width="24" height="10" rx="4" fill="#74c0fc" />
  </g>,
  // ---------- 장난감 [140,120] ----------
  'toy:ball': () => <g>
    <circle cx="70" cy="66" r="48" fill="#fff" stroke="#495057" stroke-width="4" />
    <path d="M22 66 a48 48 0 0 1 48 -48 v48 z" fill="#ff6b6b" /><path d="M70 114 a48 48 0 0 1 -48 -48 h48 z" fill="#4dabf7" /><path d="M118 66 a48 48 0 0 1 -48 48 v-48 z" fill="#ffd43b" />
    <circle cx="70" cy="66" r="48" fill="none" stroke="#495057" stroke-width="4" />
  </g>,
  'toy:yarn': () => <g>
    <circle cx="66" cy="68" r="46" fill="#f783ac" stroke="#c2255c" stroke-width="4" />
    <path d="M30 50 q36 30 72 0 M24 72 q42 28 84 -2 M36 100 q30 -40 60 -70 M58 112 q24 -50 40 -84" stroke="#c2255c" stroke-width="3" fill="none" />
    <path d="M108 80 q20 10 18 30" stroke="#c2255c" stroke-width="4" fill="none" stroke-linecap="round" />
  </g>,
  'toy:bear': () => <g>
    <circle cx="44" cy="22" r="14" fill="#c58b52" stroke={O} stroke-width="4" /><circle cx="96" cy="22" r="14" fill="#c58b52" stroke={O} stroke-width="4" />
    <circle cx="70" cy="44" r="34" fill="#d9a06a" stroke={O} stroke-width="4" /><ellipse cx="70" cy="96" rx="40" ry="24" fill="#d9a06a" stroke={O} stroke-width="4" />
    <circle cx="58" cy="40" r="4" fill="#3b2a2a" /><circle cx="82" cy="40" r="4" fill="#3b2a2a" /><ellipse cx="70" cy="56" rx="12" ry="9" fill="#f5d0a9" /><circle cx="70" cy="53" r="4" fill="#3b2a2a" />
    <path d="M58 82 l12 8 12 -8" stroke="#ff8fab" stroke-width="6" fill="none" stroke-linecap="round" />
  </g>,

  // ================= 큰 놀이터 =================
  // 미끄럼틀 [400,360]
  'slide:rainbow': () => <g>
    <path d="M70 350 V120 M120 350 V120" stroke="#4dabf7" stroke-width="10" stroke-linecap="round" />
    {[160, 205, 250, 295].map(y => <path d={`M70 ${y} h50`} stroke="#4dabf7" stroke-width="8" />)}
    <rect x="56" y="104" width="120" height="20" rx="8" fill="#ffd43b" stroke="#f08c00" stroke-width="5" />
    <path d="M60 104 L95 50 L130 104" fill="#ff6b6b" stroke="#c92a2a" stroke-width="5" stroke-linejoin="round" />
    {['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7'].map((c, i) => <path d={`M${170 + i * 0} ${118 + i * 7} C 260 ${150 + i * 7}, 300 ${300 + i * 7}, ${390 - i * 2} ${330 + i * 6}`} stroke={c} stroke-width="8" fill="none" stroke-linecap="round" />)}
  </g>,
  'slide:spiral': () => <g>
    <rect x="170" y="70" width="60" height="280" rx="10" fill="#e9c891" stroke="#b08a4a" stroke-width="5" />
    <path d="M150 60 L200 14 L250 60 Z" fill="#9775fa" stroke="#6741d9" stroke-width="5" stroke-linejoin="round" />
    <path d="M230 90 C 360 110, 360 170, 200 180 C 40 190, 40 250, 200 260 C 330 268, 360 320, 380 346" stroke="#ff8fb8" stroke-width="30" fill="none" stroke-linecap="round" />
    <path d="M230 90 C 360 110, 360 170, 200 180 C 40 190, 40 250, 200 260 C 330 268, 360 320, 380 346" stroke="#fff" stroke-width="6" fill="none" stroke-dasharray="14 18" opacity=".7" />
  </g>,
  // 그네 [340,330]
  'swing:pink': () => <g>
    <path d="M30 326 L70 22 L270 22 L310 326" fill="none" stroke="#ff922b" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M130 24 V230 M200 24 V230" stroke="#868e96" stroke-width="5" class="swing-rope" />
    <rect x="116" y="226" width="98" height="18" rx="8" fill="#ff8fb8" stroke="#e2477f" stroke-width="5" />
  </g>,
  'swing:tire': () => <g>
    <path d="M40 326 L80 22 L260 22 L300 326" fill="none" stroke="#2f9e44" stroke-width="14" stroke-linejoin="round" stroke-linecap="round" />
    <path d="M170 24 L130 196 M170 24 L210 196" stroke="#868e96" stroke-width="5" />
    <ellipse cx="170" cy="216" rx="56" ry="26" fill="#495057" stroke="#212529" stroke-width="6" /><ellipse cx="170" cy="212" rx="28" ry="10" fill="#bfe6ff" />
  </g>,
  // 트램펄린 [260,160]
  'tramp:round': () => <g>
    <path d="M40 80 L30 150 M220 80 L230 150 M130 96 V156" stroke="#495057" stroke-width="8" stroke-linecap="round" />
    <ellipse cx="130" cy="72" rx="122" ry="36" fill="#4dabf7" stroke="#1971c2" stroke-width="7" /><ellipse cx="130" cy="70" rx="96" ry="24" fill="#212529" />
  </g>,
  'tramp:star': () => <g>
    <path d="M40 80 L30 150 M220 80 L230 150 M130 96 V156" stroke="#495057" stroke-width="8" stroke-linecap="round" />
    <ellipse cx="130" cy="72" rx="122" ry="36" fill="#ffd43b" stroke="#f08c00" stroke-width="7" /><ellipse cx="130" cy="70" rx="96" ry="24" fill="#5f3dc4" />
    <path d="M130 52 l7 12 14 2 -10 9 3 13 -14 -7 -14 7 3 -13 -10 -9 14 -2 z" fill="#ffd43b" />
  </g>,
  // 회전목마 [360,360]
  'carousel:horse': () => <g>
    <path d="M30 110 L180 20 L330 110 Z" fill="#ff8fb8" stroke="#e2477f" stroke-width="6" stroke-linejoin="round" />
    {[60, 120, 180, 240, 300].map((x, i) => <path d={`M${x} 110 q30 26 60 0`} fill={i % 2 ? '#fff' : '#ffd43b'} stroke="#e2477f" stroke-width="3" />)}
    <path d="M180 20 v-14" stroke="#e2477f" stroke-width="5" /><circle cx="180" cy="4" r="7" fill="#ffd43b" />
    {[100, 180, 260].map(x => <path d={`M${x} 120 V300`} stroke="#ffd43b" stroke-width="7" />)}
    {[[100, 210], [180, 236], [260, 210]].map(([x, y], i) => <g transform={`translate(${x} ${y})`}><g class={`carousel-bob b${i}`}>
      <ellipse cx="0" cy="0" rx="34" ry="18" fill={['#fff', '#ffe3e3', '#e7f5ff'][i]} stroke="#868e96" stroke-width="4" />
      <path d="M24 -8 q14 -26 26 -22 q4 14 -10 24" fill={['#fff', '#ffe3e3', '#e7f5ff'][i]} stroke="#868e96" stroke-width="4" /><path d="M-30 -4 q-14 4 -10 18" stroke="#b197fc" stroke-width="6" fill="none" />
    </g></g>)}
    <ellipse cx="180" cy="320" rx="166" ry="30" fill="#ffc9de" stroke="#e2477f" stroke-width="6" />
  </g>,
  'carousel:cup': () => <g>
    <ellipse cx="180" cy="300" rx="170" ry="44" fill="#e5dbff" stroke="#7950f2" stroke-width="6" />
    {[[90, 240, '#ff8fab'], [270, 240, '#74c0fc'], [180, 270, '#ffd43b']].map(([x, y, c]) => <g transform={`translate(${x} ${y})`}>
      <path d="M-50 -40 h100 l-14 60 h-72 z" fill={c as string} stroke="#495057" stroke-width="5" stroke-linejoin="round" />
      <path d="M50 -28 q26 6 6 30" stroke="#495057" stroke-width="6" fill="none" /><ellipse cx="0" cy="-40" rx="50" ry="10" fill="#fff" stroke="#495057" stroke-width="4" />
    </g>)}
    <path d="M180 260 V120" stroke="#7950f2" stroke-width="8" /><circle cx="180" cy="110" r="22" fill="#ffd43b" stroke="#f08c00" stroke-width="5" />
  </g>,
  // 물놀이 [340,160]
  'pool:duck': () => <g>
    <ellipse cx="170" cy="96" rx="160" ry="54" fill="#74c0fc" stroke="#1971c2" stroke-width="8" /><ellipse cx="170" cy="96" rx="134" ry="38" fill="#a5d8ff" />
    <path d="M90 90 q20 -10 40 0 M200 106 q20 -10 40 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" />
    <g transform="translate(220 76)"><ellipse cx="0" cy="8" rx="24" ry="14" fill="#ffd43b" stroke="#f08c00" stroke-width="3" /><circle cx="14" cy="-8" r="11" fill="#ffd43b" stroke="#f08c00" stroke-width="3" /><path d="M24 -8 l10 3 -10 3 z" fill="#ff922b" /><circle cx="16" cy="-11" r="2" fill="#212529" /></g>
  </g>,
  'pool:fountain': () => <g>
    <ellipse cx="170" cy="118" rx="150" ry="36" fill="#a5d8ff" stroke="#1971c2" stroke-width="7" />
    <rect x="150" y="60" width="40" height="60" rx="8" fill="#e9ecef" stroke="#868e96" stroke-width="5" />
    {[-60, -30, 0, 30, 60].map(dx => <path d={`M170 58 q${dx} -60 ${dx * 2} 20`} stroke="#4dabf7" stroke-width="6" fill="none" stroke-linecap="round" class="fountain-jet" />)}
  </g>,
  // 나무 집 [360,460]
  'tree:house': () => <g>
    <rect x="160" y="200" width="44" height="250" rx="10" fill="#c58b52" stroke="#8f5e2c" stroke-width="6" />
    <circle cx="110" cy="110" r="80" fill="#51cf66" stroke="#2b8a3e" stroke-width="6" /><circle cx="250" cy="100" r="86" fill="#69db7c" stroke="#2b8a3e" stroke-width="6" /><circle cx="180" cy="60" r="70" fill="#8ce99a" stroke="#2b8a3e" stroke-width="6" />
    <rect x="110" y="170" width="150" height="100" rx="8" fill="#ffd8a8" stroke="#c45f0a" stroke-width="6" />
    <path d="M96 176 L185 120 L274 176 Z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="6" stroke-linejoin="round" />
    <rect x="166" y="210" width="40" height="60" rx="6" fill="#8f5e2c" /><circle cx="140" cy="214" r="16" fill="#d0ebff" stroke="#c45f0a" stroke-width="4" />
    <path d="M220 270 L250 450 M240 270 L270 450" stroke="#8f5e2c" stroke-width="5" />{[300, 340, 380, 420].map(y => <path d={`M${225 + (y - 270) / 6} ${y} h24`} stroke="#8f5e2c" stroke-width="5" />)}
  </g>,
  'tree:apple': () => <g>
    <rect x="160" y="190" width="48" height="262" rx="12" fill="#c58b52" stroke="#8f5e2c" stroke-width="6" />
    <circle cx="180" cy="120" r="120" fill="#69db7c" stroke="#2b8a3e" stroke-width="6" />
    {[[110, 80], [200, 50], [250, 130], [130, 160], [210, 170], [90, 130]].map(([x, y]) => <g><circle cx={x} cy={y} r="13" fill="#ff6b6b" stroke="#c92a2a" stroke-width="3" /><path d={`M${x} ${y - 13} v-6`} stroke="#2b8a3e" stroke-width="3" /></g>)}
    <path d="M90 200 V360 M150 200 V360" stroke="#868e96" stroke-width="4" /><rect x="80" y="356" width="80" height="14" rx="6" fill="#ffd43b" stroke="#f08c00" stroke-width="4" />
  </g>,
  // 공 풀장 [320,140]
  'ball:pit': () => <g>
    <rect x="10" y="40" width="300" height="94" rx="24" fill="#b197fc" stroke="#7048e8" stroke-width="7" />
    {Array.from({ length: 22 }, (_, i) => <circle cx={36 + (i % 11) * 25 + (i > 10 ? 12 : 0)} cy={i > 10 ? 64 : 48} r="13" fill={['#ff6b6b', '#ffd43b', '#4dabf7', '#69db7c', '#ff8fb8'][i % 5]} stroke="#fff" stroke-width="2" />)}
  </g>,
  'ball:bubble': () => <g>
    <rect x="110" y="70" width="100" height="64" rx="14" fill="#74c0fc" stroke="#1971c2" stroke-width="6" /><circle cx="210" cy="96" r="18" fill="#a5d8ff" stroke="#1971c2" stroke-width="5" />
    {[[250, 60, 20], [290, 30, 14], [240, 20, 10], [300, 80, 9], [180, 30, 16]].map(([x, y, r]) => <circle cx={x} cy={y} r={r} fill="#e7f5ff" stroke="#74c0fc" stroke-width="3" opacity=".9" class="bubble-float" />)}
  </g>,
  // 모래성 [300,140]
  'sand:castle': () => <g>
    <ellipse cx="150" cy="120" rx="140" ry="20" fill="#ffe8a3" stroke="#c99a3a" stroke-width="5" />
    <path d="M90 118 V60 h120 v58 z" fill="#ffd8a8" stroke="#c99a3a" stroke-width="5" />
    {[70, 130, 190].map(x => <path d={`M${x} 60 v-12 h20 v12 h20 v-12 h20 v12`} fill="none" stroke="#c99a3a" stroke-width="5" />)}
    <path d="M150 60 V20" stroke="#868e96" stroke-width="4" /><path d="M150 20 l26 8 -26 8 z" fill="#ff6b6b" /><rect x="138" y="86" width="24" height="32" rx="10" fill="#c99a3a" />
  </g>,
  'sand:bucket': () => <g>
    <ellipse cx="150" cy="120" rx="140" ry="20" fill="#ffe8a3" stroke="#c99a3a" stroke-width="5" />
    <path d="M60 50 h70 l-10 66 h-50 z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="5" stroke-linejoin="round" /><path d="M64 50 q32 -40 64 0" stroke="#495057" stroke-width="4" fill="none" />
    <path d="M200 116 l30 -80" stroke="#4dabf7" stroke-width="10" stroke-linecap="round" /><path d="M222 30 q20 -6 22 14 l-20 6 z" fill="#4dabf7" stroke="#1971c2" stroke-width="3" />
  </g>,
  // 돗자리 [340,120]
  'picnic:mat': () => <g>
    <path d="M20 40 L320 40 L300 114 L40 114 Z" fill="#ff8787" stroke="#c92a2a" stroke-width="5" stroke-linejoin="round" />
    {[60, 110, 160, 210, 260].map(x => <path d={`M${x} 40 L${x - 6} 114`} stroke="#fff" stroke-width="10" opacity=".7" />)}
    <path d="M28 62 H314 M34 88 H306" stroke="#fff" stroke-width="10" opacity=".7" />
    <rect x="250" y="20" width="56" height="40" rx="8" fill="#e9b886" stroke={O} stroke-width="4" /><path d="M260 20 q18 -22 36 0" stroke={O} stroke-width="4" fill="none" />
  </g>,
  'picnic:tent': () => <g>
    <path d="M60 114 L170 6 L280 114 Z" fill="#ffd43b" stroke="#f08c00" stroke-width="6" stroke-linejoin="round" />
    <path d="M170 6 L140 114 h60 z" fill="#ff922b" opacity=".6" /><path d="M150 114 L170 50 L190 114" fill="#8f5e2c" />
    <path d="M30 114 H310" stroke="#2f9e44" stroke-width="6" stroke-linecap="round" />
  </g>,
  // 꽃밭 [340,120]
  'flower:tulip': () => <g>
    <ellipse cx="170" cy="104" rx="160" ry="16" fill="#8ce99a" />
    {Array.from({ length: 9 }, (_, i) => { const x = 30 + i * 35, c = ['#ff6b6b', '#ffd43b', '#ff8fb8', '#b197fc'][i % 4]; return <g><path d={`M${x} 104 V60`} stroke="#2f9e44" stroke-width="5" /><path d={`M${x - 12} 58 q12 -36 24 0 q-6 10 -12 4 q-6 6 -12 -4 z`} fill={c} stroke="#00000033" stroke-width="2" /></g>; })}
  </g>,
  'flower:fence': () => <g>
    {Array.from({ length: 8 }, (_, i) => <path d={`M${24 + i * 42} 118 V44 l14 -16 14 16 V118`} fill="#fff" stroke="#adb5bd" stroke-width="4" stroke-linejoin="round" />)}
    <path d="M20 70 H330 M20 100 H330" stroke="#adb5bd" stroke-width="6" />
    {[[90, 30], [230, 22]].map(([x, y]) => <g transform={`translate(${x} ${y})`}><g class="butterfly"><path d="M0 0 q-20 -20 -24 4 q4 16 24 -4 q20 -20 24 4 q-4 16 -24 -4" fill="#ff8fb8" stroke="#e2477f" stroke-width="2" /></g></g>)}
  </g>,
};

/** 가구·기구 그림 (없는 id면 빈 그림) */
export function FurnArt({ id }: { id: string }) {
  const f = ART[id];
  return f ? f() : <g />;
}
export const hasArt = (id: string) => !!ART[id];
