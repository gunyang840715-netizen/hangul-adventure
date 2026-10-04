// 실제 품종을 닮은 강아지 5종·고양이 5종 (200x200 좌표). 성장 단계와 꾸미기 아이템을 함께 그린다.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { onSpeaking } from '../engine/audio';
import { PET, MAX_LEVEL, type Stage, type Slot } from '../data/pets';

export type Mood = 'happy' | 'wow' | 'think' | 'sleep' | 'love';
export type Motion = 'bob' | 'jump' | 'cheer' | 'wiggle' | 'none' | 'fly' | 'hop';
export type Wear = Partial<Record<Slot, string>>;

interface Look {
  fur: string;      // 기본 털
  dark: string;     // 진한 털(귀·무늬)
  line: string;     // 테두리
  light: string;    // 밝은 털(주둥이·가슴)
  inner: string;    // 귀 안쪽
  nose: string;
  eye?: string;     // 눈동자 색 (없으면 까만 눈)
  whisker?: string;
  paw?: string;     // 발 색
}

const LOOK: Record<string, Look> = {
  maltese: { fur: '#fffdfa', dark: '#f1e7ef', line: '#bdb0c2', light: '#ffffff', inner: '#ffd6e4', nose: '#2b2230' },
  poodle: { fur: '#e3a86e', dark: '#c98a4e', line: '#9b612f', light: '#f4cf9f', inner: '#e3a86e', nose: '#3b2620' },
  corgi: { fur: '#f3a557', dark: '#e28d3c', line: '#c27530', light: '#fffdf7', inner: '#ffc9d8', nose: '#2b2230' },
  shiba: { fur: '#e08a3c', dark: '#c9722b', line: '#aa5f25', light: '#fff2df', inner: '#fff2df', nose: '#2b2230' },
  schnauzer: { fur: '#949eab', dark: '#737d8b', line: '#565f6c', light: '#eceff3', inner: '#737d8b', nose: '#23252b', paw: '#eceff3' },
  koshort: { fur: '#f9c17c', dark: '#e48b36', line: '#c26f26', light: '#fffaf2', inner: '#ffb8cc', nose: '#ff8fab', whisker: '#c26f26' },
  russian: { fur: '#abb8c8', dark: '#8c9bb0', line: '#66768c', light: '#c3cedb', inner: '#e8bccb', nose: '#8a8aa8', eye: '#5cbf62', whisker: '#eef3f8' },
  siamese: { fur: '#fbf1e2', dark: '#7a5847', line: '#8b6a57', light: '#fffaf2', inner: '#c69a84', nose: '#4b3128', eye: '#4aa6ff', whisker: '#f3e8da', paw: '#7a5847' },
  fold: { fur: '#dbe0e8', dark: '#8f99a8', line: '#6d7787', light: '#f7f8fb', inner: '#e9c6d2', nose: '#ff9db4', eye: '#e8a33c', whisker: '#6d7787' },
  persian: { fur: '#fffcfa', dark: '#f0e6ec', line: '#c4b6c3', light: '#ffffff', inner: '#ffd0de', nose: '#ff9db4', eye: '#e8943e', whisker: '#c4b6c3' },
};

/** 겹친 동그라미로 복슬복슬한 모양 (바깥 테두리만 보이게) */
function Fluff({ c, fill, line, w = 4 }: { c: [number, number, number][]; fill: string; line: string; w?: number }) {
  return (
    <g>
      {c.map(([x, y, r]) => <circle cx={x} cy={y} r={r} fill={line} stroke={line} stroke-width={w} />)}
      {c.map(([x, y, r]) => <circle cx={x} cy={y} r={r} fill={fill} />)}
    </g>
  );
}
const mirror = (c: [number, number, number][]) => c.map(([x, y, r]) => [200 - x, y, r] as [number, number, number]);

let uid = 0;

interface Props {
  pet: string;              // 품종 id
  size?: number;
  mood?: Mood;
  motion?: Motion;
  wear?: Wear;
  stage?: Stage;
  level?: number;           // 1~10: 레벨마다 조금씩 자람 (없으면 단계로 짐작)
  talk?: boolean;
  autoTalk?: boolean;
  class?: string;
  style?: any;
  flip?: boolean;           // 좌우 뒤집기
}

/** 자람 정도 0(아주 아기)~1(다 큰 어른): 레벨마다 조금씩 */
export function growthOf(level?: number, stage: Stage = 'adult') {
  const lv = level ?? (stage === 'baby' ? 1 : stage === 'kid' ? 5 : MAX_LEVEL);
  return Math.max(0, Math.min(1, (lv - 1) / (MAX_LEVEL - 1)));
}

export function Pet({ pet, size = 220, mood = 'happy', motion = 'bob', wear = {}, stage = 'adult', level, talk, autoTalk = true, class: cls = '', style, flip }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [id] = useState(() => 'pt' + (++uid));
  useEffect(() => (autoTalk ? onSpeaking(setSpeaking) : undefined) as any, [autoTalk]);
  const talking = talk ?? speaking;
  const def = PET[pet] ?? PET.maltese;
  const L = LOOK[def.id];
  const cat = def.species === 'cat';
  // 레벨이 오를 때마다 조금씩: 몸이 커지고, 머리·눈 비율은 아기처럼 크다가 점점 어른처럼
  const g = growthOf(level, stage);
  const S = 0.6 + 0.4 * g;                 // 몸 크기
  const H = 1.24 - 0.24 * g;               // 몸에 비해 머리 크기 (아기일수록 큼)
  const E = 1.22 - 0.22 * g;               // 눈 크기 (아기일수록 동글동글 큼)
  const T = 0.55 + 0.45 * g;               // 꼬리 길이
  const Y = 0.82 + 0.18 * g;               // 귀 크기
  return (
    <div class={`mascot m-${motion} ${cls}`} style={{ width: size, height: size, ...style }} data-pet={def.id} data-stage={stage} data-grow={g.toFixed(2)}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}>
        <defs>
          <radialGradient id={`${id}-sh`} cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".85" /><stop offset="1" stop-color="#fff" stop-opacity="0" /></radialGradient>
          <clipPath id={`${id}-body`}><ellipse cx="100" cy="158" rx="46" ry="34" /></clipPath>
          <linearGradient id={`${id}-rb`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#ff6b6b" /><stop offset=".25" stop-color="#ffd43b" /><stop offset=".5" stop-color="#69db7c" /><stop offset=".75" stop-color="#4dabf7" /><stop offset="1" stop-color="#b197fc" />
          </linearGradient>
        </defs>
        <ellipse class="mg-shadow" cx="100" cy="194" rx={52 * S} ry="7" fill="#000" opacity=".12" />
        {wear.toy && <g class="pt-toy"><Toy k={wear.toy} /></g>}
        <g transform={`translate(100 196) scale(${S}) translate(-100 -196)`}>
          {wear.clothes === 'cape' && <CapeBack />}
          <g transform={`translate(138 160) scale(${T}) translate(-138 -160)`}><g class={cat ? 'pt-tail-cat' : 'pt-tail'}><Tail pet={def.id} L={L} /></g></g>
          <Body pet={def.id} L={L} />
          {wear.clothes && <Clothes k={wear.clothes} clip={`url(#${id}-body)`} />}
          <Paws L={L} />
          {wear.shoes && <Shoes k={wear.shoes} />}
          {wear.neck && <Neck k={wear.neck} />}
          <g transform={`translate(100 150) scale(${H}) translate(-100 -150)`}>
            <g transform={`translate(100 100) scale(${Y}) translate(-100 -100)`}><EarsBack pet={def.id} L={L} /></g>
            <Head pet={def.id} L={L} />
            <Marks pet={def.id} L={L} />
            <ellipse cx="60" cy="113" rx="12" ry="7.5" fill="#ff7fb0" opacity=".5" />
            <ellipse cx="140" cy="113" rx="12" ry="7.5" fill="#ff7fb0" opacity=".5" />
            <Eyes mood={mood} L={L} pet={def.id} k={E} />
            <Nose pet={def.id} L={L} />
            <Mouth cat={cat} mood={mood} talking={talking} pet={def.id} />
            <g transform={`translate(100 100) scale(${Y}) translate(-100 -100)`}><EarsFront pet={def.id} L={L} /></g>
            <ellipse cx="80" cy="60" rx="20" ry="11" fill={`url(#${id}-sh)`} transform="rotate(-20 80 60)" />
            {wear.glasses && <Glasses k={wear.glasses} rb={`url(#${id}-rb)`} />}
            {wear.hat && <Hat k={wear.hat} pet={def.id} />}
          </g>
        </g>
      </svg>
    </div>
  );
}

