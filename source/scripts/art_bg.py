# 배경 겹 그림 (COLLAB 8 묶음 4 · 원문 G) — GPT 배경(art-src/4-bg/<장면>/<장면>-<층>.png) → 앱 그림
#
#  장면마다 (바깥) 하늘 sky(뒤, 불투명) + 풍경 land(하늘 자리 단색 → 투명) + 앞 front(앞쪽 풀·꽃만, 나머지 단색 → 투명)
#           (실내 library·cave) 전체 full(불투명) + 앞 front
#  모험 지도 map-1~3(가로로 긴 그림), 효과 시트 fx-sheet-01~03(3x3 — 구름·꽃잎·나뭇잎·반딧불·빛줄기 등)
#
#  - GPT 원본 중 끝이 잘린 PNG가 있다(클라우드에서 저장할 때 잘림 — 디코딩하면 아래쪽 몇 %가 비어 있음).
#    하늘 층은 같은 장면 full의 같은 줄로 채우고(어차피 풍경 층에 가려지는 아래쪽), 실내 full은 바로 위 줄을 거울처럼 이어 채운다.
#    효과 시트에서 잘린 칸은 쓰지 않는다. 잘린 그림은 '다시 그릴 것'으로 적는다.
#  - 단색 배경 지우기는 art_key.chroma_key(배경색은 그림 맨 위 줄에서 정함).
#  - 저장: art/backgrounds/<장면>.<층>.<해시>.webp (가로로 긴 park·지도는 .long.) · art/effects/fx-<이름>.<해시>.webp
#    그림 키: bg.<장면>.<층> · map.<번호> · fx.<이름>
#
# 쓰는 법: python3 source/scripts/art_bg.py <art-src/4-bg 폴더> <저장소 맨 위> [장면,…]
#   (마당 배경도 같은 방식: python3 source/scripts/art_bg.py <art-src/6-yard 폴더> <저장소 맨 위> yard-dog,yard-cat)
import sys, os, re, io, json, glob, hashlib
import numpy as np, cv2
from PIL import Image, ImageFile
from art_key import chroma_key, keyval, KEYS

SRC, REPO = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3].split(',')) if len(sys.argv) > 3 and sys.argv[3] else None
QA = os.environ.get('BG_QA')

OUTDOOR = ['title', 'meadow', 'sky', 'castle', 'beach', 'night', 'park', 'river', 'yard-dog', 'yard-cat']
INDOOR = ['library', 'cave']
LONG = {'park'}
SIZE = (2560, 1600)            # 원문 G 크기
LONG_SIZE = (3840, 1200)       # 원문 G: 놀이터처럼 가로 2560 좌표인 곳 (GPT는 3600x1200 → 가로로 6.7% 늘림)
LIMIT = {'normal': 700000, 'long': 1200000, 'front': 300000}
REPORT = {'잘림': [], '파일': {}}


def log(*a): print(*a, flush=True)


def load(path):
    """PNG → (float32 RGB/RGBA 0~1, 온전한 줄 수). 끝이 잘린 파일은 읽힌 데까지."""
    im = Image.open(path)
    try:
        im.load(); full = True
    except OSError:
        ImageFile.LOAD_TRUNCATED_IMAGES = True
        im = Image.open(path); im.load()
        ImageFile.LOAD_TRUNCATED_IMAGES = False
        full = False
    a = np.asarray(im.convert('RGBA')).astype(np.float32) / 255.
    rows = a.shape[0]
    if not full:
        nz = np.where(np.asarray(im.convert('RGB')).reshape(a.shape[0], -1).any(axis=1))[0]
        rows = int(nz.max()) if len(nz) else 0          # 마지막 줄은 반쯤 풀렸을 수 있어 뺌
        REPORT['잘림'].append({'file': os.path.relpath(path, SRC), 'rows': rows, 'of': a.shape[0]})
        log(f'  잘린 파일: {os.path.relpath(path, SRC)} — {rows}/{a.shape[0]}줄({rows / a.shape[0] * 100:.0f}%)')
    return a, rows


def fit(a, size):
    """크기 맞추기(같은 장면의 층은 모두 같은 크기·같은 자리로)"""
    if (a.shape[1], a.shape[0]) == size: return a
    P = a.copy(); P[..., :3] *= P[..., 3:4]
    R = cv2.resize(P, size, interpolation=cv2.INTER_AREA if size[0] < a.shape[1] else cv2.INTER_CUBIC)
    al = np.clip(R[..., 3:4], 0, 1)
    R[..., :3] = np.where(al > 1e-4, R[..., :3] / np.maximum(al, 1e-4), 0)
    R[..., 3:4] = al
    return np.clip(R, 0, 1)


