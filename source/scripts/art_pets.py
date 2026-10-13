# 친구(강아지·고양이) 새 그림 넣기 — GPT 원본(art-src/1-pets) → 앱 그림(art/pets) + 움직임 정보(src/art/petpaint.gen.ts)
#
# 하는 일 (COLLAB 9·10-A):
#  1) 정면 앉기 그림(full)을 640x640 기준판에 맞춰 놓는다(발바닥 선·가운데 맞춤).
#  2) 눈 감은 그림·입 벌린 그림을 정면 그림에 맞춰(특징점 정합) 바뀐 부분만 잘라 덮개로 만든다.
#  3) 눈·입·머리·목·발·꼬리 위치를 찾아, 그림을 휘게 하는 뼈대 가중치(25x25 격자)와 꾸미기 위치를 계산한다.
#  4) 연속 동작 시트(걷기·달리기·점프·엎드리기·앉기 …)에서 프레임을 떼어 크기·바닥선·가운데를 맞춘 한 줄 그림으로 만든다.
#  5) WebP(내용 해시 이름)로 저장하고 art-manifest.json·artmap.ts·petpaint.gen.ts를 고친다.
#
# 쓰는 법: python3 source/scripts/art_pets.py <art-src/1-pets 폴더> <저장소 맨 위> maltese,koshort,...
# 필요: numpy, pillow(webp), opencv(SIFT), scipy
import sys, os, re, json, glob, hashlib, base64, io, math
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi

SRC, REPO = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
QA = os.environ.get('PET_QA')            # 검사 그림을 남길 폴더(선택)
TEX = 640                                 # 정면 기준판 크기 (앱의 친구 상자 한 변 = 640)
GROUND = 624                              # 기준판의 발바닥 선
SPR = 0.6                                 # 연속 동작 그림: 기준판 1칸당 0.6px로 저장(용량)
GRID = 41                                 # 휘게 하는 격자 꼭짓점 수(한 변, 16px 간격)

EARS = {'maltese': 'floppy', 'poodle': 'floppy', 'shiba': 'floppy', 'corgi': 'up', 'schnauzer': 'up',
        'koshort': 'up', 'russian': 'up', 'siamese': 'up', 'fold': 'small', 'persian': 'up'}
CATS = {'koshort', 'russian', 'siamese', 'fold', 'persian'}
# 동작: 가로 칸, 세로 칸, 프레임 수, 초당 장수, 반복
MOTIONS = {
    'walk': (4, 2, 8, 10, True), 'run': (3, 2, 6, 12, True), 'jump': (3, 2, 6, 12, False),
    'liesleep': (2, 2, 4, 5, False), 'sitstand': (2, 2, 4, 7, False),
    'idle': (2, 2, 4, 5, True), 'eat': (2, 2, 4, 6, True), 'scratch': (3, 2, 6, 10, True),
    'stretch': (2, 2, 4, 5, False), 'roll': (3, 2, 6, 8, False), 'groom': (2, 2, 4, 5, True),
}

def log(*a): print(*a, flush=True)

def latest(pid, kind):
    c = [f for f in glob.glob(os.path.join(SRC, f'{pid}-{kind}*.png')) if re.search(rf'{re.escape(pid)}-{kind}(-v\d+)?\.png$', f)]
    if not c: return None
    return max(c, key=lambda f: int(re.search(r'-v(\d+)\.png$', f).group(1)) if re.search(r'-v\d+\.png$', f) else 1)

def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255.

def to8(I):
    g = I[..., :3].mean(axis=2) * I[..., 3] + (1 - I[..., 3])
    return np.clip(g * 255, 0, 255).astype(np.uint8)

SIFT = cv2.SIFT_create(4000)
def register(F, G, ratio=0.75, thr=2.0):
    """G(편집본)를 F(정면)에 맞추는 닮음 변환. 실패하면 None"""
    k1, d1 = SIFT.detectAndCompute(to8(F), None)
    k2, d2 = SIFT.detectAndCompute(to8(G), (G[..., 3] > 0.5).astype(np.uint8) * 255)
    if d1 is None or d2 is None: return None
    m = cv2.BFMatcher().knnMatch(d2, d1, k=2)
    good = [x[0] for x in m if len(x) == 2 and x[0].distance < ratio * x[1].distance]
    if len(good) < 8: return None
    src = np.float32([k2[x.queryIdx].pt for x in good]); dst = np.float32([k1[x.trainIdx].pt for x in good])
    M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=thr, maxIters=5000)
    if M is None or inl.sum() < 8: return None
    return M

def warp(G, M, shape):
    return cv2.warpAffine(G, M, (shape[1], shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))