// ======================= 몸 =======================
function Body({ pet, L }: { pet: string; L: Look }) {
  const belly = pet === 'shiba' || pet === 'corgi' || pet === 'koshort' || pet === 'siamese' || pet === 'schnauzer';
  return (
    <g>
      {pet === 'persian' || pet === 'maltese'
        ? <Fluff c={[[100, 158, 40], [66, 152, 16], [134, 152, 16], [70, 172, 16], [130, 172, 16], [100, 180, 16]]} fill={L.fur} line={L.line} />
        : <ellipse cx="100" cy="158" rx="46" ry="34" fill={L.fur} stroke={L.line} stroke-width="4" />}
      {pet === 'poodle' && <g fill="none" stroke={L.dark} stroke-width="2.4" stroke-linecap="round" opacity=".7">
        {[[76, 146], [96, 138], [118, 146], [70, 166], [90, 160], [112, 164], [130, 170], [100, 178]].map(([x, y]) => <path d={`M${x - 5} ${y} a5 5 0 1 1 7 4`} />)}
      </g>}
      {belly ? <ellipse cx="100" cy="164" rx="27" ry="22" fill={L.light} /> : <ellipse cx="100" cy="164" rx="25" ry="19" fill="#fff" opacity=".55" />}
      {pet === 'koshort' && <g fill={L.dark} opacity=".6"><path d="M58 150 q10 2 14 8 q-10 0 -14 -8z" /><path d="M142 150 q-10 2 -14 8 q10 0 14 -8z" /><path d="M60 166 q9 1 12 6 q-9 0 -12 -6z" /><path d="M140 166 q-9 1 -12 6 q9 0 12 -6z" /></g>}
      {pet === 'fold' && <g fill={L.dark} opacity=".55"><path d="M58 148 q12 2 16 9 q-12 0 -16 -9z" /><path d="M142 148 q-12 2 -16 9 q12 0 16 -9z" /><path d="M60 166 q10 1 13 7 q-10 0 -13 -7z" /><path d="M140 166 q-10 1 -13 7 q10 0 13 -7z" /></g>}
    </g>
  );
}

function Paws({ L }: { L: Look }) {
  const f = L.paw ?? L.fur;
  return (
    <g>
      <ellipse cx="80" cy="186" rx="15" ry="10" fill={f} stroke={L.line} stroke-width="3.5" />
      <ellipse cx="120" cy="186" rx="15" ry="10" fill={f} stroke={L.line} stroke-width="3.5" />
      <g fill={L.line} opacity=".35"><circle cx="75" cy="187" r="2.4" /><circle cx="80" cy="185" r="2.4" /><circle cx="85" cy="187" r="2.4" /><circle cx="115" cy="187" r="2.4" /><circle cx="120" cy="185" r="2.4" /><circle cx="125" cy="187" r="2.4" /></g>
    </g>
  );
}

function Tail({ pet, L }: { pet: string; L: Look }) {
  const s = { stroke: L.line, 'stroke-width': 3.5, 'stroke-linejoin': 'round' } as any;
  switch (pet) {
    case 'maltese': return <Fluff c={[[146, 146, 11], [156, 134, 12], [160, 120, 11], [154, 108, 9]]} fill={L.fur} line={L.line} w={3.5} />;
    case 'poodle': return <g><path d="M138 150 L 152 128" stroke={L.line} stroke-width="7" stroke-linecap="round" /><path d="M138 150 L 152 128" stroke={L.fur} stroke-width="3" stroke-linecap="round" /><Fluff c={[[154, 122, 13], [146, 116, 8], [162, 116, 8]]} fill={L.fur} line={L.line} w={3.5} /></g>;
    case 'corgi': return <Fluff c={[[146, 150, 11], [156, 144, 10]]} fill={L.fur} line={L.line} w={3.5} />;
    case 'shiba': return <g><circle cx="152" cy="128" r="20" fill={L.fur} {...s} /><circle cx="154" cy="126" r="8" fill={L.light} /><path d="M136 150 C 132 140, 134 132, 140 126" fill="none" stroke={L.line} stroke-width="3.5" /></g>;
    case 'schnauzer': return <path d="M138 142 C 142 128, 146 118, 150 112 C 156 114, 156 122, 150 130 C 148 136, 146 142, 144 148 Z" fill={L.fur} {...s} />;
    case 'koshort': return <g><path d="M140 168 C 178 170, 186 132, 168 108 C 164 104, 158 108, 161 114 C 172 134, 164 156, 138 156 Z" fill={L.fur} {...s} /><g stroke={L.dark} stroke-width="4" stroke-linecap="round" opacity=".75"><path d="M158 158 l6 -6" /><path d="M167 146 l7 -3" /><path d="M170 130 l7 0" /></g></g>;
    case 'russian': return <path d="M140 168 C 178 170, 186 132, 168 108 C 164 104, 158 108, 161 114 C 172 134, 164 156, 138 156 Z" fill={L.fur} {...s} />;
    case 'siamese': return <path d="M140 168 C 178 170, 186 132, 168 108 C 164 104, 158 108, 161 114 C 172 134, 164 156, 138 156 Z" fill={L.dark} {...s} />;
    case 'fold': return <g><path d="M140 168 C 176 172, 188 140, 176 118 C 170 110, 162 116, 166 124 C 172 140, 164 158, 138 156 Z" fill={L.fur} {...s} /><g stroke={L.dark} stroke-width="4" stroke-linecap="round" opacity=".7"><path d="M160 160 l5 -6" /><path d="M170 148 l7 -2" /><path d="M174 132 l6 1" /></g></g>;
    case 'persian': return <Fluff c={[[146, 158, 12], [160, 148, 13], [168, 132, 13], [168, 116, 11]]} fill={L.fur} line={L.line} w={3.5} />;
  }
  return null;
}

