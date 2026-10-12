# COLLAB.md — 「한글나라」 업그레이드 공동 작업 규칙 (GPT · Claude 공용)

이 저장소는 ChatGPT(Codex 앱, 이하 GPT)와 Claude가 번갈아 고친다.
작업 전 읽는 순서: AGENTS.md → COLLAB.md(이 파일) → HANDOFF.md(작업판).
우선순위: 사용자가 그때 준 지시 > COLLAB.md > AGENTS.md.

---

## 1. 목표와 전제

- 지금 앱(옛 이름 「뭉치와 냥이의 글자 모험」, Preact + TypeScript + Vite, GitHub Pages 설치형 웹앱)의 코드를 이어서 고쳐 「한글나라」로 업그레이드한다.
  새 앱을 따로 만들지 않는다. 따로 만들면 아이 진도·녹음·두 기기 연동·자동 업데이트가 모두 끊긴다.
- 바꾸는 것: 그림체(지브리풍 손그림 수채), 캐릭터 2D 부품 애니메이션, 꾸미기·간식·집 안·마당(새)·놀이터 확장, 배경.
- 그대로 두는 것: 학습 흐름(배운 글자만 출제, 받아쓰기·복습 시험, 놀이에서 틀리면 받은 것 하나 돌려받기), 진도, 녹음 대사.
  학습 규칙을 바꾸는 일은 사용자가 Claude나 GPT에게 직접 말했을 때만 한다(다른 쪽 AI의 판단으로 바꾸지 않는다).
- 사용자는 코딩을 모른다. 되돌릴 수 없는 일만 묻고 나머지는 이 규칙의 기본값으로 진행한다. 설명은 한국어로 짧게.

## 2. 작업 위치와 배포

- 작업 폴더: 사용자 컴퓨터의 바탕화면 hangul\integrated-app (이 저장소의 로컬 복사본, source/의 위). 두 AI가 같은 폴더를 쓴다.
  GPT는 Codex 앱에서 이 폴더를 '로컬'로 열고 main에서 작업한다(워크트리·클라우드·새 브랜치 X — 서로의 결과가 안 보인다).
- GitHub main = 배포본. main에 source/ 또는 art/ 변경이 들어가면 GitHub Actions가
  npm run check → 빌드 → 맨 위 index.html·sw.js·manifest.webmanifest 갱신 → 사이트 반영(2~3분).
  check가 실패하면 사이트는 이전 버전 그대로다.
- 사이트(바꾸지 않음): https://gunyang840715-netizen.github.io/hangul-adventure/
- 기기는 앱을 다시 열 때 새 버전을 받는다(첫 화면은 인터넷 우선 3초, 안 되면 저장본).
- git·커밋·push는 Claude만 한다. GPT는 파일만 저장한다(HANDOFF.md 편집 포함). Claude가 차례 시작 때 GPT의 HANDOFF 변경을 커밋한다.

## 3. 역할 분담 (기본값)

| 일 | GPT | Claude |
|---|---|---|
| 이미지 생성·편집 (기준표, 캐릭터, 아이템, 간식, 가구, 마당·놀이터 기구, 배경, 집 짓기, 낱말 그림) | 담당 | 하지 않음 (이미지 생성 기능 없음) |
| 주문서 작성 (무엇을 몇 개, id·이름·크기) | 의견 | 담당 |
| 그림 후처리 (자르기·배경 지우기·크기·WebP·해시·artmap·manifest) | — | 담당 |
| 앱 코드 (source/ 전부), 검사·화면 확인, 커밋·push·Actions 확인 | 하지 않음 | 담당 |
| 교차 검토 | Claude 미리보기의 그림체·어색함 지적 | GPT 그림 규격 검사, 다시 그릴 목록 |

- 같은 코드를 두 AI가 번갈아 고치면 충돌과 되돌림이 생긴다. 코드는 Claude 한 명이 책임진다.
- 한쪽이 한도·장애로 오래 못 하면, 사용자가 "대신 해"라고 할 때만 상대 역할을 넘겨받는다(같은 규칙, HANDOFF에 기록).