def changed(F, G, t=0.18):
    both = (F[..., 3] > 0.5) & (G[..., 3] > 0.5)
    d = np.abs(F[..., :3] - G[..., :3]).max(axis=2) * both
    return (d > t)

def comps(mask, min_area=150):
    n, lab, st, cen = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    return [dict(i=i, area=int(st[i, 4]), box=tuple(int(v) for v in st[i, :4]), c=(float(cen[i][0]), float(cen[i][1])), lab=lab) for i in range(1, n) if st[i, 4] >= min_area]

def aligned(F, path):
    """편집본을 불러와 정면에 맞춘다(거의 같으면 그대로)"""
    if not path: return None
    G = load(path)
    if G.shape != F.shape:
        G = np.asarray(Image.fromarray((G * 255).astype(np.uint8)).resize((F.shape[1], F.shape[0]), Image.LANCZOS)).astype(np.float32) / 255.
    M = register(F, G)
    if M is not None:
        H = warp(G, M, F.shape)
        if changed(F, H).sum() < changed(F, G).sum(): return H
    return G

def pick_eyes(cs, bbox, F):
    """바뀐 덩어리 중 좌우로 나란하고, 정면 그림에서 어두운(눈동자) 두 개 = 두 눈"""
    W = bbox[2] - bbox[0]; best = None
    lum = F[..., :3].mean(axis=2)
    big = []
    for c in cs:
        if c['area'] <= 1200: continue
        c['dark'] = float((lum[c['lab'] == c['i']] < 0.3).mean())
        if c['dark'] >= 0.25: big.append(c)       # 귀 안쪽처럼 밝은 곳이 바뀐 것은 눈이 아님
    for a in range(len(big)):
        for b in range(a + 1, len(big)):
            A, B = big[a], big[b]
            if A['c'][0] > B['c'][0]: A, B = B, A
            dx = B['c'][0] - A['c'][0]; dy = abs(B['c'][1] - A['c'][1])
            if not (0.12 * W < dx < 0.55 * W) or dy > 0.35 * dx: continue
            score = abs(A['area'] - B['area']) / max(A['area'], B['area']) + dy / dx + (2 - A['dark'] - B['dark'])
            if best is None or score < best[0]: best = (score, A, B)
    return best and (best[1], best[2])

def pick_mouth(cs, eyes):
    (A, B) = eyes; mx = (A['c'][0] + B['c'][0]) / 2; my = (A['c'][1] + B['c'][1]) / 2; ed = B['c'][0] - A['c'][0]
    cand = [c for c in cs if abs(c['c'][0] - mx) < 0.6 * ed and 0.4 * ed < c['c'][1] - my < 2.2 * ed and c['area'] > 400]
    return max(cand, key=lambda c: c['area']) if cand else None

def feather(mask, grow, blur):
    m = cv2.dilate(mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (grow * 2 + 1, grow * 2 + 1)))
    return cv2.GaussianBlur(m.astype(np.float32), (0, 0), blur)

def run_at(alpha, y, x):
    """y줄에서 x를 포함하는 불투명 구간 [x0,x1]"""
    row = alpha[int(round(y))] > 0.5
    if not row[int(x)]:
        xs = np.where(row)[0]
        if len(xs) == 0: return (x, x)
        x = xs[np.argmin(np.abs(xs - x))]
    x0 = int(x); x1 = int(x)
    while x0 > 0 and row[x0 - 1]: x0 -= 1
    while x1 < len(row) - 1 and row[x1 + 1]: x1 += 1
    return (x0, x1)

def save_webp(arr, q=82):
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
    # 완전 투명한 곳의 색은 지워 용량·가장자리 번짐을 줄인다
    a = np.asarray(im)[..., 3]
    rgb = np.asarray(im)[..., :3].copy(); rgb[a == 0] = 0
    im = Image.fromarray(np.dstack([rgb, a]).astype(np.uint8), 'RGBA')
    b = io.BytesIO(); im.save(b, 'WEBP', quality=q, method=6, alpha_quality=90, exact=False)
    return b.getvalue()

def put(name, data):
    h = hashlib.sha256(data).hexdigest()[:8]
    rel = f'art/pets/{name}.{h}.webp'
    os.makedirs(os.path.join(REPO, 'art/pets'), exist_ok=True)
    with open(os.path.join(REPO, rel), 'wb') as f: f.write(data)
    return rel