// ======================= 머리 =======================
function EarsBack({ pet, L }: { pet: string; L: Look }) {
  const s = { stroke: L.line, 'stroke-width': 4, 'stroke-linejoin': 'round' } as any;
  switch (pet) {
    case 'maltese': {
      const ear = [[48, 70, 14], [40, 88, 15], [36, 108, 15], [38, 128, 14], [44, 144, 12], [56, 146, 10]] as [number, number, number][];
      return <g><g class="pt-ear-l"><Fluff c={ear} fill={L.fur} line={L.line} /></g><g class="pt-ear-r"><Fluff c={mirror(ear)} fill={L.fur} line={L.line} /></g></g>;
    }
    case 'poodle': {
      const ear = [[46, 74, 14], [40, 94, 15], [40, 116, 15], [44, 136, 13], [54, 148, 10]] as [number, number, number][];
      return <g><g class="pt-ear-l"><Fluff c={ear} fill={L.dark} line={L.line} /></g><g class="pt-ear-r"><Fluff c={mirror(ear)} fill={L.dark} line={L.line} /></g></g>;
    }
    case 'corgi': return (
      <g>
        <g class="pt-ear-l"><path d="M46 80 C 34 54, 36 18, 50 6 C 66 14, 84 38, 88 56 Z" fill={L.fur} {...s} /><path d="M52 66 C 46 48, 48 28, 54 20 C 64 30, 74 44, 76 54 Z" fill={L.inner} /></g>
        <g class="pt-ear-r"><path d="M154 80 C 166 54, 164 18, 150 6 C 134 14, 116 38, 112 56 Z" fill={L.fur} {...s} /><path d="M148 66 C 154 48, 152 28, 146 20 C 136 30, 126 44, 124 54 Z" fill={L.inner} /></g>
      </g>
    );
    case 'shiba': return (
      <g>
        <g class="pt-ear-l"><path d="M48 70 C 46 50, 52 34, 60 26 C 72 32, 84 42, 90 52 Z" fill={L.fur} {...s} /><path d="M56 60 C 56 48, 58 40, 62 36 C 70 40, 78 46, 80 52 Z" fill={L.light} /></g>
        <g class="pt-ear-r"><path d="M152 70 C 154 50, 148 34, 140 26 C 128 32, 116 42, 110 52 Z" fill={L.fur} {...s} /><path d="M144 60 C 144 48, 142 40, 138 36 C 130 40, 122 46, 120 52 Z" fill={L.light} /></g>
      </g>
    );
    case 'koshort': case 'russian': case 'siamese': {
      const f = pet === 'siamese' ? L.dark : L.fur;
      return (
        <g>
          <g class="pt-ear-l"><path d="M46 70 L 50 22 L 90 48 Z" fill={f} {...s} /><path d="M54 60 L 56 34 L 80 50 Z" fill={L.inner} /></g>
          <g class="pt-ear-r"><path d="M154 70 L 150 22 L 110 48 Z" fill={f} {...s} /><path d="M146 60 L 144 34 L 120 50 Z" fill={L.inner} /></g>
        </g>
      );
    }
    case 'persian': return (
      <g>
        <g class="pt-ear-l"><path d="M50 62 L 54 34 L 84 50 Z" fill={L.fur} {...s} /><path d="M57 55 L 59 42 L 75 51 Z" fill={L.inner} /></g>
        <g class="pt-ear-r"><path d="M150 62 L 146 34 L 116 50 Z" fill={L.fur} {...s} /><path d="M143 55 L 141 42 L 125 51 Z" fill={L.inner} /></g>
      </g>
    );
  }
  return null;
}

/** 머리 위로 접힌 귀 (슈나우저·스코티시 폴드) */
function EarsFront({ pet, L }: { pet: string; L: Look }) {
  const s = { stroke: L.line, 'stroke-width': 4, 'stroke-linejoin': 'round' } as any;
  if (pet === 'schnauzer') return (
    <g>
      <g class="pt-ear-l"><path d="M44 58 C 50 38, 70 34, 88 42 C 80 52, 70 64, 60 80 C 54 72, 48 66, 44 58 Z" fill={L.dark} {...s} /></g>
      <g class="pt-ear-r"><path d="M156 58 C 150 38, 130 34, 112 42 C 120 52, 130 64, 140 80 C 146 72, 152 66, 156 58 Z" fill={L.dark} {...s} /></g>
    </g>
  );
  if (pet === 'fold') return (
    <g>
      <g class="pt-ear-l"><path d="M54 56 C 54 40, 70 34, 84 42 C 80 50, 72 56, 62 60 Z" fill={L.fur} {...s} /><path d="M60 52 C 62 44, 70 42, 76 45" fill="none" stroke={L.dark} stroke-width="3" stroke-linecap="round" /></g>
      <g class="pt-ear-r"><path d="M146 56 C 146 40, 130 34, 116 42 C 120 50, 128 56, 138 60 Z" fill={L.fur} {...s} /><path d="M140 52 C 138 44, 130 42, 124 45" fill="none" stroke={L.dark} stroke-width="3" stroke-linecap="round" /></g>
    </g>
  );
  return null;
}

function Head({ pet, L }: { pet: string; L: Look }) {
  switch (pet) {
    case 'poodle':
      return <Fluff c={[[100, 92, 58], [76, 42, 15], [92, 34, 16], [108, 34, 16], [124, 42, 15], [100, 26, 13], [64, 56, 12], [136, 56, 12]]} fill={L.fur} line={L.line} />;
    case 'maltese':
      return <g><Fluff c={[[100, 92, 58], [92, 38, 10], [106, 34, 11], [118, 40, 9]]} fill={L.fur} line={L.line} /></g>;
    case 'persian':
      return <Fluff c={[[100, 94, 56], [48, 110, 14], [152, 110, 14], [56, 128, 14], [144, 128, 14], [72, 142, 13], [128, 142, 13], [100, 148, 13], [48, 88, 12], [152, 88, 12]]} fill={L.fur} line={L.line} />;
    case 'fold':
      return <ellipse cx="100" cy="94" rx="63" ry="54" fill={L.fur} stroke={L.line} stroke-width="4" />;
    default: {
      const cat = PET[pet]?.species === 'cat';
      return <ellipse cx="100" cy={cat ? 92 : 91} rx={cat ? 62 : 60} ry={cat ? 52 : 54} fill={L.fur} stroke={L.line} stroke-width="4" />;
    }
  }
}

/** 얼굴 무늬·주둥이 */
function Marks({ pet, L }: { pet: string; L: Look }) {
  switch (pet) {
    case 'maltese': case 'poodle':
      return <ellipse cx="100" cy="117" rx="26" ry="18" fill={L.light} stroke={L.line} stroke-width="2.5" />;
    case 'corgi': return (
      <g>
        <path d="M100 40 C 93 42, 91 58, 94 70 C 80 86, 62 100, 64 120 C 70 142, 130 142, 136 120 C 138 100, 120 86, 106 70 C 109 58, 107 42, 100 40 Z" fill={L.light} />
        <ellipse cx="100" cy="117" rx="26" ry="18" fill={L.light} stroke={L.line} stroke-width="2.5" />
      </g>
    );
    case 'shiba': return (
      <g>
        <path d="M58 104 C 66 92, 86 96, 100 102 C 114 96, 134 92, 142 104 C 148 126, 128 144, 100 144 C 72 144, 52 126, 58 104 Z" fill={L.light} />
        <ellipse cx="80" cy="72" rx="6.5" ry="4" fill={L.light} /><ellipse cx="120" cy="72" rx="6.5" ry="4" fill={L.light} />
        <ellipse cx="100" cy="117" rx="25" ry="17" fill={L.light} stroke={L.line} stroke-width="2" opacity=".9" />
      </g>
    );
    case 'schnauzer': return (
      <g>
        <path d="M68 108 C 70 96, 90 96, 100 102 C 110 96, 130 96, 132 108 C 138 130, 124 156, 100 160 C 76 156, 62 130, 68 108 Z" fill={L.light} stroke={L.line} stroke-width="2.5" />
        <g stroke={L.line} stroke-width="1.8" stroke-linecap="round" opacity=".45" fill="none"><path d="M86 136 l-2 12" /><path d="M100 140 v14" /><path d="M114 136 l2 12" /><path d="M76 124 l-4 8" /><path d="M124 124 l4 8" /></g>
        <path d="M62 82 C 64 70, 84 64, 94 76 C 84 74, 72 76, 62 82 Z" fill={L.light} stroke={L.line} stroke-width="2" />
        <path d="M138 82 C 136 70, 116 64, 106 76 C 116 74, 128 76, 138 82 Z" fill={L.light} stroke={L.line} stroke-width="2" />
      </g>
    );
    case 'koshort': return (
      <g>
        <g fill={L.dark} opacity=".8"><path d="M100 42 q-5 12 0 22 q5 -10 0 -22z" /><path d="M86 44 q-7 9 -3 18 q6 -8 3 -18z" /><path d="M114 44 q7 9 3 18 q-6 -8 -3 -18z" /><path d="M40 88 q12 2 18 8 q-12 2 -18 -8z" /><path d="M160 88 q-12 2 -18 8 q12 2 18 -8z" /><path d="M42 102 q10 1 15 6 q-10 1 -15 -6z" /><path d="M158 102 q-10 1 -15 6 q10 1 15 -6z" /></g>
        <ellipse cx="100" cy="116" rx="24" ry="15" fill={L.light} />
      </g>
    );
    case 'russian': return <ellipse cx="100" cy="115" rx="22" ry="14" fill={L.light} opacity=".7" />;
    case 'siamese': return (
      <g>
        <defs><radialGradient id="siam-mask" cx="50%" cy="55%" r="55%"><stop offset="0" stop-color={L.dark} stop-opacity=".95" /><stop offset=".65" stop-color={L.dark} stop-opacity=".75" /><stop offset="1" stop-color={L.dark} stop-opacity="0" /></radialGradient></defs>
        <ellipse cx="100" cy="106" rx="42" ry="36" fill="url(#siam-mask)" />
      </g>
    );
    case 'fold': return (
      <g>
        <g fill={L.dark} opacity=".75"><path d="M100 46 q-5 12 0 22 q5 -10 0 -22z" /><path d="M86 50 q-6 8 -3 16 q6 -7 3 -16z" /><path d="M114 50 q6 8 3 16 q-6 -7 -3 -16z" /><path d="M40 92 q12 2 18 8 q-12 2 -18 -8z" /><path d="M160 92 q-12 2 -18 8 q12 2 18 -8z" /></g>
        <ellipse cx="100" cy="118" rx="23" ry="15" fill={L.light} />
      </g>
    );
    case 'persian': return <ellipse cx="100" cy="112" rx="20" ry="13" fill={L.light} />;
  }
  return null;
}