## 4. 번갈아 하기 — 작업판 HANDOFF.md

1. 시작: HANDOFF.md를 읽는다. '작업 중' 줄에 상대가 적혀 있으면 기다린다.
   (예외: GPT는 Claude가 작업 중이어도 art-src/ 안에서 다음 묶음 그림을 그릴 수 있다. 결과는 art-src/<묶음>/납품.md에만 적는다.)
   비어 있으면 '작업 중: GPT(또는 Claude) · 시각 · 하는 일'을 적는다. 같은 폴더라 저장하면 상대에게 보인다.
2. '다음 할 일'에서 자기 표시([GPT]/[Claude])가 붙은 가장 위 항목을 한다.
3. 끝: HANDOFF 갱신(한 일 / 다음 할 일과 담당 / 다시 그릴 것 / 주의) → '작업 중' 비우기.
   Claude는 이어서 검사 → 커밋(메시지는 한국어 한 줄, 앞에 [Claude], GPT 몫은 [GPT]) → push → Actions 확인.
4. 중간에 멈출 때(한도 등): 지금까지 저장하고 HANDOFF '진행 중 변경'에 무엇이 남았는지 적는다. Claude는 검사를 통과한 것만 커밋한다.
5. HANDOFF.md는 공개 저장소에 올라간다. 실명·연동 정보·개인 경로를 쓰지 않는다.

## 5. 진도·연동 보호 — 절대 규칙

1. 바꾸지 않음: 사이트 주소, manifest의 id('./')·start_url·scope, 저장 키(hangul-adventure-v2, hangul-device, hangul-sync-code, hangul-sync-url),
   IndexedDB 'hangul-voice', engine/store.ts의 State 구조, shared/merge.js, data/curriculum.ts, scripts/build_char_voice.py, backend/.
2. source/src/engine/ 안에서는 audio.ts(음량·녹음 묶음)와 gifts.ts(간식 가중치)만 고친다.
3. id는 지우거나 바꾸지 않고 뒤에 추가만 한다: 친구(PETS), 아이템(ITEM_LIST), 간식(SNACKS), 가구(FURN), 자리(ROOM_SLOTS·PARK_SLOTS),
   장소(doghouse·cathouse·park), 집 짓기 부품 key와 순서(BUILDS). scripts/id_keep_check.mts가 scripts/ids_baseline.json과 대조해 막는다.
   자리의 위치·크기(x·y·w·h)는 새 배경에 맞게 옮겨도 된다(저장에 영향 없음).
4. 새 저장 칸을 만들지 않는다. 마당은 기존 deco·decoT·bought(setDeco·buyFurn)로 장소 'doghouse-out'·'cathouse-out'에 저장하고,
   집 색깔도 마당의 한 자리('y-color')로 저장한다. (확인함: 기존 merge.js로 새 장소·아이템·간식·가구를 합치는 시험 통과, 합치는 순서와 무관)
5. 같은 slot + for(dog/cat/both) 조합의 아이템은 20개 이하(id_keep_check가 확인). 받는 순서(DROP_ORDER)의 반복 상한 문제는 고쳤다.
6. 맨 위 index.html·sw.js·manifest.webmanifest는 직접 고치지 않는다(Actions가 만든다). 아이콘 파일·기존 voice.*.json 수정 금지.
   voice-manifest.json은 새 녹음 조각을 files 끝에 추가할 때만 고친다.
7. export된 컴포넌트 이름·props 유지: Pet, Hat, Glasses, Neck, Clothes, Shoes, Toy, ItemIcon, SnackIcon, FurnArt, BuildArt, MatIcon, Backdrop, LibraryBack 등.
   Motion(bob, jump, cheer, wiggle, none, fly, hop)·Mood(happy, wow, think, sleep, love) 이름 유지.
