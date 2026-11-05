# 현재 상태 (덮어쓰기로 갱신)
브랜치: **main** (원래 폴더 `/Users/cadenzah/eclipse-web`). story-rework 는 WIP 커밋 (8a5f8f3) 으로 보류. origin/main 보다 앞섬, push 는 요청 때만
최근 (2026-11-06): 개선판 6 + N3 — 장별 조정 `content/remake/tune.json` (foeScale·npcHp·remove·troop, balance-proposal.md "6 장별 곡선 + N3"). 40% 미만 장 루트마다 6~11개 → 1~3개, 42·43장만 낮게. N3 전제가 틀렸음 (호위 NPC 는 원래 안 움직임) → 물러섬 AI 대신 NPC 생명 배율. 시뮬레이터 플레이어 고침 (정체 풀기·선두 조심 2.5) 이라 예전 표와 수치 다름
다음: B1 2순위 — 32 되돌리기 (Q8), 12 쓰러진 대가 (Q3 정함), 3 반격 (Q2), N5 숨은 규칙 도움말. 답 필요: Q2·Q6·Q8·Q12·Q13 (Q13 추천 "그대로"). 원작판 남은 것은 DOSBox 대조뿐
막힌 점: 음악·효과음 시점은 귀로 원작과 대조 못 함 (테스트 탭 소리 끔). 손으로 끝까지 깨 보기·실기기 미확인. 시뮬레이터 플레이어는 진형·보스 공략이 없어 승률 절대값은 참고만
실행·테스트: preview_start {name: 'dev'} (포트 5173). 먼저 /assets/data/labels.json 을 열어 localStorage eclipse.sound·music·introSound = '0'. 캠페인 장 시험 = localStorage `eclipse.slots.<판>` 에 {n,route,title,at,camp:{flags,party,items}} → 타이틀 이어하기. 전투 = `?ed=original&stage=3&party=0,13,26&nocamp`. 페이지에서 모듈을 import 할 때는 performance 자원 목록의 실제 URL (?t= 붙음) 로 — 아니면 다른 사본. 검사 `./node_modules/.bin/tsc --noEmit` (+ `-p tools/sim`). 자동 검증 `tools/verify.py --plan` + `/tools/verify_browser.js`, 컷신 `/tools/verify_cuts.js`. 상태 보기 = 개발 모드 `window.__game.S`