function Nose({ pet, L }: { pet: string; L: Look }) {
  const cat = PET[pet]?.species === 'cat';
  if (cat) {
    const y = pet === 'persian' ? 102 : 106;
    return (
      <g>
        <path d={`M94 ${y} Q100 ${y - 4} 106 ${y} Q103 ${y + 6} 100 ${y + 7} Q97 ${y + 6} 94 ${y} Z`} fill={L.nose} stroke={pet === 'siamese' ? '#2e1d17' : '#e5678c'} stroke-width="1.5" />
        <g stroke={L.whisker ?? L.line} stroke-width="2.4" stroke-linecap="round" opacity=".85">
          <path d="M58 108 L 34 102" /><path d="M58 116 L 32 118" /><path d="M142 108 L 166 102" /><path d="M142 116 L 168 118" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <path d="M90 105 Q100 98 110 105 Q108 114 100 115 Q92 114 90 105 Z" fill={L.nose} />
      <ellipse cx="96" cy="104" rx="4" ry="2.2" fill="#fff" opacity=".7" />
    </g>
  );
}

function Eyes({ mood, L, pet, k = 1 }: { mood: Mood; L: Look; pet: string; k?: number }) {
  const dark = pet === 'siamese' ? '#f7eee4' : '#3b2a4a';
  if (mood === 'sleep') return <g stroke={dark} stroke-width="4" fill="none" stroke-linecap="round"><path d="M68 94 q10 7 20 0" /><path d="M112 94 q10 7 20 0" /></g>;
  if (mood === 'love') return <g fill="#ff4f8b">{[78, 122].map(x => <path d={`M${x} 104 l-11 -11 a6.5 6.5 0 0 1 11 -8 a6.5 6.5 0 0 1 11 8 z`} />)}</g>;
  const ry = (mood === 'wow' ? 14 : 12.5) * k;
  const rx = 10.5 * k;
  const brows = pet === 'schnauzer' ? null : mood === 'think'
    ? <path d="M67 79 q9 -6 18 -7 M133 79 q-9 -6 -18 -7" fill="none" stroke={dark} stroke-width="3.5" stroke-linecap="round" />
    : null;
  return (
    <g class="mg-eyes" style={{ transformOrigin: '100px 92px' }}>
      {[78, 122].map(x => (
        <g>
          {L.eye
            ? <g><ellipse cx={x} cy={92} rx={rx} ry={ry} fill={L.eye} stroke="#2b1f33" stroke-width="2" /><ellipse cx={x} cy={93} rx={5 * k} ry={ry - 4 * k} fill="#1f1726" /></g>
            : <ellipse cx={x} cy={92} rx={rx} ry={ry} fill="#2b1f33" />}
          {/* 반짝이는 눈빛 (크게 하나, 작게 둘) */}
          <circle cx={x - 3.6 * k} cy={92 - 5.6 * k} r={4.4 * k} fill="#fff" />
          <circle cx={x + 3.9 * k} cy={92 + 4.8 * k} r={2.1 * k} fill="#fff" opacity=".9" />
          <circle cx={x + 4.6 * k} cy={92 - 6.4 * k} r={1.3 * k} fill="#fff" opacity=".85" />
        </g>
      ))}
      {brows}
    </g>
  );
}

function Mouth({ cat, mood, talking, pet }: { cat: boolean; mood: Mood; talking: boolean; pet: string }) {
  const y = cat ? (pet === 'persian' ? 112 : 116) : 120;
  const c = pet === 'siamese' ? '#2e1d17' : '#6b2c47';
  if (talking) return <g class="mg-talk" style={{ transformOrigin: `100px ${y + 4}px` }}><ellipse cx="100" cy={y + 5} rx="8" ry="7" fill={c} /><ellipse cx="100" cy={y + 9} rx="5" ry="3.2" fill="#ff8fab" /></g>;
  if (mood === 'wow') return <ellipse cx="100" cy={y + 5} rx="6" ry="7" fill={c} />;
  if (mood === 'think' || mood === 'sleep') return <path d={`M94 ${y + 4} q6 3 12 0`} stroke={c} stroke-width="3" fill="none" stroke-linecap="round" />;
  return (
    <g>
      <path d={`M88 ${y} q6 8 12 0 q6 8 12 0`} stroke={c} stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      {!cat && mood === 'happy' && <path d={`M96 ${y + 4} q4 10 8 0 z`} fill="#ff7aa2" stroke="#e5678c" stroke-width="1.5" />}
    </g>
  );
}

// ======================= 꾸미기 아이템 =======================
export function Hat({ k, pet }: { k: string; pet?: string }) {
  // 복슬머리 강아지는 조금 위로
  const up = pet === 'poodle' ? -12 : pet === 'maltese' ? -4 : pet === 'corgi' ? -2 : 0;
  return <g transform={`translate(0 ${up - 4})`}>{hatArt(k)}</g>;
}
function hatArt(k: string): JSX.Element | null {
  switch (k) {
    case 'crown': return <g transform="translate(0 6)"><path d="M66 44 L70 12 L86 30 L100 6 L114 30 L130 12 L134 44 Z" fill="#ffd43b" stroke="#e0a800" stroke-width="3.5" stroke-linejoin="round" /><circle cx="100" cy="30" r="5" fill="#ff5c8a" /><circle cx="80" cy="36" r="3.5" fill="#4dabf7" /><circle cx="120" cy="36" r="3.5" fill="#69db7c" /></g>;
    case 'bow': return <g transform="translate(66 46) rotate(-15)"><path d="M0 0 C -30 -24, -34 22, 0 6 C 30 22, 34 -24, 0 0Z" fill="#ff6fa8" stroke="#e2477f" stroke-width="3" /><circle r="7" fill="#ff8fbd" stroke="#e2477f" stroke-width="3" /></g>;
    case 'flower': return <g transform="translate(0 8)">{[60, 80, 100, 120, 140].map((x, i) => <g transform={`translate(${x} ${34 + Math.abs(i - 2) * 7})`}>{[0, 72, 144, 216, 288].map(a => <circle cx={Math.cos(a * Math.PI / 180) * 7} cy={Math.sin(a * Math.PI / 180) * 7} r="6" fill={['#ff9ec7', '#ffd43b', '#b197fc', '#74c0fc', '#ff8787'][i]} />)}<circle r="4.5" fill="#fff3bf" /></g>)}</g>;
    case 'wizard': return <g><path d="M60 44 Q100 58 140 44 L108 -28 Q104 -34 98 -26 Z" fill="#845ef7" stroke="#5f3dc4" stroke-width="3.5" stroke-linejoin="round" /><path d="M52 46 Q100 64 148 46" stroke="#5f3dc4" stroke-width="8" fill="none" stroke-linecap="round" /><path d="M96 10 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1z" fill="#ffd43b" /><circle cx="115" cy="30" r="3" fill="#ffd43b" /></g>;
    case 'party': return <g><path d="M78 42 L100 -12 L122 42 Z" fill="#74c0fc" stroke="#339af0" stroke-width="3" stroke-linejoin="round" /><path d="M86 24 L114 30 M92 8 L108 12" stroke="#fff" stroke-width="5" /><circle cx="100" cy="-14" r="7" fill="#ffd43b" /></g>;
    case 'chef': return <g transform="translate(0 10)"><rect x="72" y="22" width="56" height="20" rx="4" fill="#fff" stroke="#ced4da" stroke-width="3" /><circle cx="80" cy="14" r="14" fill="#fff" stroke="#ced4da" stroke-width="3" /><circle cx="100" cy="6" r="16" fill="#fff" stroke="#ced4da" stroke-width="3" /><circle cx="120" cy="14" r="14" fill="#fff" stroke="#ced4da" stroke-width="3" /><rect x="74" y="20" width="52" height="8" fill="#fff" /></g>;
    case 'cap': return <g><path d="M62 50 C 60 16, 140 16, 138 50 Z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="3.5" stroke-linejoin="round" /><path d="M100 22 V50 M80 26 C 78 34, 78 42, 80 50 M120 26 C 122 34, 122 42, 120 50" stroke="#c92a2a" stroke-width="2" fill="none" opacity=".6" /><path d="M118 48 C 140 44, 164 46, 174 54 C 160 60, 134 58, 118 56 Z" fill="#ff8787" stroke="#c92a2a" stroke-width="3.5" stroke-linejoin="round" /><circle cx="100" cy="19" r="4.5" fill="#c92a2a" /></g>;
    case 'beanie': return <g><path d="M58 58 C 54 18, 146 18, 142 58 Z" fill="#74c0fc" stroke="#1c7ed6" stroke-width="3.5" stroke-linejoin="round" /><path d="M76 30 v24 M92 24 v30 M108 24 v30 M124 30 v24" stroke="#1c7ed6" stroke-width="2" opacity=".45" /><rect x="54" y="50" width="92" height="14" rx="7" fill="#a5d8ff" stroke="#1c7ed6" stroke-width="3" /><circle cx="100" cy="16" r="12" fill="#fff" stroke="#1c7ed6" stroke-width="3" /></g>;
    case 'bunny': return <g><path d="M60 58 C 70 34, 130 34, 140 58" fill="none" stroke="#ff8fb8" stroke-width="7" stroke-linecap="round" /><g stroke="#e2477f" stroke-width="3"><ellipse cx="80" cy="4" rx="11" ry="30" fill="#fff" transform="rotate(-12 80 30)" /><ellipse cx="120" cy="4" rx="11" ry="30" fill="#fff" transform="rotate(12 120 30)" /></g><ellipse cx="80" cy="6" rx="5.5" ry="22" fill="#ffc9dd" transform="rotate(-12 80 30)" /><ellipse cx="120" cy="6" rx="5.5" ry="22" fill="#ffc9dd" transform="rotate(12 120 30)" /></g>;
    case 'fire': return <g><path d="M60 52 C 58 14, 142 14, 140 52 Z" fill="#fa5252" stroke="#c92a2a" stroke-width="3.5" stroke-linejoin="round" /><path d="M52 52 C 70 60, 130 60, 148 52 L150 58 C 130 68, 70 68, 50 58 Z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="3" stroke-linejoin="round" /><path d="M100 18 v34" stroke="#c92a2a" stroke-width="3" opacity=".45" /><path d="M100 22 l11 6 -2 13 -9 6 -9 -6 -2 -13 z" fill="#ffd43b" stroke="#e0a800" stroke-width="2.5" stroke-linejoin="round" /><circle cx="100" cy="34" r="3.2" fill="#e0a800" /><path d="M72 30 q6 -8 14 -10" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6" /></g>;
    case 'berry': return <g><path d="M64 52 C 60 24, 82 8, 100 8 C 118 8, 140 24, 136 52 Z" fill="#ff6b81" stroke="#e03151" stroke-width="3.5" stroke-linejoin="round" />{[[80, 30], [100, 24], [120, 30], [74, 44], [92, 40], [110, 40], [126, 44]].map(([x, y]) => <ellipse cx={x} cy={y} rx="2.2" ry="3.2" fill="#fff3bf" />)}<path d="M80 12 q10 -12 20 -4 q10 -8 20 4 q-10 6 -20 1 q-10 5 -20 -1z" fill="#51cf66" stroke="#2f9e44" stroke-width="2.5" stroke-linejoin="round" /><path d="M100 6 v-12" stroke="#2f9e44" stroke-width="3.5" stroke-linecap="round" /></g>;
    case 'straw': return <g><ellipse cx="100" cy="50" rx="66" ry="13" fill="#ffe08a" stroke="#d9a72b" stroke-width="3.5" /><path d="M72 50 C 70 18, 130 18, 128 50 Z" fill="#ffe08a" stroke="#d9a72b" stroke-width="3.5" stroke-linejoin="round" /><path d="M71 44 C 90 48, 110 48, 129 44 L129 38 C 110 42, 90 42, 71 38 Z" fill="#ff6b6b" /><g stroke="#d9a72b" stroke-width="1.5" opacity=".6"><path d="M50 50 h8 M142 50 h8 M88 26 l2 8 M110 26 l-2 8" /></g><circle cx="126" cy="41" r="6" fill="#fff" stroke="#ff6b6b" stroke-width="2.5" /></g>;
  }
  return null;
}

export function Glasses({ k, rb }: { k: string; rb?: string }) {
  switch (k) {
    case 'sun': return <g><path d="M58 84 h36 a4 4 0 0 1 4 4 v6 a13 13 0 0 1 -13 13 h-10 a13 13 0 0 1 -13 -13 v-6 a4 4 0 0 1 4 -4z M106 84 h36 a4 4 0 0 1 4 4 v6 a13 13 0 0 1 -13 13 h-10 a13 13 0 0 1 -13 -13 v-6 a4 4 0 0 1 4 -4z" fill="#1f1b24" stroke="#000" stroke-width="2.5" /><path d="M98 90 h4" stroke="#000" stroke-width="4" /><path d="M64 90 l8 -3 M112 90 l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7" /></g>;
    case 'rainbow': return <g><path d="M58 84 h36 a4 4 0 0 1 4 4 v6 a13 13 0 0 1 -13 13 h-10 a13 13 0 0 1 -13 -13 v-6 a4 4 0 0 1 4 -4z M106 84 h36 a4 4 0 0 1 4 4 v6 a13 13 0 0 1 -13 13 h-10 a13 13 0 0 1 -13 -13 v-6 a4 4 0 0 1 4 -4z" fill={rb ?? '#b197fc'} fill-opacity=".85" stroke="#7048e8" stroke-width="2.5" /><path d="M98 90 h4" stroke="#7048e8" stroke-width="4" /><path d="M64 90 l8 -3 M112 90 l8 -3" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8" /></g>;
    case 'heart': return <g fill="#ff8fab" fill-opacity=".55" stroke="#e64980" stroke-width="3.5">{[78, 122].map(x => <path d={`M${x} 108 l-15 -15 a8.5 8.5 0 0 1 15 -11 a8.5 8.5 0 0 1 15 11 z`} />)}<path d="M93 90 h14" fill="none" /></g>;
    case 'star': return <g fill="#ffd43b" fill-opacity=".55" stroke="#f08c00" stroke-width="3.5" stroke-linejoin="round">{[78, 122].map(x => <path d={`M${x} 76 l6 12 13 2 -9 9 2 13 -12 -6 -12 6 2 -13 -9 -9 13 -2z`} />)}<path d="M92 94 h16" fill="none" /></g>;
    case 'round': return <g fill="#e7f5ff" fill-opacity=".35" stroke="#9c6b3b" stroke-width="3"><circle cx="78" cy="92" r="15" /><circle cx="122" cy="92" r="15" /><path d="M93 90 q7 -5 14 0" fill="none" /><path d="M63 88 l-8 -3 M137 88 l8 -3" fill="none" /></g>;
  }
  return null;
}

export function Neck({ k }: { k: string }) {
  switch (k) {
    case 'bell': return <g><path d="M60 138 Q100 160 140 138" fill="none" stroke="#e03131" stroke-width="9" stroke-linecap="round" /><circle cx="100" cy="155" r="8" fill="#ffd43b" stroke="#e0a800" stroke-width="2.5" /><path d="M100 155 v6" stroke="#b8860b" stroke-width="2" /><circle cx="100" cy="153" r="1.8" fill="#b8860b" /></g>;
    case 'pearl': return <g>{Array.from({ length: 11 }, (_, i) => { const t = i / 10; const x = 62 + t * 76; const y = 140 + Math.sin(t * Math.PI) * 12; return <circle cx={x} cy={y} r="5" fill="#fff" stroke="#dee2e6" stroke-width="2" />; })}</g>;
    case 'bowtie': return <g transform="translate(100 146)"><path d="M0 0 L-22 -12 L-22 12 Z M0 0 L22 -12 L22 12 Z" fill="#ff6b6b" stroke="#c92a2a" stroke-width="3" stroke-linejoin="round" /><circle r="6" fill="#ff8787" stroke="#c92a2a" stroke-width="3" /></g>;
    case 'scarf': return <g><path d="M58 134 Q100 156 142 134 L144 146 Q100 168 56 146 Z" fill="#ff922b" stroke="#e8590c" stroke-width="3" /><path d="M118 148 l6 26 l14 -4 l-8 -24" fill="#ff922b" stroke="#e8590c" stroke-width="3" stroke-linejoin="round" /><path d="M70 142 l4 8 M84 147 l3 8 M100 150 v8" stroke="#ffd8a8" stroke-width="2.5" /></g>;
    case 'heart': return <g><path d="M64 138 Q100 158 136 138" fill="none" stroke="#fcc419" stroke-width="2.5" /><path d="M100 166 l-9 -9 a5.5 5.5 0 0 1 9 -7 a5.5 5.5 0 0 1 9 7 z" fill="#ff6b9a" stroke="#d6336c" stroke-width="2" /></g>;
    case 'bandana': return <g><path d="M58 136 Q100 152 142 136 L138 146 L100 182 L62 146 Z" fill="#fa5252" stroke="#c92a2a" stroke-width="3" stroke-linejoin="round" />{[[80, 148], [100, 152], [120, 148], [91, 163], [109, 163], [100, 174]].map(([x, y]) => <circle cx={x} cy={y} r="2.6" fill="#fff" />)}</g>;
    case 'ribbon': return <g><path d="M60 138 Q100 158 140 138" fill="none" stroke="#f783ac" stroke-width="8" stroke-linecap="round" /><g transform="translate(100 154)"><path d="M0 0 C -22 -16, -26 14, 0 4 C 26 14, 22 -16, 0 0Z" fill="#ff8fbd" stroke="#e2477f" stroke-width="2.5" /><circle r="5" fill="#ffa8cc" stroke="#e2477f" stroke-width="2.5" /><path d="M-3 4 l-6 14 M3 4 l6 14" stroke="#e2477f" stroke-width="3" stroke-linecap="round" /></g></g>;
    case 'lei': return <g>{Array.from({ length: 8 }, (_, i) => { const t = i / 7; const x = 62 + t * 76; const y = 140 + Math.sin(t * Math.PI) * 13; const col = ['#ff8fab', '#ffd43b', '#b197fc', '#74c0fc'][i % 4]; return <g transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map(a => <circle cx={Math.cos(a * Math.PI / 180) * 5} cy={Math.sin(a * Math.PI / 180) * 5} r="4.5" fill={col} />)}<circle r="3" fill="#fff3bf" /></g>; })}</g>;
  }
  return null;
}