8. data/voice.ts는 기존 문장을 바꾸거나 지우지 않는다. 새 문장은 맨 아래 상수로 추가하고 allLines()에 넣는다.
   (새 녹음을 연결하면 scripts/voice_pool_check가 allLines에 있는 문장인지 검사한다)
9. 공개 저장소: 아이·가족 실명, 연동 코드, 서버 주소(script.google.com/...), 메일, API 키, 컴퓨터 사용자 이름이 든 경로, 사진 원본을
   코드·파일 이름·커밋 메시지·그림·HANDOFF 어디에도 넣지 않는다.
10. 올리지 않는 폴더(맨 위 .gitignore): art-src/(GPT 원본 그림·참고 사진·주문서), review/(Claude 미리보기·목록·검사 결과).
11. 업데이트가 늦은 기기가 새 아이템·가구 id를 받아도 지금 코드는 빈 그림으로 넘어가고 멈추지 않는다(확인함). 모르는 id에서 오류가 나게 바꾸지 않는다.

## 6. 이름 (반영함)

- 홈 화면 아이콘·manifest: 「한글나라」. id·아이콘 파일 이름은 그대로.
  설치된 아이콘 이름은 Chrome이 늦게 바꾸거나 확인 창을 띄울 수 있다. 앱을 지우고 다시 설치하라고 안내하지 않는다.
- 첫 화면 제목: 기기에 저장된 이름이 있고 '친구'가 아니면 「{이름} 한글나라」, 아니면 「한글나라」(src/lib/appTitle.ts). 이름은 실행 중에 기기 저장값에서만 읽는다.
- 캐릭터 이름(뭉치·초코·식빵·보리·콩이·냥이·구름·라떼·모찌·솜사탕), 품종 이름, 단원 이름, 대사 문장은 그대로(녹음돼 있음).

## 7. 그림 공통 규격 (GPT)

### 7-1 그림체
- 공통 문장 — 모든 이미지 프롬프트 맨 앞에 그대로 붙인다(이미지 모델은 영어를 더 정확히 따른다):
  `Hand-painted watercolor illustration for a children's picture book, warm and cozy, in the spirit of classic Japanese hand-drawn animation: soft warm sunlight from the upper left, gentle soft outlines, delicate watercolor bleeding and paper texture, finely painted grass, leaves and light, clear bright colors. No text, no letters, no numbers, no logos, no watermark.`
- 스타일 기준표 1장(art-src/style/style-guide.png: 색 팔레트, 선, 빛, 질감, 작은 예시)을 먼저 만들고, 이후 모든 생성·편집 때 참고 이미지로 함께 넣는다.
- 실제 지브리 작품의 캐릭터·장면을 따라 그리지 않는다. 그림 안에 글자·숫자·로고 금지. 빛은 항상 왼쪽 위.

### 7-2 배경 지우기용 단색
- 투명 배경이 되면 투명으로. 아니면 물체에 없는 단색 배경: 기본 #00FF00, 초록 물체가 있으면 #FF00FF.
- 단색 배경에는 그림자·번짐·질감을 넣지 않는다. 물체 아래 바닥 그림자도 그리지 않는다(앱이 그린다).

### 7-3 납품 형식
- art-src/<묶음 폴더>/에 PNG로 저장. 파일 이름 = 주문서의 file 값(영문 소문자·숫자·하이픈만, id의 ':'는 '-').
- 시트는 sheet-01.png …와 같은 폴더의 sheet-01.json({"1": "id", "2": "id", …} — 왼쪽 위부터 오른쪽으로, 줄 바꿔 계속).
- 다시 그린 것은 같은 이름에 -v2, -v3을 붙인다(덮어쓰지 않음).
- 묶음마다 art-src/<묶음>/납품.md: 만든 파일, 못 만든 것, 스스로 보기에 어색한 것.

### 7-4 캐릭터 생김새 — 녹음된 소개 대사와 어긋나지 않게
앱이 "말티즈 뭉치야!"처럼 품종을 말하고, 아래 '소개 대사'를 녹음으로 말한다. 그림이 대사와 맞아야 한다.

