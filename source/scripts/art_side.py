# 옆모습 꾸미기 기준점 (COLLAB 10-A) — 친구의 연속 동작 프레임마다 머리(모자·안경·목걸이)와 몸통(옷) 위치를 찾는다.
#
#  1) 친구마다 기준 프레임(서서 쉬기 idle 0번 칸)에 손으로 찍어 둔 머리 원·눈·코·목·머리 둘레·옷 상자(아래 ANN·CB).
#  2) 머리: 기준 프레임의 머리(둘레 안)를 SIFT 특징점으로 각 프레임에서 찾아 닮음 변환(크기·회전·이동)을 구한다.
#     맞는지 검사(머리 그림 상관·실루엣 겹침) — 안 맞으면 같은 동작의 다른 칸 변환 중 가장 잘 맞는 것으로 채운다.
#  3) 몸통: 기준 프레임 옷 상자 안의 실루엣(머리 뺌)을 각 프레임 실루엣에 맞춰 이동(+달리기·점프는 조금 회전).
#  4) 동작마다 모든 칸이 맞아야 그 동작에 옆모습 꾸미기를 붙인다(한 칸이라도 못 찾으면 그 동작은 지금처럼 숨김 — 깜빡임 방지).
#  5) source/src/art/petside.gen.ts로 쓴다. 아이템을 붙이는 규칙(크기·위치)은 art/petside.ts(앱)와 아래 place_*(검사 그림)가 같다.
#
# 쓰는 법: python3 source/scripts/art_side.py <저장소 맨 위> [maltese,koshort,...]   (PET_QA=<폴더> 이면 검사 그림)
# 필요: numpy, pillow, opencv(SIFT)
import sys, os, re, json, math
import numpy as np, cv2
from PIL import Image, ImageDraw

REPO = sys.argv[1]
ONLY = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else None
QA = os.environ.get('PET_QA')

