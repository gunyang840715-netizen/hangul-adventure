#!/usr/bin/env python3
# 캐릭터 음성(강아지 유라 · 고양이 명쾌한) 녹음 → 앱 음성팩 조각(voice.<해시>.char.json) 만들기
#  사용: python3 build_char_voice.py '<mp3 폴더1>|<mp3 폴더2>' <저장소 맨 위 폴더> [기존 음성팩 폴더(음량 맞추기용)]
#  - 파일 이름의 문장으로 꺼내 쓴다: "유라-기쁨-날짜-문장.mp3" / "명쾌한-한국어-여성-날짜-문장.mp3"
#  - 앱이 하는 말(칭찬·다시 하기·인사·마무리·성장) → 녹음 묶음(pool)으로 연결. 앱이 말할 때마다 묶음에서 돌아가며 고름
#  - 강아지·고양이 중 아이가 고른 대표 친구(lead)의 목소리로 나옴
import sys, os, re, json, glob, hashlib, subprocess, base64, tempfile, shutil

SRCS, OUT = sys.argv[1].split('|'), sys.argv[2]
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
for p in sorted(p for S in SRCS for p in glob.glob(os.path.join(S, '*.mp3'))):
    who, t = clip_text(p)
    if not who: continue
    clips[who].setdefault(norm(t), (t, p))

# ---------------- 묶음 정의 ----------------
# 앱 문장(app) → 녹음 문장 목록. 녹음 문장은 norm()으로 맞춘다 (물음표·쉼표 차이 무시)
# 아이 이름이 들어간 앱 문장은 공개 저장소에 이름이 남지 않게 '{이름}'으로 적는다 (앱이 실행할 때 바꿔 맞춘다)
PRAISE_APP = ['딩동댕!', '정답이야!', '우와, 잘했어!', '최고야!', '멋져!', '대단해!', '맞았어!', '짝짝짝!', '우와, 정말 잘했어!', '최고야, 최고!', '대단해! 짝짝짝!',
              '시험 통과! 정말 잘했어!', '잘 기억하고 있구나! 오늘 공부를 시작하자!']
RETRY_APP = ['다시 해 볼까?', '괜찮아, 한 번 더!', '다시 찾아 볼까?', '천천히 다시 해 볼까?',
             '괜찮아~ 다시 찾아 보자!', '괜찮아, 천천히 다시 찾아 볼까?', '아깝다~ 다시 한번 찾아 보자!',
             '괜찮아~ 다시 골라 줄래?', '괜찮아~ 다시 밟아 보자!', '괜찮아, 천천히 다시 골라 볼까?',
             '괜찮아~ 다른 글자를 넣어 보자!', '괜찮아, 다시 들어 보고 골라 볼까?',
             '아쉽다~ 오늘 배운 글자를 한 번 더 공부하고 다시 보자!', '어제 배운 글자를 한 번 더 공부하자!']

