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
// 수학 모드(10-23·10-24): 단계·하루 문제 수(예전)·하루 공부 시간·문제 시간·이름·친구·꾸민 자리는 나중에 바꾼 쪽, 푼 수·맞힌 수·공부한 시간·지은 부분은 기기별, 옷장·산 가구는 모으기
function randMath(dev) {
  const m = { level: rnd(5), levelT: rnd(3), perDay: pick([30, 50]), perDayT: rnd(3), solved: {}, correct: {}, total: { [dev]: rnd(40) }, owned: [], wear: {}, wearT: {} };
  for (const d of ['20700', '20701', '20600']) if (rnd(2)) { const n = rnd(50); m.solved[d] = { [dev]: n }; m.correct[d] = { [dev]: rnd(n + 1) }; }
  for (const it of ['hat:crown', 'toy:ball', 'neck:bell']) if (rnd(2)) m.owned.push(it);
  for (const p of ['maltese', 'koshort']) if (rnd(2)) { m.wear[p] = { hat: pick(['crown', 'cap']) }; m.wearT[p] = rnd(3); }
  if (rnd(2)) { m.lastItem = pick(['hat:crown', 'toy:ball']); m.lastItemT = rnd(3); }
  if (rnd(2)) { m.pet = pick(['maltese', 'koshort']); m.petT = rnd(3); }
  // 2차: 없을 수도 있음(예전 판 기기)
  if (rnd(3)) {
    m.lv = { add: rnd(3), sub: rnd(3), mul: rnd(4), div: rnd(2) }; m.lvT = {};
    for (const c of ['add', 'mul']) if (rnd(2)) m.lvT[c] = rnd(3);
    m.solvedC = {}; m.correctC = {};
    for (const k of ['20700:add', '20700:mul', '20600:sub']) if (rnd(2)) { const n = rnd(30); m.solvedC[k] = { [dev]: n }; m.correctC[k] = { [dev]: rnd(n + 1) }; }
    m.timeMul = pick([1, 1.5, 0]); m.timeMulT = rnd(3);
    m.name = pick(['', '가나', '다라']); m.nameT = rnd(3);
    if (rnd(2)) { m.dog = pick(['maltese', 'poodle']); m.cat = pick(['koshort', 'persian']); m.petsT = rnd(3); }
    m.built = {}; for (const b of ['doghouse', 'park']) if (rnd(2)) m.built[b] = { [dev]: rnd(6) };
    m.bought = {}; for (const f of ['bed:basket', 'y-tree:pine']) if (rnd(2)) m.bought[f] = rnd(5);
    m.deco = {}; m.decoT = {}; for (const pl of ['doghouse', 'doghouse-out']) if (rnd(2)) { m.deco[pl] = { bed: pick(['bed:basket', 'bed:round']) }; m.decoT[pl] = rnd(3); }
    // 3차(10-24): 하루 공부 시간·공부한 시간 — 없을 수도 있음(2차 판 기기)
    if (rnd(3)) {
      m.dayMin = pick([30, 60]); m.dayMinT = rnd(3);
      m.ms = {}; for (const d of ['20700', '20701', '20500']) if (rnd(2)) m.ms[d] = { [dev]: rnd(4e6) };
      // 4차(10-24): 수학 간식 — 없을 수도 있음(3차 판 기기)
      if (rnd(3)) {
        m.snacks = {}; m.eaten = {}; m.fed = {};
        for (const sn of ['bone', 'fish', 'cookie']) { if (rnd(2)) m.snacks[sn] = { [dev]: rnd(9) }; if (rnd(2)) m.eaten[sn] = { [dev]: rnd(4) }; }
        for (const p of ['maltese', 'koshort']) if (rnd(2)) m.fed[p] = { [dev]: rnd(7) };
        // 5차(10-25): 맞춤법 문제별 기록(분×10+상태) — 없을 수도 있음(4차 판 기기)
        if (rnd(3)) {
          m.sp = {}; for (const k of ['k1.1', 'k1.2', 'g1.2', 'l7.1']) if (rnd(2)) m.sp[k] = (29500000 + rnd(4)) * 10 + rnd(4);
          // 6차(10-25): 수학 친구 성장 — 친구별 2·3점 간식 덤 점수, 없을 수도 있음(5차 판 기기)
          if (rnd(3)) { m.fedPlus = {}; for (const p of ['maltese', 'koshort']) if (rnd(2)) m.fedPlus[p] = { [dev]: rnd(6) }; }
        }
      }
    }
  }
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
// 2차 칸: 항목 단계는 항목마다 나중에 바꾼 쪽, 항목별 하루 기록·지은 부분은 기기별 합계, 산 가구는 모으기, 집 꾸민 자리·이름·친구는 나중에 바꾼 쪽
const k1 = randState('dA'), k2 = randState('dB');
k1.math = { ...m1.math, lv: { add: 2, sub: 0, mul: 1, div: 0 }, lvT: { add: 9, mul: 1 }, solvedC: { '20700:add': { dA: 25 } }, correctC: { '20700:add': { dA: 25 } }, timeMul: 1.5, timeMulT: 3,
  name: '가나', nameT: 2, dog: 'poodle', cat: 'koshort', petsT: 8, built: { doghouse: { dA: 3 } }, bought: { 'bed:basket': 4 }, deco: { doghouse: { bed: 'bed:basket' } }, decoT: { doghouse: 2 } };
k2.math = { ...m2.math, lv: { add: 1, sub: 1, mul: 2, div: 1 }, lvT: { add: 4, mul: 6, sub: 5 }, solvedC: { '20700:add': { dB: 10 }, '20700:mul': { dB: 15 } }, correctC: { '20700:add': { dB: 9 } }, timeMul: 0, timeMulT: 7,
  name: '다라', nameT: 5, built: { doghouse: { dB: 2 }, park: { dB: 1 } }, bought: { 'y-tree:pine': 6 }, deco: { doghouse: { bed: 'bed:round' } }, decoT: { doghouse: 6 } };
const kk = mergeState(k1, k2).math, kr = mergeState(k2, k1).math;
chk('math 2nd lww ok:', kk.lv.add === 2 && kk.lv.mul === 2 && kk.lv.sub === 1 && kk.timeMul === 0 && kk.name === '다라' && kk.dog === 'poodle' && kk.deco.doghouse.bed === 'bed:round');
chk('math 2nd sums ok:', sumMap(kk.solvedC['20700:add']) === 35 && sumMap(kk.solvedC['20700:mul']) === 15 && sumMap(kk.built.doghouse) === 5 && sumMap(kk.built.park) === 1
  && Object.keys(kk.bought).sort().join() === 'bed:basket,y-tree:pine' && canon(kk) === canon(kr) && JSON.stringify(kk) === JSON.stringify(kr));
// 3차 칸: 하루 공부 시간은 나중에 바꾼 쪽, 공부한 시간은 기기별 합계, 90일 지난 날짜는 정리
const t1 = randState('dA'), t2 = randState('dB');
t1.math = { ...k1.math, dayMin: 60, dayMinT: 9, ms: { '20700': { dA: 600000 }, '20601': { dA: 5 } } };
t2.math = { ...k2.math, dayMin: 30, dayMinT: 4, ms: { '20700': { dB: 900000 }, '20701': { dB: 1000 } } };
const tt = mergeState(t1, t2).math, tr = mergeState(t2, t1).math;
chk('math 3rd lww/sums ok:', tt.dayMin === 60 && tt.dayMinT === 9 && sumMap(tt.ms['20700']) === 1500000 && sumMap(tt.ms['20701']) === 1000
  && !('20601' in tt.ms) && canon(tt) === canon(tr) && JSON.stringify(tt) === JSON.stringify(tr));
// 4차 칸: 수학 간식 받은·먹인 개수, 친구별 먹은 횟수는 기기별 합계 (한글 간식과 따로)
const s1 = randState('dA'), s2 = randState('dB');
s1.math = { ...t1.math, snacks: { bone: { dA: 3 }, cookie: { dA: 1 } }, eaten: { bone: { dA: 1 } }, fed: { maltese: { dA: 1 } } };
s2.math = { ...t2.math, snacks: { bone: { dB: 2 }, fish: { dB: 4 } }, eaten: { fish: { dB: 2 } }, fed: { maltese: { dB: 2 }, koshort: { dB: 2 } } };
const ss = mergeState(s1, s2).math, sr = mergeState(s2, s1).math;
chk('math 4th snack sums ok:', sumMap(ss.snacks.bone) === 5 && sumMap(ss.snacks.fish) === 4 && sumMap(ss.snacks.cookie) === 1 && sumMap(ss.eaten.bone) === 1 && sumMap(ss.eaten.fish) === 2
  && sumMap(ss.fed.maltese) === 3 && sumMap(ss.fed.koshort) === 2 && canon(ss) === canon(sr) && JSON.stringify(ss) === JSON.stringify(sr));
const o5 = randState('dB'); o5.math = { ...t2.math };
chk('math old device keeps 4th fields:', sumMap(mergeState(s1, o5).math.snacks.bone) === 3 && sumMap(mergeState(o5, s1).math.fed.maltese) === 1);
// 5차 칸(10-25): 맞춤법 문제별 기록은 나중에 푼 쪽(큰 값) — 틀렸다가(1) 다른 기기에서 고침(2)이 이김, 4차 판 기기와 합쳐도 그대로
const p1 = randState('dA'), p2 = randState('dB');
p1.math = { ...s1.math, sp: { 'k1.1': 295000001, 'g1.2': 295000100 } };
p2.math = { ...s2.math, sp: { 'k1.1': 295000052, 'l7.1': 295000013 } };
const pp = mergeState(p1, p2).math, pr = mergeState(p2, p1).math;
chk('math 5th spell later wins:', pp.sp['k1.1'] === 295000052 && pp.sp['g1.2'] === 295000100 && pp.sp['l7.1'] === 295000013
  && Object.keys(pp.sp).join() === 'g1.2,k1.1,l7.1' && canon(pp) === canon(pr) && JSON.stringify(pp) === JSON.stringify(pr));
const o6 = randState('dB'); o6.math = { ...s2.math };
chk('math old device keeps 5th fields:', mergeState(p1, o6).math.sp['k1.1'] === 295000001 && mergeState(o6, p1).math.sp['g1.2'] === 295000100);
// 6차 칸(10-25): 수학 친구 성장 — 친구별 덤 점수는 기기별 합계(성장 점수 = fed + fedPlus), 5차 판 기기와 합쳐도 그대로
const f1 = randState('dA'), f2 = randState('dB');
f1.math = { ...p1.math, fedPlus: { maltese: { dA: 2 } } };
f2.math = { ...p2.math, fedPlus: { maltese: { dB: 1 }, koshort: { dB: 4 } } };
const ff = mergeState(f1, f2).math, fr = mergeState(f2, f1).math;
chk('math 6th grow bonus sums ok:', sumMap(ff.fedPlus.maltese) === 3 && sumMap(ff.fedPlus.koshort) === 4 && sumMap(ff.fed.maltese) + sumMap(ff.fedPlus.maltese) === 6
  && canon(ff) === canon(fr) && JSON.stringify(ff) === JSON.stringify(fr));
const o7 = randState('dB'); o7.math = { ...p2.math };
chk('math old device keeps 6th fields:', sumMap(mergeState(f1, o7).math.fedPlus.maltese) === 2 && sumMap(mergeState(o7, f1).math.fedPlus.maltese) === 2);
// 2차 판 기기(3차 칸 없음)와 합쳐도 공부 시간·설정은 그대로
const o4 = randState('dB'); o4.math = { ...k2.math };
const oq = mergeState(t1, o4).math;
chk('math old device keeps 3rd fields:', oq.dayMin === 60 && sumMap(oq.ms['20700']) === 600000);
// 예전 판 기기(2차 칸 없음)와 합쳐도 새 칸은 그대로
const o3 = randState('dA'); o3.math = { ...m1.math };
const oo = mergeState(k2, o3).math;
chk('math old device keeps 2nd fields:', oo.lv.mul === 2 && oo.name === '다라' && sumMap(oo.built.doghouse) === 2 && oo.bought['y-tree:pine'] === 6);
const n1 = randState('dA'), n2 = randState('dB', 3); delete n1.math; delete n2.math;
chk('no math stays same:', mergeState(n1, n2) === n2);
const o1 = randState('dA'), o2 = randState('dB'); delete o1.math; delete o2.math;
chk('old states have no math key:', !('math' in mergeState(o1, o2)));
console.log('violations:', bad, '| key-order differences:', badKeyOrder);
process.exit(bad || badKeyOrder ? 1 : 0);
