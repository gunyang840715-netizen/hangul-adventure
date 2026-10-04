# 뭉치와 냥이의 글자 모험

유치원생을 위한 한글 학습 앱 · 앱 주소: <https://gunyang840715-netizen.github.io/hangul-adventure/>

- 소스는 `source/` 폴더, 고치는 AI를 위한 규칙은 [`AGENTS.md`](AGENTS.md)
- `source/` 가 바뀌면 GitHub Actions가 자동으로 검사 → 빌드 → 사이트 반영 (2~3분)

## ChatGPT로 같이 고치기

### 방법 1. Codex (추천: ChatGPT가 직접 고치고 올림)

1. ChatGPT의 **Codex** (chatgpt.com/codex) → GitHub 계정 연결 → 저장소 `hangul-adventure` 로 환경 만들기
   - 설정(Setup) 스크립트: `cd source && npm ci`
2. 고칠 내용을 한국어로 적기. 예) 「받아쓰기 통과 기준 기본값을 70%로 바꿔줘」, 「놀이터에 시소를 추가해줘」
   - 끝에 「AGENTS.md 규칙 지키고 npm run check 통과시켜줘」를 붙이면 좋음
3. 결과 확인 → **PR 만들기** → GitHub에서 그 PR 열고 **Merge pull request** → **Confirm merge**
4. 2~3분 뒤 자동 반영 → 저장소 **Actions** 탭에서 초록 ✓ 확인
5. 태블릿에서 앱을 다시 열면 새 버전. **부모 설정 → 기본 설정의 「앱 버전」** 날짜·번호로 확인

### 방법 2. 일반 ChatGPT 대화 (Codex를 안 쓸 때)

1. ChatGPT에 GitHub를 연결하거나(읽기만 가능) 소스 zip을 올리고:
   「hangul-adventure의 source 폴더를 보고 ○○를 고쳐줘. AGENTS.md 규칙을 지키고, 바뀐 파일은 전체 내용으로 줘」
2. GitHub에서 그 파일 열기 → 연필 ✏️ → 내용 전체를 지우고 붙여 넣기 → **Commit changes**
3. 자동 반영 (Actions 탭에서 ✓ 확인)

### 잘못됐을 때

- Actions가 빨간 ✗ 이면 사이트는 **이전 버전 그대로**입니다. ✗ 를 눌러 오류 내용을 복사해 ChatGPT에 「이 오류 고쳐줘」.
- 반영됐는데 이상하면: PR로 반영했을 경우 그 PR 페이지의 **Revert** 버튼 → 새 PR → Merge. (또는 Codex에 「방금 바꾼 것 되돌려줘」)

### 새 말(음성)을 추가했을 때

- 녹음이 없는 새 문장은 태블릿 기본 음성으로 읽힙니다 (동작은 정상).
- 녹음 목소리로 바꾸려면: 구글 Apps Script 「한글앱 서버」에서 `음성만들기켜기` 실행 → 태블릿·폰에서 앱을 켜 두기(새 문장이 자동으로 녹음·저장됨) → `음성만들기끄기` 실행. (비용 몇 원, 끄는 것 잊지 않기)

### 주의

- 이 저장소는 **공개**입니다. 아이 이름 · 연동 코드 · 서버 주소 · 키를 절대 올리지 마세요.
- 서버 코드(`source/backend/Code.template.gs`)는 자동 반영되지 않습니다.
