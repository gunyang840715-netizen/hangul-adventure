// 두 기기의 진도를 합치는 규칙 (앱이 사용. 서버는 기기별로 보관만 함)
// - 기기마다 따로 세는 값(별, 모험 횟수, 사용 시간, 하루 단계 수, 간식, 성장)은 기기별로 저장하고 합계를 씀
// - 글자별 기록은 더 많이 연습한 쪽을 따름
// - 이름·설정·고른 친구·꾸미기·이어하기는 나중에 바꾼 쪽을 따름
// - 수학 모드(언니) 칸은 mergeMath — 한글 초기화(epoch)와 상관없이 합침
// 같은 두 상태를 몇 번 합쳐도, 어떤 순서로 합쳐도 결과가 같다.

// 두 표의 열쇠를 모아 정렬 (결과 모양이 합치는 순서와 상관없이 같도록)
function keysOf(a, b) {
  var seen = {}, out = [], k;
  for (k in (a || {})) if (!seen[k]) { seen[k] = 1; out.push(k); }
  for (k in (b || {})) if (!seen[k]) { seen[k] = 1; out.push(k); }
  return out.sort();
}

function mergeMaxMap(a, b) {
  var out = {};
  a = a || {}; b = b || {};
  keysOf(a, b).forEach(function (k) { out[k] = Math.max(a[k] || 0, b[k] || 0); });
  return out;
}

function mergeNested(a, b) {
  var out = {};
  a = a || {}; b = b || {};
  keysOf(a, b).forEach(function (k) { out[k] = mergeMaxMap(a[k], b[k]); });
  return out;
}

// 완전히 같은 조건이면 글자로 비교해서 항상 같은 쪽을 고름 (합치는 순서가 달라도 결과가 같도록)
function tieBreak(x, y) {
  var sx = JSON.stringify(x), sy = JSON.stringify(y);
  if (sx === undefined) return y;
  if (sy === undefined) return x;
  return sy > sx ? y : x;
}

function betterItem(x, y) {
  if (!x) return y;
  if (!y) return x;
  if ((y.seen || 0) !== (x.seen || 0)) return (y.seen || 0) > (x.seen || 0) ? y : x;
  if ((y.last || 0) !== (x.last || 0)) return (y.last || 0) > (x.last || 0) ? y : x;
  if ((y.box || 0) !== (x.box || 0)) return (y.box || 0) > (x.box || 0) ? y : x;
  return tieBreak(x, y);
}

/** 열쇠마다 나중에 바꾼 값 (꾸미기처럼 친구마다 따로) */
function lwwMap(av, at, bv, bt) {
  av = av || {}; bv = bv || {}; at = at || {}; bt = bt || {};
  var out = {}, ot = {};
  var ka = {}, kb = {}, k;
  for (k in av) ka[k] = 1; for (k in at) ka[k] = 1;
  for (k in bv) kb[k] = 1; for (k in bt) kb[k] = 1;
  var ks = keysOf(ka, kb);
  ks.forEach(function (k) {
    var ta = at[k] || 0, tb = bt[k] || 0;
    var v = tb > ta ? bv[k] : ta > tb ? av[k] : tieBreak(av[k], bv[k]);
    if (v !== undefined) out[k] = v;
    ot[k] = Math.max(ta, tb);
  });
  return [out, ot];
}

// 수학 모드 (초등 2학년 언니 — 한글과 따로, 10-23): 한글 초기화·백업 불러오기(epoch)와 상관없이 늘 두 쪽을 합친다
// - 단계·하루 문제 수·마지막에 받은 것·고른 친구·꾸미기는 나중에 바꾼 쪽, 푼 수·맞힌 수는 기기별로 세고 합계, 옷장은 모으기
function mergeMath(a, b) {
  if (!a && !b) return undefined;
  // 한쪽만 있어도 같은 모양으로 다시 만든다 (몇 번 합쳐도 결과가 같도록)
  a = a || {}; b = b || {};
  var out = {};
  var lwwM = function (fields, tfield) {
    var ta = a[tfield] || 0, tb = b[tfield] || 0;
    var pa = fields.map(function (f) { return a[f]; }), pb = fields.map(function (f) { return b[f]; });
    var da = pa.some(function (v) { return v !== undefined; }), db = pb.some(function (v) { return v !== undefined; });
    // 값이 있는 쪽 우선 → 나중에 바꾼 쪽 → 같으면 글자로 비교
    var src = !db ? a : !da ? b : tb > ta ? b : ta > tb ? a : (JSON.stringify(pb) > JSON.stringify(pa) ? b : a);
    fields.forEach(function (f) { if (src[f] !== undefined) out[f] = src[f]; });
    out[tfield] = Math.max(ta, tb);
  };
  lwwM(['level'], 'levelT');
  lwwM(['perDay'], 'perDayT');
  out.solved = mergeNested(a.solved, b.solved);
  out.correct = mergeNested(a.correct, b.correct);
  out.total = mergeMaxMap(a.total, b.total);
  var owned = (a.owned || []).slice();
  (b.owned || []).forEach(function (x) { if (owned.indexOf(x) < 0) owned.push(x); });
  out.owned = owned.sort();
  var w = lwwMap(a.wear, a.wearT, b.wear, b.wearT);
  out.wear = w[0]; out.wearT = w[1];
  var has = function (f, tf) { return a[f] !== undefined || b[f] !== undefined || a[tf] !== undefined || b[tf] !== undefined; };
  if (has('lastItem', 'lastItemT')) lwwM(['lastItem'], 'lastItemT');
  if (has('pet', 'petT')) lwwM(['pet'], 'petT');
  // 90일 지난 날짜 기록은 정리 (지금까지 맞힌 수는 total에 그대로)
  var days = Object.keys(out.solved).concat(Object.keys(out.correct)).map(Number);
  if (days.length) {
    var newest = Math.max.apply(null, days);
    [out.solved, out.correct].forEach(function (m) {
      Object.keys(m).forEach(function (d) { if (Number(d) < newest - 90) delete m[d]; });
    });
  }
  return out;
}

