// 그림 원본은 저장소 art/ 하나에만 둔다. 개발·빌드의 정적 파일 경로로 그대로 복사.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.dirname(source);
const manifest = path.join(repo, 'art/art-manifest.json');
if (fs.existsSync(manifest)) {
  const m = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  for (const u of ['art/art-manifest.json', ...m.files.map(f => f.u)]) {
    if (!/^art\/[a-zA-Z0-9_./-]+$/.test(u) || u.split('/').includes('..')) throw new Error('그림 경로 오류');
    const target = path.join(source, 'public', u);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repo, u), target);
  }
  console.log('기존 그림 복사:', m.files.length, '개');
}