function CapeBack() {
  return <path d="M66 134 C 44 166, 40 194, 54 200 L 146 200 C 160 194, 156 166, 134 134 Z" fill="#e03131" stroke="#a61e1e" stroke-width="3.5" stroke-linejoin="round" />;
}

export function Clothes({ k, clip }: { k: string; clip: string }) {
  const band = (y0: number, y1: number, fill: string) => <rect x="50" y={y0} width="100" height={y1 - y0} fill={fill} />;
  switch (k) {
    case 'stripe': return <g clip-path={clip}>{band(128, 178, '#fff')}{[132, 144, 156, 168].map(y => <rect x="50" y={y} width="100" height="6" fill="#4dabf7" />)}<rect x="50" y="176" width="100" height="3" fill="#1c7ed6" /></g>;
    case 'dots': return <g>
      <g clip-path={clip}>{band(128, 172, '#ff8fb8')}{[[76, 140], [96, 134], [116, 140], [86, 156], [108, 154], [128, 158], [70, 162]].map(([x, y]) => <circle cx={x} cy={y} r="3.5" fill="#fff" />)}</g>
      <path d="M58 166 Q100 176 142 166 L154 186 Q100 198 46 186 Z" fill="#ff8fb8" stroke="#e2477f" stroke-width="3" stroke-linejoin="round" />
      {[[62, 180], [82, 184], [100, 186], [118, 184], [138, 180]].map(([x, y]) => <circle cx={x} cy={y} r="3.2" fill="#fff" />)}
    </g>;
    case 'raincoat': return <g><g clip-path={clip}>{band(126, 186, '#ffd43b')}<path d="M100 132 V186" stroke="#e0a800" stroke-width="2.5" />{[146, 162, 178].map(y => <circle cx="106" cy={y} r="3" fill="#e0a800" />)}</g><path d="M62 136 Q100 152 138 136 L136 146 Q100 162 64 146 Z" fill="#ffe066" stroke="#e0a800" stroke-width="2.5" /></g>;
    case 'overall': return <g><g clip-path={clip}>{band(160, 192, '#4c6ef5')}<rect x="82" y="142" width="36" height="22" rx="4" fill="#4c6ef5" /><path d="M72 128 L86 146 M128 128 L114 146" stroke="#4c6ef5" stroke-width="7" stroke-linecap="round" /><rect x="92" y="148" width="16" height="10" rx="2" fill="#748ffc" /></g><circle cx="87" cy="146" r="3" fill="#ffd43b" /><circle cx="113" cy="146" r="3" fill="#ffd43b" /></g>;
    case 'hanbok': return <g>
      <g clip-path={clip}>{band(126, 162, '#ffe066')}{['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'].map((c, i) => <g><rect x={52 + i * 4} y="126" width="4" height="40" fill={c} /><rect x={128 + i * 4} y="126" width="4" height="40" fill={c} /></g>)}<path d="M84 128 L100 150 L116 128" fill="none" stroke="#fff" stroke-width="5" /></g>
      <path d="M56 160 Q100 170 144 160 L152 188 Q100 198 48 188 Z" fill="#ff8fab" stroke="#e2477f" stroke-width="3" stroke-linejoin="round" />
      <path d="M100 150 l-8 6 M100 150 l6 16 M100 150 l-2 18" stroke="#e03131" stroke-width="4" stroke-linecap="round" /><circle cx="100" cy="150" r="4" fill="#e03131" />
    </g>;
    case 'cape': return <g><path d="M70 134 Q100 146 130 134" fill="none" stroke="#a61e1e" stroke-width="5" stroke-linecap="round" /><path d="M100 146 l5 10 11 1 -8 7 3 11 -11 -6 -11 6 3 -11 -8 -7 11 -1z" fill="#ffd43b" stroke="#e0a800" stroke-width="2" /></g>;
    case 'sweater': return <g clip-path={clip}>{band(126, 186, '#63e6be')}<path d={'M50 146 ' + Array.from({ length: 13 }, (_, i) => `l4 ${i % 2 ? -6 : 6}`).join(' ') + ' ' + Array.from({ length: 12 }, (_, i) => `l4 ${i % 2 ? 6 : -6}`).join(' ')} fill="none" stroke="#fff" stroke-width="3" /><path d={'M50 162 ' + Array.from({ length: 25 }, (_, i) => `l4 ${i % 2 ? -6 : 6}`).join(' ')} fill="none" stroke="#fff" stroke-width="3" /><rect x="50" y="176" width="100" height="10" fill="#38d9a9" />{Array.from({ length: 12 }, (_, i) => <rect x={54 + i * 8} y="176" width="3" height="10" fill="#20c997" />)}</g>;
    case 'tutu': return <g>
      <g clip-path={clip}>{band(126, 166, '#fff0f6')}<path d="M80 128 Q100 138 120 128" fill="none" stroke="#faa2c1" stroke-width="3" /></g>
      {[0, 1].map(r => <path d={`M${50 - r * 6} ${166 + r * 6} ` + Array.from({ length: 9 }, (_, i) => `q${(100 + r * 12) / 18} ${10 + r * 2} ${(100 + r * 12) / 9} 0`).join(' ') + ` L${150 + r * 6} ${160 + r * 6} Q100 ${150 + r * 6} ${50 - r * 6} ${160 + r * 6} Z`} fill={r ? '#fcc2d7' : '#faa2c1'} stroke="#e64980" stroke-width="2" opacity=".95" />)}
    </g>;
  }
  return null;
}