| id | 이름 | 녹음된 소개 대사 | 그릴 생김새 |
|---|---|---|---|
| maltese | 뭉치 | 하얀 털이 보송보송해! | 작고 복슬복슬한 크림빛 흰 강아지, 동그란 머리, 까만 동그란 눈, 작은 까만 코. 목걸이는 그리지 않음(꾸미기 '목걸이'와 겹침) |
| poodle | 초코 | 털이 뽀글뽀글해! | 붉은 갈색(살구빛) 곱슬털 토이 푸들, 동그랗게 부푼 머리털, 까만 눈·코, 꼬리를 세움 |
| corgi | 식빵 | 귀가 크고 다리가 짧아! | 주황빛 황금색 털, 크림색 주둥이·가슴, 아주 크고 뾰족하게 선 귀(안쪽 밝은 털), 짧은 다리, 동그란 짙은 갈색 눈, 까만 코, 순한 얼굴 |
| shiba | 보리 | 꼬리가 동그랗게 말려 있어! | 살구빛 크림색 복슬복슬한 강아지, 길게 늘어진 귀, 크고 촉촉한 짙은 눈, 갈색 코, 꼬리는 등 위로 동그랗게 말림 |
| schnauzer | 콩이 | 멋진 수염이 있어! | 검정과 황갈색·크림 무늬, 또렷한 파란 눈, 눈썹 무늬, 뾰족한 귀, 주둥이에 복슬한 크림색 수염 |
| koshort | 냥이 | 노란 줄무늬 치즈 고양이야! | 주황 치즈와 흰색, 노란 줄무늬, 연두빛 노란 눈, 분홍 코 |
| russian | 구름 | 회색 털에 초록 눈이야! | 짙은 먹색(회색빛 검정) 털에 흰 가슴·주둥이, 초록 눈 |
| siamese | 라떼 | 얼굴이랑 귀가 갈색이야! | 갈색 줄무늬에 흰 털이 섞인 날씬한 고양이, 얼굴·귀는 진한 갈색, 노란 눈, 줄무늬 긴 꼬리 |
| fold | 모찌 | 귀가 폭 접혀 있어! | 통통한 갈색 줄무늬, 흰 가슴·주둥이, 앞으로 폭 접힌 작은 귀, 동그란 연두빛 노란 눈(놀란 표정), 분홍 발바닥 |
| persian | 솜사탕 | 털이 길고 복슬복슬해! | 길고 복슬복슬한 연한 크림색 아기 고양이, 큰 청록색 눈, 분홍 코와 귀 안쪽 |

- 참고 자료: art-src/참고사진/heads/(지금 앱의 사진 머리 10장), art-src/참고사진/(사용자가 사진\동물에서 복사한 원본 — 있으면).
  사진과 이 표가 다르면 이 표를 따른다(대사와 맞추기 위해).
- 10마리 공통 자세: 정면을 보고 앉은 자세(지금 앱 그림과 같은 구도), 앞발 두 개가 보이고 꼬리는 오른쪽 옆으로.
  머리 크기·발바닥 선·화면 속 위치를 10마리 모두 같게. 엎드린 자세·옆모습은 쓰지 않는다(움직임과 꾸미기 위치가 공통이어야 함).

## 8. 묶음별 주문 — GPT 그림 → Claude 넣기

묶음마다 Claude가 art-src/주문서/<묶음>.json을 먼저 쓴다(id, 이름, 파일 이름, 크기, 메모). GPT는 그 주문대로 그린다.

