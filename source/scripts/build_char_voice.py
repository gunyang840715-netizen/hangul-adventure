#!/usr/bin/env python3
# 캐릭터 음성(강아지 유라 · 고양이 명쾌한) 녹음 → 앱 음성팩 조각(voice.<해시>.char.json) 만들기
#  사용: python3 build_char_voice.py <mp3 폴더> <저장소 맨 위 폴더> [기존 음성팩 폴더(음량 맞추기용)]
#  - 파일 이름의 문장으로 꺼내 쓴다: "유라-기쁨-날짜-문장.mp3" / "명쾌한-한국어-여성-날짜-문장.mp3"
#  - 앱이 하는 말(칭찬·다시 하기·인사·마무리·성장) → 녹음 묶음(pool)으로 연결. 앱이 말할 때마다 묶음에서 돌아가며 고름
#  - 강아지·고양이 중 아이가 고른 대표 친구(lead)의 목소리로 나옴
import sys, os, re, json, glob, hashlib, subprocess, base64, tempfile, shutil

SRC, OUT = sys.argv[1], sys.argv[2]
REF = sys.argv[3] if len(sys.argv) > 3 else OUT
TARGET_LUFS = float(os.environ.get('TARGET_LUFS', '-19'))

norm = lambda s: re.sub(r'[^0-9A-Za-z가-힣]', '', s)

def clip_text(path):
    b = os.path.basename(path)[:-4]
    b = re.sub(r' \(\d+\)$', '', b)
    m = re.match(r'^(유라-[^-]+|명쾌한-한국어-여성)-\d{4}-\d\d-\d\d-\d\d-\d\d-(.+)$', b)
    if not m: return None, None
    who = 'dog' if b.startswith('유라') else 'cat'
    return who, m.group(2).replace('-', ' ')

clips = {'dog': {}, 'cat': {}}     # norm(text) → (text, path)
for p in sorted(glob.glob(os.path.join(SRC, '*.mp3'))):
    who, t = clip_text(p)
    if not who: continue
    clips[who].setdefault(norm(t), (t, p))

# ---------------- 묶음 정의 ----------------
# 앱 문장(app) → 녹음 문장 목록. 녹음 문장은 norm()으로 맞춘다 (물음표·쉼표 차이 무시)
PRAISE_APP = ['딩동댕!', '정답이야!', '우와, 잘했어!', '최고야!', '멋져!', '대단해!', '맞았어!', '짝짝짝!', '우와, 정말 잘했어!', '최고야, 최고!', '대단해! 짝짝짝!']
RETRY_APP = ['다시 해 볼까?', '괜찮아, 한 번 더!', '다시 찾아 볼까?', '천천히 다시 해 볼까?',
             '괜찮아~ 다시 찾아 보자!', '괜찮아, 천천히 다시 찾아 볼까?', '아깝다~ 다시 한번 찾아 보자!',
             '괜찮아~ 다시 골라 줄래?', '괜찮아~ 다시 밟아 보자!', '괜찮아, 천천히 다시 골라 볼까?',
             '괜찮아~ 다른 글자를 넣어 보자!', '괜찮아, 다시 들어 보고 골라 볼까?']
GREET_APP = ['로희야, 안녕!']
ADV_APP = ['오늘의 모험을 떠나 볼까?']
END_APP = ['이제 눈을 쉬게 해 주자. 내일 또 만나!']
TIMEUP_APP = ['오늘 놀 시간이 다 됐어. 이번 놀이까지만 하자!']

