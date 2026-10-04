// 글자 도서관: 공부(글자 소개·따라 쓰기·받아쓰기 시험) 화면 배경
// 벽 + 나무 바닥 + 양옆 책장(화면이 넓으면 책장이 끝까지 이어짐) + '글자 도서관' 간판 + 깃발
// 강아지·고양이는 책상에 앉아 책을 펴고 공부 (ReadingDesk를 친구들 앞에 놓음)

const BOOK_COLORS = ['#ff8fab', '#ffd43b', '#74c0fc', '#8ce99a', '#b197fc', '#ffa94d', '#63e6be', '#f783ac', '#ffc078', '#91a7ff'];

/** 정해진 순서로 섞기 (매번 같은 책장 그림) */
function rng(seed: number) {
  let x = seed;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

/** 책장 한 칸(300x640) 그림 → 배경으로 옆으로 이어 붙임 */
function shelfSvg(seed: number): string {
  const r = rng(seed);
  const W = 300, H = 640;
  const boards = [150, 300, 450, 600];
  let g = `<rect x="0" y="0" width="${W}" height="${H}" fill="#e9c391"/>`;
  g += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#gr)" opacity=".35"/>`;
  // 칸 뒤판 그늘
  boards.forEach((by, i) => { const top = i === 0 ? 14 : boards[i - 1] + 14; g += `<rect x="14" y="${top}" width="${W - 14}" height="${by - top}" fill="#d9a86d"/>`; });
  // 책
  boards.forEach((by, bi) => {
    let x = 22;
    const top = bi === 0 ? 14 : boards[bi - 1] + 14;
    const room = by - top;
    while (x < W - 30) {
      const kind = r();
      if (kind < 0.07 && x < W - 70) {
        // 작은 화분
        g += `<rect x="${x + 4}" y="${by - 34}" width="34" height="34" rx="6" fill="#ff922b" stroke="#c45f0a" stroke-width="3"/>`;
        g += `<path d="M${x + 21} ${by - 34} q-16 -26 -10 -44 q10 16 10 44 q2 -30 16 -40 q2 22 -16 40" fill="#51cf66" stroke="#2b8a3e" stroke-width="2.5"/>`;
        x += 48; continue;
      }
      const w = 18 + Math.floor(r() * 16);
      const h = Math.min(room - 12, 84 + Math.floor(r() * 46));
      const c = BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)];
      const lean = kind > 0.93 && x < W - 60;
      const tr = lean ? ` transform="rotate(14 ${x + w} ${by})"` : '';
      g += `<g${tr}><rect x="${x}" y="${by - h}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="#6b4a2b" stroke-opacity=".35" stroke-width="2"/>`;
      g += `<rect x="${x + 3}" y="${by - h + 12}" width="${w - 6}" height="5" rx="2" fill="#fff" opacity=".7"/>`;
      if (r() < 0.6) g += `<rect x="${x + 3}" y="${by - 26}" width="${w - 6}" height="4" rx="2" fill="#fff" opacity=".55"/>`;
      g += `</g>`;
      x += w + (lean ? 16 : 2);
    }
  });
  // 선반 판과 기둥
  boards.forEach(by => { g += `<rect x="0" y="${by}" width="${W}" height="16" fill="#c58b52" stroke="#8f5e2c" stroke-width="3"/>`; });
  g += `<rect x="0" y="0" width="16" height="${H}" fill="#c58b52" stroke="#8f5e2c" stroke-width="3"/>`;
  g += `<rect x="0" y="0" width="${W}" height="16" fill="#c58b52" stroke="#8f5e2c" stroke-width="3"/>`;
  const defs = `<defs><linearGradient id="gr" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#8f5e2c"/></linearGradient></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${g}</svg>`;
}

const SHELF_L = `url("data:image/svg+xml,${encodeURIComponent(shelfSvg(7))}")`;
const SHELF_R = `url("data:image/svg+xml,${encodeURIComponent(shelfSvg(23))}")`;

