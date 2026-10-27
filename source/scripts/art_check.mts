// 그림 경로·manifest·해시·용량 검사. 새 원화가 없으면 기존 그림을 그대로 쓴다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ART_MAP } from '../src/art/artmap';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const p = path.join(repo, 'art/art-manifest.json');
if (!fs.existsSync(p)) {
  assert.equal(Object.keys(ART_MAP).length, 0, '그림 경로 표가 있으면 manifest도 필요');
} else {
  const m = JSON.parse(fs.readFileSync(p, 'utf8')) as { files: { u: string; b: number }[] };
  assert.ok(Array.isArray(m.files));
  const files = new Map<string, number>();
  let total = 0, wear = 0;
  const pets = new Map<string, number>();
  for (const f of m.files) {
    assert.match(f.u, /^art\/[a-zA-Z0-9_/-]+\.[a-zA-Z0-9_.-]*[a-f0-9]{8}\.webp$/);
    assert.ok(!f.u.split('/').includes('..'));
    assert.ok(!files.has(f.u), '중복 그림 경로');
    const file = path.join(repo, f.u);
    assert.ok(fs.existsSync(file), '그림 파일 누락: ' + f.u);
    assert.ok(fs.realpathSync(file).startsWith(fs.realpathSync(path.join(repo, 'art')) + path.sep));
    const data = fs.readFileSync(file);
    assert.equal(data.length, f.b, 'manifest의 용량이 다름');
    assert.equal(data.toString('ascii', 0, 4), 'RIFF');
    assert.equal(data.toString('ascii', 8, 12), 'WEBP');
    assert.equal(createHash('sha256').update(data).digest('hex').slice(0, 8), f.u.split('.').at(-2), '내용 해시가 다름');
    const group = f.u.split('/')[1];
    // 한 장 상한: 배경 700KB(가로로 긴 .long. 1.2MB, 앞쪽 층 .front. 300KB) · 친구 그림 400KB(마리당 합계 2.5MB — 연속 동작 포함)
    // 가구·마당·놀이터 기구·효과 70KB · 집 짓기 500KB · 벽지·바닥 무늬 150KB · 그 밖(아이템·간식·낱말) 40KB
    const limit = group === 'backgrounds' ? (f.u.includes('.long.') ? 1200000 : f.u.includes('.front.') ? 300000 : 700000)
      : group === 'pets' ? 400000 : ['furniture', 'yard', 'park', 'effects'].includes(group) ? 70000
      : group === 'builds' ? 500000 : group === 'tiles' ? 150000 : 40000;
    assert.ok(data.length <= limit, '그림 용량 초과: ' + f.u);
    if (group === 'pets') {
      const id = f.u.split('/')[2].split('.')[0];
      // 10-27 사용자 요청(꾸미기 전부를 친구·자세마다 실제 착용 그림으로): 착용 그림(.paint-wear-)은 입었을 때만 받으므로
      // 친구 합계 2.5MB·전체 60MB에서 빼고 따로 센다(한 장 400KB는 같음). 용량 때문에 그림을 공유·재사용하지 않게.
      if (f.u.includes('.paint-wear-')) wear += data.length;
      else pets.set(id, (pets.get(id) || 0) + data.length);
    }
    total += data.length; files.set(f.u, f.b);
  }
  assert.ok(total - wear <= 60000000, '전체 그림(착용 그림 빼고) 60MB 초과');
  assert.ok(wear <= 400000000, '착용 그림(.paint-wear-) 합계 400MB 초과');
  for (const [id, b] of pets) assert.ok(b <= 2500000, '친구 하나의 그림 합계 2.5MB 초과: ' + id);
  for (const [id, u] of Object.entries(ART_MAP)) assert.ok(files.has(u), '그림 경로 표에만 있음: ' + id);
  console.log('그림 경로·내용 해시·용량 검사:', files.size, '개,', total, '바이트 (착용 그림', wear, '바이트)');
}
