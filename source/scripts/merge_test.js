// 합치기 규칙 시험: 교환·결합·멱등, 기기별 합계, 새 칸(친구·꾸미기·간식·이어하기)
const { mergeState, sumMap } = require('../shared/merge.js');
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
function randState(dev, epoch = 0) {
  const s = { v: 3, epoch, name: pick(['하나', '친구']), nameT: rnd(3), lessonIdx: rnd(10), items: {}, stars: {}, adventures: {}, usage: {}, lessonsByDay: {}, extraMin: {}, extraLessons: {}, owned: [], settings: { dailyMin: 30, traceReps: pick([5, 10]) }, settingsT: rnd(3),
    dog: pick(['maltese', 'poodle', 'corgi']), cat: pick(['koshort', 'russian']), lead: pick(['dog', 'cat']), petsT: rnd(3),
    wear: {}, wearT: {}, growth: {}, snacks: {}, eaten: {}, games: {}, resume: rnd(2) ? { lessonIdx: rnd(5), stepIdx: rnd(9), steps: [], replay: false, at: rnd(100) } : null, resumeT: rnd(3) };
  for (const k of ['j:ㄱ', 'j:ㄴ', 'j:ㅏ', 'w:나비']) if (rnd(2)) s.items[k] = { box: rnd(5), due: rnd(9), seen: rnd(4), right: rnd(3), wrong: rnd(3), last: rnd(3) };
  s.stars[dev] = rnd(20); s.adventures[dev] = rnd(5); s.games[dev] = rnd(9);
  for (const d of ['20700', '20701']) { s.usage[d] = { [dev]: rnd(1e6) }; s.lessonsByDay[d] = { [dev]: rnd(2) }; }
  for (const it of ['hat:bow', 'neck:bell', 'toy:ball']) if (rnd(2)) s.owned.push(it);
  for (const p of ['maltese', 'koshort', 'poodle']) if (rnd(2)) { s.wear[p] = rnd(2) ? { hat: pick(['crown', 'cap']) } : { glasses: 'sun' }; s.wearT[p] = rnd(3); }
  for (const p of ['maltese', 'koshort']) if (rnd(2)) s.growth[p] = { [dev]: rnd(30) };
  for (const sn of ['bone', 'fish', 'cookie']) { if (rnd(2)) s.snacks[sn] = { [dev]: rnd(9) }; if (rnd(2)) s.eaten[sn] = { [dev]: rnd(4) }; }
  // 11차: 돌려준 것·꾸미기·시험
  s.lostSnacks = {}; for (const sn of ['bone', 'fish']) if (rnd(2)) s.lostSnacks[sn] = { [dev]: rnd(3) };
  s.lostMats = rnd(2) ? { [dev]: rnd(3) } : {};
  s.itemGot = {}; s.itemLost = {}; for (const it of ['hat:bow', 'neck:bell']) { if (rnd(2)) s.itemGot[it] = rnd(5); if (rnd(2)) s.itemLost[it] = rnd(5); }
  s.bought = {}; for (const f of ['bed:basket', 'rug:heart', 'park:slide2']) if (rnd(2)) s.bought[f] = rnd(5);
  s.deco = {}; s.decoT = {}; for (const pl of ['doghouse', 'park']) if (rnd(2)) { s.deco[pl] = { bed: pick(['bed:basket', 'bed:round']) }; s.decoT[pl] = rnd(3); }
  s.lastPass = rnd(2) ? { lesson: rnd(5), day: 20700 + rnd(3), items: ['ㄱ', 'ㄴ'] } : null; s.lastPassT = rnd(3);
  s.reviewDay = rnd(2) ? 20700 + rnd(3) : -1; s.reviewDayT = rnd(3);
  s.hold = rnd(2) ? { lesson: rnd(5) } : null; s.holdT = rnd(3);
  return s;
}
// 열쇠 순서와 상관없이 비교
const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((r, x) => (r[x] = v[x], r), {}) : v);
let bad = 0, badKeyOrder = 0;
for (let i = 0; i < 4000; i++) {
  const a = randState('dA'), b = randState('dB'), c = randState(pick(['dA', 'dB', 'dC']));
  const ab = mergeState(a, b), ba = mergeState(b, a);
  if (canon(ab) !== canon(ba)) { bad++; if (bad < 3) console.log('not commutative\n', canon(ab), '\n', canon(ba)); }
  if (JSON.stringify(ab) !== JSON.stringify(ba)) badKeyOrder++;
  if (canon(mergeState(mergeState(a, b), c)) !== canon(mergeState(a, mergeState(b, c)))) bad++;
  if (canon(mergeState(ab, ab)) !== canon(ab)) bad++;
  if (canon(mergeState(ab, a)) !== canon(ab)) bad++;
}
const x = randState('dA'), y = randState('dB', 5);
console.log('epoch wins:', mergeState(x, y) === y && mergeState(y, x) === y);
const p = randState('dA'), q = randState('dB');
const m = mergeState(p, q);
console.log('usage sum ok:', sumMap(m.usage['20700']) === p.usage['20700'].dA + q.usage['20700'].dB);
console.log('games sum ok:', sumMap(m.games) === p.games.dA + q.games.dB);
// 꾸미기: 나중에 바꾼 쪽
const w1 = randState('dA'), w2 = randState('dB'); w1.wear = { maltese: { hat: 'crown' } }; w1.wearT = { maltese: 5 }; w2.wear = { maltese: { hat: 'cap' } }; w2.wearT = { maltese: 9 };
console.log('wear lww ok:', mergeState(w1, w2).wear.maltese.hat === 'cap' && mergeState(w2, w1).wear.maltese.hat === 'cap');
// 이어하기 지우기가 퍼지는지
const r1 = randState('dA'), r2 = randState('dB'); r1.resume = { stepIdx: 3 }; r1.resumeT = 5; r2.resume = null; r2.resumeT = 8;
console.log('resume clear ok:', mergeState(r1, r2).resume === null && mergeState(r2, r1).resume === null);
console.log('violations:', bad, '| key-order differences:', badKeyOrder);
process.exit(bad || badKeyOrder ? 1 : 0);