def clean_edges(I):
    """단색 배경 지운 흔적: 반투명 가장자리의 초록·분홍 기운 빼기, 아주 옅은 알파는 0"""
    I = I.copy(); a = I[..., 3]
    I[a < 0.04] = 0
    edge = (a > 0) & (a < 0.98)
    rgb = I[..., :3]
    g_spill = edge & (rgb[..., 1] > rgb[..., 0] + 0.08) & (rgb[..., 1] > rgb[..., 2] + 0.08)
    m_spill = edge & (rgb[..., 0] > rgb[..., 1] + 0.25) & (rgb[..., 2] > rgb[..., 1] + 0.25)
    rgb[g_spill, 1] = np.maximum(rgb[g_spill, 0], rgb[g_spill, 2])
    rgb[m_spill, 0] = rgb[m_spill, 1] + 0.1; rgb[m_spill, 2] = rgb[m_spill, 1] + 0.1
    return I

# ---------------------------------------------------------------------------------------------
def tail_by_symmetry(F, cx, ey, ed):
    a = F[..., 3] > 0.5
    H, W = a.shape
    ys, xs = np.where(a); y1 = ys.max()
    ylo = int(ey + 1.2 * ed)
    best = None
    for d in range(-int(0.1 * ed), int(0.1 * ed) + 1, 2):
        ax = cx + d
        xm = np.clip(np.round(2 * ax - np.arange(W)).astype(int), 0, W - 1)
        M = a[:, xm]
        inter = (a[ylo:y1 + 1] & M[ylo:y1 + 1]).sum(); uni = (a[ylo:y1 + 1] | M[ylo:y1 + 1]).sum()
        if best is None or inter / uni > best[0]: best = (inter / uni, ax, M)
    _, ax, M = best
    diff = a & ~M; diff[:ylo] = False
    diff = cv2.morphologyEx(diff.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    cc = sorted(comps(diff, min_area=int(0.003 * a.sum())), key=lambda c: -c['area'])
    if not cc: return None, None
    m = cc[0]['lab'] == cc[0]['i']
    # 뿌리 = 몸(접은 모양)에 닿는 쪽
    touch = m & cv2.dilate(M.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    ty, tx = np.where(touch if touch.sum() > 20 else m)
    root = (float(tx.mean()), float(ty.mean()))
    return m, root

def front(pid):
    F = clean_edges(load(latest(pid, 'full')))
    a = F[..., 3]
    ys, xs = np.where(a > 0.5); bbox = (xs.min(), ys.min(), xs.max(), ys.max())
    E = aligned(F, latest(pid, 'eyes-closed'))
    Mo = aligned(F, latest(pid, 'mouth-open'))
    eyes = None; mouth = None
    if E is not None:
        eyes = pick_eyes(comps(changed(F, E)), bbox, F)
    if eyes is None: raise SystemExit(f'{pid}: 눈을 못 찾음')
    eA, eB = eyes
    # 눈 위치 = 눈동자(정면 그림에서 가장 어두운 곳)의 가운데
    lum = F[..., :3].mean(axis=2)
    for e in (eA, eB):
        m = (e['lab'] == e['i']) & (lum < 0.22) & (F[..., 3] > 0.5)
        if m.sum() > 60:
            yy_, xx_ = np.where(m); e['c'] = (float(xx_.mean()), float(yy_.mean()))
    ed = eB['c'][0] - eA['c'][0]
    if Mo is not None:
        mouth = pick_mouth(comps(changed(F, Mo)), eyes)
    # 기준판에 놓기: 눈 가운데를 가로 가운데, 발바닥을 GROUND에, 키가 기준판의 0.80
    H = bbox[3] - bbox[1]
    s = min(0.80 * TEX / H, 0.92 * TEX / (bbox[2] - bbox[0]))
    cx = (eA['c'][0] + eB['c'][0]) / 2
    left = (bbox[0] - cx) * s + TEX / 2; right = (bbox[2] - cx) * s + TEX / 2
    shift = 0
    if left < 8: shift = 8 - left
    if right > TEX - 8: shift = (TEX - 8) - right
    T = np.float32([[s, 0, TEX / 2 - cx * s + shift], [0, s, GROUND - bbox[3] * s]])
    tex = lambda I: cv2.warpAffine(I, T, (TEX, TEX), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0))
    P = lambda x, y: (float(T[0, 0] * x + T[0, 2]), float(T[1, 1] * y + T[1, 2]))
    Ft = tex(F); at = Ft[..., 3]
    out = {'tex': Ft, 'scale': s}
    # 눈·입 덮개: 바뀐 곳 + 둘레를 부드럽게
    lab = eA['lab']
    eye_mask = np.isin(lab, [eA['i'], eB['i']])
    em = feather(eye_mask, 10, 5); em = np.clip(em * 1.6, 0, 1)
    Eo = E.copy(); Eo[..., 3] = Eo[..., 3] * em
    out['eyes'] = tex(Eo)
    if mouth is not None:
        mm = feather(mouth['lab'] == mouth['i'], 12, 5); mm = np.clip(mm * 1.6, 0, 1)
        Mm = Mo.copy(); Mm[..., 3] = Mm[..., 3] * mm
        out['mouthImg'] = tex(Mm)
    # 위치들(기준판 좌표)
    eL = P(*eA['c']); eR = P(*eB['c']); ed_t = eR[0] - eL[0]
    em_ = ((eL[0] + eR[0]) / 2, (eL[1] + eR[1]) / 2)
    if mouth is not None:
        mx, my = P(*mouth['c']); mb = P(0, mouth['box'][1] + mouth['box'][3])[1]
    else:
        mx, my = em_[0], em_[1] + 0.95 * ed_t; mb = my + 0.25 * ed_t
    # 머리 꼭대기(귀 빼고): 눈 가운데 줄에서 위로 처음 불투명
    col = at[:, int(em_[0])] > 0.5
    top = int(np.argmax(col)) if col.any() else int(em_[1] - 1.3 * ed_t)
    ground = float(np.where(at.sum(axis=1) > 0.5)[0].max())
    neck_y = mb + 0.32 * ed_t
    n0, n1 = run_at(at, neck_y, em_[0])
    chest_y = (neck_y + ground) / 2
    c0, c1 = run_at(at, chest_y, em_[0])
    # 앞발: 발바닥 조금 위 줄에서 눈 아래쪽 두 구간
    py = ground - 0.035 * (ground - top)
    paws = []
    for ex in (eL[0], eR[0]):
        p0, p1 = run_at(at, py, ex); paws.append(((p0 + p1) / 2, py, p1 - p0))
    head_c = (em_[0], em_[1] + 0.12 * ed_t)
    head_rx = max(1.05 * ed_t, (n1 - n0) * 0.62)
    head_ry = max(em_[1] - top + 0.15 * ed_t, 1.0 * ed_t)
    out.update(eL=eL, eR=eR, mouth=(mx, my), mouthB=mb, top=top, ground=ground, neck=(em_[0], neck_y), neckW=n1 - n0,
               chest=((c0 + c1) / 2, chest_y), chestW=c1 - c0, paws=paws, head=(head_c, head_rx, head_ry), bboxT=[P(bbox[0], bbox[1]), P(bbox[2], bbox[3])])
    # 꼬리: 몸은 좌우가 거의 같으므로, 눈 가운데 줄로 접었을 때 한쪽에만 튀어나온 덩어리(목 아래) = 꼬리
    tm, troot = tail_by_symmetry(F, (eA['c'][0] + eB['c'][0]) / 2, (eA['c'][1] + eB['c'][1]) / 2, ed)
    out['tailmask'] = None if tm is None else tex(np.dstack([tm.astype(np.float32)] * 4))[..., 3] > 0.5
    out['tailroot'] = None if troot is None else P(*troot)
    # 정면 그림의 무게 중심(가로) — 연속 동작 프레임을 같은 자리에 놓으려고
    ys_, xs_ = np.where(at > 0.5); out['cx'] = float(xs_.mean())
    # 귀 영역(정면 위): 귀 모양에 따라
    yy, xx = np.mgrid[0:TEX, 0:TEX].astype(np.float32)
    (hcx, hcy), rx, ry = out['head']
    kind = EARS.get(pid, 'up')
    ears = []
    for side in (-1, 1):
        if kind == 'floppy':
            m = (at > 0.5) & (side * (xx - hcx) > 0.55 * ed_t * 1.15) & (yy > em_[1] - 0.75 * ed_t) & (yy < em_[1] + 1.35 * ed_t) & (side * (xx - hcx) < 1.9 * ed_t)
            root = (hcx + side * 0.95 * ed_t, em_[1] - 0.55 * ed_t)
        else:
            lim = em_[1] - (0.72 if kind == 'up' else 0.62) * ed_t
            m = (at > 0.5) & (yy < lim) & (side * (xx - hcx) > 0.12 * ed_t) & (side * (xx - hcx) < 1.8 * ed_t)
            # 귀 뿌리 = 귀 영역 아래쪽 가운데
            ys_, xs_ = np.where(m)
            root = (float(xs_.mean()) if len(xs_) else hcx + side * 0.8 * ed_t, lim)
        ears.append((m, root))
    out['ears'] = ears
    out['eyeDist'] = ed_t
    return out

def weights(fr, pid):
    """격자 꼭짓점마다 머리·왼귀·오른귀·꼬리·꼬리끝 가중치(0~255)"""
    g = np.linspace(0, TEX, GRID).astype(np.float32)
    X, Y = np.meshgrid(g, g)
    (hcx, hcy), rx, ry = fr['head']
    d = np.sqrt(((X - hcx) / rx) ** 2 + ((Y - hcy) / ry) ** 2)
    h = 1 - np.clip((d - 0.9) / 0.35, 0, 1)
    ny = fr['neck'][1]
    h = h * (1 - np.clip((Y - (ny - 0.15 * ry)) / (0.45 * ry), 0, 1))
    def samp(mask, blur=10):
        f = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), blur)
        return cv2.remap(f, X, Y, cv2.INTER_LINEAR)
    # 귀: 귀 전체가 1(통째로 돌고), 바뀌는 띠는 귀 바깥(투명한 곳)과 귀 뿌리로 — 귀 테두리가 톱니처럼 꺾이지 않게
    grow = lambda m, r: cv2.dilate(m.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
    eL = np.clip(samp(grow(fr['ears'][0][0], 10), 14) * 1.5, 0, 1); eR = np.clip(samp(grow(fr['ears'][1][0], 10), 14) * 1.5, 0, 1)
    h = np.maximum(h, np.maximum(eL, eR))
    t = np.zeros_like(h); t2 = np.zeros_like(h); root = None; mid = None; tip = None
    if fr['tailmask'] is not None:
        tm = fr['tailmask']
        ys, xs = np.where(tm)
        root = fr['tailroot']
        dist = np.hypot(xs - root[0], ys - root[1])
        far = dist > np.percentile(dist, 94)
        tip = (float(xs[far].mean()), float(ys[far].mean()))
        L = math.hypot(tip[0] - root[0], tip[1] - root[1]) + 1e-3
        mid = (root[0] + 0.5 * (tip[0] - root[0]), root[1] + 0.5 * (tip[1] - root[1]))
        along = np.clip(((X - root[0]) * (tip[0] - root[0]) + (Y - root[1]) * (tip[1] - root[1])) / (L * L), 0, 1)
        tw = np.clip(samp(grow(tm, 12), 14) * 1.5, 0, 1)
        t = tw * np.clip(along * 1.6 + 0.15, 0, 1)
        t2 = t * np.clip((along - 0.45) / 0.3, 0, 1)
        h = h * (1 - t)
    q = lambda a: np.clip(np.round(a * 255), 0, 255).astype(np.uint8)
    W = np.stack([q(h), q(np.minimum(eL, h)), q(np.minimum(eR, h)), q(t), q(t2)], axis=-1)   # GRID x GRID x 5
    return W, root, mid, tip

def item_affines(fr):
    """옛 200칸 그림 좌표 → 기준판 좌표(행렬 a b c d e f: x'=a x + c y + e, y'=b x + d y + f)"""
    (x1, y1), (x2, y2) = fr['eL'], fr['eR']
    # 머리: 옛 눈 (78,93)·(122,93) → 새 눈
    s = math.hypot(x2 - x1, y2 - y1) / 44.0; ang = math.atan2(y2 - y1, x2 - x1)
    ca, sa = s * math.cos(ang), s * math.sin(ang)
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    head = [ca, sa, -sa, ca, mx - (ca * 100 - sa * 93), my - (sa * 100 + ca * 93)]
    # 모자: 옛 머리 꼭대기(약 y42)가 새 머리 꼭대기에 오도록 (옛 단위로 위·아래 보정)
    hat_dy = (fr['top'] - (head[1] * 100 + head[3] * 42 + head[5])) / s
    # 목: 옛 목선 (100,146) 너비 80 → 새 목
    sn = min(max(fr['neckW'] * 0.92, 1) / 80.0, 2.0 * fr['eyeDist'] / 80.0)   # 볼 털까지 넓게 재지 않게
    neck = [sn, 0, 0, sn, fr['neck'][0] - 100 * sn, fr['neck'][1] + 0.04 * fr['eyeDist'] - 146 * sn]
    # 옷: 옛 몸 타원 (100,158) rx46 ry34 → 새 몸통
    # (앞발을 덮지 않게: 목 아래 ~ 배까지)
    rx = fr['chestW'] * 0.5 * 0.8; ry = (fr['ground'] - fr['neck'][1]) * 0.36
    sx, sy = rx / 46.0, ry / 34.0
    cy = fr['neck'][1] + (fr['ground'] - fr['neck'][1]) * 0.42
    clothes = [sx, 0, 0, sy, fr['chest'][0] - 100 * sx, cy - 158 * sy]
    # 신발: 옛 발 (80,186)·(120,186) → 새 앞발
    # 앞발은 대개 두 눈 아래(조금 안쪽). 옛 신발 두 짝 간격 40 → 새 앞발 간격
    ss = 0.95 * fr['eyeDist'] / 40.0
    pcx = (fr['eL'][0] + fr['eR'][0]) / 2
    shoes = [ss, 0, 0, ss, pcx - 100 * ss, fr['ground'] - 0.01 * TEX - 188 * ss]
    # 장난감: 옛 (24,176) → 몸 왼쪽 바닥
    st = sn
    toy = [st, 0, 0, st, fr['bboxT'][0][0] - 6 - 24 * st + 30 * st, fr['ground'] - 6 - 176 * st]
    r = lambda v: [round(float(x), 4) for x in v]
    return dict(head=r(head), hatDy=round(float(hat_dy), 1), neck=r(neck), clothes=r(clothes), shoes=r(shoes), toy=r(toy))

# ---------------------------------------------------------------------------------------------
def split_frames(S, cols, rows, n):
    """시트에서 프레임 떼기: 알파 덩어리로 찾고, 개수가 안 맞으면 칸으로 자른다"""
    a = S[..., 3] > 0.08
    big = cv2.dilate(a.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
    cs = comps(big, min_area=int(0.004 * a.size))
    frames = []
    if len(cs) == n:
        for c in cs:
            m = (c['lab'] == c['i']) & a
            x, y, w, h = c['box']
            I = S.copy(); I[..., 3] *= m
            frames.append((I[y:y + h, x:x + w], (x + w / 2, y + h / 2)))
    else:
        H, W = a.shape; cw, ch = W / cols, H / rows
        for r in range(rows):
            for c in range(cols):
                x0, y0 = int(c * cw), int(r * ch)
                I = S[y0:int(y0 + ch), x0:int(x0 + cw)].copy()
                ys, xs = np.where(I[..., 3] > 0.08)
                if len(xs) == 0: continue
                I = I[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
                frames.append((I, (x0 + (xs.min() + xs.max()) / 2, y0 + (ys.min() + ys.max()) / 2)))
    # 읽는 순서: 줄(위→아래) 다음 칸(왼→오른)
    if frames:
        Hs = S.shape[0] / rows
        frames.sort(key=lambda f: (int(f[1][1] // Hs), f[1][0]))
    return [f[0] for f in frames][:n], len(cs)

def motion_strip(pid, key, fit):
    """연속 동작 시트 → 한 줄 그림. fit: ('last'|'first'|'median', 기준판 키) 또는 ('area', 기준판 넓이)"""
    path = latest(pid, key)
    if not path: return None
    cols, rows, n, fps, loop = MOTIONS.get(key, (1, 1, 1, 1, False))
    S = clean_edges(load(path))
    frames, found = split_frames(S, cols, rows, n)
    if len(frames) != n: log(f'  {pid}-{key}: 프레임 {len(frames)}/{n} (덩어리 {found})')
    if not frames: return None
    hs = [f.shape[0] for f in frames]; areas = [float((f[..., 3] > 0.5).sum()) for f in frames]
    kind, val = fit
    if kind == 'last': s = val / hs[-1]
    elif kind == 'first': s = val / hs[0]
    elif kind == 'median': s = val / float(np.median(hs))
    else: s = math.sqrt(val / max(float(np.median(areas)), 1))
    k = s * SPR
    imgs = []
    for f in frames:
        h, w = f.shape[:2]
        I = cv2.resize(f, (max(1, int(round(w * k))), max(1, int(round(h * k)))), interpolation=cv2.INTER_AREA)
        al = I[..., 3]
        ys, xs = np.where(al > 0.5)
        if len(xs) == 0: continue
        bottom = ys.max()
        cx = float((xs * al[ys, xs]).sum() / al[ys, xs].sum())
        imgs.append((I, bottom, cx))
    padL = max(cx for I, b, cx in imgs); padR = max(I.shape[1] - cx for I, b, cx in imgs)
    half = int(math.ceil(max(padL, padR))) + 4
    top = max(b for I, b, cx in imgs) + 4
    cw, ch = 2 * half, int(top + 6)
    strip = np.zeros((ch, cw * len(imgs), 4), np.float32)
    for i, (I, b, cx) in enumerate(imgs):
        ox = int(round(i * cw + half - cx)); oy = int(round(top - b))
        h, w = I.shape[:2]
        y0, x0 = max(0, oy), max(0, ox)
        sub = I[y0 - oy:min(h, ch - oy), x0 - ox:min(w, cw * len(imgs) - ox)]
        dst = strip[y0:y0 + sub.shape[0], x0:x0 + sub.shape[1]]
        dst[...] = np.where(sub[..., 3:4] > dst[..., 3:4], sub, dst)
    meta = dict(n=len(imgs), w=cw, h=ch, ground=int(top), fps=fps, loop=loop)
    return strip, meta, dict(s=s, hs=[h_ * s for h_ in hs], area=float(np.median(areas)) * s * s)

# ---------------------------------------------------------------------------------------------
def main():
    pets = ONLY or sorted({re.match(r'(.+?)-full', os.path.basename(f)).group(1) for f in glob.glob(os.path.join(SRC, '*-full*.png'))})
    man_p = os.path.join(REPO, 'art/art-manifest.json')
    man = json.load(open(man_p, encoding='utf-8')) if os.path.exists(man_p) else {'files': []}
    files = {f['u']: f['b'] for f in man['files']}
    amap = {}
    rigs = {}
    for pid in pets:
        need = ['full', 'eyes-closed', 'walk']
        if any(latest(pid, k) is None for k in need):
            log(f'{pid}: 정면·눈·걷기 그림이 다 오지 않아 건너뜀'); continue
        log(f'== {pid}')
        fr = front(pid)
        W, troot, tmid, ttip = weights(fr, pid)
        rig = dict(tex=TEX, ground=GROUND, sp=SPR, eyeDist=round(fr['eyeDist'], 1),
                   eyeL=[round(v, 1) for v in fr['eL']], eyeR=[round(v, 1) for v in fr['eR']],
                   mouth=[round(v, 1) for v in fr['mouth']], neck=[round(v, 1) for v in fr['neck']],
                   earL=[round(v, 1) for v in fr['ears'][0][1]], earR=[round(v, 1) for v in fr['ears'][1][1]],
                   tail=[round(v, 1) for v in troot] if troot else None, tailMid=[round(v, 1) for v in tmid] if tmid else None,
                   tailTip=[round(v, 1) for v in ttip] if ttip else None,
                   top=fr['top'], cat=pid in CATS, ears=EARS.get(pid, 'up'),
                   grid=GRID, w=rle64(W.tobytes()), items=item_affines(fr), motions={})
        put_art = lambda key, arr, q=82: amap.__setitem__(f'pet.{pid}.paint-{key}', put(f'{pid}.paint-{key}', save_webp(arr, q)))
        put_art('front', fr['tex'], 84)
        put_art('eyes', crop_overlay(fr['eyes'], rig, 'eyesBox'))
        if 'mouthImg' in fr: put_art('mouth', crop_overlay(fr['mouthImg'], rig, 'mouthBox'))
        sit_h = fr['ground'] - fr['bboxT'][0][1]      # 정면 앉은 키(기준판)
        strips = {}
        # 앉기·일어서기: 마지막 칸(정면 앉기)이 정면 그림과 같은 키 → 첫 칸(옆으로 선 모습)의 키를 걷기 기준으로
        ss = motion_strip(pid, 'sitstand', ('last', sit_h))
        stand_h = ss[2]['hs'][0] if ss else 0.89 * sit_h
        if ss: strips['sitstand'] = ss[:2]
        wk = motion_strip(pid, 'walk', ('median', stand_h))
        if wk:
            strips['walk'] = wk[:2]
            for key in ('run', 'jump', 'scratch', 'stretch', 'roll', 'groom', 'eat', 'idle'):
                r = motion_strip(pid, key, ('area', wk[2]['area']))
                if r: strips[key] = r[:2]
        ls = motion_strip(pid, 'liesleep', ('first', sit_h))   # 첫 칸 = 정면 앉기
        if ls: strips['liesleep'] = ls[:2]
        if latest(pid, 'lying') and ls:                      # 보리: 턱을 앞발에 괴고 엎드린 모습(원문) — 엎드린 칸과 같은 키
            MOTIONS.setdefault('lying', (1, 1, 1, 1, False))
            r = motion_strip(pid, 'lying', ('first', ls[2]['hs'][2]))
            if r: strips['lying'] = r[:2]
        rig['cx'] = round(fr['cx'], 1)
        for key, (strip, meta) in strips.items():
            put_art(key, strip, 80)
            rig['motions'][key] = meta
        rigs[pid] = rig
        if QA: qa_front(pid, fr, W, rig)
        log(f'   눈 {rig["eyeL"]} {rig["eyeR"]} 입 {rig["mouth"]} 목 {rig["neck"]} 꼬리 {rig["tail"]} 동작 {list(rig["motions"])}')
    # manifest·artmap·rig 쓰기
    for k, rel in amap.items():
        files[rel] = os.path.getsize(os.path.join(REPO, rel))
    # 같은 친구의 예전 paint 그림(이번에 안 쓰는 것)은 manifest에서 빼고 파일도 지운다
    keep = set(amap.values())
    for rel in list(files):
        m = re.match(r'art/pets/([a-z]+)\.paint-', rel)
        if m and m.group(1) in rigs and rel not in keep:
            del files[rel]
            try: os.remove(os.path.join(REPO, rel))
            except FileNotFoundError: pass
    man['files'] = [{'u': u, 'b': b} for u, b in sorted(files.items())]
    json.dump(man, open(man_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    update_artmap(amap, set(rigs))
    write_rigs(rigs)
    log('끝:', len(rigs), '마리', sum(files[u] for u in keep) // 1024, 'KB')

def rle64(b):
    """0이 많은 가중치를 짧게: 0은 [0, 개수], 나머지는 그대로 → base64 (앱의 petpaint.ts가 풂)"""
    out = bytearray(); i = 0
    while i < len(b):
        if b[i] == 0:
            n = 1
            while i + n < len(b) and b[i + n] == 0 and n < 255: n += 1
            out += bytes([0, n]); i += n
        else:
            out.append(b[i]); i += 1
    return base64.b64encode(bytes(out)).decode()

def crop_overlay(I, rig, name):
    a = I[..., 3]
    ys, xs = np.where(a > 0.02)
    x0, y0, x1, y1 = max(0, xs.min() - 2), max(0, ys.min() - 2), min(TEX, xs.max() + 3), min(TEX, ys.max() + 3)
    rig[name] = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
    return I[y0:y1, x0:x1]

def update_artmap(amap, pets):
    p = os.path.join(REPO, 'source/src/art/artmap.ts')
    s = open(p, encoding='utf-8').read()
    m = re.search(r'export const ART_MAP: Record<string, string> = \{(.*?)\n\};', s, re.S)
    cur = dict(re.findall(r'"([^"]+)": "([^"]+)"', m.group(1)))
    cur = {k: v for k, v in cur.items() if not any(k.startswith(f'pet.{pid}.paint-') for pid in pets)}
    cur.update(amap)
    body = ',\n'.join(f'  "{k}": "{v}"' for k, v in sorted(cur.items(), key=lambda kv: (kv[0].split('.')[1], kv[0])))
    s = s[:m.start()] + 'export const ART_MAP: Record<string, string> = {\n' + body + '\n};' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)

def write_rigs(rigs):
    p = os.path.join(REPO, 'source/src/art/petpaint.gen.ts')
    old = {}
    if os.path.exists(p):
        m = re.search(r'PAINT_RIG: Record<string, PaintRig> = (\{.*\});', open(p, encoding='utf-8').read(), re.S)
        if m: old = json.loads(m.group(1))
    old.update(rigs)
    head = ('// 자동으로 만든 파일 — source/scripts/art_pets.py (손으로 고치지 않음)\n'
            '// 친구 새 그림의 뼈대·눈·입·꾸미기 위치·연속 동작 정보. 좌표는 640x640 기준판.\n'
            "import type { PaintRig } from './petpaint';\n")
    open(p, 'w', encoding='utf-8').write(head + 'export const PAINT_RIG: Record<string, PaintRig> = ' + json.dumps(old, ensure_ascii=False) + ';\n')

def qa_front(pid, fr, W, rig):
    os.makedirs(QA, exist_ok=True)
    I = (fr['tex'][..., :3] * 255).astype(np.uint8).copy(); a = fr['tex'][..., 3]
    I[a < 0.5] = 255
    vis = I.copy()
    g = np.linspace(0, TEX, GRID)
    for j, y in enumerate(g):
        for i, x in enumerate(g):
            h, eL, eR, t, t2 = W[j, i] / 255.
            col = (int(255 * t), int(255 * (eL + eR)), int(255 * h))
            cv2.circle(vis, (int(x), int(y)), 4, col[::-1], -1)
    for key in ('eyeL', 'eyeR', 'mouth', 'neck', 'earL', 'earR', 'tail', 'tailTip'):
        if rig.get(key): cv2.circle(vis, (int(rig[key][0]), int(rig[key][1])), 7, (255, 0, 255), 2)
    cv2.line(vis, (0, GROUND), (TEX, GROUND), (0, 160, 255), 1)
    cv2.imwrite(os.path.join(QA, f'{pid}_rig.png'), cv2.cvtColor(np.hstack([I, vis]), cv2.COLOR_RGB2BGR))

if __name__ == '__main__':
    main()