SITU = {
  'praise': dict(
    app=PRAISE_APP,
    dog=['우와, 정답이야! {N} 최고!', '딩동댕! 정답이에요!', '맞았어! 정말 잘했어!', '와아, 대단해! 어떻게 알았어', '왈왈! {N}가 해냈어!',
         '역시 {N}야! 척척 맞히네!', '빙고! 바로 그거야!', '정말 똑똑하다, {N}야!', '짝짝짝! 아주 잘했어!', '맞아 맞아! 이제 완전 잘 알겠다!',
         '최고야, 최고! 하이파이브!', '꼬리가 막 흔들려! 정말 잘했어!', '야호! 또 맞혔어!', '어쩜 이렇게 잘해! 멋지다, {N}야!',
         '우와, 척척박사다!', '한 번에 찾았네! 대단해!', '정말 훌륭해, {N}야!', '이 글자는 이제 {N} 친구네!', '{N} 덕분에 내가 신나서 춤을 춰!'],
    cat=['정답이에요! 정말 잘했어', '맞았어!', '아주 잘 찾았어!', '냐옹, 정확해!', '정말 똑똑하다!', '딱 맞았어! 대단해', '헷갈리지 않았네!',
         '척척 잘하네!', '짝짝짝', '이제 이 글자는 문제없겠다!', '정말 잘했어. 나도 기뻐!', '맞아, 바로 그 글자야!', '와, 정말 빨리 찾았다!',
         '완벽해! {N}가 최고야.', '오늘따라 더 잘하는데', '꼬리가 쭉 올라갔어! 신나!', '눈이 반짝반짝, 정말 잘 보는구나!',
         '{N} 덕분에 나도 많이 배워!', '기분이 좋아서 가르릉거려!', '계속 맞히고 있어. 너무 멋지다!', '아주 잘 따라 했어!']),
  'retry': dict(
    app=RETRY_APP,
    dog=['괜찮아, 다시 한번 해 보자!', '아쉽다! 우리 한 번 더 해 볼까', '괜찮아 괜찮아, 천천히 찾아보자', '걱정 마, {N}야. 나도 처음엔 어려웠어.',
         '괜찮아, 다시 찾아보면 돼!', '아이고, 아쉽네. 다시 해 보자!', '한 번 더 생각해 볼까 할 수 있어!', '눈을 크게 뜨고 다시 찾아볼까',
         '조금만 더! 다시 찾아보자!', '좋아, 다시 해 보는 거야. 힘내, {N}야!', '내가 응원할게. 힘내라, 힘!', '괜찮아, 연습하면 점점 쉬워져!',
         '괜찮아, 천천히 해도 돼.', '다시 해 보면 분명히 할 수 있어.'],
    cat=['괜찮아, 우리 다시 찾아보자', '아쉽다. 한 번 더 해 볼까', '천천히 다시 보면 알 수 있어', '괜찮아, 누구나 헷갈릴 수 있어',
         '조금만 더 생각해 보자. 할 수 있어!', '걱정 마. 내가 도와줄게. 냐옹.', '다시 해 보면 쉬울 거야옹', '이번엔 꼭 찾을 수 있을 거야~옹',
         '천천히, 천천히. 서두르지 않아도 돼.', '실수는 배우는 과정이야.', '눈을 크게 뜨고 살펴보자', '조금만 더 집중하면 찾을 수 있어',
         '천천히 해도 돼. 나는 여기 있어.', '괜찮아, 연습하는 중이잖아.', '{N}야, 이제 다시 해 볼까.', '실수해도 괜찮아. 다시 하면 되지!',
         '아깝다! 거의 맞혔어. 다시 해 보자.', '냐옹, 응원하고 있어!']),
  'greet': dict(
    app=['{이름}, 안녕!'],
    dog=['{N}야, 안녕! 오늘도 나랑 같이 놀자!', '왈왈! {N}야, 보고 싶었어!', '{N}야, 왔구나! 오늘은 어떤 글자를 만날까', '좋은 날이야, {N}야! 힘차게 시작하자!',
         '와, {N}다! 기다리고 있었어!', '{N}야, 어서 와. 기다리고 있었어.'],
    cat=['냐옹, {N}야 안녕! 오늘도 같이 공부할까', '안녕, 오늘도 반가워!', '{N}야, 와 줘서 고마워.', '좋은 하루야, {N}야. 같이 시작해 볼까.']),
  'adventure': dict(
    app=['오늘의 모험을 떠나 볼까?', '하던 모험을 이어서 하자!'],
    dog=['{N}야, 오늘도 한글 모험을 떠나 볼까', '한글 마법 공부를 시작해 볼까', '오늘도 신나게 한글 놀이를 해 보자!', '좋은 날이야, {N}야! 힘차게 시작하자!'],
    cat=['오늘은 어떤 글자를 만나 볼까냐옹', '오늘도 반짝반짝 빛나는 하루야', '오늘은 어떤 놀이를 해 볼까']),
  'end': dict(
    app=['이제 눈을 쉬게 해 주자. 내일 또 만나!'],
    dog=['오늘은 여기까지! 내일 또 만나자!', '멍! 멍! 안녕, 내일 또 만나!', '수고했어, {N}야. 푹 쉬고 와!', '벌써 시간이 이렇게 됐네. 오늘 정말 즐거웠어!'],
    cat=['오늘은 여기까지 할까', '내일 또 만나자!', '푹 자고 내일 또 와.', '오늘 정말 즐거웠어. 안녕!', '잘 가, {N}야. 오늘 배운 글자를 기억해 줘.']),
  'timeup': dict(
    app=['오늘 놀 시간이 다 됐어. 이번 놀이까지만 하자!'],
    dog=['잠깐, 놀이 시간이 거의 끝나가요.'],
    cat=['오늘 공부 시간을 다 채웠어요. 정말 잘했어!']),
  'alldone': dict(
    app=['오늘 새 모험은 끝! 놀이터에서 더 놀까?', '{이름}, 모든 모험을 끝냈어! 놀이터에서 더 놀자!'  ,
         '{이름}, 오늘도 정말 잘했어!'],
    dog=['오늘 정말 열심히 했어! 최고야!', '수고했어, {N}야. 푹 쉬고 와!', '정말 훌륭해, {N}야!'],
    cat=['놀이터에서 같이 놀 시간이야!', '오늘도 열심히 했어. 정말 대견해.', '오늘도 한 걸음 더 나아갔구나.']),
  'listen': dict(
    app=['잘 듣고 찾아 봐!', '소리를 잘 듣고 방울을 찾아 봐!', '소리를 잘 듣고 두더지를 잡아 봐!', '소리를 잘 듣고 글자를 만들어 봐!', '이번엔 이 소리!',
         '이 소리가 들어간 글자를 모두 찾아 봐!', '이 소리들이 들어간 글자를 모두 찾아 봐!', '글자 카드를 잘 보고, 문제를 듣고 찾아 봐!'],
    dog=['잘 들어 봐. 이 소리야!', '힌트를 줄게. 귀를 쫑긋 세우고 들어 봐!', '내가 한 번 더 읽어 줄게. 잘 들어 봐!', '처음 소리를 잘 들어 봐!',
         '소리를 잘 듣고 알맞은 글자를 찾아봐!', '다시 한번 들려줄게.'],
    cat=['먼저 소리를 들어 볼까', '소리를 듣고 같은 글자를 찾아보자', '이 글자는 어떤 소리일까 잘 들어 봐', '첫소리를 잘 들어 보면 알 수 있어',
         '소리를 한 번 더 들려줄게. 귀 기울여 봐.', '한 번 더 잘 들어 볼까']),
  'trace_start': dict(
    app=['따라 써 볼까? 초록 점에서 시작해!', '초록 점에서 시작해 봐!', '선을 따라 그려 봐!', '화살표 방향으로 쭉!', '끝까지 쭉 그어 봐!',
         '열 번 써 보자!', '다섯 번 써 보자!', '열다섯 번 써 보자!', '번갈아 가며 써 보자!'],
    dog=['이제 글자를 써 볼까 따라 써 봐!', '점선을 따라서 천천히 써 보자', '시작하는 곳에서 출발! 출발!'],
    cat=['선을 따라서 부드럽게 써 보자', '시작하는 점에서 천천히 출발해 보자', '이제 글자를 써 볼 시간이야. 팬으로 따라 써 봐.',
         '점선을 따라 한 획씩 써 보자', '한 글자 한 글자 정성껏 써 보자']),
  'trace_go': dict(
    app=['열 번 더 써 보자!', '마지막 열 번이야! 힘내!'],
    dog=['쓱쓱, 잘 쓰고 있어!', '조금씩 늘고 있어. 자랑스러워!'],
    cat=['잘 쓰고 있어. 조금만 더 써 볼까.', '마지막까지 힘내서 써 보자!', '글씨가 점점 더 멋있어지고 있어.']),
  'trace_done': dict(
    app=['다섯 번 다 썼어! 대단해!', '열 번 다 썼어! 대단해!', '열다섯 번 다 썼어! 대단해!', '서른 번 다 썼어! 정말 대단해!', '마흔 번 다 썼어! 정말 대단해!'],
    dog=['와, 글씨가 반듯해! 멋지다!', '정말 훌륭해, {N}야!', '쓱쓱, 잘 쓰고 있어!'],
    cat=['와우, 아주 예쁘게 썼어!', '열심히 하는 모습이 참 예뻐.', '글씨가 점점 더 멋있어지고 있어.']),
  'ghost': dict(
    app=['이번엔 흐린 선만 보고 써 봐!', '이제 혼자 써 봐! 그림자가 없어!', '이번엔 혼자 써 볼까?'],
    dog=['이번엔 안내 없이 써 볼까.', '좋아, 이번엔 그림자만 보고 써 보자!'],
    cat=['이번에는 그림자만 보고 써 볼까', '삐뚤어져도 괜찮아. 계속 쓰면 점점 예뻐져.']),
  'recall_write': dict(
    app=['이번엔 기억해서 써 봐!', '어디서 시작하는지 기억해 봐!'],
    dog=['이번에는 기억을 떠올려서 써 보자!'],
    cat=['이제는 기억해서 혼자 써 보자']),
  'show': dict(
    app=['잘 봐, 이렇게 쓰는 거야!'],
    dog=['오늘 새로 배울 글자야. 잘 보고 잘 들어 봐.'],
    cat=['이 글자의 모양을 자세히 봐 봐']),
  'newletter': dict(
    app=['새 글자 친구를 만나 볼까?', '새 글자 친구들이 기다리고 있어!', '글자 친구를 눌러 봐!'],
    dog=['오늘 새로 배울 글자야. 잘 보고 잘 들어 봐.', '새 친구를 만났어! 같이 놀자!'],
    cat=['오늘은 어떤 글자를 만나 볼까냐옹', '새로운 친구가 생겼어. 반가워!']),
  'repeat': dict(
    app=['같이 읽어 보자!', '이번엔 네가 해 봐!'],
    dog=['이제 {N}가 따라 말해 볼까.', '한 번 더 말해 볼까.', '같이 소리 내어 읽어 볼까'],
    cat=['내가 천천히 읽어 줄게. 따라 해 봐.', '천천히 말해 보자.']),
  'bubble': dict(
    app=['방울 속에 글자 친구들이 갇혀 있어! 눌러서 구해 줘!', '방울 속에 글자 친구가 갇혀 있어! 눌러서 구해 줘!', '찾아서 톡 터뜨려 봐!'],
    dog=['방울이 떠오르네! 맞는 방울을 톡 터뜨려 보자!'],
    cat=['방울 속에 글자가 들어 있어. 알맞은 걸 톡 눌러 봐.']),
  'mole': dict(
    app=['이 글자를 든 두더지를 콕 잡아 봐!'],
    dog=['두더지가 쏙 나왔다! 어서 눌러 봐!', '두더지 놀이! {N}가 들은 글자를 콕 눌러 봐!'],
    cat=[]),
  'hop': dict(
    app=['글자 돌을 밟고 강을 건너자!', '밟아 봐!'],
    dog=['달려라 달려! 맞는 길로 달리면 돼!'],
    cat=[]),
  'pairs': dict(
    app=['짝 맞추기! 같은 짝을 찾아 봐!'],
    dog=[],
    cat=['이번에는 짝 맞추기야! 카드의 위치를 잘 기억해.', '카드를 뒤집어서 같은 글자를 찾아봐.']),
  'recall_cards': dict(
    app=['이제 카드를 뒤집을게!', '이 글자 카드를 찾을 거야!', '어디에 있는지 잘 기억해!', '다시 볼게! 잘 봐!', '이제 다시 뒤집을게!'],
    dog=[],
    cat=['먼저 카드를 보여 줄게. 어디 있는지 잘 봐 둬.', '위치가 기억나지 않으면 다시 볼 수도 있어.']),
  'gift': dict(
    app=['선물 뽑기 시간! 손잡이를 눌러 봐!', '캡슐이 나왔어! 눌러서 열어 봐!'],
    dog=['짠! 선물이 도착했어!', '멋진 보물을 찾았어! 와!'],
    cat=['짜잔, 선물이야! 열어 봐!', '멋진 보물을 발견했어!']),
  'stars': dict(
    app=['별을 세 개 받았어! 정말 잘했어!', '별도 세 개 받았어!'],
    dog=['별을 모두 모았어. 정말 잘했어!'],
    cat=['별이 반짝반짝 늘었어!']),
  'review': dict(
    app=['어제 배운 글자를 잘 기억하는지 볼까? 내가 말하는 글자를 써 봐!'],
    dog=['어제 배운 글자, 기억나 같이 복습해 보자!'],
    cat=['어제 배운 글자들을 다시 만나 볼까.', '기억나는 글자가 있는지 확인해 보자']),
  'test': dict(
    app=['받아쓰기 시험을 볼 거야! 내가 말하는 글자를 안 보고 써 봐!', '이 글자를 써 봐!'],
    dog=['소리를 듣고 글자를 써 볼까'],
    cat=['잘 알고 있는지 같이 살펴보자', '잘 듣고 써 보자']),
  'build': dict(
    app=['우리 집에서 집을 지어 줄 수 있어!', '망치를 눌러서 지어 보자!', '뭘 지어 볼까?'],
    dog=[],
    cat=['재료를 모아서 우리 집을 지어 보자']),
}
# 녹음 문장 속 아이 이름('{N}')은 실행할 때만 채운다: CHILD_NAME=아이이름 python3 build_char_voice.py ... (공개 저장소에 이름을 적지 않기 위해)
CHILD = os.environ.get('CHILD_NAME', '')
if not CHILD: sys.exit('CHILD_NAME 환경변수에 아이 이름을 넣어 실행하세요 (녹음 파일 이름에 들어 있는 이름)')
for _v in SITU.values():
    _v['dog'] = [t.replace('{N}', CHILD) for t in _v['dog']]
    _v['cat'] = [t.replace('{N}', CHILD) for t in _v['cat']]
