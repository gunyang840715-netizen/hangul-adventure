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
  if (rnd(2)) s.math = randMath(dev);
  return s;
}
// 수학 모드(언니, 10-23): 단계·하루 문제 수는 나중에 바꾼 쪽, 푼 수·맞힌 수는 기기별, 옷장은 모으기
function randMath(dev) {
  const m = { level: rnd(5), levelT: rnd(3), perDay: pick([30, 50]), perDayT: rnd(3), solved: {}, correct: {}, total: { [dev]: rnd(40) }, owned: [], wear: {}, wearT: {} };
  for (const d of ['20700', '20701', '20600']) if (rnd(2)) { const n = rnd(50); m.solved[d] = { [dev]: n }; m.correct[d] = { [dev]: rnd(n + 1) }; }
  for (const it of ['hat:crown', 'toy:ball', 'neck:bell']) if (rnd(2)) m.owned.push(it);
  for (const p of ['maltese', 'koshort']) if (rnd(2)) { m.wear[p] = { hat: pick(['crown', 'cap']) }; m.wearT[p] = rnd(3); }
  if (rnd(2)) { m.lastItem = pick(['hat:crown', 'toy:ball']); m.lastItemT = rnd(3); }
  if (rnd(2)) { m.pet = pick(['maltese', 'koshort']); m.petT = rnd(3); }
  return m;
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
delete x.math; delete y.math;   // 수학 칸은 epoch와 상관없이 합치므로 여기서는 한글만
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
// 수학: epoch가 달라도(한글 초기화·백업 불러오기) 수학 칸은 두 쪽을 합침 — 법칙 검사(epoch 섞어서)
for (let i = 0; i < 3000; i++) {
  const a = randState('dA', pick([0, 5])), b = randState('dB', pick([0, 5, 9])), c = randState(pick(['dA', 'dB', 'dC']), pick([0, 5]));
  const ab = mergeState(a, b), ba = mergeState(b, a);
  if (canon(ab) !== canon(ba)) bad++;
  if (JSON.stringify(ab) !== JSON.stringify(ba)) badKeyOrder++;
  if (canon(mergeState(mergeState(a, b), c)) !== canon(mergeState(a, mergeState(b, c)))) bad++;
  // (epoch가 다르면 이긴 쪽 원본을 그대로 따르므로 전체 멱등은 예전처럼 같은 epoch 고리에서만 본다 — 수학 칸은 여기서도 멱등)
  const abab = mergeState(ab, ab);
  if (canon(mergeState(abab, abab).math) !== canon(abab.math)) bad++;
}
const chk = (name, ok) => { console.log(name, ok); if (!ok) bad++; };
const m1 = randState('dA'), m2 = randState('dB', 7);
m1.math = { level: 3, levelT: 9, perDay: 50, perDayT: 1, solved: { '20700': { dA: 30 } }, correct: { '20700': { dA: 28 } }, total: { dA: 28 }, owned: ['hat:crown'], wear: { maltese: { hat: 'crown' } }, wearT: { maltese: 5 } };
m2.math = { level: 1, levelT: 4, perDay: 30, perDayT: 6, solved: { '20700': { dB: 20 } }, correct: { '20700': { dB: 19 } }, total: { dB: 19 }, owned: ['toy:ball', 'hat:crown'], wear: {}, wearT: {} };
const mm = mergeState(m1, m2), mmr = mergeState(m2, m1);
chk('math epoch-independent:', mm.epoch === 7 && mm.lessonIdx === m2.lessonIdx && sumMap(mm.math.solved['20700']) === 50 && sumMap(mm.math.total) === 47);
chk('math lww/union ok:', mm.math.level === 3 && mm.math.perDay === 30 && mm.math.owned.join() === 'hat:crown,toy:ball' && mm.math.wear.maltese.hat === 'crown' && canon(mm) === canon(mmr));
const n1 = randState('dA'), n2 = randState('dB', 3); delete n1.math; delete n2.math;
chk('no math stays same:', mergeState(n1, n2) === n2);
const o1 = randState('dA'), o2 = randState('dB'); delete o1.math; delete o2.math;
chk('old states have no math key:', !('math' in mergeState(o1, o2)));
console.log('violations:', bad, '| key-order differences:', badKeyOrder);
process.exit(bad || badKeyOrder ? 1 : 0);