function mergeState(a, b) {
  if (!a) return b;
  if (!b) return a;
  // 초기화·단계 이동 같은 부모 조작은 epoch(시각)를 새로 찍는다 → 더 새 epoch 쪽을 통째로 따름
  // (수학 칸만은 한글 초기화와 따로라 두 쪽을 합친다)
  if ((a.epoch || 0) !== (b.epoch || 0)) {
    var win = (a.epoch || 0) > (b.epoch || 0) ? a : b, lose = win === a ? b : a;
    if (!lose.math) return win;
    var o = {};
    for (var k in win) o[k] = win[k];
    o.math = mergeMath(win.math, lose.math);
    return o;
  }
  var out = {};
  out.v = 3;
  out.epoch = a.epoch || 0;
  out.curVer = Math.max(a.curVer || 1, b.curVer || 1);
  out.lessonIdx = Math.max(a.lessonIdx || 0, b.lessonIdx || 0);
  out.items = {};
  var ia = a.items || {}, ib = b.items || {};
  keysOf(ia, ib).forEach(function (k) { out.items[k] = betterItem(ia[k], ib[k]); });
  out.stars = mergeMaxMap(a.stars, b.stars);
  out.adventures = mergeMaxMap(a.adventures, b.adventures);
  out.usage = mergeNested(a.usage, b.usage);
  out.lessonsByDay = mergeNested(a.lessonsByDay, b.lessonsByDay);
  out.extraMin = mergeNested(a.extraMin, b.extraMin);
  out.extraLessons = mergeNested(a.extraLessons, b.extraLessons);
  var owned = (a.owned || []).slice();
  (b.owned || []).forEach(function (x) { if (owned.indexOf(x) < 0) owned.push(x); });
  out.owned = owned.sort();
  // 강아지·고양이
  out.growth = mergeNested(a.growth, b.growth);
  out.snacks = mergeNested(a.snacks, b.snacks);
  out.eaten = mergeNested(a.eaten, b.eaten);
  out.games = mergeMaxMap(a.games, b.games);
  // 집 짓기 재료·지은 부분 (기기별로 세고 합계)
  out.mats = mergeMaxMap(a.mats, b.mats);
  out.built = mergeNested(a.built, b.built);
  var w = lwwMap(a.wear, a.wearT, b.wear, b.wearT);
  out.wear = w[0]; out.wearT = w[1];
  // 틀려서 돌려준 것 (기기별로 세고 합계 / 아이템은 시각)
  out.lostSnacks = mergeNested(a.lostSnacks, b.lostSnacks);
  out.lostMats = mergeMaxMap(a.lostMats, b.lostMats);
  out.itemGot = mergeMaxMap(a.itemGot, b.itemGot);
  out.itemLost = mergeMaxMap(a.itemLost, b.itemLost);
  // 집 안·놀이터 꾸미기: 산 것은 모으고, 놓은 자리는 장소마다 나중에 바꾼 쪽
  out.bought = mergeMaxMap(a.bought, b.bought);
  var dc = lwwMap(a.deco, a.decoT, b.deco, b.decoT);
  out.deco = dc[0]; out.decoT = dc[1];
  // 나중에 바꾼 쪽 (여러 칸을 한 묶음으로)
  var lww = function (fields, tfield) {
    var ta = a[tfield] || 0, tb = b[tfield] || 0;
    var pa = fields.map(function (f) { return a[f]; }), pb = fields.map(function (f) { return b[f]; });
    var src = tb > ta ? b : ta > tb ? a : (JSON.stringify(pb) > JSON.stringify(pa) ? b : a);
    fields.forEach(function (f) { if (src[f] !== undefined) out[f] = src[f]; });
    out[tfield] = Math.max(ta, tb);
  };
  lww(['name'], 'nameT');
  lww(['settings'], 'settingsT');
  lww(['lastItem'], 'lastItemT');
  lww(['dog', 'cat', 'lead'], 'petsT');
  lww(['resume'], 'resumeT');
  // 받아쓰기 시험: 마지막 통과 기록·복습 통과한 날·다시 공부할 단계
  lww(['lastPass'], 'lastPassT');
  lww(['reviewDay'], 'reviewDayT');
  lww(['hold'], 'holdT');
  if (out.lastPass === undefined) out.lastPass = null;
  if (out.hold === undefined) out.hold = null;
  if (out.resume === undefined) out.resume = null;
  // 수학 모드 (언니)
  var mm = mergeMath(a.math, b.math);
  if (mm) out.math = mm;
  // 90일 지난 사용 기록은 정리
  var days = Object.keys(out.usage).concat(Object.keys(out.lessonsByDay)).map(Number);
  if (days.length) {
    var newest = Math.max.apply(null, days);
    [out.usage, out.lessonsByDay, out.extraMin, out.extraLessons].forEach(function (m) {
      Object.keys(m).forEach(function (d) { if (Number(d) < newest - 90) delete m[d]; });
    });
  }
  return out;
}

function sumMap(m) {
  var s = 0;
  for (var k in (m || {})) s += m[k] || 0;
  return s;
}

if (typeof module !== 'undefined') module.exports = { mergeState: mergeState, sumMap: sumMap };
