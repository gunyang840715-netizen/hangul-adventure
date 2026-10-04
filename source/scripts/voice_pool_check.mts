// 캐릭터 목소리 검사: 묶음이 가리키는 녹음이 모두 팩에 있고, 앱이 실제로 하는 말과 연결돼 있는지
import fs from 'node:fs';
const VD = process.env.VOICE_DIR || '..';
const man = JSON.parse(fs.readFileSync(VD + '/voice-manifest.json', 'utf8'));
const V: Record<string, string> = {}; const P: Record<string, any> = {};
for (const f of man.files) { const j = JSON.parse(fs.readFileSync(VD + '/' + f.u, 'utf8')); Object.assign(V, j.voices || {}); Object.assign(P, j.pool || {}); }
const { allLines, nameLines } = await import('../src/data/voice');
const { PRAISE, RETRY, GENTLE } = await import('../src/games/common');
const lines = new Set<string>([...allLines('로희'), ...nameLines('로희'), ...PRAISE, ...RETRY, ...GENTLE]);
let bad = 0, linked = 0;
for (const [t, e] of Object.entries<any>(P)) {
  for (const k of [...(e.d || []), ...(e.c || [])]) if (!V[k]) { bad++; console.log('녹음 없음:', t, '→', k); }
  if (!e.d?.length && !e.c?.length) { bad++; console.log('빈 묶음:', t); }
  if (!lines.has(t)) { bad++; console.log('앱이 안 하는 말(오타?):', t); } else linked++;
}
for (const t of [...PRAISE, ...RETRY, ...GENTLE, '로희야, 안녕!']) if (!P[t]) { bad++; console.log('연결 안 됨:', t); }
const dogOnly = Object.entries<any>(P).filter(([, e]) => e.d?.length && !e.c?.length).map(([t]) => t);
console.log('캐릭터 목소리 연결:', linked, '개 | 강아지만:', dogOnly.length, '개 | 문제:', bad);
if (bad) process.exit(1);