POOLS = {
  'praise': {
    'dog': ['우와, 정답이야! 로희 최고!', '딩동댕! 정답이에요!', '맞았어! 정말 잘했어!', '와아, 대단해! 어떻게 알았어', '왈왈! 로희가 해냈어!',
            '역시 로희야! 척척 맞히네!', '빙고! 바로 그거야!', '정말 똑똑하다, 로희야!', '짝짝짝! 아주 잘했어!', '맞아 맞아! 이제 완전 잘 알겠다!',
            '최고야, 최고! 하이파이브!', '꼬리가 막 흔들려! 정말 잘했어!', '야호! 또 맞혔어!', '어쩜 이렇게 잘해! 멋지다, 로희야!',
            '우와, 척척박사다!', '한 번에 찾았네! 대단해!', '정말 훌륭해, 로희야!', '이 글자는 이제 로희 친구네!', '로희 덕분에 내가 신나서 춤을 춰!'],
    'cat': ['정답이에요! 정말 잘했어', '맞았어!', '아주 잘 찾았어!', '냐옹, 정확해!', '정말 똑똑하다!', '딱 맞았어! 대단해', '헷갈리지 않았네!',
            '척척 잘하네!', '짝짝짝', '이제 이 글자는 문제없겠다!'],
  },
  'retry': {
    'dog': ['괜찮아, 다시 한번 해 보자!', '아쉽다! 우리 한 번 더 해 볼까', '괜찮아 괜찮아, 천천히 찾아보자', '걱정 마, 로희야. 나도 처음엔 어려웠어.',
            '괜찮아, 다시 찾아보면 돼!', '아이고, 아쉽네. 다시 해 보자!', '한 번 더 생각해 볼까 할 수 있어!', '눈을 크게 뜨고 다시 찾아볼까',
            '조금만 더! 다시 찾아보자!', '좋아, 다시 해 보는 거야. 힘내, 로희야!', '내가 응원할게. 힘내라, 힘!', '괜찮아, 연습하면 점점 쉬워져!',
            '괜찮아, 천천히 해도 돼.', '다시 해 보면 분명히 할 수 있어.'],
    'cat': ['괜찮아, 우리 다시 찾아보자', '아쉽다. 한 번 더 해 볼까', '천천히 다시 보면 알 수 있어', '괜찮아, 누구나 헷갈릴 수 있어',
            '조금만 더 생각해 보자. 할 수 있어!', '걱정 마. 내가 도와줄게. 냐옹.', '다시 해 보면 쉬울 거야옹', '이번엔 꼭 찾을 수 있을 거야~옹',
            '천천히, 천천히. 서두르지 않아도 돼.', '실수는 배우는 과정이야.', '눈을 크게 뜨고 살펴보자', '조금만 더 집중하면 찾을 수 있어',
            '천천히 해도 돼. 나는 여기 있어.'],
  },
  'greet': {
    'dog': ['로희야, 안녕! 오늘도 나랑 같이 놀자!', '왈왈! 로희야, 보고 싶었어!', '로희야, 왔구나! 오늘은 어떤 글자를 만날까', '좋은 날이야, 로희야! 힘차게 시작하자!',
            '와, 로희다! 기다리고 있었어!', '로희야, 어서 와. 기다리고 있었어.'],
    'cat': ['냐옹, 로희야 안녕! 오늘도 같이 공부할까', '안녕, 오늘도 반가워!'],
  },
  'adventure': {
    'dog': ['로희야, 오늘도 한글 모험을 떠나 볼까', '한글 마법 공부를 시작해 볼까', '오늘도 신나게 한글 놀이를 해 보자!', '좋은 날이야, 로희야! 힘차게 시작하자!'],
    'cat': ['오늘은 어떤 글자를 만나 볼까냐옹', '오늘도 반짝반짝 빛나는 하루야', '오늘은 어떤 놀이를 해 볼까'],
  },
  'end': {
    'dog': ['오늘은 여기까지! 내일 또 만나자!', '멍! 멍! 안녕, 내일 또 만나!', '수고했어, 로희야. 푹 쉬고 와!', '벌써 시간이 이렇게 됐네. 오늘 정말 즐거웠어!'],
    'cat': ['오늘은 여기까지 할까', '내일 또 만나자!', '푹 자고 내일 또 와.'],
  },
  'timeup': {
    'dog': ['잠깐, 놀이 시간이 거의 끝나가요.'],
    'cat': [],
  },
  'grow': {
    'dog': ['레벨 업! 나 조금 더 커졌어!', '와, 내가 쑥 컸어! 로희 덕분이야!'],
    'cat': ['레벨이 올랐어! 나 조금 더 컸지.'],
  },
}

APP = {'praise': PRAISE_APP, 'retry': RETRY_APP, 'greet': GREET_APP, 'adventure': ADV_APP, 'end': END_APP, 'timeup': TIMEUP_APP}

# 성장·어른 말은 강아지 이름이면 강아지 목소리, 고양이 이름이면 고양이 목소리로 고정 (앱의 PETS 목록에서 읽음)
pets_ts = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'pets.ts'), encoding='utf-8').read() if os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'pets.ts')) else ''
PETS = re.findall(r"species: '(dog|cat)', breed: '[^']*', name: '([^']*)'", pets_ts)

def has_batchim(w):
    c = ord(w[-1]) - 0xAC00
    return 0 <= c < 11172 and c % 28 != 0
def call(n): return n + '이' if has_batchim(n) else n          # pets.ts의 call()과 같은 규칙
def iga(n): return call(n) + '가'
def stage(n, s): return f"{iga(n)} {'어린이가' if s == 'kid' else '어른이'} 됐어!"
GROW_APP = {'dog': [], 'cat': []}
for sp, n in PETS:
    GROW_APP[sp] += [f'{iga(n)} 쑥쑥 컸어!', stage(n, 'kid'), stage(n, 'adult')]

# ---------------- 음량 맞추기 기준 (기존 음성팩의 평균 음량) ----------------
def lufs(path):
    r = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True)
    m = re.findall(r'I:\s+(-?\d+\.\d) LUFS', r.stderr)
    return float(m[-1]) if m else None