def key_of_top(a):
    """그림 맨 위 줄 색으로 단색 배경(초록·분홍) 고르기"""
    top = np.median(a[:6, :, :3].reshape(-1, 3), axis=0)
    name = min(KEYS, key=lambda k: float(np.abs(top - KEYS[k]).sum()))
    if float(np.abs(top - KEYS[name]).sum()) > 0.35: return None, None
    return name, top.astype(np.float32)


def keyed(a, strict=False):
    """단색 배경 지우기 + 지운 곳 가까이(30px)에 남은 배경색 점 정리.
    GPT 편집본은 나뭇잎 사이 같은 작은 틈에 배경색이 섞인 점을 남긴다(작은 덩어리라 chroma_key가 남김).
    배경색 기운 k가 문턱을 넘는 만큼 투명하게 하고 색에서 배경색 기운을 뺀다. 문턱: 분홍 0.25~0.5, 초록 0.35~0.6
    (풀·잎은 초록이라 초록 배경은 더 높게). strict=False(앞 층)는 분홍 꽃잎을 지키려고 0.35~0.6."""
    name, K = key_of_top(a)
    if K is None:
        log('    (맨 위가 단색이 아님 — 지우지 않음)'); return a
    out = chroma_key(a, K=K, name=name)
    rgb, al = out[..., :3], out[..., 3]
    k = keyval(rgb, name)
    lo, hi = (0.25, 0.5) if (name == 'M' and strict) else (0.35, 0.6)
    near = cv2.dilate((al < 0.5).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))).astype(bool)
    f = np.clip((hi - k) / (hi - lo), 0, 1)
    hit = near & (k > lo)
    out[..., 3] = np.where(hit, al * f, al)
    if name == 'M':
        g = rgb[..., 1]
        rgb[..., 0] = np.where(hit, np.minimum(rgb[..., 0], g + lo), rgb[..., 0])
        rgb[..., 2] = np.where(hit, np.minimum(rgb[..., 2], g + lo), rgb[..., 2])
    else:
        mx = np.maximum(rgb[..., 0], rgb[..., 2])
        rgb[..., 1] = np.where(hit, np.minimum(rgb[..., 1], mx + lo), rgb[..., 1])
    n2 = demagenta(out) if (name == 'M' and strict) else 0
    log(f'    배경색 점 정리: {int(hit.sum())}점 · 분홍 물든 가장자리 다시 칠하기 {n2}점')
    return out


def demagenta(out):
    """분홍 배경과 섞여 물든 가장자리(야자잎·나뭇잎 끝의 보라·분홍 테)를 둘레 색으로 다시 칠한다.
    지운 곳 가까이(30px)·그림 위쪽 78% 안의 분홍·보라 빛깔(색상 275~345도, 채도 0.2 이상)만 — 아래쪽 꽃은 건드리지 않음."""
    H, W = out.shape[:2]
    al = out[..., 3]
    rgb8 = (np.clip(out[..., :3], 0, 1) * 255).astype(np.uint8)
    hsv = cv2.cvtColor(rgb8, cv2.COLOR_RGB2HSV)
    h, s, v = hsv[..., 0].astype(np.float32) * 2, hsv[..., 1] / 255., hsv[..., 2] / 255.
    near = cv2.dilate((al < 0.5).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (61, 61))).astype(bool)
    upper = np.zeros((H, W), bool); upper[:int(H * 0.78)] = True
    m = near & upper & (al > 0.05) & (h >= 275) & (h <= 345) & (s > 0.2) & (v > 0.2)
    if not m.any(): return 0
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8))
    # 투명한 곳의 색은 가장 가까운 불투명한 곳 색으로(번지기 전에 검정이 끼지 않게)
    solid = (al > 0.5) & ~m.astype(bool)
    from scipy import ndimage as ndi
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    base = rgb8[iy, ix]
    base[solid] = rgb8[solid]
    fixed = cv2.inpaint(base, m, 4, cv2.INPAINT_TELEA)
    sel = m.astype(bool)
    out[..., :3] = np.where(sel[..., None], fixed.astype(np.float32) / 255., out[..., :3])
    return int(sel.sum())


def webp(a, limit, alpha):
    im8 = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    if alpha:
        im8[im8[..., 3] == 0, :3] = 0
        im = Image.fromarray(im8, 'RGBA')
    else:
        im = Image.fromarray(im8[..., :3], 'RGB')
    for q in (82, 78, 74, 70, 66, 62, 58, 54, 50):
        b = io.BytesIO()
        if alpha: im.save(b, 'WEBP', quality=q, method=6, alpha_quality=80, exact=False)
        else: im.save(b, 'WEBP', quality=q, method=6)
        if len(b.getvalue()) <= limit: return b.getvalue(), q
    return b.getvalue(), q


def put(group, name, data):
    h = hashlib.sha256(data).hexdigest()[:8]
    rel = f'art/{group}/{name}.{h}.webp'
    os.makedirs(os.path.join(REPO, 'art', group), exist_ok=True)
    with open(os.path.join(REPO, rel), 'wb') as f: f.write(data)
    return rel


