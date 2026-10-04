// 이어하기 고치기 검사: 예전 판처럼 안 배운 글자가 섞인 단계를 만들어 refreshSteps가 고치는지, 앞부분·쓰기는 그대로인지
import fs from 'node:fs';
const VD = process.env.VOICE_DIR || '..';   // 음성팩(voice-manifest.json)이 있는 곳 = 저장소 맨 위
const mem: Record<string, string> = {};
(globalThis as any).window = globalThis;
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: () => {} };
const man = JSON.parse(fs.readFileSync(VD + '/voice-manifest.json', 'utf8'));
const V: Record<string, string> = {};
for (const f of man.files) Object.keys(JSON.parse(fs.readFileSync(VD + '/' + f.u, 'utf8')).voices).forEach(k => { V[k] = 'x'; });
(globalThis as any).__VOICE__ = V;
const { buildLesson, refreshSteps, stepFits } = await import('../src/engine/session');
const { LESSONS, knownAfter } = await import('../src/data/curriculum');
const { JAMO } = await import('../src/data/jamo');
const { compose } = await import('../src/lib/hangul');
const ALL = Object.keys(JAMO);
let cases = 0, fixed = 0, bad = 0, same = 0, changedClean = 0, keptPrefix = 0, dropped = 0;
for (let rep = 0; rep < 40; rep++) for (let idx = 0; idx < LESSONS.length; idx++) {
  const kEnd = knownAfter(idx);
  const un = ALL.filter(x => !kEnd.jamo.has(x) && JAMO[x].kind === 'v');
  const unC = ALL.filter(x => !kEnd.jamo.has(x) && JAMO[x].kind === 'c');
  const clean = buildLesson(idx);
  // 1) 깨끗한 단계는 그대로여야 함
  const from0 = Math.floor(Math.random() * clean.length);
  const r0 = refreshSteps(clean, idx, from0);
  if (r0.length === clean.length && r0.every((s, i) => s === clean[i])) same++; else { changedClean++; if (changedClean < 4) console.log('CLEAN CHANGED', idx, from0); }
  if (!un.length) continue;
  // 2) 예전 판처럼 오염: 놀이마다 안 배운 글자 넣기
  const u = un[0], uc = unC[0] ?? 'ㅎ';
  const polluted = JSON.parse(JSON.stringify(clean));
  for (const st of polluted) {
    if (st.t === 'bubble' || st.t === 'mole') st.pool.push(u);
    if (st.t === 'feed' || st.t === 'hop' || st.t === 'cards') st.rounds[0].options.push(u);
    if (st.t === 'memory') st.cards.push({ id: u, face: u, kind: 'text', say: '' }, { id: u, face: '🔊', kind: 'sound', say: u });
    if (st.t === 'recall') st.cards[st.cards.findIndex((c: string) => !st.targets.includes(c))] = u;
    if (st.t === 'hunt' && !st.bat) st.rounds[0].cards.push(compose(uc in JAMO ? uc : 'ㅎ', u));
  }
  const from = Math.floor(Math.random() * polluted.length);
  const out = refreshSteps(polluted, idx, from);
  cases++;
  // 앞부분(이미 한 단계)은 그대로
  if (out.slice(0, from).every((s: any, i: number) => s === polluted[i])) keptPrefix++;
  if (out.length < polluted.length) dropped++;
  // 소개·쓰기 단계 순서가 그대로인지
  const sk = (xs: any[]) => xs.filter(s => s.t === 'intro' || s.t === 'traceSet' || s.t === 'batchim').map(s => s.t + (s.ch ?? s.items?.join('') ?? s.b)).join(',');
  if (sk(out) !== sk(polluted)) { bad++; console.log('SKELETON', idx, from); }
  // from 이후는 모두 배운 글자만
  const kPrev = idx > 0 ? knownAfter(idx - 1) : { jamo: new Set<string>(), batchim: new Set<string>() };
  const J = new Set(kPrev.jamo), B = new Set(kPrev.batchim);
  let ok = true;
  out.forEach((st: any, i: number) => {
    if (st.t === 'intro') J.add(st.ch);
    if (st.t === 'batchim') B.add(st.b);
    if (i >= from && !stepFits(st, { jamo: J, batchim: B })) { ok = false; if (bad < 6) console.log('LEFT', idx, i, st.t, JSON.stringify(st).slice(0, 160)); }
  });
  if (ok) fixed++; else bad++;
}
console.log({ cases, fixed, bad, keptPrefix, dropped, cleanSame: same, cleanChanged: changedClean });
process.exit(bad || changedClean ? 1 : 0);
