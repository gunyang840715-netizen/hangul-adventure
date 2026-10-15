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
#   python3 source/scripts/art_sheets.py yard      <art-src/6-yard 폴더>   <저장소 맨 위>   (마당 기구 — 그림 키 furn.y-<자리>.<이름>)
#   python3 source/scripts/art_sheets.py park      <art-src/7-park 폴더>   <저장소 맨 위>   (놀이터 기구 — furn.<자리>.<이름>)
#   python3 source/scripts/art_sheets.py words     <art-src/9-words 폴더>  <저장소 맨 위>   (낱말 그림 — word.<번호>)
# 시트마다 같은 이름의 .json({"1": "id", …} — 왼쪽 위부터 오른쪽으로)이 있어야 한다. 같은 시트의 -vN이 있으면 가장 큰 N을 쓴다.
# 꾸미기는 sheet-NN 말고 사용자 요청으로 더한 옷 시트(clothes-dog-extra-NN · clothes-cat-extra-NN)도 함께 읽는다.
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
    'yard': dict(group='yard', size=640, limit=70000, grid=3),
    'park': dict(group='park', size=720, limit=70000, grid=3),
    'words': dict(group='words', size=320, limit=40000, grid=4),
}[MODE]
TIGHT = MODE in ('furniture', 'yard', 'park')

# 정사각형 안에서 놓는 쪽(세로): 'bottom' | 'top' | 'center'
ITEM_ALIGN = {'hat': 'bottom', 'shoes': 'bottom', 'toy': 'bottom', 'neck': 'top', 'clothes': 'top', 'glasses': 'center'}
FURN_ALIGN = {'mobile': 'top', 'walldeco': 'top', 'window': 'center', 'frame': 'center', 'clock': 'center', 'shelf': 'center'}   # 나머지는 바닥에 놓는 것 = 'bottom'


def log(*a): print(*a, flush=True)


def key_of(id_):
    """그림 키와 파일 이름: snack.bone / item.hat.bow / furn.bed.cushion / word.w001"""
    if MODE == 'snacks': return f'snack.{id_}', id_
    if MODE == 'words': return f'word.{id_}', id_
    slot, k = id_.split(':')
    return (f'item.{slot}.{k}' if MODE == 'items' else f'furn.{slot}.{k}'), f'{slot}-{k}'


def align_of(id_):
    if MODE in ('snacks', 'words'): return 'center'
    slot = id_.split(':')[0]
    if MODE == 'items': return ITEM_ALIGN.get(slot, 'center')
    return FURN_ALIGN.get(slot, 'bottom')


