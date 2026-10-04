// 배운 글자만 나오는지 전수 검사: 모든 단계를 여러 번 만들어, 그 시점까지 배운 자모·받침으로만 된 글자인지 확인
//  npx tsx scripts/learned_check.mts [반복수]   (source 폴더에서)
import fs from 'node:fs';
const VD = process.env.VOICE_DIR || '..';   // 음성팩(voice-manifest.json)이 있는 곳 = 저장소 맨 위
const mem: Record<string, string> = {};
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; } };
// 실제 음성팩 문장 목록 (녹음된 음절만 문제로 내는 canSay를 실제와 같게)
const man = JSON.parse(fs.readFileSync(VD + '/voice-manifest.json', 'utf8'));
const V: Record<string, string> = {};
for (const f of man.files) Object.keys(JSON.parse(fs.readFileSync(VD + '/' + f.u, 'utf8')).voices).forEach(k => { V[k] = 'x'; });
(globalThis as any).__VOICE__ = V;

const { buildLesson, buildPlay } = await import('../src/engine/session');
const { LESSONS, knownAfter } = await import('../src/data/curriculum');
const { decompose } = await import('../src/lib/hangul');

const REP = Number(process.argv[2] || 150);
const HANGUL = /[ㄱ-ㆎ가-힣]/;
type Bad = { lesson: number; step: string; text: string; why: string };
const bad: Bad[] = [];
const warn: Bad[] = [];
let pics = 0, steps = 0;

function checkText(s: string, L: Set<string>, B: Set<string>): string | null {
  if (!HANGUL.test(s)) { pics++; return null; }               // 그림 카드(글자 아님)
  for (const ch of s) {
    if (' .,!?~'.includes(ch)) continue;
    if (/[ㄱ-ㆎ]/.test(ch)) { if (!L.has(ch)) return `안 배운 자모 ${ch}`; continue; }
    const p = decompose(ch);
    if (!p) continue;
    if (!L.has(p.cho)) return `안 배운 자음 ${p.cho} (${ch})`;
    if (!L.has(p.jung)) return `안 배운 모음 ${p.jung} (${ch})`;
    if (p.jong && !B.has(p.jong)) return `안 배운 받침 ${p.jong} (${ch})`;
  }
  return null;
}

function texts(st: any): string[] {
  const o: string[] = [];
  const add = (...x: any[]) => x.flat(3).forEach(v => { if (typeof v === 'string' && v) o.push(v); });
  switch (st.t) {
    case 'intro': case 'trace': add(st.ch); break;
    case 'traceSet': add(st.items); break;
    case 'bubble': case 'mole': add(st.targets, st.pool, st.order ?? []); break;
    case 'cards': case 'feed': case 'hop': st.rounds.forEach((r: any) => add(r.answer, r.options)); break;
    case 'blend': st.rounds.forEach((r: any) => add(r.cho, r.jung, r.jong ?? '', r.choOpts, r.jungOpts, r.jongOpts ?? [])); break;
    case 'picture': st.rounds.forEach((r: any) => add(r.word.text, r.options.map((w: any) => w.text))); break;
    case 'build': add(st.words.map((w: any) => w.text), st.extra); break;
    case 'batchim': add(st.b); break;
    case 'sentence': add(st.items.map((s: any) => s.text), st.pool.map((s: any) => s.text)); break;
    case 'rescue': add(st.friends); break;
    case 'hunt': add(st.targets); st.rounds.forEach((r: any) => add(r.cards, r.hits)); break;
    case 'recall': add(st.cards, st.targets, st.order); break;
    case 'memory': st.cards.forEach((c: any) => add(c.id, c.face, c.say)); break;
    case 'dictation': add(st.items, st.order); break;
  }
  return o;
}