export function Shoes({ k }: { k: string }) {
  const pair = (f: (x: number) => JSX.Element) => <g>{[80, 120].map(f)}</g>;
  switch (k) {
    case 'sneaker': return pair(x => <g><path d={`M${x - 17} 188 C ${x - 17} 176, ${x + 17} 174, ${x + 17} 186 L ${x + 17} 190 Q ${x} 196 ${x - 17} 190 Z`} fill="#ff6b6b" stroke="#c92a2a" stroke-width="3" /><path d={`M${x - 17} 190 Q ${x} 197 ${x + 17} 190`} fill="none" stroke="#fff" stroke-width="3.5" /><path d={`M${x - 6} 180 l8 4 M${x - 6} 185 l8 -4`} stroke="#fff" stroke-width="2" /></g>);
    case 'boots': return pair(x => <g><path d={`M${x - 13} 168 h26 v18 a9 9 0 0 1 -9 9 h-10 a9 9 0 0 1 -9 -9 z`} fill="#ffd43b" stroke="#e0a800" stroke-width="3" stroke-linejoin="round" /><rect x={x - 15} y="166" width="30" height="7" rx="3" fill="#ffe066" stroke="#e0a800" stroke-width="2.5" /></g>);
    case 'ballet': return pair(x => <g><ellipse cx={x} cy="188" rx="16" ry="9" fill="#ffc9de" stroke="#e64980" stroke-width="2.5" /><path d={`M${x - 8} 182 L ${x + 6} 170 M${x + 8} 182 L ${x - 6} 170`} stroke="#f783ac" stroke-width="2.5" /><circle cx={x} cy="182" r="2.5" fill="#f783ac" /></g>);
    case 'fur': return pair(x => <g><path d={`M${x - 14} 172 h28 v14 a9 9 0 0 1 -9 9 h-10 a9 9 0 0 1 -9 -9 z`} fill="#b07d4f" stroke="#7a5230" stroke-width="3" stroke-linejoin="round" /><Fluff c={[[x - 10, 172, 5], [x - 3, 170, 5], [x + 4, 170, 5], [x + 11, 172, 5]]} fill="#fff" line="#dcd0c4" w={2} /></g>);
    case 'socks': return pair(x => <g><path d={`M${x - 14} 174 h28 v12 a10 10 0 0 1 -10 10 h-8 a10 10 0 0 1 -10 -10 z`} fill="#fff" stroke="#adb5bd" stroke-width="2.5" />{[176, 182, 188].map((y, i) => <rect x={x - 13} y={y} width="26" height="3.2" fill={['#ff8787', '#ffd43b', '#74c0fc'][i]} />)}</g>);
  }
  return null;
}