POOLS = {k: {'dog': v['dog'], 'cat': v['cat']} for k, v in SITU.items()}
APP = {k: [t for t in v['app'] if t] for k, v in SITU.items()}

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
def key(who, text): return f'{who}::' + hashlib.sha1((who + norm(text)).encode()).hexdigest()[:10]   # 키에 글자(아이 이름 등)가 남지 않게 해시로
def need(who, text):
    h = clips[who].get(norm(text))
    if not h: missing.append((who, text)); return None
    k = key(who, h[0])
    if k not in voices: voices[k] = encode(h[1])
    return k

# 앱이 하는 말 전체(기존 음성팩의 문장 목록)에서 단원·집 짓기 문장을 읽어 온다
try:
    _man = json.load(open(os.path.join(REF, 'voice-manifest.json'), encoding='utf-8'))
    APPKEYS = []
    for f in _man['files']:
        if '.char.' in f['u']: continue
        APPKEYS += list(json.load(open(os.path.join(REF, f['u']), encoding='utf-8'))['voices'].keys())
except Exception:
    APPKEYS = []
APP['adventure'] += [k for k in APPKEYS if re.match(r'^오늘은 .+에서 모험할 거야\.$', k)]
POOLS['builddone'] = {'dog': [], 'cat': ['우와, 집이 이렇게 예뻐졌어!']}
APP['builddone'] = [k for k in APPKEYS if k.endswith('다 지어졌어!')]
POOLS['grow'] = {'dog': ['레벨 업! 나 조금 더 커졌어!', '와, 내가 쑥 컸어! %s 덕분이야!' % CHILD], 'cat': ['레벨이 올랐어! 나 조금 더 컸지.']}

