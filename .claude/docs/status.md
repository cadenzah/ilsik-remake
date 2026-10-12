# 현재 상태 (덮어쓰기로 갱신)
단계: 5단계 S2. 제안서 `.claude/docs/story-proposal.md` (15개 제안, 우선순위, 결정 사항 3개) — 사용자 승인 대기
S1 결과 story.md. scenes.json post 에 routes/flag/item 조건, 일행 편집(leave/swap/promote: 17·19·21·37·40장), 엔딩 장면 → post 43
다음: 승인된 제안 반영 (새 대사는 원작 추출물과 분리된 파일 추천). 각색 범위·말투 결정 필요
남은 소소한 것: 27·36장 메시지 상자 내용(0aa2:0118), 진로선택 선택지 문구(그래픽?), 원작 행동 순서 채택 여부(6단계)
실행: `pnpm dev` (5173) / `pnpm assets` / `python tools/story.py [script N|stats|routes]` / `?stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor}