export function Toy({ k }: { k: string }) {
  const at = (el: JSX.Element) => <g transform="translate(24 176)">{el}</g>;
  switch (k) {
    case 'ball': return at(<g><circle r="17" fill="#fff" stroke="#495057" stroke-width="2.5" /><path d="M-17 0 A17 17 0 0 1 0 -17 L0 0 Z" fill="#ff6b6b" /><path d="M0 17 A17 17 0 0 1 -17 0 L0 0 Z" fill="#4dabf7" /><path d="M17 0 A17 17 0 0 1 0 17 L0 0 Z" fill="#ffd43b" /><circle r="17" fill="none" stroke="#495057" stroke-width="2.5" /><circle cx="-6" cy="-7" r="3.5" fill="#fff" opacity=".8" /></g>);
    case 'yarn': return at(<g><circle r="16" fill="#f783ac" stroke="#c2255c" stroke-width="2.5" /><path d="M-12 -8 Q0 4 12 -8 M-15 2 Q0 14 15 2 M-8 -14 Q6 0 -2 15" fill="none" stroke="#c2255c" stroke-width="2" /><path d="M14 8 Q26 14 22 22 Q18 28 30 26" fill="none" stroke="#c2255c" stroke-width="2.5" stroke-linecap="round" /></g>);
    case 'duck': return at(<g><ellipse cx="0" cy="6" rx="17" ry="11" fill="#ffd43b" stroke="#e0a800" stroke-width="2.5" /><circle cx="7" cy="-8" r="9" fill="#ffd43b" stroke="#e0a800" stroke-width="2.5" /><path d="M15 -8 l9 2 -9 4 z" fill="#ff922b" stroke="#e8590c" stroke-width="1.5" /><circle cx="9" cy="-10" r="1.8" fill="#222" /><path d="M-8 4 q6 6 12 0" fill="none" stroke="#e0a800" stroke-width="2" /></g>);
    case 'mouse': return at(<g><ellipse cx="0" cy="6" rx="16" ry="10" fill="#ced4da" stroke="#868e96" stroke-width="2.5" /><circle cx="-10" cy="-2" r="6" fill="#ced4da" stroke="#868e96" stroke-width="2.5" /><circle cx="-10" cy="-2" r="3" fill="#ffc9de" /><circle cx="-15" cy="6" r="1.6" fill="#222" /><path d="M16 8 Q28 4 26 16 Q24 24 32 24" fill="none" stroke="#f783ac" stroke-width="2.5" stroke-linecap="round" /></g>);
    case 'frisbee': return at(<g><ellipse cx="0" cy="8" rx="20" ry="8" fill="#4dabf7" stroke="#1971c2" stroke-width="2.5" /><ellipse cx="0" cy="6" rx="12" ry="4" fill="#a5d8ff" /></g>);
    case 'teddy': return at(<g><circle cx="-9" cy="-14" r="5" fill="#c08457" stroke="#8a5a35" stroke-width="2" /><circle cx="9" cy="-14" r="5" fill="#c08457" stroke="#8a5a35" stroke-width="2" /><ellipse cx="0" cy="10" rx="13" ry="12" fill="#c08457" stroke="#8a5a35" stroke-width="2.5" /><circle cx="0" cy="-6" r="11" fill="#c08457" stroke="#8a5a35" stroke-width="2.5" /><ellipse cx="0" cy="-2" rx="5" ry="3.5" fill="#f1d3b3" /><circle cx="-4" cy="-8" r="1.6" fill="#222" /><circle cx="4" cy="-8" r="1.6" fill="#222" /><path d="M-3 14 l3 3 3 -3" stroke="#ff6b9a" stroke-width="2" fill="none" /></g>);
    case 'feather': return at(<g><path d="M-14 22 L 10 -18" stroke="#b197fc" stroke-width="3.5" stroke-linecap="round" /><path d="M10 -18 Q 24 -30 30 -18 Q 22 -14 10 -18 Z" fill="#ff8787" /><path d="M10 -18 Q 26 -10 22 2 Q 14 -6 10 -18 Z" fill="#74c0fc" /><path d="M10 -18 Q 4 -34 16 -34 Q 16 -24 10 -18 Z" fill="#ffd43b" /></g>);
    case 'rope': return at(<g><path d="M-22 6 C -10 -6, 10 18, 22 6" fill="none" stroke="#e8b04b" stroke-width="7" stroke-linecap="round" /><path d="M-22 6 C -10 -6, 10 18, 22 6" fill="none" stroke="#c9861c" stroke-width="2" stroke-dasharray="3 4" /><circle cx="-24" cy="6" r="7" fill="#4dabf7" stroke="#1971c2" stroke-width="2" /><circle cx="24" cy="6" r="7" fill="#ff6b6b" stroke="#c92a2a" stroke-width="2" /></g>);
    case 'fish': return at(<g><path d="M-18 4 C -10 -10, 10 -10, 14 4 C 10 18, -10 18, -18 4 Z" fill="#74c0fc" stroke="#1971c2" stroke-width="2.5" /><path d="M14 4 L 26 -6 L 26 14 Z" fill="#4dabf7" stroke="#1971c2" stroke-width="2.5" stroke-linejoin="round" /><circle cx="-9" cy="1" r="2.2" fill="#222" /><path d="M-3 -4 q4 8 0 14 M3 -4 q4 8 0 14" stroke="#a5d8ff" stroke-width="2" fill="none" /></g>);
    case 'bone': return at(<g transform="rotate(-18)"><path d="M-16 -8 a6 6 0 1 1 6 -2 L10 -10 a6 6 0 1 1 6 2 a6 6 0 1 1 -6 10 L-10 2 a6 6 0 1 1 -6 -2 a6 6 0 0 1 0 -8 z" fill="#fff4e6" stroke="#d9a066" stroke-width="2.5" stroke-linejoin="round" /></g>);
  }
  return null;
}