def add(app_texts, name, fixed=None):
    d = [k for k in (need('dog', t) for t in POOLS[name]['dog']) if k]
    c = [k for k in (need('cat', t) for t in POOLS[name]['cat']) if k]
    for t in app_texts:
        if t in pool: continue            # 먼저 적힌 묶음이 이긴다
        e = {}
        if d: e['d'] = d
        if c: e['c'] = c
        if fixed: e['f'] = fixed
        if e: pool[t] = e

for name, texts in APP.items(): add(texts, name)

# 성장·어른 말: 강아지 이름이면 강아지, 고양이 이름이면 고양이 목소리로 고정
d_grow = [k for k in (need('dog', t) for t in POOLS['grow']['dog']) if k]
c_grow = [k for k in (need('cat', t) for t in POOLS['grow']['cat']) if k]
for t in GROW_APP['dog']:
    if d_grow: pool[t] = {'d': d_grow, 'f': 'd'}
for t in GROW_APP['cat']:
    if c_grow: pool[t] = {'c': c_grow, 'f': 'c'}
def dressText(n):
    m = call(n)                                   # pets.ts의 reul(call(name))과 같은 규칙: 구름 → 구름이를
    return m + ('을' if has_batchim(m) else '를') + ' 꾸며 줘!'
# 고양이 이름의 "꾸며 줘!"는 고양이 목소리로 ("예쁜 옷으로 꾸며 줄까")
dress = need('cat', '예쁜 옷으로 꾸며 줄까')
for sp, n in PETS:
    if sp == 'cat' and dress:
        pool[dressText(n)] = {'c': [dress], 'f': 'c'}

