// 실제 서비스워커 템플릿의 설치·재사용·오프라인 응답·실패 시 이전 버전 유지 검사.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const code = fs.readFileSync(fileURLToPath(new URL('./sw.template.js', import.meta.url)), 'utf8').replace('__VERSION__', 'test');
const asset = 'art/pets/test.12345678.webp';
const lazy = 'art/pets/test.paint-walk.87654321.webp';      // 친구 새 그림: 설치 때 받지 않고 나올 때 받음
const lazyOld = 'art/pets/test.paint-front.11223344.webp';  // 전에 받아 둔 친구 새 그림: 새 버전에서도 남김
const bgLazy = 'art/backgrounds/meadow.land.13572468.webp';  // 손그림 배경: 나올 때 받음
const bgFirst = 'art/backgrounds/title.sky.24681357.webp';   // 첫 화면 배경: 설치 때 받음(여기서는 전에 받아 둔 것 재사용)
const normalize = (key: any) => new URL(typeof key === 'string' ? key : key.url, 'https://example.test/app/').pathname;
async function scenario(failArt = false) {
  const buckets = new Map<string, Map<string, Response>>();
  buckets.set('app-old', new Map([[normalize(asset), new Response('unchanged-art')], [normalize(lazyOld), new Response('old-paint')], [normalize(bgFirst), new Response('title-bg')]]));
  buckets.set('unrelated-site', new Map());
  if (failArt) buckets.get('app-old')!.clear();
  const events: Record<string, Function> = {};
  const requests: string[] = [];
  let offline = false, skipped = false;
  const caches = {
    async open(k: string) {
      if (!buckets.has(k)) buckets.set(k, new Map());
      return { async put(u: any, r: Response) { buckets.get(k)!.set(normalize(u), r.clone()); } };
    },
    async match(u: any) {
      for (const b of buckets.values()) { const r = b.get(normalize(u)); if (r) return r.clone(); }
    },
    async keys() { return [...buckets.keys()]; },
    async delete(k: string) { return buckets.delete(k); },
  };
  const fetchMock = async (u: any) => {
    const key = normalize(u); requests.push(key);
    if (offline) throw new Error('인터넷 없음');
    if (key.endsWith('/voice-manifest.json')) return Response.json({ files: [] });
    if (key.endsWith('/art/art-manifest.json')) return Response.json({ files: [{ u: asset, b: 13 }, { u: lazy, b: 10 }, { u: lazyOld, b: 9 }, { u: bgLazy, b: 7 }, { u: bgFirst, b: 8 }] });
    if (key.endsWith('.paint-walk.87654321.webp')) return new Response('lazy-paint');
    if (key.endsWith('meadow.land.13572468.webp')) return new Response('lazy-bg');
    if (key.endsWith('.webp') && failArt) return new Response('', { status: 503 });
    return new Response('cached-page');
  };
  vm.runInNewContext(code, {
    URL, caches, fetch: fetchMock,
    setTimeout: (f: Function, ms: number) => setTimeout(f, ms).unref(),
    self: { location: { origin: 'https://example.test' }, addEventListener(k: string, f: Function) { events[k] = f; },
      async skipWaiting() { skipped = true; }, clients: { async claim() {} } },
  });
  const dispatch = (name: string, extra = {}) => {
    let task: Promise<any> | undefined;
    events[name]({ ...extra, waitUntil(p: Promise<any>) { task = p; }, respondWith(p: Promise<any>) { task = p; } });
    assert.ok(task, '처리 Promise가 있어야 함');
    return task!;
  };
  if (failArt) {
    await assert.rejects(dispatch('install'));
    assert.equal(skipped, false);
    assert.ok(buckets.has('app-old'));
    return;
  }
  await dispatch('install');
  assert.equal(skipped, true);
  assert.ok(buckets.get('app-test')!.has(normalize(asset)));
  assert.ok(!requests.some(k => k.endsWith('.webp')), '같은 해시 그림은 다시 받지 않고, 친구 새 그림은 설치 때 받지 않아야 함');
  assert.ok(buckets.get('app-test')!.has(normalize(lazyOld)), '전에 받아 둔 친구 새 그림은 새 버전 저장소로 옮겨야 함');
  assert.ok(!buckets.get('app-test')!.has(normalize(lazy)));
  assert.ok(!buckets.get('app-test')!.has(normalize(bgLazy)), '배경은 설치 때 받지 않아야 함');
  assert.ok(buckets.get('app-test')!.has(normalize(bgFirst)), '첫 화면 배경은 설치 때 저장돼 있어야 함');
  await dispatch('activate');
  assert.ok(!buckets.has('app-old'));
  assert.ok(buckets.has('unrelated-site'), '다른 앱의 캐시는 지우지 않아야 함');
  offline = true;
  const image = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + asset } });
  assert.equal(await image.text(), 'unchanged-art');
  const kept = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + lazyOld } });
  assert.equal(await kept.text(), 'old-paint');
  // 인터넷이 되면 친구 새 그림을 받아 저장 → 그 뒤에는 인터넷 없이도 나옴
  offline = false;
  const got = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + lazy } });
  assert.equal(await got.text(), 'lazy-paint');
  await new Promise(r => setTimeout(r, 10));
  offline = true;
  const again = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + lazy } });
  assert.equal(await again.text(), 'lazy-paint');
  // 배경도 나올 때 받아 저장 → 그 뒤에는 인터넷 없이도
  offline = false;
  const bg = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + bgLazy } });
  assert.equal(await bg.text(), 'lazy-bg');
  await new Promise(r => setTimeout(r, 10));
  offline = true;
  const bg2 = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/' + bgLazy } });
  assert.equal(await bg2.text(), 'lazy-bg');
  const page = await dispatch('fetch', { request: { method: 'GET', mode: 'navigate', url: 'https://example.test/app/' } });
  assert.equal(await page.text(), 'cached-page');
  const artManifest = await dispatch('fetch', { request: { method: 'GET', url: 'https://example.test/app/art/art-manifest.json' } });
  assert.equal((await artManifest.json()).files.length, 5);
}
await scenario(); await scenario(true);
console.log('그림 캐시 재사용·오프라인·설치 실패 복구·친구 그림·배경 나중 받기 검사 통과');