/** 놀이가 제대로 되는지 (보기 하나뿐, 카드 너무 적음 등) */
function sanity(st: any): string | null {
  switch (st.t) {
    case 'cards': case 'feed': case 'hop':
      for (const r of st.rounds) { if (!r.options.includes(r.answer)) return '보기에 정답 없음'; if (new Set(r.options).size < 2) return `보기 ${r.options.length}개`; }
      return st.rounds.length ? null : '문제 없음';
    case 'memory': { const n = new Set(st.cards.map((c: any) => c.id)).size; return n >= 3 ? null : `짝 ${n}개`; }
    case 'hunt': {
      if (!st.rounds.length) return '판 없음';
      for (const r of st.rounds) { if (r.cards.length < 4) return `카드 ${r.cards.length}장`; if (!r.hits.length) return '답 없음'; if (r.hits.some((h: string) => !r.cards.includes(h))) return '답이 카드에 없음'; }
      const n = st.rounds.reduce((a: number, r: any) => a + r.hits.length, 0);
      return n >= 3 ? null : `문제 ${n}개`;
    }
    case 'dictation': {
      if (st.order.length < 4) return `시험 ${st.order.length}문제`;
      if (st.order.some((x: string) => !st.items.includes(x))) return '시험 문제가 글자 목록에 없음';
      if (st.order.some((x: string, j: number) => j > 0 && x === st.order[j - 1]) && new Set(st.order).size > 1) return '같은 문제 연달아';
      return null;
    }
    case 'recall': {
      if (st.cards.length !== 16) return `카드 ${st.cards.length}장`;
      for (const t of st.targets) if (st.cards.filter((c: string) => c === t).length !== 2) return `${t} 카드 수`;
      return st.order.length >= 2 ? null : '문제 없음';
    }
    case 'bubble': case 'mole': {
      const order = st.order ?? [];
      if (order.some((x: string) => !st.targets.includes(x))) return '문제가 목표에 없음';
      const pool = new Set([...st.pool, ...st.targets]);
      return pool.size >= 2 ? null : '방울·두더지가 한 가지뿐';
    }
  }
  return null;
}

function walk(lesson: number, list: any[], L0: Set<string>, B0: Set<string>, tag: string) {
  const L = new Set(L0), B = new Set(B0);
  for (const st of list) {
    steps++;
    if (st.t === 'intro') L.add(st.ch);
    if (st.t === 'batchim') B.add(st.b);
    for (const s of texts(st)) {
      const why = checkText(s, L, B);
      if (why) bad.push({ lesson, step: tag + st.t, text: s, why });
    }
    const w = sanity(st);
    if (w) warn.push({ lesson, step: tag + st.t, text: '', why: w });
  }
}

for (let rep = 0; rep < REP; rep++) {
  for (let i = 0; i < LESSONS.length; i++) {
    const prev = i > 0 ? knownAfter(i - 1) : { jamo: new Set<string>(), batchim: new Set<string>() };
    walk(i, buildLesson(i), prev.jamo, prev.batchim, '');
    // 놀이터: 지금까지 끝낸 단계(i-1)까지 배운 것
    if (i > 0) for (const st of buildPlay(i)) walk(i, [st], prev.jamo, prev.batchim, 'play:');
  }
}

const group = (xs: Bad[]) => {
  const m = new Map<string, { n: number; ex: Set<string> }>();
  for (const b of xs) { const k = `L${b.lesson} ${LESSONS[b.lesson].title} | ${b.step} | ${b.why.replace(/ \(.*\)$/, '').replace(/[ㄱ-ㅣ]$/, '')}`; const e = m.get(k) ?? { n: 0, ex: new Set() }; e.n++; if (e.ex.size < 6) e.ex.add(b.why + (b.text ? ` «${b.text}»` : '')); m.set(k, e); }
  return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
};
console.log(`반복 ${REP} · 단계 ${steps} · 그림 카드 ${pics}`);
console.log(`안 배운 글자: ${bad.length}건`);
for (const [k, e] of group(bad).slice(0, 40)) console.log('  ✗', k, '×', e.n, '예:', [...e.ex].join(' / '));
console.log(`놀이 이상: ${warn.length}건`);
for (const [k, e] of group(warn).slice(0, 30)) console.log('  △', k, '×', e.n, [...e.ex].join(' / '));
process.exit(bad.length || warn.length ? 1 : 0);