- 묶음 0 기준: 스타일 기준표 1장 (art-src/style/).
- 묶음 1 캐릭터 (가장 중요, art-src/1-pets/): 마리마다 1024×1024, 사방 여백 8% 이상, 같은 캔버스·같은 위치로 5장.
  - <id>-full.png: 전신 기준 그림
  - <id>-eyes-closed.png: full을 이미지 편집해 눈만 감김(나머지 그대로)
  - <id>-mouth-open.png: full을 이미지 편집해 입만 벌림(나머지 그대로)
  - <id>-body.png: full에서 머리와 꼬리를 지우고, 가려졌던 목·어깨·엉덩이를 자연스럽게 이어 그린 몸통+앞발
  - <id>-tail.png: 꼬리만(뿌리 부분을 몸 안쪽까지 넉넉히)
  편집 결과가 원본과 조금 어긋나도 된다 — Claude가 맞춰 붙인다. 귀 좌우 분리·다리 분리는 1차에서 하지 않는다.
- 묶음 2 꾸미기 아이템 (art-src/2-items/): 주문서대로 4×4 시트(1024×1024 이상, 칸마다 하나, 칸 경계까지 12% 이상 여백).
  아이템만 단독으로(동물 없이), 정면에서 본 모습. 모자·안경은 머리에, 목걸이·옷·신발은 몸에 씌울 것이라 그 방향으로. 옷은 넉넉한 크기로.
- 묶음 3 간식 (art-src/3-snacks/): 4×4 시트.
- 묶음 4 배경 (art-src/4-bg/<장면>/): 장면마다 2560×1600(놀이터는 3840×1200), 같은 구도로
  sky.png(하늘만) / land.png(풍경, 하늘 자리는 단색) / front.png(앞쪽 풀·꽃만, 나머지 단색) / full.png(참고용 전체).
  아래 22%는 캐릭터가 서는 단순한 땅. 기기마다 화면 비율이 달라 위쪽 약 26%와 좌우 끝 약 8%는 잘릴 수 있다 — 중요한 것은 그 안쪽에.
  효과 시트 1장: 구름 3, 꽃잎 3, 나뭇잎 3, 반딧불 1, 빛줄기 1, 물결 1.
- 묶음 5 집 안 (art-src/5-room/): 벽지·바닥재는 이어 붙여도 티 안 나는 무늬 512×512. 가구는 3×3 시트(1536×1536, 칸 512).
- 묶음 6 마당 (art-src/6-yard/): 강아지 마을·고양이 마을 배경(묶음 4 형식), 집 건물 1장(색조 필터로 색을 바꾸므로 밝기·채도가 중간인 기본색), 마당 기구 3×3 시트.
- 묶음 7 놀이터 (art-src/7-park/): 3×3 시트.
- 묶음 8 집 짓기 (art-src/8-build/): 강아지 집·고양이 집·놀이터 각 2장 — complete.png(완성) / base.png(같은 그림에서 바닥·벽·지붕만 남기고 문·창문·이름표·방석·밥그릇·캣타워를 지운 것, 놀이터는 빈 땅). 이름표는 빈 판(이름은 앱이 글자로 쓴다).
- 묶음 9 (선택, 한도가 남을 때) 낱말 그림 (art-src/9-words/): 4×4 시트, 다섯 살이 한눈에 알아보는 물체 하나씩.

이미지 생성은 사용량을 많이 쓴다. 한도에 걸리면 거기까지 저장·기록하고 멈춘다. 여러 날에 나눠 해도 된다.
묶음 1~3은 서로 기다리지 않고 이어서 그려도 된다(주문서가 이미 있음).

## 9. 그림을 앱에 넣는 구조 (Claude — 이미 만들어 둠)

1. 공개 파일: art/<그룹>/<이름>.<내용해시 8자리>.webp (해시 = 파일 내용 sha256 앞 8자리). 내용이 바뀌면 이름이 바뀌어 기기가 새로 받는다.
   그룹·이름은 영문·숫자·하이픈. 그룹별 한 장 상한(scripts/art_check.mts):
   pets 350KB(마리당 부품 합계도 350KB) · items·snacks·words 40KB · furniture·yard·park·effects 70KB · tiles 150KB · builds 500KB ·
   backgrounds 700KB(이름에 .long. 1.2MB, .front. 300KB). art 전체 45MB 이하.
