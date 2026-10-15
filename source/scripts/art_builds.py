# 집 짓기 그림 (원문 H · COLLAB 8 묶음 8) — GPT 완성 그림 3장(강아지 집·고양이 집·놀이터) + 재료 아이콘
#  - 완성 그림은 캔버스 그대로(앱의 부품 영역 좌표 art/Build.tsx BUILD_MASK가 이 캔버스 0~1 기준) WebP로.
#  - 재료 아이콘은 꼭 맞게 잘라 긴 변 320으로.
#  - 단색 배경(#FF00FF 등)이면 지운다(art_key). 그림 키: build.<id>.complete · build.mat
# 쓰는 법: python3 source/scripts/art_builds.py <art-src/8-build 폴더> <저장소 맨 위>
import sys, os, re, io, json, glob, hashlib
import numpy as np, cv2
from PIL import Image
from art_key import chroma_key

SRC, REPO = sys.argv[1], sys.argv[2]


def latest(name):
    vs = sorted(glob.glob(os.path.join(SRC, f'{name}-v*.png')), key=lambda f: int(re.search(r'-v(\d+)\.png$', f).group(1)))
    p = os.path.join(SRC, f'{name}.png')
    return vs[-1] if vs else (p if os.path.exists(p) else None)


def webp(a, limit):
    im8 = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    im8[im8[..., 3] == 0, :3] = 0
    im = Image.fromarray(im8, 'RGBA')
    for q in (84, 80, 76, 72, 68, 62, 56):
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, alpha_quality=85, exact=False)
        if len(b.getvalue()) <= limit: return b.getvalue(), q
    return b.getvalue(), q


def main():
    man_p = os.path.join(REPO, 'art/art-manifest.json')
    man = json.load(open(man_p, encoding='utf-8'))
    files = {f['u']: f['b'] for f in man['files']}
    amap = {}
    for name, key in [('doghouse-complete', 'build.doghouse.complete'), ('cathouse-complete', 'build.cathouse.complete'),
                      ('park-complete', 'build.park.complete'), ('mat', 'build.mat')]:
        p = latest(name)
        if not p: print(name, '없음'); continue
        a = np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255.
        a = chroma_key(a)
        if name == 'mat':
            ys, xs = np.where(a[..., 3] > 0.03)
            pad = 8
            a = a[max(0, ys.min() - pad):ys.max() + 1 + pad, max(0, xs.min() - pad):xs.max() + 1 + pad]
            k = 320 / max(a.shape[:2])
            P = a.copy(); P[..., :3] *= P[..., 3:4]
            R = cv2.resize(P, (int(round(a.shape[1] * k)), int(round(a.shape[0] * k))), interpolation=cv2.INTER_AREA)
            al = R[..., 3:4]; R[..., :3] = np.where(al > 1e-4, R[..., :3] / np.maximum(al, 1e-4), 0)
            a = np.clip(R, 0, 1)
        data, q = webp(a, 500000 if name != 'mat' else 40000)
        h = hashlib.sha256(data).hexdigest()[:8]
        rel = f'art/builds/{name}.{h}.webp'
        os.makedirs(os.path.join(REPO, 'art/builds'), exist_ok=True)
        open(os.path.join(REPO, rel), 'wb').write(data)
        for u in list(files):
            if u.startswith(f'art/builds/{name}.') and u != rel:
                del files[u]
                try: os.remove(os.path.join(REPO, u))
                except FileNotFoundError: pass
        files[rel] = len(data); amap[key] = rel
        print(f'{name}: {a.shape[1]}x{a.shape[0]} 품질 {q} {len(data) // 1024}KB')
    man['files'] = [{'u': u, 'b': b} for u, b in sorted(files.items())]
    json.dump(man, open(man_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    p = os.path.join(REPO, 'source/src/art/artmap.ts')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'export const ART_MAP: Record<string, string> = \{(.*?)\n\};', s, re.S)
    cur = dict(re.findall(r'"([^"]+)": "([^"]+)"', m.group(1)))
    cur.update(amap)
    body = ',\n'.join(f'  "{k}": "{v}"' for k, v in sorted(cur.items(), key=lambda kv: (kv[0].split('.')[1], kv[0])))
    s = s[:m.start()] + 'export const ART_MAP: Record<string, string> = {\n' + body + '\n};' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    main()
