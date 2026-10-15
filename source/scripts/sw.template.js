// 뭉치와 냥이의 글자 모험 — 인터넷이 없어도 열리게 저장해 두기
const V = 'app-__VERSION__';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const MANIFEST = './voice-manifest.json';
const ART_MANIFEST = './art/art-manifest.json';
// 나올 때 받는 그림: 친구 새 그림(.paint-) · 손그림 배경(첫 화면 title·모험 지도 map-는 설치 때 받음)
// (원문: 첫 화면에 필요한 그림만 먼저 불러오고 나머지는 필요할 때 불러온다 — 받은 것은 아래 fetch에서 저장해 인터넷 없이도 나옴)
const LAZY = /\/(pets\/[a-z]+\.paint-|backgrounds\/(?!title\.|map-))/;

async function precacheArt(c) {
  const r = await fetch(ART_MANIFEST, { cache: 'reload' });
  if (r.status === 404) return; // 그림 없는 이전 설치 방식도 지원
  if (!r.ok) throw new Error('그림 목록 다운로드 실패');
  const m = await r.clone().json();
  await c.put(ART_MANIFEST, r);
  for (const f of m.files || []) {
    const old = await caches.match(f.u);
    if (old) { await c.put(f.u, old); continue; }
    // 친구 새 그림(.paint-)·배경은 설치 때 받지 않는다: 화면에 나올 때 받아 저장(아래 fetch). 전에 받아 둔 것은 위에서 옮겨 둠.
    if (LAZY.test(f.u)) continue;
    const x = await fetch(f.u);
    if (!x.ok) throw new Error('그림 다운로드 실패: ' + f.u);
    await c.put(f.u, x);
  }
}

async function precacheVoices(c) {
  // 음성팩 목록을 받아 조각들을 저장 (이름에 내용 표시(해시)가 있어서, 전에 받아 둔 게 있으면 다시 받지 않음)
  try {
    const r = await fetch(MANIFEST, { cache: 'reload' });
    if (!r.ok) return;
    const m = await r.clone().json();
    await c.put(MANIFEST, r);
    for (const f of m.files || []) {
      const old = await caches.match(f.u);
      if (old) { await c.put(f.u, old); continue; }
      const x = await fetch(f.u);
      if (x.ok) await c.put(f.u, x);
    }
  } catch (e) { /* 앱이 켜질 때 다시 받음 */ }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(CORE.map(async (u) => {
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error('fail ' + u);
      return c.put(u, r);
    }));
    await precacheVoices(c);
    await precacheArt(c);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith('app-') && k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function netFirst(req, key, ms) {
  const net = fetch(req).then((r) => {
    if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(key, cp)); }
    return r;
  });
  const late = new Promise((res) => setTimeout(() => res(null), ms));
  return Promise.race([net.catch(() => null), late])
    .then((r) => r || caches.match(key).then((c) => c || net))
    .catch(() => caches.match(key));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // 진도 연동(POST)은 그대로 통과
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // 다른 사이트는 건드리지 않음

  // 앱 화면: 인터넷이 되면 새 버전, 안 되면(또는 3초 넘게 걸리면) 저장본
  if (req.mode === 'navigate') { e.respondWith(netFirst(req, './index.html', 3000)); return; }
  // 음성팩 목록: 새 음성이 있으면 받도록 인터넷 먼저
  if (url.pathname.endsWith('/voice-manifest.json')) { e.respondWith(netFirst(req, MANIFEST, 4000)); return; }
  if (url.pathname.endsWith('/art/art-manifest.json')) { e.respondWith(netFirst(req, ART_MANIFEST, 4000)); return; }

  // 나머지(음성 조각·아이콘): 저장본 먼저
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); }
      return r;
    }))
  );
});