# 기준 프레임(idle 0) 좌표(px). Hc·Hr: 모자가 얹히는 머리 윗부분 원 · E: 가까운 눈 · F: 먼 눈(옆얼굴이라 안 보이면 None)
# N: 코끝 · K1→K2: 목(목 뒤 → 목 앞) · P: 머리 둘레(귀 포함 — 옷이 머리·귀를 덮지 않게)
ANN = {
    'maltese': dict(Hc=(295, 85), Hr=70, E=(299, 120), F=(347, 106), N=(352, 131), K1=(226, 182), K2=(305, 192),
                    P=[(150, 120), (175, 60), (230, 20), (290, 8), (345, 25), (378, 90), (375, 140), (350, 168), (305, 185), (250, 200), (200, 205), (160, 190)]),
    'koshort': dict(Hc=(296, 78), Hr=42, E=(310, 84), F=None, N=(342, 102), K1=(238, 117), K2=(302, 130),
                    P=[(218, 95), (240, 50), (270, 18), (283, 12), (300, 30), (325, 12), (333, 20), (345, 60), (350, 105), (330, 122), (300, 128), (260, 125), (230, 115)]),
    'poodle': dict(Hc=(250, 80), Hr=70, E=(270, 100), F=(308, 91), N=(320, 117), K1=(179, 150), K2=(254, 160),
                   P=[(139, 110), (160, 50), (200, 15), (260, 8), (310, 25), (330, 70), (329, 120), (310, 150), (270, 160), (230, 165), (180, 165), (145, 150)]),
    'corgi': dict(Hc=(255, 95), Hr=40, E=(277, 107), F=None, N=(330, 120), K1=(180, 150), K2=(280, 160),
                  P=[(178, 140), (180, 90), (190, 30), (198, 17), (225, 45), (250, 25), (260, 12), (272, 50), (300, 85), (336, 115), (325, 135), (295, 150), (260, 162), (215, 165), (185, 158)]),
    'shiba': dict(Hc=(255, 85), Hr=72, E=(292, 102), F=None, N=(344, 122), K1=(152, 165), K2=(297, 165),
                  P=[(142, 150), (150, 80), (190, 30), (247, 10), (310, 30), (345, 80), (354, 125), (335, 150), (300, 165), (240, 177), (190, 177), (155, 168)]),
    'schnauzer': dict(Hc=(260, 85), Hr=48, E=(263, 119), F=(300, 112), N=(310, 136), K1=(180, 150), K2=(280, 170),
                      P=[(162, 120), (175, 70), (205, 20), (228, 10), (245, 40), (290, 22), (300, 45), (312, 110), (318, 140), (300, 160), (270, 170), (220, 175), (180, 160)]),
    'russian': dict(Hc=(262, 70), Hr=45, E=(267, 82), F=(305, 77), N=(304, 95), K1=(215, 120), K2=(285, 130),
                    P=[(208, 100), (212, 40), (220, 12), (245, 35), (280, 30), (296, 12), (305, 40), (318, 90), (312, 110), (285, 125), (250, 125), (220, 118)]),
    'siamese': dict(Hc=(320, 70), Hr=40, E=(331, 82), F=None, N=(361, 102), K1=(260, 110), K2=(325, 127),
                    P=[(255, 100), (265, 55), (290, 25), (305, 12), (320, 35), (340, 25), (348, 20), (355, 60), (365, 100), (350, 118), (320, 128), (285, 125), (262, 115)]),
    'fold': dict(Hc=(289, 75), Hr=52, E=(301, 87), F=(339, 85), N=(334, 105), K1=(214, 125), K2=(319, 160),
                 P=[(205, 130), (215, 80), (240, 40), (262, 12), (285, 30), (320, 25), (335, 12), (342, 50), (350, 110), (340, 150), (310, 165), (260, 162), (220, 150)]),
    'persian': dict(Hc=(285, 115), Hr=62, E=(302, 122), F=(340, 112), N=(350, 134), K1=(195, 180), K2=(280, 182),
                    P=[(175, 130), (195, 75), (232, 22), (245, 30), (260, 45), (282, 15), (292, 40), (318, 55), (345, 100), (357, 140), (340, 165), (300, 182), (250, 185), (200, 175)]),
}
# 옷 상자(기준 프레임): x0(옷 뒤 끝) · y0(등선) · x1(가슴 앞) · y1(배 아래)
CB = {
    'maltese': (110, 150, 310, 285), 'koshort': (115, 112, 305, 245), 'poodle': (100, 145, 290, 270), 'corgi': (90, 140, 305, 268),
    'shiba': (100, 155, 305, 278), 'schnauzer': (80, 140, 275, 262), 'russian': (100, 112, 302, 240), 'siamese': (150, 110, 332, 238),
    'fold': (110, 110, 342, 262), 'persian': (125, 178, 318, 300),
}
# 옆모습 꾸미기를 붙이는 동작과 몸통 회전 범위(도). sitstand는 마지막 칸(정면)을 빼고.
SIDE_MOTIONS = {'idle': [0], 'walk': [-4, 0, 4], 'run': [-8, -4, 0, 4, 8], 'jump': [-12, -8, -4, 0, 4, 8, 12], 'eat': [0],
                'sitstand': [-24, -18, -12, -6, 0], 'stretch': [-16, -12, -8, -4, 0, 4, 8]}
NCC_OK, IOU_OK, BODY_OK = 0.42, 0.72, 0.30


def log(*a): print(*a, flush=True)


s = open(os.path.join(REPO, 'source/src/art/petpaint.gen.ts'), encoding='utf-8').read()
RIG = json.loads(re.search(r'PAINT_RIG: Record<string, PaintRig> = (\{.*\});', s, re.S).group(1))
AMAP = dict(re.findall(r'"([^"]+)": "([^"]+)"', open(os.path.join(REPO, 'source/src/art/artmap.ts'), encoding='utf-8').read()))


def frames(pid, mo):
    k = f'pet.{pid}.paint-{mo}'
    if k not in AMAP or mo not in RIG[pid]['motions']: return []
    S = np.asarray(Image.open(os.path.join(REPO, AMAP[k])).convert('RGBA')).astype(np.float32) / 255.
    m = RIG[pid]['motions'][mo]
    return [S[:, i * m['w']:(i + 1) * m['w']] for i in range(m['n'])]


