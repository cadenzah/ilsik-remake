# 현재 상태 (덮어쓰기로 갱신)
단계: 5단계. S1 완료 → story.md (장별 흐름·루트 A/B/C·인물 비중·연출 특징). 전투 순서표는 값 = 장 번호 (9장 후 바로 갈라짐, formats.md 정정)
scenes.json post 에 routes/flag/item 조건 추가 (16·20·26장 루트별 장면, 27장 흑기사 black27, 13장 요정피리), 엔딩 장면 2:43 → post 43
다음: S2 평가와 수정 제안 (진행 순서·캐릭터 비중·연출) — story.md 를 바탕으로 제안서 작성 후 사용자 승인 받기
남은 소소한 것: 27·36장 메시지 상자 내용(0aa2:0118), 진로선택 선택지 문구(그래픽?), 21장 수호자 강화(유닛 20) 미반영, 원작 행동 순서 채택 여부(6단계)
실행: `pnpm dev` (5173) / `pnpm assets` / `python tools/story.py [script N|stats|routes]` / `?stage=N&route=R`. 개발 모드 window.__game.{S,checkEnd,planFor}