# ---------------- 글자 이름·예시 낱말 ----------------
jamo_ts = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'jamo.ts'), encoding='utf-8').read()
JM = re.findall(r"\['(.)', '(c|v)', '([^']+)', '[^']*', '[^']*', '[^']*', '[^']*'\]", jamo_ts)
EMOJI = {'거울': '🪞', '나비': '🦋', '다람쥐': '🐿️', '리본': '🎀', '무지개': '🌈', '바나나': '🍌', '사과': '🍎', '치즈': '🧀', '코끼리': '🐘', '토끼': '🐰', '포도': '🍇', '하마': '🦛',
         '야구': '⚾', '어머니': '👩', '여우': '🦊', '오리': '🦆', '요리': '🍳', '우유': '🥛', '유리': '🪟', '으르렁': '🐯', '이불': '🛏️',
         '거미': '🕷️', '노래': '🎵', '동굴': '🕳️', '모자': '👒', '바다': '🌊', '사랑': '❤️', '야옹': '🐱', '자두': '🍑', '치카': '🪥', '코피': '🩸', '토이': '🧸', '파도': '🌊', '하품': '🥱',
         '아빠': '👨', '야수': '🦁', '어부': '🎣', '여자': '👩', '요술': '🪄', '우산': '☂️', '이빨': '🦷', '애벌레': '🐛', '얘들아': '🧒', '에어컨': '❄️', '예쁜 꽃': '🌸', '와플': '🧇',
         '왜가리': '🦢', '외투': '🧥', '원숭이': '🐒', '웨딩드레스': '👰', '위아래': '↕️', '의자': '🪑', '까치': '🐦', '딸기': '🍓', '뽀뽀': '😘', '쌀': '🍚', '짝꿍': '👫'}
