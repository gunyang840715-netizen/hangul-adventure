# AGENTS.md — 이 저장소를 고치는 AI(ChatGPT · Codex 등)를 위한 안내

> **⓪ 매번 첫 명령 (사용자가 말하지 않아도): `node ../_collab/collab.mjs status`** — 이미 배포된 일·상대가 잡은 작업(🔒)·폴더가 뒤처졌는지 확인.
> 같은 일이 이미 배포됐으면 다시 하지 않는다. 작업 잡기 `start`, 끝 `done`, push 전 `guard`(로컬 push는 훅이 자동 실행). 자세한 순서: 바탕화면 hangul 폴더의 `AGENTS.md`.
> 그 폴더가 없는 곳(클라우드 복사본 등)이면 대신 `git fetch origin && git log --oneline -15 origin/main`으로 최근 배포를 확인한 뒤 시작한다.

> **GPT·Claude 공동 작업 중 (2026-10-12~): 작업 전에 반드시 `COLLAB.md`(공동 규칙)와 `HANDOFF.md`(작업판)를 읽는다.**
> 이 파일과 COLLAB.md가 다르면 COLLAB.md를 따른다. 그림은 GPT, 코드·검사·배포는 Claude가 기본으로 맡고, 사용자가 허락하면 GPT도 배포한다 — 그때는 아래 '같이 배포하기'를 지킨다.

유치원생 아이의 한글 학습 앱 「한글나라」(옛 이름 「뭉치와 냥이의 글자 모험」)입니다.
GitHub Pages로 바로 공개되는 **공개 저장소**이고, 태블릿에서 앱(PWA)으로 설치해 씁니다.

## 같이 배포하기 — GPT·Claude 둘 다 main에 올릴 때 (2026-10-17 사용자 결정)

올리는 방법(git·GitHub 연결 도구)과 상관없이 둘 다 지킨다. 목적: 상대가 넣은 것을 모르고 지우지 않기.

1. **올리기 직전에 원격 main을 다시 받는다.** 내가 받은 뒤 바뀐 파일은 그 최신본 위에 내 변경을 다시 얹는다.
2. **고친 파일만, 고친 줄만 올린다.** 올리는 내용 = 원격 최신본 + 내가 바꾼 줄. 내 사본을 통째로 올리지 않는다.
   둘이 같이 쓰는 파일은 특히: `art/art-manifest.json` · `source/src/art/artmap.ts` · `source/src/data/*.ts` · `*.gen.ts`
3. **올린 뒤 그 커밋의 diff를 본다.** 내가 바꾼 줄만 있어야 한다. 남의 줄이 빠졌으면 바로 되살린다.
   diff가 파일 전체면 줄바꿈이 바뀐 것 — 원격 최신본과 같은 줄바꿈(대부분 LF)으로 다시 올린다. 윈도우 폴더의 CRLF를 그대로 올리지 않는다.
4. **그림은 지우지 않는다.** 바꿀 때는 새 해시 파일을 더하고 artmap만 새 파일로. 예전 파일·manifest 항목은 남긴다.
5. **자동 생성 파일(`*.gen.ts`)은 손으로 고치지 않고 원격 최신 스크립트로 다시 만든다.** 옛 스크립트로 만들면 상대가 더한 것이 빠진다.
6. **같은 기능을 동시에 고치지 않는다.** 상대가 최근 2시간 안에 커밋한 기능·파일은 그 커밋을 먼저 읽고, 같은 일이면 다음으로 미룬다.
   지금 기본: 착용(`wearable*`·`*.paint-wear-*`) 등 GPT가 시작한 개선은 GPT, 사용자가 Claude에게 시킨 일은 Claude.
7. **검사·결과 확인.** 올리기 전 `npm run check`(가능하면), 올린 뒤 Actions 결과(2~3분) 확인. 실패하면 올린 쪽이 바로 고치거나 `git revert`.
   main이 실패 상태면 고치는 커밋 말고는 올리지 않는다. '올리기' 단계만 실패했으면(거의 동시에 올림) Actions를 다시 실행한다. 강제 push·기록 지우기 금지.
8. **Claude가 사용자 폴더를 main에 맞출 때**: 폴더 파일이 main 직전 판과 같을 때만 바꾼다. 다르면 GPT가 고치는 중 — 두고 HANDOFF에 적는다. `git clean` 금지.
9. **기록**: 배포마다 한 줄 — Claude는 HANDOFF.md 기록, GPT는 `source/UPGRADE_STATUS.md`. COLLAB 5장(진도·연동 보호)·공개 저장소 규칙은 그대로.

## 구조