SIFT = cv2.SIFT_create(nfeatures=0, contrastThreshold=0.02)
BF = cv2.BFMatcher()


def gray(f):
    rgb = f[..., :3] * f[..., 3:4] + 0.93 * (1 - f[..., 3:4])
    return cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)


def poly_mask(shape, P):
    m = np.zeros(shape, np.uint8); cv2.fillPoly(m, [np.int32(np.round(np.asarray(P, float)))], 255); return m


def sim_mat(p):
    sc, deg, tx, ty = p; a = math.radians(deg)
    return np.array([[sc * math.cos(a), -sc * math.sin(a), tx], [sc * math.sin(a), sc * math.cos(a), ty]])


def sim_of(M):
    sc = math.hypot(M[0, 0], M[1, 0]); deg = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    return [sc, deg, float(M[0, 2]), float(M[1, 2])]


def apply(M, pts):
    pts = np.asarray(pts, float).reshape(-1, 2)
    return pts @ M[:, :2].T + M[:, 2]


class Head:
    """기준 머리(그림·알파·둘레)와 그 SIFT 특징점"""
    def __init__(self, pid, ref):
        self.a = ANN[pid]; self.ref = ref
        self.mask = poly_mask(ref.shape[:2], self.a['P'])
        m = cv2.dilate(self.mask, np.ones((9, 9), np.uint8)) & ((ref[..., 3] > 0.3) * 255).astype(np.uint8)
        self.kp, self.d = SIFT.detectAndCompute(gray(ref), m)
        self.g = gray(ref).astype(np.float32)
        self.al = ref[..., 3]

    def sift(self, f):
        kp2, d2 = SIFT.detectAndCompute(gray(f), ((f[..., 3] > 0.3) * 255).astype(np.uint8))
        if d2 is None or len(kp2) < 4: return None, 0
        ms = [p for p in BF.knnMatch(self.d, d2, k=2) if len(p) == 2 and p[0].distance < 0.8 * p[1].distance]
        if len(ms) < 4: return None, 0
        src = np.float32([self.kp[p[0].queryIdx].pt for p in ms]); dst = np.float32([kp2[p[0].trainIdx].pt for p in ms])
        M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=5, maxIters=5000, confidence=0.995)
        if M is None: return None, 0
        return sim_of(M), int(inl.sum())

    def score(self, f, p):
        """변환 p가 맞는지: 머리 그림 상관(NCC)과 알파 겹침(IoU)"""
        M = sim_mat(p); H, W = f.shape[:2]
        wm = cv2.warpAffine(self.mask, M, (W, H), flags=cv2.INTER_NEAREST) > 0
        if wm.sum() < 200: return -1, 0
        wg = cv2.warpAffine(self.g, M, (W, H), flags=cv2.INTER_LINEAR)
        wa = cv2.warpAffine(self.al, M, (W, H), flags=cv2.INTER_LINEAR)
        fg = gray(f).astype(np.float32); fa = f[..., 3]
        both = wm & (wa > 0.5) & (fa > 0.5)
        if both.sum() < 200: return -1, 0
        x, y = wg[both] - wg[both].mean(), fg[both] - fg[both].mean()
        ncc = float((x * y).sum() / (math.sqrt((x * x).sum() * (y * y).sum()) + 1e-6))
        A, B = (wa > 0.5) & wm, (fa > 0.5) & wm
        iou = float((A & B).sum() / max((A | B).sum(), 1))
        return ncc, iou


def refine(head, f, p0):
    """변환 p0 근처를 조금씩 바꿔 가며 머리 그림이 가장 잘 맞는 곳을 찾는다(좌표 하강) → (p, ncc, iou)"""
    p = list(p0)
    def val(q):
        ncc, iou = head.score(f, q); return ncc + 0.5 * iou, ncc, iou
    best = val(p)
    steps = [0.06, 6.0, 8.0, 8.0]                     # 크기, 각도(도), x, y
    while max(steps[1:]) >= 1.0:
        moved = False
        for k in range(4):
            for sgn in (-1, 1):
                q = list(p); q[k] += sgn * steps[k]
                if not (0.7 <= q[0] <= 1.4): continue
                v = val(q)
                if v[0] > best[0] + 1e-4: p, best, moved = q, v, True
        if not moved: steps = [x / 2 for x in steps]
    return p, best[1], best[2]