# 아이·가족 이름이 낱말인 예시는 공개 저장소에 이름이 남지 않게 EMOJI에 없는 채로 두어 뺀다
SKIP_EX = []
byname = {n: ch for ch, k, n in JM}
ex = {'d': {}, 'c': {}}
namepool = {}
for who, tag in (('dog', 'd'), ('cat', 'c')):
    for t, p in clips[who].values():
        m = re.match(r'^(.+?)[.!?]\s*(.+)의 \1[.!?]*$', t)
        if m and m.group(1) in byname:
            w = m.group(2)
            if w not in EMOJI: SKIP_EX.append((who, m.group(1), w)); continue
            ex[tag][byname[m.group(1)]] = {'w': w, 'e': EMOJI[w], 'k': need(who, t)}
    for ch, kind, n in JM:
        k = need2 = None
        h = clips[who].get(norm(n))
        if h: namepool.setdefault(n, {})[tag] = [need(who, h[0])]
# "이건 기역이야." / "이 글자는 아라고 읽어." → 글자 이름만 또렷이 (이름 녹음)
def has_b(w):
    c = ord(w[-1]) - 0xAC00
    return 0 <= c < 11172 and c % 28 != 0
for ch, kind, n in JM:
    t = f'이건 {n}{"이야" if has_b(n) else "야"}.' if kind == 'c' else f'이 글자는 {n}{"이라고" if has_b(n) else "라고"} 읽어.'
    if n in namepool and t not in pool: pool[t] = dict(namepool[n])

for name, texts in APP.items():
    for t in texts:
        report.append((name, t, len(pool.get(t, {}).get('d', [])), len(pool.get(t, {}).get('c', []))))

blob = json.dumps({'voices': voices, 'pool': pool, 'ex': ex}, ensure_ascii=False, separators=(',', ':'))
h = hashlib.sha1(blob.encode()).hexdigest()[:10]
fn = f'voice.{h}.char.json'
open(os.path.join(OUT, fn), 'w', encoding='utf-8').write(blob)

mp = os.path.join(OUT, 'voice-manifest.json')
man = json.load(open(mp, encoding='utf-8'))
man['files'] = [f for f in man['files'] if not re.match(r'voice\.[0-9a-f]+\.char\.json$', f['u'])]
for f in glob.glob(os.path.join(OUT, 'voice.*.char.json')):
    if os.path.basename(f) != fn: os.remove(f)           # 예전 캐릭터 음성 조각 정리
man['files'].append({'u': fn, 'b': len(blob.encode())})
man['v'] = max(7, man.get('v', 5))
man['char'] = {'dog': '유라', 'cat': '명쾌한', 'clips': len(voices), 'pool': len(pool), 'ex': {'d': len(ex['d']), 'c': len(ex['c'])}}
open(mp, 'w', encoding='utf-8').write(json.dumps(man, ensure_ascii=False, separators=(',', ':')))
shutil.rmtree(tmp, ignore_errors=True)

print('조각', fn, round(len(blob) / 1e6, 2), 'MB / 녹음', len(voices), '개 / 연결된 앱 문장', len(pool), '개 / 예시낱말 강아지', len(ex['d']), '고양이', len(ex['c']))
if SKIP_EX: print('예시 낱말에서 뺀 것(이름·이모지 없음):', sorted(set(SKIP_EX)))
if missing:
    print('찾지 못한 녹음 문장(이름 확인):')
    for w, t in sorted(set(missing)): print('  ', w, t)
print('묶음별 연결 요약:')
seen = set()
for name, t, d, c in report:
    if name in seen: continue
    seen.add(name); print(f'  {name}: 앱 문장 {len(APP[name])}개 ← 강아지 {d}개 · 고양이 {c}개')