| 위치 | 내용 | 고쳐도 되나 |
|---|---|---|
| `source/` | 앱 소스 (Preact + TypeScript + Vite, 한 파일로 빌드) | **코드는 여기서만** |
| 맨 위 `art/` | 그림 (WebP, 이름에 내용 해시 · 목록 `art/art-manifest.json`, 경로표 `source/src/art/artmap.ts`) | 그림을 넣을 때만 (COLLAB.md 9장) |
| 맨 위 `COLLAB.md` · `HANDOFF.md` · `프롬프트/` | GPT·Claude 공동 규칙 · 작업판(Claude가 관리, GPT는 읽기만) · 시작 문구 | Claude만 |
| 맨 위 `index.html` · `sw.js` · `manifest.webmanifest` | 자동 빌드 결과물 | ✗ (Actions가 다시 만듦) |
| 맨 위 `voice-manifest.json` · `voice.*.json` | 녹음 음성팩 | ✗ |
| 맨 위 `icon-*.png` · `apple-touch-icon.png` | 앱 아이콘 | 필요할 때만 |
| 맨 위 `voice.<해시>.char.json` | 캐릭터 목소리(강아지 유라 · 고양이 명쾌한) 녹음 + 앱 문장 연결표(`pool`) | ✗ (`scripts/build_char_voice.py`로 다시 만듦) |
| `.github/workflows/build.yml` | main에 `source/`·`art/` 변경이 들어오면 검사 → 빌드 → 맨 위 파일 갱신 → 사이트 반영 | 필요할 때만 |

`source/` 안:

- `src/engine/session.ts` — 레슨 구성 (새 글자 40번 쓰기: 10번×4세트, 마지막 10번은 그림자 없이 / 세트마다 놀이 / 끝에 받아쓰기 시험)
- `src/engine/store.ts` — 저장 · 진도 · 보상(간식·꾸미기·재료) · 틀리면 돌려받기 · 시험 통과/복습 상태
- `src/data/` — 커리큘럼(`curriculum.ts`) · 자모(`jamo.ts`) · 말하는 문장(`voice.ts`) · 집 안/놀이터 꾸미기(`home.ts`) · 강아지/고양이(`pets.ts`)
- `src/games/` — 놀이 화면(받아쓰기 `Dictation.tsx`, 쓰기 `Trace.tsx` 등), `src/screens/` — 지도 · 집 짓기 · 집 안 · 놀이터 · 부모 설정(`Extras.tsx`)
- `src/art/` — 그림(SVG 코드), `src/App.tsx` — 화면 전환 · 시험 통과/불합격 처리
- **수학 모드 (초등 2학년 아이용, 10-23~ — 한글 모드와 따로)**: `src/math/mathData.ts`(저장 모양·항목 4개·12단계·문제와 보기·문제 시간) · `src/math/mathStore.ts`(기록·수학 집) ·
  `src/screens/MathHome.tsx`(항목 고르기) · `src/screens/MathScreen.tsx`(하루 50문제 객관식·시간 막대) · `src/screens/MathCloset.tsx`(수학 옷장) ·
  수학 집은 한글과 같은 `Build.tsx`·`Home.tsx`를 `src/screens/homeApi.ts`의 `MATH_HOME`으로 · 첫 화면 '✏️ 수학' 버튼 · 부모 설정 '수학' · 검사 `scripts/math_check.mts`
- `shared/merge.js` — 두 기기 진도 합치기 규칙 (구글 Apps Script 서버와 같이 씀)
- `scripts/` — 검사 스크립트, PWA 파일 만들기(`build_pwa.py`)
- `backend/Code.template.gs` — 서버(구글 Apps Script) 원본. **자동 배포되지 않음** (사람이 Apps Script 편집기에 붙여 넣어야 함)

## 캐릭터 목소리 (강아지 유라 · 고양이 명쾌한)

- 칭찬·다시 하기·인사·모험 시작·하루 마무리·성장 말에 더해, 따라 쓰기·소리 듣기·방울·두더지·짝 맞추기·선물·복습/받아쓰기 안내 같은 **상황 말**도
  아이가 고른 대표 친구(`lead`)의 목소리로 나온다. 앱이 같은 문장을 말해도 녹음 묶음(pool)에서 돌아가며 골라 말하고, 연달아 같은 녹음은 피한다. (`engine/audio.ts`의 `poolKey`)
- 글자 소개 화면: "이건 기역이야." 자리는 글자 이름 녹음, 예시 낱말은 그 친구가 말하는 "기역. 거울의 기역." 녹음과 낱말·그림으로 바뀐다 (`petEx`, 팩의 `ex`). 친구마다 예시 낱말이 다르다.
- 대표 친구의 녹음이 없는 문장은 기존 음성팩(SunHi · YuJin)으로 말한다. 글자 소리·낱말·음절·글자 이름이 들어간 문제 문장·아이템 이름은 기존 음성 그대로.
- 아이·가족 이름이 낱말인 예시(녹음에 들어 있는 경우)는 공개 저장소 규칙(6) 때문에 팩에 넣지 않는다. 이름이 들어간 앱 문장은 묶음에 `{이름}`으로 적고(`poolEntry`가 실행할 때 맞춤), 녹음 키는 글자 대신 해시.
- 새 녹음을 넣으려면: mp3 폴더들(파일 이름 `유라-기쁨-날짜-문장.mp3` / `명쾌한-한국어-여성-날짜-문장.mp3`) →
  `CHILD_NAME=<아이 이름> python3 source/scripts/build_char_voice.py '<폴더1>|<폴더2>' .` 실행. 새 문장을 상황에 붙이려면 스크립트의 `SITU`(앱 문장 `app` ↔ 녹음 문장 `dog`/`cat`)에 추가한 뒤 다시 실행.
