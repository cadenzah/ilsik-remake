# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (작업 트리 `.claude/worktrees/main-remaining`). 원래 폴더 `/Users/cadenzah/eclipse-web` 는 story-rework (건드리지 않음). `public/assets`·`build` 는 원래 폴더로 링크 (공유). origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-10-23): 9장 원작판 선택지 — 장면 중간 「금괴조각주기」 [결정][취소] (0aa2:6531, 결정 = 깨진금괴 모두 회수·요정피리, campaign.ts GOLD) 와 진로선택 창 원작 자리 (280,220)·폭 125·취소 없음. 그 전: 네 지도·40장 환의 성전, 전투 보상 알림, 「마법일람표」
다음: 정비 화면 나머지 (소지품·장비 — formats.md 정비 화면 '미확인' 항목) → 마법 경험치. B1 은 사용자가 풀면. ecs_check 문제 12 (9장 아님, 전부터 있던 것) 는 따로 볼 것
막힌 점: 음악·효과음 시점은 귀로 원작과 대조 못 함 (테스트 탭 소리 끔). 원작이 피로 부족 마법을 고르면 어떻게 되는지·모드 4 알림 그림이 무엇인지 DOSBox 미확인. 손으로 끝까지 깨 보기·실기기 미확인
실행·테스트: `node node_modules/vite/bin/vite.js --port 5213` (백그라운드) 뒤 preview_start url (먼저 localStorage eclipse.sound·music·introSound = '0'). 캠페인 장 시험 = localStorage `eclipse.slots.<판>` 에 {n,route,title,at,camp:{flags,party,items}} 를 넣고 타이틀 이어하기 → 기록 칸 (판 고르기는 타이틀 원작판/개선판 버튼, 끝나면 지움). 브라우저 창이 숨겨지면 애니메이션이 멈추니 tabs_select 로 앞으로. 캠페인 전투는 선두 HP 를 올려 둘 것. 전투 = `?ed=original&stage=3&party=0,13,26&nocamp`. 검사 `./node_modules/.bin/tsc --noEmit`. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