/** 아이템 하나만 크게 (보상 창·옷장 칸에서) */
const ICON_BOX: Record<Slot, string> = { hat: '40 -40 120 100', clothes: '40 118 120 84', glasses: '50 66 100 52', neck: '52 126 96 48', shoes: '58 164 84 36', toy: '-10 142 68 60' };
export function ItemIcon({ id, size = 100 }: { id: string; size?: number }) {
  const [slot, key] = id.split(':') as [Slot, string];
  const [cid] = useState(() => 'ic' + (++uid));
  const [vb, setVb] = useState(ICON_BOX[slot]);
  const ref = useRef<SVGGElement>(null);
  // 그린 모양의 크기에 맞춰 가운데에 크게
  useLayoutEffect(() => {
    try {
      const b = ref.current!.getBBox();
      if (b.width > 0) { const m = Math.max(b.width, b.height) * 0.12 + 2; const w = Math.max(b.width, b.height) + m * 2; setVb(`${b.x + b.width / 2 - w / 2} ${b.y + b.height / 2 - w / 2} ${w} ${w}`); }
    } catch { /* 무시 */ }
  }, [id]);
  return (
    <svg viewBox={vb} width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <clipPath id={`${cid}-b`}><ellipse cx="100" cy="158" rx="46" ry="34" /></clipPath>
        <linearGradient id={`${cid}-rb`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6b6b" /><stop offset=".25" stop-color="#ffd43b" /><stop offset=".5" stop-color="#69db7c" /><stop offset=".75" stop-color="#4dabf7" /><stop offset="1" stop-color="#b197fc" /></linearGradient>
      </defs>
      <g ref={ref}>
        {slot === 'hat' && hatArt(key)}
        {slot === 'clothes' && <g>{key === 'cape' && <CapeBack />}<ellipse cx="100" cy="158" rx="46" ry="34" fill="#f3eef8" />{key !== 'cape' && <Clothes k={key} clip={`url(#${cid}-b)`} />}{key === 'cape' && <Clothes k={key} clip="" />}</g>}
        {slot === 'glasses' && <Glasses k={key} rb={`url(#${cid}-rb)`} />}
        {slot === 'neck' && <Neck k={key} />}
        {slot === 'shoes' && <Shoes k={key} />}
        {slot === 'toy' && <Toy k={key} />}
      </g>
    </svg>
  );
}

// ======================= 간식 =======================
export function SnackIcon({ id, size = 80 }: { id: string; size?: number }) {
  return (
    <svg viewBox="-40 -40 80 80" width={size} height={size} style={{ overflow: 'visible' }}>
      {(() => {
        switch (id) {
          case 'bone': return <g transform="rotate(-20)"><path d="M-26 -10 a9 9 0 1 1 9 -3 L17 -13 a9 9 0 1 1 9 3 a9 9 0 1 1 -9 15 L-17 5 a9 9 0 1 1 -9 -3 a9 9 0 0 1 0 -12 z" fill="#fff4e6" stroke="#d9a066" stroke-width="3.5" stroke-linejoin="round" /></g>;
          case 'meat': return <g transform="rotate(-25)"><ellipse cx="-6" cy="0" rx="22" ry="17" fill="#e8590c" stroke="#a63e0a" stroke-width="3" /><ellipse cx="-10" cy="-4" rx="12" ry="8" fill="#ff922b" /><rect x="12" y="-4" width="20" height="8" rx="3" fill="#fff4e6" stroke="#d9a066" stroke-width="2.5" /><circle cx="32" cy="-5" r="5" fill="#fff4e6" stroke="#d9a066" stroke-width="2.5" /><circle cx="32" cy="5" r="5" fill="#fff4e6" stroke="#d9a066" stroke-width="2.5" /></g>;
          case 'fish': return <g><path d="M-28 0 C -14 -20, 14 -20, 22 0 C 14 20, -14 20, -28 0 Z" fill="#74c0fc" stroke="#1c7ed6" stroke-width="3" /><path d="M22 0 L 36 -14 L 33 0 L 36 14 Z" fill="#74c0fc" stroke="#1c7ed6" stroke-width="3" stroke-linejoin="round" /><circle cx="-14" cy="-4" r="3.5" fill="#1b2a3a" /><path d="M-2 -10 q6 10 0 20" fill="none" stroke="#1c7ed6" stroke-width="2" /></g>;
          case 'churu': return <g transform="rotate(-20)"><rect x="-10" y="-32" width="20" height="64" rx="6" fill="#ffe066" stroke="#e0a800" stroke-width="3" /><rect x="-10" y="-8" width="20" height="18" fill="#ff8787" /><path d="M-6 -1 l3 3 3 -3 3 3 3 -3" fill="none" stroke="#fff" stroke-width="2" /><rect x="-10" y="-32" width="20" height="8" rx="3" fill="#ffd43b" /></g>;
          case 'cookie': return <g><circle r="26" fill="#e9b872" stroke="#b07d3a" stroke-width="3" />{[[-10, -8], [8, -12], [12, 8], [-6, 12], [0, 0]].map(([x, y]) => <circle cx={x} cy={y} r="4" fill="#6b4226" />)}</g>;
          case 'milk': return <g><path d="M-14 -14 L -8 -26 H 8 L 14 -14 V 26 a4 4 0 0 1 -4 4 H -10 a4 4 0 0 1 -4 -4 Z" fill="#fff" stroke="#74c0fc" stroke-width="3" stroke-linejoin="round" /><rect x="-14" y="0" width="28" height="14" fill="#a5d8ff" /><rect x="-9" y="-32" width="18" height="7" rx="2" fill="#4dabf7" /><path d="M-6 6 h12" stroke="#fff" stroke-width="2.5" /></g>;
        }
        return null;
      })()}
    </svg>
  );
}