- `npm run check`의 `voice_pool_check`(연결 문장·녹음 존재)와 `voice_route_test`(대표 친구에 따라 목소리가 맞게 나오는지)가 통과해야 한다.

## 작업 방법

```bash
cd source
npm ci          # 처음 한 번
npm run check   # 타입 검사 + 안 배운 글자 검사 + 이어하기 검사 + 합치기 규칙 검사 → 반드시 통과
npm run build   # dist/index.html 이 생기면 성공
```

- 코드 변경은 `source/` 안에서만 합니다(그림은 맨 위 `art/` — COLLAB.md 9장). `source/dist/`, `source/node_modules/`, `source/public/art/` 는 커밋하지 않습니다.
- 맨 위 `index.html` · `sw.js` · `manifest.webmanifest` 는 main에 반영되면 GitHub Actions가 다시 만듭니다.
- 화면 확인: `npm run dev` → `http://localhost:5173/?demo=1` (데모 모드: 시간 제한 없음, ⏭ 넘기기 버튼)
  - 바로 열기: `?play=feed&lesson=6`, `?play=dictation&items=ㄱㄴ&mode=review`, `?play=lesson&lesson=0`,
    `?screen=build`, `?screen=room&place=doghouse`, `?screen=park`
  - 개발 서버에서는 녹음 음성팩이 없어서 기기 음성으로 읽습니다 (정상).

## 꼭 지킬 규칙

1. **아직 안 배운 글자는 놀이 · 시험 · 보기에 나오면 안 됩니다.** (`npm run check`의 `learned_check` 가 확인. 실패하면 고치기)
2. 태블릿 가로 화면 기준 크기 1280×800. 아이가 글을 못 읽으므로 안내는 소리로, 버튼은 크게.
3. 말하는 문장은 `src/data/voice.ts` 에 상수로 두고 `allLines()` 에 포함시킵니다.
   녹음이 없는 새 문장은 기기 음성(TTS)으로 읽힙니다 (앱은 정상 동작). 말투는 아이에게 다정한 반말.
4. 저장 데이터(`store.ts` 의 `State`)를 바꾸면 `shared/merge.js` 와 `scripts/merge_test.js` 도 같이 고칩니다.
   예전 저장 데이터와 호환을 지킵니다 (새 칸은 기본값, 예전 칸 이름 바꾸지 않기).
5. 받아쓰기 시험 규칙 유지: 그날 공부 끝 시험에 떨어지면 다음 단계가 안 열림 / 다음날 공부 전 복습 시험에 떨어지면 전 단계를 다시 공부.
   놀이에서 틀리면 받은 보상 하나를 돌려받음(`takeBack`).
6. **공개 저장소입니다.** 아이 실명, 연동 코드, 서버 주소(`script.google.com/macros/...`), API 키, 메일 주소를 절대 넣지 않습니다.
7. UI 글자와 주석은 한국어.
8. **수학 모드(초등 2학년 아이, 10-23 사용자 결정)는 한글 모드와 따로 돈다.** 기록은 `State.math` 한 칸에만(사용자 허락으로 추가한 칸 — 모양은 `src/math/mathData.ts`).
   한글 진도·한글 옷장(`owned`·`wear`)·한글 집(`built`·`bought`·`deco`·`mats`)·하루 사용 시간과 섞지 않는다(수학 화면은 `App.tsx` COUNTED·IDLE에 넣지 않음, 수학 집 화면은 `<HomeCtx.Provider value={MATH_HOME}>`).
   두 기기 합치기는 `shared/merge.js`의 `mergeMath`(한글 초기화 epoch와 상관없이 합침), 한글 전체 초기화·예전 백업 불러오기에도 수학 기록은 남긴다.
   사용자가 직접 말할 때만 바꾸는 규칙: 항목(덧셈·뺄셈·곱셈·나눗셈 + 골고루)을 골라 풀고 항목마다 단계가 따로 · 하루 50문제(부모 설정) · 객관식 4지선다 ·
   문제마다 제한 시간(단계마다 초, 부모 설정 넉넉하게·보통·짧게·끄기 — 시간이 다 되면 틀린 것으로 하고 정답 표시) · 정답 10개마다 수학 옷장에 꾸미기 하나 · 5개마다 수학 집 재료 하나(틀려도 회수 없음) ·
   하루 문제를 다 푼 날, 그날 그 항목을 20문제 이상 풀고 90% 이상 맞히면 그 항목만 다음 단계 · 단계 순서.
   화면에 '언니'라고 쓰지 않는다(10-23 사용자 요청). 아이 이름은 부모 설정 '수학 이름'(`State.math.name`, 기기·연동에만 저장)으로만 보이고 저장소에는 쓰지 않는다(규칙 6).
   `npm run check`의 `math_check`(문제·보기·항목·시간·규칙·수학 집·분리)와 `merge_test`가 통과해야 한다.
