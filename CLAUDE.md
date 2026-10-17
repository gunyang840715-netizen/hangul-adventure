# CLAUDE.md

> **⓪ 매번 첫 명령 (사용자가 말하지 않아도): `node ../_collab/collab.mjs status`** — 이미 배포된 일·상대가 잡은 작업(🔒)·폴더가 뒤처졌는지 확인.
> 같은 일이 이미 배포됐으면 다시 하지 않는다. 작업 잡기 `start`, 끝 `done`, push 전 `guard`(로컬 push는 훅이 자동 실행). 자세한 순서: 바탕화면 hangul 폴더의 `AGENTS.md`.
> 그 폴더가 없는 곳(클라우드 복사본 등)이면 대신 `git fetch origin && git log --oneline -15 origin/main`으로 최근 배포를 확인한 뒤 시작한다.

이 저장소는 GPT(Codex 앱)와 Claude가 함께 고친다. Claude는 「코드·통합·검사·배포」 담당, GPT는 「그림」 담당.
작업 전 반드시 아래 세 파일을 읽는다. 우선순위: 사용자 지시 > COLLAB.md > AGENTS.md.

@AGENTS.md
@COLLAB.md
@HANDOFF.md

## Claude 작업 메모
- 사용자 컴퓨터 폴더(바탕화면 hangul\integrated-app)는 윈도우에서 받은 작업본이라 줄바꿈이 CRLF다.
  기기 셸에서 git을 쓸 때는 항상 `git -c core.autocrlf=true …` (안 그러면 모든 파일이 바뀐 것으로 보임).
- 기기 셸은 기본으로 파일을 못 지운다 → git 잠금 파일 때문에 커밋·체크아웃 전에 삭제 허락을 먼저 받는다.
- 기기 셸에는 GitHub 로그인이 없다. push는 GitHub에 쓰기 권한이 있는 쪽(클라우드 작업 공간)에서 하고, 끝나면 폴더를 main에 맞춘다.
- 차례 시작: 폴더의 git status → art-src/GPT_진행.md·각 묶음 납품.md 확인(GPT는 HANDOFF를 고치지 않음). art-src/·review/는 커밋하지 않는다(.gitignore).
- 폴더를 main에 맞출 때 git clean은 쓰지 않는다(art-src/에 GPT 그림이 있음).
- GPT는 클라우드에서 그린다(2026-10-13~): 구글 드라이브 「한글나라 그림 작업 (GPT·Claude 공용)」 — 00 작업지시 vN · 01 완료목록 · 재료/ · 결과/.
  차례 시작 때 Google Drive 도구로 결과/의 최신 '완료목록-…'을 확인. 작업지시를 바꾸려면 새 판(vN+1)을 새 문서로 올린다(기존 문서 내용 수정 불가).
  결과 zip은 커서 연결 도구로 못 받음 → 컴퓨터가 켜져 있을 때 받아 art-src로. 드라이브 링크·폴더 id는 공개 저장소에 쓰지 않는다(이름으로 찾기).
- 처음 보는 문제(스크립트 실패·칸 수 불일치·잘린 그림·검사 실패)는 검사 기준을 낮추거나 그림을 빼서 통과시키지 말고, 멈추고 사용자에게 알린다(그 부분은 Opus로).
