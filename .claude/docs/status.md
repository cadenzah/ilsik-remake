# 현재 상태 (덮어쓰기로 갱신)
브랜치: `main-remaining` (main 에서, 작업 트리 `.claude/worktrees/main-remaining` — 원래 폴더는 story-rework). main 에 아직 안 합침. `public/assets`·`build` 는 원래 폴더로 링크 (공유)
최근: 2026-10-17~20 배경음악·프롤로그·엔딩·숨은 보물 줍기. 2026-10-22 투사체 그림 (formats.md "투사체 그림": MAR 3·4, 무기별 무리, 칸마다 4걸음 × 1틱, `battle.ts` flyShot)
다음: 포수 폭발 그림 (20ec:2a82 → 330f, MAR 6 +0xba4) → 마법 직업 물리 공격 (무기 f2 = 0) → 원작 마법 창 (ECPMAG)·시전자 MAG 동작 → 효과음 잔여 (레벨업·전직·전투 보상 알림) → 9장 원작판 선택지 UI·정비 화면 나머지. B1 은 사용자가 풀면
막힌 점: 음악은 귀로 원작과 대조 못 함 (DOSBox 녹음 필요). 손으로 끝까지 깨 보기·캠페인 연속 진행은 자동 검증 밖. 컷신 흰/검정 효과는 브라우저 창을 보이게 둬야 확인됨. iOS·안드로이드 실기기 효과음·음악·터치 미확인
실행·테스트: preview_start 는 원래 폴더 launch.json 만 읽음 → 서버는 `node node_modules/vite/bin/vite.js --port 5213` (백그라운드) 뒤 preview_start url. 검사 `./node_modules/.bin/tsc --noEmit`. **테스트 탭은 소리 끄기** (사용자 요청): localStorage eclipse.sound·eclipse.music·eclipse.introSound = '0'. `?ed=remake&stage=N&party=…&nocamp`, 콘솔에서 `await import('/src/core/battle.ts')` 의 doAttack 으로 공격 재현. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
