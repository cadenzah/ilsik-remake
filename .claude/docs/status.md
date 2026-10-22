# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (작업 트리 `.claude/worktrees/main-remaining`). 원래 폴더 `/Users/cadenzah/eclipse-web` 는 story-rework (건드리지 않음). `public/assets`·`build` 는 원래 폴더로 링크 (공유). origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-10-23): 원작판 마법 창 = 원작 「마법일람표」 (124e:b5c6 역어셈블, formats.md "마법일람표", `battle.ts magicWinOriginal`, 창틀 skin `magic`). 창 열기 3cd3:53de 의 w·h = 바깥 크기·안쪽 원점 규칙 확정. ECPnn.MAG 는 이펙트 다른 판이라 시전자 동작 작업 없음. 그 전 (10-22): 투사체·포수 폭발·궁수 명중, 원작판 마법 직업 '전투'
다음: 효과음 잔여 (레벨업·전직·전투 보상 알림) → 9장 원작판 선택지 UI·정비 화면 나머지 → 마법 경험치. 레벨업 창 (ECPLEV) 모양도 같은 방식 (53de 인자 + 안쪽 원점) 으로 원작대로 맞출 수 있음. B1 은 사용자가 풀면
막힌 점: 음악은 귀로 원작과 대조 못 함 (DOSBox 녹음 필요). 원작이 피로 부족 마법을 고르면 어떻게 되는지 (124e:3481, 효과 없음 추정) DOSBox 미확인. 손으로 끝까지 깨 보기·실기기 효과음·터치 미확인
실행·테스트: `node node_modules/vite/bin/vite.js --port 5213` (백그라운드) 뒤 preview_start url (먼저 정적 파일 열고 localStorage eclipse.sound·music·introSound = '0'). 원작판 마법 창: `?ed=original&stage=3&party=0,13,26&nocamp` → 크란 클릭 (합성 이벤트는 안 먹음, computer 클릭) → [마법]. 검사 `./node_modules/.bin/tsc --noEmit`. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
