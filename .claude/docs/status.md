# 현재 상태 (덮어쓰기로 갱신)
단계: 5단계 S2 + 원작판/개선판 구조 검토. 결정: 각색 = 장면 재구성까지(개선판만), 대사 = 현대어
제안서 `story-proposal.md` (15개 + 6번 상세), 구조 검토안 `editions.md` (브랜치 대신 한 코드베이스 안 에디션, 캠페인 = 데이터 그래프)
다음: 사용자 확인 대기 — 구조안 승인 시 plan.md V1(엔진 분리)부터. 반영할 제안 번호, 판 선택 방식(런타임 추천), 개선판 대사 커밋 여부 미정
남은 소소한 것: 27·36장 메시지 상자(0aa2:0118), 진로선택 문구, 원작판용 역분석 확대(피해 공식·경험치·AI)
실행: `pnpm dev` (5173) / `pnpm assets` / `python tools/story.py [script N|stats|routes]` / `?stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor}