2. art/art-manifest.json: {"files":[{"u":"art/…webp","b":바이트}, …]}
3. source/src/art/artmap.ts: ART_MAP(그림 키 → 'art/…' 경로)와 artSrc(키) → './art/…'.
   - 그림을 import 하지 않는다(한 파일 빌드가 import한 그림을 index.html 안에 data URI로 넣어 버림 — 빌드로 확인함).
   - 그림 키: pet.<id>.head(지금 사진 머리) · pet.<id>.paint-<부품>(새 그림) · item.<slot>.<key> · snack.<id> · furn.<slot>.<key>(집 안·놀이터·마당) ·
     bg.<장면>.<층> · tile.<이름> · fx.<이름> · build.<id>.<complete|base> · word.<번호>
4. 표에 없거나 불러오기 실패 → 지금 그림으로(캐릭터는 새 그림 → 사진 머리 → SVG). 일부만 적용돼도 앱이 깨지지 않는다.
5. 검사(npm run check): art_check(경로·manifest·해시·용량), offline_art_check(서비스워커 설치·재사용·오프라인), id_keep_check.
6. 개발·빌드 때 scripts/sync_art.mjs가 art/를 source/public/art로 복사한다(npm run dev/build 앞에 자동).
7. 서비스워커는 지금 설치 때 art-manifest의 그림을 모두 받는다(이미 받은 같은 해시는 재사용, 하나라도 실패하면 설치를 미루고 이전 버전 유지).
   그림이 커지기 전(묶음 4 배경 전)에 Claude가 '첫 화면 그림만 설치 때, 나머지는 앱이 켜진 뒤'로 바꾼다.
8. 후처리: 단색 배경 지우기 후 가장자리 색 번짐(초록·분홍 테두리) 제거, 알파 다듬기, WebP(투명 유지).

## 10. 기능 범위 (Claude)

- A. 캐릭터 (art/Pet.tsx, 새 art/petrig.ts)
  - 부품: 몸통(앞발 포함)·머리(귀 포함)·꼬리·눈 감은 덮개·벌린 입 덮개.
  - 리그: 부품 위치, 회전 기준점(목·꼬리 뿌리), 눈 위치, 꾸미기 기준점(머리 위·두 눈·목·가슴·등·앞발 2).
  - 움직임(CSS transform, ease-in-out, 부위마다 조금 늦게 따라오는 겹침): 숨쉬기(3.5초, 1~2%, 머리는 0.1초 늦게), 눈 깜빡임(2.5~6초 무작위, 0.12초),
    꼬리(강아지는 빠르게 좌우, 고양이는 느린 S자), 고개 갸웃(들을 때), 말할 때 입(onSpeaking), 점프(웅크림→도약→착지 때 살짝 찌그러짐→복귀),
    기쁨(제자리 깡충, 꼬리 빠르게), 잠(느린 숨, 눈 감음, z), 사랑(하트). 기존 Motion·Mood에 연결. 기기의 '움직임 줄이기'면 줄인다.
  - 성장: 기존 growthOf()로 아기일수록 머리 크게·몸 작게.
  - 검사: 사방 4% 여백, 잘린 곳 없음, 7-4 표와 털색·특징 일치. 마리마다 동작 미리보기 GIF(숨쉬기·깜빡임·꼬리·점프)를 review/에.
- B. 꾸미기 아이템 (data/pets.ts ITEM_LIST, Pet.tsx 아이템 그림): 48 → 약 100 (모자 20, 옷 18, 안경 12, 목걸이 16, 신발 12, 장난감 22).
  기존 id 뒤에 추가만. 아이템은 리그 기준점에 붙어 부품과 같이 움직인다(모자·안경=머리, 목걸이·옷=몸통, 신발=앞발). 마리별 보정값.
  미리보기: 마리마다 슬롯별로 하나씩 입힌 모습 한 장.
