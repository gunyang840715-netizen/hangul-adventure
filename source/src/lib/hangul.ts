// 한글 조합·분해 유틸
export const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
export const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
export const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const BASE = 0xac00;

export function isSyllable(ch: string) {
  const c = ch.charCodeAt(0);
  return c >= BASE && c <= 0xd7a3;
}

export function compose(cho: string, jung: string, jong = ''): string {
  const i = CHO.indexOf(cho), j = JUNG.indexOf(jung), k = JONG.indexOf(jong);
  if (i < 0 || j < 0 || k < 0) return cho + jung + jong;
  return String.fromCharCode(BASE + (i * 21 + j) * 28 + k);
}

export interface Parts { cho: string; jung: string; jong: string }

export function decompose(ch: string): Parts | null {
  if (!isSyllable(ch)) return null;
  const c = ch.charCodeAt(0) - BASE;
  return { cho: CHO[Math.floor(c / 588)], jung: JUNG[Math.floor((c % 588) / 28)], jong: JONG[c % 28] };
}

/** 낱말에 쓰인 자모 목록(겹받침은 구성 자모로 풀지 않음) */
export function jamoOf(word: string): string[] {
  const out: string[] = [];
  for (const ch of word) {
    const p = decompose(ch);
    if (!p) continue;
    out.push(p.cho, p.jung);
    if (p.jong) out.push(p.jong);
  }
  return out;
}

export function hasBatchim(ch: string) {
  const p = decompose(ch);
  return !!p && p.jong !== '';
}

/** 받침 유무로 조사 고르기: josa('기역','을','를') */
export function josa(word: string, withB: string, withoutB: string) {
  const last = word[word.length - 1];
  const p = decompose(last);
  if (!p) return withoutB;
  if (withB === '으로' && p.jong === 'ㄹ') return withoutB;
  return p.jong ? withB : withoutB;
}

export type VowelShape = 'V' | 'H' | 'M';
export function vowelShape(v: string): VowelShape {
  if ('ㅗㅛㅜㅠㅡ'.includes(v)) return 'H';
  if ('ㅘㅙㅚㅝㅞㅟㅢ'.includes(v)) return 'M';
  return 'V';
}

export function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export function sample<T>(a: T[], n: number): T[] { return shuffle(a).slice(0, n); }

/** 한글(자모·음절)이 들어 있나: 아니면 그림 카드(🍓 등) — 크게 보여 주고 소리는 내지 않는다 */
export function hasHangul(s: string) { return /[ㄱ-ㆎ가-힣]/.test(s); }