def update_artmap(amap):
    p = os.path.join(REPO, 'source/src/art/artmap.ts')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'export const ART_MAP: Record<string, string> = \{(.*?)\n\};', s, re.S)
    cur = dict(re.findall(r'"([^"]+)": "([^"]+)"', m.group(1)))
    cur.update(amap)
    body = ',\n'.join(f'  "{k}": "{v}"' for k, v in sorted(cur.items(), key=lambda kv: (kv[0].split('.')[1], kv[0])))
    s = s[:m.start()] + 'export const ART_MAP: Record<string, string> = {\n' + body + '\n};' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)


def layer_path(scene, layer):
    p = os.path.join(SRC, scene, f'{scene}-{layer}.png')
    vs = sorted(glob.glob(os.path.join(SRC, scene, f'{scene}-{layer}-v*.png')), key=lambda f: int(re.search(r'-v(\d+)\.png$', f).group(1)))
    return vs[-1] if vs else (p if os.path.exists(p) else None)


def scene_out(scene, amap, qa):
    long = scene in LONG
    size = LONG_SIZE if long else SIZE
    tag = '.long' if long else ''
    indoor = scene in INDOOR
    full_p = layer_path(scene, 'full')
    if not full_p: log(f'{scene}: full 없음 → 건너뜀'); return
    log(f'{scene}:')
    full, fr = load(full_p)
    if fr < full.shape[0]:
        # 실내 전체 그림: 잘린 아래쪽을 바로 위 줄을 거울처럼 이어 채움(바닥 무늬) — 다시 그릴 것
        k = full.shape[0] - fr
        full[fr:] = full[fr - 1::-1][:k]
    out = {}
    if indoor:
        out['full'] = (full, False)
    else:
        sky_p, land_p = layer_path(scene, 'sky'), layer_path(scene, 'land')
        if not sky_p or not land_p: log(f'  sky·land 없음 → 건너뜀'); return
        sky, sr = load(sky_p)
        if sky.shape != full.shape: sky = fit(sky, (full.shape[1], full.shape[0]))
        if sr < sky.shape[0]: sky[sr:] = full[sr:]                     # 풍경 층에 가려지는 아래쪽
        land, lr = load(land_p)
        if land.shape != full.shape: land = fit(land, (full.shape[1], full.shape[0]))
        if lr < land.shape[0]: land[lr:] = full[lr:]
        out['sky'] = (sky, False)
        out['land'] = (keyed(land, strict=True), True)
    front_p = layer_path(scene, 'front')
    if front_p:
        fr_, frr = load(front_p)
        if fr_.shape != full.shape: fr_ = fit(fr_, (full.shape[1], full.shape[0]))
        if frr < fr_.shape[0]: fr_[frr:] = 0
        out['front'] = (keyed(fr_), True)
    for layer, (a, alpha) in out.items():
        a = fit(a, size)
        lim = LIMIT['long'] if long else LIMIT['front'] if layer == 'front' else LIMIT['normal']
        data, q = webp(a if alpha else a[..., :3], lim, alpha)
        rel = put('backgrounds', f'{scene}.{layer}{tag}', data)
        amap[f'bg.{scene}.{layer}'] = rel
        REPORT['파일'][rel] = {'q': q, 'b': len(data), 'size': list(size)}
        log(f'  {layer}: {size[0]}x{size[1]} 품질 {q} {len(data) // 1024}KB')
        qa.append((f'{scene}.{layer}', a, alpha))


def maps_out(amap, qa):
    for f in sorted(glob.glob(os.path.join(SRC, 'map', 'map-*.png'))):
        m = re.match(r'map-(\d+)(?:-v\d+)?\.png$', os.path.basename(f))
        if not m: continue
        n = m.group(1)
        if f != layer_path('map', n): continue
        a, r = load(f)
        if r < a.shape[0]: a[r:] = a[r - 1::-1][:a.shape[0] - r]
        a = fit(a, LONG_SIZE)
        data, q = webp(a[..., :3], LIMIT['long'], False)
        rel = put('backgrounds', f'map-{n}.long', data)
        amap[f'map.{n}'] = rel
        REPORT['파일'][rel] = {'q': q, 'b': len(data), 'size': list(LONG_SIZE)}
        log(f'map-{n}: 품질 {q} {len(data) // 1024}KB')
        qa.append((f'map-{n}', a, False))


