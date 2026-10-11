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
  let total = 0;
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
    const limit = group === 'backgrounds' ? (f.u.includes('.long.') ? 1200000 : f.u.includes('.front.') ? 300000 : 700000)
      : group === 'pets' ? 350000 : group === 'furniture' || group === 'yard' ? 70000 : group === 'builds' ? 500000 : 40000;
    assert.ok(data.length <= limit, '그림 용량 초과: ' + f.u);
    if (group === 'pets') {
      const id = f.u.split('/')[2].split('.')[0];
      pets.set(id, (pets.get(id) || 0) + data.length);
    }
    total += data.length; files.set(f.u, f.b);
  }
  assert.ok(total <= 45000000, '전체 그림 45MB 초과');
  for (const b of pets.values()) assert.ok(b <= 350000, '친구 하나의 부품 합계 350KB 초과');
  for (const [id, u] of Object.entries(ART_MAP)) assert.ok(files.has(u), '그림 경로 표에만 있음: ' + id);
  console.log('그림 경로·내용 해시·용량 검사:', files.size, '개,', total, '바이트');
}
