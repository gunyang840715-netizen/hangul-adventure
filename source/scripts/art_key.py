# 단색 배경 지우기 (COLLAB 7-2 · 9-8) — GPT가 투명 대신 #00FF00(초록)·#FF00FF(분홍) 단색 배경으로 그린 그림을 투명 배경으로.
#
#  1) 테두리 색으로 배경색을 정한다(이미 투명 배경이면 그대로).
#  2) 배경색과 아주 가까운 곳 중 테두리에 닿거나, 크거나, 배경색 그대로인 점이 있는 덩어리만 배경
#     (눈동자 같은 작은 초록·분홍은 남긴다).
#  3) 배경 둘레의 띠: '차이 키' — 초록 배경이면 k = G − max(R,B), 분홍이면 k = min(R,B) − G.
#     물체 색(가까운 확실한 물체 점)의 k를 kF라 하면 알파 = (1 − k)/(1 − kF). 색은 배경색을 빼낸 색.
#     (밝기만 다른 선·그림자는 알파 1 그대로 — 테두리 선이 지워지거나 분홍·초록으로 물들지 않게)
#  4) 배경 가까이에 남은 초록·분홍 기운은 뺀다.
#
# 쓰는 곳: art_pets.py(친구), art_sheets.py(꾸미기·간식·가구), art_bg.py(배경 앞 층)
import numpy as np, cv2
from scipy import ndimage as ndi

KEYS = {'G': np.array([0., 1., 0.], np.float32), 'M': np.array([1., 0., 1.], np.float32)}


def key_color(I):
    """테두리 색 → ('G'|'M', 배경색) 또는 (None, None)(투명 배경이거나 단색이 아님)"""
    b = np.concatenate([I[:4].reshape(-1, 4), I[-4:].reshape(-1, 4), I[:, :4].reshape(-1, 4), I[:, -4:].reshape(-1, 4)])
    if (b[:, 3] < 0.5).mean() > 0.5: return None, None
    K = np.median(b[:, :3], axis=0)
    name = min(KEYS, key=lambda k: float(np.abs(K - KEYS[k]).sum()))
    if float(np.abs(K - KEYS[name]).sum()) > 0.35: return None, None
    return name, K.astype(np.float32)


def keyval(rgb, name):
    if name == 'G': return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
    return np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]


def chroma_key(I, band_px=None, bg_mask=None, K=None, name=None, pockets=False):
    """I: float32 RGBA(0~1). 단색 배경을 투명으로 바꾼 새 배열. bg_mask를 주면 그곳만 배경 후보.
    pockets: 배경색 기운이 강한 곳(k>0.25 — 다리 사이·꼬리 안쪽의 그늘진 틈)도 띠처럼 지운다(친구 그림용:
    친구 몸에는 배경색과 같은 계열의 색이 없다)."""
    if K is None:
        name, K = key_color(I)
        if K is None: return I
    H, W = I.shape[:2]
    rgb = I[..., :3]
    d = np.linalg.norm(rgb - K, axis=2)
    bg = d < 0.24
    if bg_mask is not None: bg &= bg_mask
    n, lab, st, _ = cv2.connectedComponentsWithStats(bg.astype(np.uint8), 4)
    keep = np.zeros(n, bool)
    dmin = ndi.minimum(d, lab, np.arange(n)) if n > 1 else np.zeros(1)
    for i in range(1, n):
        x, y, w, h, area = st[i]
        # 테두리에 닿거나, 크거나, 배경색 그대로인 점이 있는 덩어리(다리 사이·꼬리 안쪽 틈)
        if x == 0 or y == 0 or x + w >= W or y + h >= H or area > 0.0012 * H * W or (dmin[i] < 0.08 and area >= 12): keep[i] = True
    bg = keep[lab]
    if band_px is None: band_px = max(3, int(round(min(H, W) / 260)))      # 1254px → 5px
    ker = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    near = cv2.dilate(bg.astype(np.uint8), ker(band_px)).astype(bool)
    if pockets:
        pk = (keyval(rgb, name) > 0.25) & ~bg
        near |= cv2.dilate(pk.astype(np.uint8), ker(2)).astype(bool)
    band = near & ~bg
    solid = ~near
    if not solid.any(): return I
    # 띠 안 각 점의 '물체 색' = 가장 가까운 확실한 물체 점의 색
    _, (iy, ix) = ndi.distance_transform_edt(~solid, return_indices=True)
    Fc = rgb[iy, ix]
    kK = float(keyval(K[None, None], name)[0, 0])                 # 배경의 k (≈1)
    kC = keyval(rgb, name); kF = np.minimum(keyval(Fc, name), 0.6 * kK)
    al = np.clip((kK - kC) / np.maximum(kK - kF, 1e-3), 0, 1)
    al = np.where(al < 0.12, 0, al)
    # 색: 배경색을 빼낸 색 (알파가 작으면 가까운 물체 색 쪽으로)
    un = np.clip((rgb - (1 - al)[..., None] * K) / np.maximum(al, 1e-3)[..., None], 0, 1)
    w = np.clip((al - 0.12) / 0.5, 0, 1)[..., None]
    col = un * w + Fc * (1 - w)
    out = I.copy()
    out[..., :3] = np.where(band[..., None], col, rgb)
    out[..., 3] = np.where(bg, 0, np.where(band, al * I[..., 3], I[..., 3]))
    out[bg] = 0
    # 배경 가까이(띠의 3배 안쪽) 남은 배경색 기운 빼기
    far = cv2.dilate(bg.astype(np.uint8), ker(3 * band_px)).astype(bool) & ~bg
    o = out[..., :3]
    if name == 'G':
        sp = far & (o[..., 1] > np.maximum(o[..., 0], o[..., 2]) + 0.04)
        o[sp, 1] = np.maximum(o[sp, 0], o[sp, 2]) + 0.04
    else:
        lo = np.minimum(o[..., 0], o[..., 2])
        sp = far & (lo > o[..., 1] + 0.12) & (np.abs(o[..., 0] - o[..., 2]) < 0.25)
        o[sp, 0] = np.minimum(o[sp, 0], o[sp, 1] + 0.12); o[sp, 2] = np.minimum(o[sp, 2], o[sp, 1] + 0.12)
    return out


def leftover(I, name):
    """지운 뒤 남은 배경색 기운(불투명한 곳 중 k>0.3인 점 수) — 검사용"""
    if name is None: return 0
    return int(((keyval(I[..., :3], name) > 0.3) & (I[..., 3] > 0.5)).sum())


def load_keyed(path, band_px=None, pockets=False):
    from PIL import Image
    I = np.asarray(Image.open(path).convert('RGBA')).astype(np.float32) / 255.
    return chroma_key(I, band_px, pockets=pockets)
