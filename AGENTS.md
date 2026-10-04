# AGENTS.md — 이 저장소를 고치는 AI(ChatGPT · Codex 등)를 위한 안내

유치원생 아이의 한글 학습 앱 「뭉치와 냥이의 글자 모험」입니다.
GitHub Pages로 바로 공개되는 **공개 저장소**이고, 태블릿에서 앱(PWA)으로 설치해 씁니다.

## 구조

| 위치 | 내용 | 고쳐도 되나 |
|---|---|---|
| `source/` | 앱 소스 (Preact + TypeScript + Vite, 한 파일로 빌드) | **고치는 곳은 여기뿐** |
| 맨 위 `index.html` · `sw.js` · `manifest.webmanifest` | 자동 빌드 결과물 | ✗ (Actions가 다시 만듦) |
| 맨 위 `voice-manifest.json` · `voice.*.json` | 녹음 음성팩 | ✗ |
| 맨 위 `icon-*.png` · `apple-touch-icon.png` | 앱 아이콘 | 필요할 때만 |
| 맨 위 `voice.<해시>.char.json` | 캐릭터 목소리(강아지 유라 · 고양이 명쾌한) 녹음 + 앱 문장 연결표(`pool`) | ✗ (`scripts/build_char_voice.py`로 다시 만듦) |
| `.github/workflows/build.yml` | main에 `source/` 변경이 들어오면 검사 → 빌드 → 맨 위 파일 갱신 → 사이트 반영 | 필요할 때만 |

`source/` 안:

- `src/engine/session.ts` — 레슨 구성 (새 글자 40번 쓰기: 10번×4세트, 마지막 10번은 그림자 없이 / 세트마다 놀이 / 끝에 받아쓰기 시험)
- `src/engine/store.ts` — 저장 · 진도 · 보상(간식·꾸미기·재료) · 틀리면 돌려받기 · 시험 통과/복습 상태
- `src/data/` — 커리큘럼(`curriculum.ts`) · 자모(`jamo.ts`) · 말하는 문장(`voice.ts`) · 집 안/놀이터 꾸미기(`home.ts`) · 강아지/고양이(`pets.ts`)
- `src/games/` — 놀이 화면(받아쓰기 `Dictation.tsx`, 쓰기 `Trace.tsx` 등), `src/screens/` — 지도 · 집 짓기 · 집 안 · 놀이터 · 부모 설정(`Extras.tsx`)
- `src/art/` — 그림(SVG 코드), `src/App.tsx` — 화면 전환 · 시험 통과/불합격 처리
- `shared/merge.js` — 두 기기 진도 합치기 규칙 (구글 Apps Script 서버와 같이 씀)
- `scripts/` — 검사 스크립트, PWA 파일 만들기(`build_pwa.py`)
- `backend/Code.template.gs` — 서버(구글 Apps Script) 원본. **자동 배포되지 않음** (사람이 Apps Script 편집기에 붙여 넣어야 함)

## 캐릭터 목소리 (강아지 유라 · 고양이 명쾌한)

- 칭찬(`PRAISE`)·다시 하기(`RETRY`, `GENTLE`)·인사·모험 시작·하루 마무리·성장 말은 **아이가 고른 대표 친구(`lead`)의 목소리**로 나온다.
  앱이 같은 문장을 말해도 녹음 묶음(pool)에서 돌아가며 골라 말하고, 연달아 같은 녹음은 피한다. (`engine/audio.ts`의 `poolKey`)
- 대표 친구의 녹음이 없는 문장은 기존 음성팩(SunHi · YuJin)으로 말한다. 글자 이름·소리·낱말·시험·지시 문장은 기존 음성 그대로.
- 새 녹음을 넣으려면: mp3 폴더(파일 이름 `유라-기쁨-날짜-문장.mp3` / `명쾌한-한국어-여성-날짜-문장.mp3`) →
  `python3 source/scripts/build_char_voice.py <mp3 폴더> .` 실행 후, 스크립트 안의 `POOLS`에 문장을 추가한 뒤 다시 실행.
- `npm run check`의 `voice_pool_check`(연결 문장·녹음 존재)와 `voice_route_test`(대표 친구에 따라 목소리가 맞게 나오는지)가 통과해야 한다.

## 작업 방법

```bash
cd source
npm ci          # 처음 한 번
npm run check   # 타입 검사 + 안 배운 글자 검사 + 이어하기 검사 + 합치기 규칙 검사 → 반드시 통과
npm run build   # dist/index.html 이 생기면 성공
```

- 변경은 `source/` 안에서만 합니다. `source/dist/`, `source/node_modules/` 는 커밋하지 않습니다.
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