/** 도서관 배경 (무대 전체를 채움) */
export function LibraryBack() {
  return (
    <div class="backdrop library" data-theme="library">
      <div class="lib-wall" />
      <div class="lib-shelf left" style={{ backgroundImage: SHELF_L }} />
      <div class="lib-shelf right" style={{ backgroundImage: SHELF_R }} />
      <div class="lib-floor" />
      {/* 가운데 위: 깃발 줄 + '글자 도서관' 간판 (안전 영역 기준) */}
      <svg class="lib-top" viewBox="0 0 1280 130" width="1280" height="130">
        <path d="M300 18 Q 640 70 980 18" stroke="#8f5e2c" stroke-width="3" fill="none" />
        {Array.from({ length: 13 }, (_, i) => {
          const t = (i + 0.5) / 13;
          const x = 300 + 680 * t;
          const y = 18 + 52 * 4 * t * (1 - t) * 0.5 * 2 / 2;
          const c = BOOK_COLORS[i % BOOK_COLORS.length];
          return <path d={`M${x - 16} ${y} L${x + 16} ${y} L${x} ${y + 30} Z`} fill={c} stroke="#fff" stroke-width="2" />;
        })}
        <g transform="translate(640 74)">
          <path d="M-96 -44 L-70 -6 M96 -44 L70 -6" stroke="#8f5e2c" stroke-width="3" />
          <rect x="-118" y="-6" width="236" height="52" rx="16" fill="#fff4e6" stroke="#c58b52" stroke-width="5" />
          <text x="0" y="31" font-size="30" text-anchor="middle" fill="#8f5e2c" font-family="Jua">📚 글자 도서관</text>
        </g>
      </svg>
      {/* 바닥 둥근 깔개 */}
      <div class="lib-rug" />
    </div>
  );
}

/** 강아지·고양이 앞에 놓는 책상 + 펼친 책 (공부하는 모습) */
export function ReadingDesk({ w, h }: { w: number; h: number }) {
  return (
    <svg class="reading-desk" viewBox="0 0 300 90" width={w} height={h} preserveAspectRatio="none" style={{ position: 'absolute', left: -w * 0.05, bottom: -8, width: w * 1.1, height: h, pointerEvents: 'none' }}>
      {/* 책상 */}
      <rect x="4" y="30" width="292" height="16" rx="6" fill="#c58b52" stroke="#8f5e2c" stroke-width="4" />
      <rect x="18" y="44" width="264" height="44" rx="4" fill="#b3763f" stroke="#8f5e2c" stroke-width="4" />
      <path d="M40 60 h220 M40 74 h220" stroke="#8f5e2c" stroke-width="2" opacity=".35" />
      {/* 펼친 책 */}
      <g transform="translate(150 30)">
        <path d="M0 0 C -26 -12, -56 -12, -78 -4 L -78 4 C -56 -4, -26 -4, 0 6 Z" fill="#fff" stroke="#c9b6e4" stroke-width="3" stroke-linejoin="round" />
        <path d="M0 0 C 26 -12, 56 -12, 78 -4 L 78 4 C 56 -4, 26 -4, 0 6 Z" fill="#fff" stroke="#c9b6e4" stroke-width="3" stroke-linejoin="round" />
        <path d="M-66 -6 q16 -5 32 -4 M-60 -1 q14 -4 26 -3 M66 -6 q-16 -5 -32 -4 M60 -1 q-14 -4 -26 -3" stroke="#b197fc" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <text x="-40" y="-14" font-size="15" text-anchor="middle" fill="#e0488a" font-family="Jua">가</text>
        <text x="40" y="-14" font-size="15" text-anchor="middle" fill="#228be6" font-family="Jua">ㄱ</text>
      </g>
      {/* 연필과 작은 책 더미 */}
      <g transform="translate(250 22) rotate(-18)"><rect x="-4" y="-22" width="8" height="34" rx="2" fill="#ffd43b" stroke="#e8890c" stroke-width="2" /><path d="M-4 12 L0 22 L4 12 Z" fill="#ffe8cc" stroke="#e8890c" stroke-width="2" /></g>
      <rect x="24" y="16" width="44" height="10" rx="3" fill="#74c0fc" stroke="#1971c2" stroke-width="2" />
      <rect x="28" y="6" width="38" height="10" rx="3" fill="#ff8fab" stroke="#d6336c" stroke-width="2" />
    </svg>
  );
}