- C. 간식 (data/pets.ts SNACKS, Pet.tsx SnackIcon, engine/gifts.ts SNACK_WEIGHT): 6 → 약 20(강아지용·고양이용·같이 골고루), points 1~3, 새 간식은 SNACK_WEIGHT에도.
- D. 집 안 (data/home.ts ROOM_SLOTS·FURN, art/Home.tsx FurnArt, screens/Home.tsx): 자리 10 → 16(바닥재·선반·시계·천장 모빌·쿠션·벽 장식 등), 자리마다 6~8개.
- E. 마당 (새 기능): 장소 'doghouse-out'·'cathouse-out'.
  - 입구: screens/Build.tsx(집 짓기 화면)의 완성된 집에서 '집 안으로' 옆에 '마당 꾸미기'. 집을 다 지어야 열린다.
  - 화면은 screens/Home.tsx에 추가. 자리 12개(울타리·우체통·화단·정원 길·등불·나무·깃발 줄·벤치·그네·연못·문 장식·창가 화분) + 집 색 자리 'y-color'.
  - 마당 자리 id와 가구 id는 'y-'로 시작(screens/Home.tsx의 placed()가 집 장소에 기본 벽지·창문을 채우는 규칙과 겹치지 않게).
  - 자리마다 5~6개, 강아지·고양이 마당이 같은 목록. 값은 재료 1개(집 색은 기본 1개 free, 나머지 재료 1개).
  - 꾸민 마당은 집 짓기 화면의 완성된 집 주변에도 보인다. 안내 말은 이미 녹음된 '가구를 눌러서 예쁘게 꾸며 봐!'를 쓴다.
- F. 놀이터 (data/home.ts PARK_SLOTS·FURN(park), screens/Home.tsx ParkScreen): 자리 10 → 14, 자리마다 5개.
- G. 배경: 첫 화면, art/Scene.tsx Backdrop(meadow·river·sky·night·castle·cave·beach), art/Library.tsx(library), 집 안·마당·놀이터, 그림 목록에서 찾은 나머지.
  - 무대가 기기에 따라 1280×800(태블릿)~최대 2200×800(가로로 긴 폰)~1280×1150까지 변한다 → cover + 아래 기준 정렬.
  - 하늘·풍경·앞 층으로 깊이감. 구름 흐름·풀 흔들림·꽃잎·반딧불(밤) 같은 은은한 움직임(동시에 25개 이하). 말풍선·버튼 자리는 단순하게.
- H. 집 짓기 (data/pets.ts BUILDS, art/Build.tsx BuildArt·MatIcon): 바닥·벽·지붕은 base 그림을 아래에서 위로,
  문·창문·이름표·방석·밥그릇(캣타워)은 complete 그림의 그 부분을 하나씩 얹는다('○○을 만들었어!' 대사와 그림이 맞게). 이름표의 친구 이름은 글자로.
- I. (선택) 낱말 그림: data/curriculum.ts WORDS(159개)·data/jamo.ts ex(40개)의 이모지를 그림으로. 그림이 없으면 이모지 그대로.

## 11. 소리 (반영함 — engine/audio.ts)

- 녹음을 처음 풀 때 크기를 잰다: 20ms마다 RMS, 가장 큰 구간보다 30dB 안쪽(말소리)만 평균 → 목표 −17dBFS 배율(0.5~30배, 피크 −1dBFS 이하).
  음성 출력 끝에 리미터(threshold −3, knee 0, ratio 20, attack 0.002, release 0.15).
- 말소리 평균이 −50dBFS보다 작은 녹음은 쓰지 않는다 → 같은 묶음의 다른 녹음 → 없으면 기존 음성팩.
  지금 해당: 강아지 녹음 7개(모든 문장에 다른 녹음이 남음). 글자 예시 낱말 ㅣ·ㅚ(강아지)는 기존 예시 낱말로 바뀐다.
