# 시트 그림 나누기 (COLLAB 9) — GPT가 4x4·3x3 시트로 그린 간식·꾸미기 아이템·가구를 한 장씩 떼어
# 앱 그림(art/<그룹>/<이름>.<내용해시 8자리>.webp)으로 저장하고 art-manifest.json·artmap.ts를 고친다.
#
#  1) 단색 배경(#00FF00·#FF00FF)을 지운다(art_key.py). 투명 배경이면 그대로.
#  2) 덩어리(알파)를 찾아 무게 중심이 있는 칸에 붙인다 — 칸 경계를 조금 넘은 그림·떨어진 조각(비눗방울 등)도 그 칸의 것으로.
#     아주 작은 티끌은 버린다.
#  3) 칸마다 꼭 맞게 잘라 정사각형에 넣는다. 놓는 쪽은 종류마다(모자·신발·장난감 = 아래, 목걸이·옷 = 위, 나머지 = 가운데)
#     — 앱이 정사각형 하나를 자리 상자에 맞춰 놓으면 모자 챙·신발 바닥·목선이 늘 같은 쪽에 온다.
#  4) WebP(용량 상한 안으로 품질을 낮춰 가며)로 저장.
#
# 쓰는 법:
#   python3 source/scripts/art_sheets.py snacks    <art-src/3-snacks 폴더> <저장소 맨 위>
#   python3 source/scripts/art_sheets.py items     <art-src/2-items 폴더>  <저장소 맨 위>
#   python3 source/scripts/art_sheets.py furniture <art-src/5-room 폴더>   <저장소 맨 위> [건너뛸 시트,…]
# 시트마다 같은 이름의 .json({"1": "id", …} — 왼쪽 위부터 오른쪽으로)이 있어야 한다. 같은 시트의 -vN이 있으면 가장 큰 N을 쓴다.
import sys, os, re, json, glob, hashlib, io
import numpy as np, cv2
from PIL import Image
from art_key import chroma_key

MODE, SRC, REPO = sys.argv[1], sys.argv[2], sys.argv[3]
SKIP = set(sys.argv[4].split(',')) if len(sys.argv) > 4 and sys.argv[4] else set()
QA = os.environ.get('SHEET_QA')

# 그룹: 저장 폴더, 그림 키 앞부분, 한 변 크기, 용량 상한, 칸 수
CONF = {
    'snacks': dict(group='snacks', size=256, limit=40000, grid=4),
    'items': dict(group='items', size=256, limit=40000, grid=4),
    'furniture': dict(group='furniture', size=640, limit=70000, grid=3),   # 가구는 정사각형 X(꼭 맞게 자른 그대로) — 앱이 자리 상자에 비율 맞춰 넣음
}[MODE]

# 정사각형 안에서 놓는 쪽(세로): 'bottom' | 'top' | 'center'
ITEM_ALIGN = {'hat': 'bottom', 'shoes': 'bottom', 'toy': 'bottom', 'neck': 'top', 'clothes': 'top', 'glasses': 'center'}
FURN_ALIGN = {'mobile': 'top', 'walldeco': 'top', 'window': 'center', 'frame': 'center', 'clock': 'center', 'shelf': 'center'}   # 나머지는 바닥에 놓는 것 = 'bottom'


def log(*a): print(*a, flush=True)


def key_of(id_):
    """그림 키와 파일 이름: snack.bone / item.hat.bow / furn.bed.cushion"""
    if MODE == 'snacks': return f'snack.{id_}', id_
    slot, k = id_.split(':')
    return (f'item.{slot}.{k}' if MODE == 'items' else f'furn.{slot}.{k}'), f'{slot}-{k}'


def align_of(id_):
    if MODE == 'snacks': return 'center'
    slot = id_.split(':')[0]
    if MODE == 'items': return ITEM_ALIGN.get(slot, 'center')
    return FURN_ALIGN.get(slot, 'bottom')


