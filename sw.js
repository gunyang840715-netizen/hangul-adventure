// 뭉치와 냥이의 글자 모험 — 인터넷이 없어도 열리게 저장해 두기
const V = 'app-e35d1e277b';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './voice.604960c1b8.0.json', './voice.604960c1b8.1.json', './voice.604960c1b8.2.json'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await Promise.all(CORE.map(async (u) => {
      // 음성 파일은 이름에 내용 표시(해시)가 있어서, 전에 받아 둔 게 있으면 다시 받지 않음
      const old = u.includes('voice.') ? await caches.match(u) : null;
      if (old) return c.put(u, old);
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error('fail ' + u);
      return c.put(u, r);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // 진도 연동(POST)은 그대로 통과
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // 다른 사이트는 건드리지 않음

  // 앱 화면: 인터넷이 되면 새 버전, 안 되면(또는 3초 넘게 걸리면) 저장본
  if (req.mode === 'navigate') {
    const net = fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put('./index.html', cp)); }
      return r;
    });
    const late = new Promise((res) => setTimeout(() => res(null), 3000));
    e.respondWith(
      Promise.race([net.catch(() => null), late])
        .then((r) => r || caches.match('./index.html').then((c) => c || net))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 나머지(음성·아이콘): 저장본 먼저
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((r) => {
      if (r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); }
      return r;
    }))
  );
});
