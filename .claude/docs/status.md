# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (작업 트리 `.claude/worktrees/main-remaining`). 원래 폴더 `/Users/cadenzah/eclipse-web` 는 story-rework (건드리지 않음). `public/assets`·`build` 는 원래 폴더로 링크 (공유). origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-10-23): 전투 보상 알림 (2ff8:1706, 품목마다 알림 창 모드 5 + 효과음 109, `battle.ts gotItem`) — 효과음 잔여 끝 (레벨업 108·전직 ani 12 는 이미 있었음). 그 전: 원작판 「마법일람표」 (124e:b5c6, `magicWinOriginal`), 창 열기 3cd3:53de 규칙 (formats.md)
다음: 장 건너뛰기 — 네 지도 (남·북·서·동의지도 0xaf~0xb2) 를 다 모으면 알림 창 모드 4 「성전으로 들어갈 수 있는 지도를 완성했다. 탐험계속?」 (0aa2:164d, 정비 화면 확정 뒤 124e a2e3~a449, formats.md 정비 화면 항) → 9장 원작판 선택지 UI·정비 화면 나머지 → 마법 경험치. B1 은 사용자가 풀면
막힌 점: 음악·효과음 시점은 귀로 원작과 대조 못 함 (DOSBox 녹음 필요, 테스트 탭은 소리 끔). 원작이 피로 부족 마법을 고르면 어떻게 되는지 미확인. 손으로 끝까지 깨 보기·실기기 효과음·터치 미확인
실행·테스트: `node node_modules/vite/bin/vite.js --port 5213` (백그라운드) 뒤 preview_start url (먼저 정적 파일 열고 localStorage eclipse.sound·music·introSound = '0'). 예: `?ed=original&stage=3&party=0,13,26&nocamp` → 대사는 Esc 로 넘김, 적 hp 0 + `__game.checkEnd()` = 승리 (3장 보상 2개). 유닛 클릭은 computer 클릭 (합성 이벤트 안 먹음). 검사 `./node_modules/.bin/tsc --noEmit`. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
