# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (작업 트리 `.claude/worktrees/main-remaining`). 원래 폴더 `/Users/cadenzah/eclipse-web` 는 story-rework (건드리지 않음). `public/assets`·`build` 는 원래 폴더로 링크 (공유). origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-10-23): 네 지도·40장 환의 성전 (124e:a2cf~a449) — 40장 정비 화면에서 지도 넷이면 「탐험계속?」, 아니면 41장으로 건너뜀. 두 판 모두 A·C 규칙 (원작 B 루트 0xf44 오기는 formats.md 에만, 사용자 결정). 그 전: 전투 보상 알림 (109), 원작판 「마법일람표」
다음: 9장 원작판 선택지 UI → 정비 화면 나머지 (소지품·장비) → 마법 경험치. B1 은 사용자가 풀면
막힌 점: 음악·효과음 시점은 귀로 원작과 대조 못 함 (테스트 탭 소리 끔). 원작이 피로 부족 마법을 고르면 어떻게 되는지·모드 4 알림 그림이 무엇인지 DOSBox 미확인. 손으로 끝까지 깨 보기·실기기 미확인
실행·테스트: `node node_modules/vite/bin/vite.js --port 5213` (백그라운드) 뒤 preview_start url (먼저 localStorage eclipse.sound·music·introSound = '0'). 캠페인 장 시험 = localStorage `eclipse.slots.<판>` 에 {n,route,title,at,camp:{flags,party,items}} 를 넣고 타이틀 이어하기 → 기록 칸 (판 고르기는 타이틀 원작판/개선판 버튼, 끝나면 지움). 전투 = `?ed=original&stage=3&party=0,13,26&nocamp`. 검사 `./node_modules/.bin/tsc --noEmit`. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