def latest_sheets():
    """sheet-NN(-side)?(-vM)?.png 중 같은 시트는 가장 큰 vM. → [(png, json)]"""
    out = {}
    # 시트: sheet-NN · 사용자 요청 옷 추가(10-15) clothes-dog-extra-NN · clothes-cat-extra-NN
    for f in glob.glob(os.path.join(SRC, '*.png')):
        m = re.match(r'((?:sheet|clothes-(?:dog|cat)-extra)-\d+(?:-side)?)(?:-v(\d+))?\.png$', os.path.basename(f))
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
    cell = lambda cx, cy: int(min(grid - 1, max(0, cx) // cw)) + int(min(grid - 1, max(0, cy) // ch)) * grid + 1
    # 넓혀서 이으면 서로 거의 닿은 이웃 칸 물건이 한 덩어리가 된다(옷 추가 시트) → 안 넓힌 덩어리 중 큰 것이
    # 여러 칸에 있으면 그 덩어리를 가장 가까운 큰 덩어리 쪽으로 나눈다(나머지 시트는 예전과 똑같이)
    m0 = (a > 0.06).astype(np.uint8)
    n0, lab0, st0, cen0 = cv2.connectedComponentsWithStats(m0, 8)
    groups = {}
    for i in range(1, n):
        if st[i, 4] < tiny: continue
        comp = lab == i
        subs = [j for j in np.unique(lab0[comp]) if j and st0[j, 4] >= 0.08 * cw * ch]
        if len({cell(*cen0[j]) for j in subs}) <= 1:
            groups.setdefault(cell(*cen[i]), []).append(comp)
            continue
        d = np.stack([cv2.distanceTransform((lab0 != j).astype(np.uint8), cv2.DIST_L2, 3) for j in subs])
        near = np.argmin(d, axis=0)
        for k, j in enumerate(subs):
            groups.setdefault(cell(*cen0[j]), []).append(comp & (near == k))
    out = {}
    for c, parts in groups.items():
        mask = np.logical_or.reduce(parts)
        ys, xs = np.where(mask & (a > 0.02))
        if len(xs) == 0: continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        J = I[y0:y1, x0:x1].copy()
        J[..., 3] *= mask[y0:y1, x0:x1]
        out[c] = J
    return out


BOX = {}     # id → 정사각형 안 그림이 있는 곳 (0~1: x0, y0, x1, y1)


def to_square(J, size, align, id_=None):
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
    if id_: BOX[id_] = (x / size, y / size, (x + nw) / size, (y + nh) / size)
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


# 꾸미기 아이템을 친구에게 씌우는 자리 — 옛 200칸 그림 좌표(눈 (78,93)·(122,93), 머리 꼭대기 y42, 목 y146,
# 몸 타원 (100,158) 46x34, 앞발 (80,186)·(120,186), 장난감 (24,176)). 앱은 이 좌표를 새 그림의 머리·목·몸·발에 맞춰 옮긴다(petpaint.gen.ts items).
#   종류: (그림 너비 목표, 높이 상한, 기준점 x, 기준 y, 기준 쪽)
PLACE = {
    'hat': (92, 86, 100, 58, 'bottom'),        # 챙(아래)이 머리 꼭대기보다 조금 아래
    'glasses': (100, 56, 100, 93, 'center'),   # 두 눈 가운데
    'neck': (86, 70, 100, 132, 'top'),         # 목선(위)부터
    'clothes': (106, 62, 100, 126, 'top'),     # 목 아래부터 몸통(앞발은 보이게)
    'shoes': (118, 60, 100, 201, 'bottom'),    # 앞발 바닥 — 한 쌍 그림이라 두 짝이 두 앞발에 오도록 넓게
    'toy': (64, 56, 10, 201, 'bottom'),        # 몸 왼쪽 바닥(친구 앞에 그림)
}


# 물건마다 다르게(너비 목표, 높이 상한, 기준 y) — 깊이 쓰는 모자는 머리를 덮게 아래로, 얹는 것(왕관·리본)은 작게 위로
ITEM_FIT = {
    'hat:bow': (80, 70, 66), 'hat:crown': (74, 60, 64), 'hat:tiara': (78, 50, 66), 'hat:flower': (98, 50, 68), 'hat:bunny': (86, 94, 72),
    'hat:party': (62, 86, 62), 'hat:cap': (106, 70, 76), 'hat:beanie': (104, 86, 80), 'hat:frog': (106, 88, 80), 'hat:santa': (108, 86, 78),
    'hat:chef': (94, 86, 74), 'hat:fire': (108, 82, 78), 'hat:police': (104, 70, 76), 'hat:pirate': (114, 72, 76), 'hat:beret': (100, 62, 74),
    'hat:berry': (102, 86, 78), 'hat:wizard': (114, 104, 74), 'hat:straw': (128, 72, 74), 'hat:sunhat': (128, 72, 74), 'hat:astro': (106, 104, 82),
    # (너비, 높이 상한, 기준 y, 기준 x, 기준 쪽)
    'glasses:mask': (118, 64, 92, 108, 'center'),          # 깃털이 오른쪽에 있어 눈구멍이 눈에 오게 오른쪽으로
    'glasses:monocle': (40, 70, 80, 123, 'top'),           # 오른쪽 눈에 하나, 줄은 아래로
    'clothes:cape': (120, 72, 120, 100, 'top'),            # 어깨에 두른 망토(앞에)
    'clothes:raincoat': (110, 70, 120, 100, 'top'),        # 모자(후드)가 있어 조금 위에서
    'clothes:dog-extra-beekeeper': (110, 72, 119, 100, 'top'),     # 후드 달린 옷(사용자 요청 옷 추가)
    'clothes:dog-extra-dragon-tunic': (110, 72, 119, 100, 'top'),
}


def place_of(id_):
    slot = id_.split(':')[0]
    W, Hmax, ax, ay, side = PLACE[slot]
    if id_ in ITEM_FIT:
        f = ITEM_FIT[id_]; W, Hmax, ay = f[:3]
        if len(f) > 3: ax, side = f[3], f[4]
    x0, y0, x1, y1 = BOX[id_]
    cw, ch = x1 - x0, y1 - y0
    s = min(W / cw, Hmax / ch)                 # 정사각형 한 변(옛 좌표)
    x = ax - (x0 + x1) / 2 * s
    y = {'top': ay - y0 * s, 'bottom': ay - y1 * s, 'center': ay - (y0 + y1) / 2 * s}[side]
    return [round(x, 1), round(y, 1), round(s, 1)]


def write_items_gen():
    p = os.path.join(REPO, 'source/src/art/items.gen.ts')
    out = {i: {'b': [round(v, 3) for v in BOX[i]], 'p': place_of(i)} for i in sorted(BOX)}
    head = ('// 자동으로 만든 파일 — source/scripts/art_sheets.py items (손으로 고치지 않음)\n'
            '// 꾸미기 아이템 새 그림: b = 정사각형 그림 안에서 물건이 있는 곳(0~1), p = 친구에게 씌울 자리 [x, y, 한 변](옛 200칸 좌표)\n')
    open(p, 'w', encoding='utf-8').write(head + 'export const ITEM_ART: Record<string, { b: [number, number, number, number]; p: [number, number, number] }> = '
                                         + json.dumps(out, ensure_ascii=False) + ';\n')


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
            S = to_tight(J, size) if TIGHT else to_square(J, size, align_of(id_), id_ if MODE == 'items' else None)
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
    update_artmap(amap, {'snacks': 'snack.', 'items': 'item.', 'furniture': 'furn.', 'yard': 'furn.', 'park': 'furn.', 'words': 'word.'}[MODE])
    if MODE == 'items': write_items_gen()
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