def latest_sheets():
    """sheet-NN(-side)?(-vM)?.png 중 같은 시트는 가장 큰 vM. → [(png, json)]"""
    out = {}
    for f in glob.glob(os.path.join(SRC, 'sheet-*.png')):
        m = re.match(r'(sheet-\d+(?:-side)?)(?:-v(\d+))?\.png$', os.path.basename(f))
        if not m: continue
        base, v = m.group(1), int(m.group(2) or 1)
        if base.endswith('-side'): continue                       # 옆모습 시트는 아직 쓰지 않음(옆모습 동작에 붙일 때)
        if base in SKIP: continue
        if base not in out or v > out[base][0]: out[base] = (v, f)
    res = []
    for base, (v, f) in sorted(out.items()):
        j = os.path.join(SRC, base + '.json')
        if not os.path.exists(j): log(f'{base}: 칸 목록(.json) 없음 → 건너뜀'); continue
        res.append((f, json.load(open(j, encoding='utf-8'))))
    return res


def cells(I, grid):
    """덩어리를 칸에 나눠 붙이기 → {칸 번호(1~): 그 칸 그림(잘라낸 RGBA)}"""
    H, W = I.shape[:2]
    a = I[..., 3]
    m = (a > 0.06).astype(np.uint8)
    m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, 8)
    cw, ch = W / grid, H / grid
    tiny = 0.0012 * cw * ch
    groups = {}
    for i in range(1, n):
        if st[i, 4] < tiny: continue
        cx, cy = cen[i]
        c = int(min(grid - 1, cx // cw)) + int(min(grid - 1, cy // ch)) * grid + 1
        groups.setdefault(c, []).append(i)
    out = {}
    for c, ids in groups.items():
        mask = np.isin(lab, ids)
        ys, xs = np.where(mask & (a > 0.02))
        if len(xs) == 0: continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        J = I[y0:y1, x0:x1].copy()
        J[..., 3] *= mask[y0:y1, x0:x1]
        out[c] = J
    return out


def to_square(J, size, align):
    """꼭 맞게 자른 그림 → size x size 정사각형(비율 유지, 2% 여백)"""
    h, w = J.shape[:2]
    pad = 0.02
    k = size * (1 - 2 * pad) / max(h, w)
    nw, nh = max(1, int(round(w * k))), max(1, int(round(h * k)))
    # 알파를 곱한 색으로 줄여야 가장자리에 검은 테가 생기지 않는다
    P = J.copy(); P[..., :3] *= P[..., 3:4]
    R = cv2.resize(P, (nw, nh), interpolation=cv2.INTER_AREA)
    a = R[..., 3:4]
    R[..., :3] = np.where(a > 1e-4, R[..., :3] / np.maximum(a, 1e-4), 0)
    S = np.zeros((size, size, 4), np.float32)
    x = (size - nw) // 2
    y = {'bottom': size - int(size * pad) - nh, 'top': int(size * pad), 'center': (size - nh) // 2}[align]
    S[y:y + nh, x:x + nw] = R
    return S


def to_tight(J, size):
    """꼭 맞게 자른 그대로, 긴 변 size 이하"""
    h, w = J.shape[:2]
    k = min(1.0, size / max(h, w))
    if k >= 1: return J
    P = J.copy(); P[..., :3] *= P[..., 3:4]
    R = cv2.resize(P, (max(1, int(round(w * k))), max(1, int(round(h * k)))), interpolation=cv2.INTER_AREA)
    a = R[..., 3:4]
    R[..., :3] = np.where(a > 1e-4, R[..., :3] / np.maximum(a, 1e-4), 0)
    return R


def webp(arr, limit):
    im8 = np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8)
    im8[im8[..., 3] == 0, :3] = 0
    im = Image.fromarray(im8, 'RGBA')
    for q in (82, 76, 70, 64, 58, 50, 42):
        b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, alpha_quality=85, exact=False)
        if len(b.getvalue()) <= limit: return b.getvalue(), q
    return b.getvalue(), q


def put(group, name, data):
    h = hashlib.sha256(data).hexdigest()[:8]
    rel = f'art/{group}/{name}.{h}.webp'
    os.makedirs(os.path.join(REPO, 'art', group), exist_ok=True)
    with open(os.path.join(REPO, rel), 'wb') as f: f.write(data)
    return rel


def update_artmap(amap, prefix):
    p = os.path.join(REPO, 'source/src/art/artmap.ts')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'export const ART_MAP: Record<string, string> = \{(.*?)\n\};', s, re.S)
    cur = dict(re.findall(r'"([^"]+)": "([^"]+)"', m.group(1)))
    cur = {k: v for k, v in cur.items() if not (k.startswith(prefix) and k in amap)}
    cur.update(amap)
    body = ',\n'.join(f'  "{k}": "{v}"' for k, v in sorted(cur.items(), key=lambda kv: (kv[0].split('.')[1], kv[0])))
    s = s[:m.start()] + 'export const ART_MAP: Record<string, string> = {\n' + body + '\n};' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)