def fx_out(amap, qa):
    """효과 시트 3x3 → 칸마다 꼭 맞게 잘라 저장(투명 배경 / 빛 효과는 검정 배경 그대로 — 앱이 '스크린' 섞기로 겹침)"""
    for f in sorted(glob.glob(os.path.join(SRC, 'fx', 'fx-sheet-*.png'))):
        if not re.match(r'fx-sheet-\d+\.png$', os.path.basename(f)): continue
        base = os.path.basename(f)[:-4]
        vs = sorted(glob.glob(os.path.join(SRC, 'fx', base + '-v*.png')))
        if vs: f = vs[-1]
        cm = json.load(open(os.path.join(SRC, 'fx', base + '.json'), encoding='utf-8'))
        a, rows = load(f)
        H, W = a.shape[:2]
        dark = a[..., 3].min() > 0.99 and np.median(a[:8, :, :3]) < 0.05      # 검정 배경(빛 효과)
        cw, ch = W / 3, H / 3
        for c, name in cm.items():
            c = int(c) - 1
            x0, y0 = int(c % 3 * cw), int(c // 3 * ch)
            x1, y1 = int(x0 + cw), int(y0 + ch)
            if y1 > rows:
                log(f'  {name}: 잘린 칸 → 쓰지 않음'); REPORT.setdefault('못쓴칸', []).append(name); continue
            cell = a[y0:y1, x0:x1].copy()
            if dark:
                lum = cell[..., :3].max(axis=2)
                m = lum > 0.04
            else:
                if a[..., 3].min() > 0.99: cell = chroma_key(cell)
                m = cell[..., 3] > 0.03
            ys, xs = np.where(m)
            if len(xs) == 0: log(f'  {name}: 빈 칸'); continue
            pad = 6
            bx0, by0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
            bx1, by1 = min(cell.shape[1], xs.max() + 1 + pad), min(cell.shape[0], ys.max() + 1 + pad)
            J = cell[by0:by1, bx0:bx1]
            k = min(1.0, 320 / max(J.shape[:2]))
            if k < 1: J = fit(J, (max(1, int(J.shape[1] * k)), max(1, int(J.shape[0] * k))))
            key = name.split('.', 1)[1] if name.startswith('fx.') else name
            data, q = webp(J if not dark else J[..., :3], 70000, not dark)
            rel = put('effects', f'fx-{key}', data)
            amap[f'fx.{key}'] = rel
            REPORT['파일'][rel] = {'q': q, 'b': len(data), 'size': [J.shape[1], J.shape[0]], 'screen': bool(dark)}
            qa.append((f'fx.{key}', J, not dark))
        log(f'{base}: 끝')


def main():
    man_p = os.path.join(REPO, 'art/art-manifest.json')
    man = json.load(open(man_p, encoding='utf-8'))
    files = {f['u']: f['b'] for f in man['files']}
    amap, qa = {}, []
    scenes = [s for s in OUTDOOR + INDOOR if os.path.isdir(os.path.join(SRC, s)) and (ONLY is None or s in ONLY)]
    for s in scenes: scene_out(s, amap, qa)
    if ONLY is None or 'map' in ONLY:
        if os.path.isdir(os.path.join(SRC, 'map')): maps_out(amap, qa)
    if ONLY is None or 'fx' in ONLY:
        if os.path.isdir(os.path.join(SRC, 'fx')): fx_out(amap, qa)
    # manifest: 같은 이름의 예전 파일은 빼고 지움
    names = {}
    for rel in amap.values(): names[rel.rsplit('.', 2)[0]] = rel
    for u in list(files):
        stem = u.rsplit('.', 2)[0]
        if stem in names and names[stem] != u:
            del files[u]
            try: os.remove(os.path.join(REPO, u))
            except FileNotFoundError: pass
    for rel in amap.values(): files[rel] = os.path.getsize(os.path.join(REPO, rel))
    man['files'] = [{'u': u, 'b': b} for u, b in sorted(files.items())]
    json.dump(man, open(man_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    update_artmap(amap)
    tot = sum(os.path.getsize(os.path.join(REPO, v)) for v in amap.values())
    log(f'끝: {len(amap)}장, {tot // 1024} KB')
    if QA:
        os.makedirs(QA, exist_ok=True)
        json.dump(REPORT, open(os.path.join(QA, 'bg_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        for name, a, alpha in qa:
            t = cv2.resize(a, (min(900, a.shape[1]), int(min(900, a.shape[1]) * a.shape[0] / a.shape[1])), interpolation=cv2.INTER_AREA)
            if alpha:
                bg = np.zeros_like(t[..., :3]); bg[..., 0] = 0.95; bg[..., 1] = 0.4; bg[..., 2] = 0.8
                bg[::24, :] = 1; bg[:, ::24] = 1
                t = t[..., :3] * t[..., 3:4] + bg * (1 - t[..., 3:4])
            else: t = t[..., :3]
            cv2.imwrite(os.path.join(QA, f'{name}.jpg'), cv2.cvtColor((np.clip(t, 0, 1) * 255).astype(np.uint8), cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 82])


if __name__ == '__main__':
    main()
