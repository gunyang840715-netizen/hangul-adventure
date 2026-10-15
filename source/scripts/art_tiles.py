# 벽지·바닥 무늬 (COLLAB 8 묶음 5) — GPT 무늬 그림(1024) → 이어 붙여도 이음새가 안 보이는 무늬(art/tiles/<이름>.<해시>.webp)
#
#  1) 무늬가 되풀이되는 간격을 찾아(가로·세로 따로) 그 간격만큼 잘라 낸다 — 줄무늬·물방울·체크처럼 규칙이 있는 무늬는
#     이것만으로 이음새가 없어진다.
#  2) 남은 이음새는 반 칸 밀어 둔 그림과 가장자리 띠에서만 부드럽게 섞어 지운다(구름·카펫처럼 규칙이 없는 무늬).
#  3) 긴 변 512 이하로 줄여 WebP(150KB 이하).
#
# 쓰는 법: python3 source/scripts/art_tiles.py <art-src/5-room/tiles 폴더> <저장소 맨 위>
#  파일 이름 wall-dots.png → 그림 키 tile.wall-dots
import sys, os, re, json, glob, hashlib, io
import numpy as np, cv2
from PIL import Image

SRC, REPO = sys.argv[1], sys.argv[2]
QA = os.environ.get('TILE_QA')
MAXS, LIMIT = 512, 150000


BAND = 0.08          # 이음새를 섞는 띠(한 변의 8%)


def best_lag(I, axis):
    """axis 방향으로 무늬가 다시 시작하는 자리(잘라 낼 길이). 자른 뒤에도 띠만큼의 '이어지는 그림'이 남아야 한다"""
    A = I if axis == 1 else I.transpose(1, 0, 2)
    W = A.shape[1]; K = 24; b = int(BAND * W)
    head = A[:, :K]
    best = None
    for L in range(int(0.55 * W), W - b - K):
        e = float(np.abs(A[:, L:L + K] - head).mean())
        score = e * (1 + 0.15 * (W - L) / W)          # 같으면 길게(그림을 많이 남기게)
        if best is None or score < best[0]: best = (score, L, e)
    return best[1], best[2]


def crossfade(I, Lx, Ly):
    """[0,Lx)x[0,Ly)를 잘라 내되, 왼쪽·위 띠는 잘린 바로 뒤의 그림(I[Lx+…], I[Ly+…])에서 원래 그림으로 서서히 바꿔
    이어 붙였을 때 오른쪽 끝 → 왼쪽 끝이 원래 그림처럼 그대로 이어지게 한다"""
    H, W = I.shape[:2]
    sm = lambda n: (lambda t: t * t * (3 - 2 * t))(np.arange(n, dtype=np.float32) / n)
    bx = int(BAND * W); A = I[:, :Lx].copy(); w = sm(bx)[None, :, None]
    A[:, :bx] = I[:, Lx:Lx + bx] * (1 - w) + I[:, :bx] * w
    by = int(BAND * H); B = A[:Ly].copy(); w = sm(by)[:, None, None]
    B[:by] = A[Ly:Ly + by] * (1 - w) + A[:by] * w
    return B


def webp(arr):
    im = Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGB')
    for q in (84, 78, 72, 66, 60, 52):
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6)
        if len(b.getvalue()) <= LIMIT: return b.getvalue()
    return b.getvalue()


def update_artmap(amap):
    p = os.path.join(REPO, 'source/src/art/artmap.ts')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'export const ART_MAP: Record<string, string> = \{(.*?)\n\};', s, re.S)
    cur = dict(re.findall(r'"([^"]+)": "([^"]+)"', m.group(1)))
    cur.update(amap)
    body = ',\n'.join(f'  "{k}": "{v}"' for k, v in sorted(cur.items(), key=lambda kv: (kv[0].split('.')[1], kv[0])))
    s = s[:m.start()] + 'export const ART_MAP: Record<string, string> = {\n' + body + '\n};' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)


def main():
    man_p = os.path.join(REPO, 'art/art-manifest.json')
    man = json.load(open(man_p, encoding='utf-8'))
    files = {f['u']: f['b'] for f in man['files']}
    amap = {}; sizes = {}; qa = []
    for f in sorted(glob.glob(os.path.join(SRC, '*.png'))):
        name = os.path.splitext(os.path.basename(f))[0]
        if not re.match(r'^(wall|floor)-[a-z]+$', name): continue
        I = np.asarray(Image.open(f).convert('RGB')).astype(np.float32)
        Lx, ex = best_lag(I, 1); Ly, ey = best_lag(I, 0)
        T = crossfade(I, Lx, Ly)
        k = MAXS / max(T.shape[:2])
        T = cv2.resize(T, (int(round(T.shape[1] * k)), int(round(T.shape[0] * k))), interpolation=cv2.INTER_AREA)
        data = webp(T)
        h = hashlib.sha256(data).hexdigest()[:8]
        rel = f'art/tiles/{name}.{h}.webp'
        os.makedirs(os.path.join(REPO, 'art/tiles'), exist_ok=True)
        open(os.path.join(REPO, rel), 'wb').write(data)
        # 예전 같은 이름 파일 빼기
        for u in list(files):
            if u.startswith(f'art/tiles/{name}.') and u != rel:
                del files[u]
                try: os.remove(os.path.join(REPO, u))
                except FileNotFoundError: pass
        files[rel] = len(data); amap[f'tile.{name}'] = rel; sizes[name] = (T.shape[1], T.shape[0])
        print(f'{name}: 간격 {Lx}x{Ly} (어긋남 {ex:.1f}/{ey:.1f}) → {T.shape[1]}x{T.shape[0]} {len(data) // 1024}KB', flush=True)
        qa.append((name, T))
    man['files'] = [{'u': u, 'b': b} for u, b in sorted(files.items())]
    json.dump(man, open(man_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    update_artmap(amap)
    if QA:
        os.makedirs(QA, exist_ok=True)
        tiles = []
        for name, T in qa:
            t = cv2.resize(T, (160, int(160 * T.shape[0] / T.shape[1])))
            tiles.append(np.tile(t, (2, 2, 1)))
        h = max(t.shape[0] for t in tiles)
        rows = [np.hstack([np.pad(t, ((0, h - t.shape[0]), (0, 0), (0, 0)), constant_values=255) for t in tiles[i:i + 5]]) for i in range(0, len(tiles), 5)]
        w = max(r.shape[1] for r in rows)
        S = np.vstack([np.pad(r, ((0, 0), (0, w - r.shape[1]), (0, 0)), constant_values=255) for r in rows])
        cv2.imwrite(os.path.join(QA, 'tiles.png'), cv2.cvtColor(np.clip(S, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))


if __name__ == '__main__':
    main()