def main():
    group, size, limit, grid = CONF['group'], CONF['size'], CONF['limit'], CONF['grid']
    man_p = os.path.join(REPO, 'art/art-manifest.json')
    man = json.load(open(man_p, encoding='utf-8'))
    files = {f['u']: f['b'] for f in man['files']}
    amap = {}; qa = []
    for png, cmap in latest_sheets():
        I = np.asarray(Image.open(png).convert('RGBA')).astype(np.float32) / 255.
        I = chroma_key(I)
        got = cells(I, grid)
        log(f'{os.path.basename(png)}: 칸 {sorted(got)} / 목록 {len(cmap)}')
        for c, id_ in cmap.items():
            J = got.get(int(c))
            if J is None: log(f'  {id_}: 그림 없음(칸 {c})'); continue
            S = to_tight(J, size) if MODE == 'furniture' else to_square(J, size, align_of(id_))
            data, q = webp(S, limit)
            k, name = key_of(id_)
            amap[k] = put(group, name, data)
            qa.append((id_, S))
            if q < 82: log(f'  {id_}: 품질 {q} ({len(data)} B)')
    # manifest: 이번에 다시 만든 이름의 예전 파일은 빼고 지움
    names = {os.path.basename(v).split('.')[0] for v in amap.values()}
    for rel in list(files):
        if rel.startswith(f'art/{group}/') and os.path.basename(rel).split('.')[0] in names and rel not in amap.values():
            del files[rel]
            try: os.remove(os.path.join(REPO, rel))
            except FileNotFoundError: pass
    for rel in amap.values(): files[rel] = os.path.getsize(os.path.join(REPO, rel))
    man['files'] = [{'u': u, 'b': b} for u, b in sorted(files.items())]
    json.dump(man, open(man_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    update_artmap(amap, {'snacks': 'snack.', 'items': 'item.', 'furniture': 'furn.'}[MODE])
    tot = sum(os.path.getsize(os.path.join(REPO, v)) for v in amap.values())
    log(f'끝: {len(amap)}장, {tot // 1024} KB')
    if QA and qa:
        os.makedirs(QA, exist_ok=True)
        n = len(qa); cols = 8; t = 160
        sheet = np.full((((n + cols - 1) // cols) * (t + 18), cols * t, 3), 235, np.uint8)
        for i, (id_, S) in enumerate(qa):
            r, c = divmod(i, cols)
            T = cv2.resize(S, (t, t), interpolation=cv2.INTER_AREA)
            bg = np.full((t, t, 3), 0.92, np.float32); bg[::16, :] = 0.8; bg[:, ::16] = 0.8
            C = T[..., :3] * T[..., 3:4] + bg * (1 - T[..., 3:4])
            sheet[r * (t + 18):r * (t + 18) + t, c * t:(c + 1) * t] = (C * 255).astype(np.uint8)
            cv2.putText(sheet, id_, (c * t + 2, r * (t + 18) + t + 13), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (40, 40, 40), 1)
        cv2.imwrite(os.path.join(QA, f'{MODE}.png'), cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))


if __name__ == '__main__':
    main()