- 실제 녹음 699개로 확인: 보정 후 말소리 크기 강아지·고양이·기존 음성 모두 −17dBFS(가장 작은 것 −20.4).
- 녹음 키(dog::…)를 기기 음성이 글자로 읽지 않게 막음. 녹음 묶음이 여러 조각이면 같은 문장의 녹음을 이어 붙인다.
- 해야 할 것(묶음 2부터): 새 이름(아이템·간식·가구·마당)은 녹음이 없다. hasClip일 때만 말하고, 아니면 games/common.tsx PRAISE 중 하나를 말하고
  이름은 화면 글자로만. 새 문장 목록은 review/녹음_필요_문장.txt(문장 | 상황 | 강아지·고양이).
- 기존 voice.*.json은 수정하지 않는다.

새 녹음 넣기 — 사용자가 mp3를 줄 때만:
- 파일 이름 규칙: 강아지 "유라-기쁨-날짜-문장.mp3", 고양이 "명쾌한-한국어-여성-날짜-문장.mp3". 파일 이름의 문장으로 내용을 안다.
- 새 조각 voice.<내용해시>.char2.json({"voices":{키: base64}, "pool":{앱 문장: {d:[키], c:[키]}}})을 저장소 맨 위에 추가하고
  voice-manifest.json의 files 끝에 추가한다. mp3를 그대로 base64로 넣어도 재생된다.
- 키는 'dog::' 또는 'cat::' + 해시(키에 아이 이름이 남지 않게). 아이 이름이 든 문장은 묶음에 '{이름}'으로 적는다.
- 앱 문장과 연결할 때는 scripts/build_char_voice.py의 SITU 묶음 규칙을 따른다. 연결하는 앱 문장은 allLines()에 있어야 한다(5-8).

## 12. 검사·배포 (Claude)

- source에서 npm ci(처음 한 번) → npm run check → npm run build → python3 scripts/build_pwa.py(임시 폴더로).
- 화면 확인: 사이트와 같은 하위 경로(/hangul-adventure/)로 띄워 실제 크롬으로 첫 화면·지도·집·집 안·놀이터·놀이 1개를 열고 콘솔 오류 0.
  (check는 타입·규칙만 보고 실행 중 오류는 못 잡는다)
- 커밋 순서: art/ 먼저, 그다음 source/. push 후 Actions 결과를 확인하고 실패면 고쳐서 다시.
- 묶음마다 미리보기 1장(캐릭터는 GIF)을 대화에 보여 준다.
- 되돌리기는 git revert로(기록 지우기·강제 push 금지).

## 13. 진행 순서

- 0단계 (끝남, 2026-10-12): 이름 바꾸기, 그림 구조(artmap·art_check·서비스워커·개발 서버), 사진 머리를 index.html 밖 art/로, 음량 고르게,
  아이템 받는 순서 상한, id 보호 검사, 공동 작업 파일. (GPT가 Codex에서 만든 커밋 2개를 Claude가 검토·보정해 반영)
- 0단계 (GPT): 스타일 기준표.
- 묶음 순서: 1 캐릭터 → 2 꾸미기 → 3 간식 → 4 배경 → 5 집 안 → 6 마당 → 7 놀이터 → 8 집 짓기 → 9 낱말(선택)
- 묶음마다: [Claude] 주문서 → [GPT] 그림 납품 → [Claude] 규격 검사(불합격은 HANDOFF '다시 그릴 것' → GPT)
  → 넣기·코드 → 검사·화면 확인 → push → 다음 묶음.

## 14. 보고 (각 차례 끝, 한국어로 짧게)

- 한 일 / 바뀐 파일 수 / 그림 수·용량 / check·build 결과(안 했으면 '미실행') / push·Actions 결과 / 다음 담당·할 일 / 사용자가 할 일(있을 때만).
- 배포가 있었으면: "태블릿·폰에서 인터넷 연결한 채로 앱을 두세 번 껐다 켜기, 부모 설정 '앱 버전' 날짜 확인".