def ref_lufs():
    try:
        man = json.load(open(os.path.join(REF, 'voice-manifest.json'), encoding='utf-8'))
        j = json.load(open(os.path.join(REF, man['files'][0]['u']), encoding='utf-8'))['voices']
    except Exception:
        return None
    vals = []
    tmp = tempfile.mkdtemp()
    for i, (k, b) in enumerate(j.items()):
        if i % 40 or len(k) < 6: continue
        p = os.path.join(tmp, f'{i}.webm'); open(p, 'wb').write(base64.b64decode(b))
        v = lufs(p)
        if v is not None and v > -50: vals.append(v)
        if len(vals) >= 12: break
    shutil.rmtree(tmp, ignore_errors=True)
    return sum(vals) / len(vals) if vals else None

# ---------------- 변환 ----------------
tmp = tempfile.mkdtemp()
def encode(path):
    out = os.path.join(tmp, hashlib.md5(path.encode()).hexdigest() + '.webm')
    # 앞뒤 빈 소리를 줄이고 음량을 맞춘 뒤 24kHz 모노 Opus(webm)로
    af = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,'
          'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,'
          f'loudnorm=I={TARGET_LUFS}:TP=-2:LRA=9')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-af', af, '-ac', '1', '-ar', '24000', '-c:a', 'libopus', '-b:a', '32k', out], check=True)
    return base64.b64encode(open(out, 'rb').read()).decode()

r = ref_lufs()
if r is not None and not os.environ.get('TARGET_LUFS'):
    TARGET_LUFS = round(max(-24.0, min(-14.0, r)), 1)
print('음량 기준(LUFS):', TARGET_LUFS, '(기존 음성팩 평균 %s)' % (round(r, 1) if r is not None else '확인 못 함'))

voices, pool, report, missing = {}, {}, [], []
def key(who, text): return f'{who}::{text}'
def need(who, text):
    h = clips[who].get(norm(text))
    if not h: missing.append((who, text)); return None
    k = key(who, h[0])
    if k not in voices: voices[k] = encode(h[1])
    return k

def add(app_texts, name, fixed=None):
    d = [k for k in (need('dog', t) for t in POOLS[name]['dog']) if k]
    c = [k for k in (need('cat', t) for t in POOLS[name]['cat']) if k]
    for t in app_texts:
        e = {}
        if d: e['d'] = d
        if c: e['c'] = c
        if fixed: e['f'] = fixed
        if e: pool[t] = e

for name, texts in APP.items(): add(texts, name)
add(GROW_APP['dog'], 'grow', 'd')
# 고양이 이름의 성장 말은 고양이 목소리로 고정
c_only = [k for k in (need('cat', t) for t in POOLS['grow']['cat']) if k]
for t in GROW_APP['cat']:
    if c_only: pool[t] = {'c': c_only, 'f': 'c'}
for t in GROW_APP['dog']:
    pool[t].pop('c', None)

for name, texts in APP.items():
    for t in texts:
        report.append((name, t, len(pool.get(t, {}).get('d', [])), len(pool.get(t, {}).get('c', []))))

blob = json.dumps({'voices': voices, 'pool': pool}, ensure_ascii=False, separators=(',', ':'))
h = hashlib.sha1(blob.encode()).hexdigest()[:10]
fn = f'voice.{h}.char.json'
open(os.path.join(OUT, fn), 'w', encoding='utf-8').write(blob)

mp = os.path.join(OUT, 'voice-manifest.json')
man = json.load(open(mp, encoding='utf-8'))
man['files'] = [f for f in man['files'] if not re.match(r'voice\.[0-9a-f]+\.char\.json$', f['u'])]
for f in glob.glob(os.path.join(OUT, 'voice.*.char.json')):
    if os.path.basename(f) != fn: os.remove(f)           # 예전 캐릭터 음성 조각 정리
man['files'].append({'u': fn, 'b': len(blob.encode())})
man['v'] = max(6, man.get('v', 5))
man['char'] = {'dog': '유라', 'cat': '명쾌한', 'clips': len(voices), 'pool': len(pool)}
open(mp, 'w', encoding='utf-8').write(json.dumps(man, ensure_ascii=False, separators=(',', ':')))
shutil.rmtree(tmp, ignore_errors=True)

print('조각', fn, round(len(blob) / 1e6, 2), 'MB / 녹음', len(voices), '개 / 연결된 앱 문장', len(pool), '개')
if missing:
    print('찾지 못한 녹음 문장(이름 확인):')
    for w, t in sorted(set(missing)): print('  ', w, t)
print('묶음별 연결 요약:')
seen = set()
for name, t, d, c in report:
    if name in seen: continue
    seen.add(name); print(f'  {name}: 앱 문장 {len(APP[name])}개 ← 강아지 {d}개 · 고양이 {c}개')
