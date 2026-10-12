# CLAUDE.md

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
