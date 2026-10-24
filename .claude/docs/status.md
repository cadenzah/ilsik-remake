# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (원래 폴더 `/Users/cadenzah/eclipse-web`). story-rework 는 WIP 커밋 (8a5f8f3) 으로 보류. origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-10-24): 역어셈블 미결 셋 정리 — ECLIPSE.780 캐리커처 = 한국판 죽은 코드 (부르는 곳 없음, 중국어 그대로) / 장 조건 d4a7 = 행동마다, 35장 DS:12bc 실행당 한 번 (원작판 firedRun) / AI 휴식 = 피로 > 70 또는 HP ≤ ¼ (깨어난 차례 제외, 두 판 aiGate)
다음: 사용자 결정 대기 — 원작 행동 순서 (민첩 키)·B1 제안·개선판 17장 그림. ecs_check 문제 12 (전부터). 원작판 10장 등 적 먼저 움직이는 장은 verify readyMs 150000
막힌 점: 음악·효과음 시점은 귀로 원작과 대조 못 함 (테스트 탭 소리 끔). 원작이 피로 부족 마법을 고르면 어떻게 되는지·모드 4 알림 그림이 무엇인지 DOSBox 미확인. 손으로 끝까지 깨 보기·실기기 미확인
실행·테스트: preview_start {name: 'dev'} (포트 5173, .claude/launch.json) — 먼저 정적 파일 (/assets/data/labels.json) 을 열어 localStorage eclipse.sound·music·introSound = '0'. 캠페인 장 시험 = localStorage `eclipse.slots.<판>` 에 {n,route,title,at,camp:{flags,party,items}} 를 넣고 타이틀 이어하기 → 기록 칸 (판 고르기는 타이틀 원작판/개선판 버튼, 끝나면 지움). 브라우저 창이 숨겨지면 애니메이션이 멈추니 tabs_select 로 앞으로. 캠페인 전투는 선두 HP 를 올려 둘 것. 전투 = `?ed=original&stage=3&party=0,13,26&nocamp`. 검사 `./node_modules/.bin/tsc --noEmit`. 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`