def body_match(pid, ref, f, angs, Hm):
    """옷 상자 둘레(위·뒤·앞으로 30px 더, 다리는 빼고)의 실루엣 모양을 프레임 실루엣에 맞춘다.
    프레임의 머리(이미 찾은 머리 변환 Hm으로 옮긴 둘레)는 회색(0.5)으로 지워 머리에 맞춰지지 않게.
    반환: [각도, dx, dy](옷 상자 가운데 둘레), 맞지 않는 비율"""
    x0, y0, x1, y1 = CB[pid]; c = ((x0 + x1) / 2, (y0 + y1) / 2)
    mg, pad = 30, 60
    H, W = ref.shape[:2]
    tx0, ty0, tx1, ty1 = max(0, x0 - mg), max(0, y0 - mg), min(W, x1 + mg), min(H, y1 + 12)
    A = (ref[..., 3] > 0.5).astype(np.float32)
    hm = cv2.dilate(poly_mask(A.shape, ANN[pid]['P']), np.ones((7, 7), np.uint8)).astype(np.float32) / 255
    Fa = (f[..., 3] > 0.5).astype(np.float32)
    fh = cv2.dilate(poly_mask(Fa.shape, apply(Hm, ANN[pid]['P'])), np.ones((7, 7), np.uint8)) > 0
    Fa[fh] = 0.5
    big = cv2.copyMakeBorder(Fa, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    offx = (f.shape[1] - W) / 2; offy = f.shape[0] - H   # 프레임은 가운데·바닥선으로 맞춰져 있음
    best = None
    for deg in angs:
        R = cv2.getRotationMatrix2D(c, deg, 1.0)
        Ar = cv2.warpAffine(A, R, (W, H)); Hr = cv2.warpAffine(hm, R, (W, H))
        T = Ar[ty0:ty1, tx0:tx1]; Mk = ((1 - Hr[ty0:ty1, tx0:tx1]) > 0.5).astype(np.float32)
        ex, ey = int(round(tx0 + offx)) + pad, int(round(ty0 + offy)) + pad
        sx0, sy0 = max(0, ex - pad), max(0, ey - pad)
        S = big[sy0:ey + (ty1 - ty0) + pad, sx0:ex + (tx1 - tx0) + pad]
        if S.shape[0] < T.shape[0] or S.shape[1] < T.shape[1]: continue
        r = cv2.matchTemplate(S, T, cv2.TM_SQDIFF, mask=Mk) / max(Mk.sum(), 1)
        # 기대 위치에서 멀수록 조금 손해(모양이 비슷한 다른 곳에 붙지 않게)
        yy, xx = np.mgrid[0:r.shape[0], 0:r.shape[1]]
        r = r + 0.00002 * ((sx0 + xx - ex) ** 2 + (sy0 + yy - ey) ** 2) + 0.0004 * abs(deg)
        mn, _, loc, _ = cv2.minMaxLoc(r)
        if best is None or mn < best[0]: best = (mn, [-float(deg), float(sx0 + loc[0] - pad - tx0), float(sy0 + loc[1] - pad - ty0)])
    return best[1], best[0]    # 각도는 그림 좌표(아래로 +y)에서 시계 방향 +


def body_mat(pid, b):
    deg, dx, dy = b; x0, y0, x1, y1 = CB[pid]; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
    # p' = R (p - c) + c + d
    return np.array([[ca, -sa, cx + dx - ca * cx + sa * cy], [sa, ca, cy + dy - sa * cx - ca * cy]])


def track(pid):
    ref = frames(pid, 'idle')[0]
    head = Head(pid, ref)
    out = {}
    for mo, angs in SIDE_MOTIONS.items():
        fr = frames(pid, mo)
        if not fr: continue
        use = fr[:-1] if mo == 'sitstand' else fr                 # sitstand 마지막 칸은 정면(정면 꾸미기로)
        hs, sc = [], []
        for f in use:
            p, n = head.sift(f)
            ok = False
            if p is not None and 0.7 <= p[0] <= 1.4 and abs(p[1]) <= 80:
                ncc, iou = head.score(f, p)
                # 특징점이 적어도 그림 상관·겹침이 높으면 맞는 것으로(머리를 숙인 먹기 칸 등)
                ok = (n >= 5 and ncc >= NCC_OK and iou >= IOU_OK) or (n >= 3 and ncc >= 0.55 and iou >= 0.8) or (n >= 8 and ncc >= 0.25 and iou >= 0.8)
                sc.append((n, round(ncc, 2), round(iou, 2)))
            else: sc.append((n, None, None))
            hs.append(p if ok else None)
        # 못 찾은 칸: 같은 동작의 다른 칸(가까운 칸부터) 변환에서 시작해 머리 그림이 맞게 조금씩 옮겨 본다
        good = [(i, p) for i, p in enumerate(hs) if p is not None]
        raw = []
        for i, f in enumerate(use):
            if hs[i] is None:
                q, n = head.sift(f); raw.append(q)
            else: raw.append(None)
        for i, p in enumerate(hs):
            if p is not None or not good: continue
            starts = [q for _, q in sorted(good, key=lambda t: min(abs(t[0] - i), len(use) - abs(t[0] - i)))[:3]]
            if raw[i] is not None and 0.7 <= raw[i][0] <= 1.4: starts.append(raw[i])
            cand = []
            for q0 in starts:
                q, ncc, iou = refine(head, use[i], q0)
                # 눈을 감거나 입을 벌린 칸은 그림 상관이 낮다 → 실루엣이 아주 잘 겹치면 받아 줌
                if (ncc >= 0.5 and iou >= 0.78) or (ncc >= 0.3 and iou >= 0.88): cand.append((ncc + 0.5 * iou, [round(v, 4) for v in q]))
            if cand: hs[i] = max(cand)[1]; sc[i] = sc[i] + ('맞춤',)
        if any(p is None for p in hs):
            log(f'  {pid}-{mo}: 머리를 못 찾은 칸 {[i for i, p in enumerate(hs) if p is None]} → 이 동작은 꾸미기 숨김 {sc}')
            continue
        bs, bsc = [], []
        for f, p in zip(use, hs):
            b, e = body_match(pid, ref, f, angs, sim_mat(p)); bs.append(b); bsc.append(round(float(e), 3))
        # 몸통: 같은 동작 안에서 각도를 부드럽게(이웃 칸 평균 — 프레임마다 흔들리지 않게)
        loop = RIG[pid]['motions'][mo]['loop']
        n = len(bs)
        if n > 2 and len(angs) > 1:
            sm = []
            for i in range(n):
                nb = [bs[(i - 1) % n], bs[i], bs[(i + 1) % n]] if loop else [bs[max(0, i - 1)], bs[i], bs[min(n - 1, i + 1)]]
                sm.append([sum(x[0] for x in nb) / 3, bs[i][1], bs[i][2]])
            bs = sm
        if max(bsc) > BODY_OK: log(f'  {pid}-{mo}: 몸통 맞춤이 약한 칸 {bsc} → 옷만 숨김'); bs = None
        out[mo] = dict(h=[[round(v, 4) if k == 0 else round(v, 2) for k, v in enumerate(p)] for p in hs],
                       b=None if bs is None else [[round(v, 2) for v in b] for b in bs], score=sc, bscore=bsc, frames=use)
    return ref, out


# ---------------- 아이템 붙이는 규칙 (앱 art/petside.ts와 같게) ----------------
def place(slot, a, cb, box):
    """기준 프레임 좌표에서 그림(정사각형 한 변 L)의 행렬 [a b c d e f]: 그림 좌표(0..1)*L → 기준 좌표"""
    bx0, by0, bx1, by1 = box; bw, bh = bx1 - bx0, by1 - by0
    Hc, Hr = a['Hc'], a['Hr']
    if slot == 'hat':
        L = min(2.1 * Hr / bw, 1.9 * Hr / bh)
        cx = Hc[0] - 0.05 * Hr; bottom = Hc[1] - Hr + 0.48 * Hr
        return [L, 0, 0, L, cx - (bx0 + bx1) / 2 * L, bottom - by1 * L]
    if slot == 'glasses':
        E, F = np.array(a['E'], float), a['F']
        if F is not None:
            F = np.array(F, float); c = E * 0.55 + F * 0.45; w = np.linalg.norm(F - E) + 0.8 * Hr; ang = math.atan2(F[1] - E[1], F[0] - E[0])
        else:
            c = E + np.array([0.12 * Hr, 0]); w = 0.95 * Hr; ang = 0.0
        L = w / bw; ca, sa = math.cos(ang) * L, math.sin(ang) * L
        ox, oy = -(bx0 + bx1) / 2, -(by0 + by1) / 2
        return [ca, sa, -sa, ca, c[0] + ca * ox - sa * oy, c[1] + sa * ox + ca * oy]
    if slot == 'neck':
        K1, K2 = np.array(a['K1'], float), np.array(a['K2'], float)
        mid = K1 + 0.6 * (K2 - K1); ln = float(np.linalg.norm(K2 - K1)); ang = math.atan2(K2[1] - K1[1], K2[0] - K1[0])
        w = min(1.15 * ln, 1.4 * Hr)                      # 목이 길게 찍힌 친구(귀가 늘어진 보리 등)도 머리 크기에 맞게
        L = min(w / bw, 1.05 * w / bh); ca, sa = math.cos(ang) * L, math.sin(ang) * L
        ox, oy = -(bx0 + bx1) / 2, -by0 - 0.12 * w / L
        return [ca, sa, -sa, ca, mid[0] + ca * ox - sa * oy, mid[1] + sa * ox + ca * oy]
    if slot == 'clothes':
        x0, y0, x1, y1 = cb; h = y1 - y0; wb = x1 - x0
        L = h / bh; sx = 1.0
        if bw * L > wb: L = wb / bw
        elif bw * L < wb: sx = min(wb / (bw * L), 1.3)
        return [L * sx, 0, 0, L, x1 - bx1 * L * sx, y0 - by0 * L]
    raise ValueError(slot)


def mat3(m):
    a, b, c, d, e, f = m
    return np.array([[a, c, e], [b, d, f], [0, 0, 1.0]])


def write_gen(rigs):
    p = os.path.join(REPO, 'source/src/art/petside.gen.ts')
    head = ('// 자동으로 만든 파일 — source/scripts/art_side.py (손으로 고치지 않음)\n'
            '// 옆모습 꾸미기 기준점: 기준 프레임(idle 0) 좌표의 머리 원(hc·hr)·눈(e·f)·목(k1→k2)·머리 둘레(p)·옷 상자(cb),\n'
            '// 동작(m)의 칸마다 머리 변환 h=[크기, 각도(도), x, y](기준 → 그 칸)와 몸통 변환 b=[각도(도), dx, dy](옷 상자 가운데 둘레, 없으면 옷 숨김).\n'
            'import type { SideRig } from \'./petside\';\n')
    open(p, 'w', encoding='utf-8').write(head + 'export const PET_SIDE: Record<string, SideRig> = ' + json.dumps(rigs, ensure_ascii=False, separators=(',', ':')) + ';\n')


def qa_sheet(pid, ref, out, items):
    """실제 옆모습 아이템을 같은 규칙으로 붙여 본 검사 그림"""
    a = ANN[pid]; tiles = []
    for mo, d in out.items():
        for i, f in enumerate(d['frames']):
            h, w = f.shape[:2]
            base = Image.fromarray((np.clip(f, 0, 1) * 255).astype(np.uint8), 'RGBA')
            Hm = sim_mat(d['h'][i])
            if d['b'] is not None:
                Bm = body_mat(pid, d['b'][i])
                cl = items.get('clothes')
                if cl is not None:
                    im, box = cl
                    T = mat3(Bm.flatten()[[0, 3, 1, 4, 2, 5]]) @ mat3(place('clothes', a, CB[pid], box)) @ np.diag([1 / im.size[0], 1 / im.size[1], 1])
                    layer = im.transform((w, h), Image.AFFINE, tuple(np.linalg.inv(T)[:2].flatten()), resample=Image.BILINEAR)
                    la = np.asarray(layer).astype(np.float32) / 255; ba = np.asarray(base).astype(np.float32) / 255
                    hm = poly_mask((h, w), apply(Hm, a['P'])) > 0
                    k = la[..., 3] * ba[..., 3] * (~hm)
                    comp = ba.copy(); comp[..., :3] = la[..., :3] * k[..., None] + ba[..., :3] * (1 - k[..., None])
                    base = Image.fromarray((comp * 255).astype(np.uint8), 'RGBA')
            canvas = Image.new('RGBA', (w, h + 60), (238, 238, 238, 255)); canvas.alpha_composite(base, (0, 60))
            for slot in ('neck', 'glasses', 'hat'):
                if slot not in items: continue
                im, box = items[slot]
                T = np.array([[1, 0, 0], [0, 1, 60], [0, 0, 1.0]]) @ np.vstack([Hm, [0, 0, 1]]) @ mat3(place(slot, a, CB[pid], box)) @ np.diag([1 / im.size[0], 1 / im.size[1], 1])
                layer = im.transform((w, h + 60), Image.AFFINE, tuple(np.linalg.inv(T)[:2].flatten()), resample=Image.BILINEAR)
                canvas.alpha_composite(layer)
            dr = ImageDraw.Draw(canvas); dr.text((3, 3), f'{mo}{i}', fill=(0, 0, 0, 255))
            tiles.append(canvas.convert('RGB').resize((w // 2, (h + 60) // 2)))
    if not tiles: return
    cols = 8; tw = max(t.size[0] for t in tiles); th = max(t.size[1] for t in tiles)
    W = Image.new('RGB', (cols * tw, ((len(tiles) + cols - 1) // cols) * th), 'white')
    for k, t in enumerate(tiles): W.paste(t, ((k % cols) * tw, (k // cols) * th))
    os.makedirs(QA, exist_ok=True); W.save(os.path.join(QA, f'side_{pid}.jpg'), quality=88)


def main():
    rigs = {}
    gp = os.path.join(REPO, 'source/src/art/petside.gen.ts')
    if os.path.exists(gp) and ONLY:      # 일부 친구만 다시 만들 때 나머지는 그대로
        rigs = json.loads(re.search(r'= (\{.*\});', open(gp, encoding='utf-8').read(), re.S).group(1))
    qa_items = {}
    if QA:
        isd = json.loads(re.search(r'= (\{.*\});', open(os.path.join(REPO, 'source/src/art/itemside.gen.ts'), encoding='utf-8').read(), re.S).group(1))
        for slot, key in (('hat', 'hat:straw'), ('glasses', 'glasses:round'), ('neck', 'neck:scarf'), ('clothes', 'clothes:stripe')):
            k = 'iside.' + key.replace(':', '.')
            if k in AMAP: qa_items[slot] = (Image.open(os.path.join(REPO, AMAP[k])).convert('RGBA'), isd[key])
    for pid in (ONLY or list(ANN)):
        log(pid)
        ref, out = track(pid)
        a = ANN[pid]
        rigs[pid] = dict(hc=list(a['Hc']), hr=a['Hr'], e=list(a['E']), f=list(a['F']) if a['F'] else None,
                         k1=list(a['K1']), k2=list(a['K2']), p=[v for xy in a['P'] for v in xy], cb=list(CB[pid]),
                         m={mo: dict(h=d['h'], **({'b': d['b']} if d['b'] is not None else {})) for mo, d in out.items()})
        log(f'  동작: {", ".join(f"{mo}{"" if d["b"] is not None else "(옷X)"}" for mo, d in out.items())}')
        if QA: qa_sheet(pid, ref, out, qa_items)
    write_gen(rigs)


if __name__ == '__main__':
    main()
